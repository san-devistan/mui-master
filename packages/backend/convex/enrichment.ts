import { v } from "convex/values"
import { Effect } from "effect"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { creditedArtists, linkSongArtists, upsertArtists } from "./artists"
import {
  fetchAlbums,
  fetchArtists,
  fetchTrackArtists,
  idBatchSize,
} from "./songs/_lib/audiometa"
import {
  albumDetails,
  artistDetails,
  importedArtist,
} from "./songs/_lib/validators"

// Backfills artists and albums from Audiometa in three phases:
// - tracks: credited artists of every stored song (artists, songs.artistIds, songArtists)
// - albums: full album details and album artists, for albums not enriched yet
// - artists: full artist details (genres, bio, socials), for artists not enriched yet
// Run: pnpm exec convex run enrichment:start. Progress is in enrichmentRuns.
// A failed run continues from where it stopped with enrichment:resume { runId }.

// About 4 requests/second, rotated over the API keys: each key stays far under 100/minute.
const stepDelayMs = 250

const phaseValidator = v.union(
  v.literal("tracks"),
  v.literal("albums"),
  v.literal("artists")
)
type Phase = Doc<"enrichmentRuns">["phase"]
const nextPhase: Record<Phase, Phase | null> = {
  tracks: "albums",
  albums: "artists",
  artists: null,
}

type Batch = {
  phase: Phase
  cursor: string | null
  ids: Array<string>
  nextCursor: string | null
  isDone: boolean
  keyIndex: number
}

const trackResult = v.object({
  trackId: v.string(),
  artists: v.array(importedArtist),
})
const albumResult = v.object({
  sourceId: v.string(),
  name: v.string(),
  albumType: v.optional(v.string()),
  releaseDate: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  artistNames: v.array(v.string()),
  artistIds: v.array(v.string()),
  details: albumDetails,
})
const artistResult = v.object({
  sourceId: v.string(),
  name: v.string(),
  details: artistDetails,
})

export const start = internalMutation({
  args: {},
  handler: async (ctx) => {
    const runId = await ctx.db.insert("enrichmentRuns", {
      status: "running",
      phase: "tracks",
      cursor: null,
      keyIndex: 0,
      processed: 0,
      startedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.enrichment.step, { runId })
    return runId
  },
})

export const resume = internalMutation({
  args: { runId: v.id("enrichmentRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get("enrichmentRuns", runId)
    if (run?.status !== "failed") {
      return null
    }
    await ctx.db.patch("enrichmentRuns", runId, {
      status: "running",
      error: undefined,
    })
    await ctx.scheduler.runAfter(0, internal.enrichment.step, { runId })
    return null
  },
})

async function pendingIds(ctx: QueryCtx, table: "albums" | "artists") {
  const limit = idBatchSize[table]
  const docs =
    table === "albums"
      ? await ctx.db
          .query("albums")
          .withIndex("by_enrichedAt", (q) => q.eq("enrichedAt", undefined))
          .take(limit)
      : await ctx.db
          .query("artists")
          .withIndex("by_enrichedAt", (q) => q.eq("enrichedAt", undefined))
          .take(limit)
  return docs.map((doc) => doc.sourceId)
}

export const nextBatch = internalQuery({
  args: { runId: v.id("enrichmentRuns") },
  handler: async (ctx, { runId }): Promise<Batch | null> => {
    const run = await ctx.db.get("enrichmentRuns", runId)
    if (run?.status !== "running") {
      return null
    }
    const base = {
      phase: run.phase,
      cursor: run.cursor,
      keyIndex: run.keyIndex,
    }

    if (run.phase === "tracks") {
      const page = await ctx.db
        .query("songs")
        .paginate({ cursor: run.cursor, numItems: idBatchSize.tracks })
      return {
        ...base,
        ids: page.page.map((song) => song.sourceId),
        nextCursor: page.continueCursor,
        isDone: page.isDone,
      }
    }

    // Albums and artists are swept by the missing enrichedAt, so the phase ends when none are left.
    const ids = await pendingIds(ctx, run.phase)
    return { ...base, ids, nextCursor: null, isDone: ids.length === 0 }
  },
})

type Fetched = {
  tracks: Array<typeof trackResult.type>
  albums: Array<typeof albumResult.type>
  artists: Array<typeof artistResult.type>
}
const empty: Fetched = { tracks: [], albums: [], artists: [] }

function fetchBatch(batch: Batch) {
  const { keyIndex, ids } = batch
  if (batch.phase === "tracks") {
    return fetchTrackArtists(keyIndex, ids).pipe(
      Effect.map((tracks): Fetched => ({ ...empty, tracks }))
    )
  }
  if (batch.phase === "albums") {
    return fetchAlbums(keyIndex, ids).pipe(
      Effect.map((albums): Fetched => ({ ...empty, albums }))
    )
  }
  return fetchArtists(keyIndex, ids).pipe(
    Effect.map((artists): Fetched => ({ ...empty, artists }))
  )
}

export const step = internalAction({
  args: { runId: v.id("enrichmentRuns") },
  handler: async (ctx, { runId }) => {
    const batch: Batch | null = await ctx.runQuery(
      internal.enrichment.nextBatch,
      { runId }
    )
    if (!batch) {
      return null
    }

    const fetched =
      batch.ids.length === 0
        ? { ok: true as const, ...empty }
        : await Effect.runPromise(
            fetchBatch(batch).pipe(
              Effect.map((result) => ({ ok: true as const, ...result })),
              Effect.catch((error) =>
                Effect.succeed({ ok: false as const, error: error.message })
              )
            )
          )

    if (!fetched.ok) {
      await ctx.runMutation(internal.enrichment.fail, {
        runId,
        error: fetched.error,
      })
      return null
    }

    await ctx.runMutation(internal.enrichment.saveBatch, {
      runId,
      phase: batch.phase,
      cursor: batch.cursor,
      nextCursor: batch.nextCursor,
      isDone: batch.isDone,
      requested: batch.ids,
      tracks: fetched.tracks,
      albums: fetched.albums,
      artists: fetched.artists,
    })
    return null
  },
})

export const fail = internalMutation({
  args: { runId: v.id("enrichmentRuns"), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    await ctx.db.patch("enrichmentRuns", runId, { status: "failed", error })
    return null
  },
})

async function saveTracks(
  ctx: MutationCtx,
  tracks: ReadonlyArray<typeof trackResult.type>
) {
  for (const { trackId, artists } of tracks) {
    const version = await ctx.db
      .query("songVersions")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", trackId))
      .unique()
    if (version && artists.length > 0) {
      await linkSongArtists(ctx, version.songId, artists)
    }
  }
}

// Requested IDs that Audiometa didn't return are still marked, so the sweep moves on.
async function saveAlbums(
  ctx: MutationCtx,
  requested: ReadonlyArray<string>,
  albums: ReadonlyArray<typeof albumResult.type>,
  enrichedAt: number
) {
  const found = new Map(albums.map((album) => [album.sourceId, album]))
  for (const sourceId of requested) {
    const stored = await ctx.db
      .query("albums")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", sourceId))
      .unique()
    const album = found.get(sourceId)
    if (!stored) {
      continue
    }
    if (!album) {
      await ctx.db.patch("albums", stored._id, { enrichedAt })
      continue
    }
    const { artistIds, ...fields } = album
    await ctx.db.patch("albums", stored._id, {
      ...fields,
      artistIds: await upsertArtists(
        ctx,
        creditedArtists(artistIds, fields.artistNames)
      ),
      enrichedAt,
    })
  }
}

async function saveArtists(
  ctx: MutationCtx,
  requested: ReadonlyArray<string>,
  artists: ReadonlyArray<typeof artistResult.type>,
  enrichedAt: number
) {
  const found = new Map(artists.map((artist) => [artist.sourceId, artist]))
  for (const sourceId of requested) {
    const stored = await ctx.db
      .query("artists")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", sourceId))
      .unique()
    if (stored) {
      const artist = found.get(sourceId)
      await ctx.db.patch(
        "artists",
        stored._id,
        artist ? { ...artist, enrichedAt } : { enrichedAt }
      )
    }
  }
}

export const saveBatch = internalMutation({
  args: {
    runId: v.id("enrichmentRuns"),
    phase: phaseValidator,
    cursor: v.union(v.string(), v.null()),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    requested: v.array(v.string()),
    tracks: v.array(trackResult),
    albums: v.array(albumResult),
    artists: v.array(artistResult),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get("enrichmentRuns", args.runId)
    // A stale step (run moved on or stopped) saves nothing.
    if (
      run?.status !== "running" ||
      run.phase !== args.phase ||
      run.cursor !== args.cursor
    ) {
      return null
    }

    const now = Date.now()
    if (args.phase === "tracks") {
      await saveTracks(ctx, args.tracks)
    } else if (args.phase === "albums") {
      await saveAlbums(ctx, args.requested, args.albums, now)
    } else {
      await saveArtists(ctx, args.requested, args.artists, now)
    }

    const following = args.isDone ? nextPhase[args.phase] : args.phase
    if (following === null) {
      await ctx.db.patch("enrichmentRuns", args.runId, {
        status: "done",
        processed: run.processed + args.requested.length,
        finishedAt: now,
      })
      return null
    }

    await ctx.db.patch("enrichmentRuns", args.runId, {
      phase: following,
      cursor: following === "tracks" ? args.nextCursor : null,
      keyIndex: run.keyIndex + 1,
      processed: run.processed + args.requested.length,
    })
    await ctx.scheduler.runAfter(stepDelayMs, internal.enrichment.step, {
      runId: args.runId,
    })
    return null
  },
})

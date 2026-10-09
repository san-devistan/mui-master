import { v } from "convex/values"
import { Effect } from "effect"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server"
import { creditedArtists, linkSongArtists, upsertArtists } from "./artists"
import { adjustRarityCount } from "./rarity"
import {
  apiKeyCount,
  browsePageSize,
  fetchBpmPage,
  fetchPopularityPage,
} from "./songs/_lib/audiometa"
import { lastBpm, nextCrawlCursor } from "./songs/_lib/crawl"
import { displayTitle, songKey } from "./songs/_lib/dedupe"
import { minSpotifyStreams, rarityForStreams } from "./songs/_lib/rarity"
import { importedSong, type ImportedSong } from "./songs/_lib/validators"

type SongMatch = {
  song: ImportedSong
  key: string
  existing: Doc<"songs"> | null
}

async function upsertAlbum(ctx: MutationCtx, song: ImportedSong) {
  if (!song.album) {
    return null
  }

  const { artistIds, ...fields } = song.album
  const album = {
    ...fields,
    artistIds: await upsertArtists(
      ctx,
      creditedArtists(artistIds, fields.artistNames)
    ),
  }
  const existing = await ctx.db
    .query("albums")
    .withIndex("by_sourceId", (q) => q.eq("sourceId", album.sourceId))
    .unique()

  if (existing) {
    // patch, not replace: keeps the enrichment fields (details, enrichedAt).
    await ctx.db.patch("albums", existing._id, album)
    return existing._id
  }

  return await ctx.db.insert("albums", album)
}

async function linkAlbum(
  ctx: MutationCtx,
  songId: Id<"songs">,
  albumId: Id<"albums"> | null
) {
  if (!albumId) {
    return
  }

  const link = await ctx.db
    .query("songAlbums")
    .withIndex("by_songId_and_albumId", (q) =>
      q.eq("songId", songId).eq("albumId", albumId)
    )
    .unique()

  if (!link) {
    await ctx.db.insert("songAlbums", { songId, albumId })
  }
}

async function upsertVersion(
  ctx: MutationCtx,
  songId: Id<"songs">,
  song: ImportedSong
) {
  const version = {
    sourceId: song.sourceId,
    songId,
    title: song.title,
    isrc: song.isrc,
    spotifyStreams: song.spotifyStreams,
  }
  const existing = await ctx.db
    .query("songVersions")
    .withIndex("by_sourceId", (q) => q.eq("sourceId", song.sourceId))
    .unique()

  if (existing) {
    await ctx.db.replace("songVersions", existing._id, version)
  } else {
    await ctx.db.insert("songVersions", version)
  }
}

async function findSong(ctx: MutationCtx, song: ImportedSong, key: string) {
  const version = await ctx.db
    .query("songVersions")
    .withIndex("by_sourceId", (q) => q.eq("sourceId", song.sourceId))
    .unique()

  if (version) {
    return await ctx.db.get("songs", version.songId)
  }

  return await ctx.db
    .query("songs")
    .withIndex("by_songKey", (q) => q.eq("songKey", key))
    .unique()
}

async function saveSong(
  ctx: MutationCtx,
  { song, key, existing }: SongMatch,
  syncedAt: number
) {
  const rarity = rarityForStreams(song.spotifyStreams)
  const fields = {
    songKey: existing?.songKey ?? key,
    sourceId: song.sourceId,
    title: displayTitle(song.title),
    artistNames: song.artistNames,
    imageUrl: song.imageUrl,
    previewUrl: song.previewUrl,
    isrc: song.isrc,
    spotifyStreams: song.spotifyStreams,
    rarity,
    bpm: song.bpm,
    details: song.details,
    syncedAt,
  }

  if (!existing) {
    if (rarity) {
      await adjustRarityCount(ctx, rarity, 1)
    }
    return await ctx.db.insert("songs", {
      ...fields,
      randomKey: Math.random(),
      reviewed: false,
    })
  }

  if (song.spotifyStreams < existing.spotifyStreams) {
    return existing._id
  }

  if (rarity !== existing.rarity) {
    if (existing.rarity) {
      await adjustRarityCount(ctx, existing.rarity, -1)
    }
    if (rarity) {
      await adjustRarityCount(ctx, rarity, 1)
    }
  }

  await ctx.db.patch("songs", existing._id, fields)
  return existing._id
}

async function importSong(
  ctx: MutationCtx,
  song: ImportedSong,
  syncedAt: number
) {
  const leadArtistId = song.artistIds[0]
  if (!leadArtistId) {
    return false
  }

  const key = songKey(song.title, leadArtistId)
  const existing = await findSong(ctx, song, key)
  const songId = await saveSong(ctx, { song, key, existing }, syncedAt)

  // The card shows the most streamed version, so only that version sets the credits.
  if (!existing || song.spotifyStreams >= existing.spotifyStreams) {
    await linkSongArtists(
      ctx,
      songId,
      creditedArtists(song.artistIds, song.artistNames)
    )
  }
  await upsertVersion(ctx, songId, song)
  await linkAlbum(ctx, songId, await upsertAlbum(ctx, song))
  return existing === null
}

const stopAfterEmptyRanks = 3000
const maxOffset = 20_000
const stepDelayMs = 1500
// ~2 requests per step keeps each key under its 100 requests/minute limit.
const crawlDelayMs = 1200

function nextPopularityCursor(
  offset: number,
  scanned: number,
  lastHitOffset: number
) {
  const nextOffset = offset + browsePageSize
  return {
    bpm: undefined,
    offset: nextOffset,
    finished:
      scanned < browsePageSize ||
      nextOffset - lastHitOffset >= stopAfterEmptyRanks ||
      nextOffset >= maxOffset,
  }
}

export const startImport = internalMutation({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db.query("songImports").order("desc").first()
    if (latest?.status === "running") {
      return latest._id
    }

    const importId = await ctx.db.insert("songImports", {
      status: "running",
      nextOffset: 0,
      lastHitOffset: 0,
      scanned: 0,
      imported: 0,
      startedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.catalog.step, { importId })
    return importId
  },
})

// One worker per API key; worker i crawls BPM fromBpm+i, +workers, ...
export const startCrawl = internalMutation({
  args: { fromBpm: v.optional(v.number()), toBpm: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const recent = await ctx.db.query("songImports").order("desc").take(50)
    const running = recent.filter(
      (run) => run.status === "running" && run.bpm !== undefined
    )
    if (running.length > 0) {
      return running.map((run) => run._id)
    }

    const fromBpm = args.fromBpm ?? 0
    const toBpm = Math.min(args.toBpm ?? lastBpm, lastBpm)
    const workers = Math.min(apiKeyCount(), toBpm - fromBpm + 1)
    const importIds = []

    for (let keyIndex = 0; keyIndex < workers; keyIndex += 1) {
      const importId = await ctx.db.insert("songImports", {
        status: "running",
        nextOffset: 0,
        lastHitOffset: 0,
        scanned: 0,
        imported: 0,
        startedAt: Date.now(),
        bpm: fromBpm + keyIndex,
        bpmStep: workers,
        toBpm,
        keyIndex,
      })
      await ctx.scheduler.runAfter(0, internal.catalog.step, { importId })
      importIds.push(importId)
    }
    return importIds
  },
})

export const getRun = internalQuery({
  args: { importId: v.id("songImports") },
  handler: async (ctx, { importId }) =>
    await ctx.db.get("songImports", importId),
})

export const step = internalAction({
  args: { importId: v.id("songImports") },
  handler: async (ctx, { importId }) => {
    const run = await ctx.runQuery(internal.catalog.getRun, { importId })
    if (run?.status !== "running") {
      return null
    }

    const request =
      run.bpm === undefined
        ? fetchPopularityPage(run.nextOffset, minSpotifyStreams)
        : fetchBpmPage(
            run.keyIndex ?? 0,
            run.bpm,
            run.nextOffset,
            minSpotifyStreams
          )
    const page = await Effect.runPromise(
      request.pipe(
        Effect.map((result) => ({ ok: true as const, ...result })),
        Effect.catch((error) =>
          Effect.succeed({ ok: false as const, error: error.message })
        )
      )
    )

    if (!page.ok) {
      await ctx.runMutation(internal.catalog.fail, {
        importId,
        error: page.error,
      })
      return null
    }

    await ctx.runMutation(internal.catalog.savePage, {
      importId,
      bpm: run.bpm,
      offset: run.nextOffset,
      scanned: page.scanned,
      songs: page.songs,
    })
    return null
  },
})

export const savePage = internalMutation({
  args: {
    importId: v.id("songImports"),
    bpm: v.optional(v.number()),
    offset: v.number(),
    scanned: v.number(),
    songs: v.array(importedSong),
  },
  handler: async (ctx, { importId, bpm, offset, scanned, songs }) => {
    const run = await ctx.db.get("songImports", importId)
    if (
      run?.status !== "running" ||
      run.nextOffset !== offset ||
      run.bpm !== bpm
    ) {
      return null
    }

    const syncedAt = Date.now()
    let imported = 0
    for (const song of songs) {
      if (await importSong(ctx, song, syncedAt)) {
        imported += 1
      }
    }

    const lastHitOffset =
      songs.length > 0 ? offset + browsePageSize : run.lastHitOffset
    const next =
      bpm === undefined
        ? nextPopularityCursor(offset, scanned, lastHitOffset)
        : nextCrawlCursor(
            { bpm, bpmStep: run.bpmStep ?? 1, offset, scanned },
            browsePageSize,
            run.toBpm ?? lastBpm
          )

    await ctx.db.patch("songImports", importId, {
      bpm: next.bpm,
      nextOffset: next.offset,
      lastHitOffset,
      scanned: run.scanned + scanned,
      imported: run.imported + imported,
      ...(next.finished
        ? { status: "done" as const, finishedAt: syncedAt }
        : {}),
    })

    if (!next.finished) {
      await ctx.scheduler.runAfter(
        bpm === undefined ? stepDelayMs : crawlDelayMs,
        internal.catalog.step,
        { importId }
      )
    }
    return null
  },
})

export const fail = internalMutation({
  args: { importId: v.id("songImports"), error: v.string() },
  handler: async (ctx, { importId, error }) => {
    await ctx.db.patch("songImports", importId, {
      status: "failed",
      error,
      finishedAt: Date.now(),
    })
    return null
  },
})

export const resume = internalMutation({
  args: { importId: v.id("songImports") },
  handler: async (ctx, { importId }) => {
    const run = await ctx.db.get("songImports", importId)
    if (run?.status !== "failed") {
      return null
    }

    await ctx.db.patch("songImports", importId, {
      status: "running",
      error: undefined,
      finishedAt: undefined,
    })
    await ctx.scheduler.runAfter(0, internal.catalog.step, { importId })
    return null
  },
})

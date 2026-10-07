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
import { browsePageSize, fetchPopularityPage } from "./songs/_lib/audiometa"
import { displayTitle, songKey } from "./songs/_lib/dedupe"
import { minSpotifyStreams, rarityForStreams } from "./songs/_lib/rarity"
import {
  importedSong,
  type ImportedSong,
  type SongRarity,
} from "./songs/_lib/validators"

type SongMatch = {
  song: ImportedSong
  key: string
  existing: Doc<"songs"> | null
}

async function adjustRarityCount(
  ctx: MutationCtx,
  rarity: SongRarity,
  delta: number
) {
  const counter = await ctx.db
    .query("rarityCounters")
    .withIndex("by_rarity", (q) => q.eq("rarity", rarity))
    .unique()

  if (counter) {
    await ctx.db.patch("rarityCounters", counter._id, {
      count: Math.max(0, counter.count + delta),
    })
  } else {
    await ctx.db.insert("rarityCounters", {
      rarity,
      count: Math.max(0, delta),
    })
  }
}

async function upsertAlbum(ctx: MutationCtx, song: ImportedSong) {
  if (!song.album) {
    return null
  }

  const album = song.album
  const existing = await ctx.db
    .query("albums")
    .withIndex("by_sourceId", (q) => q.eq("sourceId", album.sourceId))
    .unique()

  if (existing) {
    await ctx.db.replace("albums", existing._id, album)
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
  const fields = {
    songKey: existing?.songKey ?? key,
    sourceId: song.sourceId,
    title: displayTitle(song.title),
    artistNames: song.artistNames,
    imageUrl: song.imageUrl,
    previewUrl: song.previewUrl,
    isrc: song.isrc,
    spotifyStreams: song.spotifyStreams,
    rarity: rarityForStreams(song.spotifyStreams),
    syncedAt,
  }

  if (!existing) {
    await adjustRarityCount(ctx, fields.rarity, 1)
    return await ctx.db.insert("songs", {
      ...fields,
      randomKey: Math.random(),
    })
  }

  if (song.spotifyStreams < existing.spotifyStreams) {
    return existing._id
  }

  if (fields.rarity !== existing.rarity) {
    await adjustRarityCount(ctx, existing.rarity, -1)
    await adjustRarityCount(ctx, fields.rarity, 1)
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

  await upsertVersion(ctx, songId, song)
  await linkAlbum(ctx, songId, await upsertAlbum(ctx, song))
  return existing === null
}

const stopAfterEmptyRanks = 3000
const maxOffset = 20_000
const stepDelayMs = 1500

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

    const page = await Effect.runPromise(
      fetchPopularityPage(run.nextOffset, minSpotifyStreams).pipe(
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
    offset: v.number(),
    scanned: v.number(),
    songs: v.array(importedSong),
  },
  handler: async (ctx, { importId, offset, scanned, songs }) => {
    const run = await ctx.db.get("songImports", importId)
    if (run?.status !== "running" || run.nextOffset !== offset) {
      return null
    }

    const syncedAt = Date.now()
    let imported = 0
    for (const song of songs) {
      if (await importSong(ctx, song, syncedAt)) {
        imported += 1
      }
    }

    const nextOffset = offset + browsePageSize
    const lastHitOffset = songs.length > 0 ? nextOffset : run.lastHitOffset
    const finished =
      scanned < browsePageSize ||
      nextOffset - lastHitOffset >= stopAfterEmptyRanks ||
      nextOffset >= maxOffset

    await ctx.db.patch("songImports", importId, {
      nextOffset,
      lastHitOffset,
      scanned: run.scanned + scanned,
      imported: run.imported + imported,
      ...(finished ? { status: "done" as const, finishedAt: syncedAt } : {}),
    })

    if (!finished) {
      await ctx.scheduler.runAfter(stepDelayMs, internal.catalog.step, {
        importId,
      })
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

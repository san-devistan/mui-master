import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server"
import { isBetterRelease } from "./songs/_lib/dedupe"
import {
  artistRarityForStreams,
  minSpotifyStreams,
  raiseRarity,
  rarityForStreams,
} from "./songs/_lib/rarity"
import type { CardRarity } from "./songs/_lib/validators"

// Upserts songs and their artists by Spotify id, from scripts/import-songs.mjs.

const ids = v.object({
  spotify: v.string(),
  deezer: v.union(v.string(), v.null()),
})

const artist = v.object({
  name: v.string(),
  ids,
  // Null when Spotify has none: such an artist is dropped by keepArtist.
  image: v.union(v.string(), v.null()),
  monthlyListeners: v.union(v.number(), v.null()),
})

const song = v.object({
  name: v.string(),
  ids: v.object({ ...ids.fields, isrc: v.string() }),
  // Spotify ids, lead first.
  artists: v.array(v.string()),
  playcount: v.number(),
  image: v.string(),
  preview: v.union(v.string(), v.null()),
  metadata: v.object({
    tempo: v.number(),
    durationMs: v.number(),
    explicit: v.boolean(),
    releaseYear: v.number(),
    releaseDate: v.string(),
  }),
})

// The catalog's rules; nothing else is ever stored. The import sends every
// credit, these keep only real artists and the songs that still have one.
// Spotify ids that are labels or compilations, not artists.
const notArtists = new Set(["0LyfQWJT6nXafLPZqxe9Of"]) // Various Artists

// A real artist profile: a picture and a monthly listener count. Side, alias
// or misspelled profiles ("Juciy J") have neither.
const keepArtist = (
  row: typeof artist.type
): row is typeof artist.type & { image: string; monthlyListeners: number } =>
  row.image !== null &&
  row.monthlyListeners !== null &&
  !notArtists.has(row.ids.spotify)

// 100M+ streams, a title, and at least one kept artist.
const keepSong = (row: typeof song.type, kept: ReadonlySet<string>) =>
  row.playcount >= minSpotifyStreams &&
  row.name.trim() !== "" &&
  row.artists.some((id) => kept.has(id))

// A song's rarity from its streams, never below the one it had.
const songRarity = (playcount: number, current?: CardRarity) =>
  raiseRarity(current, rarityForStreams(playcount) ?? "common")

async function upsertArtist(
  ctx: MutationCtx,
  row: typeof artist.type & { image: string; monthlyListeners: number }
) {
  const existing = await ctx.db
    .query("artists")
    .withIndex("by_spotifyId", (q) => q.eq("ids.spotify", row.ids.spotify))
    .unique()
  if (existing) {
    // A song without a Deezer match must not erase the artist's Deezer id.
    await ctx.db.patch("artists", existing._id, {
      ...row,
      ids: { ...row.ids, deezer: row.ids.deezer ?? existing.ids.deezer },
    })
    return existing._id
  }
  // updateRarities sets its real playcount and rarity at the end of the import run.
  return await ctx.db.insert("artists", {
    ...row,
    playcount: 0,
    rarity: "common",
    drawKey: Math.random(),
  })
}

type StoredSong = {
  id: Id<"songs">
  spotify: string
  duplicates: Array<string>
  playcount: number
  rarity: CardRarity
  artistIds: Array<Id<"artists">>
}

// Every stored song, a page at a time: the import refreshes these songs and treats every id
// listed as stored; updateRarities sums their playcounts per artist.
export const storedSongs = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (
    ctx,
    { paginationOpts }
  ): Promise<PaginationResult<StoredSong>> => {
    const result = await ctx.db.query("songs").paginate(paginationOpts)
    return {
      ...result,
      page: result.page.map((row) => ({
        id: row._id,
        spotify: row.ids.spotify,
        duplicates: row.ids.duplicates,
        playcount: row.playcount,
        rarity: row.rarity,
        artistIds: row.artistIds,
      })),
    }
  },
})

type StoredArtist = { id: Id<"artists">; spotify: string; rarity: CardRarity }

// Every stored artist, a page at a time, for the import to refresh.
export const storedArtists = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (
    ctx,
    { paginationOpts }
  ): Promise<PaginationResult<StoredArtist>> => {
    const result = await ctx.db.query("artists").paginate(paginationOpts)
    return {
      ...result,
      page: result.page.map((row) => ({
        id: row._id,
        spotify: row.ids.spotify,
        rarity: row.rarity,
      })),
    }
  },
})

// Updates stored songs' play counts (and raises the rarity they give) and stored artists' monthly
// listeners, by Spotify id. Ids not stored are ignored: a refresh never adds or removes anything.
export const refresh = internalMutation({
  args: {
    songs: v.array(v.object({ spotify: v.string(), playcount: v.number() })),
    artists: v.array(
      v.object({ spotify: v.string(), monthlyListeners: v.number() })
    ),
  },
  handler: async (ctx, args) => {
    for (const { spotify, playcount } of args.songs) {
      const row = await ctx.db
        .query("songs")
        .withIndex("by_spotifyId", (q) => q.eq("ids.spotify", spotify))
        .unique()
      if (row) {
        await ctx.db.patch("songs", row._id, {
          playcount,
          rarity: songRarity(playcount, row.rarity),
        })
      }
    }
    for (const { spotify, monthlyListeners } of args.artists) {
      const row = await ctx.db
        .query("artists")
        .withIndex("by_spotifyId", (q) => q.eq("ids.spotify", spotify))
        .unique()
      if (row) await ctx.db.patch("artists", row._id, { monthlyListeners })
    }
  },
})

// Sets artists' playcounts and top songs, and raises their rarity to what the new count gives.
export const setArtistPlaycounts = internalMutation({
  args: {
    artists: v.array(
      v.object({
        id: v.id("artists"),
        playcount: v.number(),
        topSongId: v.optional(v.id("songs")),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const { id, playcount, topSongId } of args.artists) {
      const row = await ctx.db.get("artists", id)
      if (!row) continue
      const rarity = raiseRarity(row.rarity, artistRarityForStreams(playcount))
      if (
        row.playcount !== playcount ||
        row.rarity !== rarity ||
        row.topSongId !== topSongId
      ) {
        await ctx.db.patch("artists", id, { playcount, rarity, topSongId })
      }
    }
  },
})

const tierCounts = v.object({ songs: v.number(), artists: v.number() })

export const setCatalogStats = internalMutation({
  args: {
    songs: v.number(),
    artists: v.number(),
    byRarity: v.object({
      common: tierCounts,
      rare: tierCounts,
      epic: tierCounts,
      legendary: tierCounts,
    }),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("catalogStats").first()
    if (row) await ctx.db.replace("catalogStats", row._id, args)
    else await ctx.db.insert("catalogStats", args)
  },
})

const readPages = async <T>(
  read: (cursor: string | null) => Promise<PaginationResult<T>>
) => {
  const rows: Array<T> = []
  let cursor: string | null = null
  for (;;) {
    const result = await read(cursor)
    for (const row of result.page) rows.push(row)
    if (result.isDone) return rows
    cursor = result.continueCursor
  }
}

// Sets every artist's playcount to the sum of its catalog songs' (as lead or featured) and its
// top song to the most played of them, raises songs' and artists' rarities to what their
// playcounts give, and counts the catalog. The import runs it at the end of each sync.
export const updateRarities = internalAction({
  args: {},
  handler: async (ctx) => {
    const songs = await readPages(
      (cursor): Promise<PaginationResult<StoredSong>> =>
        ctx.runQuery(internal.catalog.storedSongs, {
          paginationOpts: { numItems: 1000, cursor },
        })
    )
    const stale = songs.filter(
      (row) => row.rarity !== songRarity(row.playcount, row.rarity)
    )
    for (let at = 0; at < stale.length; at += 1000) {
      // A refresh with the stored count only raises the rarity.
      await ctx.runMutation(internal.catalog.refresh, {
        songs: stale
          .slice(at, at + 1000)
          .map((row) => ({ spotify: row.spotify, playcount: row.playcount })),
        artists: [],
      })
    }
    const totals = new Map<Id<"artists">, number>()
    const tops = new Map<Id<"artists">, StoredSong>()
    for (const row of songs) {
      for (const id of row.artistIds) {
        totals.set(id, (totals.get(id) ?? 0) + row.playcount)
        if ((tops.get(id)?.playcount ?? -1) < row.playcount) tops.set(id, row)
      }
    }
    const artists = await readPages(
      (cursor): Promise<PaginationResult<StoredArtist>> =>
        ctx.runQuery(internal.catalog.storedArtists, {
          paginationOpts: { numItems: 1000, cursor },
        })
    )
    for (let at = 0; at < artists.length; at += 1000) {
      await ctx.runMutation(internal.catalog.setArtistPlaycounts, {
        artists: artists.slice(at, at + 1000).map((row) => ({
          id: row.id,
          playcount: totals.get(row.id) ?? 0,
          topSongId: tops.get(row.id)?.id,
        })),
      })
    }
    // Rarities as this run leaves them: the stored one, raised by the playcount.
    const byRarity = {
      common: { songs: 0, artists: 0 },
      rare: { songs: 0, artists: 0 },
      epic: { songs: 0, artists: 0 },
      legendary: { songs: 0, artists: 0 },
    }
    for (const row of songs) {
      byRarity[songRarity(row.playcount, row.rarity)].songs++
    }
    for (const row of artists) {
      const total = totals.get(row.id) ?? 0
      byRarity[raiseRarity(row.rarity, artistRarityForStreams(total))].artists++
    }
    await ctx.runMutation(internal.catalog.setCatalogStats, {
      songs: songs.length,
      artists: artists.length,
      byRarity,
    })
    return {
      songs: songs.length,
      songRaritiesSet: stale.length,
      artists: artists.length,
    }
  },
})

// A song as the import sends it; upsertSong works out ids.duplicates.
type SongDoc = Omit<
  Doc<"songs">,
  "_id" | "_creationTime" | "ids" | "rarity" | "drawKey"
> & {
  ids: Omit<Doc<"songs">["ids"], "duplicates">
}

// The stored song a release is saved into: the same Spotify id, else the same recording (ISRC).
const storedRelease = async (
  ctx: MutationCtx,
  release: { spotify: string; isrc: string }
) =>
  (await ctx.db
    .query("songs")
    .withIndex("by_spotifyId", (q) => q.eq("ids.spotify", release.spotify))
    .unique()) ??
  (await ctx.db
    .query("songs")
    .withIndex("by_isrc", (q) => q.eq("ids.isrc", release.isrc))
    .first())

// One song per recording: a release whose ISRC is already stored under another Spotify id is
// merged into it. The stored song becomes the oldest release (isBetterRelease) and keeps the
// other's Spotify id in ids.duplicates. The card keeps its rarity, raised by the new playcount.
// save only calls this for a release that is new or wins the merge.
async function upsertSong(
  ctx: MutationCtx,
  doc: SongDoc,
  existing: Doc<"songs"> | null
) {
  const spotify = doc.ids.spotify
  if (!existing) {
    await ctx.db.insert("songs", {
      ...doc,
      ids: { ...doc.ids, duplicates: [] },
      rarity: songRarity(doc.playcount),
      drawKey: Math.random(),
    })
    return
  }
  const sameRelease = existing.ids.spotify === spotify
  const releases = new Set([...existing.ids.duplicates, existing.ids.spotify])
  releases.delete(spotify)
  // A refresh with no Deezer match keeps the Deezer id already found.
  const deezer = doc.ids.deezer ?? (sameRelease ? existing.ids.deezer : null)
  await ctx.db.replace("songs", existing._id, {
    ...doc,
    ids: { ...doc.ids, deezer, duplicates: [...releases] },
    rarity: songRarity(doc.playcount, existing.rarity),
    drawKey: existing.drawKey,
  })
}

// Saves what passes the rules and returns the Spotify ids of the songs it skipped. Credits keep
// only kept artists, lead first. An artist is saved only with a song that keeps its credits: a
// release that loses the merge to a stored one only joins its duplicates, so the artists only it
// credits ("Stevie J" on a 2022 compilation of a 1996 song) never become cards without a song.
export const save = internalMutation({
  args: { artists: v.array(artist), songs: v.array(song) },
  handler: async (ctx, args) => {
    const artistRows = new Map(
      args.artists.filter(keepArtist).map((row) => [row.ids.spotify, row])
    )
    const kept = new Set(artistRows.keys())
    const artistIds = new Map<string, Id<"artists">>()
    const skipped: Array<string> = []
    for (const { artists, ...row } of args.songs) {
      if (!keepSong({ ...row, artists }, kept)) {
        skipped.push(row.ids.spotify)
        continue
      }
      const existing = await storedRelease(ctx, row.ids)
      if (
        existing &&
        existing.ids.spotify !== row.ids.spotify &&
        !isBetterRelease(row, existing)
      ) {
        await ctx.db.patch("songs", existing._id, {
          ids: {
            ...existing.ids,
            duplicates: [
              ...new Set([...existing.ids.duplicates, row.ids.spotify]),
            ],
          },
        })
        continue
      }
      const songArtistIds: Array<Id<"artists">> = []
      for (const spotify of artists) {
        const artistRow = artistRows.get(spotify)
        if (!artistRow) continue
        const artistId =
          artistIds.get(spotify) ?? (await upsertArtist(ctx, artistRow))
        artistIds.set(spotify, artistId)
        songArtistIds.push(artistId)
      }
      await upsertSong(ctx, { ...row, artistIds: songArtistIds }, existing)
    }
    return skipped
  },
})

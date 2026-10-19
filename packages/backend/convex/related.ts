import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { playerId } from "./auth"
import { artistCard, ownedCard, songCard, type Card } from "./packs"

// Cards related to a card, for the showcase: an artist's songs and the artists they've worked
// with; a song's artists and their other songs. Read through `credits` (see schema.ts). Every card
// comes with the signed-in player's copies and first pull (0 copies: not owned), so the app shows
// owned ones open and the rest grayed out.

// Keeps a song's credits in step with its artistIds and playcount; catalog:save and
// catalog:refresh call it whenever they write a song.
export async function syncCredits(
  ctx: MutationCtx,
  song: Pick<Doc<"songs">, "_id" | "artistIds" | "playcount">
) {
  const rows = await ctx.db
    .query("credits")
    .withIndex("by_songId", (q) => q.eq("songId", song._id))
    .take(100)
  const wanted = new Set<Id<"artists">>(song.artistIds)
  for (const row of rows) {
    if (!wanted.has(row.artistId)) await ctx.db.delete("credits", row._id)
    else if (row.playcount !== song.playcount) {
      await ctx.db.patch("credits", row._id, { playcount: song.playcount })
    }
    wanted.delete(row.artistId)
  }
  for (const artistId of wanted) {
    await ctx.db.insert("credits", {
      songId: song._id,
      artistId,
      playcount: song.playcount,
    })
  }
}

// The cards with the player's copies of each and when they first pulled it.
const withOwned = async (
  ctx: QueryCtx,
  player: string | null,
  cards: ReadonlyArray<Card | null>
) =>
  await Promise.all(
    cards
      .flatMap((card) => (card ? [card] : []))
      .map(async (card) => {
        const owned = player ? await ownedCard(ctx, player, card.id) : null
        return {
          ...card,
          copies: owned?.copies ?? 0,
          pulledAt: owned?.pulledAt ?? 0,
        }
      })
  )

// An artist's songs, most played first, a page at a time. Card ids come in as strings: one
// that isn't an artist's has none.
export const artistSongs = query({
  args: { artistId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { artistId: card, paginationOpts }) => {
    const player = await playerId(ctx)
    const artistId = ctx.db.normalizeId("artists", card)
    if (!artistId) return { page: [], isDone: true, continueCursor: "" }
    const rows = await ctx.db
      .query("credits")
      .withIndex("by_artistId_and_playcount", (q) => q.eq("artistId", artistId))
      .order("desc")
      .paginate(paginationOpts)
    // Every song here credits the artist, and features repeat: each artist is read once.
    const artists = new Map<Id<"artists">, Promise<Doc<"artists"> | null>>()
    const getArtist = (id: Id<"artists">) => {
      const artist = artists.get(id) ?? ctx.db.get("artists", id)
      artists.set(id, artist)
      return artist
    }
    const songs = await Promise.all(
      rows.page.map(async ({ songId }) => {
        const song = await ctx.db.get("songs", songId)
        return song ? await songCard(ctx, song, getArtist) : null
      })
    )
    return { ...rows, page: await withOwned(ctx, player, songs) }
  },
})

// Which of `ids` the player owns.
const ownedIds = async (
  ctx: QueryCtx,
  player: string | null,
  ids: ReadonlyArray<string>
) => {
  if (!player) return []
  const owned = await Promise.all(
    ids.map(async (id) => ((await ownedCard(ctx, player, id)) ? [id] : []))
  )
  return owned.flat()
}

// An artist's circle: how many songs they have and how many of those the player owns, and the
// artists they share a song with, most shared songs first (as ids; the app reads their cards a
// page at a time with `artists`), with how many of those the player owns.
// `songsOnly`: just the songs (no collaborators), for a song's "More from" rows, a third of the
// reads for the busiest artists.
// shortcut: reads every credit of the artist's songs (about 600 rows for the busiest artist
// today); keep a collaborators table if artists get thousands of songs.
export const artistCircle = query({
  args: { artistId: v.string(), songsOnly: v.optional(v.boolean()) },
  handler: async (ctx, { artistId: card, songsOnly = false }) => {
    const player = await playerId(ctx)
    const artistId = ctx.db.normalizeId("artists", card)
    if (!artistId) {
      return {
        songs: { total: 0, owned: 0 },
        collaborators: [],
        collaboratorsOwned: 0,
      }
    }
    const mine = await ctx.db
      .query("credits")
      .withIndex("by_artistId_and_playcount", (q) => q.eq("artistId", artistId))
      .take(1000)
    const credits = songsOnly
      ? []
      : await Promise.all(
          mine.map(({ songId }) =>
            ctx.db
              .query("credits")
              .withIndex("by_songId", (q) => q.eq("songId", songId))
              .take(100)
          )
        )
    const shared = new Map<Id<"artists">, number>()
    for (const row of credits.flat()) {
      if (row.artistId === artistId) continue
      shared.set(row.artistId, (shared.get(row.artistId) ?? 0) + 1)
    }
    const collaborators = [...shared]
      .toSorted((a, b) => b[1] - a[1])
      .map(([id]) => id)
    const [songsOwned, artistsOwned] = await Promise.all([
      ownedIds(
        ctx,
        player,
        mine.map((row) => row.songId)
      ),
      ownedIds(ctx, player, collaborators),
    ])
    return {
      songs: { total: mine.length, owned: songsOwned.length },
      collaborators,
      collaboratorsOwned: artistsOwned.length,
    }
  },
})

// The artists credited on a song, lead first, as ids; read with `artists`. Empty for an id
// that isn't a song.
export const songArtists = query({
  args: { songId: v.string() },
  handler: async (ctx, { songId }) => {
    const id = ctx.db.normalizeId("songs", songId)
    const song = id ? await ctx.db.get("songs", id) : null
    return song?.artistIds ?? []
  },
})

// Artist cards by id, in order, with ownership; a page of an artist's collaborators, or a
// song's artists.
export const artists = query({
  args: { ids: v.array(v.id("artists")) },
  handler: async (ctx, { ids }) => {
    const player = await playerId(ctx)
    const found = await Promise.all(
      ids.slice(0, 100).map(async (id) => {
        const artist = await ctx.db.get("artists", id)
        return artist ? await artistCard(ctx, artist) : null
      })
    )
    return await withOwned(ctx, player, found)
  },
})

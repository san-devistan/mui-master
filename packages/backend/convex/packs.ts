import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { playerId } from "./auth"
import {
  drawRarity,
  godPackChance,
  godPackOdds,
  packOdds,
  rarityOrder,
} from "./songs/_lib/rarity"
import type { CardRarity } from "./songs/_lib/validators"

// The game's cards: songs and artists, as the web app shows them. A card's id is its song or
// artist id; `kind` says which.

type Card = {
  kind: "song" | "artist"
  id: Id<"songs"> | Id<"artists">
  title: string
  subtitle: string
  imageUrl: string
  streams: number
  rarity: CardRarity
  // The song whose preview plays: the song itself, or the artist's most played one.
  previewSongId: Id<"songs"> | null
  // That song's stored Spotify preview, so the client plays it without a lookup; null when it
  // has none (Deezer's expire, so they're looked up at play time).
  preview: string | null
  spotifyUrl: string
  deezerUrl: string | null
  // Song cards: release date. Artist cards: monthly listeners.
  releaseDate?: string
  monthlyListeners?: number
}

const songCard = async (ctx: QueryCtx, song: Doc<"songs">): Promise<Card> => {
  const artists = await Promise.all(
    song.artistIds.map((id) => ctx.db.get("artists", id))
  )
  return {
    kind: "song",
    id: song._id,
    title: song.name,
    subtitle: artists
      .flatMap((artist) => (artist ? [artist.name] : []))
      .join(", "),
    imageUrl: song.image,
    streams: song.playcount,
    rarity: song.rarity,
    previewSongId: song._id,
    preview: song.preview,
    spotifyUrl: `https://open.spotify.com/track/${song.ids.spotify}`,
    deezerUrl: song.ids.deezer
      ? `https://www.deezer.com/track/${song.ids.deezer}`
      : null,
    releaseDate: song.metadata.releaseDate,
  }
}

const artistCard = async (
  ctx: QueryCtx,
  artist: Doc<"artists">
): Promise<Card> => {
  const top = artist.topSongId
    ? await ctx.db.get("songs", artist.topSongId)
    : null
  return {
    kind: "artist",
    id: artist._id,
    title: artist.name,
    subtitle: "Artist",
    imageUrl: artist.image,
    streams: artist.playcount,
    rarity: artist.rarity,
    previewSongId: artist.topSongId ?? null,
    preview: top?.preview ?? null,
    spotifyUrl: `https://open.spotify.com/artist/${artist.ids.spotify}`,
    deezerUrl: artist.ids.deezer
      ? `https://www.deezer.com/artist/${artist.ids.deezer}`
      : null,
    monthlyListeners: artist.monthlyListeners,
  }
}

// A random card of `rarity`: the first at or after a random drawKey, wrapping round. Each card
// is as likely as the gap before its key, close enough to uniform at this size.
const drawSong = async (ctx: QueryCtx, rarity: CardRarity) => {
  const key = Math.random()
  const row =
    (await ctx.db
      .query("songs")
      .withIndex("by_rarity_and_drawKey", (q) =>
        q.eq("rarity", rarity).gte("drawKey", key)
      )
      .first()) ??
    (await ctx.db
      .query("songs")
      .withIndex("by_rarity_and_drawKey", (q) => q.eq("rarity", rarity))
      .first())
  return row ? await songCard(ctx, row) : null
}

const drawArtist = async (ctx: QueryCtx, rarity: CardRarity) => {
  const key = Math.random()
  const row =
    (await ctx.db
      .query("artists")
      .withIndex("by_rarity_and_drawKey", (q) =>
        q.eq("rarity", rarity).gte("drawKey", key)
      )
      .first()) ??
    (await ctx.db
      .query("artists")
      .withIndex("by_rarity_and_drawKey", (q) => q.eq("rarity", rarity))
      .first())
  return row ? await artistCard(ctx, row) : null
}

// A card by id, song or artist; null when it's gone.
const cardById = async (ctx: QueryCtx, id: string) => {
  const songId = ctx.db.normalizeId("songs", id)
  const song = songId ? await ctx.db.get("songs", songId) : null
  if (song) return await songCard(ctx, song)
  const artistId = ctx.db.normalizeId("artists", id)
  const artist = artistId ? await ctx.db.get("artists", artistId) : null
  return artist ? await artistCard(ctx, artist) : null
}

const ownedCard = (ctx: QueryCtx, player: string, cardId: string) =>
  ctx.db
    .query("collection")
    .withIndex("by_playerId_and_cardId", (q) =>
      q.eq("playerId", player).eq("cardId", cardId)
    )
    .unique()

const pendingPack = (ctx: QueryCtx, player: string) =>
  ctx.db
    .query("pendingPacks")
    .withIndex("by_playerId", (q) => q.eq("playerId", player))
    .unique()

// Five cards, each with its position's odds (packOdds, or godPackOdds for the rare god pack),
// then a song or an artist of the rarity rolled, in proportion to how many of each there are, so
// every card of a rarity is as likely. No card twice: a repeat is redrawn with the same odds.
// Ordered from least to most rare.
const drawPack = async (ctx: QueryCtx) => {
  const stats = await ctx.db.query("catalogStats").first()
  if (!stats) throw new Error("The catalog isn't counted yet")
  const cards: Array<Card> = []
  const drawn = new Set<string>()
  const pack = Math.random() < godPackChance ? godPackOdds : packOdds
  for (const odds of pack) {
    for (let tries = 0; tries < 10; tries++) {
      const rarity = drawRarity(odds, Math.random())
      const { songs, artists } = stats.byRarity[rarity]
      const card =
        Math.random() * (songs + artists) < songs
          ? await drawSong(ctx, rarity)
          : await drawArtist(ctx, rarity)
      if (!card || drawn.has(card.id)) continue
      drawn.add(card.id)
      cards.push(card)
      break
    }
  }
  const rank = (card: Card) => -rarityOrder.indexOf(card.rarity)
  return cards.toSorted((a, b) => rank(a) - rank(b) || a.streams - b.streams)
}

// The signed-in player's waiting pack: drawn the first time, then the same cards until they open
// it, so reloading never rerolls it. `isNew` marks the cards they don't own yet.
// shortcut: no limit on packs per player; add one (daily packs, a currency) when the game needs it.
export const next = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) throw new Error("Not signed in")
    const pending = await pendingPack(ctx, player)
    let cards: Array<Card>
    if (pending) {
      const found = await Promise.all(
        pending.cardIds.map((id) => cardById(ctx, id))
      )
      cards = found.flatMap((card) => (card ? [card] : []))
    } else {
      cards = await drawPack(ctx)
      await ctx.db.insert("pendingPacks", {
        playerId: player,
        cardIds: cards.map((card) => card.id),
      })
    }
    return await Promise.all(
      cards.map(async (card) => ({
        ...card,
        isNew: !(await ownedCard(ctx, player, card.id)),
      }))
    )
  },
})

// Opens the waiting pack: its cards go into the player's collection, a copy more for one they
// own. Does nothing without one, so a double tap can't add a pack twice.
export const claim = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) throw new Error("Not signed in")
    const pending = await pendingPack(ctx, player)
    if (!pending) return
    const pulledAt = Date.now()
    for (const cardId of pending.cardIds) {
      const owned = await ownedCard(ctx, player, cardId)
      if (owned) {
        // A pull shows the card at its current rarity, so a pending upgrade is seen.
        const card = await cardById(ctx, cardId)
        await ctx.db.patch("collection", owned._id, {
          copies: owned.copies + 1,
          ...(card ? { seenRarity: card.rarity } : {}),
        })
      } else {
        const card = await cardById(ctx, cardId)
        await ctx.db.insert("collection", {
          playerId: player,
          cardId,
          copies: 1,
          pulledAt,
          ...(card ? { seenRarity: card.rarity } : {}),
        })
      }
    }
    await ctx.db.delete("pendingPacks", pending._id)
  },
})

// The signed-in player's cards, with their copies and first pull; empty for a visitor.
// shortcut: the whole collection in one query, fine up to a few thousand cards; paginate past that.
export const collection = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return []
    const rows = await ctx.db
      .query("collection")
      .withIndex("by_playerId", (q) => q.eq("playerId", player))
      .take(5000)
    // Read together, not one card after another.
    const found = await Promise.all(
      rows.map(async ({ cardId, copies, pulledAt }) => {
        const card = await cardById(ctx, cardId)
        return card ? [{ ...card, copies, pulledAt }] : []
      })
    )
    return found.flat()
  },
})

// The signed-in player's cards whose rarity went up since they last saw them, rarest first, each
// with the rarity it was at; empty for a visitor.
// shortcut: reads the whole collection like `collection` does; keep a list of pending upgrades
// per player if collections grow past a few thousand cards.
export const upgrades = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return []
    const rows = await ctx.db
      .query("collection")
      .withIndex("by_playerId", (q) => q.eq("playerId", player))
      .take(5000)
    const found = (
      await Promise.all(
        rows.map(async ({ cardId, copies, pulledAt, seenRarity }) => {
          if (!seenRarity || seenRarity === "legendary") return []
          const card = await cardById(ctx, cardId)
          return card &&
            rarityOrder.indexOf(card.rarity) < rarityOrder.indexOf(seenRarity)
            ? [{ ...card, copies, pulledAt, from: seenRarity }]
            : []
        })
      )
    ).flat()
    return found.toSorted(
      (a, b) =>
        rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity) ||
        b.streams - a.streams
    )
  },
})

// Marks an upgraded card as seen at its current rarity, once its upgrade has played.
export const seeUpgrade = mutation({
  args: { cardId: v.string() },
  handler: async (ctx, { cardId }) => {
    const player = await playerId(ctx)
    if (!player) throw new Error("Not signed in")
    const owned = await ownedCard(ctx, player, cardId)
    const card = await cardById(ctx, cardId)
    if (owned && card) {
      await ctx.db.patch("collection", owned._id, { seenRarity: card.rarity })
    }
  },
})

// How many cards the game has, songs and artists, and four covers for the pack's art.
export const catalog = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("catalogStats").first()
    const covers = await ctx.db
      .query("songs")
      .withIndex("by_rarity", (q) => q.eq("rarity", "legendary"))
      .take(4)
    return {
      total: stats ? stats.songs + stats.artists : 0,
      covers: covers.map((song) => song.image),
    }
  },
})

import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { playerId } from "./auth"
import { normalizeText } from "./songs/_lib/dedupe"
import {
  drawRarity,
  godPackChance,
  godPackOdds,
  packOdds,
  rarityOrder,
} from "./songs/_lib/rarity"
import type { CardRarity } from "./songs/_lib/validators"
import { ensurePlayer, payForPack } from "./wallet"

// The game's cards: songs and artists, as the web app shows them. A card's id is its song or
// artist id; `kind` says which.

export type Card = {
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

export const songCard = async (
  ctx: QueryCtx,
  song: Doc<"songs">,
  getArtist = (id: Id<"artists">) => ctx.db.get("artists", id)
): Promise<Card> => {
  const artists = await Promise.all(song.artistIds.map(getArtist))
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

export const artistCard = async (
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

// A card's own row by id, song or artist (without its artists or top song); null when it's gone.
export const cardDoc = async (ctx: QueryCtx, id: string) => {
  const songId = ctx.db.normalizeId("songs", id)
  const song = songId ? await ctx.db.get("songs", songId) : null
  if (song) return song
  const artistId = ctx.db.normalizeId("artists", id)
  return artistId ? await ctx.db.get("artists", artistId) : null
}

const toCard = (ctx: QueryCtx, doc: Doc<"songs"> | Doc<"artists">) =>
  "artistIds" in doc ? songCard(ctx, doc) : artistCard(ctx, doc)

// A card by id, song or artist; null when it's gone.
export const cardById = async (ctx: QueryCtx, id: string) => {
  const doc = await cardDoc(ctx, id)
  return doc ? await toCard(ctx, doc) : null
}

export const ownedCard = (ctx: QueryCtx, player: string, cardId: string) =>
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

// Whether a collection card has an upgrade to play: its card is rarer now than when last seen
// (unset counts as seen).
export const isUpgraded = (
  seenRarity: CardRarity | undefined,
  rarity: CardRarity
) =>
  seenRarity !== undefined &&
  rarityOrder.indexOf(rarity) < rarityOrder.indexOf(seenRarity)

// Keeps the player's pendingUpgrades row for the card in step: there when `pending`, else gone.
export const setPending = async (
  ctx: MutationCtx,
  player: string,
  cardId: string,
  pending: boolean
) => {
  const row = await ctx.db
    .query("pendingUpgrades")
    .withIndex("by_playerId_and_cardId", (q) =>
      q.eq("playerId", player).eq("cardId", cardId)
    )
    .unique()
  if (pending && !row) {
    await ctx.db.insert("pendingUpgrades", { playerId: player, cardId })
  }
  if (!pending && row) await ctx.db.delete("pendingUpgrades", row._id)
}

// What a collection row is filtered and sorted by, from its card seen at `rarity` (see schema.ts).
export const sortKeys = (card: Card, rarity = card.rarity) => ({
  kind: card.kind,
  rarityRank: rarityRank(rarity),
  titleKey: normalizeText(card.title),
  streams: card.streams,
  // A song's subtitle is its artists' names; an artist's is just "Artist".
  searchText:
    card.kind === "song" ? `${card.title} ${card.subtitle}` : card.title,
})

// 0 for common up to 3 for legendary.
export const rarityRank = (rarity: CardRarity) =>
  rarityOrder.length - 1 - rarityOrder.indexOf(rarity)

// Counts `added` more different cards for the player (see schema.ts).
export const countCards = async (
  ctx: MutationCtx,
  player: string,
  added: number
) => {
  const tally = await ensurePlayer(ctx, player)
  await ctx.db.patch("players", tally._id, { cards: tally.cards + added })
}

// Puts a copy of the card in the player's collection, seen at its current rarity: a copy more
// for one they own, else a new card from `pulledAt`.
export const addCopy = async (
  ctx: MutationCtx,
  player: string,
  card: Card,
  pulledAt = Date.now()
) => {
  const seen = { seenRarity: card.rarity, ...sortKeys(card) }
  // Seen at its current rarity: no upgrade left to play.
  await setPending(ctx, player, card.id, false)
  const owned = await ownedCard(ctx, player, card.id)
  if (owned) {
    await ctx.db.patch("collection", owned._id, {
      copies: owned.copies + 1,
      ...seen,
    })
    return
  }
  await ctx.db.insert("collection", {
    playerId: player,
    cardId: card.id,
    copies: 1,
    pulledAt,
    ...seen,
  })
  await countCards(ctx, player, 1)
}

// Takes `count` copies of a card out of the player's collection; the card leaves it with its last.
export const takeCopy = async (
  ctx: MutationCtx,
  player: string,
  cardId: string,
  count = 1
) => {
  const owned = await ownedCard(ctx, player, cardId)
  if (!owned || owned.copies < count) {
    throw new ConvexError(owned ? "Not that many copies" : "Card not owned")
  }
  if (owned.copies > count) {
    await ctx.db.patch("collection", owned._id, {
      copies: owned.copies - count,
    })
  } else {
    await ctx.db.delete("collection", owned._id)
    await setPending(ctx, player, cardId, false)
    await countCards(ctx, player, -1)
  }
}

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
// own. It uses one of the free packs held, or once they're gone one bought with coins
// (wallet.ts). Does nothing without a waiting pack, so a double tap can't add a pack twice.
export const claim = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) throw new Error("Not signed in")
    const pending = await pendingPack(ctx, player)
    if (!pending) return
    await payForPack(ctx, player)
    const pulledAt = Date.now()
    for (const cardId of pending.cardIds) {
      const card = await cardById(ctx, cardId)
      // Gone since the pack was drawn: nothing to show for it.
      // A pull shows the card at its current rarity, so a pending upgrade is seen.
      if (card) await addCopy(ctx, player, card, pulledAt)
    }
    await ctx.db.delete("pendingPacks", pending._id)
  },
})

const byRarityThenStreams = (
  a: { rarity: CardRarity; streams: number },
  b: { rarity: CardRarity; streams: number }
) =>
  rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity) ||
  b.streams - a.streams

// The player's cards whose rarity went up since they last saw them, rarest first, each with the
// rarity it was at, from their pendingUpgrades rows.
// shortcut: the first 200 pending (by card id) only; the rest show once those are seen. Page it if
// a refresh ever upgrades more than 200 of one player's cards.
const pendingUpgradesOf = async (ctx: QueryCtx, player: string) => {
  const pending = await ctx.db
    .query("pendingUpgrades")
    .withIndex("by_playerId_and_cardId", (q) => q.eq("playerId", player))
    .take(200)
  const found = (
    await Promise.all(
      pending.map(async ({ cardId }) => {
        const owned = await ownedCard(ctx, player, cardId)
        const doc = owned ? await cardDoc(ctx, cardId) : null
        // A row gone stale (sold, or seen since) shows nothing.
        return owned?.seenRarity &&
          doc &&
          isUpgraded(owned.seenRarity, doc.rarity)
          ? [
              {
                ...(await toCard(ctx, doc)),
                copies: owned.copies,
                pulledAt: owned.pulledAt,
                from: owned.seenRarity,
              },
            ]
          : []
      })
    )
  ).flat()
  return found.toSorted(byRarityThenStreams)
}

// The signed-in player's cards whose rarity went up since they last saw them, rarest first, each
// with the rarity it was at; empty for a visitor.
export const upgrades = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    return player ? await pendingUpgradesOf(ctx, player) : []
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
      await ctx.db.patch("collection", owned._id, {
        seenRarity: card.rarity,
        ...sortKeys(card),
      })
    }
    await setPending(ctx, player, cardId, false)
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

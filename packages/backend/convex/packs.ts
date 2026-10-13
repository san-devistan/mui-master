import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { playerId } from "./auth"
import { drawRarity } from "./songs/_lib/rarity"
import type { CardRarity } from "./songs/_lib/validators"

// The game's cards: songs and artists, as the web app shows them. A card's id is its song or
// artist id; `kind` says which.

const PACK_SIZE = 5

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
  spotifyUrl: string
  deezerUrl: string | null
  // Song cards: BPM and release date. Artist cards: monthly listeners.
  bpm?: number
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
    spotifyUrl: `https://open.spotify.com/track/${song.ids.spotify}`,
    deezerUrl: song.ids.deezer
      ? `https://www.deezer.com/track/${song.ids.deezer}`
      : null,
    bpm: song.metadata.tempo,
    releaseDate: song.metadata.releaseDate,
  }
}

const artistCard = (artist: Doc<"artists">): Card => ({
  kind: "artist",
  id: artist._id,
  title: artist.name,
  subtitle: "Artist",
  imageUrl: artist.image,
  streams: artist.playcount,
  rarity: artist.rarity,
  previewSongId: artist.topSongId ?? null,
  spotifyUrl: `https://open.spotify.com/artist/${artist.ids.spotify}`,
  deezerUrl: artist.ids.deezer
    ? `https://www.deezer.com/artist/${artist.ids.deezer}`
    : null,
  monthlyListeners: artist.monthlyListeners,
})

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
  return row ? artistCard(row) : null
}

// Opens a pack for the signed-in player: five cards, each rarity rolled with drawRarity, then a
// song or an artist of that rarity in proportion to how many of each there are, so every card of
// a rarity is as likely. No card twice in a pack. The cards go straight into the player's
// collection (a copy more for one they own); `isNew` marks those they didn't have.
// shortcut: no limit on packs per player; add one (daily packs, a currency) when the game needs it.
export const open = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) throw new Error("Not signed in")
    const stats = await ctx.db.query("catalogStats").first()
    if (!stats) throw new Error("The catalog isn't counted yet")
    const cards: Array<Card> = []
    const drawn = new Set<string>()
    for (let tries = 0; cards.length < PACK_SIZE && tries < 50; tries++) {
      const rarity = drawRarity(Math.random())
      const { songs, artists } = stats.byRarity[rarity]
      const card =
        Math.random() * (songs + artists) < songs
          ? await drawSong(ctx, rarity)
          : await drawArtist(ctx, rarity)
      if (!card || drawn.has(card.id)) continue
      drawn.add(card.id)
      cards.push(card)
    }
    const pulledAt = Date.now()
    const pulls: Array<Card & { isNew: boolean }> = []
    for (const card of cards) {
      const owned = await ctx.db
        .query("collection")
        .withIndex("by_playerId_and_cardId", (q) =>
          q.eq("playerId", player).eq("cardId", card.id)
        )
        .unique()
      if (owned) {
        await ctx.db.patch("collection", owned._id, {
          copies: owned.copies + 1,
        })
      } else {
        await ctx.db.insert("collection", {
          playerId: player,
          cardId: card.id,
          copies: 1,
          pulledAt,
        })
      }
      pulls.push({ ...card, isNew: !owned })
    }
    return pulls
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
    const found: Array<Card & { copies: number; pulledAt: number }> = []
    for (const { cardId: id, copies, pulledAt } of rows) {
      const songId = ctx.db.normalizeId("songs", id)
      const song = songId ? await ctx.db.get("songs", songId) : null
      if (song) {
        found.push({ ...(await songCard(ctx, song)), copies, pulledAt })
        continue
      }
      const artistId = ctx.db.normalizeId("artists", id)
      const artist = artistId ? await ctx.db.get("artists", artistId) : null
      if (artist) found.push({ ...artistCard(artist), copies, pulledAt })
    }
    return found
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

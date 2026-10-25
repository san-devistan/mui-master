import { paginationOptsValidator } from "convex/server"
import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { playerId } from "./auth"
import { cardById, ownedCard, rarityRank } from "./packs"
import { cardKind, cardRarity } from "./songs/_lib/validators"

// The player's collection, a page at a time, filtered and sorted on the keys each row keeps (see
// schema.ts): one index per filter and sort, so a page reads only its own rows.

type Filter = {
  player: string
  kind?: Doc<"collection">["kind"]
  rank?: number
  liked?: boolean
}

// By first pull.
const byPull = (ctx: QueryCtx, { player, kind, rank, liked }: Filter) => {
  const rows = ctx.db.query("collection")
  if (liked && rank !== undefined) {
    return rows.withIndex(
      "by_playerId_and_favorite_and_rarityRank_and_pulledAt",
      (q) =>
        q.eq("playerId", player).eq("favorite", true).eq("rarityRank", rank)
    )
  }
  if (liked) {
    return rows.withIndex("by_playerId_and_favorite_and_pulledAt", (q) =>
      q.eq("playerId", player).eq("favorite", true)
    )
  }
  if (kind && rank !== undefined) {
    return rows.withIndex(
      "by_playerId_and_kind_and_rarityRank_and_pulledAt",
      (q) => q.eq("playerId", player).eq("kind", kind).eq("rarityRank", rank)
    )
  }
  if (kind) {
    return rows.withIndex("by_playerId_and_kind_and_pulledAt", (q) =>
      q.eq("playerId", player).eq("kind", kind)
    )
  }
  if (rank !== undefined) {
    return rows.withIndex("by_playerId_and_rarityRank_and_pulledAt", (q) =>
      q.eq("playerId", player).eq("rarityRank", rank)
    )
  }
  return rows.withIndex("by_playerId_and_pulledAt", (q) =>
    q.eq("playerId", player)
  )
}

// By rarity, then streams.
const byRarity = (ctx: QueryCtx, { player, kind, rank, liked }: Filter) => {
  const rows = ctx.db.query("collection")
  if (liked) {
    return rows.withIndex(
      "by_playerId_and_favorite_and_rarityRank_and_streams",
      (q) => {
        const of = q.eq("playerId", player).eq("favorite", true)
        return rank === undefined ? of : of.eq("rarityRank", rank)
      }
    )
  }
  if (kind) {
    return rows.withIndex(
      "by_playerId_and_kind_and_rarityRank_and_streams",
      (q) => {
        const of = q.eq("playerId", player).eq("kind", kind)
        return rank === undefined ? of : of.eq("rarityRank", rank)
      }
    )
  }
  return rows.withIndex("by_playerId_and_rarityRank_and_streams", (q) => {
    const of = q.eq("playerId", player)
    return rank === undefined ? of : of.eq("rarityRank", rank)
  })
}

// By title.
const byTitle = (ctx: QueryCtx, { player, kind, rank, liked }: Filter) => {
  const rows = ctx.db.query("collection")
  if (liked && rank !== undefined) {
    return rows.withIndex(
      "by_playerId_and_favorite_and_rarityRank_and_titleKey",
      (q) =>
        q.eq("playerId", player).eq("favorite", true).eq("rarityRank", rank)
    )
  }
  if (liked) {
    return rows.withIndex("by_playerId_and_favorite_and_titleKey", (q) =>
      q.eq("playerId", player).eq("favorite", true)
    )
  }
  if (kind && rank !== undefined) {
    return rows.withIndex(
      "by_playerId_and_kind_and_rarityRank_and_titleKey",
      (q) => q.eq("playerId", player).eq("kind", kind).eq("rarityRank", rank)
    )
  }
  if (kind) {
    return rows.withIndex("by_playerId_and_kind_and_titleKey", (q) =>
      q.eq("playerId", player).eq("kind", kind)
    )
  }
  if (rank !== undefined) {
    return rows.withIndex("by_playerId_and_rarityRank_and_titleKey", (q) =>
      q.eq("playerId", player).eq("rarityRank", rank)
    )
  }
  return rows.withIndex("by_playerId_and_titleKey", (q) =>
    q.eq("playerId", player)
  )
}

export const collectionSort = v.union(
  v.literal("recent"),
  v.literal("rarest"),
  v.literal("title")
)

// The signed-in player's cards with their copies and first pull, a page at a time; empty for a
// visitor. "recent": newest pull first, a pack's cards last saved (rarest) first. "rarest": by
// the rarity the player last saw, then streams. "title": A to Z. `liked`: only their favorites,
// songs and artists alike (`kind` is then ignored).
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sort: collectionSort,
    rarity: v.optional(cardRarity),
    kind: v.optional(cardKind),
    liked: v.optional(v.boolean()),
  },
  handler: async (ctx, { paginationOpts, sort, rarity, kind, liked }) => {
    const player = await playerId(ctx)
    if (!player) return { page: [], isDone: true, continueCursor: "" }
    const filter = {
      player,
      kind,
      rank: rarity === undefined ? undefined : rarityRank(rarity),
      liked,
    }
    const rows = await (
      sort === "title"
        ? byTitle(ctx, filter).order("asc")
        : (sort === "rarest" ? byRarity : byPull)(ctx, filter).order("desc")
    ).paginate(paginationOpts)
    return { ...rows, page: await withCards(ctx, rows.page) }
  },
})

// The rows' cards, with their copies, first pull and whether they're a favorite. Read together,
// not one after another.
const withCards = async (
  ctx: QueryCtx,
  rows: ReadonlyArray<Doc<"collection">>
) => {
  const page = await Promise.all(
    rows.map(async ({ cardId, copies, pulledAt, favorite }) => {
      const card = await cardById(ctx, cardId)
      return card ? [{ ...card, copies, pulledAt, favorite }] : []
    })
  )
  return page.flat()
}

// Whether one of the signed-in player's cards is a favorite; false for a visitor or a card they
// don't own.
export const isFavorite = query({
  args: { cardId: v.string() },
  handler: async (ctx, { cardId }) => {
    const player = await playerId(ctx)
    if (!player) return false
    return (await ownedCard(ctx, player, cardId))?.favorite ?? false
  },
})

// Marks one of the signed-in player's cards a favorite, or not.
export const setFavorite = mutation({
  args: { cardId: v.string(), favorite: v.boolean() },
  handler: async (ctx, { cardId, favorite }) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    const owned = await ownedCard(ctx, player, cardId)
    if (!owned) throw new ConvexError("Card not owned")
    await ctx.db.patch("collection", owned._id, { favorite })
  },
})

// The signed-in player's cards whose title or (for a song) artists match `text`, best match
// first, a page at a time, under the same filters as `list`; empty for a visitor or no text.
export const search = query({
  args: {
    paginationOpts: paginationOptsValidator,
    text: v.string(),
    rarity: v.optional(cardRarity),
    kind: v.optional(cardKind),
    liked: v.optional(v.boolean()),
  },
  handler: async (ctx, { paginationOpts, text, rarity, kind, liked }) => {
    const player = await playerId(ctx)
    if (!player || !text.trim()) {
      return { page: [], isDone: true, continueCursor: "" }
    }
    const rank = rarity === undefined ? undefined : rarityRank(rarity)
    const rows = await ctx.db
      .query("collection")
      .withSearchIndex("search_searchText", (q) => {
        const mine = q.search("searchText", text).eq("playerId", player)
        let ofKind = mine
        if (liked) ofKind = mine.eq("favorite", true)
        else if (kind) ofKind = mine.eq("kind", kind)
        return rank === undefined ? ofKind : ofKind.eq("rarityRank", rank)
      })
      .paginate(paginationOpts)
    return { ...rows, page: await withCards(ctx, rows.page) }
  },
})

// How many different cards the signed-in player owns; 0 for a visitor.
export const count = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return 0
    const tally = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", player))
      .unique()
    return tally?.cards ?? 0
  },
})

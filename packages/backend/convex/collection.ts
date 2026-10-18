import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { query, type QueryCtx } from "./_generated/server"
import { playerId } from "./auth"
import { cardById, rarityRank } from "./packs"
import { cardKind, cardRarity } from "./songs/_lib/validators"

// The player's collection, a page at a time, filtered and sorted on the keys each row keeps (see
// schema.ts): one index per filter and sort, so a page reads only its own rows.

type Filter = {
  player: string
  kind?: Doc<"collection">["kind"]
  rank?: number
}

// By first pull.
const byPull = (ctx: QueryCtx, { player, kind, rank }: Filter) => {
  const rows = ctx.db.query("collection")
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
const byRarity = (ctx: QueryCtx, { player, kind, rank }: Filter) => {
  const rows = ctx.db.query("collection")
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
const byTitle = (ctx: QueryCtx, { player, kind, rank }: Filter) => {
  const rows = ctx.db.query("collection")
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
// the rarity the player last saw, then streams. "title": A to Z.
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sort: collectionSort,
    rarity: v.optional(cardRarity),
    kind: v.optional(cardKind),
  },
  handler: async (ctx, { paginationOpts, sort, rarity, kind }) => {
    const player = await playerId(ctx)
    if (!player) return { page: [], isDone: true, continueCursor: "" }
    const filter = {
      player,
      kind,
      rank: rarity === undefined ? undefined : rarityRank(rarity),
    }
    const rows = await (
      sort === "title"
        ? byTitle(ctx, filter).order("asc")
        : (sort === "rarest" ? byRarity : byPull)(ctx, filter).order("desc")
    ).paginate(paginationOpts)
    return { ...rows, page: await withCards(ctx, rows.page) }
  },
})

// The rows' cards, with their copies and first pull. Read together, not one after another.
const withCards = async (
  ctx: QueryCtx,
  rows: ReadonlyArray<Doc<"collection">>
) => {
  const page = await Promise.all(
    rows.map(async ({ cardId, copies, pulledAt }) => {
      const card = await cardById(ctx, cardId)
      return card ? [{ ...card, copies, pulledAt }] : []
    })
  )
  return page.flat()
}

// The signed-in player's cards whose title or (for a song) artists match `text`, best match
// first, a page at a time, under the same filters as `list`; empty for a visitor or no text.
export const search = query({
  args: {
    paginationOpts: paginationOptsValidator,
    text: v.string(),
    rarity: v.optional(cardRarity),
    kind: v.optional(cardKind),
  },
  handler: async (ctx, { paginationOpts, text, rarity, kind }) => {
    const player = await playerId(ctx)
    if (!player || !text.trim()) {
      return { page: [], isDone: true, continueCursor: "" }
    }
    const rank = rarity === undefined ? undefined : rarityRank(rarity)
    const rows = await ctx.db
      .query("collection")
      .withSearchIndex("search_searchText", (q) => {
        const mine = q.search("searchText", text).eq("playerId", player)
        const ofKind = kind ? mine.eq("kind", kind) : mine
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

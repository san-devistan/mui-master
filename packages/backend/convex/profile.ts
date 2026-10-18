import { ConvexError, v } from "convex/values"

import { mutation, query } from "./_generated/server"
import { playerId } from "./auth"
import { cardById, ownedCard } from "./packs"
import { ensurePlayer } from "./wallet"

// The cards a player picks from their collection to show on their profile.

export const showcaseSize = 6

// The signed-in player's showcase, in their order; empty for a visitor. A card they no longer own
// (sold, or up for auction) drops out of it.
export const showcase = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return []
    const row = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", player))
      .unique()
    const cards = await Promise.all(
      (row?.showcase ?? []).map(async (cardId) => {
        const owned = await ownedCard(ctx, player, cardId)
        const card = owned ? await cardById(ctx, cardId) : null
        return card ? [{ ...card, copies: owned?.copies ?? 1 }] : []
      })
    )
    return cards.flat()
  },
})

// Replaces the signed-in player's showcase with `cardIds`, in that order: up to 6 different cards
// they own.
export const setShowcase = mutation({
  args: { cardIds: v.array(v.string()) },
  handler: async (ctx, { cardIds }) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    if (cardIds.length > showcaseSize) {
      throw new ConvexError(`Show up to ${showcaseSize} cards`)
    }
    if (new Set(cardIds).size !== cardIds.length) {
      throw new ConvexError("A card can only be shown once")
    }
    for (const cardId of cardIds) {
      if (!(await ownedCard(ctx, player, cardId))) {
        throw new ConvexError("Card not owned")
      }
    }
    const row = await ensurePlayer(ctx, player)
    await ctx.db.patch("players", row._id, { showcase: cardIds })
  },
})

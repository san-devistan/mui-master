import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import { proMaxOpenAuctions } from "./songs/_lib/economy"

// How many collection rows go per run; the rest carry on in the next (transaction limits).
const batch = 200

// A deleted account's game (auth.ts, afterDelete): its tallies, waiting pack, devices and
// unbid auctions go now, its cards in batches after.
// shortcut: an auction already bid on runs to its end, so the bidder still gets the card; its
// coins then land on a row nobody owns. Bids stay in auction histories, under "Player XXXX".
export const deletePlayer = internalMutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const row = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .unique()
    if (row) await ctx.db.delete("players", row._id)
    const pack = await ctx.db
      .query("pendingPacks")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .unique()
    if (pack) await ctx.db.delete("pendingPacks", pack._id)
    const devices = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(100)
    for (const device of devices) {
      await ctx.db.delete("pushSubscriptions", device._id)
    }
    const selling = await ctx.db
      .query("auctions")
      .withIndex("by_sellerId_and_status_and_endsAt", (q) =>
        q.eq("sellerId", playerId).eq("status", "open")
      )
      .take(proMaxOpenAuctions)
    for (const auction of selling) {
      if (!auction.topBidderId) {
        await ctx.db.patch("auctions", auction._id, { status: "cancelled" })
      }
    }
    await ctx.scheduler.runAfter(0, internal.players.deleteCards, { playerId })
  },
})

// Deletes a batch of a deleted account's cards and their unplayed upgrades, then the next.
export const deleteCards = internalMutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const cards = await ctx.db
      .query("collection")
      .withIndex("by_playerId_and_cardId", (q) => q.eq("playerId", playerId))
      .take(batch)
    for (const card of cards) await ctx.db.delete("collection", card._id)
    const upgrades = await ctx.db
      .query("pendingUpgrades")
      .withIndex("by_playerId_and_cardId", (q) => q.eq("playerId", playerId))
      .take(batch)
    for (const upgrade of upgrades) {
      await ctx.db.delete("pendingUpgrades", upgrade._id)
    }
    if (cards.length === batch || upgrades.length === batch) {
      await ctx.scheduler.runAfter(0, internal.players.deleteCards, {
        playerId,
      })
    }
  },
})

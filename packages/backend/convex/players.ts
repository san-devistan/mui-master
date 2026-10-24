import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import { proMaxOpenAuctions } from "./songs/_lib/economy"

// How many collection rows move per run; the rest carry on in the next (transaction limits).
const batch = 200

// A guest who signs up or in hands their game over to that account (auth.ts, onLinkAccount).
// A brand-new account takes the guest's whole player row and waiting pack as they are; one that
// already plays keeps its own, and only gains the guest's cards (as copies) and coins. A guest
// who never opened a pack has no player row yet, only the pack drawn for them.
// shortcut: auctions, bids, push subscriptions and the showcase stay on the guest; move them when
// guests get to trade.
export const adoptGuest = internalMutation({
  args: { guestId: v.string(), playerId: v.string() },
  handler: async (ctx, { guestId, playerId }) => {
    if (guestId === playerId) return
    const rowOf = (player: string) =>
      ctx.db
        .query("players")
        .withIndex("by_playerId", (q) => q.eq("playerId", player))
        .unique()
    const guest = await rowOf(guestId)
    const account = await rowOf(playerId)
    const packOf = (player: string) =>
      ctx.db
        .query("pendingPacks")
        .withIndex("by_playerId", (q) => q.eq("playerId", player))
        .unique()
    const guestPack = await packOf(guestId)
    if (guestPack) {
      if (await packOf(playerId)) {
        await ctx.db.delete("pendingPacks", guestPack._id)
      } else {
        await ctx.db.patch("pendingPacks", guestPack._id, { playerId })
      }
    }
    if (guest && !account) {
      await ctx.db.patch("players", guest._id, { playerId })
    } else if (guest && account) {
      await ctx.db.patch("players", account._id, {
        coins: account.coins + guest.coins,
      })
      await ctx.db.delete("players", guest._id)
    }
    await ctx.scheduler.runAfter(0, internal.players.adoptCards, {
      guestId,
      playerId,
      merge: Boolean(account),
    })
  },
})

// Moves a batch of the guest's cards to the account, then schedules the next. Merging into an
// account that already plays adds copies to cards it owns and counts the new ones.
export const adoptCards = internalMutation({
  args: { guestId: v.string(), playerId: v.string(), merge: v.boolean() },
  handler: async (ctx, { guestId, playerId, merge }) => {
    const cards = await ctx.db
      .query("collection")
      .withIndex("by_playerId_and_cardId", (q) => q.eq("playerId", guestId))
      .take(batch)
    let added = 0
    for (const card of cards) {
      const owned = merge
        ? await ctx.db
            .query("collection")
            .withIndex("by_playerId_and_cardId", (q) =>
              q.eq("playerId", playerId).eq("cardId", card.cardId)
            )
            .unique()
        : null
      const upgrade = await ctx.db
        .query("pendingUpgrades")
        .withIndex("by_playerId_and_cardId", (q) =>
          q.eq("playerId", guestId).eq("cardId", card.cardId)
        )
        .unique()
      if (owned) {
        await ctx.db.patch("collection", owned._id, {
          copies: owned.copies + card.copies,
        })
        await ctx.db.delete("collection", card._id)
        // The account's own copy says which upgrade is left to play.
        if (upgrade) await ctx.db.delete("pendingUpgrades", upgrade._id)
      } else {
        await ctx.db.patch("collection", card._id, { playerId })
        if (upgrade) {
          await ctx.db.patch("pendingUpgrades", upgrade._id, { playerId })
        }
        added++
      }
    }
    if (merge && added > 0) {
      const account = await ctx.db
        .query("players")
        .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
        .unique()
      if (account) {
        await ctx.db.patch("players", account._id, {
          cards: account.cards + added,
        })
      }
    }
    if (cards.length === batch) {
      await ctx.scheduler.runAfter(0, internal.players.adoptCards, {
        guestId,
        playerId,
        merge,
      })
    }
  },
})

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

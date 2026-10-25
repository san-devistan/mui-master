import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { cardDoc, isUpgraded, setPending } from "./packs"

// Keeps pendingUpgrades (schema.ts) in step when cards' rarities rise. Pulls, sales and seen
// upgrades keep it in step in packs.ts (addCopy, takeCopy, seeUpgrade).

// Marks the upgrade of every owner of these cards, after their rarity rose (catalog.ts): one
// card's owners a page at a time, then the next card, each run scheduling the rest.
export const scheduleUpgrades = async (
  ctx: MutationCtx,
  cardIds: Array<string>
) => {
  if (cardIds.length > 0) {
    await ctx.scheduler.runAfter(0, internal.upgrades.markUpgrades, {
      cardIds,
      cursor: null,
    })
  }
}

export const markUpgrades = internalMutation({
  args: { cardIds: v.array(v.string()), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cardIds, cursor }) => {
    const [cardId, ...rest] = cardIds
    if (cardId === undefined) return
    const doc = await cardDoc(ctx, cardId)
    const owners = await ctx.db
      .query("collection")
      .withIndex("by_cardId", (q) => q.eq("cardId", cardId))
      .paginate({ numItems: 200, cursor })
    for (const row of owners.page) {
      await setPending(
        ctx,
        row.playerId,
        cardId,
        !!doc && isUpgraded(row.seenRarity, doc.rarity)
      )
    }
    if (!owners.isDone) {
      await ctx.scheduler.runAfter(0, internal.upgrades.markUpgrades, {
        cardIds,
        cursor: owners.continueCursor,
      })
    } else if (rest.length > 0) {
      await ctx.scheduler.runAfter(0, internal.upgrades.markUpgrades, {
        cardIds: rest,
        cursor: null,
      })
    }
  },
})

// Fills pendingUpgrades from the whole collection, 200 rows a run, each run scheduling the next;
// safe to run again. Run it once on each deployment when pendingUpgrades ships (prod: at that
// deploy, `npx convex run upgrades:backfillUpgrades '{}'`), or packs:upgrades misses the upgrades
// from before it.
export const backfillUpgrades = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor = null }) => {
    const rows = await ctx.db
      .query("collection")
      .paginate({ numItems: 200, cursor })
    for (const row of rows.page) {
      const doc =
        row.seenRarity === "legendary" ? null : await cardDoc(ctx, row.cardId)
      await setPending(
        ctx,
        row.playerId,
        row.cardId,
        !!doc && isUpgraded(row.seenRarity, doc.rarity)
      )
    }
    if (!rows.isDone) {
      await ctx.scheduler.runAfter(0, internal.upgrades.backfillUpgrades, {
        cursor: rows.continueCursor,
      })
    }
  },
})

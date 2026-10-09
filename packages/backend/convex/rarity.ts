import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { rarityForStreams } from "./songs/_lib/rarity"
import type { SongRarity } from "./songs/_lib/validators"

export async function adjustRarityCount(
  ctx: MutationCtx,
  rarity: SongRarity,
  delta: number
) {
  const counter = await ctx.db
    .query("rarityCounters")
    .withIndex("by_rarity", (q) => q.eq("rarity", rarity))
    .unique()

  if (counter) {
    await ctx.db.patch("rarityCounters", counter._id, {
      count: Math.max(0, counter.count + delta),
    })
  } else {
    await ctx.db.insert("rarityCounters", {
      rarity,
      count: Math.max(0, delta),
    })
  }
}

const rerateBatchSize = 200

// Re-applies rarityForStreams to stored songs after tier changes.
// Run: pnpm exec convex run rarity:rerateSongs
export const rerateSongs = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("songs")
      .withIndex("by_spotifyStreams")
      .paginate({ cursor: cursor ?? null, numItems: rerateBatchSize })
    const deltas = new Map<SongRarity, number>()
    const shift = (rarity: SongRarity | undefined, delta: number) => {
      if (rarity) {
        deltas.set(rarity, (deltas.get(rarity) ?? 0) + delta)
      }
    }

    for (const song of page.page) {
      const rarity = rarityForStreams(song.spotifyStreams)
      if (rarity !== song.rarity) {
        shift(song.rarity, -1)
        shift(rarity, 1)
        await ctx.db.patch("songs", song._id, { rarity })
      }
    }
    for (const [rarity, delta] of deltas) {
      if (delta !== 0) {
        await adjustRarityCount(ctx, rarity, delta)
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.rarity.rerateSongs, {
        cursor: page.continueCursor,
      })
    }
    return null
  },
})

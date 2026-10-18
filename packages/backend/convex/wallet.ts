import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { playerId } from "./auth"
import {
  auctionHours,
  dailyHolosDue,
  freePackPlan,
  freePacks,
  holoBundles,
  isPro,
  packPrice,
  pro,
  proDailyHolos,
  proMonthDays,
  sellPrice,
  startingCoins,
} from "./songs/_lib/economy"

declare const process: { env: Record<string, string | undefined> }

// A player's coins, free packs and Pro, on their `players` row (see schema.ts).

const playerRow = (ctx: QueryCtx, player: string) =>
  ctx.db
    .query("players")
    .withIndex("by_playerId", (q) => q.eq("playerId", player))
    .unique()

// The player's row, made on first use with the starting coins and all their free packs.
export const ensurePlayer = async (ctx: MutationCtx, player: string) => {
  const row = await playerRow(ctx, player)
  if (row) return row
  const fields: Omit<Doc<"players">, "_id" | "_creationTime"> = {
    playerId: player,
    cards: 0,
    coins: startingCoins,
    freePacksSince: 0,
  }
  return { _id: await ctx.db.insert("players", fields), ...fields }
}

// Gives the player `amount` coins, or takes them when negative; never below zero.
export const addCoins = async (
  ctx: MutationCtx,
  player: string,
  amount: number
) => {
  const row = await ensurePlayer(ctx, player)
  const coins = row.coins + amount
  if (coins < 0) throw new ConvexError("Not enough holos")
  await ctx.db.patch("players", row._id, { coins })
}

// Opening a pack: one of the free packs held, else, when `buy` says the player agreed to, one
// paid for in coins.
export const payForPack = async (
  ctx: MutationCtx,
  player: string,
  buy: boolean
) => {
  const row = await ensurePlayer(ctx, player)
  const now = Date.now()
  const free = freePacks(
    row.freePacksSince,
    now,
    freePackPlan(isPro(row.proUntil, now))
  )
  if (free.count > 0) {
    await ctx.db.patch("players", row._id, { freePacksSince: free.usedSince })
  } else if (buy) await addCoins(ctx, player, -packPrice)
  else throw new ConvexError("No free pack left")
}

// The signed-in player's coins, free packs and Pro, and the prices. A query doesn't re-run as
// time passes, so the client counts the free packs from `freePacksSince` (see economy.ts
// freePacks), at Pro's pace while `proUntil` is ahead.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    const row = player ? await playerRow(ctx, player) : null
    const regular = freePackPlan(false)
    const proPlan = freePackPlan(true)
    return {
      coins: row?.coins ?? startingCoins,
      freePacksSince: row?.freePacksSince ?? 0,
      proUntil: row?.proUntil ?? null,
      freePackHours: regular.hours,
      maxFreePacks: regular.max,
      proFreePackHours: proPlan.hours,
      proMaxFreePacks: proPlan.max,
      packPrice,
      sellPrice,
      auctionHours,
    }
  },
})

// What the shop offers: holo bundles and Pro, with their prices. No checkout yet.
export const shop = query({
  args: {},
  handler: () => ({ holoBundles, pro }),
})

// Pro's daily holos: given once a day, when the app opens, to a player who is Pro. Returns how
// many were given (0 when not Pro or already given today).
export const claimDaily = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return 0
    const row = await playerRow(ctx, player)
    const now = Date.now()
    if (!row || !isPro(row.proUntil, now)) return 0
    if (!dailyHolosDue(row.dailyHolosAt, now)) return 0
    await ctx.db.patch("players", row._id, {
      coins: row.coins + proDailyHolos,
      dailyHolosAt: now,
    })
    return proDailyHolos
  },
})

// Dev tools, for testing without a checkout: switch Pro on or off and add holos to yourself.
// Only on a deployment with the env var DEV_TOOLS=1 (dev), never in production.
const devPlayer = async (ctx: MutationCtx) => {
  if (process.env.DEV_TOOLS !== "1") throw new ConvexError("Dev tools are off")
  const player = await playerId(ctx)
  if (!player) throw new ConvexError("Not signed in")
  return await ensurePlayer(ctx, player)
}

export const devToolsOn = query({
  args: {},
  handler: () => process.env.DEV_TOOLS === "1",
})

// Pro for a month from now, or not Pro any more.
export const setPro = mutation({
  args: { pro: v.boolean() },
  handler: async (ctx, args) => {
    const row = await devPlayer(ctx)
    await ctx.db.patch("players", row._id, {
      proUntil: args.pro
        ? Date.now() + proMonthDays * 24 * 3_600_000
        : undefined,
    })
  },
})

export const addHolos = mutation({
  args: { amount: v.number() },
  handler: async (ctx, { amount }) => {
    if (!Number.isInteger(amount) || amount < 1 || amount > 100_000) {
      throw new ConvexError("Add 1 to 100,000 holos")
    }
    const row = await devPlayer(ctx)
    await ctx.db.patch("players", row._id, { coins: row.coins + amount })
  },
})

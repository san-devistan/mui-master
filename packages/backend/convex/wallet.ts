import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { playerId } from "./auth"
import { flagsFor, proAt, proUntilOf, requireDev } from "./flags"
import { scheduleFreePackPush } from "./push"
import {
  auctionHours,
  freePackPlan,
  freePacks,
  holoBundles,
  maxPacksBought,
  packPrice,
  pro,
  proMonthDays,
  proWeeklyHolos,
  sellPrice,
  skipPrice,
  startingCoins,
  weeklyHolosDue,
} from "./songs/_lib/economy"

// A player's coins, free packs and Pro, on their `players` row (see schema.ts).

export const playerRow = (ctx: QueryCtx, player: string) =>
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
    boughtPacks: 0,
    proUntil: 0,
    weeklyHolosAt: 0,
    freePackPushAt: 0,
    showcase: [],
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

// Opening a pack: one of the free packs held, else one bought earlier (buyPacks). Free ones go
// first, as they stop coming while full; bought ones keep.
export const payForPack = async (ctx: MutationCtx, player: string) => {
  const row = await ensurePlayer(ctx, player)
  const now = Date.now()
  const free = freePacks(
    row.freePacksSince,
    now,
    freePackPlan(await proAt(ctx, row, now))
  )
  if (free.count > 0) {
    await ctx.db.patch("players", row._id, { freePacksSince: free.usedSince })
    await scheduleFreePackPush(ctx, { ...row, freePacksSince: free.usedSince })
  } else if (row.boughtPacks > 0) {
    await ctx.db.patch("players", row._id, {
      boughtPacks: row.boughtPacks - 1,
    })
  } else throw new ConvexError("No pack left")
}

// Buys `count` packs with coins, kept until opened, on top of the free ones. Only as many as the
// player's coins pay for.
export const buyPacks = mutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    if (!Number.isInteger(count) || count < 1 || count > maxPacksBought) {
      throw new ConvexError(`Buy 1 to ${maxPacksBought} packs`)
    }
    const row = await ensurePlayer(ctx, player)
    const cost = count * packPrice
    if (row.coins < cost) throw new ConvexError("Not enough holos")
    await ctx.db.patch("players", row._id, {
      coins: row.coins - cost,
      boughtPacks: row.boughtPacks + count,
    })
  },
})

// Pays holos to have the next free pack now instead of waiting (skipPrice, from the wait left).
export const skipFreePack = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    const row = await ensurePlayer(ctx, player)
    const now = Date.now()
    const plan = freePackPlan(await proAt(ctx, row, now))
    const free = freePacks(row.freePacksSince, now, plan)
    if (free.nextAt === null) throw new ConvexError("Free packs are full")
    const cost = skipPrice(free.nextAt, now, plan)
    if (row.coins < cost) throw new ConvexError("Not enough holos")
    const freePacksSince = free.from - (free.nextAt - now)
    await ctx.db.patch("players", row._id, {
      coins: row.coins - cost,
      freePacksSince,
    })
    await scheduleFreePackPush(ctx, { ...row, freePacksSince })
  },
})

// The signed-in player's coins, free packs and Pro, how many different cards they own, and the
// prices. A query doesn't re-run as time passes, so the client counts the free packs from
// `freePacksSince` (see economy.ts freePacks), at Pro's pace while `proUntil` is ahead. `cards` is
// collection:count's, read from the same row, so the app watches the row once. `proUntil` is Pro
// as the game counts it (flags.ts proUntilOf): paid only while premium is on, granted forever.
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
      boughtPacks: row?.boughtPacks ?? 0,
      proUntil: row ? await proUntilOf(ctx, row) : 0,
      cards: row?.cards ?? 0,
      freePackHours: regular.hours,
      maxFreePacks: regular.max,
      proFreePackHours: proPlan.hours,
      proMaxFreePacks: proPlan.max,
      packPrice,
      maxPacksBought,
      sellPrice,
      auctionHours,
    }
  },
})

// What the shop offers: holo bundles and Pro, with their prices, bought through Stripe
// (billing.ts); null with premium off for this player.
export const shop = query({
  args: {},
  handler: async (ctx) => {
    const { premium } = await flagsFor(ctx, await playerId(ctx))
    return premium ? { holoBundles, pro } : null
  },
})

// Pro's weekly holos: given when the app opens, to a player who is Pro, a week after the last.
// Returns how many were given (0 when not Pro or not due yet).
export const claimWeekly = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return 0
    const row = await playerRow(ctx, player)
    const now = Date.now()
    if (!row || !(await proAt(ctx, row, now))) return 0
    if (!weeklyHolosDue(row.weeklyHolosAt, now)) return 0
    await ctx.db.patch("players", row._id, {
      coins: row.coins + proWeeklyHolos,
      weeklyHolosAt: now,
    })
    return proWeeklyHolos
  },
})

// Paid Pro until `proUntil` (0: none), as Stripe's subscription says (billing.ts) or the dev
// switch sets; the free pack push moves with its pace.
export const setProUntil = async (
  ctx: MutationCtx,
  row: Parameters<typeof scheduleFreePackPush>[1],
  proUntil: number
) => {
  await ctx.db.patch("players", row._id, { proUntil })
  await scheduleFreePackPush(ctx, { ...row, proUntil })
}

// The signed-in player's row, for a dev tool, refused unless dev mode is on for them (flags.ts).
const devRow = async (ctx: MutationCtx) => {
  const player = await playerId(ctx)
  if (!player) throw new ConvexError("Not signed in")
  await requireDev(ctx, player)
  return await ensurePlayer(ctx, player)
}

// Dev tools, for testing without paying: paid Pro for a month from now or none (it counts
// while premium is on, flags.ts), and holos added to yourself.
export const setPro = mutation({
  args: { pro: v.boolean() },
  handler: async (ctx, args) => {
    const row = await devRow(ctx)
    const month = proMonthDays * 24 * 3_600_000
    await setProUntil(ctx, row, args.pro ? Date.now() + month : 0)
  },
})

export const addHolos = mutation({
  args: { amount: v.number() },
  handler: async (ctx, { amount }) => {
    if (!Number.isInteger(amount) || amount < 1 || amount > 100_000) {
      throw new ConvexError("Add 1 to 100,000 holos")
    }
    const row = await devRow(ctx)
    await ctx.db.patch("players", row._id, { coins: row.coins + amount })
  },
})

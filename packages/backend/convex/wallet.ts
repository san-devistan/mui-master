import { ConvexError } from "convex/values"

import { query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { playerId } from "./auth"
import {
  auctionHours,
  freePackHours,
  freePacks,
  maxFreePacks,
  packPrice,
  sellPrice,
  startingCoins,
} from "./songs/_lib/economy"

// A player's coins and free packs, on their `players` row (see schema.ts).

const playerRow = (ctx: QueryCtx, player: string) =>
  ctx.db
    .query("players")
    .withIndex("by_playerId", (q) => q.eq("playerId", player))
    .unique()

// The player's row, made on first use with the starting coins and all their free packs.
export const ensurePlayer = async (ctx: MutationCtx, player: string) => {
  const row = await playerRow(ctx, player)
  if (row) return row
  const fields = {
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
  const free = freePacks(row.freePacksSince, Date.now())
  if (free.count > 0) {
    await ctx.db.patch("players", row._id, { freePacksSince: free.usedSince })
  } else if (buy) await addCoins(ctx, player, -packPrice)
  else throw new ConvexError("No free pack left")
}

// The signed-in player's coins and free packs, and the prices. A query doesn't re-run as time
// passes, so the client counts the free packs from `freePacksSince` (see economy.ts freePacks).
export const get = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    const row = player ? await playerRow(ctx, player) : null
    return {
      coins: row?.coins ?? startingCoins,
      freePacksSince: row?.freePacksSince ?? 0,
      freePackHours,
      maxFreePacks,
      packPrice,
      sellPrice,
      auctionHours,
    }
  },
})

import type { CardRarity } from "./validators"

// The game's coins: what a player starts with, earns and spends. Whole coins only.

export const startingCoins = 100

// Free packs: one every 8 hours, up to 3 held, so 3 a day at most and none lost overnight. Past
// them a pack costs packPrice.
export const freePackHours = 8
export const maxFreePacks = 3
export const packPrice = 100
const freePackMs = freePackHours * 3_600_000

// The free packs held at `now`, counted from `since` (players.freePacksSince): one per 8 hours,
// at most maxFreePacks. `from` is `since` moved up while full, so time spent full isn't banked;
// opening one sets `since` to `from` plus 8 hours. `nextAt`: when another comes, null when full.
export function freePacks(since: number, now: number) {
  const from = Math.max(since, now - maxFreePacks * freePackMs)
  const count = Math.floor((now - from) / freePackMs)
  return {
    count,
    from,
    usedSince: from + freePackMs,
    nextAt: count < maxFreePacks ? from + (count + 1) * freePackMs : null,
  }
}

// What the bank pays for a copy. A pack averages under half its price back, so buying packs
// to sell them never pays.
export const sellPrice: Record<CardRarity, number> = {
  common: 2,
  rare: 10,
  epic: 40,
  legendary: 200,
}

// Auctions: the seller gets the whole top bid, a bid beats the last by 5% (at least a coin), a
// bid in the last two minutes pushes the end to two minutes after it, and a player runs ten at most.
export const minRaise = 0.05
export const snipeWindowMs = 2 * 60 * 1000
export const maxOpenAuctions = 10
export const auctionHours = [1, 3, 6, 12, 24] as const
export const maxStartPrice = 1_000_000

// The lowest bid an auction takes: its start price before any bid, then a raise on the top bid.
export const minBid = (startPrice: number, topBid: number | undefined) =>
  topBid === undefined
    ? startPrice
    : topBid + Math.max(1, Math.ceil(topBid * minRaise))

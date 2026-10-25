import type { CardRarity } from "./validators"

// The game's coins: what a player starts with, earns and spends. Whole coins only.

export const startingCoins = 100

// Free packs: one every 8 hours, up to 3 held, so 3 a day at most and none lost overnight. Past
// them a pack costs packPrice, bought ahead (up to maxPacksBought at once) and kept until opened.
// Pro gets one every 4 hours, up to 6 held.
export const freePackHours = 8
export const maxFreePacks = 3
export const packPrice = 100
export const maxPacksBought = 50
const HOUR = 3_600_000
const DAY = 24 * HOUR

// Pro, billed monthly: what it adds over the free game.
export const proFreePackHours = 4
export const proMaxFreePacks = 6
export const proWeeklyHolos = 1_000
export const proMaxOpenAuctions = 30
export const proMonthDays = 30

// Pro while paid up: `proUntil` (players.proUntil) is still ahead.
export const isPro = (proUntil: number, now: number) => proUntil > now

// How fast free packs come and how many are held, for a Pro player or not.
export const freePackPlan = (pro: boolean) =>
  pro
    ? { hours: proFreePackHours, max: proMaxFreePacks }
    : { hours: freePackHours, max: maxFreePacks }

// The free packs held at `now`, counted from `since` (players.freePacksSince): one per 8 hours,
// at most maxFreePacks. `from` is `since` moved up while full, so time spent full isn't banked;
// opening one sets `since` to `from` plus 8 hours. `nextAt`: when another comes, null when full.
// Pro's `plan` counts them every 4 hours, 6 held, the same way.
export function freePacks(
  since: number,
  now: number,
  plan = freePackPlan(false)
) {
  const every = plan.hours * HOUR
  const from = Math.max(since, now - plan.max * every)
  const count = Math.floor((now - from) / every)
  return {
    count,
    from,
    usedSince: from + every,
    nextAt: count < plan.max ? from + (count + 1) * every : null,
  }
}

// Skipping the wait for the next free pack: the share of a pack's price still left to wait, at
// least a holo. Buying keeps the timer running, so a skip never costs more than the time it saves.
export const skipPrice = (
  nextAt: number,
  now: number,
  plan = freePackPlan(false)
) => Math.max(1, Math.ceil((packPrice * (nextAt - now)) / (plan.hours * HOUR)))

// Pro's weekly holos are due a week after the last were given, or straight away the first time
// (`lastAt` 0).
export const weeklyHolosDue = (lastAt: number, now: number) =>
  now - lastAt >= 7 * DAY

// What the bank pays for a copy. A pack averages under half its price back, so buying packs
// to sell them never pays.
export const sellPrice: Record<CardRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

// Auctions: the seller gets the whole top bid, a bid beats the last by 5% (at least a coin), a
// bid in the last two minutes pushes the end to two minutes after it, and a player runs ten at
// most (Pro: proMaxOpenAuctions).
export const minRaise = 0.05
export const snipeWindowMs = 2 * 60 * 1000
export const maxOpenAuctions = 10
export const auctionHours = [1, 3, 6, 12, 24] as const
export const maxStartPrice = 1_000_000

// The shop, paid through Stripe (billing.ts). Holo bundles, best value last, and Pro, billed
// monthly. Prices in euro cents, for the shop to show; Stripe charges its own prices, found by
// `lookupKey` and made to match these (scripts/stripe-prices.mjs).
export const holoBundles = [
  { id: "pouch", holos: 500, priceCents: 199, lookupKey: "holos_pouch" },
  { id: "chest", holos: 1_500, priceCents: 499, lookupKey: "holos_chest" },
  { id: "vault", holos: 4_000, priceCents: 999, lookupKey: "holos_vault" },
] as const
export const pro = {
  priceCents: 499,
  lookupKey: "holotrack_pro_monthly",
  perks: [
    {
      id: "freePacks",
      label: `A free pack every ${proFreePackHours} hours, ${proMaxFreePacks} held`,
    },
    {
      id: "weeklyHolos",
      label: `${proWeeklyHolos.toLocaleString("en")} holos every week`,
    },
    {
      id: "auctions",
      label: `Up to ${proMaxOpenAuctions} auctions at once`,
    },
    { id: "badge", label: "A Pro badge on your profile" },
  ],
} as const

// The lowest bid an auction takes: its start price before any bid, then a raise on the top bid.
export const minBid = (startPrice: number, topBid: number | undefined) =>
  topBid === undefined
    ? startPrice
    : topBid + Math.max(1, Math.ceil(topBid * minRaise))

import { ConvexError } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { query, type QueryCtx } from "./_generated/server"
import { playerId } from "./auth"
import { grantFor } from "./grants"
import { isPro } from "./songs/_lib/economy"

declare const process: { env: Record<string, string | undefined> }

// Feature flags, on for everyone on a deployment by an env var (dashboard, or `pnpm exec convex
// env set NAME 1`, `--prod` for production), or for one player by a grant on their email
// (grants.ts). They're enforced here, in the backend's own functions: the app talks to Convex
// directly, so a flag the client only hid behind would stop nobody calling a mutation. The client
// reads them (flags:get) only to hide what's off.
// - DEV_TOOLS=1, dev mode: the dev tools (wallet:setPro, wallet:addHolos), for testing without
//   paying, and checkout in the Stripe sandbox instead of live (billing.ts), test cards only.
//   Anyone signed in can mint holos and Pro with it: never production; there, grant `dev` to
//   your own email instead.
// - PREMIUM=1, premium sales: the holo shop and new Stripe checkouts (billing.ts). Off, nobody
//   can buy holos or Pro, but what was already paid for stays: holos, and Pro until its paid
//   period ends. A `pro` grant opens sales for that player alone.
// - STOP_PRO_RENEWALS=1: no new Pro, and every Pro subscription stops renewing at the end of its
//   paid period (billing:stopProRenewals, run by crons.ts). Turning it off again doesn't resume
//   subscriptions already stopped.

const devEverywhere = () => process.env.DEV_TOOLS === "1"
const premiumEverywhere = () => process.env.PREMIUM === "1"
export const proRenewalsStopped = () => process.env.STOP_PRO_RENEWALS === "1"

// A grant's Pro never runs out: the latest time a Date can hold.
export const proForever = 8_640_000_000_000_000

// The flags for one player (null: signed out), from the deployment and their grant.
export async function flagsFor(ctx: QueryCtx, player: string | null) {
  const grant = await grantFor(ctx, player)
  const premium = premiumEverywhere() || grant?.pro === true
  return {
    dev: devEverywhere() || grant?.dev === true,
    premium,
    proSales: premium && !proRenewalsStopped(),
    // Pro for free, whatever premium is for everyone.
    granted: grant?.pro === true,
  }
}

export async function requireDev(ctx: QueryCtx, player: string) {
  if (!(await flagsFor(ctx, player)).dev) {
    throw new ConvexError("Dev tools are off")
  }
}

export async function requirePremium(ctx: QueryCtx, player: string) {
  if (!(await flagsFor(ctx, player)).premium) {
    throw new ConvexError("The shop is closed")
  }
}

type ProRow = Pick<Doc<"players">, "playerId" | "proUntil" | "referralProUntil">

// When the player's Pro runs out (ms): proForever when granted, else the later of paid Pro
// (`players.proUntil`, kept by billing.ts) and referral Pro (`players.referralProUntil`), whatever
// the sales flag says; 0 when not Pro. Every Pro perk asks here.
export async function proUntilOf(ctx: QueryCtx, row: ProRow) {
  const flags = await flagsFor(ctx, row.playerId)
  if (flags.granted) return proForever
  return Math.max(row.proUntil, row.referralProUntil ?? 0)
}

export const proAt = async (ctx: QueryCtx, row: ProRow, now: number) =>
  isPro(await proUntilOf(ctx, row), now)

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { dev, premium, proSales } = await flagsFor(ctx, await playerId(ctx))
    return { dev, premium, proSales }
  },
})

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
//   paying. Anyone signed in can mint holos and Pro with it: never production; there, grant
//   `dev` to your own email instead.
// - PREMIUM=1, premium: the holo shop (Stripe checkout, billing.ts), Holotrack Pro and all their
//   UI. Off, there's no shop and nobody paid is Pro; a `pro` grant still is, with premium on for
//   them alone.

const devEverywhere = () => process.env.DEV_TOOLS === "1"
const premiumEverywhere = () => process.env.PREMIUM === "1"

// A grant's Pro never runs out: the latest time a Date can hold.
export const proForever = 8_640_000_000_000_000

// The flags for one player (null: signed out), from the deployment and their grant.
export async function flagsFor(ctx: QueryCtx, player: string | null) {
  const grant = await grantFor(ctx, player)
  return {
    dev: devEverywhere() || grant?.dev === true,
    premium: premiumEverywhere() || grant?.pro === true,
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

type ProRow = Pick<Doc<"players">, "playerId" | "proUntil">

// When the player's Pro runs out (ms): proForever when granted; paid Pro (`players.proUntil`,
// kept at the subscription's period end by billing.ts) only while premium is on for everyone, so
// turning it off turns every paid perk off; 0 when not Pro. Every Pro perk asks here.
export async function proUntilOf(ctx: QueryCtx, row: ProRow) {
  const flags = await flagsFor(ctx, row.playerId)
  if (flags.granted) return proForever
  return premiumEverywhere() ? row.proUntil : 0
}

export const proAt = async (ctx: QueryCtx, row: ProRow, now: number) =>
  isPro(await proUntilOf(ctx, row), now)

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { dev, premium } = await flagsFor(ctx, await playerId(ctx))
    return { dev, premium }
  },
})

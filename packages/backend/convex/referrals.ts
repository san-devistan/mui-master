import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { mutation, type MutationCtx, type QueryCtx } from "./_generated/server"
import { authComponent, playerId } from "./auth"
import { paidHere, stripeAccounts } from "./billing"
import { flagsFor } from "./flags"
import { scheduleFreePackPush } from "./push"
import { ensurePlayer, playerRow } from "./wallet"

const DAY = 24 * 60 * 60 * 1000
const rewardDays = 7
const proRewardPacks = 5
const claimWindow = DAY
const monthlyRewards = 10
const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const codeLength = 8

const extend = (until: number | undefined, now: number) =>
  Math.max(until ?? 0, now) + rewardDays * DAY

const isMetadata = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((entry) => typeof entry === "string")

async function hasActivePaidPro(ctx: QueryCtx, player: string, now: number) {
  for (const account of ["live", "sandbox"] as const) {
    const subscriptions = await ctx.runQuery(
      stripeAccounts[account].component.public.listSubscriptionsByUserId,
      { userId: player }
    )
    if (
      subscriptions.some((subscription) => {
        const metadata: unknown = subscription.metadata
        return (
          (subscription.status === "active" ||
            subscription.status === "trialing") &&
          subscription.currentPeriodEnd * 1000 > now &&
          isMetadata(metadata) &&
          metadata.offer === "pro" &&
          paidHere(metadata)
        )
      })
    ) {
      return true
    }
  }
  return false
}

// 5 packs to a player with an active paid Pro subscription or granted Pro; everyone else gets a
// week of referral Pro.
async function rewardFor(ctx: QueryCtx, player: string, now: number) {
  const { granted } = await flagsFor(ctx, player)
  return granted || (await hasActivePaidPro(ctx, player, now))
    ? ("packs" as const)
    : ("pro" as const)
}

async function giveReward(ctx: MutationCtx, player: string, now: number) {
  const row = await ensurePlayer(ctx, player)
  if ((await rewardFor(ctx, player, now)) === "packs") {
    await ctx.db.patch("players", row._id, {
      boughtPacks: row.boughtPacks + proRewardPacks,
    })
    return
  }
  const referralProUntil = extend(row.referralProUntil, now)
  await ctx.db.patch("players", row._id, { referralProUntil })
  await scheduleFreePackPush(ctx, { ...row, referralProUntil })
}

const randomCode = () =>
  Array.from({ length: codeLength }, () =>
    codeAlphabet.charAt(Math.floor(Math.random() * codeAlphabet.length))
  ).join("")

const rowByCode = (ctx: MutationCtx, code: string) =>
  ctx.db
    .query("players")
    .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
    .unique()

async function codeFor(
  ctx: MutationCtx,
  row: Pick<Doc<"players">, "_id" | "referralCode">
) {
  if (row.referralCode) return row.referralCode
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode()
    if (!(await rowByCode(ctx, code))) {
      await ctx.db.patch("players", row._id, { referralCode: code })
      return code
    }
  }
  throw new ConvexError("Couldn't make an invite link, try again")
}

// The signed-in player's invite code, made on first use, and how many players joined through it.
export const mine = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    const row = await ensurePlayer(ctx, player)
    const code = await codeFor(ctx, row)
    const joined = await ctx.db
      .query("referrals")
      .withIndex("by_referrerId", (q) => q.eq("referrerId", player))
      .take(100)
    return {
      code,
      joined: joined.length,
      reward: await rewardFor(ctx, player, Date.now()),
      rewardDays,
      proRewardPacks,
    }
  },
})

// A brand-new account claims the link it signed up from. A player with an active paid Pro
// subscription or granted Pro gets 5 packs; everyone else gets a week of referral Pro, kept
// separately from paid Pro so it works with premium sales off. Returns false when the code is
// unusable, already claimed, or the account isn't new; it never reveals why.
export const claim = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const referred = await playerId(ctx)
    if (!referred) throw new ConvexError("Not signed in")
    const referrerRow = await rowByCode(ctx, code.trim().toUpperCase())
    if (!referrerRow || referrerRow.playerId === referred) return false
    const referrerId = referrerRow.playerId
    const already = await ctx.db
      .query("referrals")
      .withIndex("by_referredId", (q) => q.eq("referredId", referred))
      .unique()
    if (already) return false
    const [newUser, referrer] = await Promise.all([
      authComponent.getAnyUserById(ctx, referred),
      authComponent.getAnyUserById(ctx, referrerId),
    ])
    const now = Date.now()
    if (!newUser || !referrer || now - newUser.createdAt > claimWindow) {
      return false
    }
    const referredRow = await playerRow(ctx, referred)
    if (referredRow && referredRow.cards > 0) return false
    const recent = await ctx.db
      .query("referrals")
      .withIndex("by_referrerId", (q) => q.eq("referrerId", referrerId))
      .order("desc")
      .take(monthlyRewards)
    if (
      recent.length === monthlyRewards &&
      recent.every((row) => now - row._creationTime < 30 * DAY)
    ) {
      return false
    }
    await ctx.db.insert("referrals", {
      referrerId,
      referredId: referred,
      rewardDays,
    })
    await giveReward(ctx, referrerId, now)
    await giveReward(ctx, referred, now)
    return true
  },
})

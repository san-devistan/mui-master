import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { mutation, type MutationCtx } from "./_generated/server"
import { authComponent, playerId } from "./auth"
import { ensurePlayer, playerRow } from "./wallet"

const DAY = 24 * 60 * 60 * 1000
// Packs, never Pro: they open into cards, which give back less than they cost, and nothing tradeable
// comes straight out of an invite.
const rewardPacks = 5
const claimWindow = DAY
const monthlyRewards = 10
const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const codeLength = 8

async function giveReward(ctx: MutationCtx, player: string) {
  const row = await ensurePlayer(ctx, player)
  await ctx.db.patch("players", row._id, {
    boughtPacks: row.boughtPacks + rewardPacks,
  })
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
      rewardPacks,
    }
  },
})

// A brand-new account claims the link it signed up from: it and its inviter each get 5 packs.
// Returns false when the code is unusable, already claimed, or the account isn't new; it never
// reveals why.
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
      rewardPacks,
    })
    await giveReward(ctx, referrerId)
    await giveReward(ctx, referred)
    return true
  },
})

import { ConvexError, v } from "convex/values"

import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server"
import { authComponent } from "./auth"

// The flags (flags.ts) for one player, by their email (`grants`): `pro`, Holotrack Pro for free
// and premium on for them alone, for yourself, friends and testers; `dev`, the dev tools for them
// alone, to test on production. Only internal functions here, so no client can grant itself
// anything; run them from the Convex dashboard or the CLI (`--prod` for production):
//   pnpm exec convex run grants:give '{"email":"me@example.com","pro":true,"note":"founder"}'
//   pnpm exec convex run grants:revoke '{"email":"me@example.com"}'
// A player's email is their Better Auth account's, which only signs in with a code emailed to
// it, so nobody else can claim it.

const normalized = (email: string) => email.trim().toLowerCase()

const grantByEmail = (ctx: QueryCtx, email: string) =>
  ctx.db
    .query("grants")
    .withIndex("by_email", (q) => q.eq("email", normalized(email)))
    .first()

// The grant for the player with this id (their Better Auth user id), or null.
export async function grantFor(ctx: QueryCtx, player: string | null) {
  if (!player) return null
  const user = await authComponent.getAnyUserById(ctx, player)
  return user?.email ? await grantByEmail(ctx, user.email) : null
}

// Gives (or changes) a player's grant: Pro unless `pro` is false, the dev tools when `dev`.
export const give = internalMutation({
  args: {
    email: v.string(),
    pro: v.optional(v.boolean()),
    dev: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalized(args.email)
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new ConvexError("Not an email")
    const fields = {
      email,
      pro: args.pro ?? true,
      dev: args.dev ?? false,
      note: args.note,
    }
    const grant = await grantByEmail(ctx, email)
    if (grant) await ctx.db.replace("grants", grant._id, fields)
    else await ctx.db.insert("grants", fields)
  },
})

export const revoke = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const grant = await grantByEmail(ctx, args.email)
    if (grant) await ctx.db.delete("grants", grant._id)
  },
})

export const list = internalQuery({
  args: {},
  handler: (ctx) => ctx.db.query("grants").take(500),
})

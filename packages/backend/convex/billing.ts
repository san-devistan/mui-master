import { StripeSubscriptions } from "@convex-dev/stripe"
import { ConvexError, v } from "convex/values"
import { Stripe } from "stripe"

import { components, internal } from "./_generated/api"
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server"
import { authComponent, playerId } from "./auth"
import { flagsFor } from "./flags"
import { holoBundles, pro } from "./songs/_lib/economy"
import { ensurePlayer, playerRow, setProUntil } from "./wallet"

declare const process: { env: Record<string, string | undefined> }

// Paying with Stripe, through its Convex component (convex.config.ts), which mirrors customers,
// subscriptions and payments into its own tables from the webhook (http.ts). Needs the env vars
// STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (the webhook endpoint's), and SITE_URL to come
// back to. A sandbox's keys (sk_test_) take test cards only.
// The client only starts a checkout (checkout) or opens the billing portal (portal); what it's
// paid for is given by the webhook alone, once Stripe has signed it: holos once per checkout
// session (fulfilledCheckouts), Pro until the subscription's period end, kept current by its
// updates. Prices are Stripe's, found by lookup key (economy.ts), never the client's.

const stripe = new StripeSubscriptions(components.stripe, {})

const siteUrl = () => {
  const url = process.env.SITE_URL
  if (!url) throw new ConvexError("SITE_URL isn't set")
  return url
}

// The Stripe price for a lookup key (economy.ts), as made by scripts/stripe-prices.mjs.
async function priceId(lookupKey: string) {
  const client = new Stripe(stripe.apiKey)
  const prices = await client.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  })
  const price = prices.data[0]
  if (!price) throw new ConvexError("This offer isn't on sale")
  return price.id
}

// What a checkout is for: a holo bundle by its id (economy.ts holoBundles), or "pro".
const offer = v.string()

// Starts a Stripe Checkout for the signed-in player, with premium on for them (flags.ts), and
// returns the page to send them to. Back at /play?checkout=done (or =cancelled).
export const checkout = action({
  args: { offer },
  returns: v.string(),
  handler: async (ctx, args) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    const status = await ctx.runQuery(internal.billing.status, { player })
    if (!status.premium) throw new ConvexError("The shop is closed")
    const bundle = holoBundles.find((one) => one.id === args.offer)
    if (!bundle && args.offer !== "pro") throw new ConvexError("No such offer")
    if (!bundle && status.pro) throw new ConvexError("You're already Pro")
    const customer = await stripe.getOrCreateCustomer(ctx, {
      userId: player,
      email: status.email ?? undefined,
    })
    const back = `${siteUrl()}/play?checkout=`
    // Who bought what, on the session for holos and on the subscription for Pro: the webhook
    // reads it back from Stripe's signed event.
    const metadata = { userId: player, offer: args.offer }
    const session = await stripe.createCheckoutSession(ctx, {
      priceId: await priceId(bundle ? bundle.lookupKey : pro.lookupKey),
      customerId: customer.customerId,
      mode: bundle ? "payment" : "subscription",
      successUrl: `${back}done`,
      cancelUrl: `${back}cancelled`,
      metadata,
      ...(bundle
        ? { paymentIntentMetadata: metadata }
        : { subscriptionMetadata: metadata }),
    })
    if (!session.url) throw new ConvexError("Checkout didn't open")
    return session.url
  },
})

// Stripe's billing portal for the signed-in player: cancel Pro, change card, see invoices.
export const portal = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    const customer = await ctx.runQuery(
      components.stripe.public.getCustomerByUserId,
      { userId: player }
    )
    if (!customer) throw new ConvexError("Nothing bought yet")
    const session = await stripe.createCustomerPortalSession(ctx, {
      customerId: customer.stripeCustomerId,
      returnUrl: `${siteUrl()}/profile`,
    })
    return session.url
  },
})

// Whether the signed-in player has bought anything (a Stripe customer), so the profile offers
// the billing portal.
export const hasBilling = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return false
    const customer = await ctx.runQuery(
      components.stripe.public.getCustomerByUserId,
      { userId: player }
    )
    return customer !== null
  },
})

// Whether checkout is open to the player, whether they're Pro already (paid or granted), and
// their email for Stripe's receipts.
export const status = internalQuery({
  args: { player: v.string() },
  handler: async (ctx, { player }) => {
    const { premium, granted } = await flagsFor(ctx, player)
    const row = await playerRow(ctx, player)
    const user = await authComponent.getAnyUserById(ctx, player)
    return {
      premium,
      pro: granted || (row !== null && row.proUntil > Date.now()),
      email: user?.email ?? null,
    }
  },
})

// A paid holo checkout (webhook: checkout.session.completed, or async_payment_succeeded for a
// slow payment method): the bundle's holos, once per session whatever Stripe resends.
export const fulfillHolos = internalMutation({
  args: { sessionId: v.string(), player: v.string(), offer: v.string() },
  handler: async (ctx, args) => {
    const bundle = holoBundles.find((one) => one.id === args.offer)
    if (!bundle) throw new ConvexError(`No holo bundle "${args.offer}"`)
    const done = await ctx.db
      .query("fulfilledCheckouts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique()
    if (done) return
    await ctx.db.insert("fulfilledCheckouts", {
      sessionId: args.sessionId,
      playerId: args.player,
    })
    const row = await ensurePlayer(ctx, args.player)
    await ctx.db.patch("players", row._id, { coins: row.coins + bundle.holos })
  },
})

// Pro as the subscription now stands (webhook: customer.subscription.*): until its period end
// while it's paid up (active, or trialing), none once it's cancelled or unpaid.
export const syncPro = internalMutation({
  args: {
    player: v.string(),
    status: v.string(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const paid = args.status === "active" || args.status === "trialing"
    const row = await ensurePlayer(ctx, args.player)
    await setProUntil(ctx, row, paid ? args.periodEnd * 1000 : 0)
  },
})

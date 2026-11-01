import { StripeSubscriptions, type StripeComponent } from "@convex-dev/stripe"
import type { FunctionArgs, FunctionReturnType } from "convex/server"
import { ConvexError, v } from "convex/values"
import { Stripe } from "stripe"

import { components, internal } from "./_generated/api"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server"
import { authComponent, playerId } from "./auth"
import { flagsFor, proRenewalsStopped, proUntilOf } from "./flags"
import { holoBundles, pro } from "./songs/_lib/economy"
import { ensurePlayer, playerRow, setProUntil } from "./wallet"

declare const process: { env: Record<string, string | undefined> }

// Paying with Stripe, through its Convex component (convex.config.ts), which mirrors customers,
// subscriptions and payments into its own tables from the webhook (http.ts). Two accounts, each
// its own component, keys and webhook: live (`stripe`: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET),
// real cards; the sandbox (`stripeSandbox`: STRIPE_SANDBOX_SECRET_KEY,
// STRIPE_SANDBOX_WEBHOOK_SECRET), test cards only, for players in dev mode (flags.ts), so testing
// the shop never charges anyone. Needs SITE_URL to come back to.
// The client only starts a checkout (checkout) or opens the billing portal (portal); what it's
// paid for is given by the webhook alone, once Stripe has signed it: holos once per checkout
// session (fulfilledCheckouts), Pro until the subscription's period end, kept current by its
// updates. Prices are Stripe's, found by lookup key (economy.ts), never the client's.
// Stripe Tax works out the VAT on every checkout from the buyer's address (prices include it, as
// the terms say); an account whose Stripe Tax isn't active (the sandbox until it's set up) checks
// out without it rather than failing.

// A Stripe account: its component, and the env vars of its secret key and webhook secret.
export const stripeAccounts = {
  live: {
    component: components.stripe,
    secretKey: "STRIPE_SECRET_KEY",
    webhookSecret: "STRIPE_WEBHOOK_SECRET",
  },
  sandbox: {
    component: components.stripeSandbox,
    secretKey: "STRIPE_SANDBOX_SECRET_KEY",
    webhookSecret: "STRIPE_SANDBOX_WEBHOOK_SECRET",
  },
} satisfies Record<
  string,
  { component: StripeComponent; secretKey: string; webhookSecret: string }
>

export type StripeAccount = keyof typeof stripeAccounts

// The account's secret key, read on each call (an env var set on the dashboard needs no
// redeploy), or undefined when unset or of the wrong mode: live takes only a live key, the
// sandbox only a test one, so a mixed-up env var can't charge real cards in dev mode.
export function stripeKey(account: StripeAccount) {
  const key = process.env[stripeAccounts[account].secretKey]
  const live = /^(sk|rk)_live_/.test(key ?? "")
  return key && live === (account === "live") ? key : undefined
}

// The account's client.
function stripeFor(account: StripeAccount) {
  const key = stripeKey(account)
  if (!key) throw new ConvexError("Checkout isn't open yet")
  return new StripeSubscriptions(stripeAccounts[account].component, {
    STRIPE_SECRET_KEY: key,
  })
}

// The account a player pays in: the sandbox in dev mode, else live.
const accountOf = (dev: boolean): StripeAccount => (dev ? "sandbox" : "live")

// This deployment, put on every checkout's metadata: a Stripe account's webhooks all get every
// event (the sandbox's go to dev and prod, and to other projects sharing it), so each deployment
// only gives what was paid through itself (http.ts).
const deployment = () => process.env.CONVEX_SITE_URL ?? ""

export const paidHere = (metadata: Record<string, string> | null | undefined) =>
  deployment() !== "" && metadata?.deployment === deployment()

const siteUrl = () => {
  const url = process.env.SITE_URL
  if (!url) throw new ConvexError("SITE_URL isn't set")
  return url
}

// The Stripe price for a lookup key (economy.ts), as made by scripts/stripe-prices.mjs.
async function priceId(stripe: StripeSubscriptions, lookupKey: string) {
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

// Whether Stripe Tax is set up on the account, so checkout can charge VAT; read per checkout, as
// it's turned on from the dashboard.
async function taxActive(stripe: StripeSubscriptions) {
  const settings = await new Stripe(stripe.apiKey).tax.settings.retrieve()
  return settings.status === "active"
}

// Stripe Tax on a checkout: VAT from the buyer's address, which Checkout asks for and saves on
// their customer for the next one.
const withTax = {
  automatic_tax: { enabled: true },
  billing_address_collection: "required",
  customer_update: { address: "auto", name: "auto" },
} satisfies Stripe.Checkout.SessionCreateParams

// What a checkout is for: a holo bundle by its id (economy.ts holoBundles), or "pro".
const offer = v.string()

// Starts a Stripe Checkout for the signed-in player, with premium sales on for them (flags.ts),
// and returns the page to send them to. Back at /play?checkout=done (or =cancelled).
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
    if (!bundle && !status.proSales) throw new ConvexError("Pro isn't on sale")
    if (!bundle && status.pro) throw new ConvexError("You're already Pro")
    const stripe = stripeFor(status.account)
    const customer = await stripe.getOrCreateCustomer(ctx, {
      userId: player,
      email: status.email ?? undefined,
    })
    const back = `${siteUrl()}/play?checkout=`
    // Who bought what, and where, on the session for holos and on the subscription for Pro: the
    // webhook reads it back from Stripe's signed event.
    const metadata = {
      userId: player,
      offer: args.offer,
      deployment: deployment(),
    }
    const session = await stripe.createCheckoutSession(ctx, {
      priceId: await priceId(stripe, bundle ? bundle.lookupKey : pro.lookupKey),
      customerId: customer.customerId,
      mode: bundle ? "payment" : "subscription",
      successUrl: `${back}done`,
      cancelUrl: `${back}cancelled`,
      metadata,
      ...(bundle
        ? { paymentIntentMetadata: metadata }
        : { subscriptionMetadata: metadata }),
      ...((await taxActive(stripe)) ? { params: withTax } : {}),
    })
    if (!session.url) throw new ConvexError("Checkout didn't open")
    return session.url
  },
})

// The player's Stripe customer in this account, or null.
const customerIn = (
  ctx: { runQuery: RunCustomerQuery },
  account: StripeAccount,
  player: string
) =>
  ctx.runQuery(stripeAccounts[account].component.public.getCustomerByUserId, {
    userId: player,
  })

type CustomerQuery = StripeComponent["public"]["getCustomerByUserId"]
type RunCustomerQuery = (
  query: CustomerQuery,
  args: FunctionArgs<CustomerQuery>
) => Promise<FunctionReturnType<CustomerQuery>>

// Stripe's billing portal for the signed-in player, in the account they pay in: cancel Pro,
// change card, see invoices.
export const portal = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    const { account }: { account: StripeAccount } = await ctx.runQuery(
      internal.billing.status,
      { player }
    )
    const customer = await customerIn(ctx, account, player)
    if (!customer) throw new ConvexError("Nothing bought yet")
    const session: { url: string } = await stripeFor(
      account
    ).createCustomerPortalSession(ctx, {
      customerId: customer.stripeCustomerId,
      returnUrl: `${siteUrl()}/profile`,
    })
    return session.url
  },
})

const subscriptionMetadata = (
  value: unknown
): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((entry) => typeof entry === "string")

// The signed-in player's billing section: only for a real Pro subscription in the Stripe account
// they pay in. `endsAt` is set once that subscription won't renew.
export const proBilling = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return null
    const { dev } = await flagsFor(ctx, player)
    const now = Date.now()
    const subscriptions = await ctx.runQuery(
      stripeAccounts[accountOf(dev)].component.public.listSubscriptionsByUserId,
      { userId: player }
    )
    const subscription = subscriptions
      .filter((candidate) => {
        const metadata: unknown = candidate.metadata
        return (
          (candidate.status === "active" || candidate.status === "trialing") &&
          candidate.currentPeriodEnd * 1000 > now &&
          subscriptionMetadata(metadata) &&
          metadata.offer === "pro" &&
          paidHere(metadata)
        )
      })
      .toSorted(
        (left, right) => right.currentPeriodEnd - left.currentPeriodEnd
      )[0]
    if (!subscription) return null
    return {
      endsAt:
        subscription.cancelAtPeriodEnd || subscription.cancelAt
          ? (subscription.cancelAt ?? subscription.currentPeriodEnd) * 1000
          : null,
    }
  },
})

// Whether checkout and Pro are open to the player, the Stripe account they pay in, whether
// they're Pro already (paid or granted), and their email for Stripe's receipts.
export const status = internalQuery({
  args: { player: v.string() },
  handler: async (ctx, { player }) => {
    const { premium, proSales, dev } = await flagsFor(ctx, player)
    const row = await playerRow(ctx, player)
    const user = await authComponent.getAnyUserById(ctx, player)
    return {
      premium,
      proSales,
      account: accountOf(dev),
      pro: row !== null && (await proUntilOf(ctx, row)) > Date.now(),
      email: user?.email ?? null,
    }
  },
})

// A paid holo checkout (webhook: checkout.session.completed, or async_payment_succeeded for a
// slow payment method): the bundle's holos, once per session whatever Stripe resends.
export const fulfillHolos = internalMutation({
  args: {
    sessionId: v.string(),
    player: v.string(),
    offer: v.string(),
    paymentIntentId: v.optional(v.string()),
    amountPaid: v.optional(v.number()),
  },
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
      paymentIntentId: args.paymentIntentId,
      holos: bundle.holos,
      amountPaid: args.amountPaid,
      reversedHolos: 0,
    })
    const row = await ensurePlayer(ctx, args.player)
    await ctx.db.patch("players", row._id, { coins: row.coins + bundle.holos })
  },
})

// The holos a holo checkout gave back off its buyer once it's refunded or charged back (webhook:
// charge.refunded, charge.dispute.created), in proportion to the money returned: `amountBack` of
// the `amountPaid`, as the event counts them, never more than the bundle in all, whatever Stripe
// resends. Spent holos leave the balance below zero, so nothing can be spent until earnings bring
// it back up. True when the payment was a holo checkout.
// shortcut: a dispute won back isn't credited again; a player who wins one writes to us.
export const reverseHolos = internalMutation({
  args: {
    paymentIntentId: v.string(),
    amountBack: v.number(),
    amountPaid: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const paid = await ctx.db
      .query("fulfilledCheckouts")
      .withIndex("by_paymentIntentId", (q) =>
        q.eq("paymentIntentId", args.paymentIntentId)
      )
      .unique()
    if (!paid?.holos) return false
    if (args.amountPaid <= 0) return true
    const share = Math.min(Math.max(args.amountBack / args.amountPaid, 0), 1)
    const owed = Math.ceil(paid.holos * share)
    const taken = paid.reversedHolos ?? 0
    if (owed <= taken) return true
    const row = await ensurePlayer(ctx, paid.playerId)
    await ctx.db.patch("players", row._id, {
      coins: row.coins - (owed - taken),
    })
    await ctx.db.patch("fulfilledCheckouts", paid._id, {
      reversedHolos: owed,
    })
    return true
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

// Subscriptions that still bill: everything Stripe hasn't ended for good.
const billing = new Set(["active", "trialing", "past_due", "unpaid", "paused"])
const paidPeriod = new Set(["active", "trialing"])
const proSubscription = (metadata: Record<string, string>) =>
  paidHere(metadata) && metadata.offer === "pro"

// With STOP_PRO_RENEWALS=1 (flags.ts), every Pro subscription opened by this deployment stops
// billing: a paid one at the end of its period, so its Pro lasts until then; an unpaid or paused
// one right away, as it has no Pro to keep. Run by crons.ts, or by hand after turning the flag on:
// `pnpm exec convex run --prod billing:stopProRenewals '{}'`.
export const stopProRenewals = internalAction({
  args: {},
  returns: v.object({ atPeriodEnd: v.number(), now: v.number() }),
  handler: async (ctx) => {
    const stopped = { atPeriodEnd: 0, now: 0 }
    if (!proRenewalsStopped()) return stopped
    for (const account of ["live", "sandbox"] as const) {
      if (!stripeKey(account)) continue
      const stripe = stripeFor(account)
      const client = new Stripe(stripe.apiKey)
      for (const subscriptionStatus of billing) {
        for await (const subscription of client.subscriptions.list({
          status: subscriptionStatus,
          limit: 100,
        })) {
          if (!proSubscription(subscription.metadata)) continue
          const keepsPaidPeriod = paidPeriod.has(subscription.status)
          if (keepsPaidPeriod && subscription.cancel_at_period_end) continue
          await stripe.cancelSubscription(ctx, {
            stripeSubscriptionId: subscription.id,
            cancelAtPeriodEnd: keepsPaidPeriod,
          })
          if (keepsPaidPeriod) stopped.atPeriodEnd += 1
          else stopped.now += 1
        }
      }
    }
    return stopped
  },
})

// Cancels the player's subscriptions right away, in both accounts, before their account is
// deleted (auth.ts): Stripe stops charging them, and Stripe's events then end their Pro. Throws
// when Stripe can't be reached, so the account stays and the player can try again.
export const cancelSubscriptions = internalAction({
  args: { player: v.string() },
  returns: v.null(),
  handler: async (ctx, { player }) => {
    for (const account of ["live", "sandbox"] as const) {
      const subscriptions = await ctx.runQuery(
        stripeAccounts[account].component.public.listSubscriptionsByUserId,
        { userId: player }
      )
      const live = subscriptions.filter((one) => billing.has(one.status))
      if (live.length === 0) continue
      const stripe = stripeFor(account)
      for (const subscription of live) {
        await stripe.cancelSubscription(ctx, {
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        })
      }
    }
    return null
  },
})

// A refunded or charged-back payment, from its webhook (http.ts), with the account it came through:
// a holo checkout takes its holos back (reverseHolos); a Pro payment refunded in full or charged
// back ends that subscription now, and Stripe's subscription event then ends its Pro. A partial
// refund on Pro is goodwill and keeps it. Only payments opened by this deployment.
export const reversePayment = internalAction({
  args: {
    account: v.union(v.literal("live"), v.literal("sandbox")),
    paymentIntentId: v.string(),
    amountBack: v.number(),
    amountPaid: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const holos: boolean = await ctx.runMutation(
      internal.billing.reverseHolos,
      {
        paymentIntentId: args.paymentIntentId,
        amountBack: args.amountBack,
        amountPaid: args.amountPaid,
      }
    )
    if (holos || args.amountBack < args.amountPaid) return null
    const key = stripeKey(args.account)
    if (!key) return null
    const client = new Stripe(key)
    const payments = await client.invoicePayments.list({
      payment: { type: "payment_intent", payment_intent: args.paymentIntentId },
      expand: ["data.invoice"],
      limit: 1,
    })
    const invoice = payments.data[0]?.invoice
    if (!invoice || typeof invoice === "string" || invoice.deleted) return null
    const details = invoice.parent?.subscription_details
    if (!details?.metadata || !proSubscription(details.metadata)) return null
    const subscription =
      typeof details.subscription === "string"
        ? details.subscription
        : details.subscription.id
    const current = await client.subscriptions.retrieve(subscription)
    if (current.status === "canceled") return null
    await stripeFor(args.account).cancelSubscription(ctx, {
      stripeSubscriptionId: subscription,
      cancelAtPeriodEnd: false,
    })
    return null
  },
})

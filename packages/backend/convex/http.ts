import { registerRoutes, type StripeEventHandlers } from "@convex-dev/stripe"
import { httpRouter, type GenericActionCtx } from "convex/server"
import type Stripe from "stripe"

import { internal } from "./_generated/api"
import { authComponent, createAuth } from "./auth"
import {
  paidHere,
  stripeAccounts,
  stripeKey,
  type StripeAccount,
} from "./billing"

declare const process: { env: Record<string, string | undefined> }

const http = httpRouter()

authComponent.registerRoutes(http, createAuth)

// The context Stripe's webhook handlers get: only its runAction and runMutation are used.
type WebhookCtx = Pick<GenericActionCtx<never>, "runAction" | "runMutation">

const objectId = (value: string | { id: string } | null) =>
  typeof value === "string" ? value : (value?.id ?? null)

// A paid checkout for holos (billing.ts fulfillHolos); a subscription's checkout gives Pro
// through its own events instead. Only once paid: a slow payment method completes the session
// unpaid, then sends async_payment_succeeded. Only checkouts opened by this deployment
// (billing.ts paidHere): the account's other webhooks get the same events.
const holosPaid = async (ctx: WebhookCtx, session: Stripe.Checkout.Session) => {
  if (!paidHere(session.metadata)) return
  const player = session.metadata?.userId
  const offer = session.metadata?.offer
  if (session.mode !== "payment" || session.payment_status !== "paid") return
  if (!player || !offer) return
  await ctx.runMutation(internal.billing.fulfillHolos, {
    sessionId: session.id,
    player,
    offer,
    paymentIntentId: objectId(session.payment_intent) ?? undefined,
    amountPaid: session.amount_total ?? undefined,
  })
}

// Pro as the subscription stands (billing.ts syncPro), on every change Stripe reports.
const proChanged = async (
  ctx: WebhookCtx,
  subscription: Stripe.Subscription
) => {
  if (!paidHere(subscription.metadata)) return
  const player = subscription.metadata.userId
  if (!player) return
  await ctx.runMutation(internal.billing.syncPro, {
    player,
    status: subscription.status,
    periodEnd: subscription.items.data[0]?.current_period_end ?? 0,
  })
}

type Reversal = {
  account: StripeAccount
  paymentIntent: string | { id: string } | null
  amountBack: number
  amountPaid: number
}

// Money given back on a payment, refunded in full or in part, or charged back by the buyer's
// bank: what it paid for is taken back (billing.ts reversePayment). Every Stripe account's webhook
// gets these, so only a payment this deployment fulfilled or opened is touched.
const paymentReversed = async (
  ctx: WebhookCtx,
  { account, paymentIntent, amountBack, amountPaid }: Reversal
) => {
  const paymentIntentId = objectId(paymentIntent)
  if (!paymentIntentId || amountBack <= 0) return
  await ctx.runAction(internal.billing.reversePayment, {
    account,
    paymentIntentId,
    amountBack,
    amountPaid,
  })
}

const eventsFor = (account: StripeAccount): StripeEventHandlers => ({
  "checkout.session.completed": (ctx, event) =>
    holosPaid(ctx, event.data.object),
  "checkout.session.async_payment_succeeded": (ctx, event) =>
    holosPaid(ctx, event.data.object),
  "customer.subscription.created": (ctx, event) =>
    proChanged(ctx, event.data.object),
  "customer.subscription.updated": (ctx, event) =>
    proChanged(ctx, event.data.object),
  "customer.subscription.deleted": (ctx, event) =>
    proChanged(ctx, event.data.object),
  "charge.refunded": (ctx, event) => {
    const charge = event.data.object
    return paymentReversed(ctx, {
      account,
      paymentIntent: charge.payment_intent,
      amountBack: charge.amount_refunded,
      amountPaid: charge.amount,
    })
  },
  // A chargeback takes the whole payment back as soon as it's opened (its amount can differ from
  // the charge's by currency conversion): a dispute the player loses never pays us back.
  "charge.dispute.created": (ctx, event) => {
    const dispute = event.data.object
    return paymentReversed(ctx, {
      account,
      paymentIntent: dispute.payment_intent,
      amountBack: 1,
      amountPaid: 1,
    })
  },
})

// Each Stripe account's webhook (billing.ts): live at /stripe/webhook, the sandbox at
// /stripe/sandbox/webhook. Its component checks the signature with the account's webhook secret
// and mirrors the event into its tables, then these give what was paid for and take back what was
// refunded. Each endpoint must also send charge.refunded and charge.dispute.created. The component
// reads the secrets on each request (getters), so an env var set on the dashboard needs no redeploy.
const webhookPaths: Record<StripeAccount, string> = {
  live: "/stripe/webhook",
  sandbox: "/stripe/sandbox/webhook",
}

for (const account of ["live", "sandbox"] as const) {
  const { component, webhookSecret } = stripeAccounts[account]
  registerRoutes(http, component, {
    webhookPath: webhookPaths[account],
    events: eventsFor(account),
    get STRIPE_SECRET_KEY() {
      return stripeKey(account)
    },
    get STRIPE_WEBHOOK_SECRET() {
      return process.env[webhookSecret]
    },
  })
}

export default http

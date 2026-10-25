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

// The context Stripe's webhook handlers get: only its runMutation is used.
type WebhookCtx = Pick<GenericActionCtx<never>, "runMutation">

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

const events: StripeEventHandlers = {
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
}

// Each Stripe account's webhook (billing.ts): live at /stripe/webhook, the sandbox at
// /stripe/sandbox/webhook. Its component checks the signature with the account's webhook secret
// and mirrors the event into its tables, then these give what was paid for. The component reads
// the secrets on each request (getters), so an env var set on the dashboard needs no redeploy.
const webhookPaths: Record<StripeAccount, string> = {
  live: "/stripe/webhook",
  sandbox: "/stripe/sandbox/webhook",
}

for (const account of ["live", "sandbox"] as const) {
  const { component, webhookSecret } = stripeAccounts[account]
  registerRoutes(http, component, {
    webhookPath: webhookPaths[account],
    events,
    get STRIPE_SECRET_KEY() {
      return stripeKey(account)
    },
    get STRIPE_WEBHOOK_SECRET() {
      return process.env[webhookSecret]
    },
  })
}

export default http

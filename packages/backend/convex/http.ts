import { registerRoutes } from "@convex-dev/stripe"
import { httpRouter, type GenericActionCtx } from "convex/server"
import type Stripe from "stripe"

import { components, internal } from "./_generated/api"
import { authComponent, createAuth } from "./auth"

const http = httpRouter()

authComponent.registerRoutes(http, createAuth)

// The context Stripe's webhook handlers get: only its runMutation is used.
type WebhookCtx = Pick<GenericActionCtx<never>, "runMutation">

// A paid checkout for holos (billing.ts fulfillHolos); a subscription's checkout gives Pro
// through its own events instead. Only once paid: a slow payment method completes the session
// unpaid, then sends async_payment_succeeded.
const holosPaid = async (ctx: WebhookCtx, session: Stripe.Checkout.Session) => {
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
  const player = subscription.metadata.userId
  if (!player) return
  await ctx.runMutation(internal.billing.syncPro, {
    player,
    status: subscription.status,
    periodEnd: subscription.items.data[0]?.current_period_end ?? 0,
  })
}

// Stripe's webhook, at /stripe/webhook: the component checks the signature (STRIPE_WEBHOOK_SECRET)
// and mirrors the event into its tables, then these give what was paid for.
registerRoutes(http, components.stripe, {
  events: {
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
  },
})

export default http

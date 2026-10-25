import betterAuth from "@convex-dev/better-auth/convex.config"
import resend from "@convex-dev/resend/convex.config"
import stripe from "@convex-dev/stripe/convex.config.js"
import { defineApp } from "convex/server"

const app = defineApp()

app.use(betterAuth)
app.use(resend)
// Two Stripe accounts, each mirrored into its own tables (billing.ts): the live one, and the
// sandbox for players in dev mode, so test customers never mix with real ones.
app.use(stripe)
app.use(stripe, { name: "stripeSandbox" })

export default app

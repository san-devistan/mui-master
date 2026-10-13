import { convexClient } from "@convex-dev/better-auth/client/plugins"
import { anonymousClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

// Talks to Better Auth through this site's /api/auth route (routes/api.auth.$.ts), which forwards
// to the Convex deployment, so the session cookie stays first-party.
export const authClient = createAuthClient({
  plugins: [anonymousClient(), convexClient()],
})

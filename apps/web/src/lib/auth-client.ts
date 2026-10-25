import { convexClient } from "@convex-dev/better-auth/client/plugins"
import { emailOTPClient, usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { patientFetch } from "./patient-fetch"

// Talks to Better Auth through this site's /api/auth route (routes/api.auth.$.ts), which forwards
// to the Convex deployment, so the session cookie stays first-party.
export const authClient = createAuthClient({
  // Session, sign-in and Convex token calls wait out a flaky network rather than fail.
  fetchOptions: { customFetchImpl: patientFetch },
  plugins: [emailOTPClient(), usernameClient(), convexClient()],
})

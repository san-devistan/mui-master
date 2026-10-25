import type { GenericCtx } from "@convex-dev/better-auth"
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils"
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"

import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"

declare const process: { env: Record<string, string | undefined> }

// Better Auth's rate limits (auth.ts), kept in its component's `rateLimit` table so they hold
// across Convex's isolates. Better Auth only turns them on when NODE_ENV is "production", which
// Convex never sets, so they're on here whatever the deployment.

// The site's /api/auth route (apps/web) runs in a Worker, and Cloudflare gives its requests to
// Convex the Worker's own address: the route sends the player's IP in CLIENT_IP, signed with
// AUTH_PROXY_SECRET (set on both). Unsigned, the header is dropped and the request counts against
// the IP Cloudflare puts in front of Convex, which no client can set.
const CLIENT_IP = "x-holotrack-client-ip"
const PROXY_SECRET = "x-holotrack-proxy-secret"

// Per IP and endpoint: 3 codes sent or tried a minute. The session and Convex token endpoints are
// read on every app open and token refresh, so they're left alone; the rest keep the default.
const strict = { window: 60, max: 3 }

export const rateLimit = {
  enabled: true,
  storage: "database",
  customRules: {
    "/email-otp/send-verification-otp": strict,
    "/email-otp/check-verification-otp": strict,
    "/sign-in/email-otp": strict,
    "/get-session": false,
    "/convex/**": false,
  },
} satisfies BetterAuthOptions["rateLimit"]

export const ipAddress = {
  ipAddressHeaders: [CLIENT_IP, "cf-connecting-ip"],
} satisfies NonNullable<BetterAuthOptions["advanced"]>["ipAddress"]

const signedByProxy = (request: Request) => {
  const secret = process.env.AUTH_PROXY_SECRET
  return !!secret && request.headers.get(PROXY_SECRET) === secret
}

// Drops a client IP the site's route didn't sign, so nobody picks the IP they're counted against.
export const trustedClientIp = {
  id: "trusted-client-ip",
  onRequest: async (request) => {
    if (!request.headers.has(CLIENT_IP) || signedByProxy(request)) {
      return { request }
    }
    const headers = new Headers(request.headers)
    headers.delete(CLIENT_IP)
    return { request: new Request(request, { headers }) }
  },
} satisfies BetterAuthPlugin

// Codes sent to one email, whatever the IP asking: 3 per 10 minutes, 10 a day, so requests from
// many IPs can't flood someone's inbox or spend our Resend quota.
const codesPerEmail = [
  { window: 10 * 60 * 1000, max: 3 },
  { window: 24 * 60 * 60 * 1000, max: 10 },
]

const codesKey = (email: string, window: number) =>
  `email:${email.trim().toLowerCase()}|${window}`

// A rate limit row as the Better Auth component returns it (its adapter is typed `any`).
export type RateLimitRow = { _id: string; count: number; lastRequest: number }

export const isRateLimitRow = (row: unknown): row is RateLimitRow =>
  typeof row === "object" &&
  row !== null &&
  "_id" in row &&
  typeof row._id === "string" &&
  "count" in row &&
  typeof row.count === "number" &&
  "lastRequest" in row &&
  typeof row.lastRequest === "number"

// Counts a code about to be emailed, in Better Auth's `rateLimit` table, and refuses it with a
// 429 once a window is full.
async function countCode(ctx: GenericCtx<DataModel>, email: string) {
  const runCtx = requireRunMutationCtx(ctx)
  const now = Date.now()
  for (const { window, max } of codesPerEmail) {
    const key = codesKey(email, window)
    const where = [{ field: "key" as const, value: key }]
    const found: unknown = await runCtx.runQuery(
      components.betterAuth.adapter.findOne,
      { model: "rateLimit", where }
    )
    const row = isRateLimitRow(found) ? found : null
    const fresh = !row || now - row.lastRequest >= window
    if (!fresh && row.count >= max) {
      throw new APIError("TOO_MANY_REQUESTS", {
        code: "TOO_MANY_CODES",
        message: "Too many codes sent to this email. Try again later.",
      })
    }
    const update = { count: fresh ? 1 : row.count + 1, lastRequest: now }
    await (row
      ? runCtx.runMutation(components.betterAuth.adapter.updateOne, {
          input: { model: "rateLimit", where, update },
        })
      : runCtx.runMutation(components.betterAuth.adapter.create, {
          input: { model: "rateLimit", data: { key, ...update } },
        }))
  }
}

// Runs countCode before Better Auth's send-code endpoint, whose own send runs as a background
// task that swallows errors: here a refusal reaches the player as a 429.
export const codesPerEmailLimit = (ctx: GenericCtx<DataModel>) =>
  ({
    id: "codes-per-email",
    hooks: {
      before: [
        {
          matcher: (context) =>
            context.path === "/email-otp/send-verification-otp",
          handler: createAuthMiddleware(async (context) => {
            const body: unknown = context.body
            const email =
              typeof body === "object" && body !== null && "email" in body
                ? body.email
                : undefined
            if (typeof email === "string") await countCode(ctx, email)
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin

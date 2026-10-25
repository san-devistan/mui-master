import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils"
import { Resend } from "@convex-dev/resend"
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal"
import { emailOTP } from "better-auth/plugins/email-otp"
import { username } from "better-auth/plugins/username"

import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import authConfig from "./auth.config"

declare const process: { env: Record<string, string | undefined> }

// Players: Better Auth users, stored in its Convex component. Everyone signs in with a code
// emailed to them before playing; a new email makes an account, which then picks a username.
export const authComponent = createClient<DataModel>(components.betterAuth)

// Sends through Resend (RESEND_API_KEY), queued and retried by its Convex component.
const resend = new Resend(components.resend, { testMode: false })
// shortcut: Resend's shared sender only reaches the Resend account's own email; set AUTH_EMAIL_FROM
// to an address on a domain verified in Resend to email players.
const sender =
  process.env.AUTH_EMAIL_FROM ?? "Holotrack <onboarding@resend.dev>"

const codeEmail = (otp: string) => `
<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#1c1530">
  <p style="font-size:16px;margin:0 0 16px">Your Holotrack sign-in code:</p>
  <p style="font-size:36px;font-weight:900;letter-spacing:8px;margin:0 0 16px">${otp}</p>
  <p style="font-size:14px;color:#6b6380;margin:0">It works for 5 minutes. If you didn't ask for it, ignore this email.</p>
</div>`

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
    database: authComponent.adapter(ctx),
    trustedOrigins: process.env.SITE_URL ? [process.env.SITE_URL] : [],
    // A player can delete their account (signed in within the last day, Better Auth's freshAge);
    // their game goes with it (players:deletePlayer).
    user: {
      deleteUser: {
        enabled: true,
        afterDelete: async (user) => {
          await requireRunMutationCtx(ctx).runMutation(
            internal.players.deletePlayer,
            { playerId: user.id }
          )
        },
      },
    },
    plugins: [
      emailOTP({
        sendVerificationOTP: async ({ email, otp }) => {
          await resend.sendEmail(requireRunMutationCtx(ctx), {
            from: sender,
            to: email,
            subject: `${otp} is your Holotrack code`,
            html: codeEmail(otp),
            text: `Your Holotrack sign-in code: ${otp}\nIt works for 5 minutes.`,
          })
        },
      }),
      username(),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions)

// The signed-in player's id, or null when signed out; from a query, mutation or action.
export const playerId = async (ctx: Pick<QueryCtx, "auth">) =>
  (await ctx.auth.getUserIdentity())?.subject ?? null

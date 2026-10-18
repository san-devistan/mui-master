"use node"

import { v } from "convex/values"
import webpush from "web-push"

import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"

// Sends one push (push.ts notify) to each of the player's devices; a device the push service says
// is gone (404, 410) is forgotten.
export const send = internalAction({
  args: {
    playerId: v.string(),
    title: v.string(),
    body: v.string(),
    url: v.string(),
    tag: v.string(),
  },
  handler: async (ctx, { playerId, ...message }) => {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
      console.warn(
        "Push skipped: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT unset"
      )
      return
    }
    const vapidDetails = {
      subject: VAPID_SUBJECT,
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
    }
    const devices = await ctx.runQuery(internal.push.subscriptions, {
      playerId,
    })
    await Promise.all(
      devices.map(async ({ endpoint, keys }) => {
        try {
          await webpush.sendNotification(
            { endpoint, keys },
            JSON.stringify(message),
            { vapidDetails }
          )
        } catch (error) {
          if (
            error instanceof webpush.WebPushError &&
            (error.statusCode === 404 || error.statusCode === 410)
          ) {
            await ctx.runMutation(internal.push.forget, { endpoint })
          } else console.error("Push failed", error)
        }
      })
    )
  },
})

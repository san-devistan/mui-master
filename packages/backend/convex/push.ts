import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { playerId } from "./auth"
import { proAt } from "./flags"
import { freePackPlan, freePacks } from "./songs/_lib/economy"

declare const process: { env: Record<string, string | undefined> }

// Notifications: Web Push to every device a player turned them on from (pushSubscriptions), sent
// by notify:send. Needs the env vars VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
// (`pnpm exec web-push generate-vapid-keys`), and VAPID_SUBJECT, the sender's mailto: (Apple
// refuses a localhost URL).

export type PushMessage = {
  title: string
  body: string
  // The page a tap opens.
  url: string
  // A newer push with the same tag replaces the last on the device.
  tag: string
}

const deviceOf = (ctx: QueryCtx, player: string) =>
  ctx.db
    .query("pushSubscriptions")
    .withIndex("by_playerId", (q) => q.eq("playerId", player))
    .first()

const byEndpoint = (ctx: QueryCtx, endpoint: string) =>
  ctx.db
    .query("pushSubscriptions")
    .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
    .unique()

const playerRow = (ctx: QueryCtx, player: string) =>
  ctx.db
    .query("players")
    .withIndex("by_playerId", (q) => q.eq("playerId", player))
    .unique()

// The browsers' push services; the backend posts to a subscription's endpoint, so no other host.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
]
const isPushEndpoint = (endpoint: string) => {
  if (!URL.canParse(endpoint)) return false
  const { protocol, hostname } = new URL(endpoint)
  return (
    protocol === "https:" &&
    PUSH_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    )
  )
}

// The free packs the player holds now and when the next comes, at their plan's pace.
const freePacksNow = async (
  ctx: QueryCtx,
  row: Pick<Doc<"players">, "playerId" | "freePacksSince" | "proUntil">
) => {
  const now = Date.now()
  return freePacks(
    row.freePacksSince,
    now,
    freePackPlan(await proAt(ctx, row, now))
  )
}

// Pushes `message` to the player's devices once the calling mutation commits; nothing without one.
export const notify = async (
  ctx: MutationCtx,
  player: string,
  message: PushMessage
) => {
  if (!(await deviceOf(ctx, player))) return
  await ctx.scheduler.runAfter(0, internal.notify.send, {
    playerId: player,
    ...message,
  })
}

// Schedules the push for the player's next free pack, when one is coming (none while all are held)
// and they have a device for it. Called whenever that time can move: a free pack opened, Pro
// switched, notifications turned on, the last one pushed. The previous one, if any, then does
// nothing (freePackReady).
export const scheduleFreePackPush = async (
  ctx: MutationCtx,
  row: Pick<
    Doc<"players">,
    "_id" | "playerId" | "freePacksSince" | "proUntil" | "freePackPushAt"
  >
) => {
  const { nextAt } = await freePacksNow(ctx, row)
  if (nextAt === null || nextAt === row.freePackPushAt) return
  if (!(await deviceOf(ctx, row.playerId))) return
  await ctx.db.patch("players", row._id, { freePackPushAt: nextAt })
  await ctx.scheduler.runAt(nextAt, internal.push.freePackReady, {
    playerId: row.playerId,
    at: nextAt,
  })
}

export const freePackReady = internalMutation({
  args: { playerId: v.string(), at: v.number() },
  handler: async (ctx, { playerId: player, at }) => {
    const row = await playerRow(ctx, player)
    if (!row || row.freePackPushAt !== at) return
    // Pro may have run out since, putting the pack off: then only the new time is scheduled.
    if ((await freePacksNow(ctx, row)).count > 0) {
      await notify(ctx, player, {
        title: "Free pack ready",
        body: "A free pack is waiting for you. Rip it open!",
        url: "/play",
        tag: "free-pack",
      })
    }
    await scheduleFreePackPush(ctx, row)
  },
})

// The key a browser subscribes with; null until the deployment has one.
export const publicKey = query({
  args: {},
  handler: () => process.env.VAPID_PUBLIC_KEY ?? null,
})

// Turns notifications on for this device, or moves them to the signed-in player when the device
// was another's.
export const subscribe = mutation({
  args: {
    endpoint: v.string(),
    keys: v.object({ p256dh: v.string(), auth: v.string() }),
  },
  handler: async (ctx, { endpoint, keys }) => {
    const player = await playerId(ctx)
    if (!player) throw new ConvexError("Not signed in")
    if (!isPushEndpoint(endpoint))
      throw new ConvexError("Not a push subscription")
    const device = await byEndpoint(ctx, endpoint)
    if (device) {
      await ctx.db.patch("pushSubscriptions", device._id, {
        playerId: player,
        keys,
      })
    } else {
      await ctx.db.insert("pushSubscriptions", {
        playerId: player,
        endpoint,
        keys,
      })
    }
    const row = await playerRow(ctx, player)
    if (row) await scheduleFreePackPush(ctx, row)
  },
})

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const player = await playerId(ctx)
    const device = await byEndpoint(ctx, endpoint)
    if (device && device.playerId === player) {
      await ctx.db.delete("pushSubscriptions", device._id)
    }
  },
})

// shortcut: 20 devices per player at most get a push; enough for phones, tablets and browsers.
export const subscriptions = internalQuery({
  args: { playerId: v.string() },
  handler: (ctx, { playerId: player }) =>
    ctx.db
      .query("pushSubscriptions")
      .withIndex("by_playerId", (q) => q.eq("playerId", player))
      .take(20),
})

// A device the push service no longer knows (unsubscribed, app removed).
export const forget = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const device = await byEndpoint(ctx, endpoint)
    if (device) await ctx.db.delete("pushSubscriptions", device._id)
  },
})

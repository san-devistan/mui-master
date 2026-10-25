import { cronJobs } from "convex/server"
import { v } from "convex/values"

import { components, internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import { isRateLimitRow } from "./throttle"

// Housekeeping: sent emails hold sign-in codes, and rate limit rows the IPs and emails that asked
// for them; neither is needed once it's old.

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// Emails kept by the Resend component (auth.ts): delivered, bounced or failed ones after a day,
// any stuck one after a week. The component deletes in batches and carries on by itself.
export const cleanupEmails = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, {
      olderThan: DAY,
    })
    await ctx.scheduler.runAfter(
      0,
      components.resend.lib.cleanupAbandonedEmails,
      { olderThan: 7 * DAY }
    )
    return null
  },
})

// A page from the component's findMany, typed `any` there.
type Page = { page: unknown[]; isDone: boolean; continueCursor: string }

const isPage = (value: unknown): value is Page =>
  typeof value === "object" &&
  value !== null &&
  "page" in value &&
  Array.isArray(value.page) &&
  "isDone" in value &&
  typeof value.isDone === "boolean" &&
  "continueCursor" in value &&
  typeof value.continueCursor === "string"

// Better Auth's rate limit rows (throttle.ts) untouched for over a day, past every window:
// read a page at a time (the table has no index on lastRequest), the stale ones deleted by id.
export const cleanupRateLimits = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const result: unknown = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      {
        model: "rateLimit",
        paginationOpts: { numItems: 200, cursor: cursor ?? null },
      }
    )
    if (!isPage(result)) return null
    const stale = result.page
      .filter(isRateLimitRow)
      .filter((row) => row.lastRequest < Date.now() - DAY)
      .map((row) => row._id)
    if (stale.length > 0) {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "rateLimit",
          where: [{ field: "_id", operator: "in", value: stale }],
        },
        paginationOpts: { numItems: stale.length, cursor: null },
      })
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.crons.cleanupRateLimits, {
        cursor: result.continueCursor,
      })
    }
    return null
  },
})

const crons = cronJobs()

crons.interval(
  "clean up sent emails",
  { hours: 1 },
  internal.crons.cleanupEmails,
  {}
)
crons.interval(
  "clean up rate limits",
  { hours: 6 },
  internal.crons.cleanupRateLimits,
  {}
)

export default crons

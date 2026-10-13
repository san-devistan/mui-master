import { v } from "convex/values"
import { Effect } from "effect"

import { internal } from "./_generated/api"
import { action, internalQuery } from "./_generated/server"
import { searchDeezerPreview } from "./songs/_lib/deezer"

export const songSource = internalQuery({
  args: { songId: v.string() },
  handler: async (ctx, { songId }) => {
    const id = ctx.db.normalizeId("songs", songId)
    const song = id ? await ctx.db.get("songs", id) : null
    if (!song) {
      return null
    }
    const leadId = song.artistIds.at(0)
    const lead = leadId ? await ctx.db.get("artists", leadId) : null

    return {
      previewUrl: song.preview,
      title: song.name,
      leadArtist: lead?.name,
    }
  },
})

// The stored Spotify preview, else Deezer's, found by exact title and lead
// artist. Deezer URLs expire, so they're resolved at play time and never stored.
// shortcut: no ownership check while the web game runs on demo data; add one
// once authenticated players have real collections.
export const preview = action({
  args: { songId: v.string() },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const source = await ctx.runQuery(internal.playback.songSource, args)
    if (!source) {
      return { url: null }
    }

    if (source.previewUrl) {
      return { url: source.previewUrl }
    }

    if (!source.leadArtist) {
      return { url: null }
    }
    const url = await Effect.runPromise(
      searchDeezerPreview(source.title, source.leadArtist).pipe(
        Effect.catch(() => Effect.succeed(null))
      )
    )
    return { url }
  },
})

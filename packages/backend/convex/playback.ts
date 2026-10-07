import { ConvexError, v } from "convex/values"
import { Effect } from "effect"

import { internal } from "./_generated/api"
import { action, internalQuery } from "./_generated/server"
import { fetchDeezerPreview } from "./songs/_lib/deezer"

export const ownedSongSource = internalQuery({
  args: { collectorKey: v.string(), songId: v.id("songs") },
  handler: async (ctx, { collectorKey, songId }) => {
    const owned = await ctx.db
      .query("ownedSongs")
      .withIndex("by_collectorId_and_songId", (q) =>
        q.eq("collectorId", collectorKey).eq("songId", songId)
      )
      .unique()
    if (!owned) {
      return null
    }

    const song = await ctx.db.get("songs", songId)
    if (!song) {
      return null
    }

    const versions = song.isrc
      ? []
      : await ctx.db
          .query("songVersions")
          .withIndex("by_songId", (q) => q.eq("songId", songId))
          .take(10)

    return {
      previewUrl: song.previewUrl,
      isrc: song.isrc ?? versions.find((version) => version.isrc)?.isrc,
    }
  },
})

export const preview = action({
  args: { collectorKey: v.string(), songId: v.id("songs") },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const source = await ctx.runQuery(internal.playback.ownedSongSource, args)
    if (!source) {
      throw new ConvexError("Collect this song to play it.")
    }

    if (source.previewUrl) {
      return { url: source.previewUrl }
    }

    if (!source.isrc) {
      return { url: null }
    }

    const url = await Effect.runPromise(
      fetchDeezerPreview(source.isrc).pipe(
        Effect.catch(() => Effect.succeed(null))
      )
    )
    return { url }
  },
})

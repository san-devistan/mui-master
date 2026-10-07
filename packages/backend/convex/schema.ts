import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import { songRarity } from "./songs/_lib/validators"

export default defineSchema({
  songs: defineTable({
    songKey: v.string(),
    sourceId: v.string(),
    title: v.string(),
    artistNames: v.array(v.string()),
    imageUrl: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    isrc: v.optional(v.string()),
    spotifyStreams: v.number(),
    rarity: songRarity,
    randomKey: v.number(),
    syncedAt: v.number(),
  })
    .index("by_songKey", ["songKey"])
    .index("by_spotifyStreams", ["spotifyStreams"])
    .index("by_rarity_and_randomKey", ["rarity", "randomKey"]),
  songVersions: defineTable({
    sourceId: v.string(),
    songId: v.id("songs"),
    title: v.string(),
    isrc: v.optional(v.string()),
    spotifyStreams: v.number(),
  })
    .index("by_sourceId", ["sourceId"])
    .index("by_songId", ["songId"]),
  albums: defineTable({
    sourceId: v.string(),
    name: v.string(),
    albumType: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    artistNames: v.array(v.string()),
  }).index("by_sourceId", ["sourceId"]),
  songAlbums: defineTable({
    songId: v.id("songs"),
    albumId: v.id("albums"),
  })
    .index("by_songId_and_albumId", ["songId", "albumId"])
    .index("by_albumId", ["albumId"]),
  rarityCounters: defineTable({
    rarity: songRarity,
    count: v.number(),
  }).index("by_rarity", ["rarity"]),
  songImports: defineTable({
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    nextOffset: v.number(),
    lastHitOffset: v.number(),
    scanned: v.number(),
    imported: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  collectors: defineTable({
    collectorId: v.string(),
    packsOpened: v.number(),
    uniqueSongs: v.optional(v.number()),
  }).index("by_collectorId", ["collectorId"]),
  ownedSongs: defineTable({
    collectorId: v.string(),
    songId: v.id("songs"),
    copies: v.number(),
  })
    .index("by_collectorId", ["collectorId"])
    .index("by_collectorId_and_songId", ["collectorId", "songId"]),
})

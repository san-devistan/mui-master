import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import {
  albumDetails,
  artistDetails,
  songDetails,
  songRarity,
} from "./songs/_lib/validators"

export default defineSchema({
  songs: defineTable({
    songKey: v.string(),
    sourceId: v.string(),
    title: v.string(),
    artistNames: v.array(v.string()),
    // Credited artists in order, lead first (same order as artistNames). Filled by imports and the artist backfill.
    artistIds: v.optional(v.array(v.id("artists"))),
    imageUrl: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    isrc: v.optional(v.string()),
    spotifyStreams: v.number(),
    rarity: v.optional(songRarity),
    bpm: v.optional(v.number()),
    // Earliest known release of the recording (YYYY, YYYY-MM or YYYY-MM-DD).
    releaseDate: v.optional(v.string()),
    // Web check (scripts/web-release-dates.mjs): false = not checked yet, true = releaseDate confirmed,
    // null = no date found, to check by hand.
    reviewed: v.union(v.boolean(), v.null()),
    // Release date found by the web check (YYYY-MM-DD).
    webDate: v.optional(v.string()),
    details: v.optional(songDetails),
    randomKey: v.number(),
    syncedAt: v.number(),
  })
    .index("by_songKey", ["songKey"])
    .index("by_spotifyStreams", ["spotifyStreams"])
    .index("by_rarity_and_randomKey", ["rarity", "randomKey"])
    .index("by_reviewed_and_spotifyStreams", ["reviewed", "spotifyStreams"]),
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
    artistIds: v.optional(v.array(v.id("artists"))),
    // Set by the enrichment backfill (enrichment.ts); missing until then.
    details: v.optional(albumDetails),
    enrichedAt: v.optional(v.number()),
  })
    .index("by_sourceId", ["sourceId"])
    .index("by_enrichedAt", ["enrichedAt"]),
  artists: defineTable({
    sourceId: v.string(),
    name: v.string(),
    // Set by the enrichment backfill (enrichment.ts); missing until then.
    details: v.optional(artistDetails),
    enrichedAt: v.optional(v.number()),
  })
    .index("by_sourceId", ["sourceId"])
    .index("by_enrichedAt", ["enrichedAt"]),
  songArtists: defineTable({
    songId: v.id("songs"),
    artistId: v.id("artists"),
    // 0 = lead artist.
    position: v.number(),
  })
    .index("by_songId_and_artistId", ["songId", "artistId"])
    .index("by_artistId", ["artistId"]),
  enrichmentRuns: defineTable({
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    phase: v.union(
      v.literal("tracks"),
      v.literal("artists"),
      v.literal("albums")
    ),
    cursor: v.union(v.string(), v.null()),
    keyIndex: v.number(),
    processed: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
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
    bpm: v.optional(v.number()),
    bpmStep: v.optional(v.number()),
    toBpm: v.optional(v.number()),
    keyIndex: v.optional(v.number()),
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

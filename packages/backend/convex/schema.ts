import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import { cardRarity } from "./songs/_lib/validators"

const tierCounts = v.object({ songs: v.number(), artists: v.number() })

// Platform ids; deezer is null until a Deezer match is found.
const ids = v.object({
  spotify: v.string(),
  deezer: v.union(v.string(), v.null()),
})

export default defineSchema({
  // Songs with 100M+ Spotify streams, imported by scripts/import-songs.mjs.
  songs: defineTable({
    name: v.string(),
    // isrc identifies the recording across platforms. duplicates: Spotify ids of other releases
    // of the same recording (same ISRC), merged into this song so the import skips them.
    ids: v.object({
      ...ids.fields,
      isrc: v.string(),
      duplicates: v.array(v.string()),
    }),
    // Credited artists, lead first.
    artistIds: v.array(v.id("artists")),
    // Spotify streams.
    playcount: v.number(),
    // Card rarity from playcount (songs/_lib/rarity.ts); it only ever rises.
    rarity: cardRarity,
    // A random number in [0, 1), so a pack draws a random card of a rarity with one index read
    // (see packs.ts).
    drawKey: v.number(),
    // Album cover URL.
    image: v.string(),
    // 30 s Spotify preview URL.
    preview: v.union(v.string(), v.null()),
    metadata: v.object({
      // BPM; random (50-200) when Spotify has no analysis for the song.
      tempo: v.number(),
      durationMs: v.number(),
      explicit: v.boolean(),
      // Year of the Spotify release the track sits on.
      releaseYear: v.number(),
      // Same release: "YYYY-MM-DD", or "YYYY" when Spotify only has the year.
      releaseDate: v.string(),
    }),
  })
    .index("by_spotifyId", ["ids.spotify"])
    .index("by_isrc", ["ids.isrc"])
    .index("by_playcount", ["playcount"])
    .index("by_rarity", ["rarity"])
    .index("by_rarity_and_drawKey", ["rarity", "drawKey"]),
  artists: defineTable({
    name: v.string(),
    ids,
    // Profile picture URL.
    image: v.string(),
    monthlyListeners: v.number(),
    // Sum of the playcounts of the catalog songs crediting the artist (lead or featured), and the
    // card rarity it gives, which only ever rises. Set by catalog:updateRarities.
    playcount: v.number(),
    rarity: cardRarity,
    // Their most played catalog song, whose preview the artist card plays. Set with playcount by
    // catalog:updateRarities, so unset on a new artist until the end of its import run.
    topSongId: v.optional(v.id("songs")),
    // Same as songs.drawKey.
    drawKey: v.number(),
  })
    .index("by_spotifyId", ["ids.spotify"])
    .index("by_rarity", ["rarity"])
    .index("by_rarity_and_drawKey", ["rarity", "drawKey"]),
  // One row: the catalog's size, kept by catalog:updateRarities, for the collection count; and
  // how many songs and artists hold each rarity, so a pack picks a song or an artist in proportion.
  catalogStats: defineTable({
    songs: v.number(),
    artists: v.number(),
    byRarity: v.object({
      common: tierCounts,
      rare: tierCounts,
      epic: tierCounts,
      legendary: tierCounts,
    }),
  }),
  // The player's collection: one row per card they own. A card is a song or an artist, so its id
  // is kept as a string; `playerId` is the Better Auth user id.
  collection: defineTable({
    playerId: v.string(),
    cardId: v.string(),
    copies: v.number(),
    // When it was first pulled, in ms.
    pulledAt: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_playerId_and_cardId", ["playerId", "cardId"]),
  // The pack waiting for each player, drawn ahead so its cards are ready once it's cut open; it's
  // the same pack until they open it (packs:claim), whatever reloads or double draws happen.
  pendingPacks: defineTable({
    playerId: v.string(),
    cardIds: v.array(v.string()),
  }).index("by_playerId", ["playerId"]),
})

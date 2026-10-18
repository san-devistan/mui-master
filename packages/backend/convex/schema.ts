import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import { cardKind, cardRarity } from "./songs/_lib/validators"

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
    // The rarity the player last saw the card at. Below the card's current rarity, it went up in
    // a catalog refresh and the app plays its upgrade (packs:upgrades); unset counts as seen.
    seenRarity: v.optional(cardRarity),
    // What the collection is filtered and sorted by, copied from the card so a page of it is one
    // index read (packs:collection): its kind, its seen rarity as 0 (common) to 3 (legendary),
    // its title lowercased without accents or punctuation, and its streams when last seen.
    kind: v.optional(cardKind),
    rarityRank: v.optional(v.number()),
    titleKey: v.optional(v.string()),
    streams: v.optional(v.number()),
    // The card's title and, for a song, its artists' names, for the collection search
    // (collection:search).
    searchText: v.optional(v.string()),
  })
    .searchIndex("search_searchText", {
      searchField: "searchText",
      filterFields: ["playerId", "kind", "rarityRank"],
    })
    .index("by_playerId_and_cardId", ["playerId", "cardId"])
    // One index per filter (kind, rarity, both or neither) and sort (recent, rarest, A–Z).
    .index("by_playerId_and_pulledAt", ["playerId", "pulledAt"])
    .index("by_playerId_and_kind_and_pulledAt", [
      "playerId",
      "kind",
      "pulledAt",
    ])
    .index("by_playerId_and_rarityRank_and_pulledAt", [
      "playerId",
      "rarityRank",
      "pulledAt",
    ])
    .index("by_playerId_and_kind_and_rarityRank_and_pulledAt", [
      "playerId",
      "kind",
      "rarityRank",
      "pulledAt",
    ])
    .index("by_playerId_and_rarityRank_and_streams", [
      "playerId",
      "rarityRank",
      "streams",
    ])
    .index("by_playerId_and_kind_and_rarityRank_and_streams", [
      "playerId",
      "kind",
      "rarityRank",
      "streams",
    ])
    .index("by_playerId_and_titleKey", ["playerId", "titleKey"])
    .index("by_playerId_and_kind_and_titleKey", [
      "playerId",
      "kind",
      "titleKey",
    ])
    .index("by_playerId_and_rarityRank_and_titleKey", [
      "playerId",
      "rarityRank",
      "titleKey",
    ])
    .index("by_playerId_and_kind_and_rarityRank_and_titleKey", [
      "playerId",
      "kind",
      "rarityRank",
      "titleKey",
    ]),
  // Each player's tallies: how many different cards they own (packs.ts), their coins, and the
  // time their free packs count from, one per 8 hours (wallet.ts). Game state is keyed by the
  // Better Auth user id rather than kept in its component, so a guest's progress can move to an
  // account they link later.
  players: defineTable({
    playerId: v.string(),
    cards: v.number(),
    coins: v.number(),
    freePacksSince: v.number(),
    // Pro until then (ms); unset or past, the free game. Paid monthly; no checkout yet, so for
    // now only the dev switch sets it (wallet:setPro).
    proUntil: v.optional(v.number()),
    // When Pro's daily holos were last given (wallet:claimDaily).
    dailyHolosAt: v.optional(v.number()),
    // Up to 6 card ids the player shows on their profile, in order (profile.ts).
    showcase: v.optional(v.array(v.string())),
  }).index("by_playerId", ["playerId"]),
  // The pack waiting for each player, drawn ahead so its cards are ready once it's cut open; it's
  // the same pack until they open it (packs:claim), whatever reloads or double draws happen.
  pendingPacks: defineTable({
    playerId: v.string(),
    cardIds: v.array(v.string()),
  }).index("by_playerId", ["playerId"]),
  // A card copy up for auction: out of the seller's collection until it sells (to the top
  // bidder) or comes back (no bid, or cancelled before any). The top bid's coins are held off
  // the bidder's balance and given back when outbid. Settled by market:settle at `endsAt`.
  auctions: defineTable({
    sellerId: v.string(),
    cardId: v.string(),
    // Copied from the card, for the rarity filter.
    rarity: cardRarity,
    startPrice: v.number(),
    topBid: v.optional(v.number()),
    topBidderId: v.optional(v.string()),
    endsAt: v.number(),
    // The card's title and, for a song, its artists' names, for the market search.
    // shortcut: unset on auctions listed before the search, which don't show in it; they're all
    // over within a day, so no backfill.
    searchText: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("sold"),
      v.literal("unsold"),
      v.literal("cancelled")
    ),
  })
    .searchIndex("search_searchText", {
      searchField: "searchText",
      filterFields: ["status", "rarity", "topBidderId"],
    })
    .index("by_status_and_endsAt", ["status", "endsAt"])
    .index("by_status_and_rarity_and_endsAt", ["status", "rarity", "endsAt"])
    .index("by_sellerId_and_status_and_endsAt", [
      "sellerId",
      "status",
      "endsAt",
    ])
    .index("by_topBidderId_and_status_and_endsAt", [
      "topBidderId",
      "status",
      "endsAt",
    ])
    // A player's won auctions ("sold" to them), newest first, of one rarity or all.
    .index("by_topBidderId_and_status_and_rarity_and_endsAt", [
      "topBidderId",
      "status",
      "rarity",
      "endsAt",
    ]),
  // Every bid made on an auction, newest last, for its history (market:auction) and the auctions
  // a player has bid on (market:auctions). Coins move on `auctions` itself; this only records who
  // bid what and when.
  bids: defineTable({
    auctionId: v.id("auctions"),
    bidderId: v.string(),
    amount: v.number(),
  })
    .index("by_auctionId", ["auctionId"])
    .index("by_bidderId", ["bidderId"]),
  // One row per artist credited on a song, so an artist's songs (and through them, who they've
  // worked with) are one index read; kept with songs.artistIds by catalog:save. `playcount` is the
  // song's, so an artist's songs come most played first.
  credits: defineTable({
    songId: v.id("songs"),
    artistId: v.id("artists"),
    playcount: v.number(),
  })
    .index("by_songId", ["songId"])
    .index("by_artistId_and_playcount", ["artistId", "playcount"]),
})

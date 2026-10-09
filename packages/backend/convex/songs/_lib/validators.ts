import { v, type Infer } from "convex/values"

export const songRarity = v.union(
  v.literal("common"),
  v.literal("rare"),
  v.literal("epic"),
  v.literal("legendary")
)

export const importedAlbum = v.object({
  sourceId: v.string(),
  name: v.string(),
  albumType: v.optional(v.string()),
  releaseDate: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  artistNames: v.array(v.string()),
  // Audiometa artist IDs, same order as artistNames.
  artistIds: v.array(v.string()),
})

export const importedArtist = v.object({
  sourceId: v.string(),
  name: v.string(),
})

// Full artist from /artists: genres, bio, socials. Stored in artists.details.
export const artistDetails = v.object({
  imageUrl: v.optional(v.string()),
  popularity: v.optional(v.number()),
  genres: v.array(v.string()),
  countryCode: v.optional(v.string()),
  bio: v.optional(v.string()),
  spotifyUrl: v.optional(v.string()),
  followers: v.optional(v.number()),
  monthlyListeners: v.optional(v.number()),
  youtubeSubscribers: v.optional(v.number()),
  instagramFollowers: v.optional(v.number()),
  tiktokFollowers: v.optional(v.number()),
})

// Full album from /albums. Stored in albums.details.
export const albumDetails = v.object({
  releaseDatePrecision: v.optional(v.string()),
  totalTracks: v.optional(v.number()),
  label: v.optional(v.string()),
  upc: v.optional(v.string()),
  popularity: v.optional(v.number()),
  spotifyUrl: v.optional(v.string()),
})

export const songDetails = v.object({
  youtubePlays: v.optional(v.number()),
  soundcloudPlays: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  explicit: v.optional(v.boolean()),
  popularity: v.optional(v.number()),
  discNumber: v.optional(v.number()),
  trackNumber: v.optional(v.number()),
  musicalKey: v.optional(v.number()),
  mode: v.optional(v.number()),
  energy: v.optional(v.number()),
  danceability: v.optional(v.number()),
  valence: v.optional(v.number()),
  loudness: v.optional(v.number()),
  timeSignature: v.optional(v.number()),
  externalUrls: v.optional(v.record(v.string(), v.string())),
})

export const importedSong = v.object({
  sourceId: v.string(),
  title: v.string(),
  artistIds: v.array(v.string()),
  artistNames: v.array(v.string()),
  imageUrl: v.optional(v.string()),
  previewUrl: v.optional(v.string()),
  isrc: v.optional(v.string()),
  spotifyStreams: v.number(),
  bpm: v.optional(v.number()),
  details: v.optional(songDetails),
  album: v.optional(importedAlbum),
})

export type SongRarity = Infer<typeof songRarity>
export type ImportedSong = Infer<typeof importedSong>
export type ImportedArtist = Infer<typeof importedArtist>
export type ArtistDetails = Infer<typeof artistDetails>
export type AlbumDetails = Infer<typeof albumDetails>

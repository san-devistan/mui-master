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
  album: v.optional(importedAlbum),
})

export type SongRarity = Infer<typeof songRarity>
export type ImportedSong = Infer<typeof importedSong>

import { v, type Infer } from "convex/values"

export const cardRarity = v.union(
  v.literal("common"),
  v.literal("rare"),
  v.literal("epic"),
  v.literal("legendary")
)

export type CardRarity = Infer<typeof cardRarity>

export const cardKind = v.union(v.literal("song"), v.literal("artist"))

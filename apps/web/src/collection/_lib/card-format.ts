import type { api } from "@workspace/backend/api"
import type { FunctionReturnType } from "convex/server"

export type SongCard = FunctionReturnType<
  typeof api.collection.list
>["page"][number]

export type PulledCard = FunctionReturnType<
  typeof api.collection.openPack
>[number]

export type CollectionFilter = "all" | "owned"

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 2,
})

const fullNumber = new Intl.NumberFormat("en")

export function formatStreams(streams: number) {
  return compactNumber.format(streams)
}

export function formatFullStreams(streams: number) {
  return `${fullNumber.format(streams)} Spotify streams`
}

export function formatArtists(artistNames: ReadonlyArray<string>) {
  return artistNames.join(", ")
}

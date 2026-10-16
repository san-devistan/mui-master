import { toGameCard, type GameCard } from "@/game/_lib/cards"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { useMemo } from "react"

// A card the player owns: its details, copies and first pull, all from the backend.
export type CollectedSong = GameCard & { copies: number; pulledAt: number }

// The signed-in player's cards, in a stable order so the WebGL thumbs keep their slots; null
// while loading. The same objects until the data changes, so thumbs don't remount every render.
export function useCollectedCards() {
  const { data } = useQuery(convexQuery(api.packs.collection, {}))
  return useMemo(
    () => data?.map((card): CollectedSong => toGameCard(card)) ?? null,
    [data]
  )
}

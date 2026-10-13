import { toGameCard, type GameCard } from "@/game/_lib/cards"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"

// A card the player owns: its details, copies and first pull, all from the backend.
export type CollectedSong = GameCard & { copies: number; pulledAt: number }

// The signed-in player's cards, in a stable order so the WebGL thumbs keep their slots; null
// while loading.
export function useCollectedCards() {
  const { data } = useQuery(convexQuery(api.packs.collection, {}))
  return data?.map((card): CollectedSong => toGameCard(card)) ?? null
}

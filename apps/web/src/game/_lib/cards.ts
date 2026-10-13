import type { api } from "@workspace/backend/api"
import type { GameSong } from "@workspace/ui/lib/game/theme"
import type { FunctionReturnType } from "convex/server"

// A card as the backend sends it: a song or an artist (see convex/packs.ts).
export type BackendCard = Omit<
  FunctionReturnType<typeof api.packs.open>[number],
  "isNew"
>

// What the card components draw, plus the backend's facts for the showcase.
export type GameCard = GameSong & BackendCard

// Keeps whatever else the backend sent with it (copies, isNew).
export const toGameCard = <Card extends BackendCard>(card: Card) => ({
  ...card,
  artist: card.subtitle,
})

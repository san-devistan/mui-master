import { RARITY_ORDER, type Rarity } from "@workspace/ui/lib/game/theme"

// A card grid's rarity filter: one rarity, or all.
export type RarityFilter = "all" | Rarity
export const RARITY_FILTERS: ReadonlyArray<RarityFilter> = [
  "all",
  ...RARITY_ORDER,
]

// The backend's rarity argument for a filter: none for all.
export const rarityArg = (filter: RarityFilter) =>
  filter === "all" ? {} : { rarity: filter }

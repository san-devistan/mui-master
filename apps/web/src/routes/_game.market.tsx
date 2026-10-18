import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_game/market")({
  // `scope`: which auctions to show on arrival, e.g. the player's own after putting a card up.
  validateSearch: (
    search: Record<string, unknown>
  ): { scope?: "live" | "mine" | "bids" | "won" } =>
    search.scope === "live" ||
    search.scope === "mine" ||
    search.scope === "bids" ||
    search.scope === "won"
      ? { scope: search.scope }
      : {},
  // The page is kept mounted by GameLayout, so it keeps its scroll and cards across tabs.
  component: () => null,
})

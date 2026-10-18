import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_game/collection")({
  // `added`: ids of cards just pulled that the player didn't have, newest
  // first. They wear a NEW badge until the player opens them or leaves the page.
  validateSearch: (
    search: Record<string, unknown>
  ): { added?: Array<string> } =>
    Array.isArray(search.added)
      ? {
          added: search.added.filter(
            (id): id is string => typeof id === "string"
          ),
        }
      : {},
  // The page is kept mounted by GameLayout, so it keeps its scroll and cards across tabs.
  component: () => null,
})

import { OddsPage } from "@/legal/odds-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/odds")({
  head: () => ({
    meta: [
      { title: "Pack odds · Holotrack" },
      {
        name: "description",
        content:
          "The odds of every Holotrack pack, card by card: commons, rares, epics, legendaries and god packs.",
      },
    ],
    links: [{ rel: "canonical", href: "https://holotrack.art/odds" }],
  }),
  component: OddsPage,
})

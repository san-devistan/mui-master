import { PrivacyPage } from "@/legal/privacy-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy · Holotrack" },
      {
        name: "description",
        content:
          "What Holotrack collects when you play, why, who helps run the game, and how to get your data deleted.",
      },
    ],
    links: [{ rel: "canonical", href: "https://holotrack.art/privacy" }],
  }),
  component: PrivacyPage,
})

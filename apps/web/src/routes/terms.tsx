import { TermsPage } from "@/legal/terms-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of use · Holotrack" },
      {
        name: "description",
        content:
          "The rules of Holotrack: accounts, cards and holos, purchases and Holotrack Pro.",
      },
    ],
    links: [{ rel: "canonical", href: "https://holotrack.art/terms" }],
  }),
  component: TermsPage,
})

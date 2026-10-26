import { createFileRoute } from "@tanstack/react-router"

type PlaySearch = { checkout?: "done" | "cancelled"; welcome?: true }

// The Packs page is kept mounted by GameLayout, so its 3D pack stays put across tabs.
export const Route = createFileRoute("/_game/play")({
  // `checkout`: back from Stripe's checkout (billing:checkout), paid or not. `welcome`: a new
  // account, just named, offered notifications (NotificationsPrompt).
  validateSearch: (search: Record<string, unknown>): PlaySearch => ({
    ...(search.checkout === "done" || search.checkout === "cancelled"
      ? { checkout: search.checkout }
      : {}),
    ...(search.welcome === true || search.welcome === "true"
      ? { welcome: true }
      : {}),
  }),
  component: () => null,
})

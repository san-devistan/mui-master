import { createFileRoute } from "@tanstack/react-router"

// The Packs page is kept mounted by GameLayout, so its 3D pack stays put across tabs.
export const Route = createFileRoute("/_game/play")({
  // `checkout`: back from Stripe's checkout (billing:checkout), paid or not.
  validateSearch: (
    search: Record<string, unknown>
  ): { checkout?: "done" | "cancelled" } =>
    search.checkout === "done" || search.checkout === "cancelled"
      ? { checkout: search.checkout }
      : {},
  component: () => null,
})

import { createFileRoute } from "@tanstack/react-router"

// The Packs page is kept mounted by GameLayout, so its 3D pack stays put across tabs.
export const Route = createFileRoute("/_game/play")({ component: () => null })

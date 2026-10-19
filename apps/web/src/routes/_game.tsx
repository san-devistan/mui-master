import { GameLayout } from "@/game/_components/game-layout"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_game")({
  // WebGL, WebGPU and Web Audio are browser-only.
  ssr: false,
  // The game's screens are per player; the landing page is what search should show.
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: GameLayout,
})

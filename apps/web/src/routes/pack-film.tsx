import { SHOWCASE, SHOWCASE_COVERS } from "@/landing/showcase-pack"
import { createFileRoute } from "@tanstack/react-router"
import { ScrollPack, type PackStep } from "@workspace/ui/components/scroll-pack"
import { useEffect, useState } from "react"

declare global {
  interface Window {
    // Called by scripts/record-pack-film.mjs, frame by frame.
    packFilmStep?: (step: PackStep) => void
  }
}

// The landing's pack opening alone on a phone-high stage, for
// scripts/record-pack-film.mjs to step and film. Not linked anywhere.
export const Route = createFileRoute("/pack-film")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: PackFilmStage,
})

function PackFilmStage() {
  const [step, setStep] = useState<PackStep>({
    phase: "idle",
    cut: 0,
    index: 0,
  })
  useEffect(() => {
    window.packFilmStep = setStep
    return () => {
      delete window.packFilmStep
    }
  }, [])
  return (
    <main className="h-dvh w-screen overflow-hidden game-backdrop">
      <ScrollPack cards={SHOWCASE} covers={SHOWCASE_COVERS} step={step} />
    </main>
  )
}

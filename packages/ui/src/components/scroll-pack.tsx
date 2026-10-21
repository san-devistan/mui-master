"use client"

import { Celebration } from "@workspace/ui/components/celebration"
import { CutSlash, useCutSlash } from "@workspace/ui/components/cut-slash"
import { GameMotes } from "@workspace/ui/components/game-motes"
import { PackGlow } from "@workspace/ui/components/pack-glow"
import {
  glowHold,
  mountOpeningScene,
  type OpeningPhase,
} from "@workspace/ui/lib/game/opening-scene"
import type { Celebrated } from "@workspace/ui/lib/game/reveal-motion"
import type { GameSong } from "@workspace/ui/lib/game/theme"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useEffectEvent, useRef } from "react"

// Where a stepped opening is: the pack's phase, how far along the seam the cut
// has run (0..1), the card on top of the pile once it's open, and how far it's
// dragged aside, in stage widths (negative to the left), as by a finger about
// to swipe it.
export type PackStep = {
  phase: OpeningPhase
  cut: number
  index: number
  drag?: number
}

const celebrated = (rarity: string | undefined): rarity is Celebrated =>
  rarity === "epic" || rarity === "legendary"

// The game's pack opening (opening-scene), stepped forwards by the caller
// instead of a finger, e.g. to record the landing's film of it: the katana
// slice and a legendary's light on the cut, and each epic or legendary card's
// celebration as it comes on top. Silent.
function ScrollPack({
  cards,
  covers,
  step,
  className,
}: {
  cards: ReadonlyArray<GameSong & { isNew?: boolean }>
  covers: ReadonlyArray<string>
  step: PackStep
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<ReturnType<typeof mountOpeningScene> | null>(null)
  // The step the scene shows, to diff the next one against.
  const shownRef = useRef<PackStep>({ phase: "idle", cut: 0, index: 0 })
  const { slash, stage, guide, finish } = useCutSlash()
  const legendary = glowHold(cards) > 0

  // While the pack drops away the pile ignores `show`: once it's out, catch up
  // with however far the caller stepped meanwhile.
  const opened = useEffectEvent(() => {
    const shown = shownRef.current
    if (shown.phase === "open") sceneRef.current?.show(shown.index, -1)
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const scene = mountOpeningScene(canvas, cards, covers, opened, {
      entrance: false,
    })
    sceneRef.current = scene
    shownRef.current = { phase: "idle", cut: 0, index: 0 }
    return () => {
      sceneRef.current = null
      scene.dispose()
    }
  }, [cards, covers])

  const reveal = useEffectEvent((index: number) => {
    sceneRef.current?.show(index, -1)
    const rarity = cards[index]?.rarity
    if (celebrated(rarity)) sceneRef.current?.celebrate(index, rarity)
  })

  const cutThrough = useEffectEvent(() => finish())

  const { phase, cut, index, drag = 0 } = step
  const rarity = phase === "open" ? cards[index]?.rarity : undefined
  useEffect(() => sceneRef.current?.drag(drag), [drag])
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const shown = shownRef.current
    if (phase !== shown.phase) {
      scene.setPhase(phase)
      if (phase === "open") cutThrough()
    }
    scene.setCut(cut)
    const opening = phase === "open" && shown.phase !== "open"
    if (phase === "open" && (opening || index !== shown.index)) reveal(index)
    shownRef.current = { phase, cut, index }
  }, [phase, cut, index])

  return (
    <div
      ref={stage}
      data-slot="pack-opening"
      data-phase={phase}
      className={cn("game-studio size-full", className)}
    >
      <GameMotes />
      {phase === "open" && legendary ? <PackGlow /> : null}
      <canvas ref={canvasRef} className="game-canvas z-10" aria-hidden="true" />
      {/* Where the seam is, for the slice to run straight along it. */}
      <div
        ref={guide}
        className="game-cut-guide h-14 pointer-events-none absolute"
        aria-hidden="true"
      />
      {phase === "open" && slash ? <CutSlash slash={slash} /> : null}
      {/* Keyed by card, so it plays on each one it lands on. */}
      {celebrated(rarity) ? (
        <Celebration key={cards[index]?.id} rarity={rarity} />
      ) : null}
    </div>
  )
}

export { ScrollPack }

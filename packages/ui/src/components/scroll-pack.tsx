"use client"

import { Celebration } from "@workspace/ui/components/celebration"
import { GameMotes } from "@workspace/ui/components/game-motes"
import {
  mountOpeningScene,
  type OpeningPhase,
} from "@workspace/ui/lib/game/opening-scene"
import type { Celebrated } from "@workspace/ui/lib/game/reveal-motion"
import { play, type Cue } from "@workspace/ui/lib/game/sfx"
import type { GameSong } from "@workspace/ui/lib/game/theme"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useEffectEvent, useRef } from "react"

// Where a scroll-driven opening is: the pack's phase, how far along the seam
// the cut has run (0..1), and the card on top of the pile once it's open.
export type PackStep = { phase: OpeningPhase; cut: number; index: number }

// Epic and legendary cards celebrate the first time they come on top.
const celebrated = (rarity: string | undefined): rarity is Celebrated =>
  rarity === "epic" || rarity === "legendary"

// The game's pack opening (opening-scene), stepped by the caller instead of a
// finger: a landing page scrolling through it, say. Plays the game's cues when
// `sound` is on, and each epic or legendary card's celebration the first time
// it comes on top.
function ScrollPack({
  cards,
  covers,
  step,
  sound = false,
  className,
}: {
  cards: ReadonlyArray<GameSong & { isNew?: boolean }>
  covers: ReadonlyArray<string>
  step: PackStep
  sound?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<ReturnType<typeof mountOpeningScene> | null>(null)
  // The step the scene shows, to diff the next one against.
  const shownRef = useRef<PackStep>({ phase: "idle", cut: 0, index: 0 })
  const seenRef = useRef(new Set<number>())

  const cue = useEffectEvent((name: Cue) => {
    if (sound) play(name)
  })

  // While the pack drops away the pile ignores `show`: once it's out, catch up
  // with however far the caller stepped meanwhile.
  const opened = useEffectEvent(() => {
    const shown = shownRef.current
    if (shown.phase === "open") sceneRef.current?.show(shown.index, -1)
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const scene = mountOpeningScene(canvas, cards, covers, opened)
    sceneRef.current = scene
    shownRef.current = { phase: "idle", cut: 0, index: 0 }
    seenRef.current.clear()
    return () => {
      sceneRef.current = null
      scene.dispose()
    }
  }, [cards, covers])

  const reveal = useEffectEvent((index: number, swiped: boolean) => {
    sceneRef.current?.show(index, index > shownRef.current.index ? -1 : 1)
    if (swiped) cue("swipe")
    const rarity = cards[index]?.rarity
    if (rarity) cue(rarity)
    if (celebrated(rarity) && !seenRef.current.has(index)) {
      seenRef.current.add(index)
      sceneRef.current?.celebrate(index, rarity)
    }
  })

  const { phase, cut, index } = step
  const rarity = phase === "open" ? cards[index]?.rarity : undefined
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const shown = shownRef.current
    if (phase !== shown.phase) {
      // Stepped back from the open pack: a fresh, sealed one, so it can open
      // again with its celebrations.
      if (shown.phase === "open") {
        seenRef.current.clear()
        scene.setPhase("idle")
      }
      scene.setPhase(phase)
      if (phase === "cut") cue("press")
      if (phase === "open") {
        cue("rip")
        cue("open")
      }
    }
    scene.setCut(cut)
    const opening = phase === "open" && shown.phase !== "open"
    if (phase === "open" && (opening || index !== shown.index)) {
      reveal(index, shown.phase === "open")
    }
    shownRef.current = { phase, cut, index }
  }, [phase, cut, index])

  return (
    <div
      data-slot="pack-opening"
      data-phase={phase}
      className={cn("game-studio size-full", className)}
    >
      <GameMotes />
      <canvas ref={canvasRef} className="game-canvas z-10" aria-hidden="true" />
      {/* Keyed by card, so it plays on each one it lands on. */}
      {celebrated(rarity) ? (
        <Celebration key={cards[index]?.id} rarity={rarity} />
      ) : null}
    </div>
  )
}

export { ScrollPack }

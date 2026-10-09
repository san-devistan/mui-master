"use client"

import { Celebration } from "@workspace/ui/components/celebration"
import { useReveal } from "@workspace/ui/hooks/use-reveal"
import {
  CUT_LINE,
  mountOpeningScene,
  type OpeningPhase,
  type OpeningScene,
} from "@workspace/ui/lib/game/opening-scene"
import { play, sfx } from "@workspace/ui/lib/game/sfx"
import type { CssVars, GameSong } from "@workspace/ui/lib/game/theme"
import { cn } from "@workspace/ui/lib/utils"
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react"

const CUT_DONE = 0.7
const SWIPE = 0.4
const MOTES = Array.from({ length: 10 }, (_, mote) => {
  const vars: CssVars = {
    "--mote-x": `${8 + ((mote * 37) % 84)}%`,
    "--mote-y": `${6 + ((mote * 23) % 36)}%`,
    "--mote-delay": `${-(mote * 0.73) % 4}s`,
    "--mote-size": `${3 + (mote % 3)}px`,
  }
  return { id: `mote-${String(mote)}`, vars }
})
const CUT_VARS: CssVars = {
  "--cut-top": `${CUT_LINE.top * 100}%`,
  "--cut-width": `${CUT_LINE.width * 100}%`,
}

type Phase = OpeningPhase | "cards"
export type PackPull = GameSong & { isNew?: boolean }

type PackOpeningProps = {
  pulls: ReadonlyArray<PackPull>
  covers: ReadonlyArray<string>
  onDone: () => void
  // True once the pack is tapped open.
  onOpenChange?: (open: boolean) => void
  className?: string
}

// The waiting pack, its cut, and the reveal of its cards, on one canvas.
function PackOpening({
  pulls,
  covers,
  onDone,
  onOpenChange,
  className,
}: PackOpeningProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<OpeningScene | null>(null)
  const dragRef = useRef<{ x: number; left: number; width: number } | null>(
    null
  )
  // Where a press on the waiting pack started, so dragging it round to turn
  // it doesn't also open it.
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [index, setIndex] = useState(0)
  const { party, reveal, reset } = useReveal(pulls, sceneRef)
  const pullKey = pulls.map((pull) => pull.id).join("|")
  const coverKey = covers.join("|")

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    reset()
    setPhase("idle")
    setIndex(0)
    const scene = mountOpeningScene(canvas, pulls, coverKey.split("|"), () => {
      setPhase("cards")
      setIndex(0)
      reveal(0)
    })
    sceneRef.current = scene
    return () => {
      sceneRef.current = null
      scene.dispose()
    }
    // pullKey is the stable identity of pulls.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [coverKey, pullKey, reset, reveal])

  function enter(next: Phase) {
    setPhase(next)
    if (next !== "cards") sceneRef.current?.setPhase(next)
  }

  function openPack(event: MouseEvent<HTMLButtonElement>) {
    const press = pressRef.current
    pressRef.current = null
    if (
      press &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8
    )
      return
    void sfx.unlock()
    play("press")
    enter("cut")
    onOpenChange?.(true)
  }

  function cutOpen() {
    dragRef.current = null
    sceneRef.current?.setCut(1)
    play("swipe")
    setTimeout(() => play("open"), 350)
    enter("open")
  }

  function cancelCut() {
    dragRef.current = null
    sceneRef.current?.setCut(0)
  }

  function grab(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const { left, width } = event.currentTarget.getBoundingClientRect()
    dragRef.current = { x: event.clientX, left, width }
  }

  function cutAlong(event: PointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start) return
    const done = Math.max(0, (event.clientX - start.x) / start.width)
    // The cut follows the finger itself along the seam.
    const under = (event.clientX - start.left) / start.width
    sceneRef.current?.setCut(Math.min(Math.max(under, 0), 0.99))
    if (done >= CUT_DONE) cutOpen()
  }

  function show(next: number, side = -1) {
    if (!pulls[next]) return
    setIndex(next)
    sceneRef.current?.show(next, side)
    play("swipe")
    setTimeout(() => reveal(next), 200)
  }

  // The last card flies off like the others, then the pack is done. Moving
  // past the last index also ignores any further swipes meanwhile.
  function leave(side = -1) {
    setIndex(pulls.length)
    sceneRef.current?.show(pulls.length, side)
    play("swipe")
    setTimeout(onDone, 450)
  }

  function swipeMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start) return
    sceneRef.current?.drag((event.clientX - start.x) / start.width)
  }

  function swipeEnd(event: PointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start) return
    dragRef.current = null
    const share = (event.clientX - start.x) / start.width
    sceneRef.current?.drag(0)
    if (Math.abs(share) <= SWIPE) return
    if (isLast) leave(Math.sign(share))
    else show(index + 1, Math.sign(share))
  }

  const song = pulls[index]
  const isLast = index === pulls.length - 1

  return (
    <div
      data-slot="pack-opening"
      data-phase={phase}
      className={cn(
        "game-studio aspect-393/852 game-opening-size touch-none select-none",
        className
      )}
      style={CUT_VARS}
    >
      {phase === "idle" || phase === "cut" ? (
        <div className="game-pack-motes" aria-hidden="true">
          {MOTES.map((mote) => (
            <i key={mote.id} style={mote.vars} />
          ))}
        </div>
      ) : null}
      <canvas ref={canvasRef} className="game-canvas z-10" aria-hidden="true" />
      {phase === "open" ? (
        <i className="game-cut-flash" aria-hidden="true" />
      ) : null}
      {phase === "cards" && party?.index === index ? (
        <Celebration key={party.key} rarity={party.rarity} />
      ) : null}

      {phase === "idle" ? (
        <button
          type="button"
          aria-label="Open pack"
          className="inset-0 absolute z-20 rounded-4xl outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset"
          onPointerDown={(event) => {
            pressRef.current = { x: event.clientX, y: event.clientY }
          }}
          onClick={openPack}
        />
      ) : null}

      {phase === "cut" ? (
        <>
          <div
            className="game-cut-guide h-14 absolute z-20 cursor-grab active:cursor-grabbing"
            aria-hidden="true"
            onPointerDown={grab}
            onPointerMove={cutAlong}
            onPointerUp={cancelCut}
            onPointerCancel={cancelCut}
          />
          <button type="button" className="sr-only" onClick={cutOpen}>
            Cut pack open
          </button>
        </>
      ) : null}

      {phase === "cards" ? (
        <>
          <div
            className="inset-0 absolute z-20 cursor-grab"
            aria-hidden="true"
            onPointerDown={grab}
            onPointerMove={swipeMove}
            onPointerUp={swipeEnd}
            onPointerCancel={swipeEnd}
          />
          {/* Swiping drives the reveal; these stay for screen readers and keyboards. */}
          {song ? (
            <p className="sr-only" aria-live="polite">
              {song.rarity}, card {index + 1} of {pulls.length}
            </p>
          ) : null}
          <div className="sr-only">
            <button
              type="button"
              onClick={() => show(index - 1)}
              disabled={index === 0}
            >
              Previous card
            </button>
            <button
              type="button"
              onClick={isLast ? () => leave() : () => show(index + 1)}
            >
              {isLast ? "Add to collection" : "Next card"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

export { PackOpening }

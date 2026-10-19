"use client"

import { Celebration } from "@workspace/ui/components/celebration"
import {
  CutGuide,
  CutSlash,
  useCutSlash,
} from "@workspace/ui/components/cut-slash"
import { GameMotes } from "@workspace/ui/components/game-motes"
import { PackGlow } from "@workspace/ui/components/pack-glow"
import { useReveal, type Party } from "@workspace/ui/hooks/use-reveal"
import { STAGE_GONE } from "@workspace/ui/lib/game/film-scene"
import {
  glowHold,
  mountOpeningScene,
  openedAfter,
  type OpeningPhase,
  type OpeningResume,
  type OpeningScene,
} from "@workspace/ui/lib/game/opening-scene"
import { REVEAL_PLAYED } from "@workspace/ui/lib/game/reveal-motion"
import { play } from "@workspace/ui/lib/game/sfx"
import type { CssVars, GameSong } from "@workspace/ui/lib/game/theme"
import { waitingMusic } from "@workspace/ui/lib/game/waiting-music"
import { cn } from "@workspace/ui/lib/utils"
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
} from "react"

const CUT_DONE = 0.7
// A card is swiped only by a flick: still moving sideways at FLICK px/ms or
// more over the last FLICK_WINDOW ms when let go, at least FLICK_MIN px from
// where it started. A slow or held drag just turns the pile, then lets it
// turn back.
const FLICK = 0.3
const FLICK_MIN = 40
const FLICK_WINDOW = 100
// Seconds after a swipe before the new card's reveal cue.
const REVEAL_AFTER = 0.2
// Four-point stars twinkling across the reveal tint: x/y as %, then size px.
const WASH_STARS = [
  [12, 18, 18],
  [84, 14, 14],
  [24, 74, 13],
  [76, 68, 19],
  [48, 9, 11],
  [92, 46, 12],
  [7, 51, 15],
  [58, 88, 14],
  [33, 31, 10],
  [68, 35, 11],
  [18, 92, 10],
  [89, 83, 11],
].map(([x, y, size], star) => {
  const vars: CssVars = {
    "--star-x": `${String(x)}%`,
    "--star-y": `${String(y)}%`,
    "--star-size": `${String(size)}px`,
    "--star-delay": `${String(-(star * 0.29) % 1.4)}s`,
  }
  return { id: `wash-star-${String(star)}`, vars }
})

type Phase = OpeningPhase | "cards"

// The reveal's stars and full-stage motes, faint from the cut on, bright in a
// first epic or legendary pull's tint.
function WashSparkles() {
  return (
    <>
      <GameMotes />
      {WASH_STARS.map((star) => (
        <i key={star.id} className="game-reveal-star" style={star.vars} />
      ))}
    </>
  )
}

// Behind the pack in each phase: glowing motes while it waits, the light a
// legendary sends pouring out of it as it opens, and a first epic or legendary
// pull recolouring the stage, finishing even if swiped away.
function Backdrop({
  phase,
  pulls,
  party,
}: {
  phase: Phase
  pulls: ReadonlyArray<PackPull>
  party: Party | null
}) {
  if (phase === "idle") return <GameMotes />
  const legendary = pulls.some((pull) => pull.rarity === "legendary")
  return (
    <>
      <div className="game-reveal-wash" data-ambient aria-hidden="true">
        <WashSparkles />
      </div>
      {phase === "open" && legendary ? <PackGlow /> : null}
      {phase === "cards" && party ? (
        <div
          key={party.key}
          className="game-reveal-wash"
          data-rarity={party.rarity}
          aria-hidden="true"
        >
          <WashSparkles />
        </div>
      ) : null}
    </>
  )
}
export type PackPull = GameSong & { isNew?: boolean }

type Point = { x: number; y: number; at: number }
// Where a drag started, and its moves over the last FLICK_WINDOW ms.
type Drag = Point & { left: number; width: number; trail: Array<Point> }

// Notes a move, forgetting those older than FLICK_WINDOW.
function follow(drag: Drag, point: Point) {
  drag.trail.push(point)
  while ((drag.trail[0]?.at ?? point.at) < point.at - FLICK_WINDOW)
    drag.trail.shift()
}

// Which way a drag let go at `end` swipes the card: -1 or 1, or 0 when it
// doesn't, as it was slow, held still at the end, or mostly vertical.
function swipeSide(drag: Drag, end: Point) {
  follow(drag, end)
  const from = drag.trail[0] ?? end
  const dx = end.x - from.x
  const sideways = Math.abs(dx) > Math.abs(end.y - from.y)
  const speed = Math.abs(dx) / Math.max(end.at - from.at, 1)
  const travelled = (end.x - drag.x) * Math.sign(dx)
  const flicked = sideways && speed >= FLICK && travelled >= FLICK_MIN
  return flicked ? Math.sign(dx) : 0
}

// Seconds until `pull` is out, `delay` from now, and its reveal has played.
const revealedIn = (pull: PackPull | undefined, delay: number) =>
  pull && delay + REVEAL_PLAYED[pull.rarity]

// Mounts the scene a frame later, so the screen paints before the WebGL setup;
// returns its cleanup, which also clears the card on show.
function mountNextFrame(
  sceneRef: { current: OpeningScene | null },
  clear: () => void,
  ...args: Parameters<typeof mountOpeningScene>
) {
  const frame = requestAnimationFrame(() => {
    sceneRef.current = mountOpeningScene(...args)
  })
  return () => {
    cancelAnimationFrame(frame)
    clear()
    sceneRef.current?.dispose()
    sceneRef.current = null
  }
}

// A canvas whose context is gone for good: a key that changes to remount it,
// and where the scene was (phase and card) for the new one to pick up.
function useCanvasRebirth(
  canvasRef: { current: HTMLCanvasElement | null },
  phase: Phase,
  index: number
) {
  const [rebirth, setRebirth] = useState<{
    key: number
    resume: OpeningResume | null
  }>({ key: 0, resume: null })
  const gone = useEffectEvent(() =>
    setRebirth(({ key }) => ({
      key: key + 1,
      resume: {
        phase: phase === "cards" ? "open" : phase,
        index,
        opened: phase === "cards",
      },
    }))
  )
  useEffect(() => {
    const canvas = canvasRef.current
    const onGone = () => gone()
    canvas?.addEventListener(STAGE_GONE, onGone)
    return () => canvas?.removeEventListener(STAGE_GONE, onGone)
    // Each new canvas (a new key) is listened to.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [canvasRef, rebirth.key])
  return rebirth
}

type PackOpeningProps = {
  pulls: ReadonlyArray<PackPull>
  covers: ReadonlyArray<string>
  onDone: () => void
  // True once the pack is tapped open.
  onOpenChange?: (open: boolean) => void
  // The card coming on show, with the seconds until it's out and its reveal
  // has played; null when none is (pack left or reset). Called on the cut for
  // the first card, on its swipe in for the others.
  onCard?: (pull: PackPull | null, revealed?: number) => void
  // Fly the waiting pack in; false shows it straight away.
  entrance?: boolean
  // No pack to open: the waiting pack shows grayed out, and a tap calls
  // `onLockedTap` instead of opening it.
  locked?: boolean
  onLockedTap?: () => void
  className?: string
}

// Over the waiting pack: a tap opens it or, `locked`, calls `onLockedTap`.
// Not the end of a drag turning it round, though.
function WaitingPack({
  locked,
  onOpen,
  onLockedTap,
}: {
  locked: boolean | undefined
  onOpen: () => void
  onLockedTap: (() => void) | undefined
}) {
  // Where the press started.
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  return (
    <button
      type="button"
      aria-label={locked ? "Buy a pack" : "Open pack"}
      className="inset-0 absolute z-20 rounded-4xl outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset"
      onPointerDown={(event) => {
        pressRef.current = { x: event.clientX, y: event.clientY }
      }}
      onClick={(event) => {
        const press = pressRef.current
        pressRef.current = null
        const moved = press
          ? Math.hypot(event.clientX - press.x, event.clientY - press.y)
          : 0
        if (moved > 8) return
        if (locked) onLockedTap?.()
        else onOpen()
      }}
    />
  )
}

// The waiting pack, its cut, and the reveal of its cards, on one canvas.
function PackOpening({
  pulls,
  covers,
  onDone,
  onOpenChange,
  onCard,
  entrance = true,
  locked,
  onLockedTap,
  className,
}: PackOpeningProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<OpeningScene | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const cut = useCutSlash()
  const [phase, setPhase] = useState<Phase>("idle")
  const [index, setIndex] = useState(0)
  const rebirth = useCanvasRebirth(canvasRef, phase, index)
  const { party, reveal, reset } = useReveal(pulls, sceneRef)
  const pullKey = pulls.map((pull) => pull.id).join("|")
  const coverKey = covers.join("|")
  // Latest callback, without remounting the scene when it changes.
  const announce = useEffectEvent((pull: PackPull | null) => onCard?.(pull))
  // The same cards in a new array (a refetch, a reconnect) bring a new
  // `reveal`; that mustn't remount the scene, mid-reveal or not.
  const revealFirst = useEffectEvent(() => reveal(0))
  const resumeAt = useEffectEvent(() => rebirth.resume)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    // A canvas swapped for a lost one picks up where it was.
    const resume = resumeAt()
    if (!resume) {
      reset()
      setPhase("idle")
      setIndex(0)
    }
    return mountNextFrame(
      sceneRef,
      () => announce(null),
      canvas,
      pulls,
      coverKey.split("|"),
      () => {
        setPhase("cards")
        setIndex(0)
        revealFirst()
      },
      resume ? { entrance: false, resume } : { entrance }
    )
    // pullKey is the stable identity of pulls.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [coverKey, pullKey, reset, entrance, rebirth.key])

  // Music while the opened pack waits to be cut; the cut fades it out.
  useEffect(() => (phase === "cut" ? waitingMusic() : undefined), [phase])

  function enter(next: Phase) {
    setPhase(next)
    if (next !== "cards") sceneRef.current?.setPhase(next)
  }

  function openPack() {
    play("press")
    enter("cut")
    onOpenChange?.(true)
  }

  function cutOpen() {
    dragRef.current = null
    cut.finish()
    sceneRef.current?.setCut(1)
    play("rip")
    // As the strip comes free and the pack drops away; with a legendary
    // inside, one triumphant flourish through its light instead.
    if (glowHold(pulls)) play("glow")
    else play("open", 0.3)
    enter("open")
    onCard?.(pulls[0] ?? null, revealedIn(pulls[0], openedAfter(pulls)))
  }

  function cancelCut() {
    dragRef.current = null
    cut.clear()
    sceneRef.current?.setCut(0)
  }

  // A new stroke starts with each grab; only the cut keeps it.
  function grab(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    cut.trace(event, true)
    const { left, width } = event.currentTarget.getBoundingClientRect()
    const { clientX: x, clientY: y, timeStamp: at } = event
    dragRef.current = { x, y, at, left, width, trail: [{ x, y, at }] }
  }

  function cutAlong(event: PointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start) return
    cut.trace(event)
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
    onCard?.(pulls[next] ?? null, revealedIn(pulls[next], REVEAL_AFTER))
    setTimeout(() => reveal(next), REVEAL_AFTER * 1000)
  }

  // The last card flies off like the others, then the pack is done. Moving
  // past the last index also ignores any further swipes meanwhile.
  function leave(side = -1) {
    setIndex(pulls.length)
    sceneRef.current?.show(pulls.length, side)
    play("swipe")
    onCard?.(null)
    setTimeout(onDone, 450)
  }

  function swipeMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start) return
    const { clientX: x, clientY: y, timeStamp: at } = event
    follow(start, { x, y, at })
    sceneRef.current?.drag((x - start.x) / start.width)
  }

  function swipeEnd(event: PointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start) return
    dragRef.current = null
    const { clientX: x, clientY: y, timeStamp: at } = event
    const side = swipeSide(start, { x, y, at })
    sceneRef.current?.drag(0)
    if (!side) return
    if (isLast) leave(side)
    else show(index + 1, side)
  }

  const song = pulls[index]
  const isLast = index === pulls.length - 1

  return (
    <div
      ref={cut.stage}
      data-slot="pack-opening"
      data-phase={phase}
      data-locked={locked}
      className={cn(
        // Full screen on phones (their shape varies); a phone-shaped frame on
        // bigger screens. The scene fits itself to either.
        "game-studio md:aspect-393/852 md:game-opening-size size-full touch-none select-none",
        className
      )}
    >
      <Backdrop phase={phase} pulls={pulls} party={party} />
      <canvas
        key={rebirth.key}
        ref={canvasRef}
        className="game-canvas z-10"
        aria-hidden="true"
      />
      {phase === "open" && cut.slash ? <CutSlash slash={cut.slash} /> : null}
      {phase === "cards" && party?.index === index ? (
        <Celebration key={party.key} rarity={party.rarity} />
      ) : null}

      {phase === "idle" ? (
        <WaitingPack
          locked={locked}
          onOpen={openPack}
          onLockedTap={onLockedTap}
        />
      ) : null}

      {phase === "cut" ? (
        <CutGuide
          ref={cut.guide}
          onPointerDown={grab}
          onPointerMove={cutAlong}
          onPointerUp={cancelCut}
          onPointerCancel={cancelCut}
          onCut={cutOpen}
        />
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

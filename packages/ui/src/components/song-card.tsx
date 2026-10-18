"use client"

import { CountBadge } from "@workspace/ui/components/count-badge"
import {
  mountCardScene,
  mountUpgradeScene,
  type CardScene,
  type CardSceneOptions,
  type CardSlot,
  type UpgradeScene,
} from "@workspace/ui/lib/game/card-scene"
import {
  cardThumbSlot,
  filmKey,
  mountCardThumb,
  watchNear,
} from "@workspace/ui/lib/game/card-thumbs"
import type { GameSong, Rarity } from "@workspace/ui/lib/game/theme"
import { cn } from "@workspace/ui/lib/utils"
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react"

// Sends a flown-in card back to a slot (re-measured each frame); resolves
// once it lands. `snapshot`: the card and its mirror image as a PNG, null
// before it's drawn.
type SongCardHandle = Pick<CardScene, "flyBack"> & {
  snapshot: () => Blob | null
}

type SongCardProps = {
  song: GameSong
  mirror?: boolean
  reveal?: boolean
  // Fly in from this on-screen slot (see songCardThumbSlot) instead.
  from?: CardSlot
  // Where a flown-in card lands, relative to the canvas middle.
  land?: CardSceneOptions["land"]
  // Called once the card is drawn where it starts.
  onReady?: () => void
  ref?: Ref<SongCardHandle>
  className?: string
}

// A three.js song card: printed film on rarity foil.
function SongCard({
  song,
  mirror = true,
  reveal = false,
  from,
  land,
  onReady,
  ref,
  className,
}: SongCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<CardScene | null>(null)
  // The slots only matter when the card mounts.
  const startRef = useRef({ from, land })
  const ready = useEffectEvent(() => onReady?.())

  useImperativeHandle(ref, () => ({
    flyBack: (to) => sceneRef.current?.flyBack(to) ?? Promise.resolve(),
    snapshot: () => sceneRef.current?.snapshot() ?? null,
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const scene = mountCardScene(canvas, song, {
      mirror,
      reveal,
      ...startRef.current,
    })
    sceneRef.current = scene
    let current = true
    void scene.ready.then(() => current && ready())
    return () => {
      current = false
      sceneRef.current = null
      scene.dispose()
    }
  }, [song, mirror, reveal])

  return (
    <canvas
      ref={canvasRef}
      data-slot="song-card"
      className={cn("game-canvas touch-none select-none", className)}
      aria-label={`${song.title} by ${song.artist}, ${song.rarity} card`}
    />
  )
}

// Grid card rendered by the same 3D card pipeline, from one shared context;
// its light follows the page scroll. Keyed so a new card starts unpainted.
function SongCardThumb(props: SongCardThumbProps) {
  return <LiveThumb key={props.song.id} {...props} />
}

type SongCardThumbProps = {
  song: GameSong
  // Copies held; two or more show a count badge on the corner.
  copies?: number
  // While a big SongCard stands in for it, e.g. mid-flight.
  away?: boolean
  // Holds its card before it's known to be near the view, e.g. at the top of
  // a grid built hidden, so it's drawn when the grid shows.
  eager?: boolean
  // A card the player hasn't pulled: shown grayed out, and it doesn't react.
  muted?: boolean
  // More badges on the card, e.g. a price or a time left (see GameBadge).
  children?: ReactNode
}

// Holds a card only within reach of its scroller's view: a long grid keeps a
// few screens of cards, not one per item. Its nodes stay put and only their
// attributes change: inserting or removing nodes restyles the whole game
// shell (its `:has()` rules), every time a card comes near or goes.
function LiveThumb({
  song,
  copies = 1,
  away = false,
  eager = false,
  muted = false,
  children,
}: SongCardThumbProps) {
  const slotRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(eager)
  const [drawn, setDrawn] = useState(false)
  // The card it was first drawn from, kept while the card's looks stay the
  // same: data updates bring new objects every time (a live auction's every
  // second), and redrawing each would blink.
  const [drawnSong, setDrawnSong] = useState(song)
  if (filmKey(song) !== filmKey(drawnSong)) setDrawnSong(song)

  useEffect(() => {
    const slot = slotRef.current
    return slot ? watchNear(slot, setNear) : undefined
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!near || !canvas) return undefined
    const release = mountCardThumb(canvas, drawnSong, () => setDrawn(true))
    return () => {
      release()
      // Frees its pixels while it's away.
      canvas.width = 0
      canvas.height = 0
      setDrawn(false)
    }
  }, [drawnSong, near])

  return (
    <span
      ref={slotRef}
      data-slot="song-card-thumb"
      data-kind={song.kind}
      data-away={away || undefined}
      data-muted={muted || undefined}
      className="not-data-muted:group-hover/card:-translate-y-1 @container/thumb relative block aspect-5/7 w-full transition-transform not-data-muted:group-active/card:scale-95 data-away:invisible data-muted:opacity-45 data-muted:grayscale"
    >
      <span
        hidden={!near || drawn}
        className="animate-pulse inset-0 absolute rounded-2xl bg-muted"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        width={0}
        height={0}
        className="game-card-snapshot absolute max-w-none"
      />
      <CountBadge count={copies} size="card" />
      {children}
    </span>
  )
}

// Where a thumb inside `element` shows its card, for a SongCard to fly from.
function songCardThumbSlot(element: Element | null) {
  const canvas = element?.querySelector("[data-slot=song-card-thumb] canvas")
  return canvas instanceof HTMLCanvasElement ? cardThumbSlot(canvas) : null
}

// Turns the card up to its next rarity; resolves once it faces front again.
type UpgradingCardHandle = Pick<UpgradeScene, "step">

// A three.js card going up through `rarities`, the first shown on mount and
// one more per `step`.
function UpgradingCard({
  song,
  rarities,
  onReady,
  ref,
  className,
}: {
  song: GameSong
  rarities: ReadonlyArray<Rarity>
  onReady?: () => void
  ref?: Ref<UpgradingCardHandle>
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<UpgradeScene | null>(null)
  const ready = useEffectEvent(() => onReady?.())

  useImperativeHandle(ref, () => ({
    step: () => sceneRef.current?.step() ?? Promise.resolve(),
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const scene = mountUpgradeScene(canvas, song, rarities)
    sceneRef.current = scene
    let current = true
    void scene.ready.then(() => current && ready())
    return () => {
      current = false
      sceneRef.current = null
      scene.dispose()
    }
  }, [song, rarities])

  return (
    <canvas
      ref={canvasRef}
      data-slot="upgrading-card"
      className={cn("game-canvas touch-none select-none", className)}
      aria-hidden="true"
    />
  )
}

export {
  SongCard,
  SongCardThumb,
  songCardThumbSlot,
  UpgradingCard,
  type SongCardHandle,
  type SongCardProps,
  type UpgradingCardHandle,
}

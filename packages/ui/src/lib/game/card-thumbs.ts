import { CARD_W } from "@workspace/ui/lib/game/card-art"
import { cardFilm, type CardSlot } from "@workspace/ui/lib/game/card-scene"
import {
  addFilm,
  createStage,
  type Disposable,
  type Film,
  type Stage,
} from "@workspace/ui/lib/game/film-scene"
import { loadImage } from "@workspace/ui/lib/game/pack-art"
import type { GameSong } from "@workspace/ui/lib/game/theme"

// Same framing as SongCard without its mirror floor.
const THUMB_W = 280
const THUMB_H = 400
// The card is raised by this much on its stage, as at the top of SongCard's bob.
const LIFT = 6
// How far the foil's light turns between the viewport's middle and its edges.
const TILT = { across: 0.5, down: 0.8 }
// At rest the light drifts, like the big card's sway; scrolling swings it
// further (tilt per px/s, capped), which also sets the sparkles flaring.
const SWAY = 0.22
const KICK = { perSpeed: 0.0008, max: 0.9 }
// Texels per card px: the stage draws a card 240 px wide at pixel ratio 2, so
// more would only cost memory (a quarter of the big card's, at its 4).
const THUMB_SCALE = 2

type Thumb = {
  film: Film
  shown: boolean
  drawn: boolean
  onDrawn: () => void
  top: number | null
  kick: number
}
// A card's film and the GPU resources only it uses.
type Built = { film: Film; parts: Array<Disposable> }

let stage: Stage | null = null
let observer: IntersectionObserver | null = null
let frame = 0
let last = 0
let tick = 0
let kicking = false
const thumbs = new Map<Element, Thumb>()
// Thumbs waiting for their film, and which are on screen: films load one at a
// time, those on screen first and the rest in idle time, so a long grid shows
// its top at once and the rest (or a hidden grid's) cost no frames.
const waiting = new Map<
  Element,
  { song: GameSong; load: () => Promise<void> }
>()
const onScreen = new Set<Element>()
let loadingAny = false
// Films of thumbs that unmounted, by card, so cards scrolled back to (or
// redrawn after a data refresh) show at once instead of rebuilding.
// shortcut: the newest PARK_MAX are kept (about 3.5 MB of GPU memory each);
// size it to the device's memory if phones struggle.
const parked = new Map<string, Built>()
const PARK_MAX = 24

// Everything the film is drawn from: the same key, the same card.
export const filmKey = (song: GameSong) =>
  [
    song.id,
    song.kind,
    song.rarity,
    song.title,
    song.artist,
    song.imageUrl,
    song.streams,
  ].join("|")

function park(key: string, kept: Built) {
  for (const part of parked.get(key)?.parts ?? []) part.dispose()
  parked.delete(key)
  parked.set(key, kept)
  const [oldest] = parked
  if (parked.size <= PARK_MAX || !oldest) return
  parked.delete(oldest[0])
  for (const part of oldest[1].parts) part.dispose()
}

// A parked film, back on the stage for a thumb.
function unpark(key: string) {
  const kept = parked.get(key)
  if (!kept) return null
  parked.delete(key)
  thumbStage().scene.add(kept.film.subject)
  return kept
}

// A card's film on the shared stage, hidden until a thumb shows it. Films
// build one at a time, so each takes only the disposables added meanwhile.
async function build(song: GameSong): Promise<Built> {
  const scene = thumbStage()
  const before = scene.disposables.length
  const film = addFilm(scene, cardFilm(song, THUMB_SCALE))
  film.subject.visible = false
  film.subject.position.y = LIFT
  try {
    await film.ready
  } catch (error) {
    scene.scene.remove(film.subject)
    for (const part of scene.disposables.splice(before)) part.dispose()
    throw error
  }
  return { film, parts: scene.disposables.splice(before) }
}

// Waits for the page to be idle, or for a thumb to come on screen.
let wake: (() => void) | null = null
const whenIdle = () =>
  new Promise<void>((resolve) => {
    wake = resolve
    // Safari has no requestIdleCallback.
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => resolve(), { timeout: 1000 })
    } else setTimeout(resolve, 200)
  }).finally(() => {
    wake = null
  })

function schedule() {
  frame ||= requestAnimationFrame(draw)
}

async function loadWaiting() {
  if (loadingAny || !waiting.size) return
  loadingAny = true
  const urgent = () => [...waiting.keys()].find((key) => onScreen.has(key))
  // Work off screen only takes idle time, so it costs no frames.
  if (urgent() === undefined) await whenIdle()
  const next = urgent() ?? waiting.keys().next().value
  const thumb = next === undefined ? undefined : waiting.get(next)
  if (next !== undefined) waiting.delete(next)
  await thumb?.load().catch(() => undefined)
  loadingAny = false
  // Picks the next one only now, so a scroll meanwhile reorders the rest.
  void loadWaiting()
}

function watcher() {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const { target, isIntersecting } = entry
      if (isIntersecting) onScreen.add(target)
      else onScreen.delete(target)
      // Covers coming on screen download together, not one per film.
      const cover = isIntersecting && waiting.get(target)?.song.imageUrl
      if (cover) loadImage(cover).catch(() => undefined)
      const thumb = thumbs.get(target)
      if (!thumb) continue
      thumb.shown = isIntersecting
      // Coming back into view isn't a scroll: measure speed afresh.
      thumb.top = null
    }
    schedule()
    wake?.()
    void loadWaiting()
  })
  return observer
}

// Elements watched for coming near their scroller's view: the callbacks
// waiting on each, and whether it was last near, so a later one hears at once.
type Watch = { callbacks: Set<(near: boolean) => void>; near: boolean | null }
const watches = new Map<Element, Watch>()
// One watcher per scroller (null: the viewport), and how many it watches.
const scrollers = new Map<
  Element | null,
  { observer: IntersectionObserver; items: number }
>()

// Tells `onNear` whether `element` is within `margin` of `root`'s view. An
// element not laid out (its tab hidden) keeps what it had.
function watchIn(
  element: Element,
  root: Element | null,
  margin: string,
  onNear: (near: boolean) => void
) {
  const known = watches.get(element)
  if (known) {
    known.callbacks.add(onNear)
    if (known.near !== null) onNear(known.near)
  } else {
    watches.set(element, { callbacks: new Set([onNear]), near: null })
    let scroller = scrollers.get(root)
    if (!scroller) {
      const near = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const watch = watches.get(entry.target)
            if (!watch || !entry.target.checkVisibility()) continue
            watch.near = entry.isIntersecting
            for (const callback of watch.callbacks) callback(watch.near)
          }
        },
        { root, rootMargin: margin }
      )
      scroller = { observer: near, items: 0 }
      scrollers.set(root, scroller)
    }
    scroller.items += 1
    scroller.observer.observe(element)
  }
  return () => {
    const watch = watches.get(element)
    watch?.callbacks.delete(onNear)
    if (watch?.callbacks.size) return
    watches.delete(element)
    const scroller = scrollers.get(root)
    if (!scroller) return
    scroller.observer.unobserve(element)
    scroller.items -= 1
    if (scroller.items) return
    scroller.observer.disconnect()
    scrollers.delete(root)
  }
}

// Grid items within half a screen of their scroller's view (a GameScroll, or
// a dialog that scrolls), so only those hold a card. In a sideways row
// (data-slot=card-row): within half a row of the row's view, and the row
// itself within half a screen of the page's.
export function watchNear(element: Element, onNear: (near: boolean) => void) {
  const row = element.parentElement?.closest("[data-slot=card-row]")
  if (!row) {
    const root = element.closest("[data-slot=game-scroll], dialog")
    return watchIn(element, root, "50% 0px", onNear)
  }
  let inRow: boolean | null = null
  let rowNear: boolean | null = null
  const tell = () => {
    if (inRow !== null && rowNear !== null) onNear(inRow && rowNear)
  }
  const stopRow = watchNear(row, (near) => {
    rowNear = near
    tell()
  })
  const stopItem = watchIn(element, row, "0px 50%", (near) => {
    inRow = near
    tell()
  })
  return () => {
    stopItem()
    stopRow()
  }
}

// One shared WebGL context, so a collection grid can show many real cards.
function thumbStage() {
  if (stage) return stage
  const canvas = document.createElement("canvas")
  canvas.style.width = `${THUMB_W}px`
  canvas.style.height = `${THUMB_H}px`
  Object.defineProperties(canvas, {
    clientWidth: { value: THUMB_W },
    clientHeight: { value: THUMB_H },
  })
  stage = createStage(canvas)
  // Thumbs run their own loop over the visible ones, and are small enough to
  // skip the big card's supersampling.
  stage.renderer.setAnimationLoop(null)
  stage.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  return stage
}

// Where a thumb's card sits on screen and how it's lit, for a big card to
// take over from it seamlessly; null while the thumb isn't drawn.
export function cardThumbSlot(canvas: HTMLCanvasElement): CardSlot | null {
  const thumb = thumbs.get(canvas)
  if (!stage || !thumb?.drawn) return null
  const box = canvas.getBoundingClientRect()
  if (!box.width) return null
  const px = box.width / THUMB_W
  return {
    x: box.left + box.width / 2,
    // The stage middle, less the card's lift; a little under perspective.
    y: box.top + box.height / 2 - LIFT * px,
    width: CARD_W * px,
    tilt: { x: thumb.film.tilt.x, y: thumb.film.tilt.y },
    time: stage.time.value,
  }
}

// Each visible card is lit for where it sits on screen and how fast it moves,
// so its foil, glare and sparkles swing as the page scrolls while the card
// itself stays put.
function draw(stamp: number) {
  frame = 0
  if (!stage) return
  const { renderer, scene, camera, time, still } = stage
  // Idle drift is slow enough for 30fps; scrolling gets every frame.
  tick += 1
  if (!kicking && tick % 2 && last) {
    schedule()
    return
  }
  const delta = last ? Math.min((stamp - last) / 1000, 0.1) : 0
  last = stamp
  if (!still) time.value += delta
  const ease = 1 - 0.9 ** (delta * 60)
  let running = false
  kicking = false
  for (const [canvas, thumb] of thumbs) {
    if (!(canvas instanceof HTMLCanvasElement)) continue
    // Drawn once as soon as it's built, even off screen or under a hidden
    // tab, so it's ready when it shows; after that, only while on screen.
    if (thumb.drawn && !thumb.shown) continue
    running = true
    // Faded out under a showcase: keep the loop, skip the work. Inert alone
    // isn't enough, the page is back on screen while the card flies home.
    if (still && thumb.drawn) continue
    const visible = canvas.checkVisibility({ opacityProperty: true })
    if (thumb.drawn && !visible) continue
    const box = canvas.getBoundingClientRect()
    const across = (box.left + box.width / 2) / innerWidth - 0.5
    const down = (box.top + box.height / 2) / innerHeight - 0.5
    const speed =
      thumb.top === null || !delta ? 0 : (box.top - thumb.top) / delta
    thumb.top = box.top
    const push = Math.max(-KICK.max, Math.min(KICK.max, speed * KICK.perSpeed))
    thumb.kick += (push - thumb.kick) * ease
    kicking ||= Math.abs(thumb.kick) > 0.01
    if (!still) {
      // Offset by position, so the drift ripples across the grid.
      const phase = across * 2 + down * 3
      const turn = time.value * Math.PI * 2
      thumb.film.tilt.set(
        across * TILT.across + SWAY * Math.sin(turn / 7 + phase),
        -down * TILT.down + 0.6 * SWAY * Math.cos(turn / 9 + phase) + thumb.kick
      )
    }
    scene.environmentRotation.set(thumb.film.tilt.y, -thumb.film.tilt.x, 0)
    thumb.film.subject.visible = true
    renderer.render(scene, camera)
    thumb.film.subject.visible = false
    const ctx = canvas.getContext("2d")
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    ctx?.drawImage(renderer.domElement, 0, 0)
    if (!thumb.drawn) {
      thumb.drawn = true
      thumb.onDrawn()
    }
  }
  if (running && !still) schedule()
  else last = 0
}

// Draws a live card into `canvas` until the returned cleanup runs.
export function mountCardThumb(
  canvas: HTMLCanvasElement,
  song: GameSong,
  onDrawn: () => void
) {
  const key = filmKey(song)
  let built: Built | null = null
  let disposed = false
  let loading = false
  const release = () => {
    waiting.delete(canvas)
    onScreen.delete(canvas)
    thumbs.delete(canvas)
    observer?.unobserve(canvas)
    if (!built) return
    stage?.scene.remove(built.film.subject)
    park(key, built)
  }

  function show(film: Film) {
    const { width, height } = thumbStage().renderer.domElement
    // Resizing clears it: a card redrawn after a data refresh keeps its last
    // frame until the next one.
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    thumbs.set(canvas, {
      film,
      shown: onScreen.has(canvas),
      drawn: false,
      onDrawn,
      top: null,
      kick: 0,
    })
    schedule()
  }

  async function load() {
    loading = true
    try {
      built = unpark(key) ?? (await build(song))
      // Give the art a frame to land.
      await new Promise(requestAnimationFrame)
    } finally {
      loading = false
      if (disposed) release()
    }
    if (!disposed) show(built.film)
  }

  built = unpark(key)
  if (built) show(built.film)
  // Loading starts from the watcher, once it knows which thumbs are on screen.
  else waiting.set(canvas, { song, load })
  watcher().observe(canvas)
  return () => {
    disposed = true
    if (!loading) release()
  }
}

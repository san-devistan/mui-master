// Light under the finger across the whole game, in the pack cut's colors (game.css
// .game-cut-flash): a holo ring and a glint where it lands, and a comet trail behind it as it
// slides, scrolls included. One canvas over everything, letting every touch through; it only
// draws while something shows. An element with data-touch-fx="off" (the cut guide, which has its
// own comet) and its children get none, and nothing shows with reduced motion.

export type TrailPoint = { x: number; y: number; at: number }

type Trail = { points: Array<TrailPoint>; down: boolean }
type Burst = { x: number; y: number; at: number }

const TRAIL_MS = 220
const BURST_MS = 450
// The cut's holo band: yellow, pink, blue.
const HOLO = [
  [255, 243, 110],
  [255, 54, 194],
  [65, 154, 255],
] as const

const off = (target: EventTarget | null) =>
  target instanceof Element && target.closest('[data-touch-fx="off"]') !== null

// The pieces of a trail showing at `now`, oldest first, each from one point to the next with its
// `life`: 1 at the finger, down to 0 as it ages out, so the trail tapers and fades behind it.
export function trailSegments(points: ReadonlyArray<TrailPoint>, now: number) {
  return points.slice(1).flatMap((to, index) => {
    const from = points[index]
    const life = 1 - (now - to.at) / TRAIL_MS
    return from && life > 0 ? [{ from, to, life }] : []
  })
}

// The holo color `share` (0 to 1) along the band, at `alpha`.
function holo(share: number, alpha: number) {
  const spot = Math.min(Math.max(share, 0), 1) * (HOLO.length - 1)
  const low = HOLO[Math.floor(spot)] ?? HOLO[0]
  const high = HOLO[Math.ceil(spot)] ?? low
  const mix = spot - Math.floor(spot)
  const [red, green, blue] = low.map((value, at) =>
    Math.round(value + ((high[at] ?? value) - value) * mix)
  )
  return `rgb(${red} ${green} ${blue} / ${alpha})`
}

// A four-point star, like the cut's glint.
function glint(
  ctx: CanvasRenderingContext2D,
  { x, y }: { x: number; y: number },
  size: number,
  alpha: number
) {
  const pinch = size * 0.15
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha
  ctx.fillStyle = "#fff"
  ctx.shadowColor = "rgb(255 54 194)"
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.quadraticCurveTo(pinch, -pinch, size, 0)
  ctx.quadraticCurveTo(pinch, pinch, 0, size)
  ctx.quadraticCurveTo(-pinch, pinch, -size, 0)
  ctx.quadraticCurveTo(-pinch, -pinch, 0, -size)
  ctx.fill()
  ctx.restore()
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: Trail, now: number) {
  const segments = trailSegments(trail.points, now)
  // Flat ends: round ones overlap at every joint, beading the see-through band.
  ctx.lineCap = "butt"
  // A holo band, then a white-hot core over it.
  for (const [index, { from, to, life }] of segments.entries()) {
    ctx.strokeStyle = holo(index / Math.max(1, segments.length - 1), 0.3 * life)
    ctx.lineWidth = 1 + 8 * life
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }
  for (const { from, to, life } of segments) {
    ctx.strokeStyle = `rgb(255 255 255 / ${0.7 * life})`
    ctx.lineWidth = 1 + 2 * life
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }
  const head = trail.points.at(-1)
  if (trail.down && head && segments.length) glint(ctx, head, 7, 0.75)
}

// A ring opening out where the finger landed, the glint flaring in its middle.
function drawBurst(ctx: CanvasRenderingContext2D, burst: Burst, now: number) {
  const age = (now - burst.at) / BURST_MS
  const out = 1 - (1 - age) ** 3
  ctx.strokeStyle = holo(age, 0.5 * (1 - age))
  ctx.lineWidth = 1 + 2 * (1 - age)
  ctx.beginPath()
  ctx.arc(burst.x, burst.y, 4 + 18 * out, 0, Math.PI * 2)
  ctx.stroke()
  const flare = age < 0.3 ? age / 0.3 : 1 - (age - 0.3) / 0.7
  glint(ctx, burst, 4 + 5 * flare, 0.7 * flare)
}

// Installs it on the page. Returns the cleanup.
export function touchTrails() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined
  const canvas = document.createElement("canvas")
  canvas.className = "game-touch-fx"
  canvas.setAttribute("aria-hidden", "true")
  document.body.append(canvas)
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    canvas.remove()
    return undefined
  }
  const trails = new Map<string, Trail>()
  let bursts: Array<Burst> = []
  let frame = 0

  function draw() {
    if (!ctx) return
    const now = performance.now()
    const ratio = devicePixelRatio
    const width = Math.round(innerWidth * ratio)
    const height = Math.round(innerHeight * ratio)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    ctx.lineCap = "round"
    bursts = bursts.filter((burst) => now - burst.at < BURST_MS)
    for (const burst of bursts) drawBurst(ctx, burst, now)
    for (const [id, trail] of trails) {
      // A finger held still keeps its last point, for the trail's next stretch.
      trail.points = trail.points.filter(
        (point, at, all) =>
          now - point.at < TRAIL_MS || (trail.down && at === all.length - 1)
      )
      if (!trail.down && trail.points.length < 2) trails.delete(id)
      else drawTrail(ctx, trail, now)
    }
    frame = bursts.length || trails.size ? requestAnimationFrame(draw) : 0
  }
  const wake = () => {
    frame ||= requestAnimationFrame(draw)
  }

  function start(id: string, x: number, y: number) {
    const at = performance.now()
    trails.set(id, { points: [{ x, y, at }], down: true })
    bursts.push({ x, y, at })
    wake()
  }
  function move(id: string, x: number, y: number) {
    const trail = trails.get(id)
    if (!trail?.down) return
    trail.points.push({ x, y, at: performance.now() })
    wake()
  }
  function end(id: string) {
    const trail = trails.get(id)
    if (trail) trail.down = false
  }

  // Fingers through touch events, which keep coming while the page scrolls (pointer events stop
  // there); a mouse or pen through pointer events, only while pressed.
  function touchStart(event: TouchEvent) {
    if (off(event.target)) return
    for (const touch of event.changedTouches) {
      start(`t${touch.identifier}`, touch.clientX, touch.clientY)
    }
  }
  function touchMove(event: TouchEvent) {
    for (const touch of event.changedTouches) {
      move(`t${touch.identifier}`, touch.clientX, touch.clientY)
    }
  }
  function touchEnd(event: TouchEvent) {
    for (const touch of event.changedTouches) end(`t${touch.identifier}`)
  }
  function pointerDown(event: PointerEvent) {
    if (event.pointerType === "touch" || event.button !== 0) return
    if (off(event.target)) return
    start(`p${event.pointerId}`, event.clientX, event.clientY)
  }
  function pointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") return
    // Coalesced events keep a quick flick's curve, not just its ends.
    const moves = event.getCoalescedEvents?.() ?? []
    for (const each of moves.length ? moves : [event]) {
      move(`p${event.pointerId}`, each.clientX, each.clientY)
    }
  }
  function pointerEnd(event: PointerEvent) {
    if (event.pointerType !== "touch") end(`p${event.pointerId}`)
  }

  const passive = { capture: true, passive: true }
  const touches = [
    ["touchstart", touchStart],
    ["touchmove", touchMove],
    ["touchend", touchEnd],
    ["touchcancel", touchEnd],
  ] as const
  const pointers = [
    ["pointerdown", pointerDown],
    ["pointermove", pointerMove],
    ["pointerup", pointerEnd],
    ["pointercancel", pointerEnd],
  ] as const
  for (const [type, listener] of touches) {
    document.addEventListener(type, listener, passive)
  }
  for (const [type, listener] of pointers) {
    document.addEventListener(type, listener, passive)
  }
  return () => {
    for (const [type, listener] of touches) {
      document.removeEventListener(type, listener, passive)
    }
    for (const [type, listener] of pointers) {
      document.removeEventListener(type, listener, passive)
    }
    cancelAnimationFrame(frame)
    canvas.remove()
  }
}

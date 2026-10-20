import {
  canvasTexture,
  filmMaterial,
  type Foil,
  type FilmSpec,
} from "@workspace/ui/lib/game/film-material"
import { drawFoilRamp } from "@workspace/ui/lib/game/pack-art"
import type { Stops } from "@workspace/ui/lib/game/theme"
import * as THREE from "three"

export type { FilmSpec, Trim } from "@workspace/ui/lib/game/film-material"

// Product-shot studio: dim lavender sweep with a few softboxes, so the glossy
// film shows crisp highlights instead of mirroring a whole bright room.
function studio() {
  const room = new THREE.Scene()
  const parts: Array<{ dispose: () => void }> = []
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.MeshBasicMaterial
  ) => {
    parts.push(geometry, material)
    const mesh = new THREE.Mesh(geometry, material)
    room.add(mesh)
    return mesh
  }
  add(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.MeshBasicMaterial({ color: "#3a3248", side: THREE.BackSide })
  )
  const boxes = [
    [-14, 18, 22, 10, 24, 2.4],
    [24, 4, 12, 4, 30, 1.2],
    [0, -26, 18, 30, 6, 0.5],
  ] as const
  for (const [x, y, z, width, height, glow] of boxes) {
    const box = add(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(glow, glow, glow * 1.04),
      })
    )
    box.position.set(x, y, z)
    box.lookAt(0, 0, 0)
  }
  return { room, parts }
}

export type Disposable = { dispose: () => void }

// Lit studio sized to its canvas: 1 world unit ≈ 1 CSS px at depth 0.
export type Stage = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  // Seconds since mount, held at 0 for reduced motion.
  time: { value: number }
  still: boolean
  disposables: Array<Disposable>
  // Per-frame update; delta is in seconds, capped so tab switches don't jump.
  onFrame: (update: (time: number, delta: number) => void) => void
  // Caps the pixel ratio it draws at, at most; lower on a slow device.
  capRatio: (most: number) => void
  // While `check` is false (an animation playing out), frame times aren't
  // judged and the pixel ratio holds: resizing the canvas mid-way is a dropped
  // frame of its own. Always calm unless set.
  whenCalm: (check: () => boolean) => void
  disposed: boolean
  dispose: () => void
}

const FOV = 22

export function cameraDistance(height: number) {
  return height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
}

// Set once a WebGL context couldn't be made: later stages don't retry it (each
// try costs a failed context and a console error), and callers draw their
// still art instead.
// shortcut: a failure is taken as lasting for the page, retry on a later
// visit; drop the flag if a transient failure shows up on real devices.
let noWebGL = false

// Below 24 frames per second (median, so a hitch doesn't count, and a 30fps
// display cap isn't slow), the stage tries a lower pixel ratio, one that should
// make 30, down to 1 CSS px per px, or half that if under 8: sharpness gives,
// the motion doesn't. A try that isn't GAIN faster is undone, and not tried
// again until the scene changes (its draw calls): the pixels weren't what held
// it back. Nor is it tried while its own script takes most of a frame. Over 50
// frames per second below its full ratio, it tries a step back up, kept unless
// it slows under 24 again. Frames only count once the stage has run WARMUP
// seconds since it started or came back, in windows not taken up by the
// page's other work (start-up, a new chunk, React). Later stages start at the
// ratio the last one kept.
const SLOW_FRAME = 1 / 24
const STUCK_FRAME = 1 / 8
const TARGET_FRAME = 1 / 30
const FAST_FRAME = 1 / 50
const GAIN = 0.85
const WARMUP = 3
// Share of a window the page's other long tasks may take before it's set aside.
const BUSY = 0.25
// Share of a frame the stage's own script may take for pixels to be the limit.
const OWN = 0.5
// Judged over this many frames, or fewer if they take this many seconds.
const MEASURE = { frames: 12, seconds: 3, least: 3 }
let ratioCap = Infinity

// When stage frames ran, and the long tasks that held none of them, recent.
const frameTimes: Array<number> = []
let foreign: Array<{ start: number; end: number }> = []
let longTasks: PerformanceObserver | null = null
// Safari and Firefox have no long tasks: there, only the warmup and the undo
// keep a busy start-up from costing sharpness.
function watchLongTasks() {
  if (longTasks) return
  if (!PerformanceObserver.supportedEntryTypes.includes("longtask")) return
  longTasks = new PerformanceObserver((list) => {
    for (const task of list.getEntries()) {
      const end = task.startTime + task.duration
      const ours = frameTimes.some((at) => at >= task.startTime && at <= end)
      if (!ours) foreign.push({ start: task.startTime, end })
    }
  })
  longTasks.observe({ type: "longtask" })
}

// Notes a stage frame at `now`, forgetting those over 5 s old.
function noteFrame(now: number) {
  frameTimes.push(now)
  while ((frameTimes[0] ?? now) < now - 5000) frameTimes.shift()
}

// Milliseconds of other long tasks since `since`; forgets older ones.
function busySince(since: number) {
  foreign = foreign.filter((task) => task.end > since - 5000)
  return foreign.reduce(
    (sum, task) => sum + Math.max(0, task.end - Math.max(task.start, since)),
    0
  )
}

// Work outside a stage's own loop that shares its frames (the thumbs' loop
// drawing cards): a window it takes up isn't judged, as for a long task.
export function noteWork(start: number, end: number) {
  if (end - start > 4) foreign.push({ start, end })
}

const median = (values: Array<number>) =>
  // oxlint-disable-next-line unicorn/no-array-sort -- ES2022 lib, a copy
  [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0

// The pixel ratio `renderer` draws `canvas` at, fitted to how fast the device
// draws it (see SLOW_FRAME): `frame` takes each drawn frame's length (s), the
// stage's own script time in it (ms) and whether the scene is calm; `settle`
// restarts the warmup, as after a pause or an animation.
function scaleTo(renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement) {
  let full = Math.min(devicePixelRatio * 1.5, 3)
  // Frame lengths and own script times in the window being measured.
  let frames: Array<number> = []
  let own: Array<number> = []
  let since = performance.now()
  // The try in progress, with the ratio and pace before it; the draw calls of
  // a scene a try down didn't help; whether a try up slowed it.
  let trying: { ratio: number; pace: number; up: boolean } | null = null
  let stuck: number | null = null
  let topped = false
  watchLongTasks()
  const setRatio = (next: number) => {
    renderer.setPixelRatio(next)
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  }
  const settle = () => {
    since = performance.now()
    frames = []
    own = []
  }
  // Keeps or undoes a try, or tries another ratio.
  const judge = (pace: number, script: number) => {
    const ratio = renderer.getPixelRatio()
    const calls = renderer.info.render.calls
    if (trying) {
      const tried = trying
      trying = null
      const worked = tried.up ? pace <= SLOW_FRAME : pace <= tried.pace * GAIN
      if (worked) {
        ratioCap = ratio
        return
      }
      setRatio(tried.ratio)
      if (tried.up) topped = true
      else stuck = calls
      return
    }
    if (pace <= FAST_FRAME && ratio < full && !topped) {
      trying = { ratio, pace, up: true }
      setRatio(Math.min(full, ratio * Math.SQRT2))
      return
    }
    if (pace <= SLOW_FRAME || script > pace * OWN) return
    if (stuck !== null && Math.abs(calls - stuck) <= stuck * 0.25) return
    const floor = pace > STUCK_FRAME ? 0.5 : 1
    if (ratio <= floor) return
    stuck = null
    trying = { ratio, pace, up: false }
    // Fill cost goes with the pixel count, the square of the ratio.
    setRatio(Math.max(floor, ratio * Math.sqrt(TARGET_FRAME / pace)))
  }
  return {
    settle,
    cap(most: number) {
      full = Math.min(full, most)
      if (renderer.getPixelRatio() > full) setRatio(full)
    },
    frame(length: number, script: number, calm: boolean) {
      const now = performance.now()
      noteFrame(now)
      // Mid-animation: nothing judged, nothing changed, and it settles in
      // again after (it may have built, uploaded or compiled meanwhile).
      if (!calm) {
        settle()
        return
      }
      if (now - since < WARMUP * 1000) {
        frames = []
        own = []
        return
      }
      frames.push(length)
      own.push(script / 1000)
      const spent = frames.reduce((sum, each) => sum + each, 0)
      if (frames.length < MEASURE.frames) {
        if (spent < MEASURE.seconds || frames.length < MEASURE.least) return
      }
      const pace = median(frames)
      const ownPace = median(own)
      frames = []
      own = []
      // The rest of the page was busy: this window says nothing about us.
      if (busySince(now - spent * 1000) > spent * 1000 * BUSY) return
      judge(pace, ownPace)
    },
  }
}

// A context the browser doesn't give back within this many seconds (of the
// page being shown) is gone: the canvas fires STAGE_GONE so its owner can
// start again on a new canvas. After GONE_MAX of those, later stages are
// still art.
const LOST_FOR = 4
const GONE_MAX = 2
let gone = 0
export const STAGE_GONE = "stagegone"

// three's BRDF lookup texture, as `renderer` bound it to a physical material
// in `scene`. three shares it across the page, and every renderer that drew
// with it hangs a dispose listener on it, which holds the renderer, its
// context and its canvas alive for good; disposing it lets go of them (live
// renderers upload the tiny texture again).
const dig = (from: unknown, key: string): unknown =>
  from instanceof Object ? Reflect.get(from, key) : undefined
function sharedLut(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  let lut: unknown = null
  scene.traverse((object) => {
    if (lut instanceof THREE.Texture || !(object instanceof THREE.Mesh)) return
    const materials: Array<unknown> = [object.material].flat()
    for (const material of materials) {
      if (!(material instanceof THREE.MeshPhysicalMaterial)) continue
      const bound = renderer.properties.get(material)
      lut = dig(dig(dig(bound, "uniforms"), "dfgLUT"), "value")
      if (lut instanceof THREE.Texture) return
    }
  })
  return lut instanceof THREE.Texture ? lut : null
}

const always = () => true

// `shown`: when given, frames are skipped while it's false. Null when WebGL
// isn't there: show still art instead.
export function createStage(
  canvas: HTMLCanvasElement,
  shown: () => boolean = () => true
): Stage | null {
  if (noWebGL) return null
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    })
  } catch {
    noWebGL = true
    return null
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio * 1.5, 3, ratioCap))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  renderer.toneMapping = THREE.NeutralToneMapping

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const light = () => {
    const { room, parts } = studio()
    const target = pmrem.fromScene(room, 0.02)
    for (const part of parts) part.dispose()
    scene.environment = target.texture
    return target
  }
  let environment = light()
  let lostFor: ReturnType<typeof setTimeout> | undefined
  const onLost = () => {
    clearTimeout(lostFor)
    lostFor = setTimeout(() => {
      if (!renderer.getContext().isContextLost()) return
      // A hidden page (a phone app in the background) gets it back on return.
      if (document.hidden) onLost()
      else {
        gone += 1
        if (gone >= GONE_MAX) noWebGL = true
        canvas.dispatchEvent(new Event(STAGE_GONE))
      }
    }, LOST_FOR * 1000)
  }
  // A lost context comes back empty: three uploads the art again by itself,
  // but the studio's lighting was rendered on the GPU, so render it again.
  const onRestored = () => {
    clearTimeout(lostFor)
    environment.dispose()
    environment = light()
  }
  canvas.addEventListener("webglcontextlost", onLost)
  canvas.addEventListener("webglcontextrestored", onRestored)
  scene.add(new THREE.AmbientLight("#ffffff", 1.35))
  const key = new THREE.DirectionalLight("#ffffff", 1.4)
  key.position.set(-300, 420, 520)
  scene.add(key)

  const camera = new THREE.PerspectiveCamera(
    FOV,
    canvas.clientWidth / canvas.clientHeight,
    10,
    4000
  )
  camera.position.z = cameraDistance(canvas.clientHeight)

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches
  const time = { value: 0 }
  const updates: Array<(time: number, delta: number) => void> = []
  const disposables: Array<Disposable> = [
    renderer,
    pmrem,
    {
      dispose() {
        clearTimeout(lostFor)
        canvas.removeEventListener("webglcontextlost", onLost)
        canvas.removeEventListener("webglcontextrestored", onRestored)
        environment.dispose()
      },
    },
  ]
  const clock = new THREE.Timer()
  const scaler = scaleTo(renderer, canvas)
  // Calm unless its scene says otherwise (whenCalm).
  let calm = always
  const loop = (stamp: DOMHighResTimeStamp) => {
    const start = performance.now()
    clock.update(stamp)
    if (!shown()) return
    const frame = clock.getDelta()
    const delta = Math.min(frame, 0.1)
    if (!still) time.value += delta
    for (const update of updates) update(time.value, delta)
    renderer.render(scene, camera)
    scaler.frame(frame, performance.now() - start, calm())
  }
  // Draws only while the canvas is on screen: a hidden tab, a closed dialog or
  // a scrolled-away canvas costs no frames, and picks up on its next frame.
  const visibility = new IntersectionObserver(([entry]) => {
    const onScreen = entry?.isIntersecting ?? true
    scaler.settle()
    renderer.setAnimationLoop(onScreen && !stage.disposed ? loop : null)
  })
  // The thumbs' offscreen stage runs its own loop.
  if (canvas.isConnected) visibility.observe(canvas)
  // Back from the background, it settles in again too.
  const onPageShown = () => scaler.settle()
  document.addEventListener("visibilitychange", onPageShown)
  disposables.push({
    dispose() {
      visibility.disconnect()
      document.removeEventListener("visibilitychange", onPageShown)
    },
  })
  renderer.setAnimationLoop(loop)

  const stage: Stage = {
    renderer,
    scene,
    camera,
    time,
    still,
    disposables,
    onFrame: (update) => updates.push(update),
    capRatio: (most) => scaler.cap(most),
    whenCalm(check) {
      calm = check
    },
    disposed: false,
    dispose() {
      if (stage.disposed) return
      stage.disposed = true
      renderer.setAnimationLoop(null)
      const lut = sharedLut(renderer, scene)
      for (const item of disposables) item.dispose()
      // Lets go of this renderer; live ones upload the tiny texture again.
      lut?.dispose()
      // Once its canvas is gone, hands the context back now rather than at
      // some garbage collection: browsers keep about 16, evicting the oldest,
      // the Packs pack. A canvas still on the page may get a new stage, which
      // reuses its context. After dispose, which takes off three's lost
      // handler: WebKit keeps a context whose loss is prevented.
      setTimeout(() => {
        if (!canvas.isConnected) renderer.forceContextLoss()
      })
    },
  }
  return stage
}

// Still art on a 2D canvas, for when there's no WebGL: `paint` draws it in CSS
// px, again whenever the canvas resizes or `redraw` asks.
export type Still = { redraw: () => void; dispose: () => void }

export function createStill(
  canvas: HTMLCanvasElement,
  paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
): Still {
  const ctx = canvas.getContext("2d")
  let disposed = false
  const redraw = () => {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!ctx || disposed || !width || !height) return
    const ratio = Math.min(devicePixelRatio, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    paint(ctx, width, height)
  }
  const fit = new ResizeObserver(redraw)
  fit.observe(canvas)
  return {
    redraw,
    dispose() {
      disposed = true
      fit.disconnect()
    },
  }
}

export type FilmArt = Awaited<ReturnType<FilmSpec["draw"]>>

// A film's art flat on `ctx`, `width` CSS px wide with its top-left at x, y:
// its foil (the spec's stops, on the diagonal) through the film's shape, the
// print over it, and its marquees at rest. `spec.width` is the film's own.
export function paintFilm(
  ctx: CanvasRenderingContext2D,
  { front, shape, marquees = [] }: FilmArt,
  spec: { width: number; stops: Stops },
  { x, y, width }: { x: number; y: number; width: number }
) {
  const height = (width * front.height) / front.width
  const layer = document.createElement("canvas")
  layer.width = front.width
  layer.height = front.height
  const film = layer.getContext("2d")
  if (!film) return
  const foil = film.createLinearGradient(0, 0, layer.width, layer.height)
  for (const [color, at] of spec.stops) foil.addColorStop(at, color)
  film.fillStyle = foil
  film.fillRect(0, 0, layer.width, layer.height)
  film.globalCompositeOperation = "destination-in"
  film.drawImage(shape, 0, 0, layer.width, layer.height)
  film.globalCompositeOperation = "source-over"
  film.drawImage(front, 0, 0)
  // Texels per film px.
  const scale = layer.width / spec.width
  for (const { art, box, cycle } of marquees) {
    const texels = art.width / cycle
    film.drawImage(
      art,
      0,
      0,
      Math.min(art.width, box.width * texels),
      art.height,
      box.x * scale,
      box.y * scale,
      Math.min(art.width / texels, box.width) * scale,
      box.height * scale
    )
  }
  ctx.drawImage(layer, x, y, width, height)
}

// A film and, given a floor, its mirror image: `subject` is what you pose, the
// `reflection` group must be posed the same (see mirrorPose).
export type Film = {
  subject: THREE.Group
  reflection: THREE.Group
  // Surface geometry of each face; the rear is the front turned round y.
  faces: { front: THREE.BufferGeometry; rear: THREE.BufferGeometry }
  // Turns the foil's light without turning the film.
  tilt: THREE.Vector2
  // Fades the mirror image, 0..1.
  mirror: { value: number }
  // Resolves once the art is drawn and on the film.
  ready: Promise<void>
}

type FilmOptions = {
  // Mirror floor height; no reflection without one.
  floorY?: number
  // Planes cutting the film and its solid parts away.
  clip?: Array<THREE.Plane>
}

export function addFilm(
  stage: Stage,
  spec: FilmSpec,
  { floorY, clip }: FilmOptions = {}
): Film {
  const { renderer, scene, disposables } = stage
  const subject = new THREE.Group()
  const reflection = new THREE.Group()
  scene.add(subject)
  if (floorY !== undefined) {
    const mirror = new THREE.Group()
    mirror.position.y = 2 * floorY
    mirror.scale.y = -1
    mirror.add(reflection)
    scene.add(mirror)
  }
  const back = spec.geometry.clone().rotateY(Math.PI)
  for (const solid of spec.solids ?? []) {
    if (clip) for (const part of solid.material) part.clippingPlanes = clip
    subject.add(solid)
  }
  const foil: Foil = {
    ramp: canvasTexture(drawFoilRamp(spec.stops), renderer),
    time: stage.time,
    tilt: new THREE.Vector2(),
    mirror: { value: 1 },
  }
  disposables.push(
    spec.geometry,
    back,
    foil.ramp,
    ...(spec.solids ?? []).flatMap((solid) => [
      solid.geometry,
      ...solid.material,
    ])
  )

  async function dress() {
    const { front, rear, shape, marquees = [] } = await spec.draw()
    if (stage.disposed) return
    const outline = canvasTexture(shape, renderer)
    disposables.push(outline)
    const printed = marquees.map((marquee) => {
      const map = canvasTexture(marquee.art, renderer)
      map.premultiplyAlpha = true
      map.wrapS = THREE.RepeatWrapping
      disposables.push(map)
      return { ...marquee, map }
    })
    const faces = rear
      ? ([
          [front, spec.geometry],
          [rear, back],
        ] as const)
      : ([[front, spec.geometry]] as const)
    for (const [art, surface] of faces) {
      const map = canvasTexture(art, renderer)
      // Premultiplied so mipmaps don't fringe the ink edges with black.
      map.premultiplyAlpha = true
      // Marquees print on the front only.
      const print = {
        ink: map,
        shape: outline,
        foil,
        marquees: art === front ? printed : [],
      }
      const material = filmMaterial(spec, print)
      if (clip) material.clippingPlanes = clip
      disposables.push(map, material)
      subject.add(new THREE.Mesh(surface, material))
      if (floorY === undefined) continue
      const mirrored = filmMaterial(spec, print, true)
      disposables.push(mirrored)
      reflection.add(new THREE.Mesh(surface, mirrored))
    }
  }

  return {
    subject,
    reflection,
    faces: { front: spec.geometry, rear: back },
    tilt: foil.tilt,
    mirror: foil.mirror,
    ready: dress(),
  }
}

export function mirrorPose({ subject, reflection }: Film) {
  reflection.position.copy(subject.position)
  reflection.quaternion.copy(subject.quaternion)
  reflection.scale.copy(subject.scale)
  reflection.visible = subject.visible
}

// A WebGL program three made, as far as warm() needs it.
type Program = { isReady: () => boolean; getUniforms: () => unknown }
const isProgram = (value: unknown): value is Program =>
  value instanceof Object && "isReady" in value && "getUniforms" in value
const isTexture = (value: unknown): value is THREE.Texture =>
  value instanceof THREE.Texture
// How long a program may compile on the GPU's threads before warm() waits
// for it on the main thread anyway, in ms.
const COMPILE_WAIT = 600

// Readies `objects` (hidden, or not in view yet) for their first frame, so it
// doesn't stall the animation they show in: their shaders compile and link,
// and their art uploads, now, one step a frame (each can take tens of ms on a
// phone; all at once, a long frame). Shaders compile on the GPU's own threads
// where the browser can (KHR_parallel_shader_compile). Steps already done
// are skipped.
export function warm(stage: Stage, objects: Array<THREE.Object3D>) {
  const { renderer, scene, camera } = stage
  const meshes: Array<THREE.Object3D> = []
  const materials = new Set<unknown>()
  for (const object of objects) {
    object.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return
      meshes.push(part)
      const worn: Array<unknown> = [part.material].flat()
      for (const material of worn) materials.add(material)
    })
  }
  // Its programs, and its textures: on the material and in its shader's own
  // uniforms (the foil ramp, the marquees).
  const programs = new Set<Program>()
  const textures = new Set<THREE.Texture>()
  const gather = () => {
    for (const material of materials) {
      if (!(material instanceof Object)) continue
      const bound = renderer.properties.get(material)
      const program = dig(bound, "currentProgram")
      if (isProgram(program)) programs.add(program)
      const uniforms = dig(bound, "uniforms")
      const values: Array<unknown> = Object.values(material)
      if (uniforms instanceof Object) {
        for (const uniform of Object.values(uniforms))
          values.push(dig(uniform, "value"))
      }
      for (const value of values) if (isTexture(value)) textures.add(value)
    }
  }
  // One mesh a frame: building a program's source is a few ms of script.
  const steps: Array<() => boolean> = [
    ...meshes.map((mesh) => () => {
      renderer.compile(mesh, camera, scene)
      return true
    }),
    () => {
      gather()
      // Each program's link checked once the GPU is done with it, one a
      // frame, then each texture uploaded, one a frame.
      const since = performance.now()
      steps.splice(
        1,
        0,
        ...[...programs].map((program) => () => {
          if (!program.isReady() && performance.now() - since < COMPILE_WAIT)
            return false
          program.getUniforms()
          return true
        }),
        // Uploads only what's new or changed.
        ...[...textures].map((texture) => () => {
          renderer.initTexture(texture)
          return true
        })
      )
      return true
    },
  ]
  const next = () => {
    if (stage.disposed) return
    const step = steps[0]
    if (!step) return
    if (step()) steps.shift()
    requestAnimationFrame(next)
  }
  requestAnimationFrame(next)
}

// Where to aim, null when away. Mice aim on hover, -0.5..0.5 across the
// element; with `touch`, a finger drags from where it landed, -1..1.
export function trackPointer(
  element: HTMLElement,
  stage: Stage,
  { touch = false } = {}
) {
  // `touch` is true while the aim comes from a finger.
  const pointer: { at: { x: number; y: number } | null; touch: boolean } = {
    at: null,
    touch: false,
  }
  let origin = { x: 0, y: 0 }
  const onDown = (event: PointerEvent) => {
    if (!touch || event.pointerType !== "touch") return
    origin = { x: event.clientX, y: event.clientY }
    pointer.at = { x: 0, y: 0 }
    pointer.touch = true
  }
  const onMove = (event: PointerEvent) => {
    const box = element.getBoundingClientRect()
    if (event.pointerType === "touch") {
      if (!touch || !pointer.at) return
      // A half-width swipe reaches the full turn.
      const reach = Math.min(box.width, box.height) / 2
      pointer.at = {
        x: THREE.MathUtils.clamp((event.clientX - origin.x) / reach, -1, 1),
        y: THREE.MathUtils.clamp((event.clientY - origin.y) / reach, -1, 1),
      }
      return
    }
    // A held mouse button is a drag, not a hover.
    if (event.buttons) return
    pointer.touch = false
    pointer.at = {
      x: (event.clientX - box.left) / box.width - 0.5,
      y: (event.clientY - box.top) / box.height - 0.5,
    }
  }
  const onLeave = () => {
    pointer.at = null
    pointer.touch = false
  }
  element.addEventListener("pointerdown", onDown)
  element.addEventListener("pointermove", onMove)
  element.addEventListener("pointerleave", onLeave)
  element.addEventListener("pointercancel", onLeave)
  stage.disposables.push({
    dispose() {
      element.removeEventListener("pointerdown", onDown)
      element.removeEventListener("pointermove", onMove)
      element.removeEventListener("pointerleave", onLeave)
      element.removeEventListener("pointercancel", onLeave)
    },
  })
  return pointer
}

// One film on its own stage: sways, bobs and turns towards the pointer.
// `shown`: frames are skipped while it's false (see createStage). Null
// without WebGL.
export function mountFilmScene(
  canvas: HTMLCanvasElement,
  spec: FilmSpec,
  mirror = true,
  shown?: () => boolean
) {
  const stage = createStage(canvas, shown)
  if (!stage) return null
  // Mirror floor just under the lowest bob (+6).
  const film = addFilm(stage, spec, {
    floorY: mirror ? -spec.height / 2 + 4 : undefined,
  })
  const pointer = trackPointer(canvas, stage, { touch: true })
  const { subject } = film
  stage.onFrame((time, delta) => {
    const at = pointer.at
    const sway = at ? 0 : Math.sin((time * Math.PI * 2) / 9) * 0.14
    const targetY = sway + (at?.x ?? 0) * 0.8
    const targetX = (at?.y ?? 0) * 0.7
    const ease = 1 - 0.92 ** (delta * 60)
    subject.rotation.y += (targetY - subject.rotation.y) * ease
    subject.rotation.x += (targetX - subject.rotation.x) * ease
    // Same 5s bob as the CSS packs.
    subject.position.y = 6 + 4 * (1 - Math.cos((time * Math.PI * 2) / 5))
    mirrorPose(film)
  })
  return { ...stage, film }
}

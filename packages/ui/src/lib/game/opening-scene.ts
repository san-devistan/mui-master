import {
  cardBack,
  cardFilm,
  cardShine,
  newSticker,
} from "@workspace/ui/lib/game/card-scene"
import {
  addFilm,
  cameraDistance,
  createStage,
  mirrorPose,
  trackPointer,
  type Film,
} from "@workspace/ui/lib/game/film-scene"
import {
  CUT,
  drawPackArt,
  PACK_H,
  PACK_W,
  packShape,
} from "@workspace/ui/lib/game/pack-art"
import {
  curl,
  cutGlow,
  packInside,
  packFilm,
  STRIP_BAND,
} from "@workspace/ui/lib/game/pack-scene"
import {
  CELEBRATION,
  celebrations,
  clamp01,
  easeInOut,
  easeOut,
  easeOutBack,
  lerp,
  mix,
  PILE_ZOOM,
  place,
  pose,
  SHINE,
  span,
  type Celebrated,
  type Pose,
} from "@workspace/ui/lib/game/reveal-motion"
import type { GameSong } from "@workspace/ui/lib/game/theme"
import * as THREE from "three"

// Phone-sized stage, in CSS px; world y points up from the middle.
export const OPENING_W = 393
export const OPENING_H = 852

const PACK_Y = 40
const PACK_TOP = PACK_Y + PACK_H / 2
// Camera zoom on the waiting pack and on the opened pile.
const IDLE_ZOOM = 1.3
// Idle camera height: just under the pack's middle, so it sits centred between
// the status bar with its mirror fading out above the Open button.
const IDLE_CAMERA_Y = 25
// Cut view: zoomed in so the pack spans the screen and runs past its bottom,
// with its top at mid-screen and the cut line just under it.
const CUT_ZOOM = 1.62
const CUT_PACK_TOP = 0.5
const halfView = (zoom: number) => OPENING_H / 2 / zoom
const CUT_CAMERA_Y = PACK_TOP + (CUT_PACK_TOP - 0.5) * 2 * halfView(CUT_ZOOM)

// The cut line on screen in the cut view, as fractions of the stage.
export const CUT_LINE = {
  top: 0.5 + (CUT_CAMERA_Y - (PACK_TOP - CUT)) / (2 * halfView(CUT_ZOOM)),
  width: (PACK_W * CUT_ZOOM) / OPENING_W,
}

// Mirror floor just under the pack's lowest bob.
const FLOOR_Y = PACK_Y - PACK_H / 2 - 2
// The pile sits mid-screen once the camera has pulled back.
const CARD_Y = 0
// Pile: cards stacked square, a hair apart (card stock is 2 thick).
const DEPTH = 3
// Dragging turns the whole pile to show its rarity-coloured edges: radians per
// stage width dragged, up to 66°. Dragging is the mobile way to tilt the
// pile; desktop hover tilts it too, but only while not dragging.
const TURN = 2.4
const MAX_TURN = THREE.MathUtils.degToRad(66)
// Swiped cards fly this far out to the side they were thrown.
const OUT = OPENING_W
// Inside the pack the cards shrink to clear its sides and seals, and sit
// deep enough to stay hidden below the cut (in pack space, from its middle).
const PACKED = 0.8
const PACKED_Y = -60

// Opening timeline, in seconds after the cut: the strip snaps off and is
// thrown away and the pack gapes towards the viewer. Then the pack slides down
// off the cards and out of view while the cards only ease up a little, to the
// pile's height, and the camera pulls back. Once clear, the stack turns to face
// the viewer. They stay on screen throughout and never go up then down.
const CURL = [0, 0.3] as const
// The strip's bend, 0..1 of a full curl: a stiff tab, not a ribbon.
const BEND = 0.18
const GAPE = [0, 0.35] as const
const DROP = [0.3, 1.1] as const
const PULL_BACK = [0.4, 1.4] as const
const SLIDE = [0.3, 1.2] as const
const SETTLE = [1.0, 1.6] as const
// The strip is heavy: still caught on the pack for a beat, pulled taut, then
// snapped free. It flies on a thrown arc (fast up, hangs at the top, falls
// faster and faster), spinning slowly and evenly as it goes. It shrinks into
// the background and drops out of view past the right edge. Per second, in
// world px; with this camera, the top of the arc stays on screen.
const STRIP_MID = new THREE.Vector3(0, PACK_H / 2 - STRIP_BAND / 2, 0)
const HOLD = 0.14
const FLIGHT = 2.2
// Twist along the strip once free: a slow wobble, end to end, in radians.
const TWIST = 0.55
const THROW = { x: 190, y: 820, z: -950, gravity: 1300 }
const SPIN = { x: -1.3, y: 0.5, z: -2.1 }

export type OpeningPhase = "idle" | "cut" | "open"

// The NEW badge waits until its card is on top and has settled, then is
// pressed on: it eases up from a little smaller, lifted and turned, and
// settles flat. Seconds: the wait once the card's on top (its swipe in, or its
// celebration, to finish), and the press itself.
const STICKER_WAIT = 0.45
const STICKER_PRESS = 0.7

// Eases `value` into ±`limit`: follows it near the middle, then resists more
// and more, so a tilt pushed far settles softly instead of hitting a stop.
const soften = (value: number, limit: number) =>
  limit * Math.tanh(value / limit)

// depth 0 is the top card; negative depths are swiped off to `side`.
function pilePose(depth: number, side: number): Pose {
  if (depth < 0) {
    return pose({ x: side * OUT, y: CARD_Y + 60, z: 20, rz: -side * 0.5 })
  }
  return pose({ y: CARD_Y, z: -DEPTH * depth })
}

// The stack of `count` cards inside the pack posed at `pack`, standing upright
// (only the pack's turn, not its lean towards the viewer) and centred on its
// mouth, `y` up from the pack's middle.
function packedPose(count: number, pack: Pose, y: number): Pose {
  const upright = new THREE.Euler(0, pack.ry, pack.rz)
  const mouth = new THREE.Vector3(0, PACK_H / 2 - CUT, 0).applyEuler(
    new THREE.Euler(pack.rx, pack.ry, pack.rz)
  )
  const lean = new THREE.Vector3(0, PACK_H / 2 - CUT, 0).applyEuler(upright)
  const at = new THREE.Vector3(0, y, ((count - 1) / 2) * DEPTH)
    .applyEuler(upright)
    .add(mouth.sub(lean).setY(0))
  return {
    ...pack,
    x: pack.x + at.x,
    y: pack.y + at.y,
    z: pack.z + at.z,
    rx: 0,
    s: PACKED,
  }
}

// Card `index` of a stack posed at `stack`: offset back along the stack's
// normal, so the cards stay parallel and never cut through each other.
function inStack(stack: Pose, index: number): Pose {
  const at = new THREE.Vector3(0, 0, -DEPTH * index).applyEuler(
    new THREE.Euler(stack.rx, stack.ry, stack.rz)
  )
  return { ...stack, x: stack.x + at.x, y: stack.y + at.y, z: stack.z + at.z }
}

// The cut strip `time` seconds after the cut, turning about its own middle
// rather than the pack's.
function flownStrip(packed: Pose, time: number): Pose {
  // Capped: a still stage jumps straight to the end with time = Infinity.
  const t = Math.min(time, HOLD + FLIGHT)
  // Caught: it strains up and leans back on its free end, then lets go.
  const strain = Math.sin((Math.PI / 2) * clamp01(t / HOLD))
  const flying = Math.max(0, t - HOLD)
  // Released with a shudder that dies out in a moment.
  const shudder = 0.08 * Math.exp(-flying / 0.08) * Math.sin(flying * 40)
  const strained = t < HOLD ? strain : 1
  const turn = new THREE.Euler(
    packed.rx - 0.12 * strained + SPIN.x * flying,
    packed.ry + SPIN.y * flying,
    packed.rz - 0.06 * strained + SPIN.z * flying + shudder
  )
  const from = STRIP_MID.clone().applyEuler(
    new THREE.Euler(packed.rx, packed.ry, packed.rz)
  )
  const to = STRIP_MID.clone().applyEuler(turn)
  return {
    ...packed,
    x: packed.x + from.x - to.x + THROW.x * flying,
    y:
      packed.y +
      from.y -
      to.y +
      6 * strain +
      THROW.y * flying -
      (THROW.gravity / 2) * flying ** 2,
    z: packed.z + from.z - to.z + THROW.z * flying,
    rx: turn.x,
    ry: turn.y,
    rz: turn.z,
  }
}

export type OpeningScene = {
  setPhase: (phase: OpeningPhase) => void
  // Top card of the pile; cards before it were swiped off to `side` (±1).
  show: (index: number, side: number) => void
  // Live swipe offset, in stage widths (positive = dragged right).
  drag: (share: number) => void
  // Where the finger is along the cut, 0..1; 1 once it's cut.
  setCut: (share: number) => void
  // First pull of an epic or legendary card: play its entrance.
  celebrate: (index: number, rarity: Celebrated) => void
  dispose: () => void
}

export function mountOpeningScene(
  canvas: HTMLCanvasElement,
  songs: ReadonlyArray<GameSong & { isNew?: boolean }>,
  covers: ReadonlyArray<string>,
  onOpened: () => void
): OpeningScene {
  const stage = createStage(canvas)
  // Cards are hidden below the pack's opening until it has dropped away, so
  // they read as coming out of the pack rather than in front of it.
  const mouth = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  stage.renderer.localClippingEnabled = true
  const art = drawPackArt(covers)
  const packPart = (part: "body" | "strip", band?: number, floorY?: number) =>
    addFilm(
      stage,
      packFilm(async () => ({ ...(await art), shape: packShape(part) }), band),
      { floorY }
    )
  const body = packPart("body", undefined, FLOOR_Y)
  // Only the top band, so it can curl without dragging the whole film along.
  const strip = packPart("strip", STRIP_BAND)
  const glow = cutGlow(stage.time)
  body.subject.add(glow.mesh)
  const inside = packInside(stage.time)
  body.subject.add(inside)
  stage.disposables.push(
    glow.mesh.geometry,
    glow.mesh.material,
    inside.geometry,
    inside.material
  )
  // Each NEW card's badge, its resting pose, and when its card came on top.
  const stickers: Array<{
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
    rest: { z: number; rz: number }
    chosen: number | null
  } | null> = []
  const cards: Array<Film> = songs.map((song) => {
    const card = addFilm(stage, cardFilm(song), { clip: [mouth] })
    if (song.isNew) {
      const sticker = newSticker(
        stage.renderer,
        undefined,
        undefined,
        stage.time
      )
      sticker.mesh.material.clippingPlanes = [mouth]
      card.subject.add(sticker.mesh)
      stage.disposables.push(sticker)
      stickers.push({
        mesh: sticker.mesh,
        rest: { z: sticker.mesh.position.z, rz: sticker.mesh.rotation.z },
        chosen: null,
      })
    } else stickers.push(null)
    return card
  })
  const backs = cardBack(stage.renderer)
  backs.material.clippingPlanes = [mouth]
  for (const card of cards) {
    card.subject.add(new THREE.Mesh(backs.geometry, backs.material))
  }
  const shine = cardShine()
  stage.disposables.push(backs, shine)
  const poses = songs.map(() => pose({}))
  const sides = songs.map(() => -1)
  let party: { index: number; rarity: Celebrated; start: number } | null = null
  // Like the collection card: hover tilts it, and a finger drags it round.
  const pointer = trackPointer(canvas.parentElement ?? canvas, stage, {
    touch: true,
  })

  let phase: OpeningPhase = "idle"
  let elapsed = 0
  let current = 0
  let dragged = 0
  // Camera zoom and height; `from` holds them when the cut finished, so the
  // pull back to the pile starts from there.
  const view = { zoom: IDLE_ZOOM, y: IDLE_CAMERA_Y }
  const from = { ...view }
  let curled = 0
  let twisted = 0
  let opened = false
  const tilt = { x: 0, y: 0 }
  const distance = cameraDistance(OPENING_H)
  const end = SETTLE[1]
  // The pack as posed this frame: the cards ride inside it until they're out.
  let pack = pose({})

  function posePack(time: number) {
    const enter = phase === "idle" ? easeOutBack(clamp01(elapsed / 0.8)) : 1
    const bob =
      phase === "idle" ? 4 * (1 - Math.cos((time * Math.PI * 2) / 5)) : 0
    const drop = phase === "open" ? span(elapsed, DROP) ** 2 : 0
    const gape = phase === "open" ? easeOutBack(span(elapsed, GAPE)) : 0
    // Where the pack is held; the cut strip flies off from here.
    const held = pose({
      y: lerp(-700, PACK_Y + bob, enter),
      // Softly held to about the hover range, so a finger can't tip it much
      // further: under 14° lean and 23° turn.
      rx: soften(tilt.y * 0.5, 0.25),
      ry: soften(tilt.x * 0.8, 0.4),
    })
    // Drops straight down off the upright cards rising out of its mouth.
    const gaping = { ...held, rx: held.rx + 0.32 * gape }
    const packed = { ...gaping, y: gaping.y - 1100 * drop }
    pack = gaping
    place(body.subject, packed)
    // Puffs the films apart so the opened mouth shows.
    body.subject.scale.z = 1 + 1.6 * gape
    mirrorPose(body)
    // Only while the pack is above the floor, not rising up or dropping away.
    body.reflection.visible = packed.y - PACK_H / 2 >= FLOOR_Y
    // Clip plane across the pack's mouth, moving with it: cards only show
    // once they're out, as it drops down off them.
    const turn = new THREE.Euler(packed.rx, packed.ry, packed.rz)
    mouth.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0).applyEuler(turn),
      new THREE.Vector3(0, PACK_H / 2 - CUT, 0)
        .applyEuler(turn)
        .add(new THREE.Vector3(packed.x, packed.y, packed.z))
    )
    const curling = phase === "open" ? BEND * easeOut(span(elapsed, CURL)) : 0
    const freed = phase === "open" ? Math.min(elapsed, HOLD + FLIGHT) - HOLD : 0
    // Twists one way and back as it flies, easing in after the release.
    const twisting =
      freed > 0 ? TWIST * clamp01(freed / 0.3) * Math.sin(freed * 2.6) : 0
    if (curling !== curled || twisting !== twisted) {
      curled = curling
      twisted = twisting
      curl(strip.faces.front, curling, twisting)
      curl(strip.faces.rear, curling, twisting)
    }
    inside.visible = phase === "open"
    place(strip.subject, phase === "open" ? flownStrip(held, elapsed) : packed)
  }

  function poseCards(time: number, ease: number) {
    const sway = pointer.at ? 0 : Math.sin((time * Math.PI * 2) / 9) * 0.14
    // While a finger drags, hover tilt eases out and the drag takes over.
    const hover = 1 - clamp01(Math.abs(dragged) * 6)
    const turn = THREE.MathUtils.clamp(
      (tilt.x * 0.8 + sway) * hover + dragged * TURN,
      -MAX_TURN,
      MAX_TURN
    )
    // The pile tilts and turns as one block, about its top card.
    const pile = new THREE.Euler(tilt.y * 0.4 * hover, turn, 0)
    // Coming out, the cards are one stack: slid straight up inside the pack
    // to the pile's height, then turned to face the pile, never overshooting.
    const slid = easeOut(span(elapsed, SLIDE))
    const turned = easeInOut(span(elapsed, SETTLE))
    // Straight up out of the mouth, to where the stack's middle is level with
    // the pile.
    const top = CARD_Y - packedPose(cards.length, pack, 0).y
    const risen = packedPose(cards.length, pack, lerp(PACKED_Y, top, slid))
    const stack = mix(
      risen,
      pose({ y: CARD_Y, rx: pile.x, ry: pile.y }),
      turned
    )
    const coming = turned < 1
    for (const [index, card] of cards.entries()) {
      const depth = index - current
      const target = pilePose(depth, sides[index] ?? -1)
      if (depth >= 0) {
        const offset = new THREE.Vector3(0, 0, target.z).applyEuler(pile)
        target.x += offset.x
        target.y += offset.y
        target.z = offset.z
        target.rx += pile.x
        target.ry += pile.y
      }
      const was = poses[index] ?? target
      const at = coming ? inStack(stack, index) : mix(was, target, ease)
      poses[index] = at
      place(card.subject, celebrated(index, at, time))
      card.subject.visible = phase === "open"
    }
  }

  // Legendary light sweep, once the spin has landed.
  function sweep(time: number) {
    const progress =
      party?.rarity === "legendary" ? span(time - party.start, SHINE) : 0
    shine.uniforms.progress.value = progress
    shine.mesh.visible = progress > 0 && progress < 1
  }

  // The card's pose with its celebration on top, while one plays.
  function celebrated(index: number, at: Pose, time: number) {
    if (party?.index !== index) return at
    const since = time - party.start
    if (since >= CELEBRATION[party.rarity]) return at
    return celebrations[party.rarity](at, since)
  }

  // Shows the top card's badge once it has landed, pressing it on. Its
  // celebration starts a beat after the card comes on top, so the landing is
  // looked up every frame rather than fixed when it was chosen.
  function pressStickers(time: number) {
    const landing =
      party?.index === current
        ? party.start + CELEBRATION[party.rarity]
        : -Infinity
    for (const [index, sticker] of stickers.entries()) {
      if (!sticker) continue
      const { mesh, rest } = sticker
      const ready = phase === "open" && opened && index === current
      if (!ready) sticker.chosen = null
      else sticker.chosen ??= time
      let t = -1
      // Reduced motion: no press, it's just there.
      if (sticker.chosen !== null && stage.still) t = 1
      else if (sticker.chosen !== null)
        t =
          (time - Math.max(sticker.chosen, landing) - STICKER_WAIT) /
          STICKER_PRESS
      mesh.visible = t > 0
      if (!mesh.visible) continue
      // One smooth ease with a hair of overshoot, so it settles, not bounces.
      const p = easeOutBack(clamp01(t))
      const left = 1 - p
      mesh.scale.setScalar(1 - 0.35 * left)
      // Never below its resting height: the overshoot would sink it behind
      // the card's face, which hides it for a few frames.
      mesh.position.z = rest.z + 14 * Math.max(left, 0)
      mesh.rotation.z = rest.rz - 0.25 * left
      mesh.material.opacity = easeOut(clamp01(t * 2.5))
    }
  }

  function aimCamera(ease: number) {
    if (phase === "open") {
      const back = easeInOut(span(elapsed, PULL_BACK))
      view.zoom = lerp(from.zoom, PILE_ZOOM, back)
      view.y = lerp(from.y, 0, back)
    } else {
      const cutting = phase === "cut"
      view.zoom += ((cutting ? CUT_ZOOM : IDLE_ZOOM) - view.zoom) * ease * 0.6
      view.y += ((cutting ? CUT_CAMERA_Y : IDLE_CAMERA_Y) - view.y) * ease * 0.6
    }
    stage.camera.position.set(0, view.y, distance / view.zoom)
  }

  stage.onFrame((time, delta) => {
    elapsed = stage.still ? Infinity : elapsed + delta
    const ease = stage.still ? 1 : 1 - 0.88 ** (delta * 60)
    // Held level while cutting, so the guide stays on the cut line; a finger
    // only turns the waiting pack, the cards have their own swipe.
    const aim =
      phase === "cut" || (phase !== "idle" && pointer.touch) ? null : pointer.at
    tilt.x += ((aim?.x ?? 0) - tilt.x) * ease
    tilt.y += ((aim?.y ?? 0) - tilt.y) * ease
    const { cut, tail, fade } = glow.uniforms
    fade.value += ((phase === "cut" ? 1 : 0) - fade.value) * ease
    // The comet's trail end chases the finger, never ahead of it.
    tail.value = Math.min(
      cut.value,
      tail.value + (cut.value - tail.value) * ease
    )
    aimCamera(ease)
    posePack(time)
    poseCards(time, stage.still ? 1 : 1 - 0.8 ** (delta * 60))
    sweep(time)
    if (phase === "open" && !opened && elapsed >= end) {
      opened = true
      onOpened()
    }
    pressStickers(time)
  })

  return {
    setPhase(next) {
      if (next === "open") Object.assign(from, view)
      // Backing out of the cut keeps the pack in place; only a fresh one rises in.
      elapsed = next === "idle" && phase === "cut" ? Infinity : 0
      phase = next
      opened = false
      if (next !== "idle") return
      current = 0
      dragged = 0
      party = null
      glow.uniforms.cut.value = 0
      sides.fill(-1)
    },
    show(index, side) {
      if (index > current) sides[current] = side
      current = index
    },
    drag(share) {
      dragged = share
    },
    setCut(share) {
      glow.uniforms.cut.value = share
    },
    celebrate(index, rarity) {
      if (stage.still) return
      party = { index, rarity, start: stage.time.value }
      cards[index]?.subject.add(shine.mesh)
    },
    dispose: stage.dispose,
  }
}

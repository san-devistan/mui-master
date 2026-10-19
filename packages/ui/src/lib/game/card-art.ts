import type { Marquee } from "@workspace/ui/lib/game/film-material"
import {
  blankCanvas,
  loadImage,
  loadSmallCover,
  SCALE,
} from "@workspace/ui/lib/game/pack-art"
import { BRAND, type GameSong } from "@workspace/ui/lib/game/theme"

// Song card artwork drawn to a canvas, in the song card layout
// (240×336, 3px ink border, 24px radius). Rarity foil shows where it's clear.
// Front only: the card never turns far enough to show its back.
export const CARD_W = 240
export const CARD_H = 336
export const CARD_RADIUS = 24
const INK = "#121016"
// The cover sits on an ink frame that shows as a thin ring around the art.
const FRAME = { at: 12.75, size: 214.5, radius: 14 }
const ART = { at: 15.5, size: 209, radius: 11 }
// Artist cards ripple their edge `depth` px inward, `cycles` times round, so
// they read apart from straight-sided song cards at a glance.
export const WAVE = { depth: 6, cycles: 36 }
// Artist cards are the same size, so their photo and text sit this much
// further in to clear the wavy edge.
const ARTIST_PAD = 12
const padding = (kind: GameSong["kind"]) => (kind === "artist" ? ARTIST_PAD : 0)
// Artist photos sit in a smaller circle; song covers keep their square.
const photo = (box: typeof ART, kind: GameSong["kind"]) => {
  if (kind !== "artist") return box
  const size = box.size - 2 * ARTIST_PAD
  return { at: box.at + ARTIST_PAD, size, radius: size / 2 }
}
const roundBox = (ctx: CanvasRenderingContext2D, box: typeof ART) =>
  ctx.roundRect(box.at, box.at, box.size, box.size, box.radius)

// Draws `image` over the square `box`, cropped to its middle like CSS
// object-fit: cover, so a photo that isn't square keeps its proportions.
function coverSquare(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: typeof ART
) {
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  ctx.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    box.at,
    box.at,
    box.size,
    box.size
  )
}

const DISPLAY = "800 18px 'Unbounded Variable'"
const UI = "500 14px 'Space Grotesk Variable'"
const STREAMS = "700 12px 'Space Grotesk Variable'"
const NEW = "900 12px 'Unbounded Variable'"
const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

// The artist card's outline `inset` px in, in card px: the rounded card with
// its edge rippled inward. Ripples are timed on the outer edge, so every inset
// lines up and the border keeps an even width.
export function wavyOutline(inset = 0) {
  const half = { x: CARD_W / 2 - CARD_RADIUS, y: CARD_H / 2 - CARD_RADIUS }
  const corners = [
    [half.x, -half.y],
    [half.x, half.y],
    [-half.x, half.y],
    [-half.x, -half.y],
  ] as const
  const perimeter = 4 * (half.x + half.y) + 2 * Math.PI * CARD_RADIUS
  const points: Array<[number, number]> = []
  let along = 0
  // A point out from (x, y) in direction `angle`, then on by `length`.
  const add = (x: number, y: number, angle: number, length: number) => {
    const wave = Math.cos((2 * Math.PI * WAVE.cycles * along) / perimeter)
    const out = CARD_RADIUS - inset - (WAVE.depth * (1 - wave)) / 2
    points.push([
      CARD_W / 2 + x + out * Math.cos(angle),
      CARD_H / 2 + y + out * Math.sin(angle),
    ])
    along += length
  }
  // Each side runs from the previous corner's centre, then rounds this one.
  corners.forEach(([x, y], index) => {
    const [fromX, fromY] = corners[(index + 3) % 4] ?? corners[3]
    const angle = ((index - 1) * Math.PI) / 2
    const side = Math.hypot(x - fromX, y - fromY)
    for (let step = 0; step < side; step += 1) {
      const t = step / side
      add(
        fromX + (x - fromX) * t,
        fromY + (y - fromY) * t,
        angle,
        Math.min(1, side - step)
      )
    }
    const arc = (CARD_RADIUS * Math.PI) / 2
    for (let step = 0; step < arc; step += 1) {
      add(x, y, angle + (step / arc) * (Math.PI / 2), Math.min(1, arc - step))
    }
  })
  return points
}

// Adds the card's outline `inset` px in to the path.
function outline(
  ctx: CanvasRenderingContext2D,
  kind: GameSong["kind"],
  inset = 0
) {
  if (kind !== "artist") {
    ctx.roundRect(
      inset,
      inset,
      CARD_W - 2 * inset,
      CARD_H - 2 * inset,
      CARD_RADIUS - inset
    )
    return
  }
  wavyOutline(inset).forEach(([x, y], index) =>
    index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  )
  ctx.closePath()
}

function border(ctx: CanvasRenderingContext2D, kind: GameSong["kind"]) {
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.beginPath()
  outline(ctx, kind, 1.5)
  ctx.stroke()
}

function cover(
  ctx: CanvasRenderingContext2D,
  song: GameSong,
  image: HTMLImageElement
) {
  const art = photo(ART, song.kind)
  ctx.save()
  ctx.shadowColor = "rgb(18 16 22 / 0.35)"
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  ctx.fillStyle = INK
  ctx.beginPath()
  roundBox(ctx, photo(FRAME, song.kind))
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  roundBox(ctx, art)
  ctx.clip()
  coverSquare(ctx, image, art)
  ctx.restore()
}

function stats(ctx: CanvasRenderingContext2D, song: GameSong) {
  ctx.fillStyle = INK
  ctx.font = STREAMS
  ctx.fillText(
    `${compactNumber.format(song.streams)} streams`,
    18.75 + padding(song.kind),
    309.5
  )
}

// Title and artist sit on their own marquee strips so long ones can scroll;
// `pad` keeps text at the 18.7px margin and is where a scrolling line fades.
const CAPTION_BOX = { x: 10.7, width: 218.5, pad: 8 }
const CAPTIONS = {
  title: {
    font: DISPLAY,
    spacing: "-0.72px",
    color: INK,
    baseline: 256,
    top: 236,
    height: 28,
  },
  artist: {
    font: UI,
    spacing: "0px",
    color: "rgb(18 16 22 / 0.8)",
    baseline: 276,
    top: 262,
    height: 20,
  },
} as const

const CAPTION_GAP = 48
// Card px per second.
const CAPTION_SPEED = 30
// Long lines get a lower scale so the canvas stays a safe texture size.
const MAX_CAPTION_PX = 4096

// One caption line from `pad`; a line too long for the box is followed by a
// gap so the canvas tiles into a seamless loop. `inset` narrows the box.
function caption(
  text: string,
  line: keyof typeof CAPTIONS,
  inset: number,
  scale: number
): Marquee {
  const { font, spacing, color, baseline, top, height } = CAPTIONS[line]
  const boxWidth = CAPTION_BOX.width - 2 * inset
  const { ctx: measure } = blankCanvas(1, 1)
  measure.font = font
  measure.letterSpacing = spacing
  const width = measure.measureText(text).width
  const scrolls = width > boxWidth - 2 * CAPTION_BOX.pad
  const length = scrolls ? CAPTION_BOX.pad + width + CAPTION_GAP : boxWidth
  const texels = Math.min(scale, MAX_CAPTION_PX / length)
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(length * texels)
  canvas.height = Math.ceil(height * texels)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("2D canvas unavailable")
  ctx.scale(texels, texels)
  ctx.font = font
  ctx.letterSpacing = spacing
  ctx.fillStyle = color
  ctx.fillText(text, CAPTION_BOX.pad, baseline - top)
  return {
    art: canvas,
    box: { x: CAPTION_BOX.x + inset, y: top, width: boxWidth, height },
    cycle: canvas.width / texels,
    speed: scrolls ? CAPTION_SPEED : 0,
    fade: scrolls ? CAPTION_BOX.pad : 0,
  }
}

// NEW sticker, drawn on its own canvas so it can sit on top of the card's
// foil border. STICKER is its size and where its middle sits on the card.
export const STICKER = { w: 76, h: 40, x: CARD_W - 30, y: 20, tilt: 0.14 }

// `text` defaults to white; pass ink for a light pill.
export async function drawSticker(
  label = "NEW",
  color = "#ff3d7f",
  text = "#ffffff"
) {
  await document.fonts.load(NEW)
  const { canvas, ctx } = blankCanvas(STICKER.w, STICKER.h)
  ctx.translate(STICKER.w / 2, STICKER.h / 2)
  ctx.shadowColor = "rgb(18 16 22 / 0.35)"
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 3
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(-30, -13, 60, 26, 13)
  ctx.fill()
  ctx.shadowColor = "transparent"
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.fillStyle = text
  ctx.font = NEW
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(label, 0, 1)
  return canvas
}

// Record grooves round a violet label, like the 2D .card-back disc.
function disc(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.shadowColor = "rgb(18 16 22 / 0.35)"
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 6
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(x, y, 48, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = "#26222d"
  ctx.lineWidth = 0.6
  for (let radius = 21; radius < 47; radius += 2.5) {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (const [radius, color] of [
    [15, BRAND.color],
    [3, "#f5f2ea"],
  ] as const) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

// The card's back, as on the 2D card back: violet mesh, record, wordmark.
export async function drawCardBack(kind: GameSong["kind"]) {
  await Promise.all(
    ["900 28px 'Unbounded Variable'", "600 12px 'Space Grotesk Variable'"].map(
      (font) => document.fonts.load(font)
    )
  )
  const { canvas, ctx } = blankCanvas(CARD_W, CARD_H)
  ctx.beginPath()
  outline(ctx, kind)
  ctx.clip()
  const mesh = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  BRAND.mesh.forEach((color, index) =>
    mesh.addColorStop(index / (BRAND.mesh.length - 1), color)
  )
  ctx.fillStyle = mesh
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  disc(ctx, CARD_W / 2, 137)
  ctx.fillStyle = BRAND.on
  ctx.textAlign = "center"
  ctx.font = "900 28px 'Unbounded Variable'"
  ctx.fillText("MUSI", CARD_W / 2, 219)
  ctx.font = "600 12px 'Space Grotesk Variable'"
  ctx.letterSpacing = "3.6px"
  ctx.globalAlpha = 0.7
  ctx.fillText("MASTER", CARD_W / 2 + 1.8, 245)
  ctx.globalAlpha = 1
  border(ctx, kind)
  return canvas
}

// Card outline for the alpha test (green), with the card border and
// the cover ring marked in red so rarer cards can foil them alike.
function cardShape(kind: GameSong["kind"], scale: number) {
  const { canvas, ctx } = blankCanvas(CARD_W, CARD_H, scale)
  ctx.fillStyle = "#00ff00"
  ctx.beginPath()
  outline(ctx, kind)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  outline(ctx, kind)
  outline(ctx, kind, 3)
  roundBox(ctx, photo(FRAME, kind))
  roundBox(ctx, photo(ART, kind))
  ctx.fill("evenodd")
  return canvas
}

// `scale`: texels per card px; thumbs need fewer than a full-screen card.
export async function drawCardArt(song: GameSong, scale = SCALE) {
  // The cover downloads while the fonts load, not after; a thumb's (under
  // full scale) is the smaller one.
  const [image] = await Promise.all([
    scale < SCALE ? loadSmallCover(song.imageUrl) : loadImage(song.imageUrl),
    ...[DISPLAY, UI, STREAMS].map((font) => document.fonts.load(font)),
  ])
  const front = blankCanvas(CARD_W, CARD_H, scale)
  cover(front.ctx, song, image)
  stats(front.ctx, song)
  border(front.ctx, song.kind)
  return {
    front: front.canvas,
    shape: cardShape(song.kind, scale),
    // Artist cards show just the name: their wavy edge already says what they are.
    marquees:
      song.kind === "artist"
        ? [caption(song.title, "title", padding(song.kind), scale)]
        : [
            caption(song.title, "title", padding(song.kind), scale),
            caption(song.artist, "artist", padding(song.kind), scale),
          ],
  }
}

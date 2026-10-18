import { blankCanvas } from "@workspace/ui/lib/game/pack-art"

// Share pictures: a card's (its snapshot, see card-scene.ts) and a player's
// profile, each signed with the app's name and icon so people can find it.

export const APP_NAME = "Holotrack"
const INK = "#121016"
const MUTED = "rgb(18 16 22 / 0.6)"
const HEADING = "'Unbounded Variable'"
const BODY = "'Space Grotesk Variable'"
// The app icon (public/icon.svg, on a 100 px square): its foil and soundwave.
const ICON_FOIL = [
  [0, "#7ef9ff"],
  [0.3, "#a98bff"],
  [0.55, "#ff7ad9"],
  [0.8, "#ffd36e"],
  [1, "#7effb2"],
] as const
const ICON_BARS = [16, 30, 48, 62, 40, 26, 14]
// --brand-mesh, for a player's initial.
const BRAND_MESH = ["#a238ff", "#c470f8", "#7b2cff", "#d9a0ff"]
// --foil, for the Pro badge.
const FOIL = [
  [0.04, "#a238ff"],
  [0.15, "#c470f8"],
  [0.3, "#f5c4f2"],
  [0.46, "#ffd64a"],
  [0.58, "#d8d6d8"],
  [0.66, "#a9b8ff"],
  [0.74, "#a173fe"],
  [0.82, "#a238ff"],
] as const
// Lucide's crown, on its 24 px grid.
const CROWN = new Path2D(
  "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294zM5 21h14"
)

type Ctx = CanvasRenderingContext2D

function drawIcon(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 100, size / 100)
  ctx.beginPath()
  ctx.roundRect(0, 0, 100, 100, 23)
  ctx.clip()
  const foil = ctx.createLinearGradient(0, 0, 100, 100)
  for (const [at, color] of ICON_FOIL) foil.addColorStop(at, color)
  ctx.fillStyle = foil
  ctx.fillRect(0, 0, 100, 100)
  const shine = ctx.createLinearGradient(0, 0, 100, 100)
  shine.addColorStop(0.38, "rgb(255 255 255 / 0)")
  shine.addColorStop(0.5, "rgb(255 255 255 / 0.55)")
  shine.addColorStop(0.62, "rgb(255 255 255 / 0)")
  ctx.fillStyle = shine
  ctx.fillRect(0, 0, 100, 100)
  ctx.fillStyle = "rgb(15 13 19 / 0.9)"
  ICON_BARS.forEach((bar, index) => {
    ctx.beginPath()
    ctx.roundRect(47.4 + (index - 3) * 8.4, 50 - bar / 2, 5.2, bar, 2.6)
    ctx.fill()
  })
  ctx.restore()
}

// The app's icon and its name beside it, straight on the picture: the name in
// flat ink, its capitals about the icon's height. `height`: the icon's size,
// the pair centred on `middle`, its top at `top`.
function drawBrand(ctx: Ctx, middle: number, top: number, height: number) {
  const gap = height * 0.3
  ctx.save()
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.font = `900 ${Math.round(height * 0.72)}px ${HEADING}`
  const word = APP_NAME.toUpperCase()
  const text = ctx.measureText(word).width
  const left = middle - (height + gap + text) / 2
  drawIcon(ctx, left, top, height)
  ctx.fillStyle = INK
  ctx.fillText(word, left + height + gap, top + height / 2)
  ctx.restore()
}

// A canvas as a PNG, synchronously, so a share sheet can still open from the
// tap that asked for it.
export function pngBlob(canvas: HTMLCanvasElement) {
  const url = canvas.toDataURL("image/png")
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (char) =>
    char.charCodeAt(0)
  )
  return new Blob([bytes], { type: "image/png" })
}

export type ProfileShare = {
  name: string
  stats: ReadonlyArray<{ label: string; value: string }>
  // Shows the Pro badge under the picture, as on the profile page.
  pro?: boolean
  // The showcase's drawn card thumbs, in order (SongCardThumb canvases).
  cards: ReadonlyArray<HTMLCanvasElement>
}

// A phone screen, portrait.
const SHARE_W = 1080
const SHARE_H = 1920
// Where the card sits in a thumb's canvas, as .game-card-snapshot crops it.
const THUMB_CARD = {
  x: 20 / 280,
  y: 24 / 400,
  width: 240 / 280,
  height: 336 / 400,
}
// The player up top, the two rows of three 5:7 cards under them, the app's
// name small at the bottom.
const HEAD = { avatar: 230, radius: 90, name: 420, label: 480, value: 535 }
const GRID = { top: 720, width: 290, height: 406, gap: 30, columns: 3 }
const BRAND = { top: SHARE_H - 130, height: 52 }

// A seeded random in [0, 1): the same sparkles on every share picture.
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

// The light's colours: a rainbow, like the pack's foil and the icon's.
const RAINBOW = [
  [255, 143, 216],
  [255, 184, 107],
  [255, 230, 128],
  [143, 245, 196],
  [126, 249, 255],
  [159, 176, 255],
  [201, 155, 255],
] as const
const rgba = (index: number, alpha: number) => {
  const [r, g, b] = RAINBOW[index % RAINBOW.length] ?? [255, 255, 255]
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

type Area = { x: number; y: number; width: number; height: number }

// Draws `paint` on its own layer, blurred by `blur` px, then onto `ctx` with
// `blend`: light spreads and bleeds instead of having edges.
function layer(
  ctx: Ctx,
  width: number,
  height: number,
  blur: number,
  blend: GlobalCompositeOperation,
  paint: (layerCtx: Ctx) => void
) {
  const { canvas, ctx: layerCtx } = blankCanvas(width, height, 1)
  paint(layerCtx)
  ctx.save()
  ctx.filter = `blur(${blur}px)`
  ctx.globalCompositeOperation = blend
  ctx.drawImage(canvas, 0, 0)
  ctx.restore()
}

// A spot of light: brightest in its middle, fading smoothly to nothing.
function glow(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  color: (alpha: number) => string,
  strength = 1
) {
  const light = ctx.createRadialGradient(x, y, 0, x, y, radius)
  light.addColorStop(0, color(strength))
  light.addColorStop(0.35, color(strength * 0.45))
  light.addColorStop(1, color(0))
  ctx.fillStyle = light
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

// A lens twinkle: a white-hot point whose uneven, tapered rays split into
// rainbow colour, with a tinted halo, like a sparkle caught by a camera.
function twinkle(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  tint: number,
  random: () => number
) {
  glow(ctx, x, y, size * 0.75, (alpha) => rgba(tint, alpha), 0.9)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(random() * Math.PI)
  for (let ray = 0; ray < 8; ray++) {
    const long = ray % 2 === 0
    const length = size * (long ? 0.65 + random() * 0.55 : 0.2 + random() * 0.3)
    const thickness = size * (long ? 0.045 : 0.03) * (0.75 + random() * 0.5)
    const bend = thickness * (random() - 0.5) * 1.5
    ctx.save()
    ctx.rotate((ray * Math.PI) / 4 + (random() - 0.5) * 0.18)
    const streak = ctx.createLinearGradient(0, 0, length, 0)
    streak.addColorStop(0, "rgb(255 255 255 / 0.95)")
    streak.addColorStop(0.18, rgba(tint + ray, long ? 0.9 : 0.65))
    streak.addColorStop(0.62, rgba(tint + ray + 2, long ? 0.42 : 0.25))
    streak.addColorStop(1, rgba(tint + ray + 4, 0))
    ctx.fillStyle = streak
    ctx.beginPath()
    ctx.moveTo(0, -thickness)
    ctx.quadraticCurveTo(length * 0.38, bend - thickness * 0.35, length, bend)
    ctx.quadraticCurveTo(length * 0.38, bend + thickness * 0.35, 0, thickness)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  glow(ctx, 0, 0, size * 0.18, (alpha) => `rgb(255 255 255 / ${alpha})`)
  ctx.restore()
}

// The game's backdrop lit up, like the light pouring out of an opened pack:
// lavender into off-white, soft rays fanning out from behind the picture's
// subject (`keep`) in pale rainbow colours, a haze of colour drifting over
// it, out-of-focus lights and fine dust in the air, and a few camera
// twinkles. Everything is blurred light, nothing has an edge. The same on
// every picture.
function backdrop(ctx: Ctx, width: number, height: number, keep: Area) {
  const scale = width / SHARE_W
  const random = seeded(7)
  const base = ctx.createLinearGradient(0, 0, 0, height)
  base.addColorStop(0, "#a98ded")
  base.addColorStop(0.5, "#c8b6f5")
  base.addColorStop(1, "#e6dcf6")
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)
  const source = {
    x: keep.x + keep.width / 2,
    y: keep.y + keep.height * 0.55,
  }
  // Big soft clouds of colour, so the backdrop isn't one flat gradient.
  layer(ctx, width, height, 80 * scale, "source-over", (haze) => {
    for (let cloud = 0; cloud < 7; cloud++) {
      glow(
        haze,
        random() * width,
        random() * height,
        (260 + random() * 260) * scale,
        (alpha) => rgba(cloud * 2, alpha),
        0.55
      )
    }
  })
  // Rays of light fanning out from behind the subject: every width and
  // brightness, faintly tinted, blurred so they read as beams in the air.
  layer(ctx, width, height, 14 * scale, "screen", (rays) => {
    const reach = Math.hypot(width, height)
    rays.translate(source.x, source.y)
    for (let ray = 0; ray < 26; ray++) {
      const angle = random() * Math.PI * 2
      const spread = 0.02 + random() * 0.07
      const strength = 0.25 + random() * 0.45
      const beam = rays.createRadialGradient(0, 0, 0, 0, 0, reach * 0.8)
      beam.addColorStop(0, `rgb(255 255 255 / ${strength})`)
      beam.addColorStop(0.3, rgba(ray, strength * 0.8))
      beam.addColorStop(1, rgba(ray + 3, 0))
      rays.fillStyle = beam
      rays.beginPath()
      rays.moveTo(0, 0)
      rays.arc(0, 0, reach, angle - spread, angle + spread)
      rays.closePath()
      rays.fill()
    }
  })
  // The light's source, glowing through behind the subject.
  layer(ctx, width, height, 30 * scale, "screen", (core) => {
    glow(
      core,
      source.x,
      source.y,
      Math.max(keep.width, keep.height) * 0.75,
      (alpha) => `rgb(255 250 255 / ${alpha})`,
      0.9
    )
  })
  // Out-of-focus lights: large, soft, overlapping discs of colour.
  layer(ctx, width, height, 6 * scale, "screen", (bokeh) => {
    for (let light = 0; light < 22; light++) {
      const radius = (18 + random() ** 2 * 70) * scale
      const x = random() * width
      const y = random() * height
      bokeh.fillStyle = rgba(light, 0.2 + random() * 0.3)
      bokeh.beginPath()
      bokeh.arc(x, y, radius, 0, Math.PI * 2)
      bokeh.fill()
      bokeh.strokeStyle = "rgb(255 255 255 / 0.18)"
      bokeh.lineWidth = 2 * scale
      bokeh.stroke()
    }
  })
  // Dust catching the light: tiny specks, sharpest near the rays' source.
  layer(ctx, width, height, 0.8 * scale, "screen", (dust) => {
    for (let speck = 0; speck < 160; speck++) {
      const x = random() * width
      const y = random() * height
      const near =
        1 - Math.min(1, Math.hypot(x - source.x, y - source.y) / height)
      glow(
        dust,
        x,
        y,
        (2 + random() * 5) * scale,
        (alpha) => rgba(speck, alpha),
        0.3 + near * 0.7
      )
    }
  })
  // A few soft camera twinkles in the background, outside the subject so it
  // stays clear. Drawn normally, not screened, so their colour isn't lost on
  // the pale backdrop.
  layer(ctx, width, height, 3 * scale, "source-over", (twinkles) => {
    twinkles.globalAlpha = 0.8
    let placed = 0
    for (let tries = 0; placed < 9 && tries < 200; tries++) {
      const size = (50 + random() * 80) * scale
      const x = random() * width
      const y = random() * height
      const inside =
        x > keep.x - size * 0.3 &&
        x < keep.x + keep.width + size * 0.3 &&
        y > keep.y - size * 0.3 &&
        y < keep.y + keep.height + size * 0.3
      if (inside) continue
      twinkle(twinkles, x, y, size, placed * 2, random)
      placed += 1
    }
  })
}

// `source` (a card's snapshot) on the share backdrop, with the app's name and
// icon under it.
export function withBrand(source: HTMLCanvasElement) {
  const band = Math.round(source.width * 0.1)
  const { canvas, ctx } = blankCanvas(source.width, source.height + band, 1)
  backdrop(ctx, canvas.width, canvas.height, {
    x: source.width * 0.08,
    y: source.height * 0.06,
    width: source.width * 0.84,
    height: source.height * 0.74,
  })
  ctx.drawImage(source, 0, 0)
  drawBrand(ctx, canvas.width / 2, source.height + band * 0.25, band * 0.4)
  return canvas
}

function profileBackdrop(ctx: Ctx) {
  backdrop(ctx, SHARE_W, SHARE_H, {
    x: 40,
    y: HEAD.avatar - HEAD.radius - 20,
    width: SHARE_W - 80,
    height: GRID.top + 2 * GRID.height + GRID.gap - HEAD.avatar + HEAD.radius,
  })
}

// shortcut: always the initial on the brand gradient, as players have no
// picture yet (guests only); draw theirs once accounts can set one.
function avatar(ctx: Ctx, name: string, x: number, y: number, radius: number) {
  ctx.save()
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(x, y + radius * 0.1, radius, 0, Math.PI * 2)
  ctx.fill()
  const mesh = ctx.createLinearGradient(
    x - radius,
    y - radius,
    x + radius,
    y + radius
  )
  BRAND_MESH.forEach((color, index) =>
    mesh.addColorStop(index / (BRAND_MESH.length - 1), color)
  )
  ctx.fillStyle = mesh
  ctx.strokeStyle = INK
  ctx.lineWidth = radius * 0.07
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  const initial = name.slice(0, 1).toUpperCase()
  ctx.font = `900 ${Math.round(radius * 1.15)}px ${HEADING}`
  ctx.fillStyle = "#fff"
  ctx.textAlign = "center"
  const { actualBoundingBoxAscent: up, actualBoundingBoxDescent: down } =
    ctx.measureText(initial)
  ctx.fillText(initial, x, y + (up - down) / 2)
  ctx.restore()
}

// `name` at up to 76 px, smaller to fit `width`, cut with an ellipsis below 48.
function fitName(ctx: Ctx, name: string, width: number) {
  let size = 76
  const setFont = () => {
    ctx.font = `900 ${size}px ${HEADING}`
  }
  setFont()
  while (size > 48 && ctx.measureText(name).width > width) {
    size -= 4
    setFont()
  }
  let shown = name
  while (shown.length > 1 && ctx.measureText(`${shown}…`).width > width) {
    shown = shown.slice(0, -1)
  }
  return shown === name ? name : `${shown.trimEnd()}…`
}

// The profile page's Pro badge (game.css [data-slot=pro-badge]) at 2×: a
// foil pill, its crown and "PRO" in ink.
const BADGE = { height: 50, pad: 15, crown: 26, gap: 8, end: 18 }

function badgeFont(ctx: Ctx) {
  ctx.font = `900 24px ${BODY}`
  ctx.letterSpacing = "2px"
}

function badgeWidth(ctx: Ctx) {
  ctx.save()
  badgeFont(ctx)
  const text = ctx.measureText("PRO").width
  ctx.restore()
  return BADGE.pad + BADGE.crown + BADGE.gap + text + BADGE.end
}

// `x`: its left edge, `y`: its middle.
function proBadge(ctx: Ctx, x: number, y: number) {
  const { height } = BADGE
  const width = badgeWidth(ctx)
  ctx.save()
  badgeFont(ctx)
  const top = y - height / 2
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.roundRect(x, top + 4, width, height, height / 2)
  ctx.fill()
  const foil = ctx.createLinearGradient(x, top, x + width, top + height)
  for (const [at, color] of FOIL) foil.addColorStop(at, color)
  ctx.fillStyle = foil
  ctx.strokeStyle = INK
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(x, top, width, height, height / 2)
  ctx.fill()
  ctx.stroke()
  ctx.save()
  ctx.translate(x + BADGE.pad, y - BADGE.crown / 2)
  ctx.scale(BADGE.crown / 24, BADGE.crown / 24)
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.stroke(CROWN)
  ctx.restore()
  ctx.fillStyle = INK
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText("PRO", x + BADGE.pad + BADGE.crown + BADGE.gap, y + 1)
  ctx.restore()
}

// A player's profile as a portrait phone picture: their initial, name and
// stats, their showcase's cards, and the app's name to find it by.
export function drawProfileShare({ name, stats, pro, cards }: ProfileShare) {
  const { canvas, ctx } = blankCanvas(SHARE_W, SHARE_H, 1)
  const middle = SHARE_W / 2
  profileBackdrop(ctx)
  avatar(ctx, name, middle, HEAD.avatar, HEAD.radius)
  if (pro) {
    // Hanging off the picture's bottom, over its ring.
    proBadge(ctx, middle - badgeWidth(ctx) / 2, HEAD.avatar + HEAD.radius)
  }
  ctx.fillStyle = INK
  ctx.textAlign = "center"
  ctx.fillText(fitName(ctx, name, SHARE_W - 120), middle, HEAD.name)
  const column = (SHARE_W - 120) / Math.max(stats.length, 1)
  stats.forEach(({ label, value }, index) => {
    const x = 60 + column * (index + 0.5)
    ctx.font = `600 26px ${BODY}`
    ctx.fillStyle = MUTED
    ctx.fillText(label.toUpperCase(), x, HEAD.label)
    ctx.font = `900 48px ${HEADING}`
    ctx.fillStyle = INK
    ctx.fillText(value, x, HEAD.value)
  })
  ctx.save()
  ctx.shadowColor = "rgb(56 36 110 / 0.35)"
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 14
  const shown = cards.slice(0, GRID.columns * 2)
  shown.forEach((thumb, index) => {
    const row = Math.floor(index / GRID.columns)
    const inRow = Math.min(GRID.columns, shown.length - row * GRID.columns)
    const rowWidth = inRow * GRID.width + (inRow - 1) * GRID.gap
    const x =
      (SHARE_W - rowWidth) / 2 +
      (index % GRID.columns) * (GRID.width + GRID.gap)
    const y = GRID.top + row * (GRID.height + GRID.gap)
    // The whole thumb, placed so its card fills the slot: under perspective
    // the card's edge runs a little past that box, and a crop would cut it.
    const scale = GRID.width / THUMB_CARD.width
    ctx.drawImage(
      thumb,
      x - THUMB_CARD.x * scale,
      y - THUMB_CARD.y * (GRID.height / THUMB_CARD.height),
      scale,
      GRID.height / THUMB_CARD.height
    )
  })
  ctx.restore()
  drawBrand(ctx, middle, BRAND.top, BRAND.height)
  return canvas
}

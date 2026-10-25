// Films the landing's pack opening from the game's own scene (/pack-film), on
// a virtual clock so each frame is exact however slow the machine, paced as
// apps/web/src/landing/pack-film.ts says, and encodes it for scroll
// scrubbing: a keyframe every few frames, so any seek is quick, and tuned for
// the scene's flat art, a third smaller than the default tuning at the same look.
// Run with the web dev server up: node scripts/record-pack-film.mjs
// [url], then commit apps/web/public/landing/pack-opening.{mp4,jpg}.
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

// The film's timeline, shared with the page that scrubs it.
const { FILM_FPS, FILM_SECONDS, sceneStepAt, sceneTimeAt } = await import(
  new URL("../apps/web/src/landing/pack-film.ts", import.meta.url).href
)

const STAGE = process.argv[2] ?? "https://musi-master.localhost/pack-film"
const OUT = fileURLToPath(
  new URL("../apps/web/public/landing/", import.meta.url)
)
// A phone's height, wider than a phone: desktop shows the sides too.
const SIZE = { width: 560, height: 844 }
// Phones show the film full height at 3x: filmed at their pixels, not upscaled.
const SCALE = 3
const FRAMES = Math.round(FILM_SECONDS * FILM_FPS)

// The scene's own clock, in ms: every animation frame is handed it as its
// timestamp (three.js steps the scene by those), and it only moves as the
// script says. Playwright's fake animation frames would jump it.
function sceneClock() {
  window.packFilmNow = performance.now()
  const frame = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (callback) =>
    frame(() => callback(window.packFilmNow))
}

// CSS animations (the slice, the pack's light, the celebrations) run on the
// page's time, not the scene's: each frame, every one is held at its age on
// the scene's clock instead. False once the page has reloaded.
function holdAnimations() {
  const now = window.packFilmNow
  const born = (window.packFilmBorn ??= new WeakMap())
  for (const animation of document.getAnimations()) {
    if (!born.has(animation)) born.set(animation, now)
    animation.pause()
    animation.currentTime = now - born.get(animation)
  }
  return window.packFilmMark === true
}

const frames = mkdtempSync(join(tmpdir(), "pack-film-"))
const browser = await chromium.launch({
  args: ["--ignore-certificate-errors", "--use-angle=metal"],
})
try {
  const page = await browser.newPage({
    viewport: SIZE,
    deviceScaleFactor: SCALE,
    ignoreHTTPSErrors: true,
  })
  await page.clock.install({ time: 0 })
  await page.addInitScript(sceneClock)
  await page.goto(STAGE, { waitUntil: "networkidle" })
  await page.waitForFunction(() => typeof window.packFilmStep === "function")
  // Lets the art load and the shaders warm up before the first frame.
  await page.clock.runFor(1500)
  await page.waitForFunction(() => document.querySelector("canvas[data-drawn]"))
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => {
    window.packFilmMark = true
  })
  let last = ""
  let scene = 0
  for (let frame = 0; frame < FRAMES; frame += 1) {
    // The scene's clock runs at the film's pace: slow for quick moves.
    const next = sceneTimeAt((frame + 1) / FILM_FPS)
    const step = sceneStepAt(scene)
    const key = JSON.stringify(step)
    if (key !== last) {
      await page.evaluate((now) => window.packFilmStep?.(now), step)
      last = key
    }
    // In steps of about one animation frame: three.js drops any step over
    // 0.1s.
    const ms = (next - scene) * 1000
    const steps = Math.max(Math.ceil(ms / 16), 1)
    for (let tick = 0; tick < steps; tick += 1) {
      await page.evaluate((by) => {
        window.packFilmNow += by
      }, ms / steps)
      await page.clock.runFor(16)
    }
    scene = next
    if (!(await page.evaluate(holdAnimations))) {
      // Vite reloads a page whose dependencies it has just optimised.
      throw new Error("The page reloaded mid-film: run it again.")
    }
    await page
      .screenshot({
        path: join(frames, `${String(frame).padStart(4, "0")}.png`),
      })
      .catch((error) => {
        throw new Error(`Frame ${frame} of ${FRAMES} failed`, { cause: error })
      })
  }
} finally {
  await browser.close()
}

execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-framerate",
  String(FILM_FPS),
  "-i",
  join(frames, "%04d.png"),
  "-c:v",
  "libx264",
  "-preset",
  "veryslow",
  "-tune",
  "animation",
  "-crf",
  "26",
  "-pix_fmt",
  "yuv420p",
  "-g",
  "10",
  "-movflags",
  "+faststart",
  "-an",
  join(OUT, "pack-opening.mp4"),
])
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-i",
  join(frames, "0000.png"),
  "-q:v",
  "3",
  join(OUT, "pack-opening.jpg"),
])
rmSync(frames, { recursive: true })
console.warn(`Filmed ${FRAMES} frames into ${OUT}`)

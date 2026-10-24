import type { PackStep } from "@workspace/ui/components/scroll-pack"

// The landing's pack opening, recorded once from the game's own scene
// (scripts/record-pack-film.mjs) and scrubbed by the scroll: however fast the
// page moves, it only shows another frame.
export const PACK_FILM = "/landing/pack-opening.mp4"
export const PACK_POSTER = "/landing/pack-opening.jpg"
export const FILM_FPS = 30
// Screens of scrolling the whole film plays across, once the story's top
// reaches the top of the screen (pack-story.tsx pins it for two).
export const FILM_SCREENS = 1.6

// The opening on the scene's own clock, in seconds: the pack waits, zooms in
// and its seam is cut; it opens (the legendary's light, the pack dropping
// away, the cards out by `out`) on its first card; then for each swipe a
// finger drags the top card aside and lets go, and the next card comes on
// top, celebrates and gets its NEW badge.
// shortcut: these follow the game's animation lengths (opening-scene.ts,
// reveal-motion.ts); re-film and check by eye if those change.
const SCENE = {
  cut: 0.3,
  seam: [0.55, 1.35],
  open: 1.4,
  out: 3.75,
  swipes: [
    [4.9, 5.3],
    [7.5, 7.9],
  ],
  end: 11.2,
} as const
const CARDS = [SCENE.open, ...SCENE.swipes.map(([, release]) => release)]
// How far the finger drags a card before letting go, in stage widths.
const DRAG = 0.3

// Film seconds per scene second, from each scene time on: quick moves (the
// cut, the pack dropping away, the swipes) get most of the scroll, the waits
// (a badge, a celebration's tail) very little, so every bit of scrolling
// shows something moving. At most 2: past that the scene, drawn at 60fps,
// repeats frames.
const PACE: ReadonlyArray<readonly [scene: number, pace: number]> = [
  [0, 0.5],
  [0.3, 1],
  [3.75, 0.25],
  [4.9, 1],
  [5.3, 2],
  [5.6, 0.6],
  [6.8, 0.2],
  [7.5, 1],
  [7.9, 2],
  [8.2, 1],
  [8.8, 0.5],
  [10, 0.25],
]

// The film's time at scene time `scene`.
export function filmTimeOf(scene: number) {
  let film = 0
  for (const [index, [from, pace]] of PACE.entries()) {
    const to = PACE[index + 1]?.[0] ?? Infinity
    film += Math.max(Math.min(scene, to) - from, 0) * pace
  }
  return film
}

export const FILM_SECONDS = filmTimeOf(SCENE.end)

// The scene's time at film time `film`.
export function sceneTimeAt(film: number) {
  let left = Math.max(film, 0)
  for (const [index, [from, pace]] of PACE.entries()) {
    const to = PACE[index + 1]?.[0] ?? Infinity
    if (left <= (to - from) * pace) return from + left / pace
    left -= (to - from) * pace
  }
  return SCENE.end
}

// The step the scene is stepped to at `scene`, for the recording.
export function sceneStepAt(scene: number): PackStep {
  if (scene < SCENE.cut) return { phase: "idle", cut: 0, index: 0 }
  if (scene < SCENE.open) {
    const [from, to] = SCENE.seam
    const cut = Math.min(Math.max((scene - from) / (to - from), 0), 1)
    return { phase: "cut", cut, index: 0 }
  }
  const index = CARDS.findLastIndex((at) => scene >= at)
  const swipe = SCENE.swipes.find(([from, to]) => scene >= from && scene < to)
  // Pulled harder and harder, as a finger winding up a flick.
  const drag = swipe
    ? -DRAG * ((scene - swipe[0]) / (swipe[1] - swipe[0])) ** 2
    : 0
  return { phase: "open", cut: 1, index, drag }
}

// The film's time at `chapter`, screens scrolled into the story (0 with its
// top at the top of the screen): it plays straight through, its own pacing
// setting what each bit of scrolling shows.
export function filmTimeAt(chapter: number) {
  return Math.min(Math.max(chapter / FILM_SCREENS, 0), 1) * FILM_SECONDS
}

// The card on show at film time `film`, for its song and screen readers;
// null until the cards are out.
export function filmCardAt(film: number) {
  const scene = sceneTimeAt(film)
  if (scene < SCENE.out) return null
  return CARDS.findLastIndex((at) => scene >= at)
}

// The game's sound cues through the opening (sfx.ts), at the scene times the
// game plays them (pack-opening.tsx): the pack pressed, its seam torn, its
// legendary light, each card swiped away, and each card's reveal once out.
export type FilmCue = {
  at: number
  cue: "press" | "rip" | "glow" | "swipe" | "card"
  card?: number
}
export const FILM_CUES: ReadonlyArray<FilmCue> = [
  { at: SCENE.cut, cue: "press" },
  { at: SCENE.open, cue: "rip" },
  { at: SCENE.open, cue: "glow" },
  { at: SCENE.out, cue: "card", card: 0 },
  ...SCENE.swipes.flatMap(([, release], index) => [
    { at: release, cue: "swipe" as const },
    { at: release + 0.2, cue: "card" as const, card: index + 1 },
  ]),
]

// The cues passed going forwards from film time `from` to `to`; none going
// back, so scrolling up is silent.
export function cuesBetween(from: number, to: number) {
  if (to <= from) return []
  const [start, end] = [sceneTimeAt(from), sceneTimeAt(to)]
  return FILM_CUES.filter(({ at }) => at > start && at <= end)
}

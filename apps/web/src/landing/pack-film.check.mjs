// Run: node apps/web/src/landing/pack-film.check.mjs
import {
  FILM_SCREENS,
  FILM_SECONDS,
  filmCardAt,
  filmTimeAt,
  filmTimeOf,
  sceneStepAt,
  sceneTimeAt,
} from "./pack-film.ts"

/** @type {(ok: unknown, what: string) => void} */
function check(ok, what) {
  if (!ok) throw new Error(`pack film: ${what}`)
}
/** @type {(a: number, b: number) => boolean} */
const near = (a, b) => Math.abs(a - b) < 1e-9

check(filmTimeAt(-4) === 0, "above the story, the pack waits")
check(filmTimeAt(FILM_SCREENS) === FILM_SECONDS, "the film ends in its screens")
check(filmTimeAt(40) === FILM_SECONDS, "and holds its end below")
check(filmTimeAt(0.5) < filmTimeAt(1), "scrolling down plays, up rewinds")
for (const film of [0, 0.7, 2.9, 5.5, 9.1, FILM_SECONDS]) {
  check(near(filmTimeOf(sceneTimeAt(film)), film), `film ${film} round trips`)
}
check(filmTimeOf(5.6) - filmTimeOf(5.3) > 5.6 - 5.3, "swipes slowed down")
check(filmTimeOf(4.9) - filmTimeOf(3.75) < 4.9 - 3.75, "waits sped up")
check(
  filmTimeOf(3.75) - filmTimeOf(0.3) > FILM_SECONDS / 3,
  "the cut and the pack dropping away get a good share of the scroll"
)
check(sceneStepAt(0).phase === "idle", "the pack waits")
check(near(sceneStepAt(0.95).cut, 0.5), "then is cut")
check(sceneStepAt(2).index === 0, "opens on the first card")
check(sceneStepAt(4).drag === 0, "the first card rests")
check((sceneStepAt(5.2).drag ?? 0) < -0.1, "then is dragged aside")
check(sceneStepAt(5.3).index === 1 && sceneStepAt(5.3).drag === 0, "let go")
check(sceneStepAt(8).index === 2, "ends on the last")
check(filmCardAt(filmTimeOf(3)) === null, "no card till they're out")
check(filmCardAt(filmTimeOf(4)) === 0, "first card")
check(filmCardAt(filmTimeOf(6)) === 1, "second card")
check(filmCardAt(FILM_SECONDS) === 2, "the last card holds")

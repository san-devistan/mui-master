// Run: node packages/ui/src/lib/game/touch-trail.check.mjs
import { trailSegments } from "./touch-trail.ts"

/** @type {(ok: unknown, what: string) => void} */
function check(ok, what) {
  if (!ok) throw new Error(`touch-trail: ${what}`)
}
/** @type {(x: number, at: number) => import("./touch-trail.ts").TrailPoint} */
const point = (x, at) => ({ x, y: 0, at })

check(trailSegments([], 0).length === 0, "no points, no trail")
check(trailSegments([point(0, 0)], 0).length === 0, "a tap alone, no trail")
const fresh = trailSegments([point(0, 0), point(10, 100), point(20, 200)], 200)
check(fresh.length === 2, "every fresh stretch shows")
check(fresh[1]?.life === 1, "brightest at the finger")
check((fresh[0]?.life ?? 1) < 1, "fading behind it")
const later = trailSegments([point(0, 0), point(10, 100), point(20, 200)], 330)
check(later.length === 1 && later[0]?.to.x === 20, "old stretches drop")
check(
  trailSegments([point(0, 0), point(10, 10)], 1000).length === 0,
  "gone once it ages out"
)

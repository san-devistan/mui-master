// Run: node packages/backend/convex/songs/_lib/economy.check.mjs
import assert from "node:assert/strict"

import {
  dailyHolosDue,
  freePackPlan,
  freePacks,
  isPro,
  minBid,
  packPrice,
  sellPrice,
} from "./economy.ts"
import { packOdds } from "./rarity.ts"

assert.equal(minBid(50, undefined), 50)
assert.equal(minBid(50, 10), 11)
assert.equal(minBid(50, 100), 105)
assert.equal(minBid(50, 101), 107)

// Free packs: one per 8 hours, three held at most, nothing banked while full.
const hour = 3_600_000
const now = Date.UTC(2026, 9, 18, 12)
assert.deepEqual([freePacks(0, now).count, freePacks(0, now).nextAt], [3, null])
const afterOne = freePacks(0, now).usedSince
assert.equal(freePacks(afterOne, now).count, 2)
assert.equal(freePacks(afterOne, now).nextAt, now + 8 * hour)
assert.equal(freePacks(afterOne, now + 8 * hour - 1).count, 2)
assert.equal(freePacks(afterOne, now + 8 * hour).count, 3)
// Three opened at once: one back 8 hours later, all three after a day, never more.
let since = 0
for (let opened = 0; opened < 3; opened++) {
  since = freePacks(since, now).usedSince
}
assert.equal(freePacks(since, now).count, 0)
assert.equal(freePacks(since, now + 8 * hour).count, 1)
assert.equal(freePacks(since, now + 24 * hour).count, 3)
assert.equal(freePacks(since, now + 100 * hour).count, 3)

// Pro: one per 4 hours, six held.
const proPlan = freePackPlan(true)
assert.equal(freePacks(0, now, proPlan).count, 6)
const proOpened = freePacks(0, now, proPlan).usedSince
assert.equal(freePacks(proOpened, now, proPlan).nextAt, now + 4 * hour)
assert.equal(freePacks(proOpened, now + 4 * hour, proPlan).count, 6)
assert.ok(isPro(now + 1, now) && !isPro(now, now) && !isPro(undefined, now))

// Pro's daily holos: once per UTC day.
const midnight = Date.UTC(2026, 9, 19)
assert.ok(dailyHolosDue(undefined, now))
assert.ok(!dailyHolosDue(now, now + hour))
assert.ok(!dailyHolosDue(midnight - 1, midnight - 1))
assert.ok(dailyHolosDue(midnight - 1, midnight))

// Selling a whole pack back must stay well under its price, or packs print coins.
const resale = packOdds.reduce((sum, odds) => {
  const total = Object.values(odds).reduce((a, b) => a + b, 0)
  return (
    sum +
    Object.entries(odds).reduce(
      (value, [rarity, chance]) => value + (sellPrice[rarity] * chance) / total,
      0
    )
  )
}, 0)
assert.ok(resale < packPrice / 2, `a pack resells for ${resale}`)

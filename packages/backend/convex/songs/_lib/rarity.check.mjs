// Run: node packages/backend/convex/songs/_lib/rarity.check.mjs
import assert from "node:assert/strict"

import {
  artistRarityForStreams,
  drawRarity,
  godPackOdds,
  packOdds,
  raiseRarity,
  rarityForStreams,
} from "./rarity.ts"

assert.equal(rarityForStreams(99_999_999), undefined)
assert.equal(rarityForStreams(100_000_000), "common")
assert.equal(rarityForStreams(399_999_999), "common")
assert.equal(rarityForStreams(400_000_000), "rare")
assert.equal(rarityForStreams(1_000_000_000), "epic")
assert.equal(rarityForStreams(2_000_000_000), "legendary")

assert.equal(artistRarityForStreams(0), "common")
assert.equal(artistRarityForStreams(999_999_999), "common")
assert.equal(artistRarityForStreams(1_000_000_000), "rare")
assert.equal(artistRarityForStreams(5_000_000_000), "epic")
assert.equal(artistRarityForStreams(20_000_000_000), "legendary")

assert.equal(raiseRarity(undefined, "common"), "common")
assert.equal(raiseRarity("common", "epic"), "epic")
assert.equal(raiseRarity("epic", "common"), "epic")
assert.equal(raiseRarity("legendary", "rare"), "legendary")
assert.equal(raiseRarity("rare", "rare"), "rare")

// Every card's odds add up to 100%.
for (const odds of packOdds) {
  assert.equal(
    Object.values(odds).reduce((sum, p) => sum + p, 0),
    100
  )
}
const [first, , , fourth, last] = packOdds
assert.equal(drawRarity(fourth, 0), "legendary")
assert.equal(drawRarity(fourth, 0.999), "common")
// The first card is at most rare, the last never common, whatever the roll.
for (let roll = 0; roll < 1; roll += 0.001) {
  assert.ok(["common", "rare"].includes(drawRarity(first, roll)))
  assert.notEqual(drawRarity(last, roll), "common")
}
assert.equal(drawRarity(last, 0.999), "rare")
// A god pack is legendary all through.
for (const odds of godPackOdds) {
  for (let roll = 0; roll < 1; roll += 0.01) {
    assert.equal(drawRarity(odds, roll), "legendary")
  }
}

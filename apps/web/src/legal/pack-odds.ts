import {
  godPackChance,
  godPackOdds,
  packOdds,
  rarityOrder,
} from "@workspace/backend/rarity"
import type { Rarity } from "@workspace/ui/lib/game/theme"

// The odds every pack is drawn with, straight from the backend's draw
// (songs/_lib/rarity.ts), so what the site shows is what the game rolls.

export const GOD_PACK_PERCENT = godPackChance * 100

// Each of a pack's five cards, in the order it's dealt: the chance (in %) of
// each rarity it can be, rarest first.
export const SLOT_ODDS: ReadonlyArray<
  ReadonlyArray<{ rarity: Rarity; percent: number }>
> = packOdds.map((slot) =>
  rarityOrder.flatMap((rarity) => {
    const percent = slot[rarity]
    return percent ? [{ rarity, percent }] : []
  })
)

// The chance a pack holds at least one card of `rarity` or rarer, counting
// the god pack (all five legendary).
export function atLeastOne(rarity: Rarity) {
  const rarer = rarityOrder.slice(0, rarityOrder.indexOf(rarity) + 1)
  const none = packOdds.reduce((left, slot) => {
    const hit = rarer.reduce((sum, one) => sum + (slot[one] ?? 0), 0)
    return left * (1 - hit / 100)
  }, 1)
  return (godPackChance + (1 - godPackChance) * (1 - none)) * 100
}

// A rarity's average odds (in %) over a pack's five cards.
const average = (pack: typeof packOdds, rarity: Rarity) =>
  pack.reduce((sum, slot) => sum + (slot[rarity] ?? 0), 0) / pack.length

// The share (in %) of all cards pulled that are `rarity`, god packs counted:
// what a collection built from packs ends up made of. The four add up to 100.
export const pullRate = (rarity: Rarity) =>
  (1 - godPackChance) * average(packOdds, rarity) +
  godPackChance * average(godPackOdds, rarity)

// "12%", "0.5%", "0.1%": whole above 10, else up to one decimal.
export const percent = (value: number) =>
  `${value.toLocaleString("en", { maximumFractionDigits: value >= 10 ? 0 : 1 })}%`

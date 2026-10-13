import type { CardRarity } from "./validators"

export const minSpotifyStreams = 100_000_000

type Tiers = ReadonlyArray<{ rarity: CardRarity; minStreams: number }>

// Tiers shrink ~3-4x each step, so per-song odds rise from common to legendary.
const songTiers: Tiers = [
  { rarity: "legendary", minStreams: 2_000_000_000 },
  { rarity: "epic", minStreams: 1_000_000_000 },
  { rarity: "rare", minStreams: 400_000_000 },
  { rarity: "common", minStreams: minSpotifyStreams },
]

// An artist's streams are the sum of their catalog songs' (as lead or featured), so the tiers sit
// higher; on 2026-10-13 they split the artists like songs: ~1% legendary, 6% epic, 21% rare.
const artistTiers: Tiers = [
  { rarity: "legendary", minStreams: 20_000_000_000 },
  { rarity: "epic", minStreams: 5_000_000_000 },
  { rarity: "rare", minStreams: 1_000_000_000 },
  { rarity: "common", minStreams: minSpotifyStreams },
]

export const rarityOrder: ReadonlyArray<CardRarity> = [
  "legendary",
  "epic",
  "rare",
  "common",
]

// Songs under minSpotifyStreams get no rarity and stay out of packs.
export function rarityForStreams(streams: number): CardRarity | undefined {
  return songTiers.find((tier) => streams >= tier.minStreams)?.rarity
}

export function artistRarityForStreams(streams: number): CardRarity {
  return (
    artistTiers.find((tier) => streams >= tier.minStreams)?.rarity ?? "common"
  )
}

// A card's rarity only ever rises: the higher of what it was and what its streams give now, so
// a merged release or a stream purge never downgrades a player's card.
export function raiseRarity(
  current: CardRarity | undefined,
  next: CardRarity
): CardRarity {
  if (!current) return next
  return rarityOrder.indexOf(next) < rarityOrder.indexOf(current)
    ? next
    : current
}

type Odds = Partial<Record<CardRarity, number>>

// A pack's five cards, each with its own odds (in %), so the pack builds up from commons to a
// guaranteed hit: the first is at most rare, the third leans rare and epic, the last is rare or
// better. A rarity a card leaves out can't come up in it.
export const packOdds: ReadonlyArray<Odds> = [
  { common: 90, rare: 10 },
  { common: 85, rare: 12, epic: 3 },
  { common: 65, rare: 27, epic: 8 },
  { common: 85, rare: 12, epic: 2.5, legendary: 0.5 },
  { rare: 70, epic: 24, legendary: 6 },
]

// Rarely, a god pack instead: all five cards legendary. 0.1%, one pack in 1,000 on average.
export const godPackChance = 0.001
export const godPackOdds: ReadonlyArray<Odds> = packOdds.map(() => ({
  legendary: 100,
}))

// The rarity a roll in [0, 1) gives under `odds`, rarest first.
export function drawRarity(odds: Odds, roll: number): CardRarity {
  const total = rarityOrder.reduce(
    (sum, rarity) => sum + (odds[rarity] ?? 0),
    0
  )
  let threshold = roll * total
  for (const rarity of rarityOrder) {
    threshold -= odds[rarity] ?? 0
    if (threshold < 0) return rarity
  }
  return rarityOrder.findLast((rarity) => odds[rarity]) ?? "common"
}

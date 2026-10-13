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

export const rarityWeights: Record<CardRarity, number> = {
  common: 170,
  rare: 24,
  epic: 5,
  legendary: 1,
}

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

export function drawRarity(roll: number): CardRarity {
  const total = rarityOrder.reduce(
    (sum, rarity) => sum + rarityWeights[rarity],
    0
  )
  let threshold = roll * total

  for (const rarity of rarityOrder) {
    threshold -= rarityWeights[rarity]
    if (threshold < 0) {
      return rarity
    }
  }

  return "common"
}

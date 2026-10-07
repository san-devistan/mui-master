import type { SongRarity } from "./validators"

export const minSpotifyStreams = 1_000_000_000

const tiers: ReadonlyArray<{ rarity: SongRarity; minStreams: number }> = [
  { rarity: "legendary", minStreams: 3_000_000_000 },
  { rarity: "epic", minStreams: 2_000_000_000 },
  { rarity: "rare", minStreams: 1_500_000_000 },
  { rarity: "common", minStreams: minSpotifyStreams },
]

export const rarityWeights: Record<SongRarity, number> = {
  common: 64,
  rare: 24,
  epic: 9,
  legendary: 3,
}

export const rarityOrder: ReadonlyArray<SongRarity> = [
  "legendary",
  "epic",
  "rare",
  "common",
]

export function rarityForStreams(streams: number): SongRarity {
  return tiers.find((tier) => streams >= tier.minStreams)?.rarity ?? "common"
}

export function drawRarity(roll: number): SongRarity {
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

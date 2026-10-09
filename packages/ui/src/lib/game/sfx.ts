import type { Rarity } from "@workspace/ui/lib/game/theme"
import { createUISFX, type CueName } from "uisfx"

// One player for the game; Web Audio only starts after a user gesture (unlock).
export const sfx = createUISFX({
  pack: "glass",
  volume: 0.7,
  preferences: { key: "musi-master:sound" },
})

// Rarer cards get a bigger cue and a softer, fuller pack.
export const REVEAL: Record<Rarity, CueName> = {
  common: "select",
  rare: "reward",
  epic: "level-up",
  legendary: "achievement",
}

export function play(cue: CueName, options?: Parameters<typeof sfx.play>[1]) {
  sfx.play(cue, { retrigger: "overlap", ...options })
}

import type { OpeningScene } from "@workspace/ui/lib/game/opening-scene"
import type { Celebrated } from "@workspace/ui/lib/game/reveal-motion"
import { play } from "@workspace/ui/lib/game/sfx"
import type { GameSong } from "@workspace/ui/lib/game/theme"
import { useCallback, useRef, useState, type RefObject } from "react"

export type Party = { index: number; rarity: Celebrated; key: number }

// Plays a card's reveal cue, and the first time each epic or legendary card
// appears, its celebration.
export function useReveal(
  songs: ReadonlyArray<GameSong>,
  sceneRef: RefObject<OpeningScene | null>
) {
  const seen = useRef(new Set<number>())
  const [party, setParty] = useState<Party | null>(null)

  const reveal = useCallback(
    (next: number) => {
      const rarity = songs[next]?.rarity
      if (!rarity) return
      play(rarity)
      if (
        (rarity !== "epic" && rarity !== "legendary") ||
        seen.current.has(next)
      )
        return
      seen.current.add(next)
      sceneRef.current?.celebrate(next, rarity)
      setParty({ index: next, rarity, key: Date.now() })
    },
    [songs, sceneRef]
  )

  const reset = useCallback(() => {
    seen.current.clear()
    setParty(null)
  }, [])

  return { party, reveal, reset }
}

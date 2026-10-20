import type { CollectedSong } from "@/game/_lib/collection"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { play } from "@workspace/ui/lib/game/sfx"
import { useEffect, useState } from "react"
import { flushSync } from "react-dom"

// Seconds before the first just-pulled card drops into the collection, then
// between each next one, and the drop itself (see game-drop).
const FIRST_DROP = 0.35
const DROP_STAGGER = 0.45
const DROP = 0.6

// Only grid cards on screen slide in the view transition: each named card
// adds pseudo-elements the browser restyles every frame of it, and a long
// collection's off-screen ones (over a hundred) cost dropped frames while
// their slide can't be seen. The card dropping in (still hidden) keeps its
// name.
function nameOnScreenCards() {
  for (const card of document.querySelectorAll<HTMLElement>(".game-slides")) {
    const { top, bottom, height } = card.getBoundingClientRect()
    const away = height > 0 && (bottom < 0 || top > innerHeight)
    card.style.viewTransitionName = away ? "none" : ""
  }
}

// New cards just pulled from a pack (the `added` search param), newest first:
// shown first, under all rarities and the recent order, and badged NEW. They
// aren't in the grid on arrival; they're added one by one, first pulled first,
// each dropping in at the top and pushing the rest down. Leaving the page
// drops `added` from the URL, and the badges; opening a card drops its own.
// `onArrival` runs as a new pack's cards arrive, to show them.
export function useArrivals(onArrival: () => void) {
  const navigate = useNavigate()
  const added =
    useSearch({ strict: false, select: (search) => search.added }) ?? []
  // How many of the new cards are in the grid so far, oldest pull first.
  const [landed, setLanded] = useState(0)
  const arriving = landed < added.length
  // The tab bar stays away until the last one is in, so none falls over it.
  const [settled, setSettled] = useState(false)
  // A card leaving the list (opened) isn't an arrival.
  const [arrived, setArrived] = useState(() => new Set(added))
  if (added.some((id) => !arrived.has(id))) {
    setArrived(new Set(added))
    setLanded(0)
    setSettled(false)
    onArrival()
  }

  useEffect(() => {
    if (!arriving) return undefined
    // The first lands as the page settles; each next once the last is in.
    const timer = setTimeout(
      () => {
        // It hits the grid 70% of the way through its drop.
        play("land", DROP * 0.7)
        // Slides the cards below down to make room, where supported.
        if (!document.startViewTransition) {
          return setLanded((count) => count + 1)
        }
        nameOnScreenCards()
        document.startViewTransition(() =>
          flushSync(() => setLanded((count) => count + 1))
        )
      },
      (landed === 0 ? FIRST_DROP : DROP_STAGGER) * 1000
    )
    return () => clearTimeout(timer)
  }, [arriving, landed])

  useEffect(() => {
    if (arriving || settled || !added.length) return undefined
    const timer = setTimeout(() => setSettled(true), DROP * 1000)
    return () => clearTimeout(timer)
  }, [arriving, settled, added.length])

  return {
    added,
    fresh: new Set(added),
    // Hides a new card until its turn to drop in.
    isLanded: (song: CollectedSong) => {
      const at = added.indexOf(song.id)
      return at < 0 || added.length - 1 - at < landed
    },
    // Keeps the tab bar away while cards are still dropping in.
    dropping: !settled && added.length > 0,
    // An opened NEW card loses its badge: it has landed, so one fewer has.
    unbadge: (id: string) => {
      if (!added.includes(id)) return
      const rest = added.filter((other) => other !== id)
      setLanded((count) => count - 1)
      void navigate({
        to: "/collection",
        search: rest.length ? { added: rest } : {},
        replace: true,
        resetScroll: false,
      })
    },
  }
}

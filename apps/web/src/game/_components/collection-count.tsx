import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { GamePill } from "@workspace/ui/components/game-shell"

// Distinct cards owned, out of every song and artist card in the game:
// floating over the tab bar's left end, opposite the card type select, and
// stepping aside with it. On a screen too short for the side rail to clear it
// (a phone on its side), it moves out from under the rail.
export function CollectionCount() {
  const { data: owned } = useQuery(convexQuery(api.collection.count, {}))
  const { data: catalog } = useQuery(convexQuery(api.packs.catalog, {}))
  return (
    <div className="left-4 md:left-8 md:[@media(max-height:25rem)]:left-28 md:bottom-8 mb-20 md:mb-0 ease-out in-data-immersive:translate-y-4 in-data-dropping:translate-y-4 pointer-events-none fixed game-safe-bottom z-40 transition duration-300 in-data-dropping:invisible in-data-dropping:opacity-0 in-data-immersive:invisible in-data-immersive:opacity-0">
      <GamePill>
        {owned ?? 0} / {(catalog?.total ?? 0).toLocaleString("en")}
      </GamePill>
    </div>
  )
}

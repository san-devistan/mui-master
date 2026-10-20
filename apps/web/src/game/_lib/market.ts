import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { usePaginatedQuery } from "convex/react"
import type { FunctionArgs, FunctionReturnType } from "convex/server"
import { useMemo, useState } from "react"

// Which auctions, of which rarity (see convex/market.ts, auctions).
export type AuctionsQuery = Omit<
  FunctionArgs<typeof api.market.auctions>,
  "paginationOpts" | "text"
>
export type AuctionScope = NonNullable<AuctionsQuery["scope"]>

// About two phone screens of cards.
const PAGE = 24

type Listed = FunctionReturnType<typeof api.market.auctions>["page"]

// The live list is the same for everyone (market:auctions `shared`), so a bid or a new auction
// re-runs it once for all the players watching, not once each. The player's part in it comes from
// market:standing: their own auctions left out, as the backend did, and the ones they lead marked.
// Null until both are in. Watched in every scope (a few ids, rarely changing), so coming back to
// the live list never waits for it.
function useStanding(auctions: Listed | null, live: boolean) {
  const { data: standing } = useQuery(convexQuery(api.market.standing, {}))
  return useMemo(() => {
    if (!live || !auctions) return auctions
    if (!standing) return null
    const mine = new Set<string>(standing.mine)
    const leading = new Set<string>(standing.leading)
    return auctions.flatMap((auction) => {
      if (mine.has(auction.id)) return []
      return [
        leading.has(auction.id) ? { ...auction, isLeading: true } : auction,
      ]
    })
  }, [auctions, standing, live])
}

// Auctions matching `query` and, with `search` text, whose card matches it, a page at a time;
// `more` loads the next, null once all are in. Open ones ended by `now` but not settled yet (a
// moment from leaving) are left out. Like useCollection: while a new query's first page loads,
// the last one's auctions stay, so a filter or a keystroke swaps the grid rather than blanking
// it. Null until the first page is in.
export function useAuctions(
  query: AuctionsQuery,
  search: string | null,
  now: number
) {
  const text = search?.trim()
  const live = (query.scope ?? "live") === "live"
  const { results, status, loadMore } = usePaginatedQuery(
    api.market.auctions,
    { ...query, ...(text ? { text } : {}), ...(live ? { shared: true } : {}) },
    { initialNumItems: PAGE }
  )
  // With whether they're the shared live list, which still needs the player's part placed while
  // another scope's first page loads.
  const [kept, setKept] = useState<{ results: Listed; live: boolean } | null>(
    null
  )
  if (status !== "LoadingFirstPage" && results !== kept?.results) {
    setKept({ results, live })
  }
  const placed = useStanding(kept?.results ?? null, kept?.live ?? live)
  return {
    auctions:
      placed?.filter(
        (auction) => auction.status !== "open" || auction.endsAt > now
      ) ?? null,
    done: status === "Exhausted",
    more: status === "CanLoadMore" ? () => loadMore(PAGE) : null,
  }
}

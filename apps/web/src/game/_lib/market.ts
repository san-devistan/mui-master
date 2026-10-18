import { api } from "@workspace/backend/api"
import { usePaginatedQuery } from "convex/react"
import type { FunctionArgs } from "convex/server"
import { useState } from "react"

// Which auctions, of which rarity (see convex/market.ts, auctions).
export type AuctionsQuery = Omit<
  FunctionArgs<typeof api.market.auctions>,
  "paginationOpts" | "text"
>
export type AuctionScope = NonNullable<AuctionsQuery["scope"]>

// About two phone screens of cards.
const PAGE = 24

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
  const { results, status, loadMore } = usePaginatedQuery(
    api.market.auctions,
    text ? { ...query, text } : query,
    { initialNumItems: PAGE }
  )
  const [kept, setKept] = useState<typeof results | null>(null)
  if (status !== "LoadingFirstPage" && results !== kept) setKept(results)
  return {
    auctions:
      kept?.filter(
        (auction) => auction.status !== "open" || auction.endsAt > now
      ) ?? null,
    done: status === "Exhausted",
    more: status === "CanLoadMore" ? () => loadMore(PAGE) : null,
  }
}

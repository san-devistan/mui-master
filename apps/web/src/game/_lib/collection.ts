import { toGameCard, type GameCard } from "@/game/_lib/cards"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { usePaginatedQuery } from "convex/react"
import type { FunctionArgs, FunctionReturnType } from "convex/server"
import { useMemo, useState } from "react"

// How many different cards the player owns; undefined until known. Read off the wallet the app
// already watches (the same row), so it adds no subscription of its own.
export const useCardCount = () =>
  useQuery({
    ...convexQuery(api.wallet.get, {}),
    select: (wallet) => wallet.cards,
  }).data

// A card the player owns: its details, copies and first pull, all from the backend, and whether
// it's a favorite (unknown on cards opened from elsewhere, like the market).
export type CollectedSong = GameCard & {
  copies: number
  pulledAt: number
  favorite?: boolean
}

// Which cards, in which order (see convex/collection.ts).
export type CollectionQuery = Omit<
  FunctionArgs<typeof api.collection.list>,
  "paginationOpts"
>

// About two phone screens of cards.
const PAGE = 24

type Row = FunctionReturnType<typeof api.collection.list>["page"][number]
// A card per row the backend sent: rows of pages already in stay the same objects as more load,
// so their cards do too, and drawn thumbs aren't rebuilt.
const cards = new WeakMap<Row, CollectedSong>()
const toCollected = (row: Row) => {
  const card = cards.get(row) ?? toGameCard(row)
  cards.set(row, card)
  return card
}

// The signed-in player's cards matching `query`, in its order, a page at a time; `more` loads the
// next, null once all are in. With `search` text, the cards whose title or artists match it, best
// match first, under the same filters. While a new query's first page loads, the last one's cards
// stay, so a filter or a keystroke swaps the grid rather than blanking it. Null until the first
// page is in.
export function useCollection(
  query: CollectionQuery,
  search: string | null = null
) {
  const text = search?.trim()
  const filters = {
    rarity: query.rarity,
    kind: query.kind,
    liked: query.liked,
  }
  const listed = usePaginatedQuery(api.collection.list, text ? "skip" : query, {
    initialNumItems: PAGE,
  })
  const found = usePaginatedQuery(
    api.collection.search,
    text ? { ...filters, text } : "skip",
    { initialNumItems: PAGE }
  )
  const { results, status, loadMore } = text ? found : listed
  const [kept, setKept] = useState<typeof results | null>(null)
  if (status !== "LoadingFirstPage" && results !== kept) setKept(results)
  const shown = useMemo(() => kept?.map(toCollected) ?? null, [kept])
  return {
    cards: shown,
    done: status === "Exhausted",
    more: status === "CanLoadMore" ? () => loadMore(PAGE) : null,
  }
}

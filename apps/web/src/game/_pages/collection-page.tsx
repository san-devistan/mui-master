import type { Showcase } from "@/game/_components/card-showcase"
import {
  CardToolbar,
  OptionSelect,
  RaritySelect,
} from "@/game/_components/card-toolbar"
import { CollectionCount } from "@/game/_components/collection-count"
import { CollectionCard, MoreCards } from "@/game/_components/collection-grid"
import { PageHeader } from "@/game/_components/page-header"
import {
  ShowcaseStack,
  startStack,
  type Opened,
} from "@/game/_components/showcase-stack"
import { useArrivals } from "@/game/_hooks/use-arrivals"
import {
  useCardCount,
  useCollection,
  type CollectedSong,
} from "@/game/_lib/collection"
import {
  RARITY_FILTERS,
  rarityArg,
  type RarityFilter,
} from "@/game/_lib/rarity-filter"
import { useSavedChoice } from "@/game/_lib/saved-choice"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { GameMain, GameScroll } from "@workspace/ui/components/game-shell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  ArrowDownAZIcon,
  ArrowDownUpIcon,
  ClockIcon,
  GemIcon,
  LayersIcon,
  MicVocalIcon,
  Music2Icon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

const KINDS = {
  all: { label: "All cards", Icon: LayersIcon },
  song: { label: "Songs", Icon: Music2Icon },
  artist: { label: "Artists", Icon: MicVocalIcon },
} as const
type KindFilter = keyof typeof KINDS
const KIND_KEYS = Object.keys(KINDS).filter(
  (key): key is KindFilter => key in KINDS
)
const KIND_LABELS = Object.fromEntries(
  Object.entries(KINDS).map(([key, { label }]) => [key, label])
)

// Sorted by the backend (convex/collection.ts).
const SORTS = {
  recent: { label: "Recent", Icon: ClockIcon },
  rarest: { label: "Rarest", Icon: GemIcon },
  title: { label: "A–Z", Icon: ArrowDownAZIcon },
} as const
type SortKey = keyof typeof SORTS
const SORT_KEYS = Object.keys(SORTS).filter(
  (key): key is SortKey => key in SORTS
)

// About a phone screen of cards, drawn even while the page is hidden.
const EAGER = 8

// The backend's arguments for the chosen sort and filters; "all" is no filter.
const collectionQuery = (
  sort: SortKey,
  filter: RarityFilter,
  kind: KindFilter
) => ({
  sort,
  ...rarityArg(filter),
  ...(kind === "all" ? {} : { kind }),
})
// The text a search looks for: opening or closing an empty search changes nothing found, so it
// keeps the grid's scroll; typing starts the results at the top.
const searched = (search: string | null) => search?.trim() ?? ""

// Kept mounted by GameLayout, hidden (`shown` false) on other tabs: it keeps
// its scroll and drawn cards. Its filters and order are saved, so they're
// back after a reload too, until a pack's new cards arrive. Cards load a page
// at a time as the grid nears its end, and only those near the view hold a
// 3D card.
export function CollectionPage({ shown }: { shown: boolean }) {
  const [filter, setFilter] = useSavedChoice<RarityFilter>(
    "collection.rarity",
    RARITY_FILTERS,
    "all"
  )
  const [kind, setKind] = useSavedChoice<KindFilter>(
    "collection.kind",
    KIND_KEYS,
    "all"
  )
  const [sort, setSort] = useSavedChoice<SortKey>(
    "collection.sort",
    SORT_KEYS,
    "recent"
  )
  // Null while the search field is closed.
  const [search, setSearch] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // A pack's new cards arrive on the page as it opens: recent, all cards, top.
  const { fresh, isLanded, dropping, unbadge } = useArrivals(() => {
    setFilter("all")
    setKind("all")
    setSort("recent")
    setSearch(null)
    scrollRef.current?.scrollTo({ top: 0 })
  })
  const { cards, done, more } = useCollection(
    collectionQuery(sort, filter, kind),
    search
  )
  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0 })
  // A new filter or order starts at the top.
  const refine =
    <Value,>(set: (value: Value) => void) =>
    (value: Value) => {
      set(value)
      scrollToTop()
    }
  // Cards out on show: the one picked from the grid, then any opened from
  // the related cards of the one under it, each over the last. Each keeps the
  // button it was opened from, to fly back into.
  const [stack, setStack] = useState<ReadonlyArray<Opened>>([])
  const showcase = stack[0]?.showcase ?? null
  const setShowcase = (next: Showcase | null) =>
    setStack(next ? startStack(next.song, next.from) : [])
  // Left mid-showcase (browser back): they close, and their songs stop.
  if (!shown && stack.length) setStack([])
  const openCard = (next: Showcase) => {
    setShowcase(next)
    unbadge(next.song.id)
  }
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const selected = showcase?.song ?? null
  // By id: a live collection update brings new card objects.
  const isAway = (song: CollectedSong) =>
    selected?.id === song.id && showcase?.phase !== "lifting"
  // The page steps aside once the big card covers its thumb, and comes back
  // as it heads home.
  const immersive = showcase?.phase === "shown"

  useEffect(() => {
    if (!showcase) openerRef.current?.focus({ preventScroll: true })
  }, [showcase])

  return (
    // Like an opened pack: the page and tab bar step aside for the card,
    // which flies out of the grid and back into it.
    <div
      data-immersive={immersive || undefined}
      data-dropping={dropping || undefined}
      className="min-h-0 relative flex flex-1 flex-col"
    >
      {/* Sends only the tab bar away (and, by data-dropping, the floating
          controls), so no card falls over them; the page itself stays. */}
      {dropping ? <span data-immersive hidden /> : null}
      <GameMain inert={showcase !== null}>
        <PageHeader title="Collection" />

        <CardToolbar
          label="Search your cards"
          search={search}
          onSearch={(next) => {
            if (searched(search) !== searched(next)) scrollToTop()
            setSearch(next)
          }}
        >
          <RaritySelect value={filter} onValue={refine(setFilter)} />
          <OptionSelect
            options={SORTS}
            value={sort}
            onValue={refine(setSort)}
            label="Sort cards"
            Icon={ArrowDownUpIcon}
          />
        </CardToolbar>

        <GameScroll ref={scrollRef}>
          {/* Counted by the backend, so it's known before any card loads. */}
          <EmptyCollection />
          <NoMatch search={search} found={done ? cards : null} />
          <ul className="gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 grid grid-cols-2">
            {cards?.map((song, at) => (
              <CollectionCard
                key={song.id}
                song={song}
                isNew={fresh.has(song.id)}
                landed={isLanded(song)}
                away={isAway(song)}
                // New cards draw while still hidden, so they drop in drawn.
                eager={at < EAGER || fresh.has(song.id)}
                openerRef={openerRef}
                onShowcase={openCard}
              />
            ))}
            {/* Remounted as each page comes in, so it looks again. */}
            {done ? null : (
              <MoreCards key={more ? "ready" : "loading"} onNear={more} />
            )}
          </ul>
        </GameScroll>
      </GameMain>
      <CardKindSelect kind={kind} onKind={setKind} />
      <CollectionCount />

      <ShowcaseStack stack={stack} onStack={setStack} fallback={openerRef} />
    </div>
  )
}

// Shown once the backend counts no cards at all.
function EmptyCollection() {
  const count = useCardCount()
  if (count !== 0) return null
  return (
    <div className="gap-4 pt-16 flex flex-col items-center text-center">
      <p className="text-lg font-bold">No cards yet</p>
      <Button
        variant="game"
        nativeButton={false}
        render={<Link to="/play">Open a pack</Link>}
      />
    </div>
  )
}

// Shown once a search has found nothing: `found`, the cards it found, null
// while it's still looking.
function NoMatch({
  search,
  found,
}: {
  search: string | null
  found: ReadonlyArray<unknown> | null
}) {
  const text = search?.trim()
  if (!text || found?.length !== 0) return null
  return (
    <p className="pt-16 text-lg font-bold text-center">
      No cards match “{text}”
    </p>
  )
}

// Songs, artists or both: a round button floating over the tab bar's right
// end, showing the chosen type's icon. Steps aside with the tab bar.
function CardKindSelect({
  kind,
  onKind,
}: {
  kind: KindFilter
  onKind: (kind: KindFilter) => void
}) {
  return (
    <div className="right-4 md:right-8 md:bottom-8 mb-20 ease-out md:mb-0 in-data-immersive:translate-y-4 in-data-dropping:translate-y-4 pointer-events-none fixed game-safe-bottom z-40 transition duration-300 in-data-dropping:invisible in-data-dropping:opacity-0 in-data-immersive:invisible in-data-immersive:opacity-0">
      <Select
        items={KIND_LABELS}
        value={kind}
        onValueChange={(value) => {
          if (value) onKind(value)
        }}
      >
        <SelectTrigger
          variant="game"
          size="icon"
          aria-label={`Card type: ${KINDS[kind].label}`}
          className="pointer-events-auto"
        >
          <SelectValue>
            {(value: KindFilter) => {
              const { Icon } = KINDS[value]
              return <Icon aria-hidden="true" strokeWidth={2.5} />
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent variant="game" side="top" align="end">
          {Object.entries(KINDS).map(([key, { label, Icon }]) => (
            <SelectItem key={key} value={key}>
              <Icon aria-hidden="true" strokeWidth={2.5} />
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

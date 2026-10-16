import { CardDetail, type Showcase } from "@/game/_components/card-showcase"
import { CollectionCount } from "@/game/_components/collection-count"
import { useCollectedCards, type CollectedSong } from "@/game/_lib/collection"
import { getRouteApi, Link } from "@tanstack/react-router"
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
  SongCardThumb,
  songCardThumbSlot,
} from "@workspace/ui/components/song-card"
import {
  RARITY_ORDER,
  type CssVars,
  type Rarity,
} from "@workspace/ui/lib/game/theme"
import {
  ArrowDownAZIcon,
  ArrowDownUpIcon,
  ClockIcon,
  GemIcon,
  LayersIcon,
  ListFilterIcon,
  MicVocalIcon,
  Music2Icon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

const FILTERS = {
  all: "All rarities",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
} as const satisfies Record<"all" | Rarity, string>
type Filter = keyof typeof FILTERS

const KINDS = {
  all: { label: "All cards", Icon: LayersIcon },
  song: { label: "Songs", Icon: Music2Icon },
  artist: { label: "Artists", Icon: MicVocalIcon },
} as const
type KindFilter = keyof typeof KINDS
const KIND_LABELS = Object.fromEntries(
  Object.entries(KINDS).map(([key, { label }]) => [key, label])
)

const rarityRank = (song: CollectedSong) => RARITY_ORDER.indexOf(song.rarity)

const SORTS = {
  recent: {
    label: "Recent",
    Icon: ClockIcon,
    compare: (a: CollectedSong, b: CollectedSong) => b.pulledAt - a.pulledAt,
  },
  rarest: {
    label: "Rarest",
    Icon: GemIcon,
    compare: (a: CollectedSong, b: CollectedSong) =>
      rarityRank(b) - rarityRank(a) || b.streams - a.streams,
  },
  title: {
    label: "A–Z",
    Icon: ArrowDownAZIcon,
    compare: (a: CollectedSong, b: CollectedSong) =>
      a.title.localeCompare(b.title),
  },
} as const
type SortKey = keyof typeof SORTS
const SORT_LABELS = Object.fromEntries(
  Object.entries(SORTS).map(([key, { label }]) => [key, label])
)

// Each card's place in the grid. Under "recent", just-pulled `added` cards
// come first, newest first; a pack's cards share a pull time and come oldest
// saved first (least rare), so reversed, ties go newest first, as they dropped in.
function gridOrder(
  collection: ReadonlyArray<CollectedSong>,
  sort: SortKey,
  added: ReadonlyArray<string>
) {
  const freshness = (song: CollectedSong) => {
    const at = added.indexOf(song.id)
    return at < 0 ? added.length : at
  }
  return new Map(
    collection
      .toReversed()
      .toSorted((a, b) =>
        sort === "recent"
          ? freshness(a) - freshness(b) || SORTS.recent.compare(a, b)
          : SORTS[sort].compare(a, b)
      )
      .map((song, at) => [song.id, at])
  )
}

const TRIGGER_CLASS = "flex-1 sm:flex-none sm:min-w-48"
// Seconds before the first just-pulled card drops into the collection, then
// between each next one, and the drop itself (see game-drop).
const FIRST_DROP = 0.35
const DROP_STAGGER = 0.45
const DROP = 0.6
const route = getRouteApi("/_game/collection")

export function CollectionPage() {
  const cards = useCollectedCards()
  const collection = cards ?? []
  // New cards just pulled from a pack, newest first: shown first, under all
  // rarities and the recent order the page opens with, and badged NEW. They
  // aren't in the grid on arrival; they're added one by one, first pulled
  // first, each dropping in at the top and pushing the rest down. Leaving the
  // page drops `added` from the URL, and the badges.
  const { added = [] } = route.useSearch()
  const fresh = new Set(added)
  // How many of the new cards are in the grid so far, oldest pull first.
  const [landed, setLanded] = useState(0)
  const arriving = landed < added.length
  // The tab bar stays away until the last one is in, so none falls over it.
  const [settled, setSettled] = useState(!arriving)
  const isLanded = (song: CollectedSong) => {
    const at = added.indexOf(song.id)
    return at < 0 || added.length - 1 - at < landed
  }
  const [filter, setFilter] = useState<Filter>("all")
  const [kind, setKind] = useState<KindFilter>("all")
  const [sort, setSort] = useState<SortKey>("recent")
  const [showcase, setShowcase] = useState<Showcase | null>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const selected = showcase?.song ?? null
  // By id: a live collection update brings new card objects.
  const isAway = (song: CollectedSong) =>
    selected?.id === song.id && showcase?.phase !== "lifting"
  // The page steps aside once the big card covers its thumb, and comes back
  // as it heads home.
  const immersive = showcase?.phase === "shown"
  const order = gridOrder(collection, sort, added)
  const isShown = (song: CollectedSong) =>
    (filter === "all" || song.rarity === filter) &&
    (kind === "all" || song.kind === kind)

  useEffect(() => {
    if (!showcase) openerRef.current?.focus({ preventScroll: true })
  }, [showcase])

  useEffect(() => {
    if (!arriving) return undefined
    // The first lands as the page settles; each next once the last is in.
    const timer = setTimeout(
      () => {
        // Slides the cards below down to make room, where supported.
        if (!document.startViewTransition) {
          return setLanded((count) => count + 1)
        }
        document.startViewTransition(() =>
          flushSync(() => setLanded((count) => count + 1))
        )
      },
      (landed === 0 ? FIRST_DROP : DROP_STAGGER) * 1000
    )
    return () => clearTimeout(timer)
  }, [arriving, landed])

  useEffect(() => {
    if (arriving || settled) return undefined
    const timer = setTimeout(() => setSettled(true), DROP * 1000)
    return () => clearTimeout(timer)
  }, [arriving, settled])

  return (
    // Like an opened pack: the page and tab bar step aside for the card,
    // which flies out of the grid and back into it.
    <div
      data-immersive={immersive || undefined}
      className="min-h-0 relative flex flex-1 flex-col"
    >
      {/* Sends only the tab bar away; the page itself stays. */}
      {settled ? null : <span data-immersive hidden />}
      <GameMain inert={showcase !== null}>
        <header className="gap-x-3 gap-y-3 flex flex-wrap items-center justify-between">
          <h1 className="text-4xl font-black md:text-6xl tracking-tighter font-heading">
            Collection
          </h1>
          <CollectionCount />
        </header>

        <CollectionFilters
          filter={filter}
          onFilter={setFilter}
          sort={sort}
          onSort={setSort}
        />

        <GameScroll>
          {cards?.length === 0 ? <EmptyCollection /> : null}
          <ul className="gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 grid grid-cols-2">
            {/* Keep WebGL cards mounted while filtering; hide and reorder instead. */}
            {collection.map((song) => {
              const isNew = fresh.has(song.id)
              const orderStyle: CssVars = {
                "--game-order": String(order.get(song.id)),
                "--game-card": `card-${song.id}`,
              }
              return (
                <li
                  key={song.id}
                  hidden={!isShown(song) || !isLanded(song)}
                  className={
                    isNew
                      ? "game-drop game-order game-slides"
                      : "game-order game-slides"
                  }
                  style={orderStyle}
                >
                  <button
                    type="button"
                    className="group/card @container relative block w-full rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring"
                    aria-label={`${song.kind === "artist" ? `${song.title}, artist` : `${song.title} by ${song.artist}`}, ${song.rarity}${isNew ? ", new" : ""}`}
                    onClick={(event) => {
                      openerRef.current = event.currentTarget
                      setShowcase({
                        song,
                        from:
                          songCardThumbSlot(event.currentTarget) ?? undefined,
                        phase: "lifting",
                      })
                    }}
                  >
                    <SongCardThumb
                      song={song}
                      copies={song.copies}
                      away={isAway(song)}
                    />
                    {isNew ? (
                      <span
                        className="group-hover/card:-translate-y-1 game-new-badge transition-transform"
                        aria-hidden="true"
                      >
                        NEW
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </GameScroll>
      </GameMain>
      <CardKindSelect kind={kind} onKind={setKind} />

      {showcase ? (
        <CardDetail
          showcase={showcase}
          home={() => songCardThumbSlot(openerRef.current)}
          onShown={() =>
            setShowcase((current) =>
              current ? { ...current, phase: "shown" } : null
            )
          }
          onReturn={() =>
            setShowcase((current) =>
              current ? { ...current, phase: "returning" } : null
            )
          }
          onClose={() => setShowcase(null)}
        />
      ) : null}
    </div>
  )
}

function EmptyCollection() {
  return (
    <div className="gap-4 pt-16 flex flex-col items-center text-center">
      <p className="text-lg font-bold">No cards yet</p>
      <Button
        variant="game"
        nativeButton={false}
        render={<Link to="/">Open a pack</Link>}
      />
    </div>
  )
}

// Rarity and sort, side by side.
function CollectionFilters({
  filter,
  onFilter,
  sort,
  onSort,
}: {
  filter: Filter
  onFilter: (filter: Filter) => void
  sort: SortKey
  onSort: (sort: SortKey) => void
}) {
  return (
    <div className="mt-5 gap-3 flex">
      <Select
        items={FILTERS}
        value={filter}
        onValueChange={(value) => {
          if (value) onFilter(value)
        }}
      >
        <SelectTrigger
          variant="game"
          aria-label="Filter by rarity"
          className={TRIGGER_CLASS}
        >
          <ListFilterIcon aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent variant="game">
          {Object.entries(FILTERS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              <span
                data-rarity={key === "all" ? undefined : key}
                className="size-3 self-center rounded-full border-2 border-ink not-data-rarity:game-rarity-grid data-rarity:game-fill"
                aria-hidden="true"
              />
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={SORT_LABELS}
        value={sort}
        onValueChange={(value) => {
          if (value) onSort(value)
        }}
      >
        <SelectTrigger
          variant="game"
          aria-label="Sort cards"
          className={TRIGGER_CLASS}
        >
          <ArrowDownUpIcon aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent variant="game">
          {Object.entries(SORTS).map(([key, { label, Icon }]) => (
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
    <div className="right-4 md:right-8 md:bottom-8 mb-20 ease-out md:mb-0 in-data-immersive:translate-y-4 pointer-events-none fixed game-safe-bottom z-40 transition duration-300 in-data-immersive:invisible in-data-immersive:opacity-0">
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

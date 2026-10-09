import { CollectionCount } from "@/game/_components/collection-count"
import { COLLECTION, type CollectedSong } from "@/game/_lib/demo-data"
import { getRouteApi } from "@tanstack/react-router"
import { Celebration } from "@workspace/ui/components/celebration"
import { GameMain, GameScroll } from "@workspace/ui/components/game-shell"
import { GameStage } from "@workspace/ui/components/game-stage"
import { RarityBadge } from "@workspace/ui/components/rarity-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  SongCard,
  SongCardThumb,
  songCardThumbSlot,
  type SongCardHandle,
} from "@workspace/ui/components/song-card"
import type { CardSlot } from "@workspace/ui/lib/game/card-scene"
import { FLY } from "@workspace/ui/lib/game/reveal-motion"
import { play, REVEAL } from "@workspace/ui/lib/game/sfx"
import type { CssVars, Rarity } from "@workspace/ui/lib/game/theme"
import { ArrowDownUpIcon, ListFilterIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useEventListener } from "usehooks-ts"

const RARITY_ORDER: ReadonlyArray<Rarity> = [
  "common",
  "rare",
  "epic",
  "legendary",
]
const FILTERS = {
  all: "All rarities",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
} as const satisfies Record<"all" | Rarity, string>
type Filter = keyof typeof FILTERS

const rarityRank = (song: CollectedSong) => RARITY_ORDER.indexOf(song.rarity)

const SORTS = {
  recent: {
    label: "Recent",
    compare: (a: CollectedSong, b: CollectedSong) =>
      b.pulledOn.localeCompare(a.pulledOn),
  },
  rarest: {
    label: "Rarest",
    compare: (a: CollectedSong, b: CollectedSong) =>
      rarityRank(b) - rarityRank(a) || a.rank - b.rank,
  },
  title: {
    label: "A–Z",
    compare: (a: CollectedSong, b: CollectedSong) =>
      a.title.localeCompare(b.title),
  },
} as const
type SortKey = keyof typeof SORTS
const SORT_LABELS = Object.fromEntries(
  Object.entries(SORTS).map(([key, { label }]) => [key, label])
)

const TRIGGER_CLASS = "flex-1 sm:flex-none sm:min-w-48"
// Seconds between each just-pulled card dropping into the collection.
const DROP_STAGGER = 0.18
const route = getRouteApi("/_game/collection")

// The picked card, the grid slot it flies from, and where it is in its trip:
// still sitting on its thumb, out on show, or flying home.
type Showcase = {
  song: CollectedSong
  from: CardSlot | undefined
  phase: "lifting" | "shown" | "returning"
}

export function CollectionPage() {
  // New cards just pulled from a pack, newest first: shown first, under all
  // rarities and the recent order the page opens with, dropping in one by one
  // and badged NEW. Leaving the page drops `added` from the URL, and the badges.
  const { added = [] } = route.useSearch()
  // Only on arrival: filtering later re-shows cards, which would replay it.
  const [dropping, setDropping] = useState(added.length > 0)
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<SortKey>("recent")
  const [showcase, setShowcase] = useState<Showcase | null>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const selected = showcase?.song ?? null
  // The page steps aside once the big card covers its thumb, and comes back
  // as it heads home.
  const immersive = showcase?.phase === "shown"
  const freshness = (song: CollectedSong) => {
    const at = added.indexOf(song.id)
    return at < 0 ? added.length : at
  }
  const order = COLLECTION.toSorted((a, b) =>
    sort === "recent"
      ? freshness(a) - freshness(b) || SORTS.recent.compare(a, b)
      : SORTS[sort].compare(a, b)
  )
  const isShown = (song: CollectedSong) =>
    filter === "all" || song.rarity === filter

  useEffect(() => {
    if (!showcase) openerRef.current?.focus({ preventScroll: true })
  }, [showcase])

  useEffect(() => {
    if (!dropping) return undefined
    // Until the last card has dropped and its NEW badge been pressed on
    // (0.6s drop, then the badge's 0.75s wait and 0.7s press; game-new-badge).
    const timer = setTimeout(
      () => setDropping(false),
      (added.length * DROP_STAGGER + 1.5) * 1000
    )
    return () => clearTimeout(timer)
  }, [dropping, added.length])

  return (
    // Like an opened pack: the page and tab bar step aside for the card,
    // which flies out of the grid and back into it.
    <div
      data-immersive={immersive || undefined}
      className="min-h-0 relative flex flex-1 flex-col"
    >
      <GameMain inert={showcase !== null}>
        <header className="gap-x-3 gap-y-3 flex flex-wrap items-center justify-between">
          <h1 className="text-4xl font-black md:text-6xl tracking-tighter font-heading">
            Collection
          </h1>
          <CollectionCount />
        </header>

        <div className="mt-5 gap-3 flex">
          <Select
            items={FILTERS}
            value={filter}
            onValueChange={(value) => {
              if (value) setFilter(value)
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
                  {key === "all" ? null : (
                    <span
                      data-rarity={key}
                      className="size-3 self-center rounded-full border-2 border-ink game-fill"
                      aria-hidden="true"
                    />
                  )}
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={SORT_LABELS}
            value={sort}
            onValueChange={(value) => {
              if (value) setSort(value)
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
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <GameScroll>
          <ul className="gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 grid grid-cols-2">
            {/* Keep WebGL cards mounted while filtering; hide and reorder instead. */}
            {COLLECTION.map((song) => {
              const isNew = added.includes(song.id)
              const fresh = dropping ? added.indexOf(song.id) : -1
              const orderStyle: CssVars = {
                "--game-order": String(order.indexOf(song)),
                "--drop-delay": `${String(Math.max(fresh, 0) * DROP_STAGGER)}s`,
              }
              return (
                <li
                  key={song.id}
                  hidden={!isShown(song)}
                  className={fresh < 0 ? "game-order" : "game-drop game-order"}
                  style={orderStyle}
                >
                  <button
                    type="button"
                    className="group/card @container relative block w-full rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring"
                    aria-label={`${song.title} by ${song.artist}, ${song.rarity}${isNew ? ", new" : ""}`}
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
                      away={selected === song && showcase?.phase !== "lifting"}
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

function CardDetail({
  showcase: { song, from, phase },
  home,
  onShown,
  onReturn,
  onClose,
}: {
  showcase: Showcase
  home: () => CardSlot | null
  onShown: () => void
  onReturn: () => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<SongCardHandle>(null)
  const [landed, setLanded] = useState(false)
  // Out on show, between take-off and heading home.
  const flying = phase === "shown"

  // Starts once the big card is drawn over its thumb.
  function takeOff() {
    onShown()
    closeRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!flying) return undefined
    const timers: Array<ReturnType<typeof setTimeout>> = []
    timers.push(setTimeout(() => setLanded(true), FLY * 1000))
    if (song.rarity === "legendary") {
      timers.push(setTimeout(() => play(REVEAL.legendary), FLY * 1000 + 850))
    }
    play(song.rarity === "legendary" ? "swipe" : REVEAL[song.rarity])
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [song, flying])

  async function close() {
    if (phase === "returning") return
    onReturn()
    setLanded(false)
    play("swipe")
    await cardRef.current?.flyBack(home)
    onClose()
  }

  useEventListener("keydown", (event) => {
    if (event.key === "Escape") void close()
  })

  return (
    <dialog
      open
      aria-label={song.title}
      className="inset-0 p-0 m-0 fixed z-30 size-full max-h-none max-w-none bg-transparent text-ink"
    >
      {/* Under the card: its celebration, framed like an opened pack. */}
      <div className="inset-0 md:p-8 pointer-events-none absolute">
        <GameStage
          shape="screen"
          className="max-w-md md:h-full md:max-h-216 mx-auto aspect-393/852 h-full w-auto max-w-full"
        >
          {landed && (song.rarity === "epic" || song.rarity === "legendary") ? (
            <Celebration rarity={song.rarity} />
          ) : null}
        </GameStage>
      </div>
      {/* The whole viewport, so the card can fly from anywhere in the grid. */}
      <SongCard
        ref={cardRef}
        song={song}
        copies={song.copies}
        from={from}
        reveal={!from}
        onReady={takeOff}
      />
      <div
        data-shown={flying || undefined}
        className="inset-x-0 top-0 md:pt-8 pointer-events-none absolute opacity-0 transition-opacity duration-300 data-shown:pointer-events-auto data-shown:opacity-100"
      >
        <div className="max-w-md px-5 mx-auto flex items-center justify-between game-safe-top">
          <button
            ref={closeRef}
            type="button"
            className="size-11 grid place-items-center rounded-full bg-card text-card-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring"
            onClick={() => void close()}
            aria-label="Close"
          >
            <XIcon aria-hidden="true" />
          </button>
          <RarityBadge rarity={song.rarity} />
        </div>
      </div>
    </dialog>
  )
}

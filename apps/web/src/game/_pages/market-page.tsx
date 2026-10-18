import {
  AuctionShowcase,
  type Auction,
} from "@/game/_components/auction-showcase"
import type { Showcase } from "@/game/_components/card-showcase"
import {
  CardToolbar,
  OptionSelect,
  RaritySelect,
} from "@/game/_components/card-toolbar"
import { MoreCards } from "@/game/_components/collection-grid"
import { PageHeader } from "@/game/_components/page-header"
import { toGameCard } from "@/game/_lib/cards"
import { useAuctions, type AuctionScope } from "@/game/_lib/market"
import {
  RARITY_FILTERS,
  rarityArg,
  type RarityFilter,
} from "@/game/_lib/rarity-filter"
import { useSavedChoice } from "@/game/_lib/saved-choice"
import { timeLeft, useNow, wonOn } from "@/game/_lib/wallet"
import { useSearch } from "@tanstack/react-router"
import { GameBadge } from "@workspace/ui/components/count-badge"
import { GameMain, GameScroll } from "@workspace/ui/components/game-shell"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import {
  SongCardThumb,
  songCardThumbSlot,
} from "@workspace/ui/components/song-card"
import type { CardSlot } from "@workspace/ui/lib/game/card-scene"
import {
  CalendarCheckIcon,
  GavelIcon,
  HandCoinsIcon,
  RadioIcon,
  TimerIcon,
  TrophyIcon,
} from "lucide-react"
import { memo, useMemo, useRef, useState, type RefObject } from "react"

// Other players' auctions, the player's own, those they've bid on, or those they won.
const SCOPES = {
  live: { label: "Live auctions", Icon: RadioIcon },
  mine: { label: "My auctions", Icon: GavelIcon },
  bids: { label: "My bids", Icon: HandCoinsIcon },
  won: { label: "Won auctions", Icon: TrophyIcon },
} as const satisfies Record<AuctionScope, unknown>
const SCOPE_KEYS = Object.keys(SCOPES).filter(
  (key): key is AuctionScope => key in SCOPES
)

// What shows when a scope has nothing to show.
const EMPTY = {
  live: "No auctions right now. Put a card up from your collection.",
  mine: "You have no auctions running. Put a card up from your collection.",
  bids: "You haven't bid on any running auction.",
  won: "You haven't won an auction yet.",
} as const satisfies Record<AuctionScope, string>

// About a phone screen of cards, drawn before they're known to be in view.
const EAGER = 8

type Opened = {
  auction: Auction
  from: CardSlot | undefined
  phase: Showcase["phase"]
}

// Which auctions show: chosen on the page (and saved, like the filter), or asked for by a link
// (`?scope=`) on arrival.
function useScope() {
  const asked = useSearch({ strict: false, select: (search) => search.scope })
  const [saved, setScope] = useSavedChoice<AuctionScope>(
    "market.scope",
    SCOPE_KEYS,
    "live"
  )
  const [scope, setShown] = useState<AuctionScope>(asked ?? saved)
  const [seen, setSeen] = useState(asked)
  if (asked !== seen) {
    setSeen(asked)
    if (asked) setShown(asked)
  }
  const choose = (next: AuctionScope) => {
    setShown(next)
    setScope(next)
  }
  return [scope, choose] as const
}

// Open auctions, ending soonest first, like the collection: a rarity filter, which auctions
// (other players', yours, or those you've bid on), a search, cards loading a page at a time as the
// grid nears its end with only those near the view holding a 3D card, and a tap opening one on
// its own page. Kept mounted by GameLayout, hidden (`shown` false) on other tabs.
export function MarketPage({ shown }: { shown: boolean }) {
  const [scope, setScope] = useScope()
  const [filter, setFilter] = useSavedChoice<RarityFilter>(
    "market.rarity",
    RARITY_FILTERS,
    "all"
  )
  // Null while the search field is closed.
  const [search, setSearch] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0 })
  const now = useNow()
  const { auctions, done, more } = useAuctions(
    { scope, ...rarityArg(filter) },
    search,
    now
  )
  // The auction tapped, out on show like a collection card: flown from its thumb, which hides
  // while the big card stands in for it, and back.
  const [open, setOpen] = useState<Opened | null>(null)
  // Left mid-showcase (browser back): it closes.
  if (!shown && open) setOpen(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const setPhase = (phase: Showcase["phase"]) =>
    setOpen((current) => (current ? { ...current, phase } : null))
  const away = open && open.phase !== "lifting" ? open.auction.id : null

  return (
    // The page and tab bar step aside for the card, as in the collection.
    <div
      data-immersive={open?.phase === "shown" || undefined}
      className="min-h-0 relative flex flex-1 flex-col"
    >
      <GameMain inert={open !== null}>
        <PageHeader title="Market" />

        <CardToolbar
          label="Search auctions"
          search={search}
          onSearch={(next) => {
            // Opening or closing an empty search finds the same: the grid keeps its scroll.
            if ((next ?? "").trim() !== (search ?? "").trim()) scrollToTop()
            setSearch(next)
          }}
        >
          <RaritySelect
            value={filter}
            onValue={(next) => {
              setFilter(next)
              scrollToTop()
            }}
          />
          <OptionSelect
            options={SCOPES}
            value={scope}
            onValue={(next) => {
              setScope(next)
              scrollToTop()
            }}
            label="Which auctions"
            Icon={SCOPES[scope].Icon}
          />
        </CardToolbar>

        <GameScroll ref={scrollRef}>
          <NoAuctions
            shown={done && auctions?.length === 0}
            search={search}
            scope={scope}
          />
          <ul className="gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 grid grid-cols-2">
            {auctions?.map((auction, at) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                left={
                  auction.status === "open"
                    ? timeLeft(auction.endsAt, now)
                    : wonOn(auction.endsAt)
                }
                away={auction.id === away}
                eager={at < EAGER}
                openerRef={openerRef}
                onOpen={setOpen}
              />
            ))}
            {/* Remounted as each page comes in, so it looks again. */}
            {done ? null : (
              <MoreCards key={more ? "ready" : "loading"} onNear={more} />
            )}
          </ul>
        </GameScroll>
      </GameMain>
      {open ? (
        <AuctionShowcase
          key={open.auction.id}
          auction={open.auction}
          from={open.from}
          phase={open.phase}
          home={() => songCardThumbSlot(openerRef.current)}
          onShown={() => setPhase("shown")}
          onReturn={() => setPhase("returning")}
          onClose={() => {
            setOpen(null)
            openerRef.current?.focus({ preventScroll: true })
          }}
        />
      ) : null}
    </div>
  )
}

// Shown once there's nothing to show: no auctions in the scope, or none matching the search.
function NoAuctions({
  shown,
  search,
  scope,
}: {
  shown: boolean
  search: string | null
  scope: AuctionScope
}) {
  if (!shown) return null
  const text = search?.trim()
  return (
    <p className="pt-16 text-lg font-bold text-center">
      {text ? `No auctions match “${text}”` : EMPTY[scope]}
    </p>
  )
}

// An auction's card, with its price and time left (`left`) on its corners, or for one won, what
// it went for and the day; a tap opens it, to bid or manage it. Memoized, like the collection's
// cards: a page coming in, or the clock ticking, renders only the cards that changed.
const AuctionCard = memo(function AuctionCard({
  auction,
  left,
  away,
  eager,
  openerRef,
  onOpen,
}: {
  auction: Auction
  left: string
  // While its big card is out on show.
  away: boolean
  eager: boolean
  openerRef: RefObject<HTMLButtonElement | null>
  onOpen: (opened: Opened) => void
}) {
  const card = useMemo(() => toGameCard(auction.card), [auction.card])
  const price = auction.topBid ?? auction.startPrice
  const won = auction.status === "sold"
  const role =
    (won && `won ${left}`) ||
    (auction.isMine && "your auction") ||
    (auction.isLeading && "you lead") ||
    "bid"

  return (
    <li>
      <button
        type="button"
        className="group/card @container relative block w-full rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring"
        aria-label={`${card.kind === "artist" ? card.title : `${card.title} by ${card.artist}`}, ${role}`}
        onClick={(event) => {
          openerRef.current = event.currentTarget
          onOpen({
            auction,
            from: songCardThumbSlot(event.currentTarget) ?? undefined,
            phase: "lifting",
          })
        }}
      >
        {/* The price, in gold, and the time left, in steel, on the card's
            corners. */}
        <SongCardThumb song={card} away={away} eager={eager}>
          <GameBadge size="card-start" finish="price">
            <HoloCoin />
            {price.toLocaleString("en")}
            <span className="sr-only">
              {(won && " paid") ||
                (auction.topBid ? " top bid" : " start price")}
            </span>
          </GameBadge>
          {won ? (
            <GameBadge size="card" finish="time" aria-hidden="true">
              <CalendarCheckIcon />
              {left}
            </GameBadge>
          ) : (
            <GameBadge size="card" finish="time">
              <TimerIcon aria-hidden="true" />
              {left}
              <span className="sr-only"> left</span>
            </GameBadge>
          )}
        </SongCardThumb>
      </button>
    </li>
  )
})

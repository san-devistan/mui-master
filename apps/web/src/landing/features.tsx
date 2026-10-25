import { CardThumb } from "@/landing/floating-cards"
import { JOIN_CARDS, SHOWCASE } from "@/landing/showcase-pack"
import { atLeastOne, percent } from "@/legal/pack-odds"
import { Link } from "@tanstack/react-router"
import { GameBadge } from "@workspace/ui/components/count-badge"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import { PackMeter } from "@workspace/ui/components/pack-meter"
import { RarityBadge } from "@workspace/ui/components/rarity-badge"
import type { Rarity } from "@workspace/ui/lib/game/theme"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellIcon,
  ClockIcon,
  GavelIcon,
  LayersIcon,
  PackageOpenIcon,
  SparklesIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

const [stromae, blackpink] = SHOWCASE
const birdsOfAFeather = JOIN_CARDS.find((card) =>
  card.title.startsWith("BIRDS")
)
const tameImpala = JOIN_CARDS.find((card) => card.title === "Tame Impala")

// What the game lets you do, one line each, beside a piece of the game
// itself. Only what the game has today.
const FEATURES: ReadonlyArray<{
  Icon: LucideIcon
  rarity: Rarity
  title: string
  text: ReactNode
  visual: ReactNode
}> = [
  {
    Icon: PackageOpenIcon,
    rarity: "rare",
    title: "Open free packs",
    text: "A free pack every 8 hours. Three can wait for you, so none are lost overnight.",
    visual: <PackVisual />,
  },
  {
    Icon: SparklesIcon,
    rarity: "legendary",
    title: "Chase real rarities",
    text: (
      <>
        A song's rarity comes from its Spotify streams, and your card rises a
        rarity when the song does. Every pack has a rare or better, and a{" "}
        {percent(atLeastOne("legendary"))} chance of a legendary.{" "}
        <Link to="/odds" className="font-bold text-ink underline">
          See all the odds
        </Link>
      </>
    ),
    visual: <RarityVisual />,
  },
  {
    Icon: LayersIcon,
    rarity: "rare",
    title: "Collect songs and artists",
    text: "Artist cards rate a whole career. Sort and search your collection, and pin six favorites to your profile.",
    visual: <CollectionVisual />,
  },
  {
    Icon: GavelIcon,
    rarity: "epic",
    title: "Trade in live auctions",
    text: "Put a copy up for 1 to 24 hours, outbid rivals, and land the cards missing from your set.",
    visual: <AuctionVisual />,
  },
  {
    Icon: BellIcon,
    rarity: "legendary",
    title: "Know when a pack is ready",
    text: "Turn on notifications and hear the moment your next free pack is in.",
    visual: <NotificationVisual />,
  },
]

// The game's features, one row each: what it is on one side, a glimpse of it
// on the other.
export function Features() {
  return (
    <ul>
      {FEATURES.map(({ Icon, rarity, title, text, visual }) => (
        <li
          key={title}
          className="py-8 gap-6 sm:grid-cols-2 grid items-center border-t border-ink/10 first:border-t-0"
        >
          <div>
            <h3 className="gap-3 text-xl font-black sm:text-2xl flex items-center font-heading">
              <span
                aria-hidden="true"
                data-rarity={rarity}
                className="size-10 grid shrink-0 place-items-center rounded-xl border-2 border-ink text-ink game-fill"
              >
                <Icon className="size-5" />
              </span>
              {title}
            </h3>
            <p className="mt-3 text-pretty text-ink/70">{text}</p>
          </div>
          <div
            aria-hidden="true"
            className="h-52 relative grid place-items-center overflow-hidden rounded-3xl bg-card/50 ring-1 ring-ink/5"
          >
            {visual}
          </div>
        </li>
      ))}
    </ul>
  )
}

// The free-pack meter from the game: two held, the third filling.
function PackVisual() {
  return (
    <div className="pb-4">
      <PackMeter
        held={2}
        max={3}
        progress={0.6}
        badge={
          <>
            <ClockIcon />
            3h 12m
          </>
        }
      />
    </div>
  )
}

// A song's rarities by its streams (songs/_lib/rarity.ts), up to legendary.
const TIERS: ReadonlyArray<{ rarity: Rarity; streams: string }> = [
  { rarity: "common", streams: "100M+" },
  { rarity: "rare", streams: "400M+" },
  { rarity: "epic", streams: "1B+" },
  { rarity: "legendary", streams: "2B+" },
]

// Streams, rarity and pack odds side by side: the counts right-aligned in a
// column wide enough for the longest, the badges lined up beside them, then
// the chance a pack holds that rarity or better (pack-odds.ts).
function RarityVisual() {
  return (
    <div className="gap-2 text-sm font-black grid font-heading">
      <div className="gap-3 text-xs flex items-center whitespace-nowrap text-ink/50">
        <span className="w-16 text-right">Streams</span>
        <span className="w-28">Rarity</span>
        <span className="w-16 text-right">In a pack</span>
      </div>
      {TIERS.map(({ rarity, streams }) => (
        <div key={rarity} className="gap-3 flex items-center">
          <span className="w-16 text-right text-ink/60 tabular-nums">
            {streams}
          </span>
          <span className="w-28">
            <RarityBadge rarity={rarity} />
          </span>
          <span className="w-16 text-right tabular-nums">
            {percent(atLeastOne(rarity))}
          </span>
        </div>
      ))}
    </div>
  )
}

// Three cards fanned out like a hand, one held twice.
function CollectionVisual() {
  const hand = [stromae, blackpink, birdsOfAFeather]
  const tilts = ["-rotate-12 translate-y-3", "", "rotate-12 translate-y-3"]
  return (
    <div className="-space-x-6 flex items-end">
      {hand.map((card, index) =>
        card ? (
          <div key={card.id} className={`w-24 ${tilts[index]}`}>
            <CardThumb song={card} copies={index === 1 ? 2 : 1} eager />
          </div>
        ) : null
      )}
    </div>
  )
}

// A trade on the market: the card goes one way, its top bid in holos comes
// back the other, each with its arrow. The card keeps the market's time left
// on its corner.
function AuctionVisual() {
  if (!tameImpala) return null
  return (
    <div className="gap-3 sm:gap-4 flex items-center">
      <div className="w-24 -rotate-3">
        <CardThumb song={tameImpala} eager>
          <GameBadge size="card" finish="time">
            <TimerIcon />
            2h 14m
          </GameBadge>
        </CardThumb>
      </div>
      <div className="gap-2 text-xs font-black flex flex-col items-center font-heading text-ink/60">
        <span className="gap-1 flex items-center">
          Card
          <ArrowRightIcon className="size-5 text-ink" strokeWidth={3} />
        </span>
        <span className="gap-1 flex items-center">
          <ArrowLeftIcon className="size-5 text-ink" strokeWidth={3} />
          Holos
        </span>
      </div>
      <div className="gap-2 flex flex-col items-center">
        <span className="text-3xl -space-x-3 flex">
          <HoloCoin />
          <HoloCoin />
          <HoloCoin />
        </span>
        <GameBadge finish="price">
          <HoloCoin />
          1,240
        </GameBadge>
      </div>
    </div>
  )
}

// The game's free-pack notification, as a phone shows it.
function NotificationVisual() {
  return (
    <div className="max-w-xs p-3 gap-3 shadow-lg mx-4 flex w-full items-start rounded-2xl bg-card">
      <img src="/icon.svg" alt="" width={40} height={40} className="size-10" />
      <div className="min-w-0 text-sm">
        <p className="gap-2 flex justify-between">
          <span className="font-black">Free pack ready</span>
          <span className="text-ink/50">now</span>
        </p>
        <p className="text-ink/70">
          A free pack is waiting for you. Rip it open!
        </p>
      </div>
    </div>
  )
}

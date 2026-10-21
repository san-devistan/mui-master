import {
  CardDetail,
  SongFact,
  type Showcase,
  type ShowcaseActionsProps,
} from "@/game/_components/card-showcase"
import { RelatedCards } from "@/game/_components/related-cards"
import { useOnceAtATime } from "@/game/_hooks/use-once-at-a-time"
import { toGameCard } from "@/game/_lib/cards"
import type { CollectedSong } from "@/game/_lib/collection"
import {
  errorText,
  holos,
  timeLeft,
  useNow,
  useWallet,
  wonOn,
} from "@/game/_lib/wallet"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import { Button } from "@workspace/ui/components/button"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import { Input } from "@workspace/ui/components/input"
import type { CardSlot } from "@workspace/ui/lib/game/card-scene"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { GavelIcon, MinusIcon, PlusIcon, UndoIcon } from "lucide-react"
import { type ComponentProps, useState } from "react"

// An auction as the market lists it.
export type Auction = FunctionReturnType<
  typeof api.market.auctions
>["page"][number]
// One auction as its page shows it, with its bids.
type AuctionDetail = NonNullable<FunctionReturnType<typeof api.market.auction>>

// A bid's prefill: the price so far plus 10%, rounded up, never under what the auction takes.
// In whole tenths first, so 100 makes 110, not 111 (100 × 1.1 is 110.00000000000001).
const suggestedBid = (auction: Auction) =>
  Math.max(
    auction.minBid,
    Math.ceil(((auction.topBid ?? auction.startPrice) * 11) / 10)
  )

// How much −/+ moves a bid: like the start price's −/+, finer when it's low, so any bid is a
// few taps away (5 under 100, then 10, 100, 1,000…).
const bidStep = (amount: number) =>
  amount < 100 ? 5 : 10 ** Math.max(1, Math.floor(Math.log10(amount)) - 1)

const timeOfDay = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
})

// An auction picked from the market, on the card's own page as in the collection: the card
// flies out of the grid, with its price and time left under it, then a bid (or taking it
// back, for the player's own), and every bid below, then its related cards as in the
// collection (`onRelated` opens an owned one over it). One the player won shows what it went
// for and the day. `phase`, `covered` and the handlers are the showcase's.
export function AuctionShowcase({
  auction,
  from,
  phase,
  home,
  onShown,
  onReturn,
  onClose,
  onRelated,
  covered,
}: {
  auction: Auction
  from: CardSlot | undefined
  phase: Showcase["phase"]
  home: () => CardSlot | null
  onShown: () => void
  onReturn: () => void
  onClose: () => void
  onRelated: ComponentProps<typeof RelatedCards>["onOpen"]
  covered: boolean
}) {
  const now = useNow()
  const { data: detail } = useQuery(
    convexQuery(api.market.auction, { id: auction.id })
  )
  // Live: a bid from someone else moves the price and the history as it lands.
  const shown = detail ?? auction
  // The card as the showcase draws it: the auction's copy, held by nobody here.
  const [song] = useState<CollectedSong>(() => ({
    ...toGameCard(auction.card),
    copies: 1,
    pulledAt: 0,
  }))
  const price = shown.topBid ?? shown.startPrice
  const won = shown.status === "sold"

  return (
    <CardDetail
      showcase={{ song, from, phase }}
      home={home}
      onShown={onShown}
      onReturn={onReturn}
      onClose={onClose}
      covered={covered}
      parts={{
        facts: (
          <>
            <SongFact
              label={
                (won && "Won for") || (shown.topBid ? "Top bid" : "Starts at")
              }
              value={<Holos amount={price} />}
            />
            {won ? (
              <SongFact label="Won on" value={wonOn(shown.endsAt)} />
            ) : (
              <SongFact label="Ends in" value={timeLeft(shown.endsAt, now)} />
            )}
          </>
        ),
        Actions: AuctionActions,
        context: auction,
        below: (
          <>
            <AuctionHistory detail={detail} />
            <RelatedCards song={song} onOpen={onRelated} />
          </>
        ),
      }}
    />
  )
}

// An amount with its coin, as a fact's value.
function Holos({ amount }: { amount: number }) {
  return (
    <span className="gap-2 inline-flex items-center">
      <HoloCoin />
      {amount.toLocaleString("en")}
    </span>
  )
}

// Under the facts: a bid, the player's standing, or taking their own auction back; and the
// close button. `context`: the auction as the market listed it, read live from then on.
function AuctionActions({
  context,
  closeButton,
  close: onDone,
}: ShowcaseActionsProps<Auction>) {
  const { data } = useQuery(convexQuery(api.market.auction, { id: context.id }))
  const auction = data ?? context
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const once = useOnceAtATime()

  const run = (action: () => Promise<unknown>, after?: () => void) =>
    once(async () => {
      setBusy(true)
      setError(null)
      try {
        await action()
        after?.()
      } catch (caught) {
        setError(errorText(caught))
      } finally {
        setBusy(false)
      }
    })

  return (
    <div className="gap-3 flex w-full flex-col items-center">
      <Standing auction={auction} busy={busy} run={run} onTaken={onDone} />
      {error ? (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
      {closeButton}
    </div>
  )
}

type Run = (action: () => Promise<unknown>, after?: () => void) => Promise<void>

// The player's part in it: over (won, the card in their collection), theirs to manage, or a bid.
function Standing({
  auction,
  busy,
  run,
  onTaken,
}: {
  auction: Auction
  busy: boolean
  run: Run
  onTaken: () => void
}) {
  if (auction.status !== "open") {
    return (
      <p className="text-sm font-bold text-center">
        {auction.isLeading
          ? "You won it: the card is in your collection."
          : "This auction is over."}
      </p>
    )
  }
  if (auction.isMine) {
    return (
      <SellerActions
        auction={auction}
        busy={busy}
        run={run}
        onTaken={onTaken}
      />
    )
  }
  return <BidForm auction={auction} busy={busy} run={run} />
}

// The player's own auction: taken back while nobody has bid; after that it runs to the end.
function SellerActions({
  auction,
  busy,
  run,
  onTaken,
}: {
  auction: Auction
  busy: boolean
  run: Run
  onTaken: () => void
}) {
  const cancel = useMutation(api.market.cancel)
  if (auction.topBid !== null) {
    return (
      <p className="text-sm font-bold text-center">
        Someone has bid: it runs to the end, and the top bid is yours.
      </p>
    )
  }
  return (
    <Button
      variant="game"
      disabled={busy}
      onClick={() => void run(() => cancel({ id: auction.id }), onTaken)}
    >
      <UndoIcon aria-hidden="true" />
      Take back
    </Button>
  )
}

// A bid on someone else's auction, prefilled with the price plus 10%; −/+ step it and the round
// gavel at the row's end places it. The one they lead just says so.
function BidForm({
  auction,
  busy,
  run,
}: {
  auction: Auction
  busy: boolean
  run: Run
}) {
  const wallet = useWallet()
  const bid = useMutation(api.market.bid)
  // The prefill follows the price until the player types their own.
  const [typed, setTyped] = useState<string | null>(null)
  const amount = typed ?? String(suggestedBid(auction))
  const offer = Number(amount)
  const valid = Number.isInteger(offer) && offer >= auction.minBid
  const affordable = wallet !== null && offer <= wallet.coins
  const step = (direction: 1 | -1) => {
    const current = valid ? offer : auction.minBid
    const next = current + direction * bidStep(current)
    setTyped(String(Math.max(auction.minBid, next)))
  }

  if (auction.isLeading) {
    return (
      <p className="text-sm font-bold text-center">
        You lead. Outbid, your coins come back to you.
      </p>
    )
  }
  return (
    <div className="gap-2 text-sm font-bold grid w-full">
      <div className="gap-2 flex items-center">
        <Button
          variant="game"
          size="icon-game"
          aria-label="Lower the bid"
          disabled={!valid || offer <= auction.minBid}
          onClick={() => step(-1)}
        >
          <MinusIcon aria-hidden="true" />
        </Button>
        <Input
          variant="game"
          type="number"
          inputMode="numeric"
          aria-label={`Your bid, at least ${holos(auction.minBid)}`}
          min={auction.minBid}
          step={1}
          value={amount}
          onChange={(event) => setTyped(event.target.value)}
          className="text-center"
        />
        <Button
          variant="game"
          size="icon-game"
          aria-label="Raise the bid"
          onClick={() => step(1)}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
        <Button
          variant="game"
          size="icon-game"
          aria-label={valid ? `Bid ${holos(offer)}` : "Bid"}
          disabled={busy || !valid || !affordable}
          onClick={() =>
            void run(
              () => bid({ id: auction.id, amount: offer }),
              () => setTyped(null)
            )
          }
        >
          <GavelIcon aria-hidden="true" />
        </Button>
      </div>
      {wallet && !affordable ? (
        <p className="gap-1 inline-flex items-center justify-center text-destructive">
          You have <HoloCoin /> {wallet.coins.toLocaleString("en")}
        </p>
      ) : null}
    </div>
  )
}

// Every bid, newest first, or that there's none yet; null while it loads.
function AuctionHistory({
  detail,
}: {
  detail: AuctionDetail | undefined | null
}) {
  if (!detail) return null
  return (
    <section className="px-5 gap-3 flex flex-col">
      <h2 className="text-lg font-black font-heading">Bids</h2>
      {detail.bids.length > 0 ? (
        <ol className="gap-2 flex flex-col">
          {detail.bids.map((entry, at) => (
            <HistoryRow
              key={entry.id}
              who={entry.bidder}
              what={at === 0 ? "top bid" : "bid"}
              when={entry.at}
              amount={entry.amount}
              highlight={entry.isYours}
            />
          ))}
        </ol>
      ) : (
        <p className="text-sm font-bold text-ink/60">No bids yet.</p>
      )}
    </section>
  )
}

function HistoryRow({
  who,
  what,
  when,
  amount,
  highlight,
}: {
  who: string
  what: string
  when: number
  amount: number
  highlight: boolean
}) {
  return (
    <li
      data-yours={highlight || undefined}
      className="px-4 py-3 gap-3 bg-white/60 flex items-center justify-between rounded-2xl data-yours:bg-brand/15"
    >
      <span className="min-w-0 flex flex-col">
        <span className="font-black truncate font-heading">{who}</span>
        <span className="text-sm truncate text-ink/60">
          {what} · {timeOfDay.format(when)}
        </span>
      </span>
      <span className="font-black shrink-0 font-heading">
        <Holos amount={amount} />
      </span>
    </li>
  )
}

// An auction id, typed for the backend.
export type AuctionId = Id<"auctions">

import { useOnceAtATime } from "@/game/_hooks/use-once-at-a-time"
import type { CollectedSong } from "@/game/_lib/collection"
import { errorText, holos, useWallet } from "@/game/_lib/wallet"
import { useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import { Input } from "@workspace/ui/components/input"
import { Slider } from "@workspace/ui/components/slider"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { useMutation } from "convex/react"
import { GavelIcon, MinusIcon, PlusIcon } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useState, type ReactNode } from "react"

// How much −/+ moves the start price: finer when it's low, so any price is a few taps away.
const priceStep = (price: number) => {
  if (price < 10) return 1
  return price < 100 ? 10 : 100
}

// The showcase's trade buttons either side of `children` (its close button): sell copies to the
// bank, or put one up for auction. `copies`: how many the player has now; `onTraded` gets how
// many just left the collection.
export function CardTrade({
  song,
  copies,
  onTraded,
  children,
}: {
  song: CollectedSong
  copies: number
  onTraded: (count: number) => void
  children: ReactNode
}) {
  const wallet = useWallet()
  const [listing, setListing] = useState(false)
  const [selling, setSelling] = useState(false)
  const price = wallet?.sellPrice[song.rarity]

  return (
    // Equal halves either side, so the close button sits in the middle whatever the labels'
    // widths; Sell and Auction sit against it, the same gap away on each side.
    <div className="gap-4 flex w-full items-center">
      <div className="flex flex-1 justify-end">
        <Button
          variant="game"
          disabled={copies < 1 || price === undefined}
          onClick={() => setSelling(true)}
        >
          <HoloCoin />
          Sell
        </Button>
      </div>
      {children}
      <div className="flex flex-1 justify-start">
        <Button variant="game" onClick={() => setListing(true)}>
          <GavelIcon aria-hidden="true" />
          Auction
        </Button>
      </div>
      {price === undefined ? null : (
        <SellDialog
          song={song}
          copies={copies}
          price={price}
          open={selling}
          onOpenChange={setSelling}
          onSold={onTraded}
        />
      )}
      <AuctionDialog
        song={song}
        open={listing}
        onOpenChange={setListing}
        onListed={() => onTraded(1)}
      />
    </div>
  )
}

// Selling to the bank: a confirm for a single copy, else a slider for how many.
function SellDialog({
  song,
  copies,
  price,
  open,
  onOpenChange,
  onSold,
}: {
  song: CollectedSong
  copies: number
  price: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSold: (count: number) => void
}) {
  const sell = useMutation(api.market.sell)
  const posthog = usePostHog()
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const once = useOnceAtATime()
  const chosen = Math.min(count, copies)
  const all = chosen === copies

  const submit = () =>
    once(async () => {
      setBusy(true)
      setError(null)
      try {
        await sell({ cardId: song.id, count: chosen })
        posthog.capture("card_sold", {
          card_rarity: song.rarity,
          card_count: chosen,
          holo_value: price * chosen,
        })
        onOpenChange(false)
        setCount(1)
        onSold(chosen)
      } catch (caught) {
        setError(errorText(caught))
      } finally {
        setBusy(false)
      }
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="game">
        <div className="gap-6 grid">
          <DialogHeader>
            <DialogTitle>Sell</DialogTitle>
            <DialogDescription>
              {copies === 1
                ? `It's your only copy: it leaves your collection for ${holos(price)}.`
                : `You have ${copies} copies, ${holos(price)} each.`}
            </DialogDescription>
          </DialogHeader>
          {copies > 1 ? (
            <div className="gap-3 grid">
              <div className="text-sm font-bold flex justify-between">
                <span id="sell-count-label">Copies to sell</span>
                <span>
                  {chosen} of {copies}
                </span>
              </div>
              <Slider
                variant="game"
                aria-labelledby="sell-count-label"
                min={1}
                max={copies}
                step={1}
                value={chosen}
                onValueChange={(value) =>
                  setCount(typeof value === "number" ? value : (value[0] ?? 1))
                }
              />
              {all ? (
                <p className="text-sm text-muted-foreground">
                  That's all of them: the card leaves your collection.
                </p>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter variant="game">
            <Button
              variant="game"
              className="flex-1"
              disabled={busy}
              onClick={() => void submit()}
            >
              <HoloCoin />
              Sell for {(price * chosen).toLocaleString("en")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AuctionDialog({
  song,
  open,
  onOpenChange,
  onListed,
}: {
  song: CollectedSong
  open: boolean
  onOpenChange: (open: boolean) => void
  onListed: () => void
}) {
  const list = useMutation(api.market.list)
  const navigate = useNavigate()
  const posthog = usePostHog()
  const wallet = useWallet()
  // Untouched, it's what the bank pays for the card, so an auction never asks less by default.
  const [typed, setTyped] = useState<string | null>(null)
  const price = typed ?? String(wallet?.sellPrice[song.rarity] ?? 1)
  const setPrice = setTyped
  const [hours, setHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const once = useOnceAtATime()
  const startPrice = Number(price)
  const valid = Number.isInteger(startPrice) && startPrice >= 1
  // −/+ snap to the step, so 47 goes to 40 or 50.
  const stepPrice = (direction: 1 | -1) => {
    const current = valid ? startPrice : 1
    const step = priceStep(direction > 0 ? current : current - 1)
    const next =
      direction > 0
        ? Math.floor(current / step) * step + step
        : Math.ceil(current / step) * step - step
    setPrice(String(Math.max(1, next)))
  }

  const submit = () =>
    once(async () => {
      setBusy(true)
      setError(null)
      try {
        await list({ cardId: song.id, startPrice, hours })
        posthog.capture("auction_created", {
          card_rarity: song.rarity,
          start_price: startPrice,
          duration_hours: hours,
        })
        onOpenChange(false)
        onListed()
        void navigate({ to: "/market", search: { scope: "mine" } })
      } catch (caught) {
        setError(errorText(caught))
      } finally {
        setBusy(false)
      }
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="game">
        <div className="gap-6 grid">
          <DialogHeader>
            <DialogTitle>Put up for auction</DialogTitle>
            <DialogDescription>
              A copy leaves your collection until the auction ends. It comes
              back if nobody bids; the top bid is all yours.
            </DialogDescription>
          </DialogHeader>
          <div className="gap-2 text-sm font-bold grid">
            <label htmlFor="auction-start-price">Start price</label>
            <div className="gap-2 flex items-center">
              <Button
                variant="game"
                size="icon-game"
                aria-label="Lower the start price"
                disabled={!valid || startPrice <= 1}
                onClick={() => stepPrice(-1)}
              >
                <MinusIcon aria-hidden="true" />
              </Button>
              <Input
                id="auction-start-price"
                variant="game"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="text-center"
              />
              <Button
                variant="game"
                size="icon-game"
                aria-label="Raise the start price"
                onClick={() => stepPrice(1)}
              >
                <PlusIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="gap-2 text-sm font-bold grid">
            <span id="auction-length-label">Length</span>
            <ToggleGroup
              variant="game"
              aria-labelledby="auction-length-label"
              className="w-full justify-between"
              value={[String(hours)]}
              onValueChange={(value) => {
                // Pressing the chosen one again keeps it chosen.
                if (value[0]) setHours(Number(value[0]))
              }}
            >
              {(wallet?.auctionHours ?? [24]).map((choice) => (
                <ToggleGroupItem key={choice} value={String(choice)}>
                  {choice}h
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {error ? (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter variant="game">
            <Button
              variant="game"
              className="flex-1"
              disabled={busy || !valid}
              onClick={() => void submit()}
            >
              <GavelIcon aria-hidden="true" />
              Start auction
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

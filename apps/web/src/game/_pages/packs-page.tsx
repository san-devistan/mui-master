import { FreePacks } from "@/game/_components/free-packs"
import { HoloShop } from "@/game/_components/holo-shop"
import { PageHeader } from "@/game/_components/page-header"
import { useOnceAtATime } from "@/game/_hooks/use-once-at-a-time"
import { useRevealMusic } from "@/game/_hooks/use-reveal-music"
import { toGameCard, type GameCard } from "@/game/_lib/cards"
import { errorText, holos, useWallet } from "@/game/_lib/wallet"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogGameClose,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import { PackOpening } from "@workspace/ui/components/pack-opening"
import { Slider } from "@workspace/ui/components/slider"
import type { CssVars } from "@workspace/ui/lib/game/theme"
import { useMutation } from "convex/react"
import { ClockIcon } from "lucide-react"
import { useEffect, useState } from "react"

// The pack flies in only the first time the page loads; coming back to the
// tab later, it's already waiting. Module state, so a full reload replays it.
let arrived = false

type Pull = GameCard & { isNew: boolean }

// `onOpen`: the pack was tapped open, so the next visit starts on a new one.
export function PacksPage({ onOpen }: { onOpen: () => void }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const music = useRevealMusic()
  const nextPack = useMutation(api.packs.next)
  const claimPack = useMutation(api.packs.claim)
  const { data: catalog } = useQuery(convexQuery(api.packs.catalog, {}))
  // Every second, so a pack coming in unlocks right as the countdown ends.
  const wallet = useWallet(1000)
  const [error, setError] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)
  const [shopping, setShopping] = useState(false)
  // Locked until the wallet is known, then while there's no pack to open, free or bought.
  const locked = !open && (!wallet || wallet.packs === 0)
  // The waiting pack, drawn ahead so its cards are ready once it's cut open; the backend keeps it
  // the same until it's opened.
  const [pulls, setPulls] = useState<ReadonlyArray<Pull> | null>(null)
  // Read once, then marked, so this visit keeps its entrance.
  const [entrance] = useState(() => {
    const first = !arrived
    arrived = true
    return first
  })

  useEffect(() => {
    let cancelled = false
    async function draw() {
      const cards = await nextPack()
      if (cancelled) return
      // In the backend's order: least rare first, the pack's best card last.
      setPulls(cards.map(toGameCard))
    }
    void draw()
    return () => {
      cancelled = true
    }
  }, [nextPack])

  return (
    <div
      data-immersive={open || undefined}
      className="min-h-0 relative flex flex-1 justify-center"
    >
      {pulls && catalog ? (
        <PackOpening
          pulls={pulls}
          covers={catalog.covers}
          entrance={entrance}
          // Grayed only once the wallet says there's none, so it doesn't flash gray on load.
          locked={locked && wallet !== null}
          onLockedTap={() => setBuying(true)}
          onOpenChange={(next) => {
            // The tap that opens the pack lets the previews play later.
            if (!next) return
            music.unlock()
            // Owned from the moment it's opened, so leaving mid-reveal keeps the cards.
            claimPack({}).catch((caught: unknown) =>
              setError(errorText(caught))
            )
            onOpen()
            setOpen(next)
          }}
          onCard={(pull, revealed) => {
            const shown = pulls.find((card) => card.id === pull?.id)
            if (shown?.previewSongId) {
              void music.play(shown.previewSongId, revealed, shown.preview)
            } else music.stop()
          }}
          onDone={() =>
            void navigate({
              to: "/collection",
              // Only cards the player didn't have, newest (last revealed) first.
              search: {
                added: pulls
                  .filter((pull) => pull.isNew)
                  .map((pull) => pull.id)
                  .toReversed(),
              },
            })
          }
        />
      ) : null}
      <GetPacks
        open={buying}
        onOpenChange={setBuying}
        onGetHolos={() => {
          setBuying(false)
          setShopping(true)
        }}
      />
      <HoloShop open={shopping} onOpenChange={setShopping} />
      <header className="inset-x-0 top-0 max-w-6xl px-4 sm:px-6 md:px-8 md:pt-8 in-data-immersive:-translate-y-4 pointer-events-none absolute z-30 mx-auto game-safe-top transition duration-300 in-data-immersive:opacity-0">
        <PageHeader title="Packs" />
        {/* Centred over the waiting pack, out of the header's way; tapped, get
            more packs. */}
        <div className="mt-5 flex justify-center">
          <FreePacks onGetPacks={() => setBuying(true)} />
        </div>
        {error ? (
          <p role="alert" className="mt-3 font-bold text-destructive">
            {error}
          </p>
        ) : null}
      </header>
    </div>
  )
}

// More packs, from the pack meter or the grayed pack once every pack is opened: skip the wait for
// the next free one (wallet:skipFreePack), then buy packs, as many as the holos pay for, kept
// until opened on top of the free ones (wallet:buyPacks). Short of holos, it points to the shop.
function GetPacks({
  open,
  onOpenChange,
  onGetHolos,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGetHolos: () => void
}) {
  const wallet = useWallet()
  const buyPacks = useMutation(api.wallet.buyPacks)
  const skipFreePack = useMutation(api.wallet.skipFreePack)
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Shared by buying and skipping: one payment at a time.
  const once = useOnceAtATime()
  const { most, chosen, cost, skip, short } = packChoices(wallet, count)

  const pay = (action: () => Promise<null>) =>
    once(async () => {
      setBusy(true)
      setError(null)
      try {
        await action()
        setCount(1)
        onOpenChange(false)
      } catch (caught) {
        setError(errorText(caught))
      } finally {
        setBusy(false)
      }
    })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent variant="game">
        <div className="gap-6 grid">
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle>Get packs</DialogTitle>
            <DialogGameClose />
          </DialogHeader>
          <SkipWait
            wallet={wallet}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            once={once}
            onSkip={() => skipFreePack({})}
            onDone={() => onOpenChange(false)}
          />
          <section data-slot="buy-packs" aria-labelledby="buy-packs-title">
            <p id="buy-packs-title" data-slot="get-packs-title">
              Buy packs
            </p>
            {short ? (
              <ShortOfHolos wallet={wallet} skip={skip} />
            ) : (
              <PackCount chosen={chosen} most={most} onChange={setCount} />
            )}
            <div data-slot="get-packs-action">
              <PackFooter
                short={short}
                chosen={chosen}
                cost={cost}
                disabled={!wallet || busy || most === 0}
                onBuy={() => void pay(() => buyPacks({ count: chosen }))}
                onGetHolos={onGetHolos}
              />
            </div>
          </section>
          {error ? (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// What the holos pay for: packs to buy (as many as `count`, at most what's affordable) and the
// free pack's skip; `short` when neither is.
function packChoices(wallet: ReturnType<typeof useWallet>, count: number) {
  if (!wallet) {
    return { most: 0, chosen: 1, cost: 0, skip: null, short: false }
  }
  const most = Math.min(
    wallet.maxPacksBought,
    Math.floor(wallet.coins / wallet.packPrice)
  )
  const chosen = Math.max(1, Math.min(count, most))
  const skip = wallet.skipPrice
  return {
    most,
    chosen,
    cost: chosen * wallet.packPrice,
    skip,
    short: most === 0 && (skip === null || skip > wallet.coins),
  }
}

function ShortOfHolos({
  wallet,
  skip,
}: {
  wallet: ReturnType<typeof useWallet>
  skip: number | null
}) {
  if (!wallet) return null
  return (
    <p className="text-sm font-bold">
      A pack costs {holos(wallet.packPrice)}
      {skip === null ? "" : `, skipping the wait ${holos(skip)}`}. You have{" "}
      {holos(wallet.coins)}.
    </p>
  )
}

// Buying the chosen packs, with their price, or getting holos when short of them.
function PackFooter({
  short,
  chosen,
  cost,
  disabled,
  onBuy,
  onGetHolos,
}: {
  short: boolean
  chosen: number
  cost: number
  disabled: boolean
  onBuy: () => void
  onGetHolos: () => void
}) {
  if (short) {
    return (
      <Button variant="game" onClick={onGetHolos}>
        <HoloCoin />
        Get holos
      </Button>
    )
  }
  const packs = chosen === 1 ? "a pack" : `${chosen} packs`
  return (
    <Button
      variant="game"
      disabled={disabled}
      aria-label={`Buy ${packs} for ${holos(cost)}`}
      onClick={onBuy}
    >
      <HoloCoin />
      <span data-slot="get-packs-price">{cost.toLocaleString("en")}</span>
      <span data-slot="get-packs-verb">Buy</span>
    </Button>
  )
}

// Paying to have the next free pack now: the wait as a track the full width, a mini pack riding
// its fill and the time left under it, then the price on the button that pays it, at the right.
function SkipWait({
  wallet,
  busy,
  setBusy,
  setError,
  once,
  onSkip,
  onDone,
}: {
  wallet: ReturnType<typeof useWallet>
  busy: boolean
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
  once: ReturnType<typeof useOnceAtATime>
  onSkip: () => Promise<null>
  onDone: () => void
}) {
  const [skipped, setSkipped] = useState(false)
  const view = skipView(wallet, skipped)
  if (!view) return null
  const fill: CssVars = { "--skip-progress": String(view.progress) }

  // Pays for the wait, fills the bar to the end, then closes on the pack now ready.
  const skip = () =>
    once(async () => {
      setBusy(true)
      setError(null)
      try {
        await onSkip()
        setSkipped(true)
        await new Promise((done) => setTimeout(done, 900))
        onDone()
      } catch (caught) {
        setError(errorText(caught))
      } finally {
        setBusy(false)
      }
    })

  return (
    <section
      data-slot="skip-wait"
      data-skipped={skipped || undefined}
      aria-labelledby="skip-title"
    >
      <p id="skip-title" data-slot="get-packs-title">
        {skipped ? "Free pack ready" : "Skip the wait"}
      </p>
      <div data-slot="skip-wait-progress">
        <progress
          className="sr-only"
          aria-label={`Until the next free pack: ${view.wait} left`}
          value={view.progress}
        />
        <div data-slot="skip-wait-track" style={fill} aria-hidden="true">
          <span data-slot="skip-wait-fill" />
          <span data-slot="skip-wait-pack" />
        </div>
        <span data-slot="skip-wait-time" aria-hidden="true">
          <ClockIcon aria-hidden="true" />
          {view.wait}
        </span>
      </div>
      <div data-slot="get-packs-action">
        <Button
          variant="game"
          disabled={busy || skipped || !view.affordable}
          aria-label={`Get the next free pack now for ${holos(view.price)}`}
          onClick={() => void skip()}
        >
          <HoloCoin />
          <span data-slot="get-packs-price">
            {view.price.toLocaleString("en")}
          </span>
          <span data-slot="get-packs-verb">Skip</span>
        </Button>
      </div>
    </section>
  )
}

// What the skip shows: the wait and its fill, or the full bar once paid.
function skipView(wallet: ReturnType<typeof useWallet>, skipped: boolean) {
  const price = wallet?.skipPrice ?? null
  if (skipped) {
    return { progress: 1, wait: "0h 00m", price: price ?? 0, affordable: false }
  }
  if (!wallet?.nextFreeIn || price === null) return null
  return {
    progress: wallet.nextFreeProgress,
    wait: wallet.nextFreeIn,
    price,
    affordable: price <= wallet.coins,
  }
}

// How many packs to buy, from one to as many as the holos pay for: a slider the full width, the
// count over it.
function PackCount({
  chosen,
  most,
  onChange,
}: {
  chosen: number
  most: number
  onChange: (count: number) => void
}) {
  return (
    <div data-slot="pack-count">
      <div className="text-sm font-bold flex justify-between">
        <span id="buy-count-label">
          {chosen} {chosen === 1 ? "pack" : "packs"}
        </span>
        <span className="text-ink/60">{most} at most</span>
      </div>
      <Slider
        variant="game"
        aria-labelledby="buy-count-label"
        min={1}
        max={Math.max(1, most)}
        step={1}
        value={chosen}
        disabled={most <= 1}
        onValueChange={(value) =>
          onChange(typeof value === "number" ? value : (value[0] ?? 1))
        }
      />
    </div>
  )
}

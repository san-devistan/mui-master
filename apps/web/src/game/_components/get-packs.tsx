import { useOnceAtATime } from "@/game/_hooks/use-once-at-a-time"
import { errorText, holos, useWallet } from "@/game/_lib/wallet"
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
import { Slider } from "@workspace/ui/components/slider"
import type { CssVars } from "@workspace/ui/lib/game/theme"
import { useMutation } from "convex/react"
import { ClockIcon } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useState } from "react"

// More packs, from the pack meter or the grayed pack once every pack is opened: skip the wait for
// the next free one (wallet:skipFreePack), then buy packs, as many as the holos pay for, kept
// until opened on top of the free ones (wallet:buyPacks). Short of holos, it points to the shop
// when there's one (`onGetHolos`, premium on).
export function GetPacks({
  open,
  onOpenChange,
  onGetHolos,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGetHolos?: () => void
}) {
  const wallet = useWallet()
  const posthog = usePostHog()
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
        posthog.capture("packs_purchased", {
          pack_count: chosen,
          holo_cost: cost,
        })
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
  onGetHolos?: () => void
}) {
  if (short && onGetHolos) {
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
  const posthog = usePostHog()
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
        posthog.capture("free_pack_wait_skipped", { holo_cost: view.price })
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

import { useOnceAtATime } from "@/game/_hooks/use-once-at-a-time"
import { errorText, holos, useWallet } from "@/game/_lib/wallet"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import { useAction } from "convex/react"
import { CheckIcon, CrownIcon, XIcon } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useState } from "react"

const euros = (cents: number) =>
  (cents / 100).toLocaleString("en", { style: "currency", currency: "EUR" })

// The shop, opened from the holos pill: three holo bundles, then Pro, billed
// monthly. Styled in game.css. Only with premium on (flags.ts): wallet:shop is
// null otherwise, and nothing opens it.
// A buy goes to Stripe Checkout (billing:checkout) and comes back to
// /play?checkout=done; the holos or Pro arrive by Stripe's webhook, and the
// holos pill and the Pro card show them as they land.
export function HoloShop({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: shop } = useQuery(convexQuery(api.wallet.shop, {}))
  const wallet = useWallet()
  const posthog = usePostHog()
  const checkout = useAction(api.billing.checkout)
  const [busy, setBusy] = useState(false)
  // Stripe's page is opening: the offers stay off until it's there.
  const [leaving, setLeaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const once = useOnceAtATime()
  const base = shop?.holoBundles[0]
  // Holos per cent at the smallest bundle: each bundle's bonus is over it.
  const rate = base ? base.holos / base.priceCents : 0
  const best = shop?.holoBundles.at(-1)?.id
  if (shop === null) return null

  // Off to Stripe's checkout page; busy until it opens, so only a refusal says anything.
  const buy = (offer: string, onStarted: () => void) =>
    once(async () => {
      setBusy(true)
      setNote(null)
      try {
        const url = await checkout({ offer })
        onStarted()
        setLeaving(true)
        window.location.assign(url)
      } catch (caught) {
        setNote(errorText(caught))
      } finally {
        setBusy(false)
      }
    })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setNote(null)
        onOpenChange(next)
      }}
    >
      <DialogContent
        variant="game"
        data-shop
        // The offers are buttons: a tap shouldn't light up the first one.
        initialFocus={(openType) => openType === "keyboard"}
      >
        <div className="gap-5 grid">
          <div className="gap-3 flex items-start">
            <DialogHeader className="min-w-0 flex-1">
              <DialogTitle>Holo shop</DialogTitle>
              <DialogDescription>
                Rip more packs, outbid rivals and chase every legendary.
              </DialogDescription>
            </DialogHeader>
            <DialogClose
              render={<Button variant="game" size="icon-game" />}
              className="shrink-0"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          {note ? (
            <output className="text-sm font-bold text-center">{note}</output>
          ) : null}

          <ul className="gap-2 pt-2 grid grid-cols-3" aria-label="Holo bundles">
            {shop?.holoBundles.map((bundle, index) => {
              const bonus = Math.round(
                (bundle.holos / (bundle.priceCents * rate) - 1) * 100
              )
              return (
                <li
                  key={bundle.id}
                  data-slot="holo-bundle"
                  data-best={bundle.id === best || undefined}
                >
                  {bundle.id === best ? (
                    <span data-slot="holo-bundle-tag">Best</span>
                  ) : null}
                  <span data-slot="holo-bundle-coins">
                    {Array.from({ length: index + 1 }, (_, coin) => (
                      <HoloCoin key={coin} />
                    ))}
                  </span>
                  <span className="text-xl font-black font-heading leading-none">
                    {bundle.holos.toLocaleString("en")}
                  </span>
                  <span data-slot="holo-bundle-bonus">
                    {bonus > 0 ? `+${bonus}% bonus` : "holos"}
                  </span>
                  <Button
                    variant="game"
                    className="w-full"
                    disabled={busy || leaving}
                    aria-label={`Buy ${holos(bundle.holos)} for ${euros(bundle.priceCents)}`}
                    onClick={() =>
                      void buy(bundle.id, () =>
                        posthog.capture("holo_checkout_started", {
                          holo_amount: bundle.holos,
                          price_cents: bundle.priceCents,
                        })
                      )
                    }
                  >
                    {euros(bundle.priceCents)}
                  </Button>
                </li>
              )
            })}
          </ul>

          {shop ? (
            <section data-slot="holo-pro" aria-labelledby="holo-pro-title">
              <div className="gap-3 flex items-center">
                <span data-slot="holo-pro-crown">
                  <CrownIcon aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3
                    id="holo-pro-title"
                    className="text-xl font-black leading-tight font-heading"
                  >
                    Holotrack Pro
                  </h3>
                  <p className="text-sm font-bold opacity-90">
                    {wallet?.pro
                      ? "You're Pro"
                      : `${euros(shop.pro.priceCents)}/month, cancel anytime`}
                  </p>
                </div>
              </div>
              <ul className="mt-4 gap-2 grid">
                {shop.pro.perks.map((perk) => (
                  <li
                    key={perk.id}
                    className="gap-2 text-sm font-bold flex items-center"
                  >
                    <span data-slot="holo-pro-check">
                      <CheckIcon aria-hidden="true" />
                    </span>
                    {perk.label}
                  </li>
                ))}
              </ul>
              {wallet?.pro ? null : (
                <Button
                  variant="game"
                  className="mt-5 w-full"
                  disabled={busy || leaving}
                  onClick={() =>
                    void buy("pro", () =>
                      posthog.capture("pro_checkout_started")
                    )
                  }
                >
                  <CrownIcon aria-hidden="true" />
                  Go Pro
                </Button>
              )}
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

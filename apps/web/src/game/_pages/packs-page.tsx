import { FreePacks } from "@/game/_components/free-packs"
import { PageHeader } from "@/game/_components/page-header"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import { PackOpening } from "@workspace/ui/components/pack-opening"
import { Slider } from "@workspace/ui/components/slider"
import { useMutation } from "convex/react"
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
      <BuyPack open={buying && locked} onOpenChange={setBuying} />
      <header className="inset-x-0 top-0 max-w-6xl px-4 sm:px-6 md:px-8 md:pt-8 in-data-immersive:-translate-y-4 pointer-events-none absolute z-30 mx-auto game-safe-top transition duration-300 in-data-immersive:opacity-0">
        <PageHeader title="Packs" />
        {/* Centred over the waiting pack, out of the header's way. */}
        <div className="mt-5 flex justify-center">
          <FreePacks />
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

// Tapping the grayed pack once every pack is opened: buy some, as many as the holos pay for.
// They're kept until opened, on top of the free ones (wallet:buyPacks).
function BuyPack({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const wallet = useWallet()
  const buyPacks = useMutation(api.wallet.buyPacks)
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const most = wallet
    ? Math.min(
        wallet.maxPacksBought,
        Math.floor(wallet.coins / wallet.packPrice)
      )
    : 0
  const chosen = Math.max(1, Math.min(count, most))
  const cost = wallet ? chosen * wallet.packPrice : 0

  async function buy() {
    setBusy(true)
    setError(null)
    try {
      await buyPacks({ count: chosen })
      setCount(1)
      onOpenChange(false)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

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
          <DialogHeader>
            <DialogTitle>{chosen > 1 ? "Buy packs" : "Buy a pack"}</DialogTitle>
          </DialogHeader>
          {most > 1 ? (
            <div className="gap-3 grid">
              <div className="text-sm font-bold flex justify-between">
                <span id="buy-count-label">Packs</span>
                <span>
                  {chosen} of {most}
                </span>
              </div>
              <Slider
                variant="game"
                aria-labelledby="buy-count-label"
                min={1}
                max={most}
                step={1}
                value={chosen}
                onValueChange={(value) =>
                  setCount(typeof value === "number" ? value : (value[0] ?? 1))
                }
              />
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
              disabled={!wallet || busy || most === 0}
              aria-label={`Buy ${chosen === 1 ? "a pack" : `${chosen} packs`} for ${holos(cost)}`}
              onClick={() => void buy()}
            >
              <HoloCoin />
              {cost.toLocaleString("en")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

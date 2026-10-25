import { toGameCard } from "@/game/_lib/cards"
import { api } from "@workspace/backend/api"
import { Celebration } from "@workspace/ui/components/celebration"
import { GameMotes } from "@workspace/ui/components/game-motes"
import { GameStage } from "@workspace/ui/components/game-stage"
import { RarityBadge } from "@workspace/ui/components/rarity-badge"
import {
  UpgradingCard,
  type UpgradingCardHandle,
} from "@workspace/ui/components/song-card"
import { play } from "@workspace/ui/lib/game/sfx"
import { RARITY_ORDER, type Rarity } from "@workspace/ui/lib/game/theme"
import { useConvex, useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ArrowRightIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

type UpgradeRow = FunctionReturnType<typeof api.packs.upgrades>[number]
type Upgrade = ReturnType<typeof toGameCard<UpgradeRow>>

// Every rarity from `from` up to `to`, so a card climbs one at a time.
const climb = (from: Rarity, to: Rarity) =>
  RARITY_ORDER.slice(RARITY_ORDER.indexOf(from), RARITY_ORDER.indexOf(to) + 1)

// Cards whose rarity went up since the player last saw them, after a catalog
// refresh: shown on their own screen as the app opens, one after the other,
// each climbing a rarity per tap. A card is marked seen once it reaches its
// new rarity, so leaving midway shows the rest next time.
export function CardUpgrades() {
  const convex = useConvex()
  // Taken once, as the app opens: an upgrade found mid-session waits for the
  // next visit, so it never cuts into a pack being opened. Read once rather
  // than watched, as it would re-run on every pack opened.
  const [queue, setQueue] = useState<ReadonlyArray<Upgrade> | null>(null)
  useEffect(() => {
    let cancelled = false
    async function take() {
      const rows = await convex.query(api.packs.upgrades, {})
      if (!cancelled) setQueue(rows.map(toGameCard))
    }
    take().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [convex])
  if (!queue?.length) return null
  return <UpgradeQueue queue={queue} onDone={() => setQueue([])} />
}

function UpgradeQueue({
  queue,
  onDone,
}: {
  queue: ReadonlyArray<Upgrade>
  onDone: () => void
}) {
  const seeUpgrade = useMutation(api.packs.seeUpgrade)
  const [index, setIndex] = useState(0)
  const card = queue[index]
  if (!card) return null

  function next() {
    if (index + 1 < queue.length) setIndex(index + 1)
    else onDone()
  }

  return (
    <UpgradeShow
      key={card.id}
      card={card}
      onSeen={() => void seeUpgrade({ cardId: card.id })}
      onNext={next}
    />
  )
}

function UpgradeShow({
  card,
  onSeen,
  onNext,
}: {
  card: Upgrade
  onSeen: () => void
  onNext: () => void
}) {
  const cardRef = useRef<UpgradingCardHandle>(null)
  const [rarities] = useState(() => climb(card.from, card.rarity))
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [turning, setTurning] = useState(false)
  const rarity = rarities[step] ?? card.rarity
  const top = step === rarities.length - 1

  async function climbOnce() {
    if (!ready || turning) return
    if (top) {
      play("swipe")
      onNext()
      return
    }
    const to = rarities[step + 1] ?? card.rarity
    setTurning(true)
    play("spin")
    await cardRef.current?.step()
    // Rings out as the card faces front in its new rarity.
    play(to)
    setStep(step + 1)
    setTurning(false)
    if (step + 1 === rarities.length - 1) onSeen()
  }

  return (
    <dialog
      open
      aria-label={`${card.title} upgraded`}
      className="inset-0 p-0 m-0 fixed z-50 size-full max-h-none max-w-none game-backdrop text-ink"
    >
      <div className="inset-0 md:p-8 pointer-events-none absolute">
        <GameStage
          shape="screen"
          className="md:max-w-md md:max-h-216 md:aspect-393/852 md:w-auto mx-auto size-full"
        >
          <GameMotes />
          {step > 0 &&
          !turning &&
          (rarity === "epic" || rarity === "legendary") ? (
            <Celebration key={rarity} rarity={rarity} />
          ) : null}
        </GameStage>
      </div>
      <UpgradingCard
        ref={cardRef}
        song={card}
        rarities={rarities}
        onReady={() => setReady(true)}
      />
      {/* The whole screen climbs the card: tap for its next rarity. */}
      <button
        type="button"
        aria-label={top ? "Next" : `Upgrade to ${rarities[step + 1]}`}
        className="inset-0 absolute cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => void climbOnce()}
      />
      {/* Set just clear of the card, wherever its scene puts it. */}
      <header className="inset-x-0 top-0 px-5 pb-8 pointer-events-none absolute flex game-upgrade-head flex-col items-center justify-end-safe game-safe-top text-center">
        <h2
          data-big={(top && step > 0) || undefined}
          className="font-black tracking-tighter font-heading game-upgrade-title text-nowrap"
        >
          {top && step > 0 ? "Rarity up!" : "Something's happening…"}
        </h2>
        <div className="mt-3 gap-2 flex items-center" aria-live="polite">
          {rarities.slice(0, step + 1).map((reached, at) => (
            <span key={reached} className="gap-2 flex items-center">
              {at > 0 ? (
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              ) : null}
              <RarityBadge rarity={reached} />
            </span>
          ))}
        </div>
      </header>
      <footer className="inset-x-0 bottom-0 pt-8 pointer-events-none absolute game-upgrade-foot flex flex-col items-center">
        <p
          data-shown={(ready && !turning) || undefined}
          className="text-sm font-semibold text-ink/70 opacity-0 transition-opacity duration-300 data-shown:opacity-100"
        >
          {top ? "Tap to continue" : "Tap to upgrade"}
        </p>
      </footer>
    </dialog>
  )
}

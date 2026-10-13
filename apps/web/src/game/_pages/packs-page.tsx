import { useRevealMusic } from "@/game/_hooks/use-reveal-music"
import { toGameCard, type GameCard } from "@/game/_lib/cards"
import { useCollection } from "@/game/_lib/collection"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { PackOpening } from "@workspace/ui/components/pack-opening"
import { useMutation } from "convex/react"
import { useEffect, useState } from "react"

// The pack flies in only the first time the page loads; coming back to the
// tab later, it's already waiting. Module state, so a full reload replays it.
let arrived = false

type Pull = GameCard & { isNew: boolean }

const RARITY_ORDER = ["common", "rare", "epic", "legendary"]
// Rarest last, so the reveal builds up like a real pack; within a rarity, most streamed last.
const revealOrder = (a: GameCard, b: GameCard) =>
  RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) ||
  a.streams - b.streams

export function PacksPage() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const music = useRevealMusic()
  const collection = useCollection()
  const openPack = useMutation(api.packs.open)
  const { data: catalog } = useQuery(convexQuery(api.packs.catalog, {}))
  // The next pack, drawn while it waits so the cards are ready once it's cut open.
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
      const cards = await openPack()
      if (cancelled) return
      const sorted = cards.map(toGameCard).toSorted(revealOrder)
      setPulls(
        sorted.map((card) => ({ ...card, isNew: !collection.owned[card.id] }))
      )
    }
    void draw()
    return () => {
      cancelled = true
    }
    // Drawn once per visit: the collection changes when this pack is added.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [openPack])

  if (!pulls || !catalog) return <div className="min-h-0 flex-1" />

  return (
    <div
      data-immersive={open || undefined}
      className="min-h-0 relative flex flex-1 justify-center"
    >
      <PackOpening
        pulls={pulls}
        covers={catalog.covers}
        entrance={entrance}
        onOpenChange={(next) => {
          // The tap that opens the pack lets the previews play later.
          if (!next) return
          music.unlock()
          // Owned from the moment it's opened, so leaving mid-reveal keeps the cards.
          collection.add(pulls.map((pull) => pull.id))
          setOpen(next)
        }}
        onCard={(pull, revealed) => {
          const songId = pulls.find(
            (card) => card.id === pull?.id
          )?.previewSongId
          if (songId) void music.play(songId, revealed)
          else music.stop()
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
      <header className="inset-x-0 top-0 max-w-6xl px-4 sm:px-6 md:px-8 md:pt-8 in-data-immersive:-translate-y-4 pointer-events-none absolute z-30 mx-auto game-safe-top transition duration-300 in-data-immersive:opacity-0">
        <h1 className="text-4xl font-black md:text-6xl tracking-tighter font-heading">
          Packs
        </h1>
      </header>
    </div>
  )
}

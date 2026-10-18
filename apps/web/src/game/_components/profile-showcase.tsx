import { MoreCards } from "@/game/_components/collection-grid"
import { toGameCard } from "@/game/_lib/cards"
import { useCollection } from "@/game/_lib/collection"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { SongCardThumb } from "@workspace/ui/components/song-card"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { PlusIcon } from "lucide-react"
import { useState } from "react"

// Cards a player shows on their profile, picked from their collection.
const SIZE = 6

type ShowcaseCard = FunctionReturnType<typeof api.profile.showcase>[number]

// Saves the showcase as `cardIds`, showing it straight away, before the
// server confirms it: the cards kept, and `added` (a card from the picker).
function useSaveShowcase() {
  const save = useMutation(api.profile.setShowcase)
  return (cardIds: Array<string>, added?: ShowcaseCard) =>
    save.withOptimisticUpdate((store) => {
      const current = store.getQuery(api.profile.showcase, {})
      if (!current) return
      const byId = new Map<string, ShowcaseCard>(
        current.map((card) => [card.id, card])
      )
      if (added) byId.set(added.id, added)
      store.setQuery(
        api.profile.showcase,
        {},
        cardIds.flatMap((id) => byId.get(id) ?? [])
      )
    })({ cardIds })
}

// The player's showcase under their name: six slots, filled in their order.
// An empty slot picks a card to add at the end; tapping a card takes it out,
// so reordering is taking cards out and adding them back.
export function ProfileShowcase() {
  const { data } = useQuery(convexQuery(api.profile.showcase, {}))
  const shown = (data ?? []).map(toGameCard)
  const [picking, setPicking] = useState(false)
  const slots = Array.from({ length: SIZE }, (_, at) => shown[at] ?? null)
  const save = useSaveShowcase()
  const ids: Array<string> = shown.map((card) => card.id)
  // Shows the change straight away; a failed save puts the cards back.
  const update = (cardIds: Array<string>, added?: ShowcaseCard) =>
    void save(cardIds, added).catch(() => undefined)

  return (
    <section aria-labelledby="showcase-title" className="mt-6 gap-4 grid">
      <h2
        id="showcase-title"
        className="text-2xl font-black tracking-tighter font-heading"
      >
        Showcase
      </h2>
      <ul className="gap-3 sm:gap-4 md:grid-cols-6 grid grid-cols-2">
        {slots.map((card, at) =>
          card ? (
            <li key={card.id}>
              <button
                type="button"
                aria-label={`Remove ${card.title} from your showcase`}
                className="group/card @container block w-full rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring"
                onClick={() => update(ids.filter((kept) => kept !== card.id))}
              >
                <SongCardThumb song={card} copies={card.copies} eager />
              </button>
            </li>
          ) : (
            // Empty slots: a dashed card outline, picking a card into it.
            <li key={`empty-${String(at)}`}>
              <button
                type="button"
                aria-label="Add a card to your showcase"
                className="grid aspect-5/7 w-full place-items-center rounded-2xl border-2 border-dashed border-ink/30 text-ink/40 transition-colors outline-none hover:border-ink/60 hover:text-ink/70 focus-visible:ring-4 focus-visible:ring-ring"
                onClick={() => setPicking(true)}
              >
                <PlusIcon aria-hidden="true" className="size-6" />
              </button>
            </li>
          )
        )}
      </ul>
      {picking ? (
        <ShowcasePicker
          shown={new Set(ids)}
          onPick={(card) => {
            setPicking(false)
            update([...ids, card.id], card)
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </section>
  )
}

// The player's cards to pick one from, searchable; those already shown are
// grayed out. It opens once its first cards are in, so it never shows empty.
// The cards scroll on under the footer, which fades them out; more load as
// the end comes near, like the collection's.
function ShowcasePicker({
  shown,
  onPick,
  onClose,
}: {
  shown: ReadonlySet<string>
  onPick: (card: ShowcaseCard) => void
  onClose: () => void
}) {
  const [text, setText] = useState("")
  const { cards, more, done } = useCollection({ sort: "rarest" }, text)

  return (
    <Dialog
      open={cards !== null}
      onOpenChange={(open) => (open ? null : onClose())}
    >
      <DialogContent
        variant="game"
        compact
        className="sm:max-w-2xl flex max-h-11/12 flex-col"
      >
        <DialogHeader>
          <DialogTitle>Add to your showcase</DialogTitle>
        </DialogHeader>
        <Input
          variant="game"
          type="search"
          placeholder="Songs, artists…"
          aria-label="Search your cards"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div
          data-slot="game-scroll"
          // Runs on under the footer's fade (its top 3rem, plus the gap),
          // which ends at the close button's top: the cards fade out down to it.
          className="min-h-0 -mx-2 px-2 pt-2 pb-15 -mb-15 flex-1 overflow-y-auto game-scroll-fade"
        >
          {cards?.length === 0 ? (
            <p className="py-8 text-center text-ink/60">
              {text ? "No card matches." : "No cards yet: open a pack!"}
            </p>
          ) : null}
          <ul className="gap-3 sm:grid-cols-3 grid grid-cols-2">
            {cards?.map((card) => {
              const already = shown.has(card.id)
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    aria-label={`${card.title}, ${card.rarity}${already ? ", already shown" : ""}`}
                    disabled={already}
                    className="group/card @container block w-full rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed"
                    onClick={() => onPick(card)}
                  >
                    <SongCardThumb
                      song={card}
                      copies={card.copies}
                      muted={already}
                    />
                  </button>
                </li>
              )
            })}
            {/* Remounted as each page comes in, so it looks again. */}
            {done ? null : (
              <MoreCards key={more ? "ready" : "loading"} onNear={more} />
            )}
          </ul>
        </div>
        <div className="-mx-4 px-4 pt-12 -mb-4 pb-3 relative z-1 rounded-b-4xl game-dialog-fade">
          <DialogFooter variant="game" className="justify-center" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

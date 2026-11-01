import { MoreCards } from "@/game/_components/collection-grid"
import { useCollection } from "@/game/_lib/collection"
import { errorText } from "@/game/_lib/wallet"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogGameClose,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { useMutation } from "convex/react"
import { CheckIcon } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useState } from "react"

// Picks the cover or artist photo of an owned card as the player's profile picture.
export function AvatarPicker({
  current,
  open,
  onOpenChange,
}: {
  current: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setAvatar = useMutation(api.profile.setAvatar)
  const posthog = usePostHog()
  const { cards, more, done } = useCollection({ sort: "rarest" }, text)

  async function choose(cardId: string | null) {
    setBusy(true)
    setError(null)
    try {
      await setAvatar({ cardId })
      posthog.capture(
        cardId ? "profile_picture_selected" : "profile_picture_cleared"
      )
      onOpenChange(false)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="game"
        compact
        className="sm:max-w-2xl flex max-h-11/12 flex-col"
      >
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>Choose your picture</DialogTitle>
          <DialogGameClose />
        </DialogHeader>
        <Input
          variant="game"
          type="search"
          placeholder="Songs, artists…"
          aria-label="Search your cards"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}
        <div
          data-slot="game-scroll"
          className="min-h-0 -mx-2 px-2 pt-2 pb-6 flex-1 overflow-y-auto game-scroll-fade-both"
        >
          {cards?.length === 0 ? (
            <p className="py-8 text-center text-ink/60">
              {text ? "No card matches." : "No cards yet: open a pack!"}
            </p>
          ) : null}
          <ul className="gap-3 sm:grid-cols-4 grid grid-cols-3">
            {cards?.map((card) => {
              const selected = card.id === current
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Use ${card.title} as your profile picture`}
                    aria-pressed={selected}
                    className="group relative block aspect-square w-full overflow-hidden rounded-full border-4 border-ink outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-60"
                    onClick={() => void choose(card.id)}
                  >
                    <img
                      src={card.imageUrl}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                    {selected ? (
                      <span className="inset-0 text-white absolute grid place-items-center bg-ink/45">
                        <CheckIcon aria-hidden="true" className="size-8" />
                      </span>
                    ) : null}
                  </button>
                  <p className="mt-1 text-xs font-bold truncate text-center">
                    {card.title}
                  </p>
                </li>
              )
            })}
            {done ? null : (
              <MoreCards key={more ? "ready" : "loading"} onNear={more} />
            )}
          </ul>
        </div>
        {current ? (
          <Button
            variant="game"
            disabled={busy}
            onClick={() => void choose(null)}
          >
            Use my initial
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

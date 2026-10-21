import { CardDetail, type Showcase } from "@/game/_components/card-showcase"
import type { CollectedSong } from "@/game/_lib/collection"
import { songCardThumbSlot } from "@workspace/ui/components/song-card"
import type { CardSlot } from "@workspace/ui/lib/game/card-scene"
import type { Dispatch, RefObject, SetStateAction } from "react"

// A card out on show, and the related card's button it was opened from (null
// for one picked from the grid); `key` tells apart the same card opened twice.
export type Opened = {
  showcase: Showcase
  opener: HTMLButtonElement | null
  key: number
}
let opened = 0
const open = (
  song: CollectedSong,
  from: CardSlot | undefined,
  opener: HTMLButtonElement | null
): Opened => ({
  showcase: { song, from, phase: "lifting" },
  opener,
  key: (opened += 1),
})

// The showcase moved on to `phase`.
const toPhase = (phase: Showcase["phase"]) => (current: Showcase) => ({
  ...current,
  phase,
})
// Applies `change` to the card at `depth` in the stack, if it's still open.
const atDepth =
  (depth: number, change: (showcase: Showcase) => Showcase) =>
  (stack: ReadonlyArray<Opened>) =>
    stack.map((card, at) =>
      at === depth ? { ...card, showcase: change(card.showcase) } : card
    )

type SetStack = Dispatch<SetStateAction<ReadonlyArray<Opened>>>

// Cards out on show, each over the last: one opened from the related cards of
// the one under it steps that one aside until it heads home to its thumb.
// `fallback`: where one without an opener (picked from the grid) flies home to.
export function ShowcaseStack({
  stack,
  onStack,
  fallback,
}: {
  stack: ReadonlyArray<Opened>
  onStack: SetStack
  fallback?: RefObject<HTMLButtonElement | null>
}) {
  return stack.map(({ showcase, opener, key }, depth) => (
    <CardDetail
      key={key}
      showcase={showcase}
      home={() => songCardThumbSlot(opener ?? fallback?.current ?? null)}
      onShown={() => onStack(atDepth(depth, toPhase("shown")))}
      onReturn={() => onStack(atDepth(depth, toPhase("returning")))}
      onClose={() => onStack((above) => above.slice(0, depth))}
      // Under another card it steps aside, as the page does for it, and comes
      // back as that card heads home to it.
      covered={isCovering(stack[depth + 1])}
      onRelated={(song, from, button) =>
        onStack((above) => [
          ...above.slice(0, depth + 1),
          open(song, from, button),
        ])
      }
    />
  ))
}

// Whether `above`, the card opened over another, hides it: until it heads home.
export function isCovering(above: Opened | undefined) {
  return above !== undefined && above.showcase.phase !== "returning"
}

// A new stack: `song` picked from a grid (no opener) or from a related row.
export function startStack(
  song: CollectedSong,
  from: CardSlot | undefined,
  opener: HTMLButtonElement | null = null
): ReadonlyArray<Opened> {
  return [open(song, from, opener)]
}

import type { Showcase } from "@/game/_components/card-showcase"
import type { CollectedSong } from "@/game/_lib/collection"
import {
  SongCardThumb,
  songCardThumbSlot,
} from "@workspace/ui/components/song-card"
import type { CssVars } from "@workspace/ui/lib/game/theme"
import { memo, useEffect, useEffectEvent, useRef, type RefObject } from "react"

// One card in the grid. Memoized: a page coming in renders only its own cards.
export const CollectionCard = memo(function CollectionCard({
  song,
  isNew,
  landed,
  away,
  eager,
  openerRef,
  onShowcase,
}: {
  song: CollectedSong
  isNew: boolean
  landed: boolean
  away: boolean
  eager: boolean
  openerRef: RefObject<HTMLButtonElement | null>
  onShowcase: (showcase: Showcase) => void
}) {
  const slideStyle: CssVars = { "--game-card": `card-${song.id}` }
  return (
    <li
      hidden={!landed}
      className={isNew ? "game-drop game-slides" : "game-slides"}
      style={slideStyle}
    >
      <button
        type="button"
        className="group/card @container relative block w-full rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring"
        aria-label={`${song.kind === "artist" ? `${song.title}, artist` : `${song.title} by ${song.artist}`}, ${song.rarity}${isNew ? ", new" : ""}`}
        onClick={(event) => {
          openerRef.current = event.currentTarget
          onShowcase({
            song,
            from: songCardThumbSlot(event.currentTarget) ?? undefined,
            phase: "lifting",
          })
        }}
      >
        <SongCardThumb
          song={song}
          copies={song.copies}
          away={away}
          eager={eager}
        />
        {isNew ? (
          <span
            className="group-hover/card:-translate-y-1 game-new-badge transition-transform"
            aria-hidden="true"
          >
            NEW
          </span>
        ) : null}
      </button>
    </li>
  )
})

// An invisible card-sized cell at the grid's end; within a screen of the view
// it asks for the next page. Nothing shows while it loads: cards just appear.
export function MoreCards({ onNear }: { onNear: (() => void) | null }) {
  const ref = useRef<HTMLLIElement>(null)
  const near = useEffectEvent(() => onNear?.())

  useEffect(() => {
    const item = ref.current
    if (!item) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) near()
      },
      {
        root: item.closest("[data-slot=game-scroll]"),
        rootMargin: "100% 0px",
      }
    )
    observer.observe(item)
    return () => observer.disconnect()
  }, [])

  return <li ref={ref} aria-hidden="true" className="aspect-5/7" />
}

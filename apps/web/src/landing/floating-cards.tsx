import { ClientOnly } from "@tanstack/react-router"
import type { GameSong } from "@workspace/ui/lib/game/theme"
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react"

// The game's own card thumbs (three.js), loaded once the page has painted.
const SongCardThumb = lazy(() =>
  import("@workspace/ui/components/song-card").then((module) => ({
    default: module.SongCardThumb,
  }))
)

export type Floater = {
  card: GameSong
  // Its spot, width and tilt, per screen size.
  place: string
  // How fast it rises as the page scrolls, past the section's own pace.
  depth: number
}

// One of the game's card thumbs, drawn in the browser only.
export function CardThumb(props: ComponentProps<typeof SongCardThumb>) {
  return (
    <ClientOnly>
      <Suspense fallback={null}>
        <SongCardThumb {...props} />
      </Suspense>
    </ClientOnly>
  )
}

// Real cards floating behind a section, each at its own depth and tilt: the
// parallax layers, the nearer ones rising faster as the page scrolls.
// `children` go over the cards, e.g. a light behind the section's words.
export function FloatingCards({
  floaters,
  children,
}: {
  floaters: ReadonlyArray<Floater>
  children?: ReactNode
}) {
  const layersRef = useRef<HTMLDivElement>(null)
  useParallax(layersRef)
  return (
    <div ref={layersRef} aria-hidden="true" className="inset-0 absolute -z-10">
      {floaters.map(({ card, place, depth }) => (
        <div
          key={card.id}
          data-depth={depth}
          className={`absolute will-change-transform ${place}`}
        >
          <CardThumb song={card} />
        </div>
      ))}
      {children}
    </div>
  )
}

// Moves each `data-depth` child up as its section scrolls past the middle of
// the screen, deeper ones faster; at rest when the section is centred (for
// the hero, at the top of the page).
function useParallax(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const layers = ref.current
    const scroller = layers?.closest("[data-slot=landing-scroll]")
    if (!layers || !scroller) return undefined
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined
    const items = [...layers.querySelectorAll<HTMLElement>("[data-depth]")]
    // The scroll at which the section is centred on the screen, or 0 when it
    // starts within the first screen.
    const restAt = () => {
      const top =
        layers.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop
      return Math.max(
        top - (scroller.clientHeight - layers.clientHeight) / 2,
        0
      )
    }
    let rest = restAt()
    let frame = 0
    const update = () => {
      frame = 0
      const y = scroller.scrollTop - rest
      for (const item of items) {
        const depth = Number(item.dataset.depth)
        item.style.translate = `0 ${-y * depth}px`
      }
    }
    const schedule = () => {
      frame ||= requestAnimationFrame(update)
    }
    const resize = () => {
      rest = restAt()
      schedule()
    }
    update()
    scroller.addEventListener("scroll", schedule, { passive: true })
    addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener("scroll", schedule)
      removeEventListener("resize", resize)
    }
  }, [ref])
}

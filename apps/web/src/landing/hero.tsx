import { PlayButton } from "@/landing/play-button"
import { SHOWCASE } from "@/landing/showcase-pack"
import { ChevronsDownIcon, SparklesIcon } from "lucide-react"
import { useEffect, useRef } from "react"

// Covers drifting at their own depths behind the title: the parallax layers.
// Positions and depths are fixed so the server and client draw the same.
const FLOATERS = SHOWCASE.map((card, index) => ({
  card,
  place: [
    "-left-8 top-[6%] sm:left-[4%] sm:top-[18%] -rotate-12",
    "-right-6 top-[3%] sm:right-[6%] sm:top-[12%] rotate-6",
    "-left-10 bottom-[4%] sm:left-[10%] sm:bottom-[10%] rotate-3",
    "-right-8 bottom-[8%] sm:right-[12%] sm:bottom-[16%] -rotate-6",
    "hidden lg:block left-[44%] top-[4%] rotate-12",
  ][index],
  depth: [0.35, 0.6, 0.25, 0.5, 0.15][index] ?? 0.3,
}))

export function Hero() {
  const layersRef = useRef<HTMLDivElement>(null)
  useParallax(layersRef)

  return (
    <section className="-mt-24 pt-24 relative isolate flex min-h-dvh items-center overflow-hidden">
      <div
        ref={layersRef}
        aria-hidden="true"
        className="inset-0 absolute -z-10"
      >
        {FLOATERS.map(({ card, place, depth }) => (
          <div
            key={card.id}
            data-depth={depth}
            data-rarity={card.rarity}
            className={`w-24 p-1.5 sm:w-40 lg:w-44 shadow-2xl sm:opacity-90 absolute rounded-2xl border-4 border-ink opacity-60 will-change-transform game-fill ${place}`}
          >
            <img
              src={card.imageUrl}
              alt=""
              width={160}
              height={160}
              decoding="async"
              className="aspect-square w-full rounded-lg object-cover"
            />
          </div>
        ))}
      </div>
      <div className="max-w-3xl px-4 py-20 sm:px-6 mx-auto text-center">
        <p className="gap-2 px-3 py-1.5 text-xs font-bold tracking-wide inline-flex items-center rounded-full border-2 border-ink bg-card uppercase">
          <SparklesIcon aria-hidden="true" className="size-4" />
          Free music trading card game
        </p>
        <h1 className="mt-6 text-5xl font-black sm:text-7xl lg:text-8xl tracking-tighter font-heading text-balance">
          Rip packs. Pull{" "}
          <span className="px-2 inline-block -rotate-2 rounded-2xl text-brand-foreground game-brand-fill">
            hits.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg sm:text-xl font-medium mx-auto text-pretty text-ink/75">
          Collect the world&apos;s biggest songs and artists as holo cards. Hear
          every pull, chase legendaries, trade in live auctions.
        </p>
        <div className="mt-8 gap-4 flex flex-wrap items-center justify-center">
          <PlayButton>Open your first pack</PlayButton>
        </div>
        <p className="mt-12 gap-2 text-sm font-bold animate-bounce inline-flex items-center text-ink/60">
          <ChevronsDownIcon aria-hidden="true" className="size-5" />
          Scroll to open a pack
        </p>
      </div>
    </section>
  )
}

// Moves each `data-depth` child up as the page scrolls, deeper ones slower.
function useParallax(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const layers = ref.current
    const scroller = layers?.closest("[data-slot=landing-scroll]")
    if (!layers || !scroller) return undefined
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined
    const items = [...layers.querySelectorAll<HTMLElement>("[data-depth]")]
    let frame = 0
    const update = () => {
      frame = 0
      const y = scroller.scrollTop
      for (const item of items) {
        const depth = Number(item.dataset.depth)
        item.style.translate = `0 ${-y * depth}px`
      }
    }
    const schedule = () => {
      frame ||= requestAnimationFrame(update)
    }
    scroller.addEventListener("scroll", schedule, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener("scroll", schedule)
    }
  }, [ref])
}

import { PlayButton } from "@/landing/play-button"
import { HERO_CARDS } from "@/landing/showcase-pack"
import { ClientOnly } from "@tanstack/react-router"
import type { GameSong, Rarity } from "@workspace/ui/lib/game/theme"
import { ChevronsDownIcon } from "lucide-react"
import { lazy, Suspense, useEffect, useRef } from "react"

// The game's own card thumbs (three.js), loaded once the page has painted.
const SongCardThumb = lazy(() =>
  import("@workspace/ui/components/song-card").then((module) => ({
    default: module.SongCardThumb,
  }))
)

// Real cards framing the title from behind, each at its own depth and tilt:
// the parallax layers, the nearer ones rising faster as the page scrolls. The
// rarest hold the clear corners, whole on a phone; the last three sit right
// behind the words (on desktop, Bad Bunny's song and YOASOBI's swap places). A
// phone shows five, bigger: the corners and Ella Baila Sola. Fixed so server
// and client agree.
const FLOATERS = HERO_CARDS.map((card, index) => ({
  card,
  place: [
    "left-5 top-24 w-34 sm:left-[2%] sm:w-40 lg:left-[8%] lg:top-[16%] lg:w-52 -rotate-12",
    "right-5 top-24 w-34 sm:right-[3%] sm:w-40 lg:right-[9%] lg:top-[17%] lg:w-48 rotate-[9deg]",
    "left-5 top-[calc(100dvh-14.5rem)] w-34 sm:top-auto sm:bottom-[4%] sm:left-[9%] sm:w-40 lg:left-[31%] lg:top-[19%] lg:bottom-auto lg:w-48 rotate-[7deg] lg:-rotate-[14deg]",
    "right-5 top-[calc(100dvh-14.5rem)] w-34 sm:top-auto sm:bottom-[2%] sm:right-[8%] sm:w-40 lg:right-[15%] lg:w-52 -rotate-[10deg]",
    "hidden sm:block sm:left-[25%] sm:top-[30%] sm:w-44 lg:left-[17%] lg:top-auto lg:bottom-[3%] lg:w-48 -rotate-[17deg] lg:rotate-[7deg]",
    "hidden sm:block sm:right-[24%] sm:top-[39%] sm:w-44 lg:right-[30%] lg:top-[45%] lg:w-52 rotate-[15deg]",
    "left-[calc(50%-4.5rem)] top-[40%] w-36 sm:left-[42%] sm:top-[50%] sm:w-36 lg:left-[45%] lg:top-[46%] lg:w-40 -rotate-[5deg]",
  ][index],
  depth: [0.55, 0.2, 0.35, 0.75, 0.42, 0.26, 0.5][index] ?? 0.3,
}))

// What you do with the cards, each in a rarity's foil.
const VERBS: ReadonlyArray<{ text: string; rarity: Rarity; tilt: string }> = [
  { text: "Hear every pull", rarity: "rare", tilt: "-rotate-2" },
  { text: "Chase legendaries", rarity: "legendary", tilt: "rotate-1" },
  { text: "Trade live", rarity: "epic", tilt: "-rotate-1" },
]

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
            className={`absolute will-change-transform ${place}`}
          >
            <Thumb card={card} />
          </div>
        ))}
        {/* A faint light behind the words; the cards still show through. */}
        <div className="inset-0 absolute bg-radial from-paper/55 via-paper/25 via-35% to-transparent to-70%" />
      </div>
      <div className="max-w-3xl px-4 py-24 sm:px-6 mx-auto text-center">
        <p className="gap-2 px-3 py-1.5 text-xs font-bold tracking-wide shadow-lg inline-flex -rotate-2 items-center rounded-full bg-ink text-ink-foreground uppercase">
          <span
            aria-hidden="true"
            className="size-3 rounded-full ring-2 ring-ink-foreground game-rarity-grid"
          />
          Free music trading card game
        </p>
        <h1 className="mt-6 text-5xl font-black sm:text-7xl lg:text-8xl tracking-tighter font-heading leading-none">
          <span className="block game-sticker-text">Rip packs.</span>
          <span className="mt-2 sm:mt-3 block">
            <span className="game-sticker-text">Pull</span>{" "}
            <span className="px-3 shadow-xl relative inline-block -rotate-3 rounded-2xl border-4 border-ink text-ink-foreground game-brand-fill">
              hits.
              <span
                aria-hidden="true"
                data-rarity="legendary"
                className="-top-5 -right-6 size-10 sm:-top-6 sm:-right-8 sm:size-14 game-foil-star absolute rotate-12"
              />
            </span>
          </span>
        </h1>
        <p className="mt-7 max-w-2xl text-base sm:text-xl font-bold mx-auto text-balance text-ink">
          Collect the world&apos;s biggest songs and artists as{" "}
          <mark className="px-1.5 rounded-lg text-ink game-silver-fill">
            holo cards
          </mark>
          .
        </p>
        <ul className="mt-4 gap-2 text-sm font-black sm:text-base flex flex-wrap justify-center font-heading">
          {VERBS.map(({ text, rarity, tilt }) => (
            <li
              key={text}
              data-rarity={rarity}
              className={`px-3 py-1.5 shadow-md rounded-full border-2 border-ink text-ink game-fill ${tilt}`}
            >
              {text}
            </li>
          ))}
        </ul>
        <div className="mt-8 gap-4 flex flex-wrap items-center justify-center">
          <PlayButton>Open your first pack</PlayButton>
        </div>
        <p className="mt-10 gap-2 text-sm font-bold animate-bounce inline-flex items-center text-ink/60">
          <ChevronsDownIcon aria-hidden="true" className="size-5" />
          Scroll to open a pack
        </p>
      </div>
    </section>
  )
}

// One of the game's card thumbs, drawn in the browser only.
function Thumb({ card }: { card: GameSong }) {
  return (
    <ClientOnly>
      <Suspense fallback={null}>
        <SongCardThumb song={card} />
      </Suspense>
    </ClientOnly>
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

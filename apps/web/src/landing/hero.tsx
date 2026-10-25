import { FloatingCards } from "@/landing/floating-cards"
import { HERO_FLOATERS } from "@/landing/hero-cards"
import { PlayButton } from "@/landing/play-button"
import type { Rarity } from "@workspace/ui/lib/game/theme"
import { ChevronsDownIcon } from "lucide-react"

// What you do with the cards, each in a rarity's foil.
const VERBS: ReadonlyArray<{ text: string; rarity: Rarity; tilt: string }> = [
  { text: "Hear every pull", rarity: "rare", tilt: "-rotate-2" },
  { text: "Chase legendaries", rarity: "legendary", tilt: "rotate-1" },
  { text: "Trade live", rarity: "epic", tilt: "-rotate-1" },
]

export function Hero() {
  return (
    <section className="-mt-24 pt-24 relative isolate z-10 flex min-h-dvh items-center overflow-hidden">
      <FloatingCards floaters={HERO_FLOATERS}>
        {/* A faint light behind the words; the cards still show through. */}
        <div className="inset-0 absolute bg-radial from-paper/55 via-paper/25 via-35% to-transparent to-70%" />
      </FloatingCards>
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
          <PlayButton placement="hero">Open your first pack</PlayButton>
        </div>
        {/* On a phone, in the gap between the bottom cards and the pack's top. */}
        <p className="bottom-15 gap-2 text-sm font-bold sm:static sm:mt-10 sm:inline-flex inset-x-0 animate-bounce absolute flex items-center justify-center text-ink/60">
          <ChevronsDownIcon aria-hidden="true" className="size-5" />
          Scroll to open a pack
        </p>
      </div>
    </section>
  )
}

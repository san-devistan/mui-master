import { Features } from "@/landing/features"
import { useSectionInView } from "@/landing/landing-analytics"
import { PlayButton } from "@/landing/play-button"
import { useRef } from "react"

// The page's foot, after the pack opening: what the game lets you do, plainly
// listed, then the way in.
export function Join() {
  const ref = useRef<HTMLElement>(null)
  useSectionInView(ref, "features")

  return (
    <section
      ref={ref}
      aria-labelledby="join-title"
      className="max-w-4xl px-4 pt-4 pb-20 sm:px-6 md:px-8 lg:pb-28 relative mx-auto game-after-pack"
    >
      <h2 id="join-title" className="sr-only">
        Everything you can do in Holotrack
      </h2>
      <Features />
      <div className="mt-6 flex flex-col items-center">
        <PlayButton placement="join">Play free</PlayButton>
      </div>
    </section>
  )
}

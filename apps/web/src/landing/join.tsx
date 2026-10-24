import { Features } from "@/landing/features"
import { PlayButton } from "@/landing/play-button"
import { Link } from "@tanstack/react-router"

// The page's foot, after the pack opening: what the game lets you do, plainly
// listed, then the way in (and back in, for players with an account).
export function Join() {
  return (
    <section
      aria-labelledby="join-title"
      className="max-w-4xl px-4 pt-4 pb-20 sm:px-6 md:px-8 lg:pb-28 relative mx-auto game-after-pack"
    >
      <h2 id="join-title" className="sr-only">
        Everything you can do in Holotrack
      </h2>
      <Features />
      <div className="mt-6 gap-4 flex flex-col items-center">
        <PlayButton>Play free</PlayButton>
        <p className="text-sm text-ink/70">
          Already playing?{" "}
          <Link to="/sign-in" className="font-bold text-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  )
}

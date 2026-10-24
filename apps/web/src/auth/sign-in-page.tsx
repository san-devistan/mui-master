import { SignInForm } from "@/auth/sign-in-form"
import { FloatingCards, type Floater } from "@/landing/floating-cards"
import { HERO_CARDS, JOIN_CARDS } from "@/landing/showcase-pack"
import { Link } from "@tanstack/react-router"

// A few of the landing's cards drifting around the form's corners, half off
// the edge on a phone so the form stays clear.
const PLACES = [
  "-left-10 top-20 w-28 sm:left-[6%] sm:top-[14%] sm:w-40 -rotate-12",
  "-right-10 top-28 w-28 sm:right-[7%] sm:top-[12%] sm:w-36 rotate-[10deg]",
  "-left-8 bottom-6 w-28 sm:left-[10%] sm:bottom-[8%] sm:w-36 rotate-[8deg]",
  "-right-8 bottom-10 w-28 sm:right-[9%] sm:bottom-[6%] sm:w-44 -rotate-[9deg]",
]
const FLOATERS: ReadonlyArray<Floater> = [
  ...JOIN_CARDS,
  ...HERO_CARDS.slice(0, 2),
].map((card, index) => ({
  card,
  place: PLACES[index] ?? "hidden",
  depth: 0,
}))

export function SignInPage() {
  return (
    <div className="inset-0 fixed overflow-x-hidden overflow-y-auto overscroll-contain game-backdrop text-ink">
      <div className="relative isolate flex min-h-dvh flex-col">
        <FloatingCards floaters={FLOATERS} />
        <header className="max-w-6xl px-4 pt-6 sm:px-6 md:px-8 mx-auto w-full game-safe-top">
          <Link
            to="/"
            className="gap-2 text-lg font-black inline-flex items-center font-heading"
          >
            <img
              src="/icon.svg"
              alt=""
              width={36}
              height={36}
              className="size-9"
            />
            Holotrack
          </Link>
        </header>
        <main className="px-4 py-10 flex flex-1 items-center justify-center">
          <SignInForm />
        </main>
      </div>
    </div>
  )
}

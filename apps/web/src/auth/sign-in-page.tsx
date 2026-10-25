import { SignInForm } from "@/auth/sign-in-form"
import { FloatingCards } from "@/landing/floating-cards"
import { HERO_FLOATERS } from "@/landing/hero-cards"
import { Link } from "@tanstack/react-router"

// The form among the hero's cards, set just as on the landing page: one
// screen, which never scrolls.
export function SignInPage() {
  return (
    <div className="inset-0 fixed overflow-hidden overscroll-none game-backdrop text-ink">
      <div className="relative isolate flex h-dvh flex-col">
        <FloatingCards floaters={HERO_FLOATERS} />
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
        <main className="min-h-0 px-4 py-10 flex flex-1 items-center justify-center">
          <SignInForm />
        </main>
      </div>
    </div>
  )
}

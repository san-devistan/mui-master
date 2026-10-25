import { Hero } from "@/landing/hero"
import { Join } from "@/landing/join"
import { PackStory } from "@/landing/pack-story"
import { PlayButton } from "@/landing/play-button"
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export function LandingPage() {
  const navigate = useNavigate()

  // Home Screen apps installed before the game moved to /play still open here.
  useEffect(() => {
    if (matchMedia("(display-mode: standalone)").matches) {
      void navigate({ to: "/play", replace: true })
    }
  }, [navigate])

  return (
    <div
      data-slot="landing-scroll"
      className="inset-0 fixed overflow-x-hidden overflow-y-auto overscroll-contain game-backdrop text-ink"
    >
      <SiteHeader />
      <main>
        <Hero />
        <PackStory />
        <Join />
      </main>
      <footer className="max-w-6xl px-4 pb-10 sm:px-6 md:px-8 gap-2 text-sm sm:flex-row sm:justify-between mx-auto flex flex-col text-ink/60">
        <p>© 2026 Holotrack</p>
        <p>Not affiliated with Spotify or Deezer.</p>
      </footer>
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="max-w-6xl px-4 pt-6 sm:px-6 md:px-8 gap-4 relative z-20 mx-auto flex items-center game-safe-top">
      <Link
        to="/"
        className="gap-2 text-lg font-black flex items-center font-heading"
      >
        <img src="/icon.svg" alt="" width={36} height={36} className="size-9" />
        Holotrack
      </Link>
      <nav
        aria-label="Main"
        className="text-sm font-bold ml-auto flex items-center"
      >
        <PlayButton placement="header">Play free</PlayButton>
      </nav>
    </header>
  )
}

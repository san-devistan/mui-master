import { FAQ } from "@/landing/faq"
import { Hero } from "@/landing/hero"
import { PackStory } from "@/landing/pack-story"
import { PlayButton } from "@/landing/play-button"
import { Link, useNavigate } from "@tanstack/react-router"
import { GavelIcon, LayersIcon, PlusIcon } from "lucide-react"
import { useEffect } from "react"

// After the pack: what you do with the cards.
const AFTER = [
  {
    Icon: LayersIcon,
    title: "Build your collection",
    text: "Collect songs and their artists, then watch cards rise a rarity as the streams roll in.",
  },
  {
    Icon: GavelIcon,
    title: "Trade in live auctions",
    text: "List your duplicates, outbid rivals and land the legendary missing from your set.",
  },
] as const

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
        <AfterThePack />
        <Faq />
        <FinalCall />
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
        className="gap-6 text-sm font-bold ml-auto flex items-center"
      >
        <a href="#faq" className="sm:inline hidden hover:underline">
          FAQ
        </a>
        <PlayButton>Play free</PlayButton>
      </nav>
    </header>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="text-sm font-bold tracking-wide text-ink/60 uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-4xl font-black md:text-5xl tracking-tighter font-heading text-balance">
        {title}
      </h2>
    </>
  )
}

function AfterThePack() {
  return (
    <section className="max-w-6xl px-4 py-20 sm:px-6 md:px-8 mx-auto">
      <SectionTitle eyebrow="After the pack" title="Collect. Trade. Repeat." />
      <ul className="mt-10 gap-4 sm:grid-cols-2 grid">
        {AFTER.map(({ Icon, title, text }) => (
          <li key={title} className="p-6 rounded-3xl bg-card">
            <span className="size-12 grid place-items-center rounded-full border-2 border-ink text-brand-foreground game-brand-fill">
              <Icon aria-hidden="true" className="size-6" />
            </span>
            <h3 className="mt-6 text-xl font-black font-heading">{title}</h3>
            <p className="mt-2 text-pretty text-ink/70">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Faq() {
  return (
    <section
      id="faq"
      className="max-w-3xl px-4 py-20 sm:px-6 md:px-8 scroll-mt-8 mx-auto"
    >
      <SectionTitle eyebrow="FAQ" title="Before you rip your first pack" />
      <div className="mt-10 gap-3 grid">
        {FAQ.map(({ question, answer }) => (
          <details key={question} className="group p-5 rounded-3xl bg-card">
            <summary className="gap-4 text-lg font-black flex cursor-pointer list-none items-center justify-between font-heading">
              {question}
              <PlusIcon
                aria-hidden="true"
                className="size-5 shrink-0 transition-transform group-open:rotate-45"
              />
            </summary>
            <p className="mt-3 text-pretty text-ink/75">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FinalCall() {
  return (
    <section className="max-w-6xl px-4 pb-20 sm:px-6 md:px-8 mx-auto">
      <div className="p-8 md:p-14 gap-6 md:flex-row md:items-center md:justify-between flex flex-col items-start rounded-4xl bg-ink text-ink-foreground">
        <div>
          <h2 className="text-3xl font-black md:text-5xl tracking-tighter font-heading text-balance">
            Your first pack is waiting
          </h2>
          <p className="mt-3 text-lg text-ink-foreground/70">
            Free, in your browser, in seconds.
          </p>
        </div>
        <PlayButton>Play Holotrack</PlayButton>
      </div>
    </section>
  )
}

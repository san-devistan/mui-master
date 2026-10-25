import { Link } from "@tanstack/react-router"

// The public pages' footer: the legal pages, then who we are and aren't.
export function SiteFooter() {
  return (
    <footer className="max-w-6xl px-4 pb-10 sm:px-6 md:px-8 gap-4 text-sm mx-auto flex flex-col text-ink/60">
      <nav
        aria-label="Legal"
        className="gap-x-5 gap-y-2 font-bold flex flex-wrap"
      >
        <Link to="/odds" className="hover:text-ink hover:underline">
          Pack odds
        </Link>
        <Link to="/terms" className="hover:text-ink hover:underline">
          Terms
        </Link>
        <Link to="/privacy" className="hover:text-ink hover:underline">
          Privacy
        </Link>
      </nav>
      <div className="gap-2 sm:flex-row sm:justify-between flex flex-col">
        <p>© 2026 Holotrack</p>
        <p>Not affiliated with Spotify or Deezer.</p>
      </div>
    </footer>
  )
}

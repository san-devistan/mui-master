import { LandingPage } from "@/landing/landing-page"
import { createFileRoute } from "@tanstack/react-router"

// shortcut: production URL is hardcoded, update it (and public/sitemap.xml) with a custom domain.
const SITE = "https://musi-master.vercel.app"
const TITLE = "Holotrack: Free Music Trading Card Game"
const DESCRIPTION =
  "Open free packs of holo cards for the world's biggest songs and artists. Hear every pull, chase legendary hits and trade in live auctions."
const IMAGE = `${SITE}/icon-512.png`

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Holotrack" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE}/` },
      { property: "og:image", content: IMAGE },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: IMAGE },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "VideoGame",
          name: "Holotrack",
          url: `${SITE}/`,
          description: DESCRIPTION,
          image: IMAGE,
          genre: ["Trading card game", "Music game"],
          gamePlatform: "Web browser",
          applicationCategory: "GameApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        },
      },
    ],
    links: [{ rel: "canonical", href: `${SITE}/` }],
  }),
  component: LandingPage,
})

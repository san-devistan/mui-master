# Web App

TanStack Start app (Router + Query). It owns routes, loaders, and screen
composition; data and logic come from `@workspace/backend`.

It runs on Cloudflare Workers (`wrangler.jsonc`), in dev too: the server code
runs in `workerd`, so it uses Web APIs and `nodejs_compat`, not a Node server.
`pnpm run deploy` builds it into `dist/` and deploys it with Wrangler;
`public/_headers` sets the static assets' caching. The Worker's entry is
`src/server.ts`: TanStack Start, plus the landing's film served in byte ranges
(static assets answer a `Range` request with the whole file, and Chrome then
can't seek the video), so `/landing/*.mp4` runs the Worker first.

`/` is the server-rendered landing page (`src/landing/`), with its SEO metadata
on `routes/index.tsx`; the game starts at `/play`, the Packs tab. Scrolling the
landing scrubs a film of the game's pack opening for its real catalog cards
(`showcase-pack.ts`), forwards and back at any speed. `pack-film.ts` (checked by
`pack-film.check.mjs`) holds the film's timeline and pacing and maps the scroll
onto it. Change the pack or its timing, then re-film it from the game's own
scene with the dev server up:
`node scripts/record-pack-film.mjs` (it films the unlinked
`/pack-film` route into `public/landing/`).

The landing's footer (`src/legal/site-footer.tsx`) links the public legal
pages, all server-rendered and in `public/sitemap.xml`: `/odds`, every pack's
odds read from the backend's own draw constants
(`@workspace/backend/rarity`, through `src/legal/pack-odds.ts`, also behind
the landing's rarity odds), so they can't drift from what the game rolls;
`/terms`; and `/privacy`. Change what the game collects, who processes it, or
how purchases work, and update those pages with their date. Players reach us
at `hello@holotrack.art` (Cloudflare Email Routing forwards it).

## UI

Screens are built from `@workspace/ui`. When something is missing, it usually
belongs in `packages/ui` rather than in the app.

The game reads everything from Convex (`convex/packs.ts`): `packs.next` is the
player's waiting pack, `packs.claim` opens it into their collection,
`collection.list` pages through their cards (filtered and sorted by the
backend), `collection.count` counts them, `packs.catalog` gives the catalog size
and pack covers. The Packs, Collection and Market pages stay mounted by the game
layout, hidden on other tabs, so they keep their state; grid thumbs hold a 3D card
only near the view. Collection and Market share their toolbar (rarity, a second
select, search; `src/game/_components/card-toolbar.tsx`); the market's second
select picks other players' auctions, the player's own, those they've bid on, or
those they won (`market.auctions` `scope`), and a tapped auction opens on its own card page with
its bid history. A showcased card scrolls down to its related cards
(`related.*`: an artist's songs and collaborators, a song's artists and their
songs); owned ones open over it, the rest show grayed out. Cards are songs or artists (`src/game/_lib/cards.ts`). On app
open, `packs.upgrades` cards that went up a rarity climb one rarity per tap on
their own screen (`src/game/_components/card-upgrades.tsx`). The profile page
shows the player and their showcase, then the account: the username (unique
across players, any case; `src/game/_components/account-settings.tsx`); this
device's preferences (`src/game/_components/preference-settings.tsx`):
notifications (`public/sw.js` shows them; iOS only once added to the Home
Screen), sound effects and music (`@workspace/ui/lib/game/sound-settings`, kept
in localStorage), and, in a phone's browser, the Home Screen install guide
(`src/game/_components/install-prompt.tsx`, also shown once on its own); and the
danger zone, signing out and deleting the account.
A new account, once it has picked its username, lands on `/play?welcome=true`,
which offers to turn notifications on
(`src/game/_components/notifications-prompt.tsx`) instead of the install guide;
skipped where the browser can't get them yet (iOS outside the Home Screen
app), where they're on or blocked. Closing it drops `welcome` from the URL.

Feature flags come from the backend (`convex/flags.ts`, read with `useFlags` in
`src/game/_lib/flags.ts`), per player (a grant can turn them on for one email),
and only hide UI; the backend enforces them. `premium` shows the holo shop
(`src/game/_components/holo-shop.tsx`), the Go Pro button, the holos pill
opening it, "Get holos" and the Pro badge; `dev` shows the dev tools on the
profile page (`src/game/_components/dev-tools.tsx`). A shop buy goes to Stripe
Checkout (`billing.checkout`) and comes back to `/play?checkout=done` (or
`=cancelled`), said once by `src/game/_components/checkout-return.tsx`; the
holos or Pro arrive through Stripe's webhook and show live. Once they've bought
something, the profile's Billing row opens Stripe's billing portal
(`src/game/_components/billing-settings.tsx`).

## Auth

Players are Better Auth users (`src/lib/auth-client.ts`); there are no guests.
The landing's Play buttons go to `/sign-in` (`src/auth/`), and the game layout
sends anyone without a session and a username there too. One flow for new and
returning players: an email, then the 6-digit code emailed to it (Better Auth's
email OTP, sent with Resend from `convex/auth.ts`). A new email makes an
account, which picks its username before going to `/play`; a signed-in player
goes straight to `/play`.
Better Auth's endpoints are served at `/api/auth/*` (`routes/api.auth.$.ts`),
forwarded to the Convex deployment with the request body buffered (Node's fetch
fails a streamed body that gets a 401), so it needs `VITE_CONVEX_SITE_URL` (the
`.convex.site` URL) in `.env.local`, inlined into the build.
The route also passes the player's IP for the backend's rate limits, signed with
the Worker secret `AUTH_PROXY_SECRET` (the same value as the Convex env var:
`pnpm exec wrangler secret put AUTH_PROXY_SECRET`); without it every player on
prod shares the Worker's IP, and so its limits.

## Analytics

PostHog (`src/analytics/analytics-provider.tsx`) records pageviews, clicks and
errors, identifies signed-in players (visitors stay anonymous) and resets on
sign out. Game actions capture their own events after the backend confirms them
(`posthog.capture` from `usePostHog()`). It needs
`VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` in
`.env.local` and the build; without them the app runs untracked.

The landing's funnel (`src/landing/landing-analytics.ts`): `landing_section_viewed`
(`card_reveal`, `all_cards`, `features`, each once a visit) and
`landing_cta_clicked` (`play`, with its `header`, `hero` or `join`
placement); the next pageview carries the landing's scroll depth.

## Effect

Effect makes errors, dependencies, and side effects explicit in types. Use it
where those matter, such as backend calls, server functions, retries, and
concurrent work; keep plain UI code plain. Before writing Effect code, read
`node_modules/effect/AGENTS.md`.

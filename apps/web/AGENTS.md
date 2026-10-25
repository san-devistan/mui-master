# Web App

TanStack Start app (Router + Query). It owns routes, loaders, and screen
composition; data and logic come from `@workspace/backend`.

It runs on Cloudflare Workers (`wrangler.jsonc`), in dev too: the server code
runs in `workerd`, so it uses Web APIs and `nodejs_compat`, not a Node server.
`pnpm run deploy` builds it into `dist/` and deploys it with Wrangler;
`public/_headers` sets the static assets' caching.

`/` is the server-rendered landing page (`src/landing/`), with its SEO metadata
on `routes/index.tsx`; the game starts at `/play`, the Packs tab. Scrolling the
landing scrubs a film of the game's pack opening for its real catalog cards
(`showcase-pack.ts`), forwards and back at any speed. `pack-film.ts` (checked by
`pack-film.check.mjs`) holds the film's timeline and pacing and maps the scroll
onto it. Change the pack or its timing, then re-film it from the game's own
scene with the dev server up:
`node scripts/record-pack-film.mjs` (it films the unlinked
`/pack-film` route into `public/landing/`).

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
shows the player and their showcase, turns this device's notifications on
(`public/sw.js` shows them; iOS only once added to the Home Screen), and holds
the account: the username (unique across players, any case), signing out and
deleting the account (`src/game/_components/account-settings.tsx`).

## Auth

Players are Better Auth users (`src/lib/auth-client.ts`). A visitor plays as an
anonymous guest (the game layout signs them in on arrival) until they sign in at
`/sign-in` (`src/auth/`): one flow for new and returning players, an email,
then the 6-digit code emailed to it (Better Auth's email OTP, sent with Resend
from `convex/auth.ts`). A new email makes an account, which picks its username
before going to `/play`. The backend moves the guest's game to the account
(`convex/players.ts`).
Better Auth's endpoints are served at `/api/auth/*` (`routes/api.auth.$.ts`),
forwarded to the Convex deployment with the request body buffered (Node's fetch
fails a streamed body that gets a 401), so it needs `VITE_CONVEX_SITE_URL` (the
`.convex.site` URL) in `.env.local`, inlined into the build.

## Effect

Effect makes errors, dependencies, and side effects explicit in types. Use it
where those matter, such as backend calls, server functions, retries, and
concurrent work; keep plain UI code plain. Before writing Effect code, read
`node_modules/effect/AGENTS.md`.

# Web App

TanStack Start app (Router + Query). It owns routes, loaders, and screen
composition; data and logic come from `@workspace/backend`.

## UI

Screens are built from `@workspace/ui`. When something is missing, it usually
belongs in `packages/ui` rather than in the app.

The game reads everything from Convex (`convex/packs.ts`): `packs.next` is the
player's waiting pack, `packs.claim` opens it into their collection,
`packs.collection` lists their cards, `packs.catalog` gives the card count and
pack covers. Cards are songs or artists (`src/game/_lib/cards.ts`). The
profile page is empty for now.

## Auth

Players are Better Auth users (`src/lib/auth-client.ts`). Everyone plays as an
anonymous guest for now: the game layout signs a visitor in on arrival.
Better Auth's endpoints are served at `/api/auth/*` (`routes/api.auth.$.ts`),
forwarded to the Convex deployment, so it needs `VITE_CONVEX_SITE_URL` (the
`.convex.site` URL) in `.env.local`.

## Effect

Effect makes errors, dependencies, and side effects explicit in types. Use it
where those matter, such as backend calls, server functions, retries, and
concurrent work; keep plain UI code plain. Before writing Effect code, read
`node_modules/effect/AGENTS.md`.

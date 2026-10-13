# Web App

TanStack Start app (Router + Query). It owns routes, loaders, and screen
composition; data and logic come from `@workspace/backend`.

## UI

Screens are built from `@workspace/ui`. When something is missing, it usually
belongs in `packages/ui` rather than in the app.

The game reads the catalog from Convex (`convex/packs.ts`): `packs.open`
draws a pack, `packs.cards` loads the collection's cards, `packs.catalog`
gives the card count and pack covers. Cards are songs or artists
(`src/game/_lib/cards.ts`). Until accounts exist, the player's collection
(card ids, copies, first pull) lives in localStorage
(`src/game/_lib/collection.ts`); card details always come from the backend.
The profile page is empty for now.

## Effect

Effect makes errors, dependencies, and side effects explicit in types. Use it
where those matter, such as backend calls, server functions, retries, and
concurrent work; keep plain UI code plain. Before writing Effect code, read
`node_modules/effect/AGENTS.md`.

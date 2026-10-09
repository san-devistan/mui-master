<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

<!-- convex-ai-end -->

## Role

This is where the app's data and business logic live. Apps call the generated
API from `@workspace/backend`; anything beyond presentation belongs here.

## Providers

External providers are added as Convex components:

- Auth: [Better Auth](https://www.convex.dev/components/better-auth) (MCP)
- Payments: [Stripe](https://www.convex.dev/components/stripe) (MCP, CLI)
- Email: [Resend](https://www.convex.dev/components/resend)

Convex itself is reachable through its MCP and the workspace CLI
(`pnpm exec convex`).

## Song catalog (Audiometa)

Cards are songs with at least 100M Spotify streams, imported from the
[Audiometa API](https://api.audiometa.io/v1/docs) (`songs/_lib/audiometa.ts`,
`catalog.ts`).

- Set the key: `pnpm exec convex env set AUDIOMETA_API_KEY <key>` (never in
  source). Limit: 100 requests/min per key.
- Run: `pnpm exec convex run catalog:startImport`; a daily cron does the same.
  Progress is in the `songImports` table. A failed run continues from where
  it stopped with `catalog:resume { importId }`.
- Audiometa can't filter by streams, so each step lists 50 tracks from
  `/tracks/by-tempo` (tempo 0–400, sorted by popularity), then fetches their
  `playcounts.spotify` with `/tracks?ids=…`. Tracks below 100M are dropped.
  The import stops after 3,000 ranks with no hit, or at rank 20,000. Steps
  are scheduled actions about 1.5 s apart. Requests retry on 429 and 5xx
  errors.
- Duplicates: `songKey` is the lead artist ID plus a normalized title with
  featurings, remasters, remix and version suffixes removed. Every Audiometa
  ID is kept in `songVersions`. The card keeps the version with the most
  streams, including its cover.
- Rarity comes from streams (`songs/_lib/rarity.ts`): legendary 2B+, epic 1B+,
  rare 400M+, common 100M+. Each card rolls common 85%, rare 12%, epic 2.5%,
  legendary 0.5%, then a random song of that tier via `randomKey`.
  `rarityCounters` holds the count per tier. After changing tiers, run
  `pnpm exec convex run rarity:rerateSongs` to re-rate stored songs.
- Titles: `displayTitle` (`songs/_lib/dedupe.ts`) strips featurings (feat,
  ft, with, con, w/, part.), live, remix, remaster/year and Taylor's Version
  suffixes. Featured artists stay in the song's artist credits. Check:
  `node packages/backend/convex/songs/_lib/dedupe.check.mjs`.
- Artists and albums: `artists` (Audiometa ID, name, `details` with genres,
  bio, country, image, followers, socials), `songArtists` (song ↔ artist, with
  `position`, 0 = lead) and `songs.artistIds` (same order as `artistNames`).
  `albums` have `artistIds` and `details` (label, UPC, total tracks,
  popularity, date precision). Imports fill credits and album artists
  (`artists.ts`). `enrichment.ts` backfills them from Audiometa in three
  phases (song credits, then albums and artists missing `enrichedAt`):
  `pnpm exec convex run enrichment:start`, progress in `enrichmentRuns`,
  `enrichment:resume { runId }` after a failure. Re-run it after an import to
  enrich new albums and artists. Albums are fetched one by one
  (`/albums/{id}`): the batch `/albums?ids=` endpoint takes 20–120 s per call.
  Albums and artists are stored but not shown in the app yet.
- Release dates (`releases.ts`, `scripts/web-release-dates.mjs`):
  `songs.releaseDate` is `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. The script runs
  locally on songs with `reviewed: false` (new songs start there), 4 at a
  time. Claude Sonnet answers from memory or searches the web, and the found
  day goes in `webDate`.
  When a date is found it wins: `releaseDate = webDate`, `reviewed: true`.
  When none is found, `releaseDate` stays and `reviewed` is `null`. List
  those with `releases:toReview` and fix them with `releases:setDates`.
- Previews (`playback.ts`): Audiometa's `previewUrl` if present, otherwise a
  fresh Deezer link looked up by ISRC. Deezer links expire, so don't store
  them.
- Re-running the import updates existing rows. To start from scratch, clear
  the song tables in batches (Convex mutations have size limits), then run the
  import.

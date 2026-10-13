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

## Song catalog

Cards are songs with at least 100M Spotify streams, in `songs` (keyed by
`ids.spotify`) and `artists`. Spotify and Deezer links are built from `ids`:
`open.spotify.com/track/{id}`, `deezer.com/track/{id}` (`artist/{id}` for
artists). Songs also keep the recording's ISRC in `ids.isrc` (required: a
song Spotify gives no ISRC for is an import error), the id shared by every
platform.

- Source of truth: DJ Salty's "100+ Million Streams" playlists, listed by
  URL in `scripts/import-songs.mjs` (Spotify caps a playlist at 10,000
  tracks, so add the URL of any new one he starts). Run monthly,
  `node scripts/import-songs.mjs --save` (without `--save`, a dry run of one
  batch per step): it reads every playlist track, fully imports the ones
  not stored as a song or a song's duplicate (`catalog:storedSongs`), then
  refreshes every stored song's play count and every stored artist's
  monthly listeners (`catalog:refresh`, nothing else). A song that leaves
  the playlists stays in the game. Writes go to the deployment in
  `packages/backend/.env.local` (dev; the web app reads it too). Exits 1
  when more than 1% of songs and artists fail, a sign that a Spotify
  persisted-query hash expired.
- Import (`scripts/import-songs.mjs`, saved by `catalog:save`): reads
  Spotify's web player with an anonymous token, no API key. Per song:
  `getTrack` (name, artists, playcount, cover, duration, explicit, release
  date), the embed page (preview), audio-analysis (tempo; a random 50-200 BPM
  when Spotify has no analysis for the song), and Deezer for the
  song and artist ids: the playable track with the song's ISRC (from
  Spotify's track metadata), else a search: another track with that ISRC,
  then one by the lead artist within 3 s, then one crediting any of the
  song's artists under the same title, within 10 s and not a remix, live or
  acoustic version (`deezerTrack`). Artist names match without accents,
  case, punctuation, "the" or "&" ("JAŸ-Z" is Deezer's "JAY Z"). Per artist:
  `queryArtistOverview` (picture, monthly listeners).
  Songs under 100M are skipped, so a later run imports them once they pass
  it; a failed song is retried on the next run.
- Rules (`catalog.ts`, applied by `catalog:save` to everything the import
  sends): an artist needs a picture and a monthly listener count, and isn't
  Various Artists, so side, alias and misspelled profiles are dropped. A song
  needs 100M+ streams, a title and at least one kept artist; its credits keep
  only kept artists. `catalog:save` returns the songs it rejected, so they're
  looked up again (and rejected again) on a rerun.
- One song per recording: a song whose ISRC is already stored under another
  Spotify id (a single and its album release, say) is merged into it.
  `isBetterRelease` (`songs/_lib/dedupe.ts`) keeps the oldest release (by
  `releaseDate`); the other's Spotify id goes in
  `ids.duplicates`, which the import treats as stored, so a rerun skips
  it. A release that loses the merge saves none of its credits: an artist
  is only stored with a song that keeps them (a 2022 compilation credited
  the producer Stevie J on a 1996 song). Check:
  `node packages/backend/convex/songs/_lib/dedupe.check.mjs`.
- `metadata.releaseDate` is the date of the Spotify release the track sits
  on (`YYYY-MM-DD`, or `YYYY` when Spotify only has the year), so remasters
  and compilations show their own date; many full dates are a placeholder
  January 1st. `metadata.releaseYear` is its year, the same format for every
  song. Tempo comes from Spotify's analysis and can be doubled or halved.
- Rarity (`songs/_lib/rarity.ts`): songs and artists are both cards, each
  with a stored `rarity` that only ever rises (`raiseRarity`), so a merged
  release, a stream purge or a removed song never downgrades a player's card.
  A song's comes from its `playcount`: legendary 2B+, epic 1B+, rare 400M+,
  common 100M+. An artist's `playcount` is the sum of the catalog songs
  crediting them (lead or featured), and its rarity: legendary 20B+, epic
  5B+, rare 1B+, else common. `catalog:updateRarities` recomputes artist
  playcounts and raises every rarity; the import runs it at the end of each
  `--save` run. Keep the thresholds fixed once the game is live: rarities
  can't go down, so raising a threshold would mix old and new rules. Each
  card rolls common 85%, rare 12%, epic 2.5%, legendary 0.5%. Check:
  `node packages/backend/convex/songs/_lib/rarity.check.mjs`.
- Packs (`packs.ts`): five cards, each a rolled rarity, then a song or an
  artist of it in proportion to how many of each hold it (counts in
  `catalogStats`), picked with a random `drawKey` on the
  `by_rarity_and_drawKey` index; never the same card twice in a pack. An
  artist card plays the preview of its `topSongId`, its most played catalog
  song. `catalog:updateRarities` keeps `topSongId`, `drawKey` and
  `catalogStats` current.
- Titles: `displayTitle` (`songs/_lib/dedupe.ts`) strips featurings (feat,
  ft, with, con, w/, part.), live, remix, remaster/year and Taylor's Version
  suffixes, for the Deezer preview search. Check:
  `node packages/backend/convex/songs/_lib/dedupe.check.mjs`.
- Previews (`playback.ts`, takes a `songs` id): the stored Spotify `preview`
  if present, otherwise a fresh Deezer link found by exact title and lead
  artist. Deezer links expire, so don't store them.

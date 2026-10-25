# Design System

Source of truth for design across the repo.

- Tokens: shadcn CSS variables in `src/styles/globals.css`.
- Components: shadcn-style web components in `src/components`, used by
  `apps/web`.
- shadcn: use the shadcn MCP or CLI. The CLI runs from the web app
  (`--cwd apps/web`) and writes into this package.
- Game visuals: `game-*` (`game-settings`: the profile's settings panels and
  rows), `song-card`, `booster-pack`, `pack-opening`,
  `scroll-pack` (the same opening, stepped by the caller, e.g. to film the
  landing's), `card-back`, `rarity-badge`, `holo-coin`, and `celebration` are the
  Musi Master primitives. The three.js and shader engine lives in
  `src/lib/game`; global effects live in `src/styles/game.css`. Sound effects
  (`sfx.ts`) and music (`waiting-music.ts`, the app's song previews) check the
  player's switches in `sound-settings.ts`.

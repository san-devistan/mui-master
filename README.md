# Architecture

```mermaid
flowchart LR
  Web["Web App<br/>TanStack Start + Cloudflare Workers"]
  Backend["Backend<br/>Convex + Stripe<br/>Resend + Better Auth"]
  Tokens["Shared Tokens<br/>packages/ui"]
  WebUI["Web UI<br/>shadcn components"]

  Tokens --> WebUI --> Web
  Backend --> Web
```

## Design System Flow

- `packages/ui/src/styles/globals.css` holds the shared shadcn tokens.
- Web uses shadcn components from `packages/ui`.

## AI Setup

- Skills are scoped under each workspace's `.agents/skills` directory.
- Configured MCPs cover Convex, Better Auth, Stripe, shadcn, and Cloudflare.

## Deploy

The web app runs on Cloudflare Workers (`apps/web/wrangler.jsonc`), served at
`https://holotrack.art`. Pushes to `main` build and deploy it through Workers
Builds (root `apps/web`; the Convex URLs and `VITE_PUBLIC_POSTHOG_*` are its build
variables).
`pnpm deploy:web` deploys from this machine instead, with the Convex URLs from
`apps/web/.env.local` (`pnpm --filter web exec wrangler login` once).

## Quality Gate

Run `pnpm fix` for all checks, or `pnpm exec oxlint .` for linting only.

- Oxlint enforces correctness, type safety, React, and accessibility rules.
- `@shadcn/lint` keeps web on the design system: theme colors, scale
  values, known Tailwind classes, static classes, and no inline styles. Web
  consumers of shared components may only add layout classes; appearance
  belongs in component variants. Vendored shadcn sources in
  `packages/ui/src/components` are exempt from style-only rules.
- React Doctor (`doctor.config.json`) adds React-specific checks on top of
  Oxlint without repeating its rules.

```mermaid
flowchart LR
  Format["format<br/>oxfmt"]
  Format --> Lint["lint<br/>oxlint + shadcn"]
  Lint --> Doctor["React Doctor"]
  Lint --> Types["TypeScript"]
```

## Set Up

- replace `name-of-project` in the codebase
- run `pnpm self-update` and `pnpm update:deps`
- apply a web theme with
  `pnpm dlx shadcn@latest apply --preset [preset-id] --cwd apps/web --yes`

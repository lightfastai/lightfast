# Lightfast repository guidance

Lightfast is a pnpm/Turborepo monorepo for AI agent orchestration tooling. See
`SPEC.md` for business goals and product direction.

## Current architecture

```text
Local browser development
  https://[<wt>.]example.lightfast.localhost
    apps/example · local-only TanStack Start app · @repo/ui-v2

  https://[<wt>.]storybook.lightfast.localhost
    apps/storybook · shared UI component workshop

Configurable clients
  core/lightfast · public TypeScript SDK (`lightfast`)
  core/mcp       · public API-key stdio MCP (`@lightfastai/mcp`)
  core/cli       · CLI (`@lightfastai/cli`)
  These public clients require explicit compatible endpoint configuration.

Repository-local tools
  apps/desktop · hardened static Electron shell
  apps/mcp     · empty stdio-only MCP shell
  Neither has a hosted endpoint, backend, deployment, or production wiring.

Backend and data packages
  api/app · small context/router/root foundation with a health seam
  db/app  · provider-safe client/config foundation with an empty schema
  These packages are retained but are not assembled into a production app here.

Public website
  https://lightfast.ai · owned by https://github.com/lightfastai/www
  packages/ui-v2 is preserved here; website work belongs in the external repo.
```

The retired private `apps/app` and hosted `apps/mcp` products have no
replacement production backend in this repository. Do not reintroduce
`https://lightfast.ai` as an implicit API, OAuth, MCP, CLI, or desktop endpoint.
It remains valid as the public website/documentation URL.

## Development commands

```bash
pnpm dev                # local example + Storybook through Portless
pnpm build:example      # build the local TanStack Start example
pnpm check              # Biome/Ultracite checks
pnpm typecheck          # workspace typecheck
pnpm test               # workspace tests
pnpm lint:ws            # workspace dependency checks
pnpm verify:public-api  # focused API/SDK/MCP surface verification
```

`pnpm dev` is the root local-development entrypoint. It starts the Portless
proxy and runs only `@lightfast/example` and `@lightfast/storybook`. The example
is not a deployment target and must not gain Vercel, microfrontend, hosted auth,
database, queue, or production backend configuration.

## Local infrastructure and env files

Load `lightfast-local-infra` before local PlanetScale setup. It is the source
of truth for provisioning and safe database env writes.

Package-local ignored files are the active boundary:

```text
db/app/.env.overrides.local   local DB overrides
db/app/.env.local             broader DB operator configuration
```

Do not read, copy, or write secrets unless the current task explicitly
authorizes it. Provider creation, deletion, credential minting/rotation,
schema writes, and live verification require their own exact approval.

## Database commands

```bash
pnpm db:generate   # generate migrations; never hand-write SQL files
pnpm db:push       # apply the current schema to an approved local branch
pnpm db:studio     # Drizzle Studio through Portless
```

## Package rules

1. Use vendor abstractions; do not import `@planetscale/*` directly outside the
   vendor package.
2. Internal dependencies use `workspace:*`; shared external dependencies use
   the appropriate catalog.
3. Prefer package tasks and let Turborepo orchestrate them.
4. Keep public SDK, MCP, CLI, and desktop clients buildable without a hosted
   Lightfast default.

## Environment

- Node.js >= 22.13.0
- pnpm 11.1.3, pinned by the root `packageManager`
- Canonical local URLs are provided by Portless; no manual ports are pinned.

If a `.localhost` route does not resolve, verify the Portless proxy or service
is running. Website-specific diagnostics and changes belong in
`lightfastai/www`.

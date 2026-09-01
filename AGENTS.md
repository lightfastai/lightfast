<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

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
  apps/desktop   · Electron client
  All require an explicit compatible backend URL.

Backend and data packages
  api/app · API/domain services, Inngest workflows, auth boundaries
  db/app  · Drizzle/PlanetScale schema and database tooling
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

Load `lightfast-local-infra` before local PlanetScale or Upstash setup. It is
the source of truth for provisioning and safe env writes.

Package-local ignored files are the active boundary:

```text
api/app/.env.overrides.local  local DB + Redis overrides
api/app/.env.local            broader API operator configuration
db/app/.env.overrides.local   local DB overrides
db/app/.env.local             broader DB operator configuration
ai/.env.local                 live eval configuration
e2e/.env.local                E2E operator configuration
apps/desktop/.env.local       required APP_URL + desktop configuration
```

Do not read, copy, or write secrets unless the current task explicitly
authorizes it. Provider creation, deletion, credential minting/rotation,
migrations, and live verification require their own exact approval.

## Database commands

```bash
pnpm db:generate   # generate migrations; never hand-write SQL files
pnpm db:migrate
pnpm db:studio     # Drizzle Studio through Portless
```

## Auth boundaries

- `userScopedProcedure`: Clerk-pending or Clerk-active session.
- `orgScopedProcedure`: active Clerk organization membership required.

## Package rules

1. Use vendor abstractions; do not import `@planetscale/*` directly outside the
   vendor package.
2. Internal dependencies use `workspace:*`; shared external dependencies use
   the appropriate catalog.
3. Inngest workflows remain under `api/app/src/inngest/workflow/`.
4. Prefer package tasks and let Turborepo orchestrate them.
5. Keep public SDK, MCP, CLI, and desktop clients buildable without a hosted
   Lightfast default.

## Environment

- Node.js >= 22.13.0
- pnpm 11.1.3, pinned by the root `packageManager`
- Canonical local URLs are provided by Portless; no manual ports are pinned.

If a `.localhost` route does not resolve, verify the Portless proxy or service
is running. Website-specific diagnostics and changes belong in
`lightfastai/www`.

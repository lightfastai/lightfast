# Contributing to Lightfast

Thank you for contributing. Keep changes scoped, preserve unrelated work, and
use the package-level checks that match the surface you change.

## Prerequisites

- Node.js >= 22.13.0
- pnpm 11.1.3, enforced by the root `packageManager`

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/lightfast.git
cd lightfast
pnpm install
```

Environment variables are package-local. Use ignored `.env.local` or
`.env.overrides.local` files only in the package that consumes them. Local
PlanetScale setup requires explicit approval for that run; do not copy provider
values between packages.

## Repository shape

- `apps/example`: local-only TanStack Start example using `@repo/ui-v2`
- `apps/storybook`: shared UI component workshop
- `apps/desktop`: hardened static Electron shell for local repository use
- `apps/mcp`: empty stdio-only MCP shell for local repository use
- `core/lightfast`: public TypeScript SDK; requires `baseUrl`
- `core/mcp`: public stdio MCP server; requires `LIGHTFAST_API_URL`
- `core/cli`: CLI; login requires `LIGHTFAST_APP_URL`
- `api/app`: minimal context/router/root foundation with a health seam
- `db/app`: provider-safe client/config foundation with an empty schema
- `packages`, `vendor`, `internal`: shared code and supporting tooling

The public website at [lightfast.ai](https://lightfast.ai) is owned by the
separate [`lightfastai/www`](https://github.com/lightfastai/www) repository.
This repository does not provide a replacement production backend for the
retired private applications.

## Local development

```bash
pnpm dev
```

The root command starts Portless and runs only the local example and Storybook:

- `https://[<wt>.]example.lightfast.localhost`
- `https://[<wt>.]storybook.lightfast.localhost`

Portless is a workspace dependency. To bind HTTPS port 443 persistently:

```bash
pnpm exec portless service install
pnpm exec portless service status
```

The local example must remain free of Vercel, microfrontend, hosted auth,
database, queue, and production backend configuration.

## Common commands

```bash
pnpm build:example      # build the local example
pnpm check              # format/lint checks
pnpm typecheck          # workspace TypeScript checks
pnpm test               # workspace tests
pnpm lint:ws            # dependency/workspace checks
pnpm verify:public-api  # API/SDK/MCP verification

pnpm db:generate        # generate Drizzle migrations; never hand-write SQL
pnpm db:push            # approved local PlanetScale branch only
pnpm db:studio

pnpm --filter @lightfast/desktop dev
pnpm --filter @lightfast/mcp-local dev
```

Run package-specific commands with a filter when changing one package:

```bash
pnpm --filter @lightfast/example build
pnpm --filter lightfast test
pnpm --filter @lightfastai/mcp typecheck
```

## Code conventions

- Use strict TypeScript and avoid unjustified `any`.
- Use `workspace:*` for internal dependencies and catalogs for shared external
  dependencies.
- Import third-party SDKs through the relevant `@vendor/*` abstraction.
- In TanStack Start, keep `tanstackStart()` before the React Vite plugin and
  render `HeadContent`, `Outlet`, and `Scripts` in the root document.
- Use `@repo/ui-v2` for the current shared UI surface.
- If schema work is separately approved, generate Drizzle migrations with
  repository commands; never hand-write or edit generated SQL.

## Pull requests

Before opening a PR:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm lint:ws
```

Also run relevant builds and public API checks. Explain behavior changes,
configuration requirements, tests run, and any production follow-up that is
intentionally outside the PR. Do not treat green CI as authorization to deploy,
delete providers, rotate credentials, or merge.

Use conventional commit subjects such as `feat:`, `fix:`, `refactor:`,
`chore:`, or `docs:`.

## License

Lightfast platform packages are Apache-2.0 and SDK/shared packages may be MIT.
The nearest `package.json` license, or the repository root license when absent,
governs each contribution.

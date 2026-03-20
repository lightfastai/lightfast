# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

See `SPEC.md` for business goals and product vision.

**Lightfast** is a pnpm monorepo (Turborepo) for building AI agent orchestration tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Next.js Apps                                                                   │
│  ┌──────────────────┐  ┌────────────┐  ┌─────────┐                            │
│  │ app (4107)       │  │ www (4101) │  │docs(4105│                            │
│  │ @api/app     │  │ marketing  │  │Fumadocs │                            │
│  │ tRPC + Inngest   │  │ CMS        │  │MDX      │                            │
│  │ + auth routes    │  │            │  │         │                            │
│  └───────┬──────────┘  └────────────┘  └─────────┘                            │
│          │                                                                      │
│  ┌──────────────────┐                                                          │
│  │ platform (4112)  │                                                          │
│  │ @api/platform      │  Connections, webhooks, backfill, neural pipeline        │
│  │ tRPC + Inngest   │  OAuth flows, token vault, event ingestion               │
│  └──────────────────┘                                                          │
│                          @db/app (Drizzle)                                  │
│                          @vendor/upstash (Redis)                                │
└─────────────────────────────────────────────────────────────────────────────────┘

Packages: @repo/* (ui, lib, ai)  |  @repo/app-* (23)  |  @vendor/* (18)
```

### Vercel Microfrontends (lightfast.ai)

2 apps (app, www) served through single domain via `apps/app/microfrontends.json`.
App is default app (catch-all routes, sitemap.xml, robots.txt, auth routes).
Auth routes (/sign-in, /sign-up, /early-access) are served directly by app (migrated from former apps/auth).
Docs proxied via app rewrites (`next.config.ts`), not in microfrontends config.

### Platform Service

Standalone Next.js app (`apps/platform`, port 4112) that consolidates the former relay, gateway, and backfill Hono microservices into a single tRPC + Inngest service.
Handles: OAuth flows, token vault, connection lifecycle, webhook ingestion, backfill orchestration, and neural pipeline (event capture → entity upsert → graph).
Domain: `platform.lightfast.ai`.

### tRPC Auth Boundaries
- **userRouter**: No org required (account, apiKeys, sources)
- **orgRouter**: Org membership required (workspace, search, jobs)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build)
pnpm dev:full         # Full stack: app + www + platform (port 3024 via microfrontends)
pnpm dev:app          # App only (4107)
pnpm dev:www          # Marketing site (4101)
pnpm dev:docs         # Docs site (4105)
pnpm dev:platform     # Platform service (4112)

# Run dev server in background (for Claude Code sessions)
pnpm dev:app > /tmp/console-dev.log 2>&1 &
tail -f /tmp/console-dev.log  # Follow logs
pkill -f "next dev"           # Kill all dev servers

# Environment variables (MUST run from apps/<app>/ directory)
cd apps/app && pnpm with-env <command>

# Build & Quality
pnpm build:app                            # Next.js build
pnpm build:platform                       # Platform service build
pnpm check && pnpm typecheck

# Database (run from db/app/)
pnpm db:generate      # NEVER write manual .sql files
pnpm db:migrate
pnpm db:studio
```

Note: ngrok and inngest automatically runs with `pnpm dev:app`. You can test ngrok connection with `ps aux | grep ngrok | grep -v grep`

## Key Rules

1. **Vendor abstractions**: Standalone re-exports of third-party SDKs. Never import `@planetscale/*` directly → use `@vendor/db`
2. **Workspace protocol**: Use `workspace:*` for internal deps, `catalog:` for shared externals
3. **tRPC pattern**: `prefetch()` BEFORE `<HydrateClient>` to avoid UNAUTHORIZED errors
4. **Background jobs**: Inngest workflows in `api/app/src/inngest/workflow/` and `api/platform/src/inngest/`

## Environment

- **Node.js** >= 22.0.0 | **pnpm** 10.5.2
- **Env files**: `apps/<app>/.vercel/.env.development.local`

## Workflows

- **External repos**: Clone to `/tmp/repos/<repo-name>`
- **Dependencies**: Check root `node_modules/` (hoisted with `node-linker=hoisted`)

## Troubleshooting

```bash
pkill -f "next dev"                    # Port in use
pnpm clean:workspaces && pnpm install  # Module not found
pnpm --filter @api/app build       # tRPC type errors (api layer stays @api/app)
```

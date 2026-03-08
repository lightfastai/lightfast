# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

See `SPEC.md` for business goals and product vision.

**Lightfast** is a pnpm monorepo (Turborepo) for building AI agent orchestration tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Next.js Apps                                                                   │
│  ┌──────────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐  ┌───────┐ │
│  │ console (4107)   │  │ www (4101) │  │ auth (4104)│  │docs(4105│             │
│  │ @api/console     │  │ marketing  │  │ Clerk      │  │Fumadocs │             │
│  │ tRPC + Inngest   │  │ CMS        │  │ OAuth      │  │MDX      │             │
│  └───────┬──────────┘  └────────────┘  └────────────┘  └─────────┘             │
│          │                                                                      │
│  Hono Services (srvx, edge runtime)                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │ gateway (4110)   │  │ relay (4108)     │  │ backfill (4109)  │              │
│  │ OAuth + tokens   │→ │ webhooks + queue │→ │ historical data  │              │
│  │ connections CRUD │  │ QStash dispatch  │  │ Inngest workflows│              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
│          │                      │                      │                        │
│          └──────────────────────┴──────────────────────┘                        │
│                          @db/console (Drizzle)                                  │
│                          @vendor/upstash (Redis)                                │
└─────────────────────────────────────────────────────────────────────────────────┘

Packages: @repo/* (ui, lib, ai)  |  @repo/console-* (23)  |  @vendor/* (22)
```

### Vercel Microfrontends (lightfast.ai)

3 apps (console, www, auth) served through single domain via `apps/console/microfrontends.json`.
Console is default app (catch-all routes, sitemap.xml, robots.txt).
Docs proxied via console rewrites (`next.config.ts`), not in microfrontends config.

### Hono Services

3 edge-runtime microservices (`relay`, `gateway`, `backfill`) built with Hono + srvx.
All share the same middleware stack: `requestId` → `lifecycle` → `errorSanitizer` → `sentry`.
Internal auth via `X-API-Key` header. Types shared via `@repo/gateway-types`.

- **gateway**: OAuth flows, token vault, connection lifecycle (Upstash Workflow for teardown)
- **relay**: Inbound webhooks, HMAC verification, deduplication (Redis), QStash dispatch
- **backfill**: Historical data import, triggered by relay, orchestrates Inngest workflows

### tRPC Auth Boundaries
- **userRouter**: No org required (account, apiKeys, sources)
- **orgRouter**: Org membership required (workspace, search, jobs)
- **m2mRouter**: Internal services only (Inngest, webhooks)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build)
pnpm dev:app          # Full stack: console + www + auth + relay + backfill + gateway (port 3024 via microfrontends)
pnpm dev:console      # Console only (4107)
pnpm dev:www          # Marketing site (4101)
pnpm dev:docs         # Docs site (4105)
pnpm dev:relay        # Relay service (4108)
pnpm dev:gateway      # Gateway service (4110)
pnpm dev:backfill     # Backfill service (4109)

# Run dev server in background (for Claude Code sessions)
pnpm dev:console > /tmp/console-dev.log 2>&1 &
tail -f /tmp/console-dev.log  # Follow logs
pkill -f "next dev"           # Kill all dev servers

# Environment variables (MUST run from apps/<app>/ directory)
cd apps/console && pnpm with-env <command>

# Build & Quality
pnpm build:console                        # Next.js build
pnpm build:relay / build:gateway / build:backfill  # Vercel CLI builds
pnpm lint && pnpm typecheck

# Database (run from db/console/)
pnpm db:generate      # NEVER write manual .sql files
pnpm db:migrate
pnpm db:studio
```

Note: ngrok, inngest and upstash workflow automatically runs with `pnpm dev:app`. You can test ngrok connection with `ps aux | grep ngrok | grep -v grep`

## Key Rules

1. **Vendor abstractions**: Standalone re-exports of third-party SDKs. Never import `@planetscale/*` directly → use `@vendor/db`
2. **Workspace protocol**: Use `workspace:*` for internal deps, `catalog:` for shared externals
3. **tRPC pattern**: `prefetch()` BEFORE `<HydrateClient>` to avoid UNAUTHORIZED errors
4. **Background jobs**: Inngest workflows in `api/console/src/inngest/workflow/`
5. **Hono services**: All use srvx + Hono, edge runtime, shared middleware via `@vendor/observability`

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
pnpm --filter @api/console build       # tRPC type errors
```

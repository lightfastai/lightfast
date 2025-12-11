# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

See `SPEC.md` for business goals and product vision.

**Lightfast** is a pnpm monorepo (Turborepo) for building AI agent orchestration tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ apps/console (4107)  →  @api/console (tRPC)  →  @db/console (Drizzle)       │
│        ↓                      ↓                                             │
│   Next.js 15            Inngest Workflows  →  PlanetScale + Pinecone        │
│   App Router                  ↓                                             │
│                         GitHub Webhooks                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Packages: @repo/* (ui, lib, ai)  |  @repo/console-* (14 packages)  |  @vendor/* (db, clerk, upstash)
```

### Vercel Microfrontends (lightfast.ai)

All 4 apps (console, www, auth, docs) served through single domain via `apps/console/microfrontends.json`.
Console is default app (catch-all routes, sitemap.xml, robots.txt).

Note: `apps/chat` (4106) is independent, not part of microfrontends.

### tRPC Auth Boundaries
- **userRouter**: No org required (account, apiKeys, sources)
- **orgRouter**: Org membership required (workspace, search, jobs)
- **m2mRouter**: Internal services only (Inngest, webhooks)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build)
pnpm dev:app      # Port 3024 - through vercel microfrontends 
pnpm dev:www          # Port 4101 - e.g stadanlone app marketing

# Run dev server in background (for Claude Code sessions)
pnpm dev:console > /tmp/console-dev.log 2>&1 &
tail -f /tmp/console-dev.log  # Follow logs
pkill -f "next dev"           # Kill all dev servers

# Environment variables (MUST run from apps/<app>/ directory)
cd apps/console && pnpm with-env <command>

# Build & Quality
pnpm build:console
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

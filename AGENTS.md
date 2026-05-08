# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Repository Overview

See `SPEC.md` for business goals and product vision.

**Lightfast** is a pnpm monorepo (Turborepo) for building AI agent orchestration tools.

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Local dev — Portless HTTPS aggregate (port 443)                                 │
│  https://[<wt>.]lightfast.localhost                                              │
│      │                                                                           │
│      ├─ app   https://[<wt>.]app.lightfast.localhost   (raw :4107)               │
│      │       @api/app · tRPC + Inngest · auth + Server Actions · default MFE     │
│      │       tRPC CORS dev: portless wildcard + localhost:* (desktop, Bearer)    │
│      │                                                                           │
│      └─ www   https://[<wt>.]www.lightfast.localhost   (raw :4101)               │
│              marketing + docs (fumadocs MDX) · marketing-group MFE               │
│                                                                                  │
│  platform   http://localhost:4112   (raw; not on Portless / MFE)                 │
│             Empty Next.js host (post-v2 reset). Reserved for future              │
│             platform-side workflows. /api/{health,inngest,trpc/[trpc]} only.     │
│                                                                                  │
│  desktop    Electron (Vite SPA) · LIGHTFAST_APP_ORIGIN → aggregate above         │
│             renderer Origin = localhost:<vite>, admitted on app via Bearer       │
│                                                                                  │
│              @db/app (Drizzle)  ·  @vendor/upstash (Redis)                       │
└──────────────────────────────────────────────────────────────────────────────────┘

Packages: @repo/* (ui, lib, ai)  |  @vendor/* (Drizzle, Clerk, Inngest, etc.)
```

### Vercel Microfrontends (lightfast.ai)

2 apps (app, www) served through single domain via `apps/app/microfrontends.json`.
App is default app (catch-all routes, sitemap.xml, robots.txt, auth routes).
Auth routes (/sign-in, /sign-up, /early-access) are served directly by app (migrated from former apps/auth).
Docs served via microfrontends mesh through `lightfast-www` (`/docs`, `/docs/:path*` routes in `apps/app/microfrontends.json`).

### tRPC Auth Boundaries

- **userScopedProcedure**: Clerk-pending or Clerk-active session (account, organization listing/create/rename)
- **orgScopedProcedure**: Clerk-active org membership required (orgApiKeys list/create/revoke/delete/rotate)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build)
pnpm dev              # Full stack: app + www + platform (host-keyed ports via portless on :443)
pnpm dev:full         # Alias of pnpm dev (kept for back-compat)
pnpm dev:app          # App only
pnpm dev:www          # Marketing + docs site
pnpm dev:platform     # Platform service

# Run dev server in background (for Codex sessions)
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

Note: `pnpm dev:app` does NOT auto-start ngrok or Inngest. Start them explicitly with `pnpm dev:ngrok` and `pnpm dev:inngest` (or `pnpm dev:services` for both). See `CLAUDE.md` for the canonical reference.

## Key Rules

1. **Vendor abstractions**: Standalone re-exports of third-party SDKs. Never import `@planetscale/*` directly → use `@vendor/db`
2. **Workspace protocol**: Use `workspace:*` for internal deps, `catalog:` for shared externals
3. **tRPC pattern**: `prefetch()` BEFORE `<HydrateClient>` to avoid UNAUTHORIZED errors
4. **Background jobs**: Inngest workflows in `api/app/src/inngest/workflow/` and `api/platform/src/inngest/`

## Environment

- **Node.js** >= 22.0.0 | **pnpm** 10.32.1 (pinned via `packageManager` in root `package.json` — that's the source of truth)
- **Env files**: `apps/<app>/.vercel/.env.development.local`

## Troubleshooting

```bash
pkill -f "next dev"                    # Port in use
pnpm clean:workspaces && pnpm install  # Module not found
pnpm --filter @api/app build       # tRPC type errors (api layer stays @api/app)
```

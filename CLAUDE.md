# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

See `SPEC.md` for business goals and product vision.

**Lightfast** is a pnpm monorepo (Turborepo) for building AI agent orchestration tools.

## Architecture

```
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
│             @api/platform · OAuth, webhooks, backfill, neural pipeline           │
│             tRPC CORS dev: portless wildcard                                     │
│                                                                                  │
│  desktop    Electron (Vite SPA) · LIGHTFAST_APP_ORIGIN → aggregate above         │
│             renderer Origin = localhost:<vite>, admitted on app via Bearer       │
│                                                                                  │
│              @db/app (Drizzle)  ·  @vendor/upstash (Redis)                       │
│                                                                                  │
│  Source of truth                                                                 │
│  ─────────────────                                                               │
│  Mesh:       microfrontends.json (root)                                          │
│  Portless:   lightfast.dev.json (root)  ·  per-app: package.json "portless"      │
│  Wrap:       all 3 Next configs use withPortlessProxy(...)                       │
│  Origins:    apps/{app,platform}/src/lib/origin-allowlist.ts                     │
│              throws in dev if appUrl falls back to https://lightfast.ai          │
│                                                                                  │
│  Worktree    [<wt>.] = sanitized last branch segment in a secondary git          │
│              worktree on a non-main branch; empty on primary / on main / master. │
│              Print current value: node scripts/with-desktop-env.mjs --print      │
└──────────────────────────────────────────────────────────────────────────────────┘

Packages: @repo/* (ui, lib, ai)  |  @repo/app-* (23)  |  @vendor/* (18)
```

## tRPC Auth Boundaries

- **userRouter**: No org required (account, apiKeys, sources)
- **orgRouter**: Org membership required (workspace, search, jobs)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build).
# Worktree-prefixed URLs: see Architecture diagram above.
pnpm dev:full         # app + www + platform
pnpm dev              # app + www only
pnpm dev:app          # app only
pnpm dev:www          # www only
pnpm dev:platform     # platform only
pnpm dev:desktop      # Electron (LIGHTFAST_APP_ORIGIN auto-points at aggregate)

# Optional dev services
pnpm dev:inngest      # local Inngest dev server (dev:* sync MFE app URLs into it)
pnpm dev:services     # Inngest + Drizzle Studio
pnpm dev:studio       # Drizzle Studio (127.0.0.1:4983)
pnpm dev:ngrok        # ngrok tunnel (port 3024, legacy)
pnpm dev:email        # email template dev

# Local containerized services (Docker)
pnpm dev:setup        # provision Postgres + Redis containers, then db:migrate
pnpm dev:doctor       # health-check dev services
pnpm db:up            # start dev Postgres
pnpm db:create        # create dev DB (idempotent)
pnpm db:url           # print DATABASE_URL
pnpm redis:up         # start dev Redis (with Upstash REST proxy)
pnpm redis:ping
pnpm redis:url

# Background dev (Claude Code)
pnpm dev:app > /tmp/console-dev.log 2>&1 &
tail -f /tmp/console-dev.log
pkill -f "next dev"

# Env (MUST run from apps/<app>/)
cd apps/app && pnpm with-env <command>

# Build & quality
pnpm build:app && pnpm build:platform
pnpm check && pnpm typecheck

# Database (run from db/app/)
pnpm db:generate      # NEVER write manual .sql files
pnpm db:migrate
pnpm db:studio
```

`pnpm dev{,:app,:platform,:full}` register MFE app URLs with the local Inngest dev server (when running) via `scripts/dev-services.mjs inngest-sync`. They do not start Inngest or ngrok automatically.

## Key Rules

1. **Vendor abstractions**: Standalone re-exports of third-party SDKs. Never import `@planetscale/*` directly → use `@vendor/db`
2. **Workspace protocol**: Use `workspace:*` for internal deps, `catalog:` for shared externals
3. **tRPC pattern**: `prefetch()` BEFORE `<HydrateClient>` to avoid UNAUTHORIZED errors
4. **Background jobs**: Inngest workflows in `api/app/src/inngest/workflow/` and `api/platform/src/inngest/`

## Environment

- **Node.js** ≥ 22.0.0 | **pnpm** 10.32.1 (pinned via `packageManager` in root `package.json`)
- **Env files**: `apps/<app>/.vercel/.env.development.local`
- **Dev-services scripts** (`scripts/`):
  - `dev-services.mjs` — Postgres + Redis containers; Inngest MFE-URL sync.
  - `with-dev-services-env.mjs` — injects DB/Redis env from those containers; bypass with `LIGHTFAST_DEV_SERVICES=0`.
  - `with-desktop-env.mjs` — injects `LIGHTFAST_APP_ORIGIN`; `--print` echoes the current aggregate URL.

## Troubleshooting

```bash
pkill -f "next dev"                    # Port in use
pnpm clean:workspaces && pnpm install  # Module not found
pnpm --filter @api/app build           # tRPC type errors (api layer stays @api/app)
pnpm dev:doctor                        # local Postgres / Redis container health check
docker ps | grep lightfast             # confirm dev-services containers are up
```

If `https://lightfast.localhost` won't resolve, confirm Portless is running — check the `lightfast-dev proxy` process started by `pnpm dev:*`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

See `SPEC.md` for business goals and product vision.

**Lightfast** is a pnpm monorepo (Turborepo) for building AI agent orchestration tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Local dev entrypoint — Portless HTTPS aggregate (port 443)                     │
│  https://[<worktree>.]lightfast.localhost                                       │
│      │                                                                          │
│      ├─ app → https://[<worktree>.]app.lightfast.localhost  (raw :4107)         │
│      │      @api/app · tRPC + Inngest · auth + Server Actions · default MFE     │
│      └─ www → https://[<worktree>.]www.lightfast.localhost  (raw :4101)         │
│             marketing + docs (fumadocs MDX) · marketing-group MFE               │
│                                                                                 │
│  platform → http://localhost:4112  (raw backend; not yet on Portless / MFE)     │
│  @api/platform · tRPC + Inngest · OAuth, webhooks, backfill, neural pipeline    │
│                                                                                 │
│                          @db/app (Drizzle)                                      │
│                          @vendor/upstash (Redis)                                │
└─────────────────────────────────────────────────────────────────────────────────┘

Packages: @repo/* (ui, lib, ai)  |  @repo/app-* (23)  |  @vendor/* (18)

`[<worktree>.]` is empty on the primary checkout (any branch) and on `main` /
`master` even in a secondary worktree. In a secondary git worktree on a non-main
branch it becomes the sanitized last segment of the branch name (e.g.
`desktop-portless-runtime-batch` → `https://desktop-portless-runtime-batch.lightfast.localhost`).
Print the current value with `node scripts/with-desktop-env.mjs --print`.
```

### Vercel Microfrontends (lightfast.ai)

Two apps (`app`, `www`) served through a single domain. Mesh definition lives in the repo-root `microfrontends.json`. App is the default owner — catch-all routes, auth routes (`/sign-in`, `/sign-up`, `/early-access`, migrated from former `apps/auth`). www owns the `marketing` group: marketing pages, `/docs`, `/docs/:path*`, `/blog/*`, `/changelog/*`, `/legal/*`, `/integrations/*`, `/use-cases/*`, `/company/*`, `/careers`, `/api/health`, `/api/search`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/manifest.{webmanifest,json}`, fonts, images, favicons, OG images.

**Production**: Vercel Microfrontends serves the mesh on `lightfast.ai`. Each MFE app's `microfrontends.json` entry sets `development.fallback: https://lightfast.ai` so unwired routes resolve to prod.

**Local dev**: Portless reads the same `microfrontends.json` and exposes a single HTTPS aggregate at `https://[<worktree>.]lightfast.localhost`, proxying to per-app raw ports (app `:4107`, www `:4101`). Config is at repo-root `lightfast.dev.json` (`name: "lightfast"`, `port: 443`, `https: true`). Per-app subdomains come from each app's `package.json` `"portless"` field (`apps/app/package.json:7` → `app.lightfast`; `apps/www/package.json:7` → `www.lightfast`). `apps/app/next.config.ts` and `apps/www/next.config.ts` wrap with `withPortlessProxy(withMicrofrontends(config))` so HMR + Server Actions accept the `*.lightfast.localhost` family. App passes `{ serverActions: isLocalDev }` because it owns the auth + tRPC + Server Actions surface. See **Local Origins Policy** below for the per-app wrapper / CORS table.

**Worktree-aware hosts**: `@lightfastai/dev-proxy` detects when the cwd is inside a *secondary* git worktree (multi-worktree repo, gitdir ≠ common-dir, branch ≠ `main` / `master` / `HEAD`). When all three hold, the sanitized last segment of the branch name is prepended to every Portless host: aggregate becomes `https://<prefix>.lightfast.localhost`, app becomes `https://<prefix>.app.lightfast.localhost`, www becomes `https://<prefix>.www.lightfast.localhost`. The prefix is empty on the primary checkout (any branch) and on `main` / `master` even in a secondary worktree, so day-to-day work on the main checkout still hits the bare `https://lightfast.localhost`. The same resolver feeds Next's HMR + Server Actions allowedOrigins, the `inngest-sync` MFE-URL registration (`scripts/dev-services.mjs`), the app's `wwwUrl` / `platformUrl` resolver (`apps/app/src/lib/related-projects.ts`), and the desktop renderer's `LIGHTFAST_APP_ORIGIN` (`scripts/with-desktop-env.mjs`) — so cross-app rewrites and the Electron renderer stay coherent inside a worktree without manual env overrides. Print the current value with `node scripts/with-desktop-env.mjs --print`.

### Local Origins Policy (`*.lightfast.localhost`)

Local dev runs through Portless behind `*.lightfast.localhost:443`. Multi-worktree isolation is provided by the wildcard alone — branches resolve to `<prefix>.app.lightfast.localhost` automatically. Source-of-truth: `lightfast.dev.json` (portless config) + `microfrontends.json` (mesh members).

**Next.js consumers** — helpers from `@lightfastai/dev-proxy/next`:

| App | Wrapper | Surface | Server Actions |
|---|---|---|---|
| `apps/app` | `withPortlessProxy(..., { serverActions: isLocalDev })` | `allowedDevOrigins` + `experimental.serverActions.allowedOrigins` | yes |
| `apps/www` | `withPortlessProxy(...)` | `allowedDevOrigins` only | n/a (no Server Actions) |
| `apps/platform` | `withPortlessProxy(...)` | `allowedDevOrigins` only | n/a (no Server Actions) |

**Non-Next consumer** — `apps/desktop`:

The Electron renderer is a Vite SPA, not a Next app, and does not load any `next.config.ts`. It still participates in the origin world via `scripts/with-desktop-env.mjs`, which imports `resolvePortlessMfeUrl` from `@lightfastai/dev-proxy` (root export, not `/next`) and injects `LIGHTFAST_APP_ORIGIN` into the Electron main process at boot. The renderer reads that origin off `window.lightfastBridge.appOrigin` and aims its tRPC client at `${appOrigin}/api/trpc`. CORS is gated by `apps/app/.../route.ts` — the renderer's actual `Origin` header in dev is `http://localhost:<vite-port>`, admitted via an explicit desktop carve-out (Bearer-token auth, not cookies, so the broad localhost match doesn't weaken security).

**tRPC CORS allowlists** (both apps share `~/lib/origin-allowlist.ts` — same code, copied per-app):

| Surface | Dev (NEXT_PUBLIC_VERCEL_ENV=undefined) | Preview / Prod |
|---|---|---|
| `apps/app/.../route.ts` | portless wildcard set + `localhost:*` (desktop renderer) | canonical `appUrl` only |
| `apps/platform/.../route.ts` | portless wildcard set | canonical `appUrl` only |

`canonicalAppOrigin = new URL(appUrl).origin` strips the trailing slash that `resolvePortlessUrl` adds (the bug that made strict equality silently fail in dev pre-fix).

**Cold-start guard**: in dev, if `appUrl` resolves to `https://lightfast.ai` (production fallback when portless daemon is down at module load), the origin-allowlist module throws at import time. Boot platform/app only after `portless start` (or via `pnpm dev:full`). The guard is skipped during `next build` (NEXT_PHASE includes `build`) so production builds don't require portless.

### Platform Service

Standalone Next.js app (`apps/platform`, port 4112) that consolidates the former relay, gateway, and backfill Hono microservices into a single tRPC + Inngest service.
Handles: OAuth flows, token vault, connection lifecycle, webhook ingestion, backfill orchestration, and neural pipeline (event capture → entity upsert → graph).
Domain: `platform.lightfast.ai`.

**Not yet on Portless / MFE.** `apps/platform` is intentionally absent from `microfrontends.json` and has no `"portless"` field in its `package.json`. It runs as a raw service on `http://localhost:4112` in dev. The app reaches it via Next rewrites (`/api/connect/*`, `/api/ingest/*`) using `platformUrl` from `apps/app/src/lib/related-projects.ts`, which falls back to `http://localhost:4112` locally and uses Vercel `VERCEL_RELATED_PROJECTS` in previews / prod. Its `next.config.ts` is still wrapped with `withPortlessProxy(...)` so HMR `allowedDevOrigins` covers `*.lightfast.localhost`, but it is not part of the MFE aggregate.

### tRPC Auth Boundaries
- **userRouter**: No org required (account, apiKeys, sources)
- **orgRouter**: Org membership required (workspace, search, jobs)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build)
# URLs below show the main-checkout form. In a secondary git worktree on a
# non-main branch every Portless host is prefixed with the sanitized last
# segment of the branch name (e.g. branch feat/team/login-fix →
# https://login-fix.lightfast.localhost). Run
# `node scripts/with-desktop-env.mjs --print` to see the current aggregate URL.
pnpm dev:full         # app + www + platform; opens https://lightfast.localhost (Portless aggregate)
pnpm dev              # app + www only (no platform); same aggregate URL
pnpm dev:app          # app only, behind Portless at https://app.lightfast.localhost (raw :4107)
pnpm dev:www          # www only, behind Portless at https://www.lightfast.localhost (raw :4101)
pnpm dev:platform     # platform only, raw http://localhost:4112 (not on Portless aggregate)
pnpm dev:desktop      # Electron app; LIGHTFAST_APP_ORIGIN auto-points at the (worktree-correct) Portless aggregate

# Optional dev services (run in separate terminals as needed)
pnpm dev:inngest      # local Inngest dev server (dev / dev:app / dev:platform / dev:full sync MFE app URLs into it)
pnpm dev:services     # Inngest + Drizzle Studio together
pnpm dev:studio       # Drizzle Studio only (127.0.0.1:4983)
pnpm dev:ngrok        # ngrok tunnel; defaults to port 3024 (legacy)
pnpm dev:email        # email template dev (turbo dev:email -F @lightfast/www)

# Local containerized services (Docker)
pnpm dev:setup        # provision dev Postgres + Redis containers, then run pnpm db:migrate
pnpm dev:doctor       # health-check dev services
pnpm db:up            # start dev Postgres
pnpm db:create        # create the dev database (idempotent)
pnpm db:url           # print resolved DATABASE_URL
pnpm redis:up         # start dev Redis (with Upstash REST proxy container)
pnpm redis:ping       # ping the dev Redis REST endpoint
pnpm redis:url        # print resolved Upstash REST URL

# Run dev server in background (for Claude Code sessions)
pnpm dev:app > /tmp/console-dev.log 2>&1 &
tail -f /tmp/console-dev.log  # Follow logs
pkill -f "next dev"           # Kill all dev servers

# Environment variables (MUST run from apps/<app>/ directory)
cd apps/app && pnpm with-env <command>
# `with-env` for apps/app and apps/platform chains:
#   dotenv -e ./.vercel/.env.development.local -- node ../../scripts/with-dev-services-env.mjs --
# (injects local Postgres + Upstash Redis env vars from the dev containers)
# apps/www's `with-env` is dotenv-only — it doesn't need DB/Redis at runtime.

# Build & Quality
pnpm build:app                            # Next.js build
pnpm build:platform                       # Platform service build
pnpm check && pnpm typecheck

# Database (run from db/app/)
pnpm db:generate      # NEVER write manual .sql files
pnpm db:migrate
pnpm db:studio
```

Note: `pnpm dev`, `dev:app`, `dev:platform`, and `dev:full` register MFE app URLs with the local Inngest dev server (when running) via `scripts/dev-services.mjs inngest-sync`. They do NOT start Inngest or ngrok automatically — run `pnpm dev:inngest` / `pnpm dev:ngrok` when you need them.

## Key Rules

1. **Vendor abstractions**: Standalone re-exports of third-party SDKs. Never import `@planetscale/*` directly → use `@vendor/db`
2. **Workspace protocol**: Use `workspace:*` for internal deps, `catalog:` for shared externals
3. **tRPC pattern**: `prefetch()` BEFORE `<HydrateClient>` to avoid UNAUTHORIZED errors
4. **Background jobs**: Inngest workflows in `api/app/src/inngest/workflow/` and `api/platform/src/inngest/`

## Environment

- **Node.js** >= 22.0.0 | **pnpm** 10.32.1 (pinned via `packageManager` in root `package.json` — that's the source of truth)
- **Env files**: `apps/<app>/.vercel/.env.development.local`

### Local Dev Services

Three repo-root scripts wrap dev commands so app env + Portless URLs Just Work. You usually don't invoke them directly — they're chained from `with-env` and `dev:*`. Read the source for the full env-var list.

| Script | What it does | Fires from |
|---|---|---|
| `scripts/dev-services.mjs` | Manages local Postgres + Redis containers; registers MFE app URLs with the Inngest dev server. | `pnpm dev`, `dev:app`, `dev:platform`, `dev:full`, `dev:setup`, `dev:doctor`, `db:*`, `redis:*` |
| `scripts/with-dev-services-env.mjs` | Injects `DATABASE_*` / Upstash Redis env vars (`KV_*`, `UPSTASH_REDIS_REST_*`, `REDIS_URL`) from those local containers. | `pnpm with-env` for `apps/app` and `apps/platform` (apps/www's `with-env` is dotenv-only) |
| `scripts/with-desktop-env.mjs` | Injects `LIGHTFAST_APP_ORIGIN` pointing at the (worktree-correct) Portless aggregate. | `apps/desktop`'s `dev` script. `--print` echoes the resolved URL. |

Escape hatch: `LIGHTFAST_DEV_SERVICES=0` (or `false` / `off`) makes `with-dev-services-env.mjs` pass through your `.vercel/.env.development.local` unchanged — use it when you want to point a local app at staging Postgres / Upstash.

## Troubleshooting

```bash
pkill -f "next dev"                    # Port in use
pnpm clean:workspaces && pnpm install  # Module not found
pnpm --filter @api/app build           # tRPC type errors (api layer stays @api/app)
pnpm dev:doctor                        # local Postgres / Redis container health check
docker ps | grep lightfast             # confirm dev-services containers are up
```

If `https://lightfast.localhost` won't resolve, confirm Portless is running — check the `lightfast-dev proxy` process started by `pnpm dev:*`.

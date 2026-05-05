# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

See `SPEC.md` for business goals and product vision.

**Lightfast** is a pnpm monorepo (Turborepo) for building AI agent orchestration tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Next.js Apps                                                                   │
│  ┌──────────────────┐  ┌────────────────────────────────────┐                  │
│  │ app (4107)       │  │ www (4101)                         │                  │
│  │ @api/app     │  │ marketing + docs (fumadocs MDX)    │                  │
│  │ tRPC + Inngest   │  │ CMS                                │                  │
│  │ + auth routes    │  │                                    │                  │
│  └───────┬──────────┘  └────────────────────────────────────┘                  │
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
Docs served via microfrontends mesh through `lightfast-www` (`/docs`, `/docs/:path*` routes in `apps/app/microfrontends.json`).

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

### tRPC Auth Boundaries
- **userRouter**: No org required (account, apiKeys, sources)
- **orgRouter**: Org membership required (workspace, search, jobs)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build)
pnpm dev:full         # Full stack: app + www + platform (port 3024 via microfrontends)
pnpm dev:app          # App only (4107)
pnpm dev:www          # Marketing + docs site (4101)
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

- **Node.js** >= 22.0.0 | **pnpm** 10.32.1 (pinned via `packageManager` in root `package.json` — that's the source of truth)
- **Env files**: `apps/<app>/.vercel/.env.development.local`

## Troubleshooting

```bash
pkill -f "next dev"                    # Port in use
pnpm clean:workspaces && pnpm install  # Module not found
pnpm --filter @api/app build       # tRPC type errors (api layer stays @api/app)
```

<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

See `SPEC.md` for business goals and product vision.

**Lightfast** is a pnpm monorepo (Turborepo) for building AI agent orchestration tools.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Canonical local browser URL (port 443)                                          │
│  https://[<wt>.]lightfast.localhost                                              │
│  Vercel Microfrontends aggregate served by @lightfast/app#mfe:proxy              │
│                                                                                  │
│  Direct Portless service routes                                                  │
│      app       https://[<wt>.]app.lightfast.localhost                            │
│                @api/app · tRPC + Inngest · auth + Server Actions · default MFE   │
│                tRPC CORS dev: exact env origins + desktop localhost via Bearer   │
│      www       https://[<wt>.]www.lightfast.localhost                            │
│                marketing + docs (fumadocs MDX) · marketing-group MFE             │
│      platform  https://[<wt>.]platform.lightfast.localhost                       │
│                Empty Next.js host (post-v2 reset). /api/{health,inngest,trpc}.   │
│                tRPC CORS dev: exact env origins                                  │
│      inngest   https://[<wt>.]inngest.lightfast.localhost                        │
│      qstash    https://[<wt>.]qstash.lightfast.localhost                         │
│      db        https://[<wt>.]db.lightfast.localhost                             │
│                Drizzle Studio local API via @db/app#db:studio                    │
│                                                                                  │
│  desktop    Electron (Vite SPA) · APP_URL=$(portless get lightfast)              │
│             opens the aggregate MFE URL in dev                                   │
│             renderer Origin = localhost:<vite>, admitted on app via Bearer       │
│                                                                                  │
│              @db/app (Drizzle)  ·  @vendor/upstash (Redis)                       │
│                                                                                  │
│  Source of truth                                                                 │
│  ─────────────────                                                               │
│  Mesh:       apps/app/microfrontends.json                                        │
│  Portless:   per-app portless.json + package.json "portless" names               │
│  Ports:      derived per-worktree from (host, appName) — no manual pinning       │
│  Origins:    apps/{app,www,platform}/src/origins.ts                              │
│  CORS:       apps/{app,platform}/src/cors.ts                                     │
│              throws in dev if appUrl falls back to https://lightfast.ai          │
│                                                                                  │
│  Worktree    [<wt>.] = sanitized last branch segment in a secondary git          │
│              worktree on a non-main branch; empty on primary / on main / master. │
└──────────────────────────────────────────────────────────────────────────────────┘

Packages: @repo/* (ui, lib, ai)  |  @repo/app-* (23)  |  @vendor/* (18)
```

## tRPC Auth Boundaries

- **userScopedProcedure**: Clerk-pending or Clerk-active session (account, organization listing/create/rename)
- **orgScopedProcedure**: Clerk-active org membership required (orgApiKeys list/create/revoke/delete/rotate)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build).
# Worktree-prefixed URLs: see Architecture diagram above.
pnpm dev              # app + www + platform + local Inngest + local QStash + MFE aggregate

# Local infrastructure setup
# Load the lightfast-local-infra skill for PlanetScale DB / Upstash Redis setup.
# It writes durable credentials to apps/*/.vercel/.env.development.local.

# Agent dev (preferred; logs stay in the active terminal/session, no tail needed)
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color

# Background dev (only when you need the prompt back; tail is optional)
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color > /tmp/console-dev.log 2>&1 &
tail -n 200 /tmp/console-dev.log  # inspect recent logs
tail -f /tmp/console-dev.log      # follow live logs when needed
pkill -f "next dev"

# Env (MUST run from apps/<app>/)
cd apps/app && pnpm with-env <command>

# Build & quality
pnpm build:app && pnpm build:platform
pnpm check && pnpm typecheck

# Database
pnpm db:generate      # NEVER write manual .sql files
pnpm db:migrate
pnpm db:studio        # starts Drizzle Studio through Portless
```

`pnpm dev` is the only root local-dev entrypoint. It starts app, www, platform, local Inngest, local QStash, and the Portless-backed Vercel Microfrontends aggregate for `https://lightfast.localhost`. Direct Portless routes are still used for service registration and project URL injection: Inngest serve URLs use `portless get app.lightfast` and `portless get platform.lightfast`, and `NEXT_PUBLIC_*`, `INNGEST_DEV`, and `QSTASH_URL` values use the concrete service URLs. It does not start ngrok automatically.

## Next.js Agent Diagnostics

- Next.js DevTools MCP is configured in `.mcp.json` as `next-devtools`. With `pnpm dev` running, prefer MCP queries for current build/runtime errors, logs, route metadata, and project metadata before guessing from terminal output alone.
- `logging.browserToTerminal` is enabled in `@vendor/next/config`, so browser console output is forwarded into dev-server logs with source locations. Prefer the foreground `pnpm dev --ui=stream ...` command above when an agent needs live browser and server context.
- Next.js 16 writes dev output to `.next/dev`, so agents can run `next build`-backed validation while `next dev` is still running without clobbering the dev server output.
- Run focused Next.js diagnostics from the relevant app directory with `pnpm with-env`; replace `apps/app` with `apps/www` or `apps/platform` as needed:

```bash
cd apps/app && pnpm with-env next typegen
cd apps/app && pnpm with-env next build --debug
cd apps/app && pnpm with-env next build --debug-prerender
cd apps/app && pnpm with-env next experimental-analyze --output
cd apps/app && pnpm with-env next dev --experimental-cpu-prof
cd apps/app && NEXT_TURBOPACK_TRACING=1 pnpm with-env next dev
```

Use `next dev --inspect` only for focused single-app server debugging; avoid adding it to the root `pnpm dev` flow because multiple Next apps can collide on inspector ports.

Drizzle Studio is started on demand with `pnpm db:studio`. Its local API is routed through Portless at `https://[<wt>.]db.lightfast.localhost`; Drizzle's printed `https://local.drizzle.studio?port=...` URL uses the Portless-injected backend port for that process.

## Next Dev Origin Handling

`.localhost` routes are handled directly by Next/Portless. Do not reintroduce the legacy dev-proxy wrapper for local dev origins. Use direct env URLs at the boundary that needs them:

- **CORS**: `new URL(url).origin`
- **Server Actions**: `new URL(url).host`
- **Links/redirects**: URL string

## Key Rules

1. **Vendor abstractions**: Standalone re-exports of third-party SDKs. Never import `@planetscale/*` directly → use `@vendor/db`
2. **Workspace protocol**: Use `workspace:*` for internal deps, `catalog:` for shared externals
3. **tRPC pattern**: `prefetch()` BEFORE `<HydrateClient>` to avoid UNAUTHORIZED errors
4. **Background jobs**: Inngest workflows in `api/app/src/inngest/workflow/` and `api/platform/src/inngest/`

## Environment

- **Node.js** ≥ 22.13.0 | **pnpm** 11.1.3 (pinned via `packageManager` in root `package.json`)
- **Env files**: `apps/<app>/.vercel/.env.development.local`
- **Local DB/Redis**: skill-driven via `.agents/skills/lightfast-local-infra`; no root `db:up`, `redis:up`, `dev:setup`, or `dev:doctor` scripts.
- **Desktop env**: `APP_URL=$(portless get lightfast)` opens the aggregate MFE URL in dev.

## Troubleshooting

```bash
pkill -f "next dev"                    # Port in use
pnpm clean:workspaces && pnpm install  # Module not found
pnpm --filter @api/app build           # tRPC type errors (api layer stays @api/app)
# DB/Redis setup: load the lightfast-local-infra skill and run the relevant runbook
```

If `https://lightfast.localhost` won't resolve, confirm Portless is running — check the `portless proxy` process started by `pnpm dev`.

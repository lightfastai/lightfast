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

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Local dev — Portless HTTPS aggregate (port 443)                                 │
│  https://[<wt>.]lightfast.localhost                                              │
│      │                                                                           │
│      ├─ app   https://[<wt>.]app.lightfast.localhost   (raw :auto, host-keyed)   │
│      │       @api/app · tRPC + Inngest · auth + Server Actions · default MFE     │
│      │       tRPC CORS dev: portless wildcard + localhost:* (desktop, Bearer)    │
│      │                                                                           │
│      └─ www   https://[<wt>.]www.lightfast.localhost   (raw :auto, host-keyed)   │
│              marketing + docs (fumadocs MDX) · marketing-group MFE               │
│                                                                                  │
│  platform   https://[<wt>.]platform.lightfast.localhost   (raw :auto, non-MFE)   │
│             Empty Next.js host (post-v2 reset). /api/{health,inngest,trpc}.      │
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
│  Portless:   per-app portless.json + package.json "portless" names               │
│  Ports:      derived per-worktree from (host, appName) — no manual pinning       │
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

- **userScopedProcedure**: Clerk-pending or Clerk-active session (account, organization listing/create/rename)
- **orgScopedProcedure**: Clerk-active org membership required (orgApiKeys list/create/revoke/delete/rotate)

## Development Commands

```bash
# Dev servers (NEVER use global pnpm build).
# Worktree-prefixed URLs: see Architecture diagram above.
pnpm dev              # app + www + platform + local Inngest + MFE proxy

# Local infrastructure setup
# Load the lightfast-local-infra skill for PlanetScale DB / Upstash Redis setup.
# It writes durable credentials to apps/*/.vercel/.env.development.local.

# Background dev (Claude Code)
pnpm dev > /tmp/console-dev.log 2>&1 &
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

`pnpm dev` is the only root local-dev entrypoint. It starts app, www, platform, local Inngest, and the Portless-backed Vercel microfrontends proxy for `https://lightfast.localhost`. Inngest uses explicit concrete serve URLs from `portless get app.lightfast` and `portless get platform.lightfast`; it does not sync through the aggregate MFE URL. It does not start ngrok automatically.

## Key Rules

1. **Vendor abstractions**: Standalone re-exports of third-party SDKs. Never import `@planetscale/*` directly → use `@vendor/db`
2. **Workspace protocol**: Use `workspace:*` for internal deps, `catalog:` for shared externals
3. **tRPC pattern**: `prefetch()` BEFORE `<HydrateClient>` to avoid UNAUTHORIZED errors
4. **Background jobs**: Inngest workflows in `api/app/src/inngest/workflow/` and `api/platform/src/inngest/`

## Environment

- **Node.js** ≥ 22.13.0 | **pnpm** 11.1.3 (pinned via `packageManager` in root `package.json`)
- **Env files**: `apps/<app>/.vercel/.env.development.local`
- **Local DB/Redis**: skill-driven via `.agents/skills/lightfast-local-infra`; no root `db:up`, `redis:up`, `dev:setup`, or `dev:doctor` scripts.
- **Desktop env**: `scripts/with-desktop-env.mjs` injects `LIGHTFAST_APP_ORIGIN`; `--print` echoes the current aggregate URL.

## Troubleshooting

```bash
pkill -f "next dev"                    # Port in use
pnpm clean:workspaces && pnpm install  # Module not found
pnpm --filter @api/app build           # tRPC type errors (api layer stays @api/app)
# DB/Redis setup: load the lightfast-local-infra skill and run the relevant runbook
```

If `https://lightfast.localhost` won't resolve, confirm Portless is running — check the `lightfast-dev proxy` process started by `pnpm dev`.

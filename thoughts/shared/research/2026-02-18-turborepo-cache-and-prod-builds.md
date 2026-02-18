---
date: 2026-02-18T08:18:56+0000
researcher: claude
git_commit: 260c0cc51c3b607e29f22b7ed4ecc728474448fb
branch: feat/search-perf-improvements
repository: lightfast-search-perf-improvements
topic: "Turborepo cache consistency and production build setup across all 5 apps"
tags: [research, codebase, turborepo, cache, build, vercel, nextjs, ci]
status: complete
last_updated: 2026-02-18
last_updated_by: claude
---

# Research: Turborepo Cache Consistency and Production Build Setup

**Date**: 2026-02-18T08:18:56+0000
**Researcher**: claude
**Git Commit**: 260c0cc51c3b607e29f22b7ed4ecc728474448fb
**Branch**: feat/search-perf-improvements
**Repository**: lightfast-search-perf-improvements

## Research Question

Can you investigate if ALL apps/chat, apps/auth, apps/console, apps/www, apps/docs is hitting the turborepo cache consistently and whether everything is setup for fast builds on prod too?

## Summary

All 5 apps (chat, auth, console, www, docs) are wired into Turborepo's task pipeline via a shared `turbo.json`. Each app's `build` script delegates to `pnpm build:prod`, which runs `next build --turbopack`. All 5 apps define `"ignoreCommand": "npx turbo-ignore"` in their `vercel.json`, enabling smart deploy skipping on Vercel. A local filesystem cache is active (`.turbo/cache/`). No remote cache is configured explicitly in the repository — no `.turbo/config.json` exists — but Vercel automatically injects remote cache credentials (`TURBO_TOKEN`, `TURBO_TEAM`) when building on its platform.

The GitHub Actions CI (`ci.yml`) runs only `lint` and `typecheck` — no `build` — and has no Turborepo remote cache configured. The `docs` app's `build:prod` script is unique: it chains the Next.js build with a mxbai search sync (`search:sync:ci`) as a single shell command, and defines a `prebuild` hook that generates OpenAPI docs before the build runs.

## Detailed Findings

### turbo.json — Global Cache Configuration

**File**: `turbo.json`

The root `turbo.json` defines the complete task pipeline:

- **`build` task** (`turbo.json:5-18`):
  - `dependsOn: ["^build"]` — builds workspace dependencies before the app itself
  - **Cached outputs**: `.cache/tsbuildinfo.json`, `dist/**`, `.next/**` (excluding `.next/cache/**`)
  - **Cache key inputs (env)**: `NEXT_PUBLIC_*`, `SENTRY_*`, `VERCEL_ENV`
  - These env vars directly affect the Turborepo hash — different values produce cache misses

- **`lint` and `typecheck` tasks** (`turbo.json:43-52`):
  - Both have `"env": []` (empty array), meaning env vars do NOT affect their cache keys
  - Both depend on `^build` (upstream deps must be built first)
  - Outputs: `.cache/.eslintcache` and `.cache/tsbuildinfo.json` respectively

- **`globalEnv`** (`turbo.json:79-82`): `NODE_ENV`, `CI` — these affect the cache key for ALL tasks

- **`globalPassThroughEnv`** (`turbo.json:83-179`): A large list (~60 env vars) including all secrets (Clerk, Sentry, Pinecone, OpenAI, etc.) — these are **passed through** to processes but do NOT affect cache keys. This is intentional so secrets don't bust the cache.

- **`dev` and all `dev:*` tasks**: `cache: false, persistent: true` — no caching for dev servers.

### Local Filesystem Cache

The `.turbo/cache/` directory contains many cache entries (`.tar.zst` compressed archives + `-meta.json` files per hash). This confirms local caching is actively working for `lint`, `typecheck`, and `build` tasks. No `.turbo/config.json` file exists at the project root.

### Remote Cache Status

- **No `.turbo/config.json`** — no explicit remote cache token/team configuration
- **No `TURBO_TOKEN` / `TURBO_TEAM`** in GitHub Actions workflows
- **Vercel automatic injection**: When deploying through Vercel's platform, Vercel automatically provides `TURBO_TOKEN` and `TURBO_TEAM` env vars to the build environment, enabling Vercel's built-in Turborepo Remote Cache. So remote caching IS active for Vercel deployments without needing manual configuration.
- **GitHub Actions CI**: Only pnpm's node_modules are cached (`cache: 'pnpm'` in `setup-node`). No Turborepo remote cache, so each CI run starts with a cold Turbo cache.

### apps/console — Build Configuration

**Files**: `apps/console/package.json`, `apps/console/vercel.json`, `apps/console/next.config.ts`

- `build = pnpm build:prod` → `pnpm with-env:prod next build --turbopack` (`package.json:8-9`)
- `with-env:prod` loads `.vercel/.env.development.local` via `dotenv -e`
- `vercel.json:3`: `"ignoreCommand": "npx turbo-ignore"`
- Part of Vercel microfrontends as the **default/catch-all app** (`microfrontends.json:4`)
- **Next.js config highlights** (`next.config.ts`):
  - `reactCompiler: true`
  - `optimizeCss: true`
  - `optimizePackageImports` with 30+ packages listed
  - `turbopackScopeHoisting: false`
  - `staleTimes: { dynamic: 30, static: 180 }`
  - `serverActions.bodySizeLimit: "2mb"`
  - `withMicrofrontends(config)` wrapping

### apps/www — Build Configuration

**Files**: `apps/www/package.json`, `apps/www/vercel.json`, `apps/www/next.config.ts`

- `build = pnpm build:prod` → `pnpm with-env:prod next build --turbopack` (`package.json:9`)
- `vercel.json:3`: `"ignoreCommand": "npx turbo-ignore"`
- Part of Vercel microfrontends serving marketing routes (`/`, `/pricing`, `/blog`, `/changelog`, etc.)
- **Next.js config highlights** (`next.config.ts`):
  - `reactCompiler: true`
  - `optimizeCss: true`
  - `optimizePackageImports` with 10 packages
  - `images.qualities: [10, 75, 100]` (Next.js 16 requirement)
  - `withMicrofrontends(config, { debug: true })` wrapping

### apps/auth — Build Configuration

**Files**: `apps/auth/package.json`, `apps/auth/vercel.json`, `apps/auth/next.config.ts`

- `build = pnpm build:prod` → `pnpm with-env:prod next build --turbopack` (`package.json:8-9`)
- `vercel.json:3`: `"ignoreCommand": "npx turbo-ignore"`
- Part of Vercel microfrontends serving auth routes (`/sign-in`, `/sign-up`)
- **Next.js config highlights** (`next.config.ts`):
  - `reactCompiler: true`
  - Fewer optimizations compared to console/www — no `optimizePackageImports`
  - `withMicrofrontends(config, { debug: true })` wrapping
  - Sentry only applied when `env.VERCEL` is truthy

### apps/chat — Build Configuration

**Files**: `apps/chat/package.json`, `apps/chat/vercel.json`, `apps/chat/next.config.ts`

- `build = pnpm build:prod` → `pnpm with-env:prod next build --turbopack` (`package.json:8-9`)
- `vercel.json:3`: `"ignoreCommand": "npx turbo-ignore"`
- **NOT part of Vercel microfrontends** — independent app on port 4106
- **Next.js config highlights** (`next.config.ts`):
  - Does NOT have `reactCompiler: true` — uses `compiler: { removeConsole: { exclude: ["error", "warn"] } }` in production instead
  - `optimizeCss: true`
  - `optimizePackageImports` with ~15 Radix UI and utility packages
  - `staticGenerationRetryCount: 3`, `staticGenerationMaxConcurrency: 8`
  - `staleTimes: { dynamic: 30, static: 180 }`
  - `turbopack.resolveAlias: { "~/*": "./src/*" }` and custom `resolveExtensions`
  - Sentry only applied when `env.VERCEL` is truthy
  - No `withMicrofrontends` wrapper

### apps/docs — Build Configuration

**Files**: `apps/docs/package.json`, `apps/docs/vercel.json`, `apps/docs/next.config.ts`

- `build = pnpm build:prod` → `pnpm with-env next build --turbopack && pnpm with-env pnpm search:sync:ci` (`package.json:10`)
- The `build` script **chains two commands**: Next.js build + mxbai search index sync
- `prebuild`: `pnpm --filter @repo/console-openapi generate:openapi && tsx scripts/validate-schema-docs.ts` (`package.json:11`) — runs before the main build
- `vercel.json:3`: `"ignoreCommand": "npx turbo-ignore"`
- Part of Vercel microfrontends but **NOT listed in `microfrontends.json`** — it's served via console's Next.js rewrites (`/docs → docsUrl/docs`)
- **Next.js config highlights** (`next.config.ts`):
  - `reactCompiler: true`
  - `assetPrefix: "/docs"` — assets served under `/docs` prefix since console proxies to docs
  - MDX processing via `fumadocs-mdx`
  - `images.formats: ["image/webp"]`, remote patterns for `imagedelivery.net`
  - Minimal `transpilePackages` list (only 6 packages)
  - No `optimizePackageImports`, no `staleTimes`
  - Sentry only applied when `env.VERCEL` is truthy

### Vercel Deployment — turbo-ignore Smart Deploy

All 5 `vercel.json` files (`apps/*/vercel.json`) contain:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "npx turbo-ignore"
}
```

`turbo-ignore` compares the current commit's dependency graph against the previously deployed commit. If neither the app nor any of its workspace dependencies changed, Vercel skips the deployment entirely. This prevents unnecessary rebuilds when only unrelated packages change.

### GitHub Actions CI

**Files**: `.github/workflows/ci.yml`, `.github/workflows/ci-core.yml`

- `ci.yml`: Runs `pnpm turbo lint` and `pnpm turbo typecheck` across all apps/packages/vendor/api
  - Uses `dorny/paths-filter` for change detection (`apps/**`, `packages/**`, `vendor/**`, `api/**`)
  - Node.js pnpm cache (`cache: 'pnpm'`) for node_modules
  - `SKIP_ENV_VALIDATION: "true"` to bypass env validation during CI
  - **No Turborepo remote cache** — no `TURBO_TOKEN`/`TURBO_TEAM` env vars
  - **No `build` job** — CI does not build the apps
- `ci-core.yml`: Handles the `core/lightfast` and `core/mcp` packages separately (lint, typecheck, test, build)

### Root Package Scripts

**File**: `package.json`

Per-app build shortcuts exist at root level:
- `build:www`, `build:auth`, `build:chat`, `build:console`, `build:docs` — each runs `turbo run build -F @lightfast/<app>`

## Code References

- `turbo.json:5-18` — Build task definition with outputs and env vars
- `turbo.json:79-82` — globalEnv affecting all task cache keys
- `turbo.json:83-179` — globalPassThroughEnv (secrets, not cache-busting)
- `apps/console/vercel.json:3` — `turbo-ignore` ignoreCommand
- `apps/console/next.config.ts:52-105` — Full Next.js experimental config with optimizations
- `apps/chat/next.config.ts:109-123` — Turbopack resolveAlias/resolveExtensions config
- `apps/docs/package.json:10` — `build:prod` chaining Next.js build + search sync
- `apps/docs/package.json:11` — `prebuild` generating OpenAPI docs before build
- `apps/docs/next.config.ts:30` — `assetPrefix: "/docs"`
- `apps/console/microfrontends.json` — Microfrontends topology (console, www, auth only)
- `.github/workflows/ci.yml:67-72` — Turbo lint command across all apps
- `.github/workflows/ci.yml:102-107` — Turbo typecheck command across all apps

## Architecture Documentation

### Cache Key Computation

Turborepo computes cache hashes from:
1. **Source files** of the workspace package
2. **Transitive dependency outputs** (via `^build`)
3. **`env` values** declared in `turbo.json` for the task: `NEXT_PUBLIC_*`, `SENTRY_*`, `VERCEL_ENV`
4. **`globalEnv` values**: `NODE_ENV`, `CI`
5. **Turbo version** (embedded in lockfile)

Secrets and runtime config in `globalPassThroughEnv` are forwarded to the build process but never included in the hash computation.

### Microfrontend vs. Independent App Topology

| App | Microfrontends | Port | Vercel Project |
|-----|---------------|------|----------------|
| console | Yes (default/catch-all) | 4107 | lightfast-console |
| www | Yes (marketing routes) | 4101 | lightfast-www |
| auth | Yes (sign-in/sign-up) | 4104 | lightfast-auth |
| chat | No (independent) | 4106 | Independent |
| docs | No (proxied via console rewrites) | 4105 | Independent, served via /docs |

### Docs Build Uniqueness

The `docs` build is the only one that:
1. Has a `prebuild` npm lifecycle hook (generates OpenAPI docs via `@repo/console-openapi`)
2. Chains the mxbai search index sync as part of the `build` script (`search:sync:ci`)
3. Has `assetPrefix: "/docs"` so all static assets are served under the `/docs` path prefix

### Build Script Consistency

All 5 apps follow the same pattern:
- `"build": "pnpm build:prod"`
- `"build:prod"` loads production env via `with-env:prod` (dotenv) then runs `next build --turbopack`

Exception: `docs` uses `pnpm with-env` (not `with-env:prod`) and appends `search:sync:ci`.

## Open Questions

- Whether `TURBO_TOKEN` and `TURBO_TEAM` are configured in Vercel project environment variables (not visible from the codebase alone) — this determines if Vercel Remote Cache is active for prod builds
- Whether the CI workflows intentionally skip `build` (to keep CI fast) or if build verification is delegated entirely to Vercel
- The `docs` `prebuild` runs `generate:openapi` which produces files — whether these generated files are included in Turbo's input hashing for the docs build task

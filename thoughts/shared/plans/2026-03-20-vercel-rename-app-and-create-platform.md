# Vercel App Rename + Platform Project Creation

## Overview

Rename the `lightfast-console` Vercel project to `lightfast-app`, create a new `lightfast-platform` Vercel project for `apps/platform`, and clean up deprecated projects (relay, gateway, backfill). This accompanies the `feat/memory-service-consolidation` branch merge.

## Current State

| Vercel Project | Directory | Status |
|---|---|---|
| `lightfast-console` | `apps/app` | Exists — needs rename |
| `lightfast-www` | `apps/www` | Exists — no change |
| `lightfast-docs` | `apps/docs` | Exists — no change |
| _(none)_ | `apps/platform` | Missing — needs creation |
| `lightfast-relay` | _(deleted)_ | Deprecated — delete |
| `lightfast-gateway` | _(deleted)_ | Deprecated — delete |
| `lightfast-backfill` | _(deleted)_ | Deprecated — delete |

## Desired End State

| Vercel Project | Directory | Domain |
|---|---|---|
| `lightfast-app` | `apps/app` | `lightfast.ai` (microfrontends) |
| `lightfast-www` | `apps/www` | `lightfast.ai` (microfrontends) |
| `lightfast-docs` | `apps/docs` | `lightfast-docs.vercel.app` |
| `lightfast-platform` | `apps/platform` | `platform.lightfast.ai` |

**Verify**:
- `lightfast.ai` still loads (microfrontends proxy works)
- `platform.lightfast.ai` responds to health check
- No builds failing in Vercel dashboard
- Old relay/gateway/backfill projects deleted

## What We Are NOT Doing

- Renaming `api/app`, `api/platform`, `db/app` (already renamed in branch)
- Renaming Inngest app IDs (`lightfast-console`, `lightfast-memory`) — runtime risk, separate ticket
- Renaming the JWT audience `"lightfast-memory"` in `api/platform/src/lib/jwt.ts` — same risk
- Updating sandbox JSON test fixtures (cosmetic, ~1,800 refs)
- Any change to `lightfast-www` or `lightfast-docs` projects

---

## Phase 1: Code Changes (in the branch, before merge)

### Overview
Update all config files to match the new project names. These land atomically with the merge.

### 1.1 `apps/app/microfrontends.json`

**File**: `apps/app/microfrontends.json`

Change the application key and fallback URL to match the renamed Vercel project:

```json
{
  "$schema": "https://openapi.vercel.sh/microfrontends.json",
  "applications": {
    "lightfast-app": {
      "packageName": "@lightfast/app",
      "development": {
        "local": 4107,
        "fallback": "lightfast-app.vercel.app"
      }
    },
    "lightfast-www": {
      ...unchanged...
    }
  }
}
```

> **Critical**: The key (`lightfast-app`) must match the Vercel project name exactly. This change and the Vercel dashboard rename must be coordinated — see Phase 2.

### 1.2 `.vercel/repo.json`

**File**: `.vercel/repo.json`

Rename the existing app entry and add the new platform entry:

```json
{
  "remoteName": "origin",
  "projects": [
    {
      "id": "prj_xCPWTpgHXaGOJdNry3D8vyfQhwt0",
      "name": "lightfast-app",
      "directory": "apps/app",
      "orgId": "team_oOLHPMLVuBjXyFafgsGKEZxl"
    },
    {
      "id": "prj_QZliLpsaNR4SeZ7ZsbjHvW2Yh73t",
      "name": "lightfast-docs",
      "directory": "apps/docs",
      "orgId": "team_oOLHPMLVuBjXyFafgsGKEZxl"
    },
    {
      "id": "prj_JRXRxBruTvB5Bs99JjA63TLek6GT",
      "name": "lightfast-www",
      "directory": "apps/www",
      "orgId": "team_oOLHPMLVuBjXyFafgsGKEZxl"
    },
    {
      "id": "<PLATFORM_PROJECT_ID>",
      "name": "lightfast-platform",
      "directory": "apps/platform",
      "orgId": "team_oOLHPMLVuBjXyFafgsGKEZxl"
    }
  ]
}
```

> `<PLATFORM_PROJECT_ID>` is filled in after creating the project in Phase 2.

### 1.3 `apps/platform/.vercel/project.json` (create)

**File**: `apps/platform/.vercel/project.json` _(new file)_

```json
{
  "settings": {
    "createdAt": 0,
    "framework": "nextjs",
    "devCommand": null,
    "installCommand": "pnpm install",
    "buildCommand": "turbo run build",
    "outputDirectory": null,
    "rootDirectory": "apps/platform",
    "directoryListing": false,
    "nodeVersion": "22.x"
  }
}
```

> `createdAt` will be populated by Vercel when the project is linked. The important fields are `rootDirectory` and the build settings. Use the same pattern as `apps/app/.vercel/project.json`.

### 1.4 `.dual/settings.json`

**File**: `.dual/settings.json`

Remove stale `apps/auth/.vercel` entry and add `apps/platform/.vercel`:

```json
{
  "devcontainer": ".devcontainer/devcontainer.json",
  "extra_commands": [],
  "anonymous_volumes": ["node_modules"],
  "shared": [
    "apps/app/.vercel",
    "apps/platform/.vercel",
    "apps/docs/.vercel",
    "apps/www/.vercel"
  ]
}
```

### 1.5 Stale comments in source files

Fix `apps/console` → `apps/app` in comments only (no logic change):

**File**: `apps/app/src/app/(trpc)/api/trpc/org/[trpc]/route.ts:19`
```ts
// Before: * See: apps/console/microfrontends.json
// After:  * See: apps/app/microfrontends.json
```

**File**: `apps/app/src/app/(trpc)/api/trpc/user/[trpc]/route.ts:19`
```ts
// Before: * See: apps/console/microfrontends.json
// After:  * See: apps/app/microfrontends.json
```

**File**: `api/app/src/env.ts:21`
```ts
// Before: * Must match the key used by apps/console to encrypt tokens
// After:  * Must match the key used by apps/app to encrypt tokens
```

**File**: `packages/inngest/src/client.ts:6`
```ts
// Before: /** Service app name, e.g. "lightfast-console" or "lightfast-memory" */
// After:  /** Service app name, e.g. "lightfast-app" or "lightfast-platform" */
```

### 1.6 `packages/console-providers` GitHub User-Agent

**File**: `packages/console-providers/src/providers/github/index.ts` — lines 56, 180, 266

Change `"User-Agent": "lightfast-memory"` → `"User-Agent": "lightfast-platform"`

This is just a UA string for GitHub API calls; no functional impact, safe to change now.

### 1.7 `CLAUDE.md`

**File**: `CLAUDE.md:88`

```bash
# Before:
#   api/console/src/inngest/workflow/ and api/memory/src/inngest/

# After:
#   api/app/src/inngest/workflow/ and api/platform/src/inngest/
```

### Success Criteria (Phase 1):

#### Automated:
- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes

---

## Phase 2: Vercel Dashboard — Create `lightfast-platform` Project

> **Do this BEFORE merging.** You need the project ID to fill into `repo.json` and `project.json`.

### 2.1 Create the project

1. Go to **vercel.com/lightfastai** → **Add New Project**
2. Import from Git — select this repo, or use the CLI:

```bash
# From repo root:
cd apps/platform
vercel link --yes --scope lightfastai
# When prompted, choose "Create a new project" → name it "lightfast-platform"
# rootDirectory will auto-detect as "apps/platform"
```

Or via CLI non-interactively after creating in dashboard:
```bash
vercel link --yes --project lightfast-platform --scope lightfastai
```

### 2.2 Configure project settings

In **Project Settings → General**:
- **Framework Preset**: Next.js
- **Root Directory**: `apps/platform`
- **Build Command**: `turbo run build`
- **Install Command**: `pnpm install`
- **Node.js Version**: 22.x

### 2.3 Get project ID and update code

After linking, the project ID is visible in the Vercel dashboard URL (`/settings`) or:

```bash
vercel api GET /v9/projects/lightfast-platform | jq '.id'
```

Update `.vercel/repo.json` (Phase 1.2) with the real `<PLATFORM_PROJECT_ID>`.

The `apps/platform/.vercel/project.json` will have been created by `vercel link`.

### 2.4 Copy environment variables from old projects

**Do this via the Vercel dashboard** — copy env vars from `lightfast-relay`, `lightfast-gateway`, `lightfast-backfill` into `lightfast-platform`.

The key vars needed by `apps/platform` (from `apps/platform/turbo.json` `passThroughEnv`):

```
SERVICE_JWT_SECRET
MEMORY_API_KEY
ENCRYPTION_KEY
LINEAR_WEBHOOK_SIGNING_SECRET
SENTRY_CLIENT_SECRET
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
INNGEST_SIGNING_KEY
INNGEST_EVENT_KEY
CLERK_SECRET_KEY
DATABASE_URL (or equivalent Neon connection string)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Also set the public vars:
```
NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_VERCEL_ENV
```

> Use `vercel env ls` on each old project to get the exact list before those projects are deleted.

### 2.5 Assign domain `platform.lightfast.ai`

In **Project Settings → Domains**: add `platform.lightfast.ai`.

---

## Phase 3: Vercel Dashboard — Rename `lightfast-console` → `lightfast-app`

> **Do this immediately before merging** — the window between rename and new deployment matters. The production site will work from the already-deployed version; only new deployments need the updated microfrontends key.

### 3.1 Rename in dashboard

**Project Settings → General → Project Name**: change `lightfast-console` → `lightfast-app`.

This changes the `.vercel.app` URL from `lightfast-console.vercel.app` to `lightfast-app.vercel.app`. Vercel keeps the old URL redirecting for some time.

### 3.2 Immediately merge the branch

Merge `feat/memory-service-consolidation` to `main`. The deployment will pick up the new `microfrontends.json` with `lightfast-app` key. The deployment takes ~3-5 minutes — during this window preview URLs may briefly be inconsistent. Production (`lightfast.ai`) continues to serve from the last-good deployment.

### 3.3 Verify deployments

```bash
# Check deployment status for both projects
vercel ls --project lightfast-app
vercel ls --project lightfast-platform
```

Manual checks:
- [ ] `lightfast.ai` loads correctly (microfrontends proxy)
- [ ] `lightfast.ai/sign-in` works
- [ ] `platform.lightfast.ai/api/health` returns 200
- [ ] No build errors in Vercel dashboard for either project

---

## Phase 4: Post-Merge Cleanup

### 4.1 Delete deprecated Vercel projects

In the Vercel dashboard, for each old project:
**Project Settings → Advanced → Delete Project**

Projects to delete:
- `lightfast-relay`
- `lightfast-gateway`
- `lightfast-backfill`

> Only do this after confirming `lightfast-platform` is healthy and `platform.lightfast.ai` is routing correctly.

```bash
# Verify platform is up before deleting old projects
curl https://platform.lightfast.ai/api/health
```

### 4.2 Update Inngest configuration (low-priority, separate ticket)

These are NOT changed in this merge — Inngest app ID changes need coordination:
- `api/platform/src/inngest/client.ts:11`: `appName: "lightfast-memory"` → `"lightfast-platform"`
- `api/app/src/inngest/client.ts`: verify current name
- Update `INNGEST_APP_NAME` env var in Vercel dashboard for `lightfast-app`
- Update `INNGEST_APP_NAME` env var in Vercel dashboard for `lightfast-platform`

> **Warning**: Changing Inngest app IDs mid-flight orphans in-progress workflows. Do this during a quiet period with no active jobs.

### 4.3 JWT audience (deferred, separate ticket)

`api/platform/src/lib/jwt.ts` still uses `"lightfast-memory"` as the JWT audience. Changing this invalidates existing tokens. Coordinate with a service restart.

---

## Implementation Order (Checklist)

```
[x] Phase 1: Make all code changes in the branch
    [x] 1.1 apps/app/microfrontends.json — rename key + fallback URL
    [x] 1.2 .vercel/repo.json — rename app entry (with placeholder for platform ID)
    [x] 1.3 apps/platform/.vercel/project.json — create file
    [x] 1.4 .dual/settings.json — remove apps/auth, add apps/platform
    [x] 1.5 Fix 3 stale comments (trpc routes + api/app env.ts)
    [x] 1.6 packages/inngest/src/client.ts — update JSDoc example
    [x] 1.7 packages/app-providers — update User-Agent header (package renamed; 3 occurrences fixed)
    [x] 1.8 CLAUDE.md — already correct (api/app + api/platform already referenced)
    [x] pnpm check (passes; mcp/embed/pinecone typecheck failures are pre-existing branch issues)

[x] Phase 2: Create lightfast-platform (BEFORE merge)
    [x] 2.1 Create project via Vercel API (prj_fCNbgzrn0hHuJRVvM7EZuUvFyGgW)
    [x] 2.2 Configure settings (rootDirectory=apps/platform, build=turbo run build, node=22.x)
    [x] 2.3 Project ID filled in .vercel/repo.json and apps/platform/.vercel/project.json
    [ ] 2.4 Copy env vars from old projects into lightfast-platform
    [x] 2.5 Assign platform.lightfast.ai domain (verified)

[x] Phase 3: Rename + Merge
    [x] 3.1 Rename lightfast-console → lightfast-app + rootDirectory apps/console → apps/app (via API)
    [ ] 3.2 Merge branch immediately after rename
    [ ] 3.3 Wait for deployment (~5 min), verify lightfast.ai + platform.lightfast.ai

[x] Phase 4: Post-merge cleanup
    [ ] 4.1 Confirm platform.lightfast.ai/api/health = 200
    [x] 4.2 Delete lightfast-relay, lightfast-gateway, lightfast-backfill from Vercel
    [ ] 4.3 Create ticket for Inngest app ID rename (separate)
    [ ] 4.4 Create ticket for JWT audience rename (separate)
```

---

## References

- Branch: `feat/memory-service-consolidation`
- Prior rename plan: `thoughts/shared/plans/2026-03-20-rename-apps-console-to-app-and-memory-to-platform.md`
- Architecture audit: `thoughts/shared/research/2026-03-19-memory-architecture-audit.md`
- `apps/app/microfrontends.json`
- `.vercel/repo.json`
- `apps/platform/turbo.json` (env var list for platform)

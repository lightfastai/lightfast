---
date: 2026-05-05
author: claude
git_commit: 2565270fac554cc02769ba6012eeb7c2cd9ae5d6
branch: desktop-portless-runtime-batch
topic: "PR #630 — Related-projects URL resolver consolidation + preview-safe allowlist"
tags: [plan, pr-review, allowlist, related-projects, vercel, preview]
status: draft
references:
  - thoughts/shared/research/2026-05-05-pr630-ghas-coderabbit-findings.md
---

# PR #630 — Related-Projects URL Resolver + Preview-Safe Allowlist

## Overview

Replace the inconsistent `withProject` / `resolveProjectUrl` mix across five `*/lib/project-urls.ts` files with a single per-app `related-projects.ts` pattern that resolves cross-project URLs correctly in dev, preview, and production. Configure `relatedProjects` in each app's `vercel.json` so Vercel injects `VERCEL_RELATED_PROJECTS` on preview deploys. Make preview deploys throw loud rather than silently fall back to production. Fix the parallel preview-deploy bug in `apps/app/next.config.ts` `serverActions.allowedOrigins`.

This plan addresses **Theme 5** of the PR #630 review research only. Themes 1, 2, 3, 4, and 6 are deferred — see *Deferred Work* at the bottom.

## Current State Analysis

### The bug

`VERCEL_RELATED_PROJECTS` is a Vercel-injected JSON env var that resolves sibling-project URLs at preview/production deploy time. It is only injected when the project's own `vercel.json` declares `relatedProjects: ["prj_..."]`. **None of the three `apps/*/vercel.json` files in this repo declare it** — confirmed by reading them — so `VERCEL_RELATED_PROJECTS` is absent on every deploy. The five `project-urls.ts` files all silently fall back to either a hardcoded production URL or the `microfrontends.json` `development.fallback` value.

Result, verified site-by-site:

| File | Helper | Behavior in **preview** |
|---|---|---|
| `apps/app/next.config.ts:25` (inline `platformUrl`) | `withProject` | `https://lightfast-platform.vercel.app` (prod) ⚠️ |
| `apps/app/src/lib/project-urls.ts` | `withProject` | same ⚠️ |
| `apps/app/src/lib/microfrontends.ts` | `resolveProjectUrl` | `https://lightfast.ai` (`microfrontends.json` fallback) ⚠️ |
| `apps/www/src/lib/project-urls.ts` | `resolveProjectUrl` | `https://lightfast.ai` ⚠️ |
| `apps/platform/src/lib/project-urls.ts` | `withProject` | `https://lightfast.ai` (prod app) ⚠️ — every preview tRPC call from app→platform 403s |
| `api/platform/src/lib/project-urls.ts` | `withProject` | same ⚠️ |
| `apps/app/next.config.ts:91-97` `serverActions.allowedOrigins` | inline | `["lightfast.ai", "*.lightfast.ai"]` ⚠️ — preview origins rejected |

Two adjacent files don't even use the helpers — they roll their own resolution from `VERCEL_ENV` / `VERCEL_URL`:
- `api/platform/src/lib/oauth/authorize.ts:20-33`
- `api/platform/src/lib/oauth/callback.ts:23-36`

### Why this matters

- **`apps/platform/src/lib/project-urls.ts`** feeds `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts:11`, a strict `origin !== appUrl` CORS check. On preview, `appUrl === "https://lightfast.ai"` so any preview deploy of `apps/app` calling preview `apps/platform` is rejected outright.
- **`apps/app/src/lib/microfrontends.ts`** feeds `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:13` CORS allowlist. On preview, `wwwUrl === "https://lightfast.ai"` and any `apps/www` preview deploy calling `apps/app` preview tRPC is rejected.
- **`apps/www/src/lib/project-urls.ts`** is the redirect target for `signInUrl = ${appUrl}/sign-in` in two `apps/www/.../docs/.../layout.tsx` files — preview docs link to prod sign-in.
- **`api/platform/src/lib/project-urls.ts`** feeds `provider-configs.ts:24` for OAuth callback construction.
- **`apps/app/next.config.ts` `serverActions.allowedOrigins`** uses `env.NODE_ENV === "development"` to switch between dev and prod allowlists — but Vercel preview builds run with `NODE_ENV === "production"`, so previews land on the prod `["lightfast.ai", "*.lightfast.ai"]` allowlist. The actual preview origin is `lightfast-app-git-<branch>-<team>.vercel.app`, never matched.

### Ground truth on Vercel Related Projects (verified)

- Configured per-project in `vercel.json` as `"relatedProjects": ["prj_..."]`. Max 3 entries. Same-repo only. **Not** a dashboard toggle.
- Vercel auto-injects `VERCEL_RELATED_PROJECTS` into both build and runtime env on every deploy of a project that declares it — including previews on any branch.
- Shape (from `@vercel/related-projects@1.1.0` source and `@lightfastai/dev-proxy@0.1.24`):
  ```ts
  Array<{
    project: { id: string; name: string }
    production: { url?: string; alias?: string }
    preview: { branch?: string; customEnvironment?: string }
  }>
  ```
- `withProject({ projectName, defaultHost, env? })` resolution (`@lightfastai/dev-proxy/dist/projects.js:23-44`): on preview returns `customEnvironment ?? branch` if present; on production returns `alias ?? url` if present; otherwise `defaultHost`.
- `resolveProjectUrl(projectName)` does **not** consult VRP — only reads `microfrontends.json` `development.fallback` in non-dev — so it must not be used to resolve sibling URLs in preview.
- Microfrontends and Related Projects are independent products. Configuring one doesn't configure the other. `microfrontends.json` controls network routing; `relatedProjects` controls env-var injection.
- When the related project hasn't deployed from the same branch, `preview.branch` is absent → `withProject` falls through to `defaultHost`. We treat this as a misconfiguration to throw on (see Phase 2 design).

### Out-of-scope code that is not affected

- `apps/desktop/` resolves `appOrigin` from `LIGHTFAST_APP_ORIGIN` env (set by `scripts/with-desktop-env.mjs`'s `resolvePortlessMfeUrl` in dev, hardcoded `https://lightfast.ai` in prod). No platform involvement, no VRP path. Confirmed end-to-end.
- `scripts/dev-services.mjs`, `scripts/with-dev-services-env.mjs`, `scripts/with-desktop-env.mjs`, `lightfast.dev.json`, `microfrontends.json` are correct as-is. The dev-side portless mesh is wired correctly; only the preview/production resolution is broken.
- `apps/app/next.config.ts` `withPortlessMfeDev(...)` + `getPortlessMfeDevOrigins(...)` (lines 16-19, 167-171) handle dev-only `allowedDevOrigins`, untouched by this plan.

## Desired End State

After this plan:

1. Each of the four apps that resolves sibling-project URLs has a single `src/lib/related-projects.ts` (renamed from `project-urls.ts`). `apps/app/src/lib/microfrontends.ts` is deleted (folded into `apps/app/src/lib/related-projects.ts`).
2. Each `related-projects.ts` is self-contained — no shared package — and resolves URLs the same way: dev returns a hardcoded local fallback (or portless via `resolveProjectUrl` for MFE peers), preview/production calls `withProject` and **throws at module init** when VRP is missing the required project.
3. Three `vercel.json` files declare `relatedProjects` so VRP is actually injected.
4. The inline `platformUrl` in `apps/app/next.config.ts` is replaced by an import from `./src/lib/related-projects.ts`.
5. The inline `appUrl` derivations in `api/platform/src/lib/oauth/authorize.ts` and `callback.ts` are replaced by an import from the sibling `related-projects.ts`.
6. `apps/app/next.config.ts` `serverActions.allowedOrigins` switches its gate from `NODE_ENV` to `NEXT_PUBLIC_VERCEL_ENV` and includes the actual preview origin in the allowlist.

### Verification

- `pnpm typecheck && pnpm check && pnpm build:app && pnpm build:platform` all pass.
- A new preview deploy of `apps/app` (with a corresponding preview deploy of `apps/platform` and `apps/www` on the same branch):
  - Loads without runtime error during module init.
  - Successful tRPC round-trip from app preview → platform preview.
  - Successful tRPC round-trip from www preview → app preview.
  - Server actions invoked from a preview-domain page complete (no `Invalid Origin` rejection).
- A preview deploy of `apps/app` **without** a matching `apps/platform` deploy on the same branch fails fast with the throw-on-missing-VRP error (rather than silently 403ing every cross-origin call).

## What We're NOT Doing

- **Building a `@repo/related-projects` shared package.** Each app gets its own `related-projects.ts` with self-contained resolution logic — accepted ~10–15 lines of duplication per file.
- **Dropping the `microfrontends.json` `development.fallback` fields.** They become dead in preview/production after this change but are still consulted by `resolveProjectUrl` in dev. Removing them is a separate cleanup.
- **Coordinating turbo-ignore co-deploy guarantees.** The throw forces correct configuration; ensuring app/platform/www always deploy together when one changes is a follow-up (likely an `ignoreCommand` that respects related projects).
- **Theme 3 (`redirect_url` open-redirect host allowlist in `_actions/sign-in.ts`)** — the other half of "allowlist" hardening on this PR. Defer to follow-up; see *Deferred Work*.
- **Themes 1, 2, 4, 6** from the PR research doc — orthogonal.
- **Desktop runtime config.** Already correct.

## Implementation Approach

Self-contained per-app `related-projects.ts` files implement the resolver inline. Resolution logic:

```ts
// pseudocode shared across files (not actually shared as code)
const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV; // "production" | "preview" | "development" | undefined

if (vercelEnv !== "production" && vercelEnv !== "preview") {
  // Local dev. Return a hardcoded fallback OR resolveProjectUrl(name) for MFE peers.
}

const url = withProject({
  projectName,
  defaultHost: vercelEnv === "production" ? PRODUCTION_FALLBACK : "",
});

if (vercelEnv === "preview" && !url) {
  throw new Error(/* clear remediation message */);
}

return url;
```

Two flavors of dev fallback:

- **MFE peer URLs** (e.g. `wwwUrl` in apps/app, `appUrl` in apps/www, `appUrl` in apps/platform, `appUrl` in api/platform): use `resolveProjectUrl(name)` from `@lightfastai/dev-proxy/projects` — it returns the portless URL (e.g. `https://lightfast.localhost`) read from `lightfast.dev.json` + `microfrontends.json`.
- **Standalone (non-MFE) URLs** (e.g. `platformUrl` in apps/app — `lightfast-platform` is not in `microfrontends.json`): use a hardcoded `http://localhost:<port>`.

Production fallbacks stay per-file (option B from design discussion):

| URL | Production fallback |
|---|---|
| `wwwUrl` (in apps/app) | `https://lightfast.ai` |
| `platformUrl` (in apps/app) | `https://lightfast-platform.vercel.app` |
| `appUrl` (in apps/www) | `https://lightfast.ai` |
| `appUrl` (in apps/platform) | `https://lightfast.ai` |
| `appUrl` (in api/platform) | `https://lightfast.ai` |

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Declare `relatedProjects` in `vercel.json`

### Overview

Add `"relatedProjects"` arrays of Vercel project IDs so Vercel injects `VERCEL_RELATED_PROJECTS` into builds. This is a prerequisite for any `withProject` call to succeed in preview/production.

### Prerequisite (out-of-band)

Fetch the three Vercel project IDs. Run from the repo root:

```bash
vercel project ls
```

Identify the IDs for `lightfast-app`, `lightfast-platform`, `lightfast-www` (they look like `prj_AbCd...`). The executor must paste these into the `vercel.json` files below — do not commit a placeholder.

### Changes Required

#### 1. `apps/app/vercel.json`

**File**: `apps/app/vercel.json`
**Changes**: Add `relatedProjects` listing platform and www (the two siblings app calls into).

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "npx turbo-ignore",
  "relatedProjects": ["<lightfast-platform-id>", "<lightfast-www-id>"]
}
```

#### 2. `apps/platform/vercel.json`

**File**: `apps/platform/vercel.json`
**Changes**: Add `relatedProjects` listing app (the only sibling platform's CORS / OAuth flows reference).

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "npx turbo-ignore",
  "relatedProjects": ["<lightfast-app-id>"]
}
```

#### 3. `apps/www/vercel.json`

**File**: `apps/www/vercel.json`
**Changes**: Add `relatedProjects` listing app (www docs link to app for sign-in).

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "npx turbo-ignore",
  "relatedProjects": ["<lightfast-app-id>"]
}
```

### Success Criteria

#### Automated Verification

- [x] All three `vercel.json` files validate against `https://openapi.vercel.sh/vercel.json` (no schema errors).
- [x] Each project ID matches the `prj_*` regex (no placeholders left).

#### Human Review

- [ ] Open Vercel dashboard for each project and confirm the IDs in `vercel.json` correspond to the right project (Settings → General → Project ID matches).

---

## Phase 2: Implement per-app `related-projects.ts` [DONE]

### Overview

Replace the four `lib/project-urls.ts` files (and `apps/app/src/lib/microfrontends.ts`) with `lib/related-projects.ts` files that resolve sibling URLs through `withProject` and throw on missing VRP in preview. No shared package — each file is self-contained.

### Changes Required

#### 1. `apps/app/src/lib/related-projects.ts` (NEW — replaces `project-urls.ts` AND `microfrontends.ts`)

**Files affected**:
- Create: `apps/app/src/lib/related-projects.ts`
- Delete: `apps/app/src/lib/project-urls.ts`
- Delete: `apps/app/src/lib/microfrontends.ts`

**Content**:
```ts
import { resolveProjectUrl, withProject } from "@lightfastai/dev-proxy/projects";
import { env } from "~/env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

function throwMissingVrp(projectName: string): never {
  throw new Error(
    `VERCEL_RELATED_PROJECTS missing "${projectName}" on this preview deploy. ` +
      `Declare it in apps/app/vercel.json relatedProjects and ensure ${projectName} also deploys on this branch.`
  );
}

function resolveSibling(projectName: string, productionFallback: string): string {
  if (isLocal) return resolveProjectUrl(projectName);
  const url = withProject({
    projectName,
    defaultHost: vercelEnv === "production" ? productionFallback : "",
  });
  if (!url) throwMissingVrp(projectName);
  return url;
}

function resolveStandalone(
  projectName: string,
  productionFallback: string,
  devFallback: string
): string {
  if (isLocal) return devFallback;
  const url = withProject({
    projectName,
    defaultHost: vercelEnv === "production" ? productionFallback : "",
  });
  if (!url) throwMissingVrp(projectName);
  return url;
}

export const wwwUrl = resolveSibling("lightfast-www", "https://lightfast.ai");
export const platformUrl = resolveStandalone(
  "lightfast-platform",
  "https://lightfast-platform.vercel.app",
  "http://localhost:4112"
);
```

#### 2. `apps/www/src/lib/related-projects.ts` (rename from `project-urls.ts`)

**Files affected**:
- Create: `apps/www/src/lib/related-projects.ts`
- Delete: `apps/www/src/lib/project-urls.ts`

**Content**:
```ts
import { resolveProjectUrl, withProject } from "@lightfastai/dev-proxy/projects";
import { env } from "~/env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

function resolveSibling(projectName: string, productionFallback: string): string {
  if (isLocal) return resolveProjectUrl(projectName);
  const url = withProject({
    projectName,
    defaultHost: vercelEnv === "production" ? productionFallback : "",
  });
  if (!url) {
    throw new Error(
      `VERCEL_RELATED_PROJECTS missing "${projectName}" on this preview deploy. ` +
        `Declare it in apps/www/vercel.json relatedProjects and ensure ${projectName} also deploys on this branch.`
    );
  }
  return url;
}

export const appUrl = resolveSibling("lightfast-app", "https://lightfast.ai");
```

#### 3. `apps/platform/src/lib/related-projects.ts` (rename from `project-urls.ts`)

**Files affected**:
- Create: `apps/platform/src/lib/related-projects.ts`
- Delete: `apps/platform/src/lib/project-urls.ts`

**Content**:
```ts
import { resolveProjectUrl, withProject } from "@lightfastai/dev-proxy/projects";
import { env } from "~/env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

function resolveSibling(projectName: string, productionFallback: string): string {
  if (isLocal) return resolveProjectUrl(projectName);
  const url = withProject({
    projectName,
    defaultHost: vercelEnv === "production" ? productionFallback : "",
  });
  if (!url) {
    throw new Error(
      `VERCEL_RELATED_PROJECTS missing "${projectName}" on this preview deploy. ` +
        `Declare it in apps/platform/vercel.json relatedProjects and ensure ${projectName} also deploys on this branch.`
    );
  }
  return url;
}

/** The app (lightfast.ai) — only the app calls platform tRPC. */
export const appUrl = resolveSibling("lightfast-app", "https://lightfast.ai");
```

#### 4. `api/platform/src/lib/related-projects.ts` (rename from `project-urls.ts`)

**Files affected**:
- Create: `api/platform/src/lib/related-projects.ts`
- Delete: `api/platform/src/lib/project-urls.ts`

**Content**:
```ts
import { resolveProjectUrl, withProject } from "@lightfastai/dev-proxy/projects";
import { env } from "../env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

function resolveSibling(projectName: string, productionFallback: string): string {
  if (isLocal) return resolveProjectUrl(projectName);
  const url = withProject({
    projectName,
    defaultHost: vercelEnv === "production" ? productionFallback : "",
  });
  if (!url) {
    throw new Error(
      `VERCEL_RELATED_PROJECTS missing "${projectName}" on this preview deploy. ` +
        `Declare it in apps/platform/vercel.json relatedProjects and ensure ${projectName} also deploys on this branch.`
    );
  }
  return url;
}

/** The app (lightfast.ai) — OAuth callbacks and webhook ingest route through here. */
export const appUrl = resolveSibling("lightfast-app", "https://lightfast.ai");
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes from repo root.
- [x] `pnpm check` passes (Biome) — no new errors from this phase. Pre-existing untracked-file error in `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs` is unrelated.
- [x] No remaining import of any `project-urls` or `microfrontends` file: `! rg -n "from .+/lib/project-urls\"" apps api && ! rg -n "from .+/lib/microfrontends\"" apps api`. *(Verified after Phase 3 rewire.)*
- [x] No file at `apps/{app,www,platform}/src/lib/project-urls.ts` or `api/platform/src/lib/project-urls.ts` or `apps/app/src/lib/microfrontends.ts`. *(Verified after Phase 3 deletions.)*

---

## Phase 3: Update consumers + remove inline duplications [DONE]

### Overview

Repoint the six consumer sites at the new `related-projects.ts` files. Delete the inline `platformUrl` derivation in `apps/app/next.config.ts`. Replace the hand-rolled `appUrl` derivations in `api/platform/src/lib/oauth/authorize.ts` and `callback.ts` with imports from the sibling `related-projects.ts`.

### Changes Required

#### 1. `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`

**Lines**: 5
**Change**: import path.

```diff
- import { wwwUrl } from "~/lib/microfrontends";
+ import { wwwUrl } from "~/lib/related-projects";
```

#### 2. `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts`

**Lines**: 4
**Change**: import path.

```diff
- import { appUrl } from "~/lib/project-urls";
+ import { appUrl } from "~/lib/related-projects";
```

#### 3. `apps/www/src/app/(app)/(content)/docs/(general)/layout.tsx`

**Lines**: 12
**Change**: import path.

```diff
- import { appUrl } from "~/lib/project-urls";
+ import { appUrl } from "~/lib/related-projects";
```

#### 4. `apps/www/src/app/(app)/(content)/docs/(api)/layout.tsx`

**Lines**: 12
**Change**: import path.

```diff
- import { appUrl } from "~/lib/project-urls";
+ import { appUrl } from "~/lib/related-projects";
```

#### 5. `api/platform/src/lib/provider-configs.ts`

**Lines**: 12
**Change**: import path.

```diff
- import { appUrl } from "./project-urls";
+ import { appUrl } from "./related-projects";
```

#### 6. `apps/app/next.config.ts` — delete inline `platformUrl`

**Lines**: 5, 21-30, 103, 107
**Change**: import `platformUrl` from sibling, drop the inline `withProject` call. Drops the unused `withProject` import.

```diff
- import { withProject } from "@lightfastai/dev-proxy/projects";
  import { withBetterStack } from "@logtail/next";
  ...
  import { env } from "./src/env";
+ import { platformUrl } from "./src/lib/related-projects";
  ...
- const isDevelopment =
-   env.NEXT_PUBLIC_VERCEL_ENV !== "production" &&
-   env.NEXT_PUBLIC_VERCEL_ENV !== "preview";
-
- const platformUrl = withProject({
-   projectName: "lightfast-platform",
-   defaultHost: isDevelopment
-     ? "http://localhost:4112"
-     : "https://lightfast-platform.vercel.app",
- });
```

(Existing `rewrites()` references `${platformUrl}` at lines 103 and 107 — unchanged, now resolved via the imported value.)

#### 7. `api/platform/src/lib/oauth/authorize.ts` — replace inline `appUrl` derivation

**Lines**: 20-33, 75
**Change**: delete the local block; import the canonical `appUrl` from the sibling `related-projects.ts`.

```diff
+ import { appUrl } from "../related-projects";
  ...
- // (delete the inline VERCEL_ENV / VERCEL_URL / VERCEL_PROJECT_PRODUCTION_URL block at lines 20-33)
```

The line-75 redirect-allowlist check then uses the imported `appUrl` directly.

#### 8. `api/platform/src/lib/oauth/callback.ts` — replace inline `appUrl` derivation

**Lines**: 23-36, 107, 137
**Change**: same as above.

```diff
+ import { appUrl } from "../related-projects";
  ...
- // (delete the inline VERCEL_ENV / VERCEL_URL / VERCEL_PROJECT_PRODUCTION_URL block at lines 23-36)
```

The line-107 and line-137 redirect-target constructions then use the imported `appUrl`.

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes from repo root.
- [x] `pnpm check` passes (no new errors from this phase; pre-existing untracked `lightfast-desktop-signin/lib/write-auth-bin.mjs` lint is unrelated).
- [x] `pnpm build:app` succeeds (catches `next.config.ts` typing).
- [x] `pnpm build:platform` succeeds.
- [x] No remaining inline `withProject(` call in any `next.config.ts`: `! rg -n "withProject\(" apps/*/next.config.ts`.
- [x] No remaining inline `VERCEL_PROJECT_PRODUCTION_URL` reference in `api/platform/src/lib/oauth/`.

#### Human Review

- [ ] Run `pnpm dev:full` and visit `https://lightfast.localhost/` (or the worktree-prefixed equivalent). Confirm app boots without an init-time error and that `/sign-in` renders.

---

## Phase 4: Fix `apps/app` `serverActions.allowedOrigins` for preview [DONE]

### Overview

`apps/app/next.config.ts:91-97` currently switches its server-actions allowlist on `env.NODE_ENV === "development"`. Vercel preview builds run with `NODE_ENV === "production"`, so previews land on `["lightfast.ai", "*.lightfast.ai"]` — never matching the actual preview origin (`lightfast-app-git-<branch>-<team>.vercel.app`). Switch the gate to `NEXT_PUBLIC_VERCEL_ENV` and add the wildcard preview-deploy host.

### Changes Required

#### 1. `apps/app/next.config.ts:91-97`

**File**: `apps/app/next.config.ts`
**Change**: branch on `NEXT_PUBLIC_VERCEL_ENV`. Local dev unchanged. Preview adds `*.vercel.app` to the existing prod allowlist. Production unchanged.

```diff
  serverActions: {
    bodySizeLimit: "2mb",
-   allowedOrigins:
-     env.NODE_ENV === "development"
-       ? ["localhost:*", ...portlessMfeDevOrigins]
-       : ["lightfast.ai", "*.lightfast.ai"],
+   allowedOrigins: (() => {
+     const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
+     if (vercelEnv === "production") {
+       return ["lightfast.ai", "*.lightfast.ai"];
+     }
+     if (vercelEnv === "preview") {
+       return ["lightfast.ai", "*.lightfast.ai", "*.vercel.app"];
+     }
+     return ["localhost:*", ...portlessMfeDevOrigins];
+   })(),
  },
```

Rationale for `*.vercel.app` in preview: the actual preview origins are always `<project>-git-<branch>-<team>.vercel.app` or `<project>-<hash>.vercel.app`. A tighter VRP-derived allowlist would require parsing `VERCEL_RELATED_PROJECTS` here at config time and is not worth the complexity given preview is already a non-production trust boundary.

### Success Criteria

#### Automated Verification

- [x] `pnpm build:app` succeeds.
- [x] `pnpm typecheck` passes.

#### Human Review

- [ ] Trigger any existing server action from a preview deploy of the branch (e.g. `/sign-in` → submit OTP → action `initiateSignIn` runs). Expected: server action completes (no `Server Action received an invalid origin` error).

---

## Testing Strategy

### Automated

- `pnpm typecheck && pnpm check && pnpm build:app && pnpm build:platform` covers compilation and lint correctness for all four apps.
- The throw-on-missing-VRP path is exercised by deliberately deleting one entry from a `vercel.json` and re-running `pnpm build:app` — the build should still succeed (module init runs only at request time on Vercel functions, not during build); but the next preview request will throw with the remediation message visible in Vercel logs.

### Manual on a preview deploy

Push a branch with all phases applied, wait for Vercel to deploy `lightfast-app`, `lightfast-platform`, `lightfast-www` previews:

1. Visit `https://lightfast-app-git-<branch>-<team>.vercel.app/`. Page renders without runtime error → resolver init worked.
2. Trigger any tRPC query in the app preview that hits platform (any `/api/connect/*` or `/api/ingest/*` rewrite) → succeeds without 403.
3. Visit `https://lightfast-www-git-<branch>-<team>.vercel.app/docs/get-started/overview` → "Sign in" link points at `lightfast-app-git-<branch>-<team>.vercel.app/sign-in`.
4. Submit a server action on the app preview (sign-in OTP, account update, anything) → no `invalid origin` rejection.
5. Confirm in Vercel build logs that `VERCEL_RELATED_PROJECTS` is present (search the build env dump) and contains entries for the related projects.

### Negative path

On a follow-up branch, deliberately revert one entry from `apps/app/vercel.json` `relatedProjects`. Trigger a preview deploy. The first request to the app preview should fail with the throw-on-missing-VRP error in the Vercel function logs. Restore and redeploy to confirm recovery.

## Migration Notes

- No data migration. Pure code/config change.
- The throw on missing-VRP is a behavioral change for preview deploys — previously they silently fell back to production URLs, now they fail loud. Operationally this means: when a PR only changes one of {app, platform, www}, `turbo-ignore` may skip deploying the others, leaving VRP without that sibling's `preview.branch` field. This will throw. The fix is to update `turbo-ignore` (or the `ignoreCommand` in `vercel.json`) so a related sibling is always deployed alongside the changed app — but that's deferred (see *Deferred Work*).
- For the immediate case, when shipping this PR, we may need to manually trigger redeploys on all three projects on the same branch to populate VRP fully.

## Deferred Work

The following items were intentionally cut from this plan but should be tracked:

1. **Theme 3 — `redirect_url` open-redirect host allowlist** (`apps/app/src/app/(auth)/_actions/sign-in.ts:11-14`). The `getRedirectUrl` helper accepts arbitrary `redirect_url` strings from `FormData` and they flow into `window.location.href`. A `safe-redirect.ts` helper with an allowlist of `{ lightfast.ai, lightfast.localhost }` (with subdomain match for worktree variants) is the fix. See `thoughts/shared/research/2026-05-05-pr630-ghas-coderabbit-findings.md` Theme 3 for the full design.
2. **`turbo-ignore` co-deploy guarantee.** Ensure `apps/app`, `apps/platform`, `apps/www` always deploy together on the same branch (or change `ignoreCommand` to declare related-project dependencies). Without this, the throw-on-missing-VRP path will fire frequently on PRs that only touch one app.
3. **Cleanup of `microfrontends.json` `development.fallback` values.** They become dead in preview/production after this change but `resolveProjectUrl` still consults them in dev. Trim or simplify.
4. **Themes 1, 2, 4, 6** from the PR research doc — formatter/Biome, auth race conditions, DB-client correctness, GHAS alert. Each tracked separately in the research doc.

## References

- Research doc: `thoughts/shared/research/2026-05-05-pr630-ghas-coderabbit-findings.md` (Theme 5)
- PR: https://github.com/lightfastai/lightfast/pull/630
- Vercel Related Projects docs: https://vercel.com/docs/concepts/monorepos
- `@lightfastai/dev-proxy/projects` source: `node_modules/@lightfastai/dev-proxy/dist/projects.js:23-44`
- Migration commit (introduced the latent bug): `f51668a81`

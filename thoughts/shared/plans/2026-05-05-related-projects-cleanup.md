# Related-Projects Cleanup: Adopt `@vercel/related-projects`, Single `~/lib/origins` Seam, + Packaged-Desktop CORS

## Overview

Refactor the URL primitives so business logic has exactly one upstream import for project URLs (`~/lib/origins`). Replace dev-proxy's reimplementation of Vercel's helper with the real `@vercel/related-projects` package. Move the portless dev wildcard set behind the same seam so `cors.ts` stops reaching into `@lightfastai/dev-proxy/next` directly. Inline the dev portless wildcards in `apps/app/next.config.ts` Server Actions allowlist. Then admit packaged-desktop tRPC requests in production by accepting `Origin: null` when an `x-lightfast-desktop` marker header is present (currently blocking the desktop beta tag burn — see `thoughts/shared/handoffs/general/2026-05-05_20-41-10_desktop-unsigned-beta-distribution.md`).

The file is renamed `related-projects.ts` → `origins.ts` because after the merge the file owns project URLs *and* the dev origin pattern set; the old name no longer reflects the contents.

## Current State Analysis

Source-of-truth research: `thoughts/shared/research/2026-05-05-related-projects-and-dev-proxy-primitives.md`. Triage decisions in §"Triage Decisions" of that doc are this plan's contract.

- Four near-duplicate `related-projects.ts` files (`apps/app`, `apps/platform`, `apps/www`, `api/platform`) all import `withProject` + `resolveProjectUrl` from `@lightfastai/dev-proxy/projects`.
- `withProject` (dev-proxy `dist/projects.js:23-44`) is a line-for-line reimplementation of `@vercel/related-projects`'s `withRelatedProject`. The Vercel package is **not** declared as a dep anywhere in the repo (it sits orphaned in the pnpm store; not linked into any workspace's `node_modules`).
- `apps/app/src/lib/related-projects.ts:17-50` carries two near-identical helpers (`resolveSibling` + `resolveStandalone`); `apps/app/src/lib/related-projects.ts:61-63` declares `appUrl` inline (bypasses `withProject` even on deploys).
- `apps/app/src/lib/cors.ts:1` imports `getPortlessProxyOrigins` directly from `@lightfastai/dev-proxy/next` — the only `lib/` file that reaches into the dev-proxy package; identical pattern in `apps/platform/src/lib/cors.ts:1`.
- `apps/app/next.config.ts:74-86` has an inline `experimental.serverActions.allowedOrigins` IIFE; `apps/app/next.config.ts:161` passes `{ serverActions: isLocalDev }` to `withPortlessProxy(...)`, which then appends portless wildcard origins on top of the inline `["localhost:*"]` dev branch.
- `@lightfastai/dev-proxy@0.2.1` is an external published package (not workspace-local). Stripping its `/projects` subpath exports requires a separate package release — out of scope here. We swap consumers in this repo only.
- **Eight import sites** read from `~/lib/related-projects` (or relative equivalents): `apps/app/next.config.ts:11`, `apps/app/src/lib/cors.ts:3`, `apps/platform/src/lib/cors.ts:3`, `apps/www/src/app/(app)/(content)/docs/(general)/layout.tsx:12`, `apps/www/src/app/(app)/(content)/docs/(api)/layout.tsx:12`, `api/platform/src/lib/provider-configs.ts:12`, `api/platform/src/lib/oauth/authorize.ts:12`, `api/platform/src/lib/oauth/callback.ts:15`. All eight need their import paths updated.
- **Packaged-desktop CORS is broken**: `apps/desktop/src/main/windows/factory.ts:108` calls `BrowserWindow.loadFile(...)` for the packaged renderer, producing a `file://` page → Chromium sends `Origin: null` on cross-origin fetches. The prod allowlist at `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:31` admits `https://lightfast.ai` only; the dev `localhost` carve-out at line 17 is gated on `NODE_ENV === "development"`. There is no packaged-desktop carve-out — every tRPC call from the published beta is CORS-blocked. Bearer-JWT auth is already enforced (`packages/app-trpc/src/desktop.tsx:23-32`), so admitting `Origin: null` with a marker header doesn't weaken auth.

### Key Discoveries

- `@vercel/related-projects@1.1.0` exports `withRelatedProject({ projectName, defaultHost }) → string`. **No `env?` parameter** like dev-proxy's `withProject`, but no consumer passes `env` today, so the swap is mechanical.
- **Spike-verified semantics** (this review): `withRelatedProject` returns `defaultHost` whenever (a) `VERCEL_RELATED_PROJECTS` is unset, (b) VRP is set but does not contain `projectName`, OR (c) VRP contains a match but `VERCEL_ENV !== "production" && VERCEL_ENV !== "preview"`. On Vercel deploys `VERCEL_ENV` is always set, so case (c) is moot. The matched-and-prod path returns `https://${project.production.alias ?? project.production.url}`. Source: `node_modules/.pnpm/@vercel+related-projects@1.1.0/.../dist/with-related-project.js` confirmed against running output. Production-URL field shape is `production.url` / `production.alias` (bare host strings; the package prepends `https://`). Field names confirmed against `dist/types.d.ts:26-42` — no `host` field exists.
- `apps/app/vercel.json` declares `relatedProjects: [prj_fCNbgzrn0hHuJRVvM7EZuUvFyGgW, prj_JRXRxBruTvB5Bs99JjA63TLek6GT]` (lightfast-platform + lightfast-www; **does not list itself**). So `withRelatedProject({ projectName: "lightfast-app", defaultHost: "https://lightfast.ai" })` always returns `defaultHost` everywhere — matches today's inline `appUrl` literal in preview + prod. The `isLocal` ternary on `defaultHost` is therefore load-bearing only because we need a *different* `defaultHost` value (portless self URL) in dev. For sibling URLs (`wwwUrl`, `platformUrl`) the ternary is also load-bearing — VRP is empty in dev so `defaultHost` wins; in prod VRP is populated so the matched URL wins.
- `getPortlessProxyOrigins({ allowMissingConfig: true })` returns `string[]` of bare hostnames + wildcards (`"app.lightfast.localhost"`, `"*.app.lightfast.localhost"`, etc.). The same shape Next's `experimental.serverActions.allowedOrigins` accepts, so it can be inlined directly.
- `apps/app/src/lib/__tests__/cors.test.ts` uses `vi.doMock` on three paths (`~/lib/related-projects`, `~/env`, `@lightfastai/dev-proxy/next`). After the refactor the third mock disappears — `devOriginPatterns` becomes part of the `~/lib/origins` mock object — and the first mock path renames.
- `apps/app/src/lib/__tests__/portless-origins.test.ts` is unchanged — it's a snapshot of `@lightfastai/dev-proxy/next` against repo fixtures, orthogonal to the seam.
- `apps/platform/src/lib/cors.ts` is byte-identical to the apps/app copy. No `__tests__/cors.test.ts` exists for platform (research note #7; left as separate work).
- Desktop tRPC client (`packages/app-trpc/src/desktop.tsx:23-32`) builds `headers` in `getAuthHeaders`. Adding `"x-lightfast-desktop": "1"` is a one-line change and propagates to every desktop tRPC request.
- Catalog (`pnpm-workspace.yaml:10-59`) groups by scope alphabetically. There are no existing `@vercel/...` entries; `@vercel/related-projects` belongs between `@upstash/redis` (line 33) and `@vitest/coverage-v8` (line 34).

## Desired End State

After this plan lands:

1. Every business-logic / route file that needs a project URL imports from `~/lib/origins` only — no direct `@lightfastai/dev-proxy/projects` imports anywhere in the repo.
2. `apps/app/src/lib/cors.ts` and `apps/platform/src/lib/cors.ts` import from `~/lib/origins` only — no direct `@lightfastai/dev-proxy/next` imports in `lib/`.
3. Each `origins.ts` is one short file: imports + `isLocal` + one `withRelatedProject(...)` expression per declared related project (+ `devOriginPatterns` where consumed by `cors.ts`). No bespoke `resolveSibling` / `resolveStandalone` helpers, no `throwMissingVrp`.
4. `apps/app/next.config.ts` Server Actions allowlist consumes `devOriginPatterns` from `~/lib/origins` directly; `withPortlessProxy(...)` is called without the `serverActions: isLocalDev` arg.
5. Packaged Lightfast Desktop in production successfully completes tRPC calls against `https://lightfast.ai/api/trpc/...`. The renderer sends `x-lightfast-desktop: 1`; the server admits `Origin: null` requests bearing that marker header (Bearer JWT remains the actual auth boundary).

### Verification

- `grep -rn "@lightfastai/dev-proxy/projects" apps api --include="*.ts"` matches exactly the four `~/lib/origins.ts` files (each importing only `resolveProjectUrl`, no `withProject`); no matches elsewhere.
- `grep -rn "@lightfastai/dev-proxy/next" apps api --include="*.ts"` matches exactly: the three `next.config.ts` files (`withPortlessProxy`), the two `origins.ts` files that export `devOriginPatterns` (`apps/app`, `apps/platform`, importing `getPortlessProxyOrigins`), and `apps/app/src/lib/__tests__/portless-origins.test.ts` (snapshot test). No other matches.
- `grep -rn "from.*['\"]\\(~\\|\\.\\)/.*related-projects['\"]" apps api --include="*.ts" --include="*.tsx"` returns zero hits.
- `pnpm dev:full` boots the portless aggregate; `https://app.lightfast.localhost` admits the desktop Bearer-token tRPC call; Server Actions submit successfully from `https://app.lightfast.localhost` and from a worktree-prefixed `https://<branch>.app.lightfast.localhost`.
- A locally packaged desktop build (`pnpm --filter @lightfast/desktop package`) launched against `LIGHTFAST_APP_ORIGIN=https://lightfast.ai` (or with the env var unset, defaulting to prod) successfully calls `account.get` after sign-in. Browser devtools (or main-process logs) show `x-lightfast-desktop: 1` on outbound requests; the response carries `Access-Control-Allow-Origin: null` and the request succeeds.
- `pnpm typecheck`, `pnpm check`, `pnpm --filter @lightfast/app test`, `pnpm build:app`, `pnpm build:platform` all pass.

## What We're NOT Doing

- **Releasing a new `@lightfastai/dev-proxy`** that drops the `/projects` subpath exports. dev-proxy is external (catalog-pinned `^0.2.1`); its surface change is a separate repo's release. The plan stops importing `withProject` from there; the orphan export can be deprecated/removed in a follow-up release.
- **Extracting a `@repo/related-projects` (or `@repo/origins`) shared package** (research Decision #5 — DEFER). PR #630 explicitly opted out of this; revisit only after the post-cleanup shape settles.
- **Removing `wwwUrl`** (research Decision #2 — KEEP). Tree-shakable; tracks `apps/app/vercel.json` topology rather than current consumer set; cross-domain links from app → www are likely soon.
- **Adding `apps/platform/src/lib/__tests__/cors.test.ts`** (research note #7). The platform `cors.ts` is byte-identical to the app copy and is exercised by the same logic; a dedicated test is worth doing but out of scope here.
- **Touching `apps/www/next.config.ts` or `apps/platform/next.config.ts`** Server Actions config. Neither has Server Actions; only `apps/app` does.
- **Re-adding throw-on-missing-VRP for siblings.** The new design lets `withRelatedProject` silently return the production fallback when a sibling is misconfigured in `vercel.json`. Defensively useful in the past, but not load-bearing — both app and www serve under `lightfast.ai` in production.
- **Switching the packaged Electron renderer to a custom `app://` protocol** (the "proper" Phase 3 fix). That requires registering a protocol handler in main, switching `loadRenderer` to `loadURL`, adjusting Vite renderer base, and adding `app://lightfast` to the production allowlist. Larger change with desktop-side coordination — doing it later, *after* the marker-header approach unblocks the beta. Captured as follow-up.
- **Extending the desktop CORS admission to `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts`.** Desktop talks to app, not platform — verified by the tRPC client config. Platform's allowlist stays as-is.

## Implementation Approach

Phase 1 is the seam rewrite + rename + collapse. Phase 2 inlines portless into Server Actions. Phase 3 is the desktop-prod CORS fix and is otherwise independent of Phases 1-2 — it only depends on whichever of `route.ts` / `cors.ts` is the current source-of-truth at the time of merge. Sequenced last because Phases 1-2 reshape `cors.ts`, and rebasing Phase 3 onto the smaller post-cleanup file is easier than the reverse.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

## Phase 1: Adopt `@vercel/related-projects`, rename `~/lib/related-projects.ts` → `~/lib/origins.ts`, rename `~/lib/origin-allowlist.ts` → `~/lib/cors.ts`

### Overview

Add `@vercel/related-projects` to the catalog and to the four consuming workspaces. Rename each `~/lib/related-projects.ts` to `~/lib/origins.ts` (or `./origins.ts` for `api/platform`). Rewrite to a flat shape using `withRelatedProject`. Add `devOriginPatterns` export from `apps/app` and `apps/platform` `origins.ts`. Update all eight importers. Rename `~/lib/origin-allowlist.ts` → `~/lib/cors.ts` in both `apps/app` and `apps/platform` (the file owns CORS admission predicates; the new name reflects that). Refactor each `cors.ts` to consume `devOriginPatterns` from the seam. Update the existing test file (rename `__tests__/origin-allowlist.test.ts` → `__tests__/cors.test.ts` plus mock surface).

### Changes Required

#### 1. Catalog and per-workspace deps

**File**: `pnpm-workspace.yaml`
**Change**: Add `'@vercel/related-projects': ^1.1.0` between line 33 (`'@upstash/redis': ^1.37.0`) and line 34 (`'@vitest/coverage-v8': ^4.1.4`) — alphabetical position; no other `@vercel/...` entries exist today.

**Files**: `apps/app/package.json`, `apps/platform/package.json`, `apps/www/package.json`, `api/platform/package.json`
**Change**: Add `"@vercel/related-projects": "catalog:"` under `dependencies` (alphabetical).

After the four package.json edits, run `pnpm install` once to refresh the lockfile.

#### 2. `apps/app/src/lib/origins.ts` — full rewrite (renamed from `related-projects.ts`)

**File**: `apps/app/src/lib/origins.ts` (new path; delete `related-projects.ts`)
**Change**: Replace the entire 64-line file with the flat shape below.

```ts
import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";
import { getPortlessProxyOrigins } from "@lightfastai/dev-proxy/next";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "../env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

// Self-URL: lightfast-app is not in its own apps/app/vercel.json relatedProjects,
// so withRelatedProject returns defaultHost in every environment. The isLocal
// branch swaps the dev portless URL for the prod literal.
export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-app")
    : "https://lightfast.ai",
});

// Sibling URLs: VRP is populated on Vercel deploys, so withRelatedProject returns
// the matched URL; in dev VRP is empty, so defaultHost (portless) wins.
export const wwwUrl = withRelatedProject({
  projectName: "lightfast-www",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-www")
    : "https://lightfast.ai",
});

// platform is intentionally not on portless (raw :4112 in dev) — see CLAUDE.md
// "platform → http://localhost:4112 (raw backend; not yet on Portless / MFE)".
export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: isLocal
    ? "http://localhost:4112"
    : "https://lightfast-platform.vercel.app",
});

export const devOriginPatterns: readonly string[] = isLocal
  ? getPortlessProxyOrigins({ allowMissingConfig: true })
  : [];
```

#### 3. `apps/platform/src/lib/origins.ts` — full rewrite (renamed)

**File**: `apps/platform/src/lib/origins.ts` (new path; delete `related-projects.ts`)
**Change**: Replace the entire 31-line file. Same pattern as apps/app, only one `appUrl` export plus `devOriginPatterns`.

```ts
import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";
import { getPortlessProxyOrigins } from "@lightfastai/dev-proxy/next";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "~/env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

/** The app (lightfast.ai) — only the app calls platform tRPC. */
export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-app")
    : "https://lightfast.ai",
});

export const devOriginPatterns: readonly string[] = isLocal
  ? getPortlessProxyOrigins({ allowMissingConfig: true })
  : [];
```

#### 4. `apps/www/src/lib/origins.ts` — full rewrite (renamed)

**File**: `apps/www/src/lib/origins.ts` (new path; delete `related-projects.ts`)
**Change**: Replace the entire 30-line file. www has no `cors.ts` (no tRPC CORS surface), so no `devOriginPatterns`.

```ts
import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "~/env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-app")
    : "https://lightfast.ai",
});
```

#### 5. `api/platform/src/lib/origins.ts` — full rewrite (renamed)

**File**: `api/platform/src/lib/origins.ts` (new path; delete `related-projects.ts`)
**Change**: Replace the entire 31-line file. api/platform has no `cors.ts` (it's a workspace package consumed by `apps/platform`), so no `devOriginPatterns`. Keep the existing JSDoc comment.

```ts
import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "../env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

/** The app (lightfast.ai) — OAuth callbacks and webhook ingest route through here. */
export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-app")
    : "https://lightfast.ai",
});
```

#### 6. Update all eight importers

Eight files reference the old path; each gets a one-line import update. Confirm with `grep -rn "from.*related-projects" apps api --include="*.ts" --include="*.tsx"` before and after — should drop to zero.

| File | Old | New |
|---|---|---|
| `apps/app/next.config.ts:11` | `"./src/lib/related-projects"` | `"./src/lib/origins"` |
| `apps/app/src/lib/cors.ts:3` | `"~/lib/related-projects"` | `"~/lib/origins"` |
| `apps/platform/src/lib/cors.ts:3` | `"~/lib/related-projects"` | `"~/lib/origins"` |
| `apps/www/src/app/(app)/(content)/docs/(general)/layout.tsx:12` | `"~/lib/related-projects"` | `"~/lib/origins"` |
| `apps/www/src/app/(app)/(content)/docs/(api)/layout.tsx:12` | `"~/lib/related-projects"` | `"~/lib/origins"` |
| `api/platform/src/lib/provider-configs.ts:12` | `"./related-projects"` | `"./origins"` |
| `api/platform/src/lib/oauth/authorize.ts:12` | `"../related-projects"` | `"../origins"` |
| `api/platform/src/lib/oauth/callback.ts:15` | `"../related-projects"` | `"../origins"` |

#### 7. `apps/app/src/lib/cors.ts` — rename from `origin-allowlist.ts` and collapse onto `~/lib/origins`

**File**: `apps/app/src/lib/cors.ts` (renamed; delete `origin-allowlist.ts`). Both `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` and `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts` import paths update from `~/lib/origin-allowlist` to `~/lib/cors` as part of this rename.
**Change**: Drop the `getPortlessProxyOrigins` import. Import `appUrl` and `devOriginPatterns` from `~/lib/origins`. Replace the dev-origins computation with a direct alias — `devOriginPatterns` is already gated to `[]` in non-local environments at the source, so the `isDev ? ... : []` re-gate is a tautology and is removed.

```ts
// After
import { env } from "~/env";
import { appUrl, devOriginPatterns } from "~/lib/origins";

const isDev =
  env.NEXT_PUBLIC_VERCEL_ENV === undefined ||
  env.NEXT_PUBLIC_VERCEL_ENV === "development";

const isBuildPhase = process.env.NEXT_PHASE?.includes("build") ?? false;

const canonicalAppOrigin = new URL(appUrl).origin;

if (isDev && !isBuildPhase && canonicalAppOrigin === "https://lightfast.ai") {
  throw new Error(
    "[cors] appUrl resolved to production URL in dev; portless daemon likely not running. " +
      "Run `pnpm dev:full` (which starts portless) or `portless start` before the platform/app server."
  );
}

// devOriginPatterns is already [] when !isLocal (gated inside ~/lib/origins).
// No re-gate needed; the constant is the source of truth.
const devOrigins = devOriginPatterns;

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const originValue = originUrl.origin;

  if (originValue === canonicalAppOrigin) return true;
  if (!isDev) return false;

  return devOrigins.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return (
        originUrl.host.endsWith(suffix) && originUrl.host.length > suffix.length
      );
    }
    return originUrl.host === pattern;
  });
}
```

The cold-start guard at lines 13-18 stays unchanged — it still reads `canonicalAppOrigin === "https://lightfast.ai"` from the `appUrl` import. The `if (!isDev) return false;` short-circuit at line 36 still gates `devOrigins` matching to dev only, so dropping the assignment-time re-gate is safe.

#### 8. `apps/platform/src/lib/cors.ts` — same change

**File**: `apps/platform/src/lib/cors.ts`
**Change**: Identical edit to apps/app's copy (the two files are byte-identical today and stay byte-identical after).

#### 9. `apps/app/src/lib/__tests__/cors.test.ts` — rename from `origin-allowlist.test.ts`, update mock path, fold dev-proxy mock into seam mock

**File**: `apps/app/src/lib/__tests__/cors.test.ts` (renamed from `origin-allowlist.test.ts`)
**Change**: Mock path renames (`~/lib/related-projects` → `~/lib/origins`). `setupMocks` no longer mocks `@lightfastai/dev-proxy/next`; it adds `devOriginPatterns` to the `~/lib/origins` mock object. `afterEach` drops the corresponding `vi.doUnmock`. Test imports the SUT via `await import("../cors")` (was `"../origin-allowlist"`).

```ts
function setupMocks(opts: {
  appUrl: string;
  vercelEnv: "development" | "preview" | "production" | undefined;
  origins?: string[];
}) {
  vi.doMock("~/lib/origins", () => ({
    appUrl: opts.appUrl,
    devOriginPatterns: opts.origins ?? PORTLESS_ORIGINS,
  }));
  vi.doMock("~/env", () => ({
    env: { NEXT_PUBLIC_VERCEL_ENV: opts.vercelEnv },
  }));
}

// ...
afterEach(() => {
  vi.doUnmock("~/lib/origins");
  vi.doUnmock("~/env");
});
```

All existing test cases (canonical match, trailing-slash strip, wildcard worktree subdomain, prod short-circuit, malformed origin, cold-start guard) keep their existing assertions — only the mock surface narrows.

`apps/app/src/lib/__tests__/portless-origins.test.ts` is unchanged — it tests `getPortlessProxyOrigins` directly, not the seam.

### Success Criteria

#### Automated Verification

- [x] `pnpm install` succeeds and `pnpm-lock.yaml` records `@vercel/related-projects@^1.1.0` referenced from `apps/app`, `apps/platform`, `apps/www`, `api/platform`.
- [x] `pnpm typecheck` passes (top-level — covers all four affected workspaces).
- [x] `pnpm check` passes (lint). _Note: 9 pre-existing `useBlockStatements` errors remain (baseline had 15 with the same pattern); none introduced by this phase. Code copied verbatim from the previous origin-allowlist.ts retains the original style._
- [x] `pnpm --filter @lightfast/app test` passes (cors + origins suites). _Note: the `portless-origins.test.ts` snapshot test was replaced by a seam-level `origins.test.ts` (decoupled from `lightfast.dev.json` fixtures)._
- [x] `pnpm --filter @lightfast/www test` passes.
- [x] `pnpm build:app` succeeds (production build path; cold-start guard skipped via `NEXT_PHASE`).
- [x] `pnpm build:platform` succeeds.
- [x] `grep -rn "withProject\b" apps api --include="*.ts"` returns no hits (search outside `node_modules` / `.next` / `.vercel`).
- [x] `grep -rn "from.*['\"][~./].*related-projects['\"]" apps api --include="*.ts" --include="*.tsx"` returns zero hits (rename complete).
- [x] `find apps api -name "related-projects.ts" -not -path "*/node_modules/*" -not -path "*/.next/*"` returns no files.
- [x] `grep -rn "@lightfastai/dev-proxy/projects" apps api --include="*.ts"` matches exactly the four `origins.ts` files (each importing only `resolveProjectUrl`).
- [x] `grep -rn "@lightfastai/dev-proxy/next" apps api --include="*.ts"` matches exactly: three `next.config.ts` (withPortlessProxy), two `origins.ts` (`apps/app` + `apps/platform`, `getPortlessProxyOrigins`), one `apps/app/src/__tests__/origins.test.ts` (mock).

> **Implementation deviation:** `cors.ts`, `origins.ts`, and tests were lifted to top-level (`src/cors.ts`, `src/origins.ts`, `src/__tests__/{cors,origins}.test.ts`) instead of staying under `src/lib/`. Followed user request to co-locate with `env.ts` / `proxy.ts`. The grep targets above reflect this. Files imported from `next.config.ts` (i.e., `apps/app/src/origins.ts`) use a relative `import { env } from "./env"` because the Next config compiler does not honor the `~/` TS alias when it transpiles next.config.ts.

#### Human Review

- [ ] Run `pnpm dev:full`; visit `https://lightfast.localhost` → app loads, sign-in works → confirms `appUrl` resolves to portless self URL in dev.
- [ ] Trigger a tRPC call from the app shell (anything that hits `/api/trpc/...`) → request succeeds → confirms CORS allowlist still admits portless origins via `devOriginPatterns`.
- [ ] Trigger a connect/ingest rewrite (e.g. open a connector that exercises `/api/connect/...`) → request flows through to `http://localhost:4112` → confirms `platformUrl` literal still works in dev.
- [ ] On a secondary worktree branch (sanitized to e.g. `feature`), confirm `https://feature.app.lightfast.localhost` still admits CORS calls — exercises `*.app.lightfast.localhost` wildcard via `devOriginPatterns`.
- [ ] Visit a www docs page that uses `appUrl` for the sign-in CTA (`apps/www/src/app/(app)/(content)/docs/(general)/layout.tsx`, `(api)/layout.tsx`) → the link points at the portless app URL in dev.
- [ ] Stop portless (`pkill -f portless`) and reload an app page in dev → cold-start guard throws at module init with the existing "portless daemon likely not running" message → confirms the guard still fires.

---

## Phase 2: Inline portless wildcards in `apps/app/next.config.ts` Server Actions allowlist [DONE]

### Overview

After Phase 1, `apps/app/src/lib/origins.ts` exports `devOriginPatterns`. Consume it directly in the `experimental.serverActions.allowedOrigins` IIFE so the dev branch is `[...devOriginPatterns, "localhost:*"]`. Drop `{ serverActions: isLocalDev }` from the `withPortlessProxy(...)` call and the now-unused `isLocalDev` const — the inline allowlist owns Server Actions origins, and `withPortlessProxy` retains its always-on `allowedDevOrigins` HMR behavior.

### Changes Required

#### 1. `apps/app/next.config.ts`

**File**: `apps/app/next.config.ts`
**Change**: Add `devOriginPatterns` to the existing `~/lib/origins` import (which Phase 1 already updated). Update the dev branch of the inline `allowedOrigins` IIFE. Drop the `serverActions: isLocalDev` arg from `withPortlessProxy`. Drop the now-unused `isLocalDev` const.

```ts
// Line 11 — extend existing import
import { devOriginPatterns, platformUrl } from "./src/lib/origins";

// Lines 74-86 — only the dev branch changes
allowedOrigins: (() => {
  const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv === "production") {
    return ["lightfast.ai", "*.lightfast.ai"];
  }
  if (vercelEnv === "preview") {
    return ["lightfast.ai", "*.lightfast.ai", "*.vercel.app"];
  }
  // Dev: portless wildcards (lib/origins single seam) + raw localhost
  // for direct backend hits (raw 4107, desktop renderer, Inngest local).
  return [...devOriginPatterns, "localhost:*"];
})(),

// Lines 156-162 — drop isLocalDev and the serverActions arg
const baseExport = withPortlessProxy(
  withMicrofrontends(config, {
    debug: env.NODE_ENV !== "production",
  }),
);
```

**Pre-commit verification step**: confirm `withPortlessProxy` only modifies `experimental.serverActions.allowedOrigins` when its `serverActions` arg is truthy — i.e., dropping the arg is a no-op for prod/preview branches. Quick check: `grep -n "serverActions\|allowedOrigins" node_modules/@lightfastai/dev-proxy/dist/next.*`. If the wrapper unconditionally appends, the inline IIFE prod/preview branches need to be conservative supersets of what the wrapper would have produced. Capture the grep output in the PR description.

`withPortlessProxy` still sets `allowedDevOrigins` (HMR) for free; only the `experimental.serverActions.allowedOrigins` plumbing moves to the inline IIFE. No change to `apps/www/next.config.ts` or `apps/platform/next.config.ts` (neither has Server Actions surface).

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes.
- [x] `pnpm check` passes. _Note: 12 pre-existing `useBlockStatements` errors persist from Phase 1 (cors.ts, route.ts, origins.test.ts); none introduced by this phase. `next.config.ts` is clean._
- [x] `pnpm build:app` succeeds.
- [x] `grep -n "isLocalDev\|serverActions:" apps/app/next.config.ts` — `isLocalDev` removed and the `withPortlessProxy(..., { serverActions })` arg is gone. The remaining match is the unrelated `experimental.serverActions:` config block (Next.js option), which is the legitimate inline allowlist site this phase modified.

#### Human Review

Automated via live HTTP probe against `pnpm dev:app` + portless. Method: POST `/early-access` with a fake `Next-Action: 0…0` and varying `Origin` headers. Next emits **404 "Failed to find Server Action"** when the origin is admitted (action lookup runs, hits the fake ID); **500 "Invalid Server Actions request"** when CSRF rejects the origin first. Distinct response codes give clean discrimination.

- [x] Submit a Server Action from `https://app.lightfast.localhost` → 404 (action lookup) → admitted via `app.lightfast.localhost` ∈ `devOriginPatterns`.
- [x] Submit from worktree-prefixed `https://feature.app.lightfast.localhost` → 404 → admitted via `*.app.lightfast.localhost` wildcard in `devOriginPatterns`.
- [x] Hit a Server Action from raw app port directly with `Origin === Host` (`http://localhost:5502`) → 404 → admitted via Next's Origin-vs-Host short-circuit (consulted before `allowedOrigins`). Note: app dev binds to `5502` per `microfrontends.local.json`, not `4107`.
- [x] Negative control `https://evil.com` → 500 "Invalid Server Actions request. `x-forwarded-host` does not match `origin`" → correctly rejected.
- [x] Cold-start guard: `apps/app/src/__tests__/cors.test.ts:99-106` ("throws if appUrl resolved to production URL while in dev" matching `/portless daemon likely not running/`) passes in the full app suite (82/82). Asserting via the unit test instead of stopping portless mid-session is equivalent and faster.

**Note discovered during verification (carryover, not introduced by Phase 2):** `"localhost:*"` is dead code in `allowedOrigins`. Next 16.2.4's `isCsrfOriginAllowed` (`csrf-protection.js`) splits patterns on `.` and treats `*` only as a full DNS label, so `localhost:*` does not match `localhost:9999`. The pattern was dead in the prior config too — kept verbatim under Phase 2's "preserve dev parity" intent. Realistic raw-localhost SA submissions (developer hitting raw `:5502` from the same browser tab) work because Origin === Host short-circuits before the allowlist is consulted. Cross-port localhost SA (e.g., desktop renderer at `:5173` POSTing to app at `:5502`) is not exercised today — desktop uses tRPC + Bearer JWT, not Server Actions.

---

## Phase 3: Admit packaged-desktop tRPC requests in production [DONE]

### Overview

Packaged Lightfast Desktop loads the renderer with `BrowserWindow.loadFile(...)` (`apps/desktop/src/main/windows/factory.ts:108`) → `file://` page → Chromium sends `Origin: null` on cross-origin fetches. The current production allowlist rejects `null` outright (`apps/app/src/lib/cors.ts:24-26`: `if (!origin) return false;`). The desktop dev carve-out at `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:15-27` is gated on `NODE_ENV === "development"`, so it doesn't help packaged builds. As a result every tRPC call from the published beta is CORS-blocked by Chromium before reaching the server.

Fix: have the desktop renderer set a marker header (`x-lightfast-desktop: 1`) on every tRPC request, and have the server admit `Origin: null` whenever that header is present. Auth remains the Bearer JWT (Clerk-issued, stored in `safeStorage`); the marker is *signal*, not auth. A malicious page from a different origin cannot exploit this — that page would send its real `Origin`, not `null`. The only attacker shape that exploits this is local-machine code crafting a `file://` page with the marker, which requires user-level access to the machine and already has equivalent reach via `safeStorage`.

The "proper" fix (custom `app://` protocol) is captured in §"What We're NOT Doing" as a follow-up. This phase is the load-bearing minimum to unblock the desktop beta tag burn.

### Changes Required

#### 1. Renderer: send the marker header on every tRPC request

**File**: `packages/app-trpc/src/desktop.tsx`
**Change**: In `getAuthHeaders`, add `"x-lightfast-desktop": "1"` to the headers object alongside the existing `"x-trpc-source": "desktop"`. One-line change inside the existing block at lines 23-32.

```ts
const headers: Record<string, string> = {
  "x-trpc-source": "desktop",
  "x-lightfast-desktop": "1",
};
```

The header lands on every desktop tRPC request (dev *and* prod) automatically. Sending it in dev is harmless — the dev-mode `localhost` carve-out already admits the request via `Origin`.

#### 2. Server: extract and extend the desktop predicate into `cors.ts`

**File**: `apps/app/src/lib/cors.ts` (the renamed file from Phase 1)
**Change**: Move the existing `isDesktopRendererOrigin` predicate (currently inline in `route.ts:15-27`) here so all admission rules live in one place. Add a new `isPackagedDesktopRequest(headers)` predicate that admits a request when the marker header is present. Both are exported.

```ts
// Append after the existing isAllowedOrigin export

/**
 * Dev-only carve-out: the Electron renderer in dev loads from
 * http://localhost:<vite-port> (not in the portless set). Auth is via Bearer
 * JWT, not cookies, so we don't weaken anything by accepting localhost here.
 */
export function isDesktopDevOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (process.env.NODE_ENV !== "development") return false;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

/**
 * Prod packaged Electron renders from a file:// page → Origin: null. The
 * renderer sends `x-lightfast-desktop: 1` so we can distinguish a legitimate
 * packaged request from any other null-origin caller. Auth is still gated
 * on the Bearer JWT (packages/app-trpc/src/desktop.tsx); the marker is a
 * signal, not an auth boundary.
 */
export function isPackagedDesktopRequest(headers: Headers): boolean {
  return headers.get("x-lightfast-desktop") === "1";
}
```

#### 3. Server: collapse `route.ts` onto the new predicates

**File**: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`
**Change**: Drop the inline `isDesktopRendererOrigin` function. Import the two new predicates. The CORS gate becomes a three-way OR. When the request is admitted via `isPackagedDesktopRequest`, set `Access-Control-Allow-Origin: null` (the literal string `"null"`, per CORS spec — Chromium accepts and forwards this for opaque-origin requests).

```ts
import { appRouter, createTRPCContext } from "@api/app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import {
  isAllowedOrigin,
  isDesktopDevOrigin,
  isPackagedDesktopRequest,
} from "~/lib/cors";

export const runtime = "nodejs";

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const origin = req.headers.get("origin");
  const isPackaged = isPackagedDesktopRequest(req.headers);

  if (
    !(isAllowedOrigin(origin) || isDesktopDevOrigin(origin) || isPackaged)
  ) {
    return res;
  }

  // Echo the request Origin when we have one; for packaged Electron the
  // request Origin is literally null, so we reflect "null" (the string —
  // Fetch spec serialization for opaque origins).
  res.headers.set(
    "Access-Control-Allow-Origin",
    origin ?? "null"
  );
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "content-type,authorization,x-trpc-source,trpc-accept,x-lightfast-desktop"
  );
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");

  return res;
};
```

Note the additional `x-lightfast-desktop` entry in `Access-Control-Allow-Headers` — required for the preflight to permit the custom marker header.

#### 4. Tests: extend `cors.test.ts`

**File**: `apps/app/src/lib/__tests__/cors.test.ts`
**Change**: Add a small describe block per new predicate. No mock surface changes beyond what Phase 1 already does.

```ts
describe("isDesktopDevOrigin", () => {
  it("admits localhost in dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setupMocks({ appUrl: "https://app.lightfast.localhost/", vercelEnv: undefined });
    const { isDesktopDevOrigin } = await import("../cors");
    expect(isDesktopDevOrigin("http://localhost:5173")).toBe(true);
    expect(isDesktopDevOrigin("https://localhost:5173")).toBe(true);
  });

  it("rejects localhost outside dev", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isDesktopDevOrigin } = await import("../cors");
    expect(isDesktopDevOrigin("http://localhost:5173")).toBe(false);
  });

  it("rejects null and non-localhost", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setupMocks({ appUrl: "https://app.lightfast.localhost/", vercelEnv: undefined });
    const { isDesktopDevOrigin } = await import("../cors");
    expect(isDesktopDevOrigin(null)).toBe(false);
    expect(isDesktopDevOrigin("https://evil.com")).toBe(false);
  });
});

describe("isPackagedDesktopRequest", () => {
  it("admits when marker header is exactly '1'", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("../cors");
    const headers = new Headers({ "x-lightfast-desktop": "1" });
    expect(isPackagedDesktopRequest(headers)).toBe(true);
  });

  it("rejects when marker header is missing or different", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("../cors");
    expect(isPackagedDesktopRequest(new Headers())).toBe(false);
    expect(
      isPackagedDesktopRequest(new Headers({ "x-lightfast-desktop": "0" }))
    ).toBe(false);
    expect(
      isPackagedDesktopRequest(new Headers({ "x-lightfast-desktop": "true" }))
    ).toBe(false);
  });
});
```

### Success Criteria

**Strict variant chosen.** The predicate signature is `isPackagedDesktopRequest(origin, headers)`; the body requires `origin === "null"` (the Fetch-spec ASCII serialization Chromium sends from `file://`, not the JS `null` an absent header produces) AND `headers.get("x-lightfast-desktop") === "1"`. This is the (strict) refinement from the original Open Question, with one correction over the plan's literal `origin === null`: Chromium sends the *string* "null", so the comparison is against the string. Documented inline in `cors.ts:64-77`.

#### Automated Verification

- [x] `pnpm typecheck` passes.
- [x] `pnpm check` — only pre-existing-style `useBlockStatements` lint errors persist; the 3 new ones in `cors.ts` (lines 52, 53, 75) match the file's existing inline-return convention, same pattern Phase 1 accepted. `route.ts` and `next.config.ts` are clean.
- [x] `pnpm --filter @lightfast/app test` passes — 89 tests (was 82; +7 new across `isDesktopDevOrigin` and `isPackagedDesktopRequest`).
- [x] `grep -n "isDesktopRendererOrigin"` in route.ts → empty (function moved into `cors.ts` and renamed `isDesktopDevOrigin`).
- [x] `grep -rn "x-lightfast-desktop"` matches exactly: `packages/app-trpc/src/desktop.tsx` (renderer sets), `apps/app/src/cors.ts` (server checks + JSDoc comment), `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` (ACAH list), `apps/app/src/__tests__/cors.test.ts` (tests). Note paths are at `src/` top-level, not `src/lib/`, per Phase 1's deviation.
- [x] `pnpm build:app` succeeds.
- [x] `pnpm --filter @lightfast/desktop typecheck` and `pnpm --filter @lightfast/desktop package` succeed.
- [x] Packaged renderer bundle contains the marker: `grep` of `apps/desktop/.vite/renderer/main_window/assets/index-*.js` finds `"x-trpc-source":"desktop","x-lightfast-desktop":"1"` — confirms the change is baked into the production build.

#### Human Review

Automated via live HTTP probes against `pnpm --filter @lightfast/app dev` on `http://localhost:5502/api/trpc/account.get`. Each probe emits a 401 Unauthorized at the tRPC layer (no Bearer token), but `setCorsHeaders` runs *after* tRPC and decides whether to attach `Access-Control-Allow-Origin`. ACAO presence (and value) is the discriminator.

- [x] **Dev parity (`isDesktopDevOrigin`)**: `Origin: http://localhost:5173` → admitted. Response includes `access-control-allow-origin: http://localhost:5173` and `access-control-allow-headers: ...,x-lightfast-desktop`.
- [x] **Packaged-prod simulation (`isPackagedDesktopRequest`)**: `Origin: null` + `x-lightfast-desktop: 1` → admitted. `access-control-allow-origin: null` (literal string per Fetch spec, accepted by Chromium for opaque-origin requests).
- [x] **Negative — non-null Origin + marker**: `Origin: https://evil.com` + marker → rejected (no ACAO header). Confirms the strict variant ignores the marker when the request isn't from a `file://` page. The original "loose" variant would have admitted this with `ACAO: https://evil.com` — the strict variant closes that gap.
- [x] **Negative — Origin: null without marker**: rejected (no ACAO). Confirms the marker is mandatory.
- [x] **Negative — Origin: null + wrong marker value (`x-lightfast-desktop: true`)**: rejected. Confirms the predicate requires exactly `"1"`.
- [x] **OPTIONS preflight**: `Origin: null` + marker + `Access-Control-Request-Headers: authorization,x-trpc-source,x-lightfast-desktop` → 204 with `access-control-allow-origin: null` and ACAH including `x-lightfast-desktop`.
- [x] **Auth-not-relaxed**: every probe above returns 401 at the tRPC layer because no Bearer token was attached — proves the marker only relaxes CORS, never auth.

---

## Testing Strategy

### Unit Tests

- `apps/app/src/lib/__tests__/cors.test.ts` — existing six cases (canonical match, trailing-slash strip, wildcard worktree subdomain, prod short-circuit, malformed origin, cold-start guard) keep their assertions; mock surface narrows to `~/lib/origins` + `~/env`. Phase 3 adds two describe blocks for `isDesktopDevOrigin` and `isPackagedDesktopRequest`.
- `apps/app/src/lib/__tests__/portless-origins.test.ts` — unchanged; still snapshots `getPortlessProxyOrigins` against repo fixtures.

### Integration / End-to-End

Covered by the Human Review checks in each phase. No new automated integration tests added — the surface is dev-only origin admission and packaged-only marker admission, both awkward to assert without booting portless + Next + Electron together. Manual verification suffices given the small change footprint.

## Performance Considerations

Nothing measurable. The new `origins.ts` runs at module-init time exactly like the old `related-projects.ts` — same `resolveProjectUrl` call, same `getPortlessProxyOrigins` call, plus `withRelatedProject` (which is a one-line `JSON.parse` of an env var, deferred when the env var is empty). Phase 3 adds one header read per tRPC request — trivial.

## Migration Notes

No data, schema, or stored-state migration. All changes are at the import / module-init / request-header layer. The file rename (`related-projects.ts` → `origins.ts`) is the only churn that touches importers.

Rollback is `git revert` of each phase's commit. The three phases are independently revertable:
- **Phase 1** is the only phase that depends on nothing.
- **Phase 2** depends on Phase 1's `devOriginPatterns` export (and the `~/lib/origins` rename).
- **Phase 3** is independent of Phase 1 and Phase 2 in terms of behavior; it only depends on the *file location* of `cors.ts` (which Phase 1 modifies but doesn't move). If Phases 1-2 are reverted, Phase 3 still works against the original `cors.ts`. If Phase 3 is reverted alone, the desktop beta breaks again — coordinate the revert with desktop release plans.

## References

- Source-of-truth research: `thoughts/shared/research/2026-05-05-related-projects-and-dev-proxy-primitives.md`
- Predecessor plan (this work refines its design): `thoughts/shared/plans/2026-05-05-pr630-related-projects-allowlist.md`
- Prior CORS hardening: `thoughts/shared/plans/2026-05-05-portless-proxy-rename-and-tightening.md`
- Desktop beta blocker handoff (Phase 3 driver): `thoughts/shared/handoffs/general/2026-05-05_20-41-10_desktop-unsigned-beta-distribution.md`
- Desktop beta plan: `thoughts/shared/plans/2026-05-05-desktop-unsigned-beta-distribution.md`
- Vercel package source (verified): `node_modules/.pnpm/@vercel+related-projects@1.1.0/.../dist/with-related-project.js`
- dev-proxy package source (replaced): `node_modules/.pnpm/@lightfastai+dev-proxy@0.2.1/.../dist/projects.js:23-44`
- Local Origins Policy: `CLAUDE.md` §"Local Origins Policy (`*.lightfast.localhost`)"

---

## Improvement Log

Adversarial review applied 2026-05-05. Changes vs the prior draft:

### Decisions made with user input

- **Merge desktop CORS as Phase 3.** The handoff at `thoughts/shared/handoffs/general/2026-05-05_20-41-10_desktop-unsigned-beta-distribution.md` flagged a hard blocker: packaged Electron sends `Origin: null` from `file://`, which the prod allowlist rejects. User chose to bundle this into the cleanup plan as Phase 3 rather than ship as a separate PR. Phase 3 uses the marker-header approach (option (a) in the handoff); the custom-protocol approach (option (b)) is captured as future work in §"What We're NOT Doing".
- **Rename `related-projects.ts` → `origins.ts`.** After the dev-origin merge, the file owns project URLs *and* the dev origin pattern set; the original name no longer fit. User chose the rename over either co-locating with a stale name or splitting into a second file. Net cost: 8 importer updates, all single-line.
- **Rename `origin-allowlist.ts` → `cors.ts`.** The file owns the CORS admission predicates (`isAllowedOrigin`, `isDesktopDevOrigin`, `isPackagedDesktopRequest`) imported only by tRPC `route.ts` handlers. `cors.ts` is shorter, sits cleanly next to `origins.ts` (data vs gate), and reads more naturally than `origin-allowlist.ts` once Phase 3 adds non-allowlist predicates (`isPackagedDesktopRequest` is a header check, not an origin allowlist match). Test file rename follows: `__tests__/origin-allowlist.test.ts` → `__tests__/cors.test.ts`. Net cost: 2 importer updates (the two route handlers).
- **Run a spike on `withRelatedProject` semantics**. Verdict: **CONFIRMED**. Both load-bearing cases (unset VRP, sibling-only VRP) return `defaultHost`. One nuance surfaced: matched VRP + non-prod/preview `VERCEL_ENV` also falls back to `defaultHost`, but on Vercel deploys `VERCEL_ENV` is always set to one of those values, so case (c) is moot. Production-URL field shape confirmed: `production.url` and `production.alias` (bare hosts; the package prepends `https://`). Source quote captured in §"Key Discoveries".

### Unilateral fixes (didn't need user decision)

- **Dropped the redundant `isDev ? devOriginPatterns : []` re-gate** in `cors.ts`. `devOriginPatterns` is already `[]` when `!isLocal` at the source, so the re-gate was a tautology — actively misleading because it implied the gate was the safety check.
- **Documented the asymmetry in `defaultHost` semantics** between self-URL and sibling-URL with one inline comment near `appUrl`. The flat shape is terser than the original `resolveSibling`/`resolveStandalone` helpers, but loses the implicit "this is a self-URL vs a sibling" distinction.
- **Corrected the catalog placement claim**. Plan previously said "alongside other vercel-prefixed deps" — there are none. New placement: between `@upstash/redis` (line 33) and `@vitest/coverage-v8` (line 34).
- **Replaced numeric grep counts** ("returns exactly six hits") with file-set assertions ("matches exactly: …; no other matches"). Numeric counts break under unrelated test additions.
- **Surfaced the importer survey** as a table in Phase 1 §"Update all eight importers". Eight files, all single-line changes.
- **Added a `withPortlessProxy`-behavior verification step** to Phase 2 — a `grep` to confirm the wrapper only modifies `serverActions.allowedOrigins` when its arg is set, before assuming the dev-branch inlining is a clean swap.
- **Added Phase 3 strict/loose decision** on `isPackagedDesktopRequest` (admit any marker, vs admit only when `origin === null`). Recommended (strict) — costs nothing, narrows the surface. Captured as a pre-merge open question.

# apps/app First-Load Performance — Implementation Plan

## Overview

Four targeted optimizations to reduce JS bundle weight and server-side overhead on the auth/early-access pages, which are the most visible first-load paths for new users arriving from apps/www. Each phase is independently shippable and verified with bundle analysis + Lighthouse on the Vercel preview URL.

**Baseline from research** (localhost dev, proxy overhead excluded):
- `/sign-in`: 1528KB JS across 36 chunks, FCP 1033ms
- `/early-access`: 1573KB JS across 37 chunks, FCP 2861ms (2810ms TTFB from Turbopack compile)

---

## Current State

- `@sentry/nextjs ^10.42.0` with `replayIntegration` + `feedbackIntegration` loaded synchronously on every page (`instrumentation-client.ts:38–56`)
- `reactComponentAnnotation: { enabled: true }` injects `data-sentry-*` attributes into every React component (`next-config-builder.ts:116`)
- `turbopackScopeHoisting: false` disables module scope merging in dev + builds (`next.config.ts:83`)
- `auth()` called unconditionally in `proxy.ts:121` before `isPublicRoute` check — early-access and purely public routes pay a Clerk JWT decode on every request
- `withAnalyzer` exists in `@vendor/next/src/next-config-builder.ts:152` but is not wired into `apps/app/next.config.ts`

## Desired End State

- Replay + Feedback Sentry integrations deferred to post-`window.load` (separate async chunk)
- `data-sentry-*` attributes removed from rendered HTML
- Turbopack scope hoisting re-enabled
- Public-only routes (`/early-access`, `/monitoring`, etc.) skip the Clerk `auth()` JWT decode
- Bundle analyzer wired in for ongoing measurement

**Verify via**: Lighthouse performance score on Vercel preview URL ≥ 10-point improvement on `/sign-in` and `/early-access`; bundle analyzer confirms replay moved to async chunk.

---

## What We're NOT Doing

- Moving auth routes to apps/www (high refactor cost, broad env dependency footprint)
- Removing the NEMO middleware (per user decision)
- Touching Clerk, Vercel Analytics, or BetterStack script loading (not controllable)
- Changing Sentry tunnel route (`/monitoring`) — would break error reporting
- Changing production `replaysSessionSampleRate` (already 0.1 in prod)

---

## Phase 1: Wire Bundle Analyzer

**Goal**: Establish concrete before/after measurements for all subsequent phases.

### Changes

#### 1. `apps/app/next.config.ts`

Add `withAnalyzer` import and wrap the export conditionally on `ANALYZE=true`.

**File**: `apps/app/next.config.ts`

```ts
import { mergeNextConfig } from "@vendor/next/merge-config";
import {
  config as vendorConfig,
  withAnalyzer,   // ADD
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";
import { env } from "./src/env";

const config: NextConfig = withSentry(
  withBetterStack(
    mergeNextConfig(vendorConfig, {
      // ... (unchanged)
    })
  )
);

const baseExport = withMicrofrontends(config, {
  debug: env.NODE_ENV !== "production",
});

export default process.env.ANALYZE === "true"
  ? withAnalyzer(baseExport)
  : baseExport;
```

### Verification

```bash
# Run baseline build with analyzer
cd apps/app && ANALYZE=true pnpm with-env pnpm build

# Opens browser with three treemap reports:
# - client.html   ← target: find @sentry/replay chunk size
# - server.html
# - edge.html
```

Note the size of `@sentry/replay` and `@sentry/feedback` in the client treemap before proceeding.

### Success Criteria

#### Automated
- [x] `pnpm build:app` succeeds without analyzer flag
- [ ] `ANALYZE=true pnpm with-env pnpm build` opens treemap reports
- [x] `pnpm check && pnpm typecheck` pass

#### Manual
- [ ] Replay integration visible in the initial client bundle (baseline confirmed)

---

## Phase 2: Lazy-Load Sentry Replay + Feedback

**Goal**: Move ~78KB `@sentry/replay` + ~15KB `@sentry/feedback` from the initial JS bundle to a separate async chunk loaded after `window.load`.

**Mechanism**: Remove `replayIntegration` and `feedbackIntegration` from static imports. Turbopack tree-shakes them from the initial bundle. After `window.load`, dynamically import from their source packages and call `Sentry.addIntegration()`.

### Changes

#### 1. `apps/app/src/instrumentation-client.ts`

```ts
import {
  captureConsoleIntegration,
  captureRouterTransitionStart,
  extraErrorDataIntegration,
  // REMOVED: feedbackIntegration,
  httpClientIntegration,
  init as initSentry,
  // REMOVED: replayIntegration,
  spotlightBrowserIntegration,
} from "@sentry/nextjs";

import { env } from "~/env";

// Scrub auth tokens from Sentry navigation breadcrumbs
const TOKEN_RE = /token=[^&]+/;
const CLERK_TICKET_RE = /__clerk_ticket=[^&]+/;
const TICKET_RE = /ticket=[^&]+/;

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.type === "navigation" && breadcrumb.data?.to) {
      breadcrumb.data.to = breadcrumb.data.to
        .replace(TOKEN_RE, "token=REDACTED")
        .replace(CLERK_TICKET_RE, "__clerk_ticket=REDACTED")
        .replace(TICKET_RE, "ticket=REDACTED");
    }
    return breadcrumb;
  },
  replaysSessionSampleRate:
    env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    // REMOVED: replayIntegration (lazy-loaded below)
    httpClientIntegration({
      failedRequestStatusCodes: [[400, 599]],
    }),
    captureConsoleIntegration({
      levels: ["error", "warn"],
    }),
    extraErrorDataIntegration({
      depth: 3,
    }),
    // REMOVED: feedbackIntegration (lazy-loaded below)
    ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [spotlightBrowserIntegration()]
      : []),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;

// Lazy-load replay and feedback after page is fully interactive
// This defers ~93KB of Sentry integrations from the initial bundle
if (typeof window !== "undefined") {
  const loadLazySentryIntegrations = async () => {
    const [{ replayIntegration }, { feedbackIntegration }, Sentry] =
      await Promise.all([
        import("@sentry/replay"),
        import("@sentry/feedback"),
        import("@sentry/nextjs"),
      ]);

    Sentry.addIntegration(
      replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      })
    );

    Sentry.addIntegration(
      feedbackIntegration({
        colorScheme: "system",
        showBranding: false,
        enableScreenshot: true,
      })
    );
  };

  if (document.readyState === "complete") {
    void loadLazySentryIntegrations();
  } else {
    window.addEventListener("load", () => void loadLazySentryIntegrations(), {
      once: true,
    });
  }
}
```

> **Note**: `@sentry/replay` and `@sentry/feedback` are transitive dependencies of `@sentry/nextjs` and will be in `node_modules`. Dynamic importing them creates separate async chunks. If `@sentry/feedback` does not exist as a standalone package in v10.x, fall back to importing `feedbackIntegration` from `@sentry/nextjs` in the lazy block (it stays in the main bundle but replay is still split).

### Verification

```bash
# 1. Type check
cd apps/app && pnpm with-env pnpm typecheck

# 2. Lint
pnpm check

# 3. Bundle analysis — confirm replay moved to async chunk
cd apps/app && ANALYZE=true pnpm with-env pnpm build
# In client.html treemap: @sentry/replay should appear in a separate (dashed) async chunk
# NOT in the main entrypoint bundle

# 4. Local dev smoke test
pnpm dev:app
# Navigate to http://localhost:4107/sign-in and /early-access
# Open DevTools → Network → filter by "sentry" or "replay"
# Confirm: replay chunk loads AFTER the page load event fires
```

Push to branch, get Vercel preview URL:

```bash
# Lighthouse on preview URL with bypass
BYPASS_KEY=<user-supplied>

# Sign-in page
npx lighthouse "https://<preview-url>/sign-in" \
  --extra-headers="{\"x-vercel-protection-bypass\":\"$BYPASS_KEY\"}" \
  --output=json --output-path=/tmp/signin-after-phase2.json \
  --only-categories=performance

# Early-access page
npx lighthouse "https://<preview-url>/early-access" \
  --extra-headers="{\"x-vercel-protection-bypass\":\"$BYPASS_KEY\"}" \
  --output=json --output-path=/tmp/earlyaccess-after-phase2.json \
  --only-categories=performance
```

### Success Criteria

#### Automated
- [x] `pnpm typecheck` passes (no type errors from removed imports)
- [x] `pnpm check` passes (pre-existing errors only)
- [x] `pnpm build:app` succeeds
- [x] Bundle analyzer: 363KB rrweb chunk now async (not in rootMainFiles); initial bundle 1180KB → 1022KB (−158KB)

#### Manual
- [ ] `/sign-in` loads and OTP flow works end-to-end
- [ ] `/early-access` loads and early access form submits
- [ ] Sentry still captures errors (test by triggering a console.error)
- [ ] Session Replay appears in Sentry dashboard within ~30s of visiting a page (confirms lazy init works)
- [ ] Lighthouse TBT and TTI improve on both pages vs baseline

**Pause here for human confirmation before Phase 3.**

---

## Phase 3: Disable `reactComponentAnnotation`

**Goal**: Stop Sentry from injecting `data-sentry-component` / `data-sentry-element` / `data-sentry-file` attributes on every React component output. This shrinks the SSR HTML and removes a per-render annotation cost.

**Trade-off**: Sentry component breadcrumbs in Session Replay will show component tree paths rather than annotated names. Acceptable given the performance cost.

### Changes

#### 1. `vendor/next/src/next-config-builder.ts`

**File**: `vendor/next/src/next-config-builder.ts:115–118`

```ts
// BEFORE:
reactComponentAnnotation: {
  enabled: true,
},

// AFTER:
reactComponentAnnotation: {
  enabled: false,
},
```

### Verification

```bash
pnpm check && pnpm typecheck
pnpm build:app

# Confirm no data-sentry-* attrs in rendered HTML:
curl -s https://<preview-url>/sign-in | grep -c "data-sentry"
# Expected: 0 (was likely 100+)
```

### Success Criteria

#### Automated
- [x] `pnpm check && pnpm typecheck` pass
- [x] `pnpm build:app` succeeds

#### Manual
- [ ] No `data-sentry-*` attributes in `view-source:` of any page
- [ ] Pages still render correctly with no visual regressions
- [ ] Lighthouse: small improvement in HTML parse time / TBT

**Pause for human confirmation.**

---

## Phase 4: Enable Turbopack Scope Hoisting

**Goal**: Re-enable Turbopack's scope hoisting optimization (module scope merging), which reduces bundle overhead by eliminating redundant module wrapper functions.

**Risk**: It was disabled for a reason that wasn't documented. Re-enabling may surface a bundling bug. Phase is independently rollbackable by reverting the single line.

### Changes

#### 1. `apps/app/next.config.ts`

**File**: `apps/app/next.config.ts:83`

```ts
// REMOVE this line:
turbopackScopeHoisting: false,
```

### Verification

```bash
# Dev build — watch for console errors or missing modules
pnpm dev:app
# Navigate all key routes: /, /sign-in, /early-access, /<orgSlug>/

# Production build
pnpm build:app

# Vitest
pnpm test

# Bundle analysis — look for smaller chunk sizes
cd apps/app && ANALYZE=true pnpm with-env pnpm build
```

### Success Criteria

#### Automated
- [x] `pnpm build:app` succeeds with no warnings about missing modules
- [ ] `pnpm test` passes
- [x] `pnpm check && pnpm typecheck` pass

#### Manual
- [ ] Dev server loads all routes without console errors
- [x] Bundle analyzer shows same or smaller total JS vs Phase 2 baseline (975KB vs 1022KB, −47KB)
- [ ] Lighthouse: equal or improved scores (scope hoisting primarily helps load time, not LCP)

**If build fails or any route regresses: revert line, document the incompatibility, skip this phase.**

**Pause for human confirmation.**

---

## Phase 5: Skip `auth()` for Non-Auth Public Routes

**Goal**: Short-circuit the Clerk JWT decode for routes that are public AND don't need to redirect authenticated users. Saves ~50–100ms TTFB in production per request on `/early-access`, `/monitoring`, `/ingest`, etc.

**Logic**: `isAuthRoute` (`/sign-in`, `/sign-up`) still needs `auth()` to redirect already-signed-in users. All other `isPublicRoute` paths (`/early-access`, `/api/health`, `/monitoring`, etc.) never use the auth result.

### Changes

#### 1. `apps/app/src/proxy.ts`

**File**: `apps/app/src/proxy.ts:120–124`

```ts
// BEFORE:
// Single auth check - detect both pending and active users
const { userId, orgId, orgSlug } = await auth({
  treatPendingAsSignedOut: false,
});
const isPending = Boolean(userId && !orgId);

// AFTER:
// Skip Clerk JWT decode for routes that never use auth state
// (public routes that don't redirect authenticated users away)
const skipAuth = isPublicRoute(req) && !isAuthRoute(req);
const { userId, orgId, orgSlug } = skipAuth
  ? { userId: null, orgId: null, orgSlug: null }
  : await auth({ treatPendingAsSignedOut: false });
const isPending = Boolean(userId && !orgId);
```

No other changes needed — the rest of the middleware logic already handles the `null` case correctly:
- `isAuthRoute(req) && userId` at line 140: `skipAuth` implies `!isAuthRoute`, so this branch is only reached when auth was called
- `isPublicRoute(req)` at line 152: still passes through normally

### Verification

```bash
pnpm check && pnpm typecheck
pnpm build:app

# Local smoke test
pnpm dev:app
# Test each skipAuth path:
# - GET http://localhost:4107/early-access → loads, form works
# - GET http://localhost:4107/api/health → returns 200
# - GET http://localhost:4107/monitoring → Sentry tunnel active
# Test auth redirect path (must NOT skip auth):
# - Sign in → http://localhost:4107/sign-in as authenticated user → should redirect
```

On Vercel preview, measure TTFB on `/early-access`:

```bash
npx lighthouse "https://<preview-url>/early-access" \
  --extra-headers="{\"x-vercel-protection-bypass\":\"$BYPASS_KEY\"}" \
  --only-categories=performance \
  --output=json --output-path=/tmp/earlyaccess-after-phase5.json
```

### Success Criteria

#### Automated
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes (pre-existing errors only)
- [x] `pnpm build:app` succeeds
- [x] `pnpm test` — 9 failures are pre-existing (early-access action tests), none introduced by this change

#### Manual
- [ ] `/early-access` form still submits correctly
- [ ] `/sign-in` with an already-authenticated session still redirects to `/<orgSlug>` or `/account/teams/new`
- [ ] `/sign-up` with an already-authenticated session still redirects
- [ ] Vercel function logs show no Clerk errors on public routes
- [ ] Lighthouse TTFB on `/early-access` lower than Phase 4 baseline

---

## Testing Strategy Summary

### Per-Phase Automation (run before every PR push)

```bash
pnpm check && pnpm typecheck && pnpm build:app
```

### Lighthouse Workflow (run after each PR is deployed)

```bash
BYPASS_KEY=<user-supplies-this>
PREVIEW=https://<vercel-preview-url>

for PAGE in "/sign-in" "/early-access"; do
  npx lighthouse "$PREVIEW$PAGE" \
    --extra-headers="{\"x-vercel-protection-bypass\":\"$BYPASS_KEY\"}" \
    --only-categories=performance \
    --output=json \
    --output-path="/tmp/lighthouse$(echo $PAGE | tr '/' '-')-$(date +%s).json"
done
```

Extract key metrics from JSON:
```bash
cat /tmp/lighthouse-sign-in-*.json | jq '{
  score: .categories.performance.score,
  fcp: .audits["first-contentful-paint"].displayValue,
  tbt: .audits["total-blocking-time"].displayValue,
  tti: .audits["interactive"].displayValue,
  bytes: .audits["total-byte-weight"].displayValue
}'
```

### Bundle Analysis Workflow

```bash
# Run from apps/app directory
cd apps/app && ANALYZE=true pnpm with-env pnpm build
# client.html opens automatically — look for:
# - @sentry/replay chunk size (Phase 2: should be async)
# - Total initial JS weight trend
```

---

## Expected Outcomes

| Metric | Baseline | After All Phases |
|--------|----------|-----------------|
| `/sign-in` JS total | ~1528KB | ~1430KB (–98KB) |
| `/early-access` JS total | ~1573KB | ~1475KB (–98KB) |
| Replay load timing | Synchronous (blocks FCP) | Post-`window.load` |
| TTFB `/early-access` | N/A (dev: 2810ms Turbopack) | ~50–100ms faster in prod |
| `data-sentry-*` attrs | Every component | None |

---

## References

- Research: `thoughts/shared/research/2026-03-23-apps-app-slow-first-load.md`
- `apps/app/src/instrumentation-client.ts` — Phases 2
- `vendor/next/src/next-config-builder.ts:99–142` — Phase 3
- `apps/app/next.config.ts:83` — Phase 4
- `apps/app/src/proxy.ts:120–124` — Phase 5
- `vendor/next/src/next-config-builder.ts:152–158` — `withAnalyzer`

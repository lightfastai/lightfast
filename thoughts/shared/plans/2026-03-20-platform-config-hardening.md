# apps/platform Config Hardening Implementation Plan

## Overview

Address the actionable production-readiness gaps in `apps/platform` identified in the 2026-03-20 research doc. Platform is a headless API service (JWT auth, no UI) — gaps are scoped to what makes sense for that role.

## Current State Analysis

`apps/platform` was recently consolidated from Hono microservices and is missing several production-critical configurations that `apps/app` has. However, many "gaps" are intentional (Clerk, PostHog, Vercel Analytics, CSP factories, instrumentation-client.ts, etc. are all frontend-only concerns). Only the following gaps are actionable for a headless API service.

## Desired End State

After this plan:
- `apps/platform/next.config.ts` inherits the vendor base config (HSTS, `removeConsole`, `poweredByHeader: false`, HSTS headers) via `@vendor/next`
- BetterStack log drain is wired into the build pipeline via `withBetterStack`
- Sentry config uses vendor's improved config (matching `apps/app`)
- `apps/platform` dev task co-starts the Inngest dev server automatically
- `@vendor/security` is in `transpilePackages`
- `api/platform` has a working Vitest setup so `jwt.test.ts` and future tests can run

### Key Discoveries

- `api/platform/package.json:56-62` already has `vitest`, `@repo/vitest-config` in devDeps and `"test": "vitest run"` script — only `vitest.config.ts` is missing
- Root `turbo.json:39-44` defines the `test` task globally — no package-level turbo config needed
- Root `turbo.json:14` has `"env": ["NEXT_PUBLIC_*"]` wildcard — BetterStack public vars in build cache are already covered; platform-level explicit list is just redundant
- `apps/app/package.json:14` defines `"dev:inngest"` pointing at both ports 3024 AND 4112 — platform can reuse this script directly
- `vendor/next/src/next-config-builder.ts` exports `config as vendorConfig` (wrapped by `withVercelToolbar()`), `withSentry`, `withBetterStack`, and `mergeNextConfig` — all needed for Phase 1
- `api/app/vitest.config.ts:1-21` is the exact pattern to follow for `api/platform`

## What We're NOT Doing

- Adding Clerk, PostHog, Vercel Analytics/SpeedInsights, Knock, CMS, SEO (all frontend-only)
- Adding `instrumentation-client.ts` (no browser)
- Adding CSP factory composition (no browser scripts, pure API)
- Overriding/disabling vendorConfig PostHog rewrites and Vercel Toolbar (harmless for headless service — routes are inert without browser clients)
- Changing the root turbo.json `env` array (wildcard already covers NEXT_PUBLIC_*)
- Adding ngrok co-start to platform dev (ngrok exposes port 3024 via apps/app; OAuth callbacks route through app)
- Adding vitest to `apps/platform` (the Next.js shell has no logic to test; logic lives in `api/platform`)

---

## Implementation Approach

Four phases, each independently verifiable. Phases 1–2 touch `apps/platform` config. Phase 3 fixes DX and transpile list. Phase 4 wires the existing `api/platform` test infrastructure.

---

## Phase 1: Adopt @vendor/next in apps/platform

### Overview

Replace the bare `withSentryConfig` call with the vendor pipeline: `withSentry(withBetterStack(mergeNextConfig(vendorConfig, platformConfig)))`. This gives platform `poweredByHeader: false`, `reactCompiler`, `compiler.removeConsole` in production, HSTS headers, and BetterStack log drain — all from the shared vendor config.

### Changes Required

#### 1. Add @vendor/next dependency

**File**: `apps/platform/package.json`

Add to `dependencies` (keep `@sentry/nextjs` — still needed for `instrumentation.ts`):

```json
"@vendor/next": "workspace:*",
```

#### 2. Rewrite next.config.ts

**File**: `apps/platform/next.config.ts`

Replace current contents:

```typescript
import type { NextConfig } from "next";
import {
  config as vendorConfig,
  mergeNextConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";

const platformConfig: NextConfig = {
  transpilePackages: [
    "@api/platform",
    "@db/app",
    "@repo/app-providers",
    "@repo/lib",
    "@vendor/inngest",
    "@vendor/next",
    "@vendor/observability",
    "@vendor/security",
    "@vendor/upstash",
  ],
  experimental: {
    optimizePackageImports: ["@repo/lib", "@vendor/observability"],
  },
};

export default withSentry(withBetterStack(mergeNextConfig(vendorConfig, platformConfig)));
```

**Why this works:**
- `vendorConfig` provides: `poweredByHeader: false`, `reactCompiler`, `removeConsole`, HSTS headers, `staleTimes`, `optimizeCss`, `/health` rewrite
- `withBetterStack` wires BetterStack log drain into the Next.js build pipeline
- `withSentry` uses the vendor's improved sentryConfig (adds `reactComponentAnnotation`, `tunnelRoute: "/monitoring"`, correct `widenClientFileUpload` logic)
- `mergeNextConfig` deep-merges: `transpilePackages` arrays are de-duplicated, `experimental.optimizePackageImports` is merged with vendor's `["@repo/ui", "lucide-react"]`
- Platform-specific items NOT in `platformConfig` (no `redirects`, no `rewrites`, no `serverActions`, no microfrontends) — vendor config provides `/health` rewrite and HSTS headers which are the only ones needed

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck` passes from `apps/platform/`: `pnpm --filter @lightfast/platform typecheck`
- [ ] Build succeeds: `pnpm --filter @lightfast/platform build` (or `pnpm build:platform`)
- [x] No TS errors on `next.config.ts` — specifically that `mergeNextConfig` accepts `vendorConfig` type

#### Manual Verification
- [ ] Dev server starts: `pnpm dev:platform`
- [ ] `curl -I http://localhost:4112/api/health` — response contains `Strict-Transport-Security` header
- [ ] `curl -I http://localhost:4112/api/health` — response does NOT contain `X-Powered-By: Next.js` header
- [ ] Production build: confirm `console.log` calls stripped (check `.next/server/` bundle)

**Pause here for manual confirmation before Phase 2.**

---

## Phase 2: Sentry Dev Enhancement

### Overview

Add `spotlightIntegration` to the Node.js runtime Sentry init in `instrumentation.ts` for local development, matching the pattern in `apps/app`.

### Changes Required

#### 1. Update instrumentation.ts

**File**: `apps/platform/src/instrumentation.ts`

In the `NEXT_RUNTIME === "nodejs"` branch, add `spotlightIntegration` conditionally:

```typescript
// Add to imports at top:
import { spotlightIntegration } from "@sentry/nextjs";

// In the nodejs init block, extend the integrations array:
integrations: [
  captureConsoleIntegration({ levels: ["error", "warn"] }),
  extraErrorDataIntegration({ depth: 3 }),
  ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
    ? [spotlightIntegration()]
    : []),
],
```

This matches `apps/app/src/instrumentation.ts` pattern (minus spotlight in edge runtime which is unsupported there).

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck` passes: `pnpm --filter @lightfast/platform typecheck`
- [ ] `pnpm check` passes (biome/lint)

#### Manual Verification
- [ ] `pnpm dev:platform` — Spotlight UI accessible at `http://localhost:8969` during local dev
- [ ] Sentry errors triggered in dev are visible in Spotlight

**Pause here for manual confirmation before Phase 3.**

---

## Phase 3: turbo.json and transpilePackages DX

### Overview

Wire Inngest dev server co-start into `apps/platform/turbo.json` and add a `transit` task. Add `@vendor/security` to `transpilePackages` (already done in Phase 1 via the new `platformConfig`).

### Changes Required

#### 1. Update dev task with Inngest co-start

**File**: `apps/platform/turbo.json`

Update `dev` task:

```json
"dev": {
  "persistent": true,
  "with": ["@lightfast/app#dev:inngest"]
}
```

The `dev:inngest` script in `apps/app/package.json` already targets both `http://localhost:3024/api/inngest` and `http://localhost:4112/api/inngest` — no script changes needed.

#### 2. Add transit task

**File**: `apps/platform/turbo.json`

Add after `dev` task:

```json
"transit": {}
```

This is an empty pass-through matching the pattern in `apps/app/turbo.json:73`.

### Success Criteria

#### Automated Verification
- [ ] `pnpm dev:platform` — Inngest dev server starts alongside Next.js dev server
- [ ] Inngest dashboard accessible at `http://localhost:8288`
- [ ] `pnpm check` passes (no lint errors in turbo.json if linted)

#### Manual Verification
- [ ] Kill all servers, run `pnpm dev:platform`, confirm Inngest starts at port 8288 without running `pnpm dev:app`
- [ ] Platform Inngest functions visible in Inngest dashboard at `http://localhost:8288`

**Pause here for manual confirmation before Phase 4.**

---

## Phase 4: Vitest Setup for api/platform

### Overview

`api/platform` has `vitest` and `@repo/vitest-config` already installed, `"test": "vitest run"` script defined, and one existing test (`src/lib/jwt.test.ts`). Only `vitest.config.ts` and a `server-only` mock are missing.

### Changes Required

#### 1. Create vitest.config.ts

**File**: `api/platform/vitest.config.ts`

Modeled exactly after `api/app/vitest.config.ts:1-21`:

```typescript
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: {
        // Stub server-only so tests don't throw "This module cannot be imported from a Client Component module"
        "server-only": new URL(
          "./src/__mocks__/server-only.ts",
          import.meta.url
        ).pathname,
      },
    },
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

#### 2. Create server-only mock

**File**: `api/platform/src/__mocks__/server-only.ts`

```typescript
// no-op stub — allows server-only imports in test environment
export {};
```

### Success Criteria

#### Automated Verification
- [x] Existing JWT test runs: `pnpm --filter @api/platform test`
- [x] Test passes without env validation errors (jwt.test.ts may need `SKIP_ENV_VALIDATION=1` or mock — check the test)
- [ ] `pnpm test` from root runs `api/platform` tests via turborepo
- [x] `pnpm typecheck` passes: `pnpm --filter @api/platform typecheck`

#### Manual Verification
- [x] `cd api/platform && pnpm test` — `jwt.test.ts` passes
- [x] No "Cannot find module 'server-only'" errors

**Implementation complete.**

---

## Testing Strategy

### Per-phase automated checks
Each phase has its own `pnpm typecheck` and `pnpm build` (or `pnpm test`) gate before proceeding.

### Full integration check after all phases
```bash
pnpm build:platform      # Full Next.js build with vendor config chain
pnpm --filter @api/platform test  # JWT and future tests
pnpm check               # Biome lint across all changed files
pnpm typecheck           # Full monorepo type check
```

---

## Migration Notes

- Phase 1 removes the direct `withSentryConfig` import from `@sentry/nextjs` in `next.config.ts` — the `@sentry/nextjs` dep stays in `package.json` because `instrumentation.ts` still imports from it directly
- `@vendor/next` adds Vercel Toolbar and PostHog rewrites to platform — these are inert for a headless service (no browser clients call those routes) but are inherited as part of the vendor config; not worth overriding
- The `NEXT_PUBLIC_BETTERSTACK_*` vars in `apps/platform/turbo.json` build `env` are intentionally NOT added — they're already covered by the root turbo.json wildcard `NEXT_PUBLIC_*`

---

## References

- Research document: `thoughts/shared/research/2026-03-20-apps-app-vs-platform-setup-gaps.md`
- Vendor config builder: `vendor/next/src/next-config-builder.ts`
- Merge config: `vendor/next/src/merge-config.ts`
- apps/app next.config reference: `apps/app/next.config.ts`
- apps/app instrumentation reference: `apps/app/src/instrumentation.ts`
- api/app vitest reference: `api/app/vitest.config.ts`
- api/app server-only mock reference: `api/app/src/__mocks__/server-only.ts`
- apps/app turbo.json (dev:inngest pattern): `apps/app/turbo.json`
- apps/app package.json (dev:inngest script): `apps/app/package.json:14`

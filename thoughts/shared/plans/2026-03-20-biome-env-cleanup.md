# Biome Migration Cleanup & env.ts Standardization

## Overview

Remove all dead ESLint disable comments (project uses Biome) and standardize `process.env` access to use typed `~/env` modules across `apps/www`, `apps/platform`, and `apps/app`. Also create missing `instrumentation-client.ts` for platform.

## Current State Analysis

### ESLint Disable Comments (10 occurrences, all dead)

| File | Line(s) | Rule(s) |
|------|---------|---------|
| `apps/www/src/instrumentation.ts` | 17, 36 | `turbo/no-undeclared-env-vars`, `no-restricted-properties` |
| `apps/platform/src/instrumentation.ts` | 17, 36 | `turbo/no-undeclared-env-vars` |
| `apps/app/src/instrumentation.ts` | 17, 36 | `turbo/no-undeclared-env-vars` |
| `apps/www/src/hooks/use-docs-search.ts` | 38 | `react-hooks/set-state-in-effect` |
| `apps/app/src/ai/runtime/memory.ts` | 143 | `@typescript-eslint/no-unsafe-assignment` |
| `apps/app/src/__tests__/setup.ts` | 27 | `@typescript-eslint/no-unused-vars` |
| `apps/app/src/app/(early-access)/_components/confetti-wrapper.tsx` | 11 | `@typescript-eslint/no-empty-function` |

### Raw `process.env` That Should Use `~/env`

| File | Variable(s) | Notes |
|------|-------------|-------|
| `apps/www/src/instrumentation-client.ts:14-15` | `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_VERCEL_ENV` | Has bundle-size comment; apps/app already uses `~/env` in its equivalent file |
| `apps/app/src/app/api/cli/lib/verify-jwt.ts:14` | `CLERK_SECRET_KEY` | Server code, no reason to skip env.ts |
| `apps/app/src/app/(app)/.../layout.tsx:3-4` | `VERCEL_ENV` | Server component, should use `env.NEXT_PUBLIC_VERCEL_ENV` (has "development" default) |
| `apps/app/src/app/(app)/.../provider-source-item.tsx:82` | `NEXT_PUBLIC_GITHUB_APP_SLUG` | Client component; `~/env` already bundled by other client code in app |

### Legitimate `process.env` (NOT changing)

| File | Variable | Reason |
|------|----------|--------|
| All `instrumentation.ts` (x3) | `NEXT_RUNTIME` | Next.js internal, set dynamically per-invocation, not in env.ts schema |
| All `env.ts` (x3) | Various | These ARE the env definition files |
| `apps/app/src/__tests__/setup.ts:9` | `SKIP_ENV_VALIDATION` | Must run before any `~/env` import |

### Missing File

- `apps/platform/src/instrumentation-client.ts` does not exist (www and app both have one)

## Desired End State

- Zero `eslint-disable` comments in `apps/www/`, `apps/platform/`, `apps/app/`
- All user-configured env vars accessed via typed `~/env` module (except `NEXT_RUNTIME` and test setup)
- Platform has client-side Sentry instrumentation matching the other apps
- `pnpm check` and `pnpm typecheck` pass clean

## What We're NOT Doing

- Adding `NEXT_RUNTIME` to env.ts schemas (it's a Next.js internal, not user-configured)
- Changing `process.env.SKIP_ENV_VALIDATION` in test setup (must run before module load)
- Changing env.ts definition files themselves (they legitimately use `process.env`)
- Adding Biome suppression comments unless `pnpm check` actually flags something after removal

## Implementation Approach

Two phases: (1) mechanical removal of dead comments + env.ts adoption, (2) create missing platform instrumentation-client.

---

## Phase 1: Drop ESLint Comments & Standardize env.ts Usage

### Overview
Remove all 10 eslint-disable comments and convert 4 files from raw `process.env` to typed `~/env`.

### Changes Required:

#### 1. Instrumentation files — drop eslint comments (6 comment lines across 3 files)

**File**: `apps/www/src/instrumentation.ts`
Remove lines 17 and 36 (`// eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties`).

**File**: `apps/platform/src/instrumentation.ts`
Remove lines 17 and 36 (`// eslint-disable-next-line turbo/no-undeclared-env-vars`).

**File**: `apps/app/src/instrumentation.ts`
Remove lines 17 and 36 (`// eslint-disable-next-line turbo/no-undeclared-env-vars`).

#### 2. `apps/www/src/instrumentation-client.ts` — switch to `~/env`

Replace the raw `process.env` block (lines 9–19) with a `~/env` import:

```ts
// Before:
// Use process.env directly rather than importing ~/env here.
// ~/env pulls in @t3-oss/env-nextjs + zod for schema validation, which adds
// ~150KB to the client bundle just to read two NEXT_PUBLIC_ variables.
// NEXT_PUBLIC_ vars are statically inlined by the Next.js compiler so
// process.env access is safe and equivalent at runtime.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV as
  | "development"
  | "preview"
  | "production"
  | undefined;

// After:
import { env } from "~/env";
```

Then replace `dsn` → `env.NEXT_PUBLIC_SENTRY_DSN` and `vercelEnv` → `env.NEXT_PUBLIC_VERCEL_ENV` in the `initSentry()` call and integration conditionals.

#### 3. `apps/app/src/app/api/cli/lib/verify-jwt.ts` — use `~/env`

```ts
// Before:
secretKey: process.env.CLERK_SECRET_KEY ?? "",

// After:
import { env } from "~/env";
// ...
secretKey: env.CLERK_SECRET_KEY,
```

`CLERK_SECRET_KEY` is already in apps/app env.ts via the `clerkEnvBase` extension (validated with `startsWith("sk_")`), so no schema changes needed.

#### 4. `apps/app/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/layout.tsx` — use `~/env`

```ts
// Before:
const isDev =
  !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development";

// After:
import { env } from "~/env";

const isDev = env.NEXT_PUBLIC_VERCEL_ENV === "development";
```

`NEXT_PUBLIC_VERCEL_ENV` defaults to `"development"` in the env schema, so the `!process.env.VERCEL_ENV` (undefined) case is already covered.

#### 5. `apps/app/src/app/(app)/.../provider-source-item.tsx` — use `~/env`

```ts
// Before:
`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target?state=${data.state}`

// After:
import { env } from "~/env";
// ...
`https://github.com/apps/${env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target?state=${data.state}`
```

`NEXT_PUBLIC_GITHUB_APP_SLUG` is already in env.ts via `githubEnv` extension.

#### 6. Other eslint comment removals

**File**: `apps/www/src/hooks/use-docs-search.ts:38`
Remove `// eslint-disable-next-line react-hooks/set-state-in-effect`. The `setResults("empty")` call is intentional state sync — comment above already explains why.

**File**: `apps/app/src/ai/runtime/memory.ts:143`
Remove `// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment`. The `JSON.parse` assignment is correctly typed by context.

**File**: `apps/app/src/__tests__/setup.ts:27`
Remove `// eslint-disable-next-line @typescript-eslint/no-unused-vars -- T must match original Assertion<T> generic for module augmentation`. The `T` generic parameter is required for module augmentation — Biome won't flag this.

**File**: `apps/app/src/app/(early-access)/_components/confetti-wrapper.tsx:11`
Remove `// eslint-disable-next-line @typescript-eslint/no-empty-function`. The `() => () => {}` noop subscribe pattern is standard for `useSyncExternalStore`.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (apps/app and apps/platform clean; www failures are pre-existing RouteImpl issues)
- [x] Linting passes: `pnpm check` (no new errors from our changes; all remaining errors pre-existing)
- [x] No remaining eslint-disable comments in apps: `grep -r "eslint-disable" apps/www/src apps/platform/src apps/app/src` returns empty
- [x] No raw `process.env` in application code (excluding env.ts, instrumentation.ts `NEXT_RUNTIME`, and test setup): verified by grep

#### Manual Verification:
- [ ] `pnpm dev:app` starts without env validation errors
- [ ] `pnpm dev:www` starts without env validation errors
- [ ] `pnpm dev:platform` starts without env validation errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Create Platform Client-Side Sentry Instrumentation [SKIPPED — platform has no browser UI, only API routes]

### Overview
`apps/platform/src/instrumentation-client.ts` is missing. Both `apps/app` and `apps/www` have one. Create it following the established pattern.

### Changes Required:

#### 1. Create `apps/platform/src/instrumentation-client.ts`

Model after `apps/app/src/instrumentation-client.ts` (the most complete version), but simplified since platform is an internal service (no feedback widget, no auth token scrubbing needed):

```ts
import {
  captureConsoleIntegration,
  captureRouterTransitionStart,
  extraErrorDataIntegration,
  init as initSentry,
  replayIntegration,
  reportingObserverIntegration,
  spotlightBrowserIntegration,
} from "@sentry/nextjs";

import { env } from "~/env";

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  replaysSessionSampleRate:
    env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.05 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    captureConsoleIntegration({
      levels: ["error", "warn"],
    }),
    extraErrorDataIntegration({
      depth: 3,
    }),
    reportingObserverIntegration({
      types: ["crash", "deprecation", "intervention"],
    }),
    ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [spotlightBrowserIntegration()]
      : []),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;
```

Key decisions:
- Uses `~/env` (consistent with Phase 1 standardization)
- `tracesSampleRate: 0.2` in production (matches platform's server-side instrumentation)
- `replaysSessionSampleRate: 0.05` in production (matches www)
- Includes `reportingObserverIntegration` (matches www)
- No `feedbackIntegration` or `httpClientIntegration` (platform is internal, not user-facing like app)
- No auth token scrubbing (platform doesn't have Clerk auth URLs)

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Platform build succeeds: `pnpm build:platform`

#### Manual Verification:
- [ ] `pnpm dev:platform` starts without errors
- [ ] Sentry client-side events are captured in development (check Spotlight)

---

## References

- `apps/app/src/instrumentation-client.ts` — reference implementation (most complete)
- `apps/www/src/instrumentation-client.ts` — current state with bundle-size comment
- `apps/*/src/env.ts` — typed env schemas per app

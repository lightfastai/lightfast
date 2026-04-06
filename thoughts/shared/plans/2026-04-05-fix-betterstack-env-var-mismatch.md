# Fix BetterStack Env Var Naming Mismatch

## Overview

The Vercel BetterStack integration injects `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN` and `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL`, but our env schemas define `BETTERSTACK_SOURCE_TOKEN` / `NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST` (wrong naming on both axes: `BETTERSTACK` vs `BETTER_STACK`, and `INGESTING_HOST` vs `INGESTING_URL`). The edge logger and edge env have zero consumers and should be deleted.

## Current State Analysis

- `vendor/observability/src/env/betterstack.ts` defines wrong names (`BETTERSTACK_*`, `INGESTING_HOST`)
- `vendor/observability/src/env/betterstack-edge.ts` defines wrong names + has zero consumers
- `vendor/observability/src/log/edge.ts` has zero consumers
- `vendor/observability/src/log/next.ts` works because `@logtail/next` reads env vars directly — our schema is bypassed for token/URL
- All three `turbo.json` files declare the wrong env var names
- Non-`NEXT_PUBLIC` server variants are redundant since Vercel only injects `NEXT_PUBLIC_*` and `@logtail/next` tries those first

### Key Discoveries:

- `@logtail/next` reads `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN` and `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL` directly from `process.env` (`node_modules/.pnpm/@logtail+next@0.3.1_.../dist/platform/generic.js:11-13`)
- `@logtail/edge` does NOT auto-read env vars — purely constructor-based
- No file in the repo imports `@vendor/observability/log/edge` or `@vendor/observability/betterstack-edge-env`
- `betterstackEnv` is extended by all three apps: `apps/app/src/env.ts:20`, `apps/www/src/env.ts:16`, `apps/platform/src/env.ts:10`

## Desired End State

- Env schema uses correct names matching what Vercel injects: `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN`, `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL`
- No server-only variants (redundant)
- Edge env + edge logger deleted (zero consumers, dead code)
- Turbo.json files declare correct env var names
- `pnpm check && pnpm typecheck` passes

## What We're NOT Doing

- Not changing how `@logtail/next` is imported or configured in `next.ts`
- Not changing the `shouldUseBetterStack` production guard in `next.ts`
- Not modifying any app-level `env.ts` files (they just `extends` the betterstack env)
- Not touching sentry or other observability exports

## Implementation Approach

Single phase — all changes are tightly coupled (rename + delete), no intermediate state makes sense.

## Phase 1: Fix Env Names, Delete Dead Code, Update Turbo Configs [DONE]

### Overview

Rename betterstack env vars to match Vercel integration naming, delete unused edge files, update turbo cache keys.

### Changes Required:

#### 1. Fix the Next.js betterstack env schema

**File**: `vendor/observability/src/env/betterstack.ts`
**Changes**: Rename vars, drop server-only variants

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

export const betterstackEnv = createEnv({
  extends: [vercel()],
  shared: {},
  server: {},
  client: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: z.url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL:
      process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
```

#### 2. Delete unused edge files

**Delete**: `vendor/observability/src/env/betterstack-edge.ts`
**Delete**: `vendor/observability/src/log/edge.ts`

#### 3. Remove edge exports from package.json

**File**: `vendor/observability/package.json`
**Changes**: Remove `./betterstack-edge-env` and `./log/edge` export entries

#### 4. Update turbo.json in all three apps

**File**: `apps/app/turbo.json`
**Changes**:
- `env`: `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN` → `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN`, `NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST` → `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL`
- `passThroughEnv`: Remove `BETTERSTACK_SOURCE_TOKEN` and `BETTERSTACK_INGESTING_HOST`

**File**: `apps/www/turbo.json`
**Changes**: Same renames in `env`, remove from `passThroughEnv`

**File**: `apps/platform/turbo.json`
**Changes**: Same renames in `env`, remove from `passThroughEnv`

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] No remaining references to `BETTERSTACK_SOURCE_TOKEN`, `BETTERSTACK_INGESTING_HOST`, `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN`, or `NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST` in source files (excluding thoughts/)
- [x] No remaining imports of `betterstack-edge` or `log/edge` in source files

#### Manual Verification:

- [ ] Verify BetterStack logs appear in production after deploy

## References

- Research: `thoughts/shared/research/2026-04-05-betterstack-env-var-mismatch.md`
- `@logtail/next` env fallback chain: `node_modules/.pnpm/@logtail+next@0.3.1_.../dist/platform/generic.js`

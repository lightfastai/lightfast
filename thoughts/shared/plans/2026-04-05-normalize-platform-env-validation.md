# Normalize Platform Env Validation Patterns

## Overview

Normalize env validation patterns across `apps/platform` and `api/platform` to match established conventions used by their counterparts (`apps/app`, `api/app`). This eliminates inline Inngest var redeclarations, adds missing `extends` composition to `api/platform`, fixes `NODE_ENV` placement, and replaces a hardcoded Inngest app name with env-driven configuration.

## Current State Analysis

### Inconsistencies identified (from research `2026-04-05-env-validation-patterns.md`):

1. **`api/platform/src/env.ts`** — Zero `extends` entries. Every other app/api env file composes vendor envs via `extends`. Also places `NODE_ENV` in `server:` instead of `shared:` and omits it from `experimental__runtimeEnv`.
2. **`apps/platform/src/env.ts`** — Declares `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` inline in `server:`, omitting `INNGEST_APP_NAME` entirely. Should extend `@vendor/inngest/env` (the pattern `apps/www` follows).
3. **`api/platform/src/inngest/client.ts`** — Hardcodes `id: "lightfast-memory"` and omits `eventKey`. The canonical pattern (`api/app/src/inngest/client/client.ts`) reads both from `@vendor/inngest/env`.

## Desired End State

- `api/platform/src/env.ts` extends `[vercel(), sentryEnv, betterstackEnv, upstashEnv]` and declares `NODE_ENV` in `shared:` with corresponding `experimental__runtimeEnv` entry.
- `apps/platform/src/env.ts` extends `inngestEnv` instead of declaring Inngest vars inline, gaining `INNGEST_APP_NAME` validation.
- `api/platform/src/inngest/client.ts` reads `id` and `eventKey` from `@vendor/inngest/env`, matching the `api/app` pattern.
- `INNGEST_APP_NAME=lightfast-memory` is set in platform's Vercel environment.

### Verification:

- `pnpm typecheck` passes
- `pnpm check` passes (lint)
- `pnpm build:platform` succeeds
- Dev server `pnpm dev:platform` starts without env validation errors (requires `INNGEST_APP_NAME` env var)

## What We're NOT Doing

- ENCRYPTION_KEY validation normalization or DRY-up
- Apps/api cross-layer env inheritance (apps extending their api-layer env)
- Creating new vendor env modules
- Changing any env files outside of `apps/platform` and `api/platform`

## Implementation Approach

Three independent file changes that can be verified incrementally. Phase 1 and 2 are independent. Phase 3 depends on the pattern established in Phase 2 (extending `inngestEnv`) but the code change itself is standalone.

---

## Phase 1: `api/platform/src/env.ts` — Add extends, fix NODE_ENV placement [DONE]

### Overview

Add vendor env composition via `extends` and move `NODE_ENV` from `server:` to `shared:` to match every other env file in the codebase.

### Changes Required:

#### 1. `api/platform/src/env.ts`

**File**: `api/platform/src/env.ts`
**Changes**: Add imports for `vercel`, `sentryEnv`, `betterstackEnv`, `upstashEnv`. Add `extends` array. Move `NODE_ENV` to `shared:` block. Add `NODE_ENV` to `experimental__runtimeEnv`.

**Before:**
```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SERVICE_JWT_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z
      .string()
      .min(44)
      // ... refines ...
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  // ...
});
```

**After:**
```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), sentryEnv, betterstackEnv, upstashEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  server: {
    SERVICE_JWT_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z
      .string()
      .min(44)
      // ... refines unchanged ...
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  // ...
});
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:platform` succeeds

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: `apps/platform/src/env.ts` — Replace inline Inngest vars with `inngestEnv` via extends [DONE]

### Overview

Remove the inline `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` declarations from `server:` and instead extend `@vendor/inngest/env`. This gains `INNGEST_APP_NAME` validation (required, must start with `"lightfast-"`) and `INNGEST_SIGNING_KEY` prefix validation (`"signkey-"`), matching the `apps/www` pattern.

### Changes Required:

#### 1. `apps/platform/src/env.ts`

**File**: `apps/platform/src/env.ts`
**Changes**: Add `import { env as inngestEnv } from "@vendor/inngest/env"`. Add `inngestEnv` to `extends` array. Remove `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` from `server:` block.

**Before:**
```ts
import { providerEnv } from "@repo/app-providers/env";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), sentryEnv, betterstackEnv, upstashEnv, providerEnv],
  // ...
  server: {
    SERVICE_JWT_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z.string().min(44),

    // Inngest
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
    INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  },
  // ...
});
```

**After:**
```ts
import { providerEnv } from "@repo/app-providers/env";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { env as inngestEnv } from "@vendor/inngest/env";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), sentryEnv, betterstackEnv, upstashEnv, providerEnv, inngestEnv],
  // ...
  server: {
    SERVICE_JWT_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z.string().min(44),
  },
  // ...
});
```

**What changes for validation:**
- `INNGEST_APP_NAME` is now validated (required, `startsWith("lightfast-")`) — previously absent
- `INNGEST_SIGNING_KEY` gains `startsWith("signkey-")` prefix validation — previously just `min(1)`
- `INNGEST_EVENT_KEY` validation is equivalent (optional, `min(1)`)

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:platform` succeeds

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: `api/platform/src/inngest/client.ts` — Use env vars instead of hardcoded app name [DONE]

### Overview

Replace the hardcoded `id: "lightfast-memory"` with `env.INNGEST_APP_NAME` from `@vendor/inngest/env`, and add `eventKey: env.INNGEST_EVENT_KEY`. This matches the pattern in `api/app/src/inngest/client/client.ts`.

### Changes Required:

#### 1. `api/platform/src/inngest/client.ts`

**File**: `api/platform/src/inngest/client.ts`
**Changes**: Add `import { env } from "@vendor/inngest/env"`. Replace hardcoded `id` with `env.INNGEST_APP_NAME`. Add `eventKey: env.INNGEST_EVENT_KEY`.

**Before:**
```ts
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest } from "@vendor/inngest";
import type { GetEvents } from "inngest";

import { memoryEvents } from "./schemas/memory";

const inngest = new Inngest({
  id: "lightfast-memory",
  schemas: new EventSchemas().fromSchema(memoryEvents),
  middleware: [sentryMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

**After:**
```ts
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { env } from "@vendor/inngest/env";
import type { GetEvents } from "inngest";

import { memoryEvents } from "./schemas/memory";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(memoryEvents),
  middleware: [sentryMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

**Reference**: `api/app/src/inngest/client/client.ts:3,8-10` — identical pattern.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:platform` succeeds

**Implementation Note**: After completing this phase and all automated verification passes, pause for deployment step.

---

## Deployment

### Environment Variable Required

`INNGEST_APP_NAME=lightfast-memory` must be added to the platform's Vercel environment variables (all environments: development, preview, production).

This is required because:
- Phase 2 adds `inngestEnv` to `apps/platform` extends — `@vendor/inngest/env` validates `INNGEST_APP_NAME` as required
- Phase 3 reads `env.INNGEST_APP_NAME` in the Inngest client constructor

Without this env var set, env validation will fail at startup (unless `SKIP_ENV_VALIDATION=1`).

#### Manual Verification:

- [ ] `INNGEST_APP_NAME=lightfast-memory` is set in Vercel for `lightfast-platform`
- [ ] `pnpm dev:platform` starts without env validation errors
- [ ] Inngest dev server shows the platform client connecting with name `lightfast-memory`

## References

- Research: `thoughts/shared/research/2026-04-05-env-validation-patterns.md`
- Reference pattern (inngest client): `api/app/src/inngest/client/client.ts:3,8-10`
- Reference pattern (inngest env extends): `apps/www/src/env.ts:4,20`
- Reference pattern (api extends): `api/app/src/env.ts:9-10`
- Vendor inngest env schema: `vendor/inngest/src/env.ts:7-10`

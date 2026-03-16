# Rework @vendor/observability Logging Layer

## Overview

Restructure `@vendor/observability` to organize logging into `log/next.ts` and `log/edge.ts`, rename all `LOGTAIL_*` env vars to `BETTERSTACK_*`, and make betterstack env composable via `extends: [betterstackEnv]` so edge services stop duplicating env var definitions.

## Current State Analysis

### File structure
```
vendor/observability/src/
  env/betterstack-env.ts   — Next.js env (uses @t3-oss/env-nextjs), mixed LOGTAIL_*/BETTER_STACK_* naming
  env/sentry-env.ts        — unchanged
  log.ts                   — Next.js logger (uses @logtail/next)
  service-log.ts           — Edge logger factory (uses @logtail/edge), no endpoint option
  client-log.ts            — React hook logger (ZERO consumers)
  use-logger.ts            — React hook logger (ZERO consumers)
  types.ts                 — Logger interface
```

### Consumers
| Export | Consumers |
|---|---|
| `./log` | 23 files in console app/api layer |
| `./service-log` | relay, gateway, backfill (identical `logger.ts` pattern) |
| `./betterstack-env` | console, auth, www (via `extends: [betterstackEnv]`) |
| `./client-log` | **None** |
| `./use-logger` | **None** |

### Key problems
1. `LOGTAIL_*` naming — should be `BETTERSTACK_*`
2. Edge services define `LOGTAIL_SOURCE_TOKEN` directly in their own `env.ts` instead of extending a composable betterstack env
3. `service-log.ts` line 42: `new Logtail(config.token!)` — no `endpoint` option
4. `client-log.ts` and `use-logger.ts` have zero consumers — dead code
5. `betterstack-env.ts` mixes `NEXT_PUBLIC_BETTER_STACK_*` and `NEXT_PUBLIC_LOGTAIL_*` naming

### Key Discoveries
- Edge services use `@t3-oss/env-core`, Next.js apps use `@t3-oss/env-nextjs` — need two env schemas
- `extends` works cross-package: `env-core` objects can be extended by both `env-core` and `env-nextjs` calls (proven by `dbEnv` from `@t3-oss/env-core` being extended in console's `@t3-oss/env-nextjs` call)
- All three Hono services have identical `logger.ts` files — same pattern, different `service` name
- Single Better Stack source for all services (filter by `service` field in logs)

## Desired End State

```
vendor/observability/src/
  env/
    betterstack.ts         — Next.js env (@t3-oss/env-nextjs), BETTERSTACK_* + VERCEL_ENV
    betterstack-edge.ts    — Edge env (@t3-oss/env-core), BETTERSTACK_* + NODE_ENV
    sentry-env.ts          — unchanged
  log/
    next.ts                — Next.js logger, re-exports betterstackEnv
    edge.ts                — Edge logger factory, re-exports betterstackEdgeEnv
    types.ts               — moved from src/types.ts
  ...other files unchanged
```

**Package exports:**
```json
"./log/next":             "dist/log/next.js"
"./log/edge":             "dist/log/edge.js"
"./log/types":            "dist/log/types.js"
"./betterstack-env":      "dist/env/betterstack.js"
"./betterstack-edge-env": "dist/env/betterstack-edge.js"
```

**Consumer pattern (edge services):**
```typescript
// apps/relay/src/env.ts
import { betterstackEdgeEnv } from "@vendor/observability/log/edge";
extends: [vercel(), betterstackEdgeEnv, upstashEnv, qstashEnv, dbEnv]
// No more BETTERSTACK_SOURCE_TOKEN in server schema or runtimeEnv — it comes from extends

// apps/relay/src/logger.ts
import { createLogger } from "@vendor/observability/log/edge";
export const log = createLogger(
  "relay",
  env.BETTERSTACK_SOURCE_TOKEN,
  env.BETTERSTACK_INGESTING_HOST,
  env.VERCEL_ENV,
);
```

**Consumer pattern (Next.js apps):**
```typescript
// apps/console/src/env.ts
import { betterstackEnv } from "@vendor/observability/log/next";
extends: [..., betterstackEnv, ...]
// unchanged pattern, just new import path
```

### Verification
- `pnpm check` passes
- `pnpm typecheck` passes
- All turbo.json cache keys use `BETTERSTACK_*` names
- No remaining `LOGTAIL_*` references in source code
- Relay/gateway/backfill `env.ts` files no longer define `BETTERSTACK_SOURCE_TOKEN` in their own server schema — it comes from `extends`

#### Update `error.ts` — align with next-forge pattern
**File**: `vendor/observability/src/error.ts`

Align with next-forge: add `Sentry.captureException` + `log.error` side effects, import `log` from `./log/next`.

```typescript
// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { log } from "./log/next";

export const parseError = (error: unknown): string => {
  let message = "An error occurred";

  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    message = error.message as string;
  } else {
    message = String(error);
  }

  try {
    Sentry.captureException(error);
    log.error(`Parsing error: ${message}`);
  } catch (newError) {
    console.error("Error parsing error:", newError);
  }

  return message;
};
```

---

## What We're NOT Doing

- Changing Sentry integration
- Modifying the `@logtail/next` or `@logtail/edge` package versions
- Setting up Vercel log drains (separate concern)
- Adding new logging functionality
- Changing `@logtail/next`'s `withLogtail` Next.js config wrapper (if used)

---

## Phase 1: New env schemas + log modules in vendor/observability

### Overview
Create the new file structure, env schemas, and logger modules. Old files remain untouched so nothing breaks mid-refactor.

### Changes Required:

#### 1. Create edge betterstack env
**File**: `vendor/observability/src/env/betterstack-edge.ts` (new)

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const betterstackEdgeEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  server: {
    BETTERSTACK_SOURCE_TOKEN: z.string().min(1).optional(),
    BETTERSTACK_INGESTING_HOST: z.string().url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    BETTERSTACK_SOURCE_TOKEN: process.env.BETTERSTACK_SOURCE_TOKEN,
    BETTERSTACK_INGESTING_HOST: process.env.BETTERSTACK_INGESTING_HOST,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
```

#### 2. Update Next.js betterstack env
**File**: `vendor/observability/src/env/betterstack-env.ts` → rename to `vendor/observability/src/env/betterstack.ts`

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

export const betterstackEnv = createEnv({
  extends: [vercel()],
  shared: {},
  server: {
    BETTERSTACK_SOURCE_TOKEN: z.string().min(1).optional(),
    BETTERSTACK_INGESTING_HOST: z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST: z.string().url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST:
      process.env.NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
```

Changes from old file:
- `LOGTAIL_SOURCE_TOKEN` → `BETTERSTACK_SOURCE_TOKEN`
- `LOGTAIL_URL` → `BETTERSTACK_INGESTING_HOST`
- `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN` → `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN`
- `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL` → `NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST`
- Drop `NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN` (redundant)
- Drop `NEXT_PUBLIC_VERCEL_ENV` from client — `VERCEL_ENV` is used server-side (comes from `vercel()` preset)

#### 3. Move `types.ts` into `log/`
**File**: `vendor/observability/src/types.ts` → `vendor/observability/src/log/types.ts`

Content unchanged:
```typescript
export interface Logger {
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
}
```

Update all existing internal imports of `"./types"` to `"./log/types"` (affects `sentry.ts`, `error.ts`, etc. — check with grep).

#### 4. Create `log/edge.ts`
**File**: `vendor/observability/src/log/edge.ts` (new)

Minimal — return the Logtail instance directly with a console fallback. No custom interface wrapping.

```typescript
import { Logtail } from "@logtail/edge";

export { betterstackEdgeEnv } from "../env/betterstack-edge";
export type { Logger } from "./types";

export function createLogger(
  service: string,
  token: string | undefined,
  endpoint: string | undefined,
  environment: string | undefined,
) {
  const shouldShip =
    token && environment === "production";

  if (!shouldShip) {
    return { ...console, flush: () => Promise.resolve() };
  }

  const logger = new Logtail(token, { endpoint });
  logger.use((log) => Promise.resolve({ ...log, service }));
  return logger;
}
```

No config object, no TypeScript interface wrappers — just the Logtail instance (which already has `debug`, `info`, `warn`, `error`, `flush`) or a console spread with a no-op `flush`.

#### 4. Create `log/next.ts`
**File**: `vendor/observability/src/log/next.ts` (new)

Uses server-side `VERCEL_ENV` (from the `vercel()` preset) instead of the client-exposed `NEXT_PUBLIC_VERCEL_ENV`.

```typescript
import { log as logtail } from "@logtail/next";
import { betterstackEnv } from "../env/betterstack";

export { betterstackEnv } from "../env/betterstack";

const shouldUseBetterStack = betterstackEnv.VERCEL_ENV === "production";

export const log = shouldUseBetterStack ? logtail : console;

export type Logger = typeof log;
```

#### 5. Update `package.json` exports
**File**: `vendor/observability/package.json`

Add new exports:
```json
"./log/next": {
  "types": "./dist/log/next.d.ts",
  "default": "./dist/log/next.js"
},
"./log/edge": {
  "types": "./dist/log/edge.d.ts",
  "default": "./dist/log/edge.js"
},
"./betterstack-edge-env": {
  "types": "./dist/env/betterstack-edge.d.ts",
  "default": "./dist/env/betterstack-edge.js"
}
```

Update existing export path:
```json
"./betterstack-env": {
  "types": "./dist/env/betterstack.d.ts",
  "default": "./dist/env/betterstack.js"
}
```

Keep old `./log`, `./service-log` temporarily (remove in Phase 3).

#### 6. Update `tsup.config.ts`
**File**: `vendor/observability/tsup.config.ts`

Add new entry points:
```typescript
"log/next": "src/log/next.ts",
"log/edge": "src/log/edge.ts",
"env/betterstack-edge": "src/env/betterstack-edge.ts",
```

Update betterstack env entry:
```typescript
"env/betterstack": "src/env/betterstack.ts",  // was "env/betterstack-env"
```

#### 7. Add `@t3-oss/env-core` dependency
**File**: `vendor/observability/package.json`

Add to dependencies:
```json
"@t3-oss/env-core": "catalog:"
```

(Needed for `betterstack-edge.ts`. Check if `catalog:` resolves — if not, use the version from relay's lockfile.)

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @vendor/observability build` succeeds
- [x] `pnpm --filter @vendor/observability typecheck` passes
- [x] New dist files exist: `dist/log/next.js`, `dist/log/edge.js`, `dist/env/betterstack-edge.js`, `dist/env/betterstack.js`

#### Manual Verification:
- [ ] Old exports still work (no consumers broken yet)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Update all consumers

### Overview
Switch all consumers to new import paths and env var names. Remove `LOGTAIL_SOURCE_TOKEN` from edge service env schemas — it now comes from `extends: [betterstackEdgeEnv]`.

### Changes Required:

#### 1. Update relay
**File**: `apps/relay/src/env.ts`
- Add import: `import { betterstackEdgeEnv } from "@vendor/observability/log/edge";`
- Add to extends: `extends: [vercel(), betterstackEdgeEnv, upstashEnv, qstashEnv, dbEnv]`
- Remove from server schema: `LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional()`
- Remove from runtimeEnv: `LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN`

**File**: `apps/relay/src/logger.ts`
```typescript
import { createLogger } from "@vendor/observability/log/edge";
import { env } from "./env.js";

export const log = createLogger("relay", env.BETTERSTACK_SOURCE_TOKEN, env.BETTERSTACK_INGESTING_HOST, env.VERCEL_ENV);
```

#### 2. Update gateway
**File**: `apps/gateway/src/env.ts`
- Add import: `import { betterstackEdgeEnv } from "@vendor/observability/log/edge";`
- Add to extends: `extends: [vercel(), betterstackEdgeEnv, upstashEnv, qstashEnv, dbEnv, ...PROVIDER_ENVS()]`
- Remove from server schema: `LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional()`
- Remove from runtimeEnv: `LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN`

**File**: `apps/gateway/src/logger.ts`
```typescript
import { createLogger } from "@vendor/observability/log/edge";
import { env } from "./env.js";

export const log = createLogger("gateway", env.BETTERSTACK_SOURCE_TOKEN, env.BETTERSTACK_INGESTING_HOST, env.VERCEL_ENV);
```

#### 3. Update backfill
**File**: `apps/backfill/src/env.ts`
- Add import: `import { betterstackEdgeEnv } from "@vendor/observability/log/edge";`
- Add to extends: `extends: [vercel(), betterstackEdgeEnv]`
- Remove from server schema: `LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional()`
- Remove from runtimeEnv: `LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN`

**File**: `apps/backfill/src/logger.ts`
```typescript
import { createLogger } from "@vendor/observability/log/edge";
import { env } from "./env.js";

export const log = createLogger("backfill", env.BETTERSTACK_SOURCE_TOKEN, env.BETTERSTACK_INGESTING_HOST, env.VERCEL_ENV);
```

#### 4. Update console Next.js app
**File**: `apps/console/src/env.ts`
- Change import: `import { betterstackEnv } from "@vendor/observability/log/next";`
- `extends` array stays the same (still `betterstackEnv`)

All 23 console consumer files that import `{ log } from "@vendor/observability/log"` — update to:
```typescript
import { log } from "@vendor/observability/log/next";
```

#### 5. Update auth Next.js app
**File**: `apps/auth/src/env.ts`
- Change import: `import { betterstackEnv } from "@vendor/observability/log/next";`

#### 6. Update www Next.js app
**File**: `apps/www/src/env.ts`
- Change import: `import { betterstackEnv } from "@vendor/observability/log/next";`

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes
- [x] No remaining imports of `@vendor/observability/log` (without `/next` or `/edge` suffix)
- [x] No remaining imports of `@vendor/observability/service-log`
- [x] No remaining imports of `@vendor/observability/betterstack-env`

#### Manual Verification:
- [ ] `pnpm dev:relay` starts without env validation errors
- [ ] `pnpm dev:console` starts without env validation errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Update turbo.json cache keys + clean up

### Overview
Rename env var cache keys in all turbo.json files and delete dead code.

### Changes Required:

#### 1. Update turbo.json cache keys

**File**: `turbo.json` (root)
- `LOGTAIL_SOURCE_TOKEN` → `BETTERSTACK_SOURCE_TOKEN`

**File**: `apps/console/turbo.json`
- `LOGTAIL_SOURCE_TOKEN` → `BETTERSTACK_SOURCE_TOKEN`
- `LOGTAIL_URL` → `BETTERSTACK_INGESTING_HOST`

**File**: `apps/auth/turbo.json`
- `NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN` → `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN`
- `LOGTAIL_SOURCE_TOKEN` → `BETTERSTACK_SOURCE_TOKEN`
- `LOGTAIL_URL` → `BETTERSTACK_INGESTING_HOST`

**File**: `apps/www/turbo.json`
- `NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN` → `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN`
- `LOGTAIL_SOURCE_TOKEN` → `BETTERSTACK_SOURCE_TOKEN`
- `LOGTAIL_URL` → `BETTERSTACK_INGESTING_HOST`

#### 2. Delete dead files
- `vendor/observability/src/log.ts` — replaced by `log/next.ts`
- `vendor/observability/src/service-log.ts` — replaced by `log/edge.ts`
- `vendor/observability/src/types.ts` — moved to `log/types.ts`
- `vendor/observability/src/env/betterstack-env.ts` — replaced by `env/betterstack.ts`
- `vendor/observability/src/client-log.ts` — zero consumers
- `vendor/observability/src/use-logger.ts` — zero consumers
- `vendor/observability/src/error-formatter.ts` — zero consumers outside package
- `vendor/observability/src/async-executor.ts` — zero consumers outside package

#### 3. Remove old exports from package.json
**File**: `vendor/observability/package.json`

Remove:
```json
"./log": { ... },
"./service-log": { ... },
"./client-log": { ... },
"./use-logger": { ... }
```

#### 4. Update tsup.config.ts
**File**: `vendor/observability/tsup.config.ts`

Remove old entries:
```typescript
log: "src/log.ts",
"client-log": "src/client-log.ts",
"use-logger": "src/use-logger.ts",
"service-log": "src/service-log.ts",
"env/betterstack-env": "src/env/betterstack-env.ts",
types: "src/types.ts",
```

Add new entries:
```typescript
"log/next": "src/log/next.ts",
"log/edge": "src/log/edge.ts",
"log/types": "src/log/types.ts",
"env/betterstack": "src/env/betterstack.ts",
"env/betterstack-edge": "src/env/betterstack-edge.ts",
```

#### 5. Update .env.example files (if any)
Check `apps/relay/.env.example`, `apps/gateway/.env.example`, `apps/backfill/.env.example` for any `LOGTAIL_*` references and rename to `BETTERSTACK_*`.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm --filter @vendor/observability build` succeeds
- [x] No remaining `LOGTAIL` references in source code: `grep -r "LOGTAIL" --include="*.ts" --include="*.json" vendor/ apps/ packages/` returns nothing
- [x] No remaining imports of old paths: `grep -r "observability/log\"" --include="*.ts" apps/ packages/` returns nothing (only `log/next` and `log/edge` allowed)

#### Manual Verification:
- [ ] `pnpm dev:app` starts all services without errors
- [ ] Confirm Better Stack Live Tail shows logs after deploying to Preview with `BETTERSTACK_SOURCE_TOKEN` set

---

## Env Var Migration Checklist (Vercel Dashboard)

After code changes are deployed, update env vars in Vercel project settings:

| Old Name | New Name | Projects |
|---|---|---|
| `LOGTAIL_SOURCE_TOKEN` | `BETTERSTACK_SOURCE_TOKEN` | all (relay, gateway, backfill, console, auth, www) |
| `LOGTAIL_URL` | `BETTERSTACK_INGESTING_HOST` | all |
| `NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN` | `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN` | console, auth, www |
| `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN` | `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN` | console, auth, www |
| `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL` | `NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST` | console, auth, www |

Single Better Stack source for all services — same token everywhere, filter by `service` field in logs.

---

## References

- Research doc: `thoughts/shared/research/2026-03-16-web-analysis-betterstack-relay-integration.md`
- Pattern reference: `vendor/db/env.ts` — composable `@t3-oss/env-core` env with `extends`
- `@logtail/edge` docs: supports `{ endpoint }` option in constructor

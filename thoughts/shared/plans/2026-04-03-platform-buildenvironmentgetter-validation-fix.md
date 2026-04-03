# Platform: Restore `buildEnvGetter` Validation + Dynamic Provider Env Boot-time Fix

## Overview

The migration from the old gateway to `apps/platform` orphaned the `buildEnvGetter` validation path. Provider-specific env vars reach `createConfig` via an unvalidated `process.env` proxy passthrough. This plan restores per-provider Zod validation, adds boot-time enforcement via a dynamic `providerEnv` composable (auto-updated when providers are added), and aligns the `ENCRYPTION_KEY` schema across both platform env layers.

## Current State Analysis

**`api/platform/src/lib/provider-configs.ts:54`**:
```ts
p.createConfig(env as unknown as Record<string, string>, runtime)
```
`env` is the 3-var slim object from `api/platform/src/env.ts` using `experimental__runtimeEnv: process.env`. The proxy forwards reads of undeclared keys to `process.env` without validation. Provider vars (`GITHUB_APP_SLUG`, `LINEAR_CLIENT_ID`, etc.) arrive unvalidated.

**`p.env` exists but is never called**: The lazy getter on every provider object (defined in `packages/app-providers/src/factory/webhook.ts:60-63`, `api.ts:53-55`, `managed.ts:56-59`) calls `buildEnvGetter(def.envSchema)` which Zod-validates the provider's keys. `api/platform` never triggers it.

**`apps/platform/src/env.ts`**: Only declares 4 webhook verification secrets from providers — the OAuth credentials (`GITHUB_APP_ID`, `LINEAR_CLIENT_ID`, etc.) are absent. These must be maintained manually every time a provider is added or its schema changes.

**`api/platform/src/env.ts:7`**: `ENCRYPTION_KEY: z.string().min(32)` — looser than `apps/platform/src/env.ts` (`min(44)`) and far looser than `api/app/src/env.ts` (format regex + weak-key refine). A 32–43 char value passes the API layer check but fails at runtime in `validateKey()`.

## Desired End State

1. A `providerEnv` composable in `packages/app-providers` merges all provider `envSchema`s dynamically — when a new provider is added to `PROVIDERS`, its env vars are automatically validated at platform boot with no changes to any env file.
2. `apps/platform/src/env.ts` adds `providerEnv` to `extends` — one import, permanently zero maintenance.
3. `provider-configs.ts` uses `p.env` per provider — each `createConfig` call receives exactly its own Zod-validated env, removing the unsafe cast.
4. `ENCRYPTION_KEY` uses identical strict schema in both platform env layers.

### Verification:
- `pnpm typecheck` passes
- `pnpm check` passes
- `pnpm build:platform` passes
- `pnpm dev:platform` boots cleanly with no provider env vars set (all optional)
- `pnpm dev:platform` fails at boot with a clear Zod error if `ENCRYPTION_KEY` is 32 chars
- Adding a new provider with an `envSchema` requires zero changes outside that provider's definition file

## What We're NOT Doing

- Not hardcoding provider env var names in `apps/platform/src/env.ts`
- Not adding provider env vars to `api/platform/src/env.ts` (stays slim, 3 vars)
- Not removing the `providerConfigs` compatibility Proxy alias in `provider-configs.ts`
- Not changing `buildEnvGetter` itself or any factory files
- Not making any provider vars required in `apps/platform/src/env.ts` — all remain optional

---

## Phase 1: Create `providerEnv` in `packages/app-providers`

### Overview
New file `packages/app-providers/src/env.ts` that merges all provider `envSchema`s from the `PROVIDERS` registry into a single `@t3-oss/env-core` composable. Follows the exact pattern of `vendor/upstash/src/env.ts` — same package, same `clientPrefix: "" as const` pattern, same `skipValidation` conditions.

### Changes Required

#### New file: `packages/app-providers/src/env.ts`

```ts
import { createEnv } from "@t3-oss/env-core";
import type { z } from "zod";
import { PROVIDERS } from "./registry";

const mergedSchema = Object.values(PROVIDERS).reduce<Record<string, z.ZodType>>(
  (acc, p) => ({ ...acc, ...p.envSchema }),
  {}
);

export const providerEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: mergedSchema,
  runtimeEnv: Object.fromEntries(
    Object.keys(mergedSchema).map((k) => [k, process.env[k]])
  ),
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
```

**Why `@t3-oss/env-core`**: Already in `packages/app-providers` dependencies (`package.json:30`). Used by `buildEnvGetter` (`src/runtime/env.ts`) and `upstashEnv`. `@t3-oss/env-nextjs`'s `extends` accepts `env-core` results — proven by `upstashEnv` which uses `env-core` and is in `apps/platform/src/env.ts`'s `extends`.

**Why `mergedSchema` approach**: Each provider's `envSchema` is a `Record<string, z.ZodType>` stored on the frozen provider object (spread from `def` in each factory). `Object.values(PROVIDERS)` gives all five providers; spreading their schemas merges all keys. Apollo's `envSchema: {}` contributes no keys. All optional provider schemas use `.optional()` on their Zod types — absent vars pass validation cleanly.

**`emptyStringAsUndefined: true`**: Consistent with `buildEnvGetter` and `api/platform/src/env.ts`. Empty strings in CI/CD are treated as absent.

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @repo/app-providers typecheck` — no type errors on new file

---

## Phase 2: Add `./env` Subpath Export to `packages/app-providers/package.json`

### Overview
`providerEnv` must be importable from outside the package. Add a new subpath export alongside the existing `.`, `./client`, and `./contracts` entries.

### Changes Required

#### `packages/app-providers/package.json`

Add to the `exports` object:
```json
"./env": {
  "types": "./src/env.ts",
  "default": "./src/env.ts"
}
```

**Note**: No `server-only` guard needed — importing `providerEnv` in server code (like `apps/platform/src/env.ts`) is the intended use. Client bundles will naturally not import this since it references `process.env`.

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @repo/app-providers typecheck` passes

---

## Phase 3: Add `providerEnv` to `apps/platform/src/env.ts`

### Overview
One import addition, one entry in the `extends` array. No provider env var names appear in this file — all maintenance moves to the provider definitions.

### Changes Required

#### `apps/platform/src/env.ts`

Add import:
```ts
import { providerEnv } from "@repo/app-providers/env";
```

Add to `extends`:
```ts
extends: [vercel(), sentryEnv, betterstackEnv, upstashEnv, providerEnv],
```

Full updated file:
```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { providerEnv } from "@repo/app-providers/env";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), sentryEnv, betterstackEnv, upstashEnv, providerEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    // Service auth — JWT shared secret for cross-service calls
    SERVICE_JWT_SECRET: z.string().min(32),

    // Token vault encryption (32 bytes: 64 hex chars or 44 base64 chars)
    ENCRYPTION_KEY: z.string().min(44),

    // Inngest
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
    INNGEST_SIGNING_KEY: z.string().min(1).optional(),
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
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
```

**What moved out of `server`**: The four webhook verification secrets (`GITHUB_WEBHOOK_SECRET`, `VERCEL_CLIENT_INTEGRATION_SECRET`, `LINEAR_WEBHOOK_SIGNING_SECRET`, `SENTRY_CLIENT_SECRET`) are now covered by `providerEnv` via the merged `envSchema`s — no duplication. Remove them from the direct `server` block.

**What stays**: `SERVICE_JWT_SECRET`, `ENCRYPTION_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — these are platform-level vars not owned by any provider.

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes (pre-existing DB errors unrelated to this change)
- [ ] `pnpm build:platform` passes — `providerEnv` resolves correctly at build time

#### Manual Verification:
- [ ] `pnpm dev:platform` starts cleanly with no provider env vars set

---

## Phase 4: Fix `provider-configs.ts` to Use `p.env`

### Overview
Replace the unsafe cast of the slim platform env with each provider's own validated `p.env`. Removes the untyped `as unknown as Record<string, string>` cast and ensures `buildEnvGetter` validation runs for each provider at first `getProviderConfigs()` call.

### Changes Required

#### `api/platform/src/lib/provider-configs.ts`

Remove line 12 (now unused):
```ts
import { env } from "../env";   // DELETE
```

Change line 54:
```ts
// BEFORE
p.createConfig(env as unknown as Record<string, string>, runtime),

// AFTER
p.createConfig(p.env, runtime),
```

**Why `env` import can be removed**: `SERVICE_JWT_SECRET`, `ENCRYPTION_KEY`, and `NODE_ENV` are still validated at startup — `api/platform/src/lib/jwt.ts` and `api/platform/src/lib/encryption.ts` both import `{ env }` from `../env`, so `createEnv` runs on module load. `provider-configs.ts` was the only consumer of the proxy-passthrough behavior.

**Why this works per provider**:
- `github`: `p.env` → `buildEnvGetter({ GITHUB_APP_SLUG, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_WEBHOOK_SECRET })` → `createConfig` reads only these 6 keys ✓
- `linear`, `sentry`, `vercel`: `p.env` returns their own optional keys; `createConfig` null-guards and returns `null` if any absent ✓
- `apollo`: `p.env` → `buildEnvGetter({})` → returns `{}`; `createConfig` ignores env entirely ✓

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes — `p.env: Record<string, string>` satisfies the `createConfig` parameter type
- [x] `pnpm check` passes

#### Manual Verification:
- [ ] `pnpm dev:platform` with full GitHub env set — `getProviderConfigs()` builds github config on first call
- [ ] `pnpm dev:platform` with no provider env vars — `getProviderConfigs()` returns `{}` or `{ apollo: {} }` without throwing

---

## Phase 5: Fix `ENCRYPTION_KEY` Schema in `api/platform/src/env.ts`

### Overview
Align the `ENCRYPTION_KEY` schema with `api/app/src/env.ts:21-52`. The current `min(32)` accepts strings that can never decode to 32 bytes at runtime — `validateKey()` in `packages/lib/src/encryption.ts` would fail at call time, not at boot.

### Changes Required

#### `api/platform/src/env.ts`

Replace line 7:
```ts
// BEFORE
ENCRYPTION_KEY: z.string().min(32),

// AFTER
ENCRYPTION_KEY: z
  .string()
  .min(44)
  .refine(
    (key) => {
      const hexPattern = /^[0-9a-f]{64}$/i;
      const base64Pattern = /^[A-Za-z0-9+/]{43}=$/;
      return hexPattern.test(key) || base64Pattern.test(key);
    },
    { message: "ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)" }
  )
  .refine(
    (key) => key !== "0".repeat(64),
    { message: "ENCRYPTION_KEY must be a cryptographically secure random value" }
  ),
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [ ] `pnpm dev:platform` with `ENCRYPTION_KEY` as a 32-char string fails at boot with Zod message
- [ ] Valid 64-char hex or 44-char base64 key boots cleanly

---

## Testing Strategy

### Order of implementation:
Phases 1 → 2 → 3 → 4 → 5. Phase 3 depends on 1 and 2 completing first (the import must resolve). Phases 4 and 5 are independent of each other and of 1-3.

### Key edge case — duplicate keys in `mergedSchema`:
`SENTRY_CLIENT_SECRET` and `VERCEL_CLIENT_INTEGRATION_SECRET` appear in both the old `apps/platform/src/env.ts` server block (webhook secrets) and provider `envSchema`s. After Phase 3, these are now exclusively in `providerEnv`. No duplication since we remove them from the direct `server` block.

`LINEAR_WEBHOOK_SIGNING_SECRET` and `GITHUB_WEBHOOK_SECRET` are in both the platform's removed webhook secrets and provider `envSchema`s — same resolution.

### Provider `envSchema` key overlap check:
No two providers share an env var key in their `envSchema`s — GitHub, Linear, Sentry, Vercel, Apollo all use distinct prefixes. The `reduce` merge has no collision risk.

## References

- Research: `thoughts/shared/research/2026-04-03-platform-env-vars-migration-audit.md`
- `api/platform/src/lib/provider-configs.ts:54` — the `createConfig` call (Phase 4)
- `api/platform/src/env.ts:7` — `ENCRYPTION_KEY` schema (Phase 5)
- `apps/platform/src/env.ts` — `extends` array (Phase 3)
- `packages/app-providers/src/runtime/env.ts:4-20` — `buildEnvGetter` (model for Phase 1)
- `vendor/upstash/src/env.ts` — exact pattern to follow for Phase 1
- `packages/app-providers/package.json:8-21` — existing exports (Phase 2)
- `packages/app-providers/src/factory/webhook.ts:60-63` — `p.env` getter definition
- `api/app/src/env.ts:21-52` — reference schema for Phase 5

---
date: 2026-04-03T01:39:07+0000
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "apps/platform env var architecture post relay/gateway/backfill migration"
tags: [research, codebase, platform, env, migration, encryption, buildEnvGetter, app-providers]
status: complete
last_updated: 2026-04-03
last_updated_note: "Added follow-up research: buildEnvGetter gateway migration gap + provider-configs env proxy behavior"
---

# Research: apps/platform Env Var Architecture — Post relay/gateway/backfill Migration

**Date**: 2026-04-03T01:39:07+0000
**Git Commit**: 34f5b76837648856dc476b8f947679021f7a6679
**Branch**: chore/remove-memory-api-key-service-auth

## Research Question

> Run pnpm dev:full — there seems to be some fundamental gaps from recent PR/commit where we moved from 3 layer relay, backfill, gateway to the current apps/platform where there seems to be errors with env vars.
> Focus on `apps/platform/src/env.ts` and the consumer for `packages/app-providers/src/runtime/env.ts`.

## Summary

The migration from the 3-service architecture (relay, gateway, backfill) to `apps/platform` is complete at the filesystem level — the old service directories no longer exist, `MEMORY_API_KEY` was the last legacy var (removed in commit `34f5b76`). The platform env system has two independent layers (`apps/platform/src/env.ts` and `api/platform/src/env.ts`) with different constraints on the same secrets. `buildEnvGetter` in `packages/app-providers` is internal-only and unrelated to the platform env chain.

Three structural patterns characterize the current state:
1. A single unstaged modification to `vendor/observability/src/env/sentry-env.ts`
2. `NEXT_PUBLIC_VERCEL_ENV` declared in two places within platform's `extends` chain
3. `ENCRYPTION_KEY` validated against different minimum lengths across the two platform env layers

---

## Detailed Findings

### A. The Modified File: `vendor/observability/src/env/sentry-env.ts`

**File**: `vendor/observability/src/env/sentry-env.ts`
**Git status**: Modified, unstaged

The only change in the working tree diff is on line 13:

```diff
- NEXT_PUBLIC_SENTRY_DSN: z.string().min(1),
+ NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).optional(),
```

`NEXT_PUBLIC_SENTRY_DSN` was previously required (`min(1)` with no `.optional()`) and is now optional. This file exports `sentryEnv`, which is consumed by `apps/platform/src/env.ts:9` via `extends: [vercel(), sentryEnv, betterstackEnv, upstashEnv]`.

Full current shape of `sentryEnv`:
- **Server vars** (all optional): `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- **Client vars**: `NEXT_PUBLIC_SENTRY_DSN` (optional), `NEXT_PUBLIC_VERCEL_ENV` (enum, default `"development"`)
- **Source**: `@t3-oss/env-nextjs` `createEnv()`

---

### B. Platform Env Architecture — Two Separate Layers

The platform service has two distinct `createEnv()` instances that independently validate the same secrets:

#### Layer 1: `apps/platform/src/env.ts` (Next.js app layer)
The full composition env used at the Next.js application level. Imported as `~/env`.

**Extends**: `[vercel(), sentryEnv, betterstackEnv, upstashEnv]`

Note: `betterstackEnv` (`vendor/observability/src/env/betterstack.ts:6`) also internally extends `vercel()` — so `vercel()` is invoked twice in this chain (once directly, once via betterstackEnv).

**Vars declared directly** (`apps/platform/src/env.ts:16–40`):

| Variable | Schema | Classification |
|---|---|---|
| `NODE_ENV` | `z.enum(["development","production","test"]).default("development")` | shared |
| `SERVICE_JWT_SECRET` | `z.string().min(32)` | server, required |
| `ENCRYPTION_KEY` | `z.string().min(44)` | server, required |
| `GITHUB_WEBHOOK_SECRET` | `z.string().min(1).optional()` | server, optional |
| `VERCEL_CLIENT_INTEGRATION_SECRET` | `z.string().min(1).optional()` | server, optional |
| `LINEAR_WEBHOOK_SIGNING_SECRET` | `z.string().min(1).optional()` | server, optional |
| `SENTRY_CLIENT_SECRET` | `z.string().min(1).optional()` | server, optional |
| `INNGEST_EVENT_KEY` | `z.string().min(1).optional()` | server, optional |
| `INNGEST_SIGNING_KEY` | `z.string().min(1).optional()` | server, optional |
| `NEXT_PUBLIC_VERCEL_ENV` | `z.enum(["development","preview","production"]).default("development")` | client |

**Vars contributed by vendor presets**:

From `sentryEnv`: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_VERCEL_ENV`
From `betterstackEnv`: `BETTERSTACK_SOURCE_TOKEN`, `BETTERSTACK_INGESTING_HOST`, `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN`, `NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST`
From `upstashEnv`: `KV_REST_API_URL` (required), `KV_REST_API_TOKEN` (required)

**Consumers of `~/env` in apps/platform/src/**:
- `apps/platform/src/instrumentation.ts` — `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_VERCEL_ENV`
- `apps/platform/src/lib/related-projects.ts` — `NEXT_PUBLIC_VERCEL_ENV` (controls `isDevelopment` → default host URL)

#### Layer 2: `api/platform/src/env.ts` (API package layer)
A slim, standalone env used by the `@api/platform` package internals. Imported via `../env` relative path.

**No extends** — only three vars:
| Variable | Schema |
|---|---|
| `NODE_ENV` | `z.enum(["development","production","test"]).default("development")` |
| `SERVICE_JWT_SECRET` | `z.string().min(32)` |
| `ENCRYPTION_KEY` | `z.string().min(32)` |

**Consumers** (`api/platform/src/`):
- `api/platform/src/lib/jwt.ts:22` — `env.SERVICE_JWT_SECRET` → encoded as `Uint8Array` → HS256 HMAC key for `signServiceJWT()` / `verifyServiceJWT()`
- `api/platform/src/lib/encryption.ts:9` — returns `env.ENCRYPTION_KEY` raw string (null-guarded wrapper)
- `api/platform/src/lib/provider-configs.ts:54` — spreads `env` as `Record<string, string>` into each provider's `createConfig(env, runtime)` call; providers without required env vars return `null` and are filtered out

**Route handlers in apps/platform/src/app/api/** do NOT import env directly — they all delegate to `@api/platform`:

| Route | Delegates to |
|---|---|
| `api/health/route.ts` | Static JSON only |
| `api/inngest/route.ts` | `@api/platform` → `createInngestRouteContext()` |
| `api/trpc/[trpc]/route.ts` | `@api/platform` → `createMemoryTRPCContext`, `memoryRouter` |
| `api/connect/[provider]/authorize/route.ts` | `@api/platform/lib/oauth/authorize` |
| `api/connect/[provider]/callback/route.ts` | `@api/platform/lib/oauth/callback` |
| `api/connect/oauth/poll/route.ts` | `@api/platform/lib/oauth/state` |
| `api/ingest/[provider]/route.ts` | `@api/platform/lib/provider-configs`, inngest client |
| `src/middleware.ts` | `@vendor/security/middleware` only |

`INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are declared in layer 1 but never accessed via `env.*` — Inngest's framework reads them directly from `process.env`.

---

### C. ENCRYPTION_KEY Constraint Split Across All Layers

The same `ENCRYPTION_KEY` env var is validated against four different schemas:

| File | Schema | Format Enforcement | Weak-Key Rejection |
|---|---|---|---|
| `api/platform/src/env.ts:7` | `z.string().min(32)` | None | None |
| `apps/platform/src/env.ts:20` | `z.string().min(44)` | None | None |
| `apps/app/src/env.ts:42–73` | `z.string().min(44)` + 2x `.refine` | `/^[0-9a-f]{64}$/i` or `/^[A-Za-z0-9+/]{43}=$/` | All-zeros 64-char key rejected |
| `api/app/src/env.ts:21–52` | `z.string().min(44)` + 2x `.refine` | Same patterns as above | Same all-zeros check |

The comment in `apps/platform/src/env.ts:19` documents the intent: `"32 bytes: 64 hex chars or 44 base64 chars"`. The `min(44)` floor is set because a 32-byte base64-encoded value is exactly 44 characters (the shortest valid encoding).

**Runtime cryptographic usage** (`packages/lib/src/encryption.ts`): The raw string is format-detected at call time via `validateKey()`:
1. Tries hex decode → if result is exactly 32 bytes, use as AES-256-GCM key
2. Tries base64 decode (`atob`) → if result is exactly 32 bytes, use as AES-256-GCM key
3. Throws `EncryptionError` if neither yields 32 bytes

The `api/platform` layer (`api/platform/src/lib/encryption.ts`) is a thin wrapper that returns the raw string from `env.ENCRYPTION_KEY` with a null-guard; callers pass it to the shared crypto primitives.

---

### D. `packages/app-providers/src/runtime/env.ts` — `buildEnvGetter` Is Internal Only

`buildEnvGetter` is NOT consumed by `apps/platform` and is NOT part of the platform env chain. It is an internal utility of the `packages/app-providers` package.

**How it works** (`packages/app-providers/src/runtime/env.ts:4–20`):
```ts
export function buildEnvGetter(envSchema: Record<string, z.ZodType>): Record<string, string> {
  return createEnv({
    clientPrefix: "" as const,
    client: {},
    server: envSchema as Record<string, z.ZodType<string>>,
    runtimeEnv: Object.fromEntries(Object.keys(envSchema).map((k) => [k, process.env[k]])),
    skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
    emptyStringAsUndefined: true,
  });
}
```

Uses `@t3-oss/env-core` (not `env-nextjs`), no client prefix, no `NEXT_PUBLIC_*` pattern. Each provider factory (api, webhook, managed) calls it lazily via `_env ??= buildEnvGetter(def.envSchema)`.

**`buildEnvGetter` is NOT exported from `packages/app-providers`'s public API** — the package exports are `.` (default), `./client`, and `./contracts`. No `./runtime` subpath export.

**All providers with `envSchema`**:

| Provider | Factory | Env var names |
|---|---|---|
| `github` | `defineWebhookProvider` | `GITHUB_APP_SLUG`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET` |
| `linear` | `defineWebhookProvider` | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_WEBHOOK_SIGNING_SECRET` |
| `sentry` | `defineWebhookProvider` | `SENTRY_APP_SLUG`, `SENTRY_CLIENT_ID`, `SENTRY_CLIENT_SECRET` |
| `vercel` | `defineWebhookProvider` | `VERCEL_INTEGRATION_SLUG`, `VERCEL_CLIENT_SECRET_ID`, `VERCEL_CLIENT_INTEGRATION_SECRET` |
| `apollo` | `defineApiProvider` | _(empty — no server-side secrets needed)_ |

These env vars are validated independently by `buildEnvGetter` when a provider is first accessed — they are separate from the `apps/platform/src/env.ts` and `api/platform/src/env.ts` validation chains.

---

### E. Migration State — relay/gateway/backfill → apps/platform

The old service directories (`apps/relay/`, `apps/gateway/`, `apps/backfill/`) no longer exist in the working tree. Their env var responsibilities have been consolidated into `apps/platform/src/env.ts`.

**Last legacy var removed**: `MEMORY_API_KEY` in commit `34f5b76`. It had been declared as `z.string().min(1).optional()` and used exclusively in `apps/platform/src/app/api/ingest/[provider]/route.ts` to verify an `x-api-key` header — a carry-over from the relay's HTTP ingest path (pre-`inngest.send()` era). See `thoughts/shared/research/2026-04-03-memory-api-key-service-auth-dead-code.md` for the full pre-removal audit.

**Webhook secrets that moved from relay** (annotated `"ported from relay"` in `apps/platform/src/env.ts:22`):
- `GITHUB_WEBHOOK_SECRET` — optional, used by `api/platform/lib/provider-configs.ts` via env spread
- `VERCEL_CLIENT_INTEGRATION_SECRET` — optional
- `LINEAR_WEBHOOK_SIGNING_SECRET` — optional
- `SENTRY_CLIENT_SECRET` — optional

---

### F. Required Vars at Platform Boot

The only **required** (non-optional) vars that will fail boot if absent:

| Variable | Declared in | Required by |
|---|---|---|
| `KV_REST_API_URL` | `vendor/upstash/src/env.ts` | `upstashEnv` in layer 1 |
| `KV_REST_API_TOKEN` | `vendor/upstash/src/env.ts` | `upstashEnv` in layer 1 |
| `SERVICE_JWT_SECRET` | Both layers | Both `apps/platform/src/env.ts` and `api/platform/src/env.ts` |
| `ENCRYPTION_KEY` | Both layers | Both `apps/platform/src/env.ts` and `api/platform/src/env.ts` |

All other vars across both layers are `.optional()`.

Env file location for local dev: `apps/platform/.vercel/.env.development.local` (accessed via `pnpm with-env` script in `apps/platform/package.json:13`).

---

## Code References

- `vendor/observability/src/env/sentry-env.ts:13` — `NEXT_PUBLIC_SENTRY_DSN` changed from required to optional (unstaged)
- `vendor/observability/src/env/betterstack.ts:6` — `betterstackEnv` extends `vercel()` internally
- `vendor/observability/src/env/betterstack.ts` — exports `betterstackEnv`
- `vendor/upstash/src/env.ts` — exports `upstashEnv` with `KV_REST_API_URL` (required url) and `KV_REST_API_TOKEN` (required)
- `apps/platform/src/env.ts:9` — `extends: [vercel(), sentryEnv, betterstackEnv, upstashEnv]`
- `apps/platform/src/env.ts:17` — `SERVICE_JWT_SECRET: z.string().min(32)` (required)
- `apps/platform/src/env.ts:20` — `ENCRYPTION_KEY: z.string().min(44)` (required)
- `apps/platform/src/env.ts:34` — `NEXT_PUBLIC_VERCEL_ENV` declared directly (also present in sentryEnv via extends)
- `api/platform/src/env.ts:7` — `ENCRYPTION_KEY: z.string().min(32)` (looser constraint than layer 1)
- `api/platform/src/lib/jwt.ts:22` — `SERVICE_JWT_SECRET` → `TextEncoder().encode()` → HS256 HMAC key
- `api/platform/src/lib/encryption.ts:8–17` — null-guarded accessor returning raw `ENCRYPTION_KEY` string
- `api/platform/src/lib/provider-configs.ts:54` — `p.createConfig(env, runtime)` — env spread as `Record<string, string>`
- `apps/platform/src/instrumentation.ts:9` — `~/env` → reads `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_VERCEL_ENV`
- `apps/platform/src/lib/related-projects.ts:2` — `~/env` → reads `NEXT_PUBLIC_VERCEL_ENV` for `isDevelopment`
- `packages/app-providers/src/runtime/env.ts:4–20` — `buildEnvGetter` definition (internal, not exported)
- `packages/app-providers/src/factory/webhook.ts:61` — `_env ??= buildEnvGetter(def.envSchema)`
- `packages/app-providers/src/factory/api.ts:54` — same lazy pattern
- `packages/app-providers/src/factory/managed.ts:57` — same lazy pattern
- `packages/lib/src/encryption.ts:60–87` — `validateKey()` — hex-then-base64 decode, must yield 32 bytes for AES-256-GCM
- `apps/app/src/env.ts:42–73` — `ENCRYPTION_KEY` strictest schema (min(44) + format regex + weak-key rejection)
- `api/app/src/env.ts:21–52` — same strict schema as apps/app

## Architecture Documentation

### Env Composition Pattern

The monorepo uses `@t3-oss/env-nextjs` `createEnv()` with `extends` for composable env objects. Each vendor package exports a `createEnv()` result that can be passed in `extends`. The platform Next.js app (layer 1) assembles: `[vercel(), sentryEnv, betterstackEnv, upstashEnv]` plus its own direct declarations.

The API packages (layer 2) use a slimmer pattern — no `extends`, only the specific vars they consume.

### `buildEnvGetter` Pattern

Provider-level env vars (OAuth credentials, webhook secrets) use a separate lazy-validation mechanism: `buildEnvGetter` wraps `@t3-oss/env-core`'s `createEnv()` with no client prefix. Each provider's `envSchema` is only evaluated on first access of `provider.env`. This keeps provider env validation decoupled from app boot.

### Two-Layer Validation

Both `apps/platform/src/env.ts` and `api/platform/src/env.ts` validate `SERVICE_JWT_SECRET` and `ENCRYPTION_KEY` independently at startup. The same environment variable is validated twice (once per `createEnv()` instance), with different minimum length constraints for `ENCRYPTION_KEY` (`min(44)` vs `min(32)`).

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-04-03-memory-api-key-service-auth-dead-code.md` — Pre-removal audit of `MEMORY_API_KEY` and the full service-auth ingest path (the last legacy relay artifact)

## Follow-up Research: `buildEnvGetter` — The Gateway Migration Gap

### Origin of `buildEnvGetter`

Before the `apps/platform` consolidation, `buildEnvGetter` lived in `apps/gateway/src/env.ts`. The gateway was the service that ran `createConfig` for each provider and validated provider-level env vars (`GITHUB_APP_SLUG`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `LINEAR_CLIENT_ID`, etc.) at **startup** via the `p.env` accessor on each provider instance.

After migration, `buildEnvGetter` moved to `packages/app-providers/src/runtime/env.ts` — but `api/platform` never calls `p.env` anywhere. The gateway's startup-validation behavior was not replicated.

### How Provider Env Vars Actually Reach `createConfig` Today

`api/platform/src/env.ts:12` uses `experimental__runtimeEnv: process.env` (not a handpicked object):

```ts
export const env = createEnv({
  server: {
    SERVICE_JWT_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  experimental__runtimeEnv: process.env,   // ← full process.env, not a subset
  ...
});
```

`@t3-oss/env-nextjs`'s `createEnv` returns a **Proxy** over the `experimental__runtimeEnv` object. It validates only the declared keys (`SERVICE_JWT_SECRET`, `ENCRYPTION_KEY`, `NODE_ENV`) at startup — but for any other key read on the proxy, it forwards the read to the underlying `process.env`. So at runtime:

```ts
env.GITHUB_APP_SLUG   // → process.env.GITHUB_APP_SLUG (not validated, but accessible)
env.LINEAR_CLIENT_ID  // → process.env.LINEAR_CLIENT_ID (not validated, but accessible)
```

When `provider-configs.ts:54` does `p.createConfig(env as unknown as Record<string, string>, runtime)`, each provider's `createConfig` reads its required keys from the env proxy — they arrive via `process.env` passthrough, unvalidated.

### What the Old `p.env` / `buildEnvGetter` Did (No Longer Called)

The `p.env` getter in provider factories calls `buildEnvGetter(def.envSchema)`, which uses `@t3-oss/env-core` with an explicit `runtimeEnv` built from only the keys in `envSchema`:

```ts
runtimeEnv: Object.fromEntries(Object.keys(envSchema).map((k) => [k, process.env[k]]))
```

This validates each provider's declared env vars with Zod at the point of first access. In the old gateway, calling `p.env` at startup was the mechanism that caught missing/malformed provider credentials early (at boot, not at first request).

**`api/platform` never calls `p.env`** — there are zero references to `p.env` or `buildEnvGetter` in `api/platform/src/`. The `p.env` getter is fully defined and functional for each provider, but is simply never invoked.

### Per-Provider Behavior Under the Current System

| Provider | `optional` | Missing env behavior |
|---|---|---|
| `github` | `false` | `githubConfigSchema.parse()` throws at first `getProviderConfigs()` call — no null-return path |
| `linear` | `true` | Returns `null` → excluded from configs → `500 provider_not_configured` on first webhook |
| `sentry` | `true` | Returns `null` → excluded |
| `vercel` | `true` | Returns `null` → excluded |
| `apollo` | `true` | Always returns `{}` — never fails |

For optional providers, the `null` return pattern provides runtime graceful degradation. For `github` (non-optional), the error surfaces at first `getProviderConfigs()` call (lazy — on first request to any platform route that needs configs).

### Full Provider Env Var → `createConfig` Key Mapping

| Provider | Keys read from `env` in `createConfig` | Source of value at runtime |
|---|---|---|
| `github` | `GITHUB_APP_SLUG`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET` | `process.env` via proxy passthrough |
| `linear` | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_WEBHOOK_SIGNING_SECRET` | `process.env` via proxy passthrough |
| `sentry` | `SENTRY_APP_SLUG`, `SENTRY_CLIENT_ID`, `SENTRY_CLIENT_SECRET` | `process.env` via proxy passthrough |
| `vercel` | `VERCEL_INTEGRATION_SLUG`, `VERCEL_CLIENT_SECRET_ID`, `VERCEL_CLIENT_INTEGRATION_SECRET` | `process.env` via proxy passthrough |
| `apollo` | _(none)_ | — |

None of these are declared in `api/platform/src/env.ts` — they are not Zod-validated at platform startup.

### `providerConfigs` Usage Breadth

The built config map is consumed across the entire `api/platform` surface:

| File | Usage |
|---|---|
| `apps/platform/src/app/api/ingest/[provider]/route.ts:113` | Webhook ingestion — extract signing secret, HMAC verify |
| `api/platform/src/lib/oauth/authorize.ts:63` | OAuth authorize flow |
| `api/platform/src/lib/oauth/callback.ts:163` | OAuth callback exchange |
| `api/platform/src/router/memory/connections.ts:158` | Connection management tRPC |
| `api/platform/src/router/memory/proxy.ts:127` | API proxy calls |
| `api/platform/src/router/memory/backfill.ts:225` | Backfill orchestration |
| `api/platform/src/inngest/functions/health-check.ts:72` | Connection health checks |
| `api/platform/src/inngest/functions/token-refresh.ts:86` | Token refresh |
| `api/platform/src/inngest/functions/connection-lifecycle.ts:87` | Lifecycle events |
| `api/platform/src/inngest/functions/memory-entity-worker.ts:135` | Entity processing pipeline |

### Additional Code References

- `api/platform/src/lib/provider-configs.ts:48–58` — `createConfig` call loop with `env as unknown as Record<string, string>` cast
- `api/platform/src/lib/provider-configs.ts:12` — `import { env } from "../env"` — slim 3-key env
- `api/platform/src/env.ts:12` — `experimental__runtimeEnv: process.env` — full proxy passthrough
- `packages/app-providers/src/providers/github/index.ts:359–367` — `createConfig` reads 6 keys, non-optional, throws on missing
- `packages/app-providers/src/providers/linear/index.ts:161–174` — `createConfig` returns `null` if any of 3 keys absent
- `packages/app-providers/src/providers/sentry/index.ts:94–102` — `createConfig` returns `null` if any of 3 keys absent
- `packages/app-providers/src/providers/vercel/index.ts:70–83` — `createConfig` returns `null` if any of 3 keys absent
- `packages/app-providers/src/factory/webhook.ts:61` — `p.env` getter (defined, never called in platform)
- `packages/app-providers/src/factory/api.ts:54` — same (defined, never called)
- `packages/app-providers/src/registry.ts:20–26` — `PROVIDERS` registry (apollo, github, vercel, linear, sentry)

---

## Open Questions

- Whether `@t3-oss/env-nextjs` throws on duplicate `NEXT_PUBLIC_VERCEL_ENV` across `extends` (declared in both `sentryEnv` and directly in `apps/platform/src/env.ts:34`) — behavior depends on library internals
- Whether `vercel()` being invoked twice (direct + via `betterstackEnv`'s extends) causes duplicate key warnings at runtime
- Why `api/platform/src/env.ts` uses `min(32)` for `ENCRYPTION_KEY` while both app layers use `min(44)` — a value of 32–43 chars would pass the API layer check but fail the app layer check at boot

# Connection & OAuth Port to Memory tRPC

## Overview

Port all gateway connection management, token vault operations, OAuth flow logic, and the authenticated API proxy into `@api/memory` tRPC procedures and `apps/memory` Route Handlers. This eliminates the `apps/gateway` Hono service entirely for connection CRUD, replacing it with:

- **tRPC procedures** (`api/memory/src/router/memory/connections.ts`, `proxy.ts`) for all service-to-service and console-to-platform calls
- **Route Handlers** (`apps/memory/src/app/api/connect/`) for browser-facing OAuth flows (authorize redirect, callback, CLI polling)
- **Shared lib modules** (`api/memory/src/lib/`) for token vault, encryption, and Redis helpers

The `@api/memory` package follows the identical patterns established by `@api/console`: `satisfies TRPCRouterRecord`, discriminated union auth context, `tsc`-only build, raw TS source exports.

---

## Current State Analysis

### Gateway Connection Routes (to port)

`apps/gateway/src/routes/connections.ts` — 1,198 lines, 14 route handlers:

| Route | Auth | tRPC-eligible? | Target |
|-------|------|---------------|--------|
| `GET /` | apiKeyAuth | YES | `connections.list` |
| `GET /:id` | apiKeyAuth | YES | `connections.get` |
| `GET /:id/token` | apiKeyAuth | YES | `connections.getToken` |
| `DELETE /:provider/:id` | apiKeyAuth | YES | `connections.disconnect` |
| `GET /:provider/authorize` | apiKeyAuth + tenant | YES | `connections.getAuthorizeUrl` |
| `POST /:id/resources` | apiKeyAuth | YES | `connections.registerResource` |
| `DELETE /:id/resources/:resourceId` | apiKeyAuth | YES | `connections.removeResource` |
| `GET /:id/proxy/endpoints` | apiKeyAuth | YES | `proxy.listEndpoints` |
| `POST /:id/proxy/execute` | apiKeyAuth | YES | `proxy.execute` |
| `GET /:id/backfill-runs` | apiKeyAuth | YES | `connections.listBackfillRuns` |
| `POST /:id/backfill-runs` | apiKeyAuth | YES | `connections.upsertBackfillRun` |
| `GET /:provider/callback` | None (browser) | NO — Route Handler | `apps/memory/src/app/api/connect/[provider]/callback/route.ts` |
| `GET /oauth/status` | None (state token) | NO — Route Handler | `apps/memory/src/app/api/connect/oauth/poll/route.ts` |

### Gateway Lib Modules (to port)

| Source file | Target file | Purpose |
|------------|------------|---------|
| `apps/gateway/src/lib/token-helpers.ts` | `api/memory/src/lib/token-helpers.ts` | `getActiveTokenForInstallation()`, `forceRefreshToken()` |
| `apps/gateway/src/lib/token-store.ts` | `api/memory/src/lib/token-store.ts` | `writeTokenRecord()`, `updateTokenRecord()` |
| `apps/gateway/src/lib/encryption.ts` | `api/memory/src/lib/encryption.ts` | `getEncryptionKey()` |
| `apps/gateway/src/lib/cache.ts` | `api/memory/src/lib/cache.ts` | Redis key helpers (`oauthStateKey`, `oauthResultKey`, `resourceKey`) |

### Gateway Module-Level Initialization

`apps/gateway/src/routes/connections.ts:44-64` — `providerConfigs` built once at startup:

```ts
const runtime: RuntimeConfig = { callbackBaseUrl: gatewayBaseUrl };
const providerConfigs: Record<string, unknown> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .map(([name, p]) => [name, p.createConfig(env as unknown as Record<string, string>, runtime)] as const)
    .filter(([, config]) => config !== null)
);
```

This pattern moves into `api/memory/src/lib/provider-configs.ts` — a module-level singleton initialized from `@api/memory`'s env. The `RuntimeConfig.callbackBaseUrl` changes from `gatewayBaseUrl` to the memory app's OAuth callback base URL.

### Gateway Teardown Workflow (to convert)

`apps/gateway/src/workflows/connection-teardown.ts` — Upstash Workflow with 5 steps:
1. `close-gate` — set installation status to `revoked`
2. `cancel-backfill` — QStash publish to backfill cancel
3. `revoke-token` — decrypt + call `auth.revokeToken()`
4. `cleanup-cache` — delete Redis resource keys
5. `remove-resources` — soft-delete DB resources + audit log

**In memory**: `connections.disconnect` fires `platform/connection.lifecycle` Inngest event. The teardown logic becomes an Inngest function (`connectionLifecycle` in `api/memory/src/inngest/`). This aligns with the platform architecture redesign plan which drops Upstash Workflow entirely.

### Console tRPC (current consumer)

`api/console/src/router/org/connections.ts` — Currently calls `createGatewayClient()` for:
- `getAuthorizeUrl` (proxied because browsers can't set X-Org-Id)
- `deleteConnection` (triggers teardown workflow)
- `executeApi` (GitHub validate, detectConfig, resource picker)

Post-migration: Console calls `@api/memory` tRPC procedures directly via in-process callers (same as `createM2MCaller` pattern) or via `packages/memory-trpc` HTTP client.

---

## Desired End State

### File Structure

```
api/memory/src/
├── trpc.ts                          ← tRPC init, ServiceContext, serviceProcedure
├── root.ts                          ← memoryRouter, serviceRouter composition
├── index.ts                         ← public API surface
├── env.ts                           ← @t3-oss/env-core (ENCRYPTION_KEY, GATEWAY_API_KEY, provider envs)
│
├── router/memory/
│   ├── connections.ts               ← 9 procedures (list, get, getToken, disconnect, etc.)
│   └── proxy.ts                     ← 2 procedures (listEndpoints, execute)
│
├── lib/
│   ├── provider-configs.ts          ← module-level providerConfigs singleton
│   ├── token-helpers.ts             ← getActiveTokenForInstallation, forceRefreshToken
│   ├── token-store.ts               ← writeTokenRecord, updateTokenRecord
│   ├── encryption.ts                ← getEncryptionKey
│   └── cache.ts                     ← Redis key helpers (oauthStateKey, oauthResultKey, resourceKey)
│
└── lib/oauth/
    ├── authorize.ts                 ← buildAuthorizeUrl (state creation + URL building)
    ├── callback.ts                  ← processOAuthCallback (state consume, token exchange, upsert)
    └── state.ts                     ← Redis atomic state management (MULTI HGETALL+DEL)

apps/memory/src/app/api/connect/
├── [provider]/
│   ├── authorize/route.ts           ← GET — redirects to provider OAuth (unused if tRPC getAuthorizeUrl suffices)
│   └── callback/route.ts            ← GET — OAuth callback, HTML+redirect responses
└── oauth/
    └── poll/route.ts                ← GET — CLI polling for OAuth result (unauthenticated)
```

### Auth Model

`api/memory/src/trpc.ts` — Two auth types for platform:

```ts
type MemoryAuthContext =
  | { type: "service"; apiKey: string }      // X-API-Key verified (service-to-service)
  | { type: "unauthenticated" }              // Route Handlers handle their own auth

export const serviceProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.apiKey || !timingSafeStringEqual(ctx.apiKey, env.GATEWAY_API_KEY)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, auth: { type: "service" as const } } });
});
```

The gateway's `apiKeyAuth` middleware maps directly to `serviceProcedure`. The `tenantMiddleware` (X-Org-Id header) is replaced by `orgId` as a field in the tRPC input schema — no header extraction needed.

### Procedure Signatures

#### `connections.ts` (9 procedures)

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `list` | query | `{ status?: string }` | `GatewayInstallationSummary[]` |
| `get` | query | `{ id: string }` | `GatewayConnection` |
| `getToken` | query | `{ id: string }` | `GatewayTokenResult` |
| `disconnect` | mutation | `{ provider: string; id: string }` | `{ status: "lifecycle_initiated"; installationId: string }` |
| `getAuthorizeUrl` | query | `{ provider: string; orgId: string; userId?: string; redirectTo?: string }` | `{ url: string; state: string }` |
| `registerResource` | mutation | `{ id: string; providerResourceId: string; resourceName?: string }` | `{ status: "linked"; resource: { id, providerResourceId, resourceName } }` |
| `removeResource` | mutation | `{ id: string; resourceId: string }` | `{ status: "removed"; resourceId: string }` |
| `listBackfillRuns` | query | `{ id: string; status?: string }` | `BackfillRunReadRecord[]` |
| `upsertBackfillRun` | mutation | `{ id: string; record: BackfillRunRecord }` | `{ status: "ok" }` |

All use `serviceProcedure`.

#### `proxy.ts` (2 procedures)

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `listEndpoints` | query | `{ id: string }` | `ProxyEndpointsResponse` |
| `execute` | mutation | `{ id: string; endpointId: string; pathParams?: Record<string,string>; queryParams?: Record<string,string>; body?: unknown }` | `ProxyExecuteResponse` |

Both use `serviceProcedure`.

### Key Behavioral Changes

| Aspect | Gateway (current) | Memory (target) |
|--------|-------------------|-----------------|
| **Auth** | `apiKeyAuth` middleware (X-API-Key) | `serviceProcedure` middleware (same key) |
| **Tenant** | `tenantMiddleware` (X-Org-Id header) | `orgId` in input schema |
| **Disconnect** | `workflowClient.trigger()` (Upstash Workflow) | `inngest.send("platform/connection.lifecycle")` |
| **Teardown** | 5-step Upstash Workflow | Inngest function (same 5 steps) |
| **OAuth callback** | Hono route with `html()` + `c.redirect()` | Next.js Route Handler with `NextResponse.redirect()` |
| **OAuth state** | Redis MULTI (kept — same pattern) | Redis MULTI (same — `@vendor/upstash`) |
| **Token vault** | AES-GCM via `@repo/lib` encrypt/decrypt | Identical — same `@repo/lib` encrypt/decrypt |
| **Provider configs** | Module-level in `connections.ts` | Module-level in `api/memory/src/lib/provider-configs.ts` |
| **Error shape** | `c.json({ error: "..." }, 404)` | `throw new TRPCError({ code: "NOT_FOUND" })` |

### Verification

```bash
pnpm typecheck                    # All packages pass
pnpm check                        # No lint errors
pnpm --filter @api/memory build   # tsc succeeds
pnpm build:console                # Console still builds (consumer updated)
```

Manual: OAuth flow through console, backfill trigger, proxy executeApi all work.

---

## What We're NOT Doing

- **No migration of webhook ingestion** — that's the relay port (separate plan)
- **No migration of Inngest functions** — health check, token refresh, backfill orchestrator are separate port plans
- **No new DB schema** — uses existing `gatewayInstallations`, `gatewayTokens`, `gatewayResources`, `gatewayLifecycleLogs`, `gatewayBackfillRuns` tables
- **No superjson transformer** — all responses use ISO strings, not Date objects (same as gateway)
- **No consumer call site changes yet** — console tRPC keeps using `createGatewayClient()` until Phase 5 updates it
- **No `executeApi` narrow typing in tRPC** — the `ExecuteApiFn` overload interface stays in `@repo/gateway-service-clients` for now; the tRPC procedure uses `ProxyExecuteResponse` (data: unknown)

---

## Implementation Approach

Six phases, each independently verifiable. Phases 1-3 build the foundation. Phase 4 ports the tRPC procedures. Phase 5 ports the OAuth Route Handlers. Phase 6 updates consumers.

---

## Phase 1: `@api/memory` Package Scaffold

### Overview

Create the `api/memory/` package following `@api/console` conventions. Set up tRPC initialization, env validation, and the empty router structure.

### Changes Required

#### 1. Create `api/memory/package.json`

Follow `api/console/package.json` pattern:
- `name: "@api/memory"`, `private: true`, `type: "module"`, `sideEffects: false`
- Build: `tsc` (no tsup)
- Exports: `"."` → `./src/index.ts` (default), `./dist/index.d.ts` (types)
- Dependencies: `@db/console`, `@repo/console-providers`, `@repo/lib`, `@vendor/db`, `@vendor/upstash`, `@vendor/inngest`, `@vendor/observability`, `@t3-oss/env-core`, `@trpc/server`, `zod`

#### 2. Create `api/memory/tsconfig.json`

Extends `@repo/typescript-config/internal-package.json`. `outDir: "dist"`, `rootDir: "src"`.

#### 3. Create `api/memory/turbo.json`

`tags: ["api"]`, `extends: ["//"]`, `tasks: {}`.

#### 4. Create `api/memory/src/env.ts`

Composable env using `@t3-oss/env-core` with `extends`:

```ts
extends: [vercel(), dbEnv, inngestEnv, upstashEnv, ...PROVIDER_ENVS()]
server: {
  GATEWAY_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
  SENTRY_DSN: z.url().optional(),
}
```

Mirrors `apps/gateway/src/env.ts` — same env vars needed for token vault + provider configs.

#### 5. Create `api/memory/src/trpc.ts`

tRPC initialization with `ServiceContext`:

```ts
import { initTRPC, TRPCError } from "@trpc/server";
import { timingSafeStringEqual } from "@repo/console-providers";
import { env } from "./env.js";

export interface ServiceContext {
  apiKey: string | undefined;
}

const t = initTRPC.context<ServiceContext>().create();

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const serviceProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.apiKey || !timingSafeStringEqual(ctx.apiKey, env.GATEWAY_API_KEY)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});
```

No `superjson` transformer — same decision as the Hono-tRPC migration plan.

#### 6. Create `api/memory/src/root.ts`

Empty router shell:

```ts
import { createTRPCRouter } from "./trpc.js";

export const memoryRouter = createTRPCRouter({
  // connections: connectionsRouter,  (Phase 4)
  // proxy: proxyRouter,              (Phase 4)
});

export type MemoryRouter = typeof memoryRouter;
```

#### 7. Create `api/memory/src/index.ts`

Public API surface:

```ts
export { memoryRouter, type MemoryRouter } from "./root.js";
export { createCallerFactory, createTRPCRouter, serviceProcedure, publicProcedure } from "./trpc.js";
export type { ServiceContext } from "./trpc.js";
```

### Success Criteria

- [ ] `pnpm --filter @api/memory typecheck` passes
- [ ] `pnpm --filter @api/memory build` produces `dist/` with `.d.ts` files
- [ ] No circular dependency warnings in Turborepo

---

## Phase 2: Port Lib Modules

### Overview

Copy and adapt the four gateway lib modules into `api/memory/src/lib/`. These are pure functions with no Hono coupling — the port is mechanical (import path updates only).

### Changes Required

#### 1. Create `api/memory/src/lib/encryption.ts`

Direct copy from `apps/gateway/src/lib/encryption.ts`. Change import from `../env.js` to `../env.js` (same relative path in the new package).

```ts
import { env } from "../env.js";

export function getEncryptionKey(): string {
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is required but not set.");
  }
  return key;
}
```

#### 2. Create `api/memory/src/lib/cache.ts`

Direct copy from `apps/gateway/src/lib/cache.ts`. All functions are pure (no env dependency).

7 key helpers: `connectionKey`, `orgConnectionsKey`, `providerAccountKey`, `resourceKey`, `connectionResourcesKey`, `oauthStateKey`, `oauthResultKey`.

#### 3. Create `api/memory/src/lib/token-store.ts`

Copy from `apps/gateway/src/lib/token-store.ts`. Update import:
- `../lib/encryption.js` → `./encryption.js`

No other changes — uses `@db/console/client`, `@db/console/schema`, `@repo/lib`, `@vendor/db`.

Contains: `writeTokenRecord()`, `updateTokenRecord()`, `assertEncryptedFormat()`.

#### 4. Create `api/memory/src/lib/token-helpers.ts`

Copy from `apps/gateway/src/lib/token-helpers.ts`. Update imports:
- `./encryption.js` (same)
- `./token-store.js` (same)

Contains: `getActiveTokenForInstallation()`, `forceRefreshToken()`.

#### 5. Create `api/memory/src/lib/provider-configs.ts`

Extract the module-level initialization from `apps/gateway/src/routes/connections.ts:44-64`:

```ts
import type { RuntimeConfig } from "@repo/console-providers";
import { PROVIDERS } from "@repo/console-providers";
import { env } from "../env.js";

// callbackBaseUrl points to the memory app's OAuth callback path
const runtime: RuntimeConfig = { callbackBaseUrl: memoryCallbackBaseUrl() };

/** Configs keyed by provider name — built once at module load. */
export const providerConfigs: Record<string, unknown> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .map(([name, p]) => [name, p.createConfig(env as unknown as Record<string, string>, runtime)] as const)
    .filter(([, config]) => config !== null)
);

function memoryCallbackBaseUrl(): string {
  // Same logic as gateway's gatewayBaseUrl but for the memory app
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3024"; // console microfrontend
}
```

The `callbackBaseUrl` changes from `/services` (gateway path) to the memory app's base URL. OAuth callback routes in `apps/memory` use the pattern `/api/connect/:provider/callback`.

### Success Criteria

- [ ] `pnpm --filter @api/memory typecheck` passes
- [ ] All 4 lib modules resolve their imports without error
- [ ] `getEncryptionKey()`, `writeTokenRecord()`, `getActiveTokenForInstallation()` type signatures match gateway originals

---

## Phase 3: Port OAuth Flow Lib

### Overview

Extract OAuth flow logic (state management, authorize URL building, callback processing) into `api/memory/src/lib/oauth/`. These are consumed by both the tRPC `getAuthorizeUrl` procedure and the Next.js Route Handler for `/api/connect/:provider/callback`.

### Changes Required

#### 1. Create `api/memory/src/lib/oauth/state.ts`

Redis atomic state management, extracted from `connections.ts:113-168`:

```ts
import { redis } from "@vendor/upstash";
import { oauthStateKey, oauthResultKey } from "../cache.js";

/** Store OAuth state in Redis with 10-minute TTL. */
export async function storeOAuthState(state: string, data: Record<string, string>): Promise<void> {
  const key = oauthStateKey(state);
  await redis.pipeline().hset(key, data).expire(key, 600).exec();
}

/** Atomically read-and-delete OAuth state (replay protection). */
export async function consumeOAuthState(state: string): Promise<Record<string, string> | null> {
  const key = oauthStateKey(state);
  const [stateData] = await redis
    .multi()
    .hgetall<Record<string, string>>(key)
    .del(key)
    .exec<[Record<string, string> | null, number]>();
  return stateData?.orgId ? stateData : null;
}

/** Store OAuth completion result for CLI polling (5-minute TTL). */
export async function storeOAuthResult(state: string, result: Record<string, string>): Promise<void> {
  await redis.pipeline().hset(oauthResultKey(state), result).expire(oauthResultKey(state), 300).exec();
}

/** Read OAuth result for CLI polling. */
export async function getOAuthResult(state: string): Promise<Record<string, string> | null> {
  return redis.hgetall<Record<string, string>>(oauthResultKey(state));
}
```

#### 2. Create `api/memory/src/lib/oauth/authorize.ts`

Extracted from `connections.ts:79-141`:

```ts
import { nanoid } from "@repo/lib";
import { getProvider } from "@repo/console-providers";
import type { SourceType } from "@repo/console-providers";
import { providerConfigs } from "../provider-configs.js";
import { storeOAuthState } from "./state.js";

export interface AuthorizeParams {
  provider: SourceType;
  orgId: string;
  connectedBy: string;
  redirectTo?: string;
  consoleUrl: string;
}

export async function buildAuthorizeUrl(params: AuthorizeParams): Promise<{ url: string; state: string }> {
  const { provider, orgId, connectedBy, redirectTo } = params;

  const providerDef = getProvider(provider);
  const config = providerConfigs[provider];
  if (!config) {
    throw new Error(`unknown_provider: ${provider}`);
  }

  const state = nanoid();
  await storeOAuthState(state, {
    provider,
    orgId,
    connectedBy,
    ...(redirectTo ? { redirectTo } : {}),
    createdAt: Date.now().toString(),
  });

  const auth = providerDef.auth;
  let url: string;
  if (auth.kind === "oauth") {
    url = auth.buildAuthUrl(config as never, state);
  } else if (auth.kind === "app-token") {
    url = auth.buildInstallUrl(config as never, state);
  } else {
    throw new Error("provider_does_not_support_oauth");
  }

  return { url, state };
}
```

#### 3. Create `api/memory/src/lib/oauth/callback.ts`

Extracted from `connections.ts:208-489` — the heavyweight callback processing:

```ts
import { db } from "@db/console/client";
import { gatewayInstallations } from "@db/console/schema";
import { getProvider, providerAccountInfoSchema } from "@repo/console-providers";
import type { SourceType } from "@repo/console-providers";
import { and, eq } from "@vendor/db";
import { providerConfigs } from "../provider-configs.js";
import { writeTokenRecord } from "../token-store.js";
import { consumeOAuthState, storeOAuthResult } from "./state.js";

export interface CallbackResult {
  kind: "pending-setup" | "connected" | "connected-redirect" | "error";
  provider: SourceType;
  reactivated?: boolean;
  setupAction?: string;
  nextUrl?: string;       // for connected-redirect
  error?: string;
  redirectTo?: string;    // from state
  state: string;
}

export async function processOAuthCallback(
  providerName: SourceType,
  query: Record<string, string>,
  stateParam: string
): Promise<CallbackResult> {
  // ... same logic as connections.ts:208-489
  // Returns a structured result instead of Hono Response
  // The Route Handler maps this to NextResponse.redirect / HTML
}
```

This function does NOT return HTTP responses — it returns a structured `CallbackResult` that the Route Handler maps to `NextResponse.redirect()` or HTML. This keeps the OAuth logic testable without HTTP coupling.

### Success Criteria

- [ ] `pnpm --filter @api/memory typecheck` passes
- [ ] `storeOAuthState` / `consumeOAuthState` match existing Redis pipeline behavior
- [ ] `buildAuthorizeUrl` returns `{ url, state }` matching current gateway response shape

---

## Phase 4: Port tRPC Procedures

### Overview

Create the 11 tRPC procedures across two sub-routers. Each procedure re-implements its corresponding gateway Hono handler using `TRPCError` for error responses and `serviceProcedure` for auth.

### Changes Required

#### 1. Create `api/memory/src/router/memory/connections.ts`

9 procedures as `satisfies TRPCRouterRecord`:

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { serviceProcedure } from "../../trpc.js";
// ... db, schema, provider imports

export const connectionsRouter = {
  list: serviceProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ input }) => {
      // Logic from connections.ts:1181-1196
    }),

  get: serviceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Logic from connections.ts:509-552
      // throw new TRPCError({ code: "NOT_FOUND" }) instead of c.json(404)
    }),

  getToken: serviceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Logic from connections.ts:561-618
      // Uses getActiveTokenForInstallation from lib/token-helpers
    }),

  disconnect: serviceProcedure
    .input(z.object({ provider: z.string(), id: z.string() }))
    .mutation(async ({ input }) => {
      // Logic from connections.ts:880-923
      // KEY CHANGE: fires inngest.send("platform/connection.lifecycle") instead of workflowClient.trigger()
    }),

  getAuthorizeUrl: serviceProcedure
    .input(z.object({
      provider: z.string(),
      orgId: z.string(),
      userId: z.string().optional(),
      redirectTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Delegates to lib/oauth/authorize.ts buildAuthorizeUrl()
    }),

  registerResource: serviceProcedure
    .input(z.object({
      id: z.string(),
      providerResourceId: z.string(),
      resourceName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Logic from connections.ts:933-1029
    }),

  removeResource: serviceProcedure
    .input(z.object({ id: z.string(), resourceId: z.string() }))
    .mutation(async ({ input }) => {
      // Logic from connections.ts:1037-1082
    }),

  listBackfillRuns: serviceProcedure
    .input(z.object({ id: z.string(), status: z.string().optional() }))
    .query(async ({ input }) => {
      // Logic from connections.ts:1087-1112
    }),

  upsertBackfillRun: serviceProcedure
    .input(z.object({ id: z.string(), record: backfillRunRecord }))
    .mutation(async ({ input }) => {
      // Logic from connections.ts:1114-1170
    }),
} satisfies TRPCRouterRecord;
```

**Error mapping:**

| Gateway HTTP | tRPC Code |
|-------------|-----------|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 500 | `INTERNAL_SERVER_ERROR` |
| 502 | `BAD_GATEWAY` (use `INTERNAL_SERVER_ERROR` with message) |

#### 2. Create `api/memory/src/router/memory/proxy.ts`

2 procedures:

```ts
export const proxyRouter = {
  listEndpoints: serviceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Logic from connections.ts:626-661
    }),

  execute: serviceProcedure
    .input(z.object({
      id: z.string(),
      endpointId: z.string(),
      pathParams: z.record(z.string(), z.string()).optional(),
      queryParams: z.record(z.string(), z.string()).optional(),
      body: z.unknown().optional(),
    }))
    .mutation(async ({ input }) => {
      // Logic from connections.ts:671-871
      // Full proxy with 401 retry via forceRefreshToken
    }),
} satisfies TRPCRouterRecord;
```

#### 3. Update `api/memory/src/root.ts`

Wire in the new routers:

```ts
import { createTRPCRouter } from "./trpc.js";
import { connectionsRouter } from "./router/memory/connections.js";
import { proxyRouter } from "./router/memory/proxy.js";

export const memoryRouter = createTRPCRouter({
  connections: connectionsRouter,
  proxy: proxyRouter,
});

export type MemoryRouter = typeof memoryRouter;
```

#### 4. Key implementation detail: `disconnect` mutation

The disconnect procedure is the most significant behavioral change:

**Before (gateway):**
```ts
await workflowClient.trigger({
  url: `${gatewayBaseUrl}/gateway/workflows/connection-teardown`,
  body: JSON.stringify({ installationId, provider, orgId }),
});
```

**After (memory):**
```ts
import { inngest } from "../../inngest/client.js";

// Audit log
await db.insert(gatewayLifecycleLogs).values({
  installationId: input.id,
  event: "user_disconnect",
  fromStatus: installation.status,
  toStatus: "revoked",
  reason: "User-initiated disconnect via memory tRPC",
  metadata: { source: "memory_disconnect", triggeredBy: "user" },
});

// Fire lifecycle event — Inngest function handles the 5-step teardown
await inngest.send({
  name: "platform/connection.lifecycle",
  data: {
    reason: "user_disconnect",
    installationId: input.id,
    orgId: installation.orgId,
    provider: input.provider,
    triggeredBy: "user",
  },
});
```

### Success Criteria

- [ ] `pnpm --filter @api/memory typecheck` passes
- [ ] All 11 procedures have input schemas matching the gateway route inputs
- [ ] All procedures use `serviceProcedure` (no unprotected endpoints)
- [ ] `disconnect` fires `platform/connection.lifecycle` Inngest event
- [ ] `proxy.execute` preserves the 401-retry pattern with `forceRefreshToken`

---

## Phase 5: Port OAuth Route Handlers

### Overview

Create Next.js Route Handlers in `apps/memory/` for the three browser-facing OAuth routes that cannot be tRPC (they return HTML or HTTP redirects).

### Changes Required

#### 1. Create `apps/memory/src/app/api/connect/[provider]/callback/route.ts`

GET handler — OAuth callback. Consumes state, calls `processOAuthCallback()` from `api/memory/src/lib/oauth/callback.ts`, returns `NextResponse`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { processOAuthCallback } from "@api/memory/lib/oauth/callback";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((v, k) => { query[k] = v; });
  const state = query.state ?? "";

  const result = await processOAuthCallback(provider as SourceType, query, state);

  switch (result.kind) {
    case "pending-setup":
      // Redirect or inline HTML based on result.redirectTo
      // Same logic as connections.ts:285-325
      break;
    case "connected":
      // Redirect to console or inline HTML
      // Same logic as connections.ts:402-438
      break;
    case "connected-redirect":
      return NextResponse.redirect(result.nextUrl!);
    case "error":
      // Error redirect or inline HTML
      // Same logic as connections.ts:439-487
      break;
  }
}
```

The inline HTML responses (for CLI mode) use `new NextResponse(htmlString, { headers: { "Content-Type": "text/html" } })`.

#### 2. Create `apps/memory/src/app/api/connect/oauth/poll/route.ts`

GET handler — CLI polling for OAuth result:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getOAuthResult } from "@api/memory/lib/oauth/state";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.json({ error: "missing_state" }, { status: 400 });
  }

  const result = await getOAuthResult(state);
  if (!result) {
    return NextResponse.json({ status: "pending" });
  }
  return NextResponse.json(result);
}
```

No auth required — the state token itself is the secret (cryptographically random nanoid).

#### 3. Create `apps/memory/src/app/api/connect/[provider]/authorize/route.ts` (optional)

GET handler — browser-initiated OAuth redirect. Only needed if the console UI navigates directly to this URL (current flow uses tRPC `getAuthorizeUrl` instead). Include as a stub that redirects to the authorize URL:

```ts
// Optional: only if direct browser navigation to /api/connect/:provider/authorize is needed
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  // Extract orgId from query or session, build authorize URL, redirect
}
```

#### 4. GitHub-specific stateless callback recovery

The callback handler must replicate the GitHub-specific logic from `connections.ts:224-250` — when state is missing but `installation_id` is present (GitHub-initiated redirects from permission changes), look up the existing installation to recover `orgId`/`connectedBy`.

This logic lives in `processOAuthCallback()` so both the Route Handler and any future test can exercise it.

### Success Criteria

- [ ] `apps/memory` builds with the Route Handlers
- [ ] OAuth callback returns HTML for `redirectTo=inline` mode (CLI)
- [ ] OAuth callback redirects to console for default mode
- [ ] OAuth poll endpoint returns `{ status: "pending" }` for unknown state
- [ ] GitHub stateless recovery path works (missing state + installation_id present)

---

## Phase 6: Update Consumers

### Overview

Update `@repo/gateway-service-clients` and `api/console/src/router/org/connections.ts` to call `@api/memory` tRPC procedures instead of gateway HTTP routes. This is the final cut-over.

### Changes Required

#### 1. Update `packages/gateway-service-clients/src/gateway.ts`

Replace each `fetch(gatewayUrl/...)` call with a tRPC proxy client call. Two approaches:

**Option A: tRPC proxy client** (if `@api/memory` router types are safe to import without build cycles)

```ts
import { createTRPCClient, httpLink } from "@trpc/client";
import type { MemoryRouter } from "@api/memory";

const trpc = createTRPCClient<MemoryRouter>({
  links: [httpLink({ url: `${memoryUrl}/api/trpc`, headers: () => buildServiceHeaders(config) })],
});

// getConnection → trpc.connections.get.query({ id })
// getToken → trpc.connections.getToken.query({ id })
// etc.
```

**Option B: Keep fetch, update URLs** (if build cycles are a concern)

Update `gatewayUrl` to point at the memory app's tRPC endpoint. Keep existing Zod validation on responses. This is the minimal-risk approach.

**Decision**: Use Option B initially (same as Hono-tRPC migration plan's approach — no router type imports to avoid cycles). Replace `fetch` URLs from `${gatewayUrl}/<path>` to tRPC-style calls using the existing Zod schemas for response validation.

#### 2. Update `api/console/src/router/org/connections.ts`

The console connections router currently creates a `GatewayClient` for each call. Post-migration, it can either:

**A**: Import `createCallerFactory` from `@api/memory` and call procedures directly (in-process, if running in the same Next.js app via microfrontends).

**B**: Keep using `createGatewayClient()` which now internally routes to memory tRPC.

**Decision**: Use B initially (zero changes to console router code). After the gateway-service-clients package is updated in step 1, all console calls automatically route to memory.

#### 3. Update console `next.config.ts` rewrites

Current rewrites route `/services/gateway/*` to the gateway Hono service. Post-migration, these rewrites point to the memory app's tRPC endpoint, or are removed entirely if the client package uses the memory app URL directly.

### Success Criteria

- [ ] `pnpm typecheck` passes for all packages
- [ ] `pnpm build:console` succeeds
- [ ] OAuth flow works end-to-end through console
- [ ] `connections.disconnect` triggers Inngest lifecycle event (not Upstash Workflow)
- [ ] `proxy.execute` works for GitHub validate + detectConfig
- [ ] `getToken` returns decrypted token for backfill entity workers

---

## Testing Strategy

### Unit Tests (`createCallerFactory`)

For each procedure, use `createCallerFactory` to test without HTTP:

```ts
import { createCallerFactory } from "@api/memory";
import { memoryRouter } from "@api/memory";

const createCaller = createCallerFactory(memoryRouter);
const caller = createCaller({ apiKey: "test-key" });

it("returns NOT_FOUND for unknown installation", async () => {
  await expect(caller.connections.get({ id: "nonexistent" }))
    .rejects.toMatchObject({ code: "NOT_FOUND" });
});
```

### Integration Tests

Port the existing gateway integration tests from `apps/gateway/src/routes/connections.test.ts` and `connections.integration.test.ts` to test the tRPC procedures against a real database.

### Manual Testing

1. Start `pnpm dev:app` (full stack)
2. Create GitHub connection via console OAuth popup
3. Verify `connections.list` returns the new installation
4. Trigger backfill — verify `proxy.execute` resolves tokens correctly
5. Disconnect — verify Inngest event fires and teardown completes
6. Test CLI OAuth flow with `redirectTo=inline`

---

## Migration Notes

- **Dual-path period**: Gateway Hono routes remain active during Phases 1-5. Consumer migration (Phase 6) is the atomic switch. Rollback = revert `@repo/gateway-service-clients` URL change.
- **Deploy order**: Deploy `@api/memory` + `apps/memory` Route Handlers before updating consumers. The memory app must be serving tRPC before clients start calling it.
- **Env vars**: Memory app needs `GATEWAY_API_KEY`, `ENCRYPTION_KEY`, and all `PROVIDER_ENVS()` — same as gateway. These must be configured in the memory app's Vercel environment.
- **Redis namespace**: OAuth keys use `gw:oauth:*` namespace. The memory app shares the same Upstash Redis instance — no namespace collision since the keys are identical.

---

## Dependencies

- **@api/memory foundation must exist first** — Phase 1 creates the package scaffold
- **`@repo/inngest` must export `platform/connection.lifecycle` event** — already exists in `packages/inngest/src/schemas/platform.ts`
- **`apps/memory` must exist as a Next.js app** — for Route Handlers (Phase 5). If the app scaffold doesn't exist yet, Phase 5 is blocked.
- **Connection teardown Inngest function** must exist for `disconnect` to work end-to-end. The function that listens on `platform/connection.lifecycle` is a separate implementation plan.

---

## References

- Gateway connections routes: `apps/gateway/src/routes/connections.ts`
- Gateway token vault: `apps/gateway/src/lib/token-helpers.ts`, `token-store.ts`, `encryption.ts`
- Gateway env: `apps/gateway/src/env.ts`
- Gateway teardown workflow: `apps/gateway/src/workflows/connection-teardown.ts`
- Console connections router: `api/console/src/router/org/connections.ts`
- Console tRPC patterns: `api/console/src/trpc.ts`, `api/console/src/root.ts`
- Gateway service clients: `packages/gateway-service-clients/src/gateway.ts`
- Contract schemas: `packages/console-providers/src/contracts/gateway.ts`
- Inngest events: `packages/inngest/src/schemas/platform.ts`
- Platform architecture redesign: `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md`
- Architecture research: `thoughts/shared/research/2026-03-19-platform-trpc-architecture-patterns.md`
- Hono-tRPC migration plan: `thoughts/shared/plans/2026-03-19-hono-trpc-migration.md`

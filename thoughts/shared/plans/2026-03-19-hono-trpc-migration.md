# Hono → tRPC Migration Implementation Plan

## Overview

Convert the three internal Hono microservices (`apps/gateway`, `apps/relay`, `apps/backfill`) to expose tRPC routers alongside their existing routes, then migrate `@repo/gateway-service-clients` to use tRPC proxy clients. This eliminates three unvalidated `as` casts in the relay/backfill clients and gives all inter-service calls consistent error handling and input validation.

## Current State Analysis

### Services and Route Classification

| Service | tRPC-eligible routes | Must stay Hono | Total |
|---------|---------------------|----------------|-------|
| Gateway | 10 (all apiKeyAuth JSON CRUD routes) | 3 (OAuth callback: HTML+redirect; OAuth status: browser poll; `executeApi`: narrow generic typing) | 13 |
| Relay | 5 (admin apiKeyAuth routes) | 4 (webhook ingest: HMAC raw body; workflow serve: Upstash protocol; QStash callbacks: external auth) | 9 |
| Backfill | 3 (trigger, cancel, estimate) | 1 (Inngest serve: protocol owner) | 4 |

### Type-Safety Gaps Today

Three methods in `@repo/gateway-service-clients` use `as` casts with **no runtime validation**:

| Method | Cast | File:line |
|--------|------|-----------|
| `BackfillClient.estimate` | `response.json() as Promise<Record<string, unknown>>` | `packages/gateway-service-clients/src/backfill.ts:35` |
| `BackfillClient.trigger` | `response.json() as Promise<{ status: string; installationId: string }>` | `packages/gateway-service-clients/src/backfill.ts:57` |
| `RelayClient.replayCatchup` | `response.json() as Promise<{ remaining: number }>` | `packages/gateway-service-clients/src/relay.ts:61` |

The gateway client methods already use Zod validation from `@repo/console-providers/contracts`. After migration, backfill and relay methods get the same treatment.

### Key Discovery: URL Routing

All inter-service URLs route through the console host via `@vercel/related-projects`. Based on path analysis:
- `lightfast.ai/services/gateway/*` → `gateway:4110/services/gateway/*` (full path passed)
- `lightfast.ai/services/relay/*` → `relay:4108/api/*` (console strips `/services/relay`, relay adds `/api/`)
- `lightfast.ai/services/backfill/*` → `backfill:4109/api/*` (same pattern as relay)

This determines tRPC mount points:
- Gateway: mount at `/services/gateway/trpc/*` with `endpoint: '/services/gateway/trpc'`
- Relay: mount at `/api/trpc/*` with `endpoint: '/api/trpc'`
- Backfill: mount at `/api/trpc/*` with `endpoint: '/api/trpc'`

Client tRPC base URLs (appended to existing URL constants):
- `${gatewayUrl}/trpc` = `lightfast.ai/services/gateway/trpc`
- `${relayUrl}/trpc` = `lightfast.ai/services/relay/trpc` → hits `relay:4108/api/trpc`
- `${backfillUrl}/trpc` = `lightfast.ai/services/backfill/trpc` → hits `backfill:4109/api/trpc`

### Key Discovery: Circular Dependency Constraint

`apps/gateway` imports `backfillUrl` from `@repo/gateway-service-clients`. `apps/backfill` imports `createGatewayClient` and `createRelayClient` from `@repo/gateway-service-clients`. This means the client package **cannot** import router types from the service apps (would create build cycles Turborepo would reject).

**Decision**: `@repo/gateway-service-clients` uses the existing Zod schemas from `@repo/console-providers/contracts` for response typing (same pattern as gateway methods today), not imported `AppRouter` types. This preserves the current architecture while fixing the `as` casts.

### Key Discovery: `executeApi` Excluded

`POST /:id/proxy/execute` uses a two-overload `ExecuteApiFn` interface with `ResponseDataFor<P, E>` generic narrow typing. tRPC procedures have fixed return types, making this incompatible. The route already has full Zod validation (`proxyExecuteResponseSchema.parse()`). It is excluded from this migration.

### tRPC Conventions in This Codebase

- Version: `@trpc/server@^11.12.0` (root catalog, already installed)
- Pattern: `satisfies TRPCRouterRecord` for router objects (see `api/console/src/router/user/account.ts`)
- Root routers: `t.router({})` with named sub-routers
- No `superjson` transformer needed (service responses use ISO strings, not Date objects)
- Context: `{ apiKey: string | undefined }` extracted from `X-API-Key` header via `@hono/trpc-server` `createContext`

## Desired End State

After migration:
1. Each Hono service exposes tRPC at its `/trpc/*` path alongside unchanged non-tRPC routes
2. `@repo/gateway-service-clients` factory methods use tRPC proxy clients internally
3. The three `as` casts in `backfill.ts` and `relay.ts` are replaced with Zod-validated responses
4. Consumer call sites (`api/console/src/router/org/connections.ts`, `workspace.ts`, backfill workflows) are unchanged — same factory function interface
5. All tRPC-converted routes have server-side input validation via Zod

### Verification

After all phases:
```bash
pnpm typecheck            # No type errors
pnpm check                # No lint errors
pnpm build:console        # Console builds
pnpm build:gateway        # Gateway builds
pnpm build:relay          # Relay builds
pnpm build:backfill       # Backfill builds
```

Manual: Trigger a connection OAuth flow and backfill through the console — should work identically to before.

## What We're NOT Doing

- **No router type imports** from service apps into `@repo/gateway-service-clients` (avoids build cycles)
- **No migration of `executeApi`** — complex narrow typing makes this incompatible with tRPC
- **No migration of `oauth/status`** — browser-polling endpoint, unauthenticated, not a service client
- **No superjson transformer** — dates are already ISO strings in all service responses
- **No shared `@repo/service-trpc` package** — per-service `trpc.ts` is simpler; 3 services × ~20 lines duplication is acceptable
- **No restructuring into `@api/gateway` pattern** — that would require moving all business logic to a new package (future work if full router-type safety is needed)
- **No changes to consumer call sites** — `createGatewayClient()`, `createBackfillClient()`, `createRelayClient()` interfaces remain stable

## Implementation Approach

Each phase is independently deployable. Phases 2-4 add tRPC routers while existing Hono routes remain; Phase 5 migrates the client; Phase 6 removes the old routes. The dual-path period (Hono + tRPC) allows rollback at any point before Phase 6.

---

## Phase 1: Dependencies and Response Schema Additions

### Overview

Install `@hono/trpc-server` in each service workspace. Add missing response schemas to `@repo/console-providers/contracts` for the backfill and relay methods that currently use `as` casts. Add `@trpc/client` to the client package.

### Changes Required

#### 1. Install dependencies in each Hono service

**Files**: `apps/gateway/package.json`, `apps/relay/package.json`, `apps/backfill/package.json`

Add to `dependencies`:
```json
"@hono/trpc-server": "0.4.2",
"@trpc/server": "catalog:"
```

Note: `@trpc/server` is already in the root catalog at `^11.12.0`.

#### 2. Add `@trpc/client` to gateway-service-clients

**File**: `packages/gateway-service-clients/package.json`

Add to `dependencies`:
```json
"@trpc/client": "catalog:"
```

#### 3. Add response schemas to `@repo/console-providers/contracts`

**File**: `packages/console-providers/src/contracts/responses.ts` (new file)

Add Zod schemas for the three currently unvalidated response types:

```typescript
import { z } from "zod";

// BackfillClient.trigger response
export const backfillTriggerResponseSchema = z.object({
  status: z.string(),
  installationId: z.string(),
});
export type BackfillTriggerResponse = z.infer<typeof backfillTriggerResponseSchema>;

// BackfillClient.estimate response — top-level envelope
// (inner estimate data is per-entityType, shape depends on provider, typed as unknown)
export const backfillEstimateResponseSchema = z.object({
  installationId: z.string(),
  provider: z.string(),
  depth: z.number(),
  entityTypes: z.array(z.string()),
  since: z.string(),
  estimate: z.record(z.string(), z.unknown()),
  totals: z.object({
    estimatedItems: z.number(),
    estimatedPages: z.number(),
    estimatedApiCalls: z.number(),
  }),
});
export type BackfillEstimateResponse = z.infer<typeof backfillEstimateResponseSchema>;

// RelayClient.replayCatchup response
export const replayCatchupResponseSchema = z.object({
  status: z.string(),
  replayed: z.array(z.string()),
  skipped: z.array(z.string()),
  failed: z.array(z.string()),
  remaining: z.number(),
});
export type ReplayCatchupResponse = z.infer<typeof replayCatchupResponseSchema>;
```

**File**: `packages/console-providers/src/contracts.ts`

Add export:
```typescript
export * from "./contracts/responses";
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck` passes for `@repo/console-providers`
- [ ] `pnpm --filter @repo/console-providers build` succeeds
- [ ] All three Hono service workspaces resolve `@hono/trpc-server` without errors

---

## Phase 2: Gateway tRPC Router

### Overview

Create the tRPC router for `apps/gateway` with 10 procedures covering all `apiKeyAuth` JSON routes. Mount alongside existing Hono routes. The gateway keeps its existing routes running in parallel during migration.

### Changes Required

#### 1. Create `apps/gateway/src/trpc.ts`

tRPC initialization with service context and `protectedProcedure`:

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { timingSafeStringEqual } from "@repo/console-providers";
import { env } from "./env.js";

export interface ServiceContext {
  apiKey: string | undefined;
  // orgId and userId are passed in procedure input for authorize,
  // not in context — avoids over-engineering context shape per-route
}

const t = initTRPC.context<ServiceContext>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.apiKey || !timingSafeStringEqual(ctx.apiKey, env.GATEWAY_API_KEY)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});
```

#### 2. Create `apps/gateway/src/router/connections.ts`

Define all 10 procedures as a `TRPCRouterRecord`. Each procedure re-implements the corresponding Hono handler logic:

**Procedures** (input schemas use Zod inline or from `@repo/console-providers/contracts`):

| Procedure | Type | Input | Output type |
|-----------|------|-------|-------------|
| `connections.get` | query | `{ id: string }` | `GatewayConnection` |
| `connections.list` | query | `{ status?: string }` | `GatewayInstallationSummary[]` |
| `connections.getToken` | query | `{ id: string }` | `GatewayTokenResult` |
| `connections.getEndpoints` | query | `{ id: string }` | `ProxyEndpointsResponse` |
| `connections.delete` | mutation | `{ provider: string; id: string }` | `{ status: string; installationId: string }` |
| `connections.getAuthorizeUrl` | query | `{ provider: string; orgId: string; userId?: string; redirectTo?: string }` | `{ url: string; state: string }` |
| `connections.registerResource` | mutation | `{ id: string; providerResourceId: string; resourceName?: string }` | `void` |
| `connections.removeResource` | mutation | `{ id: string; resourceId: string }` | `{ status: string; resourceId: string }` |
| `connections.listBackfillRuns` | query | `{ id: string; status?: string }` | `BackfillRunReadRecord[]` |
| `connections.upsertBackfillRun` | mutation | `{ id: string; record: BackfillRunRecord }` | `void` |

Business logic is copied from `apps/gateway/src/routes/connections.ts` for the corresponding route handler. Use `TRPCError` instead of Hono `HTTPException`:
- 404 → `{ code: "NOT_FOUND" }`
- 409 → `{ code: "CONFLICT" }`
- 400 → `{ code: "BAD_REQUEST" }`
- 401 → `{ code: "UNAUTHORIZED" }` (handled by `protectedProcedure`)

Pattern:
```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc.js";
import {
  backfillRunRecord,
  BackfillRunReadRecord,
  GatewayConnection,
  // ...
} from "@repo/console-providers/contracts";

export const connectionsRouter = {
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // ... same logic as connections.ts:509 handler
      // throws TRPCError({ code: "NOT_FOUND" }) instead of c.json(404)
    }),
  // ...
} satisfies TRPCRouterRecord;
```

#### 3. Create `apps/gateway/src/router/index.ts`

```typescript
import { router } from "../trpc.js";
import { connectionsRouter } from "./connections.js";

export const gatewayRouter = router({
  connections: connectionsRouter,
});

export type GatewayRouter = typeof gatewayRouter;
```

#### 4. Mount in `apps/gateway/src/app.ts`

Add tRPC middleware alongside existing route mounts:

```typescript
import { trpcServer } from "@hono/trpc-server";
import { gatewayRouter } from "./router/index.js";

// After existing middleware registrations, before app.route() calls:
app.use(
  "/services/gateway/trpc/*",
  trpcServer({
    router: gatewayRouter,
    endpoint: "/services/gateway/trpc",
    createContext: (_opts, c) => ({
      apiKey: c.req.header("X-API-Key"),
    }),
  })
);

// Existing route mounts remain unchanged:
// app.route("/services/gateway", connections)
// app.route("/services/gateway/workflows", workflows)
```

**Important**: Mount `trpcServer` BEFORE `app.route("/services/gateway", connections)` to ensure `/services/gateway/trpc/*` is matched first. The `/trpc` path segment won't conflict with existing routes since there is no provider or ID named `trpc`.

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter apps/gateway typecheck` passes
- [ ] `pnpm build:gateway` succeeds
- [ ] Existing Hono routes still reachable (no regression)

#### Manual Verification
- [ ] `curl -H "X-API-Key: $KEY" "lightfast.ai/services/gateway/trpc/connections.get?input=$(echo '{"json":{"id":"<id>"}}' | python3 -m urllib.parse)"` returns valid JSON matching `GatewayConnection` shape
- [ ] Existing `GET /services/gateway/<id>` still returns same response

---

## Phase 3: Relay tRPC Router

### Overview

Create the tRPC router for `apps/relay` with 5 admin procedures. The webhook, QStash, and workflow routes remain as plain Hono routes.

### Changes Required

#### 1. Create `apps/relay/src/trpc.ts`

Same structure as gateway's `trpc.ts` but using `env.GATEWAY_API_KEY` from relay's env:

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { timingSafeStringEqual } from "@repo/console-providers";
import { env } from "./env.js";

export interface ServiceContext {
  apiKey: string | undefined;
}

const t = initTRPC.context<ServiceContext>().create();
export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.apiKey || !timingSafeStringEqual(ctx.apiKey, env.GATEWAY_API_KEY)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});
```

#### 2. Create `apps/relay/src/router/admin.ts`

5 procedures from `apps/relay/src/routes/admin.ts`:

| Procedure | Type | Input | Notes |
|-----------|------|-------|-------|
| `health` | query | none | Use `publicProcedure` (no auth) |
| `dlq.list` | query | `{ limit?: number; offset?: number }` | Clamp limit [1,100] default 50 |
| `dlq.replay` | mutation | `{ deliveryIds: Array<{ provider: string; deliveryId: string }> }` | |
| `replay.catchup` | mutation | `catchupSchema` fields | Full Zod validation already in admin.ts:114-124 |
| `dev.clearBackfillRuns` | mutation | `{ installationId: string }` | Only registered when `env.NODE_ENV !== "production"` |

For `dev.clearBackfillRuns`, conditionally add to the router:

```typescript
export const adminRouter = {
  health: publicProcedure.query(async () => { ... }),
  dlq: {
    list: protectedProcedure.input(...).query(...),
    replay: protectedProcedure.input(...).mutation(...),
  },
  replay: {
    catchup: protectedProcedure.input(catchupSchema).mutation(...),
  },
  ...(env.NODE_ENV !== "production" ? {
    dev: {
      clearBackfillRuns: protectedProcedure
        .input(z.object({ installationId: z.string() }))
        .mutation(async ({ input }) => { ... }),
    },
  } : {}),
} satisfies TRPCRouterRecord;
```

#### 3. Create `apps/relay/src/router/index.ts`

```typescript
import { router } from "../trpc.js";
import { adminRouter } from "./admin.js";

export const relayRouter = router({
  admin: adminRouter,
});

export type RelayRouter = typeof relayRouter;
```

#### 4. Mount in `apps/relay/src/app.ts`

```typescript
import { trpcServer } from "@hono/trpc-server";
import { relayRouter } from "./router/index.js";

// After middleware, before existing app.route() calls:
app.use(
  "/api/trpc/*",
  trpcServer({
    router: relayRouter,
    endpoint: "/api/trpc",
    createContext: (_opts, c) => ({
      apiKey: c.req.header("X-API-Key"),
    }),
  })
);
// app.route("/api/webhooks", webhooks) — unchanged
// app.route("/api/admin", admin) — unchanged
// app.route("/api/workflows", workflows) — unchanged
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter apps/relay typecheck` passes
- [ ] `pnpm build:relay` succeeds

#### Manual Verification
- [ ] `curl "lightfast.ai/services/relay/trpc/admin.health"` returns `{"result":{"data":{"status":"ok",...}}}`
- [ ] Existing `GET /api/admin/health` (via relay direct access) still works

---

## Phase 4: Backfill tRPC Router

### Overview

Create the tRPC router for `apps/backfill` with 3 procedures. The Inngest serve handler remains as plain Hono.

### Changes Required

#### 1. Create `apps/backfill/src/trpc.ts`

Same structure as relay's `trpc.ts`.

#### 2. Create `apps/backfill/src/router/backfill.ts`

3 procedures from `apps/backfill/src/routes/trigger.ts` and `apps/backfill/src/routes/estimate.ts`:

| Procedure | Type | Input | Notes |
|-----------|------|-------|-------|
| `trigger` | mutation | `backfillTriggerPayload` fields | Send `backfill/run.requested` Inngest event |
| `cancel` | mutation | `{ installationId: string }` | Verify connection exists via gateway client, send Inngest event |
| `estimate` | mutation | `backfillEstimatePayload` fields | Complex: parallel API probes, returns `BackfillEstimateResponse` |

For `estimate`, the business logic in `apps/backfill/src/routes/estimate.ts` (~180 lines) is moved verbatim into the tRPC procedure. The procedure's return value is typed as `BackfillEstimateResponse`.

```typescript
export const backfillRouter = {
  trigger: protectedProcedure
    .input(backfillTriggerPayload)
    .mutation(async ({ input }) => {
      // logic from trigger.ts:53-75
    }),
  cancel: protectedProcedure
    .input(z.object({ installationId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      // logic from trigger.ts:109-137
      // createGatewayClient + inngest.send
    }),
  estimate: protectedProcedure
    .input(backfillEstimatePayload)
    .mutation(async ({ input }) => {
      // logic from estimate.ts:44-204
    }),
} satisfies TRPCRouterRecord;
```

#### 3. Create `apps/backfill/src/router/index.ts`

```typescript
import { router } from "../trpc.js";
import { backfillRouter } from "./backfill.js";

export const appRouter = router({
  backfill: backfillRouter,
});

export type BackfillRouter = typeof appRouter;
```

#### 4. Mount in `apps/backfill/src/app.ts`

```typescript
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./router/index.js";

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    endpoint: "/api/trpc",
    createContext: (_opts, c) => ({
      apiKey: c.req.header("X-API-Key"),
    }),
  })
);
// app.route("/api/trigger", trigger) — unchanged during dual-path
// app.route("/api/estimate", estimate) — unchanged during dual-path
// app.route("/api/inngest", inngestRoute) — unchanged always
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter apps/backfill typecheck` passes
- [ ] `pnpm build:backfill` succeeds

#### Manual Verification
- [ ] Trigger a test backfill via the console — it should work as before (still hitting old Hono routes)

---

## Phase 5: Client Package Migration

### Overview

Migrate `@repo/gateway-service-clients` to use tRPC proxy clients internally. Replace the three `as` casts with Zod-validated responses. The factory function signatures and consumer call sites remain unchanged.

### Changes Required

#### 1. Create `packages/gateway-service-clients/src/trpc.ts`

Shared tRPC client creation helper:

```typescript
import { createTRPCClient, httpLink } from "@trpc/client";
import { buildServiceHeaders, ServiceClientConfig } from "./headers.js";

export function createServiceTRPCClient<TRouter>(
  url: string,
  config: ServiceClientConfig,
): ReturnType<typeof createTRPCClient<TRouter>> {
  return createTRPCClient<TRouter>({
    links: [
      httpLink({
        url,
        headers: () => buildServiceHeaders(config),
      }),
    ],
  });
}
```

Note: `TRouter` is typed as `any`-compatible to avoid importing router types from service apps (cycle prevention). Type safety at call sites comes from the explicit return type annotations on each client method, validated via the existing Zod schemas.

#### 2. Update `packages/gateway-service-clients/src/gateway.ts`

Replace each hand-written `fetch` method with a tRPC proxy client call. Zod validation of responses is preserved (existing `.parse()` calls remain, called on the tRPC response).

Add to factory:
```typescript
const trpc = createServiceTRPCClient<any>(`${gatewayUrl}/trpc`, config);
```

Replace each method body. Example for `getConnection`:

```typescript
// Before:
async getConnection(installationId: string): Promise<GatewayConnection> {
  const res = await fetch(`${gatewayUrl}/${installationId}`, { signal: AbortSignal.timeout(10_000), headers: h });
  if (!res.ok) throw new Error(`gateway getConnection failed: ${res.status}`);
  const data = await res.json();
  return gatewayConnectionSchema.parse(data);
}

// After:
async getConnection(installationId: string): Promise<GatewayConnection> {
  const data = await trpc.connections.get.query({ id: installationId });
  return gatewayConnectionSchema.parse(data);
}
```

The Zod parse on the response is kept for the same runtime safety guarantee (the tRPC response travels via JSON, the parse confirms the shape).

Methods to migrate (excluding `executeApi` which stays as plain fetch):
- `getConnection` → `trpc.connections.get.query`
- `listInstallations` → `trpc.connections.list.query`
- `getToken` → `trpc.connections.getToken.query`
- `getBackfillRuns` → `trpc.connections.listBackfillRuns.query`
- `upsertBackfillRun` → `trpc.connections.upsertBackfillRun.mutate`
- `getApiEndpoints` → `trpc.connections.getEndpoints.query`
- `registerResource` → `trpc.connections.registerResource.mutate`
- `getAuthorizeUrl` → `trpc.connections.getAuthorizeUrl.query`
- `deleteConnection` → `trpc.connections.delete.mutate`

**Keep as plain fetch (unchanged)**:
- `executeApi` — complex narrow typing, already has Zod validation

**Note on timeout behavior**: `@trpc/client`'s `httpLink` doesn't accept `AbortSignal.timeout` directly. Pass via fetch options:
```typescript
httpLink({
  url,
  headers: () => buildServiceHeaders(config),
  fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
})
```
Since timeout varies per method, the simplest approach is a single `createServiceTRPCClient` per factory instance using the most permissive timeout (60s), relying on the server's own timeout for faster methods. Alternatively, create separate client instances per timeout tier. Document this choice in code comments.

#### 3. Update `packages/gateway-service-clients/src/backfill.ts`

Replace `as` casts with Zod validation using schemas from Phase 1:

```typescript
import { createServiceTRPCClient } from "./trpc.js";
import {
  backfillTriggerResponseSchema,
  backfillEstimateResponseSchema,
} from "@repo/console-providers/contracts";

// In createBackfillClient:
const trpc = createServiceTRPCClient<any>(`${backfillUrl}/trpc`, config);

// estimate (was: response.json() as Promise<Record<string, unknown>>)
async estimate(payload: BackfillEstimatePayload) {
  const data = await trpc.backfill.estimate.mutate(payload);
  return backfillEstimateResponseSchema.parse(data);
}

// trigger (was: response.json() as Promise<{ status: string; installationId: string }>)
async trigger(payload: BackfillTriggerPayload) {
  const data = await trpc.backfill.trigger.mutate(payload);
  return backfillTriggerResponseSchema.parse(data);
}
```

#### 4. Update `packages/gateway-service-clients/src/relay.ts`

Replace `replayCatchup` `as` cast with Zod validation:

```typescript
import { createServiceTRPCClient } from "./trpc.js";
import { replayCatchupResponseSchema } from "@repo/console-providers/contracts";

// In createRelayClient:
const trpc = createServiceTRPCClient<any>(`${relayUrl}/trpc`, config);

// replayCatchup (was: response.json() as Promise<{ remaining: number }>)
async replayCatchup(installationId: string, batchSize: number) {
  const data = await trpc.admin.replay.catchup.mutate({ installationId, batchSize });
  return replayCatchupResponseSchema.parse(data);
}
```

**Keep as plain fetch (unchanged)**:
- `dispatchWebhook` — calls the webhook ingest route which is NOT a tRPC procedure (HMAC path)

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter @repo/gateway-service-clients typecheck` passes
- [ ] `pnpm --filter @repo/gateway-service-clients build` succeeds
- [ ] `pnpm --filter @api/console typecheck` passes (primary consumer)
- [ ] `pnpm build:console` succeeds

#### Manual Verification
- [ ] Create a new OAuth connection through the console — completes successfully
- [ ] Trigger a backfill from the console — status shows `accepted`
- [ ] Check that `replayCatchup` works from the backfill orchestrator (requires a stale delivery in dev)
- [ ] `executeApi` proxy still works (plain Hono, unchanged)

---

## Phase 6: Cleanup — Remove Deprecated Hono Routes

### Overview

Remove the plain Hono route handlers that have been superseded by tRPC procedures. Only run this phase after Phase 5 has been deployed and verified for at least one release cycle.

### Changes Required

#### 1. `apps/gateway/src/routes/connections.ts`

Remove the following Hono handlers (lines are approximate — verify against current code):
- `GET /services/gateway/:id` (connections.ts:509)
- `GET /services/gateway/` (connections.ts:1181) — the list endpoint
- `GET /services/gateway/:id/token` (connections.ts:561)
- `GET /services/gateway/:id/proxy/endpoints` (connections.ts:626)
- `DELETE /services/gateway/:provider/:id` (connections.ts:880)
- `GET /services/gateway/:provider/authorize` (connections.ts:79)
- `POST /services/gateway/:id/resources` (connections.ts:933)
- `DELETE /services/gateway/:id/resources/:resourceId` (connections.ts:1037)
- `GET /services/gateway/:id/backfill-runs` (connections.ts:1087)
- `POST /services/gateway/:id/backfill-runs` (connections.ts:1114)

**Keep unchanged**:
- `GET /services/gateway/oauth/status` (connections.ts:180)
- `GET /services/gateway/:provider/callback` (connections.ts:208)
- `POST /services/gateway/:id/proxy/execute` (connections.ts:671)

#### 2. `apps/relay/src/routes/admin.ts`

Remove handlers for:
- `GET /health` (admin.ts:23)
- `GET /dlq` (admin.ts:50)
- `POST /dlq/replay` (admin.ts:75)
- `POST /replay/catchup` (admin.ts:135)
- `DELETE /dev/backfill-runs/:installationId` (admin.ts:299-312)

**Keep unchanged**:
- `POST /recovery/cron` (admin.ts:224) — QStash-authenticated cron
- `POST /delivery-status` (admin.ts:256) — QStash callback

If admin.ts becomes empty after removals, remove the file and update `app.ts` to not mount it.

#### 3. `apps/backfill/src/routes/trigger.ts` and `estimate.ts`

Remove all handlers:
- `POST /trigger` (trigger.ts:30)
- `POST /trigger/cancel` (trigger.ts:86)
- `POST /estimate` (estimate.ts:23)

Remove the route files and their mounts in `app.ts`.

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck` (all packages)
- [ ] `pnpm check` (no lint errors)
- [ ] `pnpm build:console && pnpm build:gateway && pnpm build:relay && pnpm build:backfill`

#### Manual Verification
- [ ] Full connection flow: create OAuth connection → trigger backfill → verify events appear
- [ ] DLQ management still works from admin tools
- [ ] No 404s from previously-working routes in production logs

---

## Testing Strategy

### Unit Tests (tRPC `createCallerFactory`)

For each service, use `createCallerFactory` from `src/trpc.ts` to test procedures without HTTP:

```typescript
import { createCallerFactory } from "../trpc.js";
import { gatewayRouter } from "./index.js";

const createCaller = createCallerFactory(gatewayRouter);
const caller = createCaller({ apiKey: "test-key" });

it("returns 404 for unknown installation", async () => {
  await expect(caller.connections.get({ id: "nonexistent" }))
    .rejects.toMatchObject({ code: "NOT_FOUND" });
});
```

### Integration Tests

The existing `packages/integration-tests/` stub for `@repo/gateway-service-clients` should continue to work — the factory interface is unchanged, and stubs override the entire module.

For new tRPC smoke tests, the `app.request()` pattern used in existing Hono tests can be extended:

```typescript
// Test via HTTP (validates the tRPC mount)
const res = await app.request("/services/gateway/trpc/connections.get?input=" + encode({ json: { id: "abc" } }), {
  headers: { "X-API-Key": env.GATEWAY_API_KEY },
});
```

### Manual Testing Steps

1. Start `pnpm dev:app` (full stack)
2. Create a GitHub connection through the console OAuth flow
3. Trigger a backfill for the connection
4. Verify `replayCatchup` by using the debug inject-event route
5. Test the DLQ list via any admin tooling

---

## Performance Considerations

- tRPC adds a thin envelope wrapper (`{"result":{"data":...}}`). No meaningful overhead for inter-service calls.
- `httpLink` (no batching) is appropriate for service-to-service — each call is independent and has its own timeout.
- The tRPC Fetch Adapter is compatible with Vercel edge V8 isolates (no Node.js dependencies).
- Existing per-method `AbortSignal.timeout()` behavior is preserved via the custom `fetch` option in `httpLink`.

---

## Migration Notes

- **Dual-path period**: During Phases 2-4, both Hono and tRPC routes exist. The client package (Phase 5) switches all calls to tRPC atomically. Until Phase 5 is deployed, all traffic flows through the old Hono routes.
- **Rollback**: If Phase 5 causes issues, revert `@repo/gateway-service-clients` to the previous fetch-based implementation. The tRPC routes in the services are harmless additive changes.
- **Deploy order**: Deploy service changes (Phases 2-4) before client changes (Phase 5). The services must be running the tRPC endpoints before the clients start calling them.

---

## References

- Research document: `thoughts/shared/research/2026-03-18-hono-trpc-migration.md`
- Gateway routes: `apps/gateway/src/routes/connections.ts`
- Relay admin routes: `apps/relay/src/routes/admin.ts`
- Backfill routes: `apps/backfill/src/routes/trigger.ts`, `apps/backfill/src/routes/estimate.ts`
- Client package: `packages/gateway-service-clients/src/`
- Contract schemas: `packages/console-providers/src/contracts/`
- Existing tRPC patterns: `api/console/src/trpc.ts`, `api/console/src/router/user/account.ts`
- `@hono/trpc-server`: `honojs/middleware` monorepo, version `0.4.2`

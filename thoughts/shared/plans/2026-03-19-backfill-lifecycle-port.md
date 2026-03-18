---
date: 2026-03-19
author: claude
branch: refactor/define-ts-provider-redesign
topic: "Backfill + Connection Lifecycle Port to Memory"
tags: [plan, memory, backfill, lifecycle, inngest, port, migration]
status: draft
---

# Backfill + Connection Lifecycle Port to Memory

## Executive Summary

Port backfill orchestration (from `apps/backfill`) and connection lifecycle management (from `apps/gateway`) into the memory service (`api/memory`). This consolidates six Inngest functions and three Hono routes into a single Inngest app with tRPC procedures, eliminating inter-service HTTP calls between backfill, gateway, and relay.

Key architectural change: the entity worker currently calls `gw.executeApi()` (HTTP to gateway) and `relay.dispatchWebhook()` (HTTP to relay). In memory, these become direct function calls to the token vault + provider API (same process) and `inngest.send("memory/webhook.received")` (same Inngest app).

---

## Current State Analysis

### Backfill Service (`apps/backfill`)

**Inngest functions** (registered in `apps/backfill/src/routes/inngest.ts`):

| Function | ID | Trigger | File |
|----------|----|---------|------|
| `backfillOrchestrator` | `backfill/run.orchestrator` | `backfill/run.requested` | `apps/backfill/src/workflows/backfill-orchestrator.ts` |
| `backfillEntityWorker` | `backfill/entity.worker` | `backfill/entity.requested` | `apps/backfill/src/workflows/entity-worker.ts` |

**Hono routes** (in `apps/backfill/src/routes/`):

| Route | Purpose | File |
|-------|---------|------|
| `POST /trigger` | Validates payload, sends `backfill/run.requested` Inngest event | `trigger.ts` |
| `POST /trigger/cancel` | Validates installationId, sends `backfill/run.cancelled` Inngest event | `trigger.ts` |
| `POST /estimate` | Probes page 1 for each resource x entityType, returns scope estimate | `estimate.ts` |

**Inter-service dependencies**:
- `createGatewayClient()` for: `getConnection()`, `getBackfillRuns()`, `upsertBackfillRun()`, `executeApi()`
- `createRelayClient()` for: `dispatchWebhook()`, `replayCatchup()`
- Both use `GATEWAY_API_KEY` for authentication

**Key configuration** (`apps/backfill/src/lib/constants.ts`):
- `GITHUB_RATE_LIMIT_BUDGET = 4000` (throttle limit per installationId per hour)
- `MAX_PAGES = 500` (pagination safety cap)

### Gateway Service (`apps/gateway`)

**Inngest functions** (registered in `apps/gateway/src/routes/inngest.ts`):

| Function | ID | Trigger | File |
|----------|----|---------|------|
| `healthCheck` | `apps-gateway/health.check` | `cron: */5 * * * *` | `apps/gateway/src/functions/health-check.ts` |
| `tokenRefresh` | `apps-gateway/token.refresh` | `cron: */5 * * * *` | `apps/gateway/src/functions/token-refresh.ts` |

**Upstash Workflow** (in `apps/gateway/src/workflows/`):

| Workflow | Purpose | File |
|----------|---------|------|
| `connectionTeardownWorkflow` | 5-step durable teardown (close-gate, cancel-backfill, revoke-token, cleanup-cache, remove-resources) | `connection-teardown.ts` |

**Key helpers** (in `apps/gateway/src/lib/`):
- `token-helpers.ts`: `getActiveTokenForInstallation()`, `forceRefreshToken()` -- handle token vault operations
- `token-store.ts`: `writeTokenRecord()`, `updateTokenRecord()` -- encrypt/persist tokens
- `encryption.ts`: `getEncryptionKey()` -- reads `ENCRYPTION_KEY` from env
- `cache.ts`: Redis key conventions (`gw:resource:`, `gw:connection:`, etc.)

**Health check fires** `platform/connection.lifecycle` event on auth failure or sustained transient failures.

### Relay Service (`apps/relay`)

**Delivery recovery cron** (`apps/relay/src/routes/admin.ts`):
- `POST /admin/recovery/cron` -- QStash-scheduled, sweeps stuck `status='received'` deliveries older than 5 minutes, calls `replayDeliveries()` to re-trigger webhook delivery workflow

### Event Schema (`packages/inngest/src/schemas/`)

Current event names in `backfill.ts`:
- `backfill/run.requested`, `backfill/run.cancelled`, `backfill/entity.requested`, `backfill/connection.health.check.requested`

Current event names in `platform.ts`:
- `platform/webhook.received`, `platform/connection.lifecycle`

### What Does NOT Exist Yet

- `api/memory/` directory (no shell exists)
- `@api/memory` package
- Memory Inngest client
- Memory tRPC router

---

## Desired End State

After this port:

1. `api/memory/src/inngest/functions/` contains 6 Inngest functions:
   - `memory-backfill-orchestrator.ts` (id: `memory/backfill.orchestrator`)
   - `memory-entity-worker.ts` (id: `memory/backfill.entity-worker`)
   - `connection-lifecycle.ts` (id: `memory/connection.lifecycle`)
   - `health-check.ts` (id: `memory/health.check`)
   - `token-refresh.ts` (id: `memory/token.refresh`)
   - `delivery-recovery.ts` (id: `memory/delivery.recovery`)

2. `api/memory/src/router/memory/backfill.ts` contains 3 tRPC procedures:
   - `backfill.trigger` -- replaces `POST /trigger`
   - `backfill.cancel` -- replaces `POST /trigger/cancel`
   - `backfill.estimate` -- replaces `POST /estimate`

3. Entity worker calls token vault + provider API directly (no HTTP to gateway)
4. Entity worker dispatches webhooks via `inngest.send("memory/webhook.received")` (no HTTP to relay)
5. Connection teardown uses Inngest `step.run()` instead of Upstash Workflow `context.run()`
6. Delivery recovery is an Inngest cron (no QStash schedule)
7. All event names use `memory/` prefix

### Event Name Migration

| Old Name | New Name |
|----------|----------|
| `backfill/run.requested` | `memory/backfill.run.requested` |
| `backfill/run.cancelled` | `memory/backfill.run.cancelled` |
| `backfill/entity.requested` | `memory/backfill.entity.requested` |
| `backfill/connection.health.check.requested` | `memory/health.check.requested` |
| `platform/webhook.received` | `memory/webhook.received` |
| `platform/connection.lifecycle` | `memory/connection.lifecycle` |

### Verification

```bash
pnpm typecheck            # No type errors
pnpm check                # No lint errors
pnpm build:console        # Console builds (depends on @repo/inngest)
```

Manual: Trigger a backfill via tRPC, verify entity workers run, verify webhooks are dispatched via Inngest events (not HTTP), verify backfill run records are persisted.

---

## What We Are NOT Doing

- **No changes to `apps/gateway` OAuth routes** -- OAuth callback, authorize, status poll remain in gateway. Only lifecycle/token-vault/health-check logic moves.
- **No changes to `apps/relay` webhook ingestion** -- External webhook receipt (`POST /webhooks/:provider`) stays in relay. Only the delivery recovery cron moves.
- **No deletion of old services yet** -- This plan ports the code; a subsequent cleanup plan removes the old functions from gateway/backfill/relay after verification.
- **No changes to the relay webhook-delivery Upstash Workflow** -- The standard webhook path (external provider -> relay -> Upstash Workflow -> QStash -> Console ingress) is unchanged.
- **No migration of `@repo/gateway-service-clients`** -- The HTTP clients remain for any consumer not yet migrated. Memory uses direct DB/function calls instead.
- **No changes to Console ingress** -- Console's `api/gateway/ingress` route is unchanged; memory dispatches webhooks via Inngest events that Console's event-store function consumes.

---

## Implementation Approach

Eight phases. Each phase is independently testable. Phases 1-2 establish the foundation; Phases 3-5 port the Inngest functions; Phase 6 ports the tRPC procedures; Phase 7 wires the event schemas; Phase 8 adds tests.

Dependencies: This plan assumes the `api/memory` shell (package.json, tsconfig, env.ts) and Inngest client already exist from a foundation phase. If they do not, Phase 1 creates them.

---

## Phase 1: Memory Inngest Foundation

### Overview

Create the `api/memory` package shell with an Inngest client and a `serve()` route that registers all memory functions. This is the anchor for all subsequent phases.

### Changes Required

#### 1. Package shell — `api/memory/package.json`

Create `api/memory/` with a package.json following the `api/console` pattern:

```json
{
  "name": "@api/memory",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./inngest": "./src/inngest/index.ts"
  },
  "dependencies": {
    "@db/console": "workspace:*",
    "@repo/console-providers": "workspace:*",
    "@repo/inngest": "workspace:*",
    "@repo/lib": "workspace:*",
    "@vendor/db": "workspace:*",
    "@vendor/inngest": "workspace:*",
    "@vendor/observability": "workspace:*",
    "@vendor/upstash": "workspace:*",
    "inngest": "catalog:",
    "zod": "catalog:"
  }
}
```

#### 2. Inngest client — `api/memory/src/inngest/client.ts`

```typescript
import { createInngestClient } from "@repo/inngest/client";
import { env } from "@vendor/inngest/env";

export const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
});
```

#### 3. Inngest index — `api/memory/src/inngest/index.ts`

Barrel export for the client and all functions. Initially empty function list; each subsequent phase adds functions here.

```typescript
import { inngest } from "./client.js";

// Functions added by subsequent phases:
// import { memoryBackfillOrchestrator } from "./functions/memory-backfill-orchestrator.js";
// import { memoryEntityWorker } from "./functions/memory-entity-worker.js";
// import { connectionLifecycle } from "./functions/connection-lifecycle.js";
// import { healthCheck } from "./functions/health-check.js";
// import { tokenRefresh } from "./functions/token-refresh.js";
// import { deliveryRecovery } from "./functions/delivery-recovery.js";

export { inngest };

export const memoryFunctions = [
  // Populated as phases land
];
```

#### 4. Env validation — `api/memory/src/env.ts`

Memory needs the superset of backfill + gateway env vars (ENCRYPTION_KEY, provider envs, DB, Redis, Inngest):

```typescript
import { PROVIDER_ENVS } from "@repo/console-providers";
import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { dbEnv } from "@vendor/db/env";
import { env as inngestEnv } from "@vendor/inngest/env";
import { betterstackEdgeEnv } from "@vendor/observability/log/edge";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

const server = {
  ENCRYPTION_KEY: z.string().min(32),
  SENTRY_DSN: z.url().optional(),
};

export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
  extends: [
    vercel(),
    betterstackEdgeEnv,
    upstashEnv,
    dbEnv,
    inngestEnv,
    ...PROVIDER_ENVS(),
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
```

### Success Criteria

- [ ] `pnpm install` resolves all workspace deps
- [ ] `pnpm typecheck` passes for `@api/memory`
- [ ] Inngest client can be imported from `@api/memory/inngest`

---

## Phase 2: Token Vault Helpers (Direct Access)

### Overview

Port `getActiveTokenForInstallation()`, `forceRefreshToken()`, `updateTokenRecord()`, `writeTokenRecord()`, and `getEncryptionKey()` from `apps/gateway/src/lib/` into `api/memory/src/lib/`. These are the direct-access replacements for `gw.getToken()` and `gw.executeApi()` authentication.

### Changes Required

#### 1. Encryption helper — `api/memory/src/lib/encryption.ts`

Direct copy of `apps/gateway/src/lib/encryption.ts`, importing from memory's own `env.ts`:

```typescript
import { env } from "../env.js";

export function getEncryptionKey(): string {
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is required but not set.");
  }
  return key;
}
```

#### 2. Token store — `api/memory/src/lib/token-store.ts`

Direct copy of `apps/gateway/src/lib/token-store.ts` with import paths adjusted to memory's encryption helper. No logic changes.

#### 3. Token helpers — `api/memory/src/lib/token-helpers.ts`

Direct copy of `apps/gateway/src/lib/token-helpers.ts` with import paths adjusted. No logic changes. These functions:
- `getActiveTokenForInstallation()` -- reads token from DB, handles expiry/refresh, returns decrypted token
- `forceRefreshToken()` -- force-refreshes on 401, returns new token or null

#### 4. Provider config factory — `api/memory/src/lib/provider-configs.ts`

Port the module-level provider config initialization from `apps/gateway/src/routes/connections.ts` (lines 43-64):

```typescript
import type { RuntimeConfig } from "@repo/console-providers";
import { PROVIDERS } from "@repo/console-providers";
import { env } from "../env.js";

// Memory does not serve OAuth callbacks, but providers need a callbackBaseUrl
// for config construction. Use an empty string — OAuth routes remain in gateway.
const runtime: RuntimeConfig = { callbackBaseUrl: "" };

export const providerConfigs: Record<string, unknown> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .map(([name, p]) => [
      name,
      p.createConfig(env as unknown as Record<string, string>, runtime),
    ] as const)
    .filter(([, config]) => config !== null)
);
```

#### 5. Cache keys — `api/memory/src/lib/cache.ts`

Copy the Redis key convention functions from `apps/gateway/src/lib/cache.ts`. Same `gw:` namespace prefix to share the cache with gateway during the transition period.

### Success Criteria

- [ ] `getActiveTokenForInstallation()` can be imported from `api/memory/src/lib/token-helpers.ts`
- [ ] `providerConfigs` resolves all configured providers
- [ ] `pnpm typecheck` passes

---

## Phase 3: Backfill Orchestrator Port

### Overview

Port `backfillOrchestrator` from `apps/backfill/src/workflows/backfill-orchestrator.ts` to `api/memory/src/inngest/functions/memory-backfill-orchestrator.ts`.

### Key Changes From Original

1. **Function ID**: `backfill/run.orchestrator` -> `memory/backfill.orchestrator`
2. **Event names**: `backfill/run.requested` -> `memory/backfill.run.requested`, `backfill/run.cancelled` -> `memory/backfill.run.cancelled`
3. **Gateway client replaced with direct DB queries**:
   - `gw.getConnection(installationId)` -> direct query on `gatewayInstallations` + `gatewayResources` tables
   - `gw.getBackfillRuns(installationId, "completed")` -> direct query on `gatewayBackfillRuns` table
   - `gw.upsertBackfillRun(...)` -> direct insert/upsert on `gatewayBackfillRuns` table
4. **Relay client replaced with Inngest send**:
   - `relay.replayCatchup(installationId, BATCH_SIZE)` -> direct DB query + `inngest.send("memory/webhook.received", ...)` per batch item (or direct replay logic ported inline)
5. **`step.invoke()`** references `memoryEntityWorker` (the ported entity worker function)

### Changes Required

#### 1. `api/memory/src/inngest/functions/memory-backfill-orchestrator.ts`

```typescript
import { db } from "@db/console/client";
import {
  gatewayBackfillRuns,
  gatewayInstallations,
  gatewayResources,
} from "@db/console/schema";
import { getProvider } from "@repo/console-providers";
import { BACKFILL_TERMINAL_STATUSES } from "@repo/console-providers/contracts";
import { NonRetriableError } from "@repo/inngest";
import { and, eq } from "@vendor/db";
import { log } from "@vendor/observability/log/edge";
import { inngest } from "../client.js";
import { memoryEntityWorker } from "./memory-entity-worker.js";

export const memoryBackfillOrchestrator = inngest.createFunction(
  {
    id: "memory/backfill.orchestrator",
    name: "Memory Backfill Orchestrator",
    retries: 3,
    concurrency: [
      { limit: 1, key: "event.data.installationId" },
      { limit: 10 },
    ],
    cancelOn: [
      {
        event: "memory/backfill.run.cancelled",
        match: "data.installationId",
      },
    ],
    timeouts: { start: "2m", finish: "8h" },
  },
  { event: "memory/backfill.run.requested" },
  async ({ event, step }) => {
    // ... Same orchestration logic but with direct DB calls
    // instead of createGatewayClient() / createRelayClient()
  }
);
```

**Step-by-step mapping of gateway client calls to direct DB queries:**

| Original (HTTP) | Memory (Direct) |
|------------------|-----------------|
| `gw.getConnection(installationId)` | `db.query.gatewayInstallations.findFirst({ where: eq(gatewayInstallations.id, installationId), with: { resources: { where: eq(gatewayResources.status, "active") } } })` |
| `gw.getBackfillRuns(installationId, "completed")` | `db.select().from(gatewayBackfillRuns).where(and(eq(gatewayBackfillRuns.installationId, installationId), eq(gatewayBackfillRuns.status, "completed")))` |
| `gw.upsertBackfillRun(installationId, record)` | `db.insert(gatewayBackfillRuns).values({...}).onConflictDoUpdate({...})` (same logic as `connections.ts` POST handler) |

**Replay held webhooks mapping:**

The orchestrator's `replay-held-webhooks` step currently calls `relay.replayCatchup()` in a loop. In memory, this becomes a direct DB query for `status='received'` deliveries + inline replay logic (same as `replayDeliveries()` from `apps/relay/src/lib/replay.ts` but dispatching via Inngest events instead of Upstash Workflow triggers).

### Success Criteria

- [ ] Function compiles with no gateway-service-clients imports
- [ ] `step.invoke()` references `memoryEntityWorker`
- [ ] `cancelOn` uses `memory/backfill.run.cancelled`
- [ ] `pnpm typecheck` passes

---

## Phase 4: Entity Worker Port

### Overview

Port `backfillEntityWorker` from `apps/backfill/src/workflows/entity-worker.ts` to `api/memory/src/inngest/functions/memory-entity-worker.ts`.

### Key Changes From Original

1. **Function ID**: `backfill/entity.worker` -> `memory/backfill.entity-worker`
2. **Event names**: `backfill/entity.requested` -> `memory/backfill.entity.requested`, `backfill/run.cancelled` -> `memory/backfill.run.cancelled`, `backfill/connection.health.check.requested` -> `memory/health.check.requested`
3. **`gw.executeApi()` replaced with direct provider API call**:
   - Get token via `getActiveTokenForInstallation()` (same-process, no HTTP)
   - Build URL and headers using provider's `api.baseUrl`, `api.endpoints[endpointId]`, `api.buildAuthHeader()`
   - Call `fetch()` directly against the provider API
   - Handle 401 retry via `forceRefreshToken()` (same-process)
4. **`relay.dispatchWebhook()` replaced with Inngest event**:
   - `inngest.send({ name: "memory/webhook.received", data: { ... } })` per webhook event
   - Or batch via `step.sendEvent()` for better performance

### Changes Required

#### 1. `api/memory/src/inngest/functions/memory-entity-worker.ts`

The core pagination loop remains identical. Only the I/O boundaries change:

**Fetch step** (`fetch-${entityType}-p${pageNum}`):

Before (HTTP via gateway proxy):
```typescript
const raw = await gw.executeApi(installationId, {
  endpointId: entityHandler.endpointId,
  ...request,
});
```

After (direct API call):
```typescript
import { getActiveTokenForInstallation, forceRefreshToken } from "../../lib/token-helpers.js";
import { providerConfigs } from "../../lib/provider-configs.js";

// Get token
const config = providerConfigs[provider];
const providerDef = getProvider(provider);
const installation = await db.query.gatewayInstallations.findFirst({
  where: eq(gatewayInstallations.id, installationId),
});
const { token } = await getActiveTokenForInstallation(
  installation, config, providerDef
);

// Build request
const api = providerDef.api;
const endpoint = api.endpoints[entityHandler.endpointId];
let path = endpoint.path;
if (request.pathParams) {
  for (const [key, val] of Object.entries(request.pathParams)) {
    path = path.replace(`{${key}}`, encodeURIComponent(val));
  }
}
let url = `${api.baseUrl}${path}`;
if (request.queryParams && Object.keys(request.queryParams).length > 0) {
  url += `?${new URLSearchParams(request.queryParams).toString()}`;
}
const authHeader = api.buildAuthHeader
  ? api.buildAuthHeader(token)
  : `Bearer ${token}`;

// Execute with 401 retry (same pattern as gateway proxy/execute)
let response = await fetch(url, {
  method: endpoint.method,
  headers: { Authorization: authHeader, ...(api.defaultHeaders ?? {}) },
  signal: AbortSignal.timeout(endpoint.timeout ?? 30_000),
});

if (response.status === 401) {
  const freshToken = await forceRefreshToken(installation, config, providerDef);
  if (freshToken) {
    const newAuth = api.buildAuthHeader ? api.buildAuthHeader(freshToken) : `Bearer ${freshToken}`;
    response = await fetch(url, {
      method: endpoint.method,
      headers: { Authorization: newAuth, ...(api.defaultHeaders ?? {}) },
      signal: AbortSignal.timeout(endpoint.timeout ?? 30_000),
    });
  }
}

const data = await response.json();
const headers: Record<string, string> = {};
response.headers.forEach((v, k) => { headers[k] = v; });

return { status: response.status, data, headers };
```

**Dispatch step** (`dispatch-${entityType}-p${pageNum}`):

Before (HTTP via relay):
```typescript
await relay.dispatchWebhook(provider, {
  connectionId: installationId,
  orgId,
  deliveryId: webhookEvent.deliveryId,
  eventType: webhookEvent.eventType,
  payload: webhookEvent.payload,
  receivedAt: Date.now(),
}, holdForReplay);
```

After (Inngest event):
```typescript
// Batch send via step.sendEvent for atomicity
await step.sendEvent(`dispatch-${entityType}-p${pageNum}`,
  fetchResult.events.map((webhookEvent) => ({
    name: "memory/webhook.received" as const,
    data: {
      provider,
      deliveryId: webhookEvent.deliveryId,
      eventType: webhookEvent.eventType,
      resourceId: null,
      payload: webhookEvent.payload,
      receivedAt: Date.now(),
      serviceAuth: true,
      preResolved: {
        connectionId: installationId,
        orgId,
      },
    },
  }))
);
return fetchResult.events.length;
```

Note: `holdForReplay` semantics change. When `holdForReplay` is true, the entity worker should persist webhooks to `gatewayWebhookDeliveries` with `status: "received"` but NOT send Inngest events. The orchestrator's `replay-held-webhooks` step then drains them after all workers complete. This preserves the chronological-order guarantee for the `holdForReplay` use case.

**401 health check signal**:

Before:
```typescript
await step.sendEvent("signal-connection-health-check", {
  name: "backfill/connection.health.check.requested",
  data: { installationId, provider, reason: "401_unauthorized", correlationId },
});
```

After:
```typescript
await step.sendEvent("signal-connection-health-check", {
  name: "memory/health.check.requested",
  data: { installationId, provider, reason: "401_unauthorized", correlationId },
});
```

#### 2. Constants — `api/memory/src/lib/constants.ts`

Copy from `apps/backfill/src/lib/constants.ts`:

```typescript
export const GITHUB_RATE_LIMIT_BUDGET = 4000;
export const MAX_PAGES = 500;
```

### Success Criteria

- [ ] Entity worker compiles with no `@repo/gateway-service-clients` imports
- [ ] `cancelOn` uses `memory/backfill.run.cancelled`
- [ ] Provider API calls go directly to provider (no gateway HTTP hop)
- [ ] Webhook dispatch uses `step.sendEvent()` with `memory/webhook.received`
- [ ] 401 handler fires `memory/health.check.requested`
- [ ] `pnpm typecheck` passes

---

## Phase 5: Connection Lifecycle + Cron Functions Port

### Overview

Port the connection teardown workflow (Upstash Workflow -> Inngest), health check cron, token refresh cron, and delivery recovery cron into memory.

### Changes Required

#### 1. Connection lifecycle — `api/memory/src/inngest/functions/connection-lifecycle.ts`

Convert from Upstash Workflow `context.run()` to Inngest `step.run()`:

```typescript
export const connectionLifecycle = inngest.createFunction(
  {
    id: "memory/connection.lifecycle",
    name: "Connection Lifecycle (Teardown)",
    retries: 3,
    concurrency: [{ limit: 1, key: "event.data.installationId" }],
  },
  { event: "memory/connection.lifecycle" },
  async ({ event, step }) => {
    const { installationId, provider: providerName } = event.data;

    // Step 1: Close the ingress gate
    await step.run("close-gate", async () => {
      await db
        .update(gatewayInstallations)
        .set({ status: "revoked", updatedAt: new Date().toISOString() })
        .where(eq(gatewayInstallations.id, installationId));

      await db.insert(gatewayLifecycleLogs).values({
        installationId,
        event: "gate_closed",
        fromStatus: "active",
        toStatus: "revoked",
        reason: "Ingress gate closed by teardown workflow",
        metadata: {
          step: "close-gate",
          workflowContext: "connection-lifecycle",
          triggeredBy: "system",
        },
      });
    });

    // Step 2: Cancel any running backfill
    await step.run("cancel-backfill", async () => {
      try {
        await inngest.send({
          name: "memory/backfill.run.cancelled",
          data: { installationId },
        });
      } catch {
        // Best-effort
      }
    });

    // Step 3: Revoke token at provider (best-effort)
    await step.run("revoke-token", async () => {
      // Same logic as connection-teardown.ts step 3
      // but using memory's local providerConfigs and getEncryptionKey()
    });

    // Step 4: Clean up Redis cache
    await step.run("cleanup-cache", async () => {
      // Same logic as connection-teardown.ts step 4
    });

    // Step 5: Remove linked resources
    await step.run("remove-resources", async () => {
      // Same logic as connection-teardown.ts step 5
    });
  }
);
```

**Key differences from Upstash Workflow version:**

| Upstash Workflow | Inngest |
|------------------|---------|
| `context.run("step-name", async () => {...})` | `step.run("step-name", async () => {...})` |
| No built-in `cancelOn` | Can add `cancelOn` if needed |
| `failureFunction` callback | `onFailure` handler |
| QStash cancel-backfill HTTP call | Direct `inngest.send("memory/backfill.run.cancelled")` |
| `serve()` on a Hono route | Registered in `memoryFunctions` array |

The cancel-backfill step changes from a QStash HTTP call to a direct Inngest event send -- same Inngest app, no network hop.

#### 2. Health check — `api/memory/src/inngest/functions/health-check.ts`

Near-direct copy of `apps/gateway/src/functions/health-check.ts` with:

- Function ID: `apps-gateway/health.check` -> `memory/health.check`
- Event fire: `platform/connection.lifecycle` -> `memory/connection.lifecycle`
- Import `providerConfigs` from `../../lib/provider-configs.js` instead of module-level gateway env
- Import `getActiveTokenForInstallation` from `../../lib/token-helpers.js`

#### 3. Token refresh — `api/memory/src/inngest/functions/token-refresh.ts`

Near-direct copy of `apps/gateway/src/functions/token-refresh.ts` with:

- Function ID: `apps-gateway/token.refresh` -> `memory/token.refresh`
- Import `providerConfigs` from `../../lib/provider-configs.js`
- Import `getEncryptionKey` from `../../lib/encryption.js`
- Import `updateTokenRecord` from `../../lib/token-store.js`

#### 4. Delivery recovery — `api/memory/src/inngest/functions/delivery-recovery.ts`

Convert from QStash-scheduled Route Handler to Inngest cron:

```typescript
export const deliveryRecovery = inngest.createFunction(
  {
    id: "memory/delivery.recovery",
    name: "Delivery Recovery (5m cron)",
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const BATCH_SIZE = 100;
    const STALE_THRESHOLD_MS = 5 * 60 * 1000;

    const deliveries = await step.run("find-stuck-deliveries", async () => {
      const staleBeforeIso = new Date(
        Date.now() - STALE_THRESHOLD_MS
      ).toISOString();

      return db
        .select()
        .from(gatewayWebhookDeliveries)
        .where(
          and(
            eq(gatewayWebhookDeliveries.status, "received"),
            lt(gatewayWebhookDeliveries.receivedAt, staleBeforeIso)
          )
        )
        .orderBy(gatewayWebhookDeliveries.receivedAt)
        .limit(BATCH_SIZE);
    });

    if (deliveries.length === 0) {
      return { replayed: 0, skipped: 0, failed: 0 };
    }

    // Replay logic — same as replayDeliveries() but using Inngest events
    // instead of Upstash workflowClient.trigger()
    const result = await step.run("replay-deliveries", async () => {
      // For each delivery: parse payload, extract resourceId,
      // send memory/webhook.received event
      // ...
    });

    return result;
  }
);
```

**Key difference**: The relay's `replayDeliveries()` triggers the Upstash Workflow `webhookDeliveryWorkflow` via `workflowClient.trigger()`. In memory, delivery recovery sends `memory/webhook.received` Inngest events instead. The downstream webhook processing pipeline in memory handles them from there.

### Success Criteria

- [ ] All 4 functions compile with no `@vendor/upstash-workflow` or `@vendor/qstash` imports
- [ ] Connection lifecycle uses `step.run()` instead of `context.run()`
- [ ] Health check fires `memory/connection.lifecycle` (not `platform/connection.lifecycle`)
- [ ] Delivery recovery is a cron function, not a QStash-triggered route
- [ ] `pnpm typecheck` passes

---

## Phase 6: Backfill tRPC Procedures

### Overview

Port the three backfill Hono routes into tRPC procedures on the memory router.

### Changes Required

#### 1. `api/memory/src/router/memory/backfill.ts`

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { backfillTriggerPayload, backfillEstimatePayload } from "@repo/console-providers/contracts";
import { inngest } from "../../inngest/client.js";
// ... DB imports

export const backfillRouter = {
  trigger: protectedProcedure
    .input(backfillTriggerPayload)
    .mutation(async ({ input, ctx }) => {
      // Same validation as POST /trigger
      await inngest.send({
        name: "memory/backfill.run.requested",
        data: {
          installationId: input.installationId,
          provider: input.provider,
          orgId: input.orgId,
          depth: input.depth,
          entityTypes: input.entityTypes,
          holdForReplay: input.holdForReplay,
          correlationId: input.correlationId,
        },
      });
      return { status: "accepted", installationId: input.installationId };
    }),

  cancel: protectedProcedure
    .input(z.object({ installationId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // Verify connection exists (direct DB query, not HTTP)
      const installation = await db.query.gatewayInstallations.findFirst({
        where: eq(gatewayInstallations.id, input.installationId),
      });
      if (!installation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "connection_not_found" });
      }

      await inngest.send({
        name: "memory/backfill.run.cancelled",
        data: { installationId: input.installationId },
      });
      return { status: "cancelled", installationId: input.installationId };
    }),

  estimate: protectedProcedure
    .input(backfillEstimatePayload)
    .query(async ({ input }) => {
      // Same logic as POST /estimate but with direct DB + API calls
      // instead of createGatewayClient()
      // Uses getActiveTokenForInstallation() for token,
      // direct fetch() to provider API for probing
    }),
} satisfies TRPCRouterRecord;
```

**Key differences from Hono routes:**
- Auth is handled by tRPC middleware (`protectedProcedure`) instead of `X-API-Key` header check
- Connection lookup uses direct DB query instead of `createGatewayClient().getConnection()`
- Estimate probing uses direct provider API calls (same pattern as entity worker)
- Error responses use `TRPCError` instead of `c.json({ error }, status)`

### Success Criteria

- [ ] `backfill.trigger` sends `memory/backfill.run.requested` event
- [ ] `backfill.cancel` sends `memory/backfill.run.cancelled` event
- [ ] `backfill.estimate` returns probe results without HTTP to gateway
- [ ] No `@repo/gateway-service-clients` imports
- [ ] `pnpm typecheck` passes

---

## Phase 7: Event Schema Migration

### Overview

Add `memory/` prefixed event schemas to `@repo/inngest` so the memory Inngest client has typed events.

### Changes Required

#### 1. New schema file — `packages/inngest/src/schemas/memory.ts`

```typescript
import { backfillDepthSchema } from "@repo/console-providers/client";
import { backfillTriggerPayload } from "@repo/console-providers/contracts";
import { z } from "zod";

export const memoryEvents = {
  "memory/backfill.run.requested": backfillTriggerPayload,
  "memory/backfill.run.cancelled": z.object({
    installationId: z.string(),
    correlationId: z.string().max(128).optional(),
  }),
  "memory/backfill.entity.requested": z.object({
    installationId: z.string(),
    provider: z.string(),
    orgId: z.string(),
    entityType: z.string(),
    resource: z.object({
      providerResourceId: z.string(),
      resourceName: z.string(),
    }),
    since: z.string().datetime(),
    depth: backfillDepthSchema,
    holdForReplay: z.boolean().optional(),
    correlationId: z.string().max(128).optional(),
  }),
  "memory/health.check.requested": z.object({
    installationId: z.string(),
    provider: z.string(),
    reason: z.enum(["401_unauthorized"]),
    correlationId: z.string().max(128).optional(),
  }),
  "memory/webhook.received": z.object({
    provider: z.string(),
    deliveryId: z.string(),
    eventType: z.string(),
    resourceId: z.string().nullable(),
    payload: z.unknown(),
    receivedAt: z.number(),
    serviceAuth: z.boolean().optional(),
    preResolved: z
      .object({
        connectionId: z.string(),
        orgId: z.string(),
      })
      .optional(),
    correlationId: z.string().optional(),
  }),
  "memory/connection.lifecycle": z.object({
    reason: z.string(),
    installationId: z.string(),
    orgId: z.string(),
    provider: z.string(),
    triggeredBy: z.enum(["health_check", "user", "system"]),
    correlationId: z.string().optional(),
  }),
};
```

#### 2. Register in `packages/inngest/src/index.ts`

```typescript
import { backfillEvents } from "./schemas/backfill.js";
import { consoleEvents } from "./schemas/console.js";
import { memoryEvents } from "./schemas/memory.js";
import { platformEvents } from "./schemas/platform.js";

export { platformEvents, consoleEvents, backfillEvents, memoryEvents };

export const allEvents = {
  ...platformEvents,
  ...consoleEvents,
  ...backfillEvents,
  ...memoryEvents,
} as const;
```

**Note**: The old `backfill/*` and `platform/*` event schemas remain in place. They are still used by the existing services. Removal happens in a future cleanup phase after all consumers are migrated.

### Success Criteria

- [ ] `memory/*` events are type-safe in all Inngest clients (memory, console, gateway, backfill)
- [ ] Old `backfill/*` and `platform/*` events still compile
- [ ] `pnpm typecheck` passes across the monorepo

---

## Phase 8: Tests

### Overview

Port and adapt tests from the backfill and gateway services. Focus on the critical behavior changes (direct DB calls, Inngest events instead of HTTP).

### Changes Required

#### 1. Orchestrator tests — `api/memory/src/inngest/functions/memory-backfill-orchestrator.test.ts`

Port from `apps/backfill/src/workflows/backfill-orchestrator.test.ts`. Key adaptations:
- Mock `db` queries instead of `createGatewayClient()`
- Assert `step.invoke()` calls reference `memoryEntityWorker`
- Assert `step.run("persist-run-records")` does direct DB inserts (not `gw.upsertBackfillRun()`)
- Assert `cancelOn` matches `memory/backfill.run.cancelled`

#### 2. Entity worker tests — `api/memory/src/inngest/functions/memory-entity-worker.test.ts`

Port from `apps/backfill/src/workflows/entity-worker.test.ts`. Key adaptations:
- Mock `getActiveTokenForInstallation()` and `forceRefreshToken()` instead of `createGatewayClient().executeApi()`
- Mock `fetch()` for direct provider API calls
- Assert `step.sendEvent()` fires `memory/webhook.received` events instead of `relay.dispatchWebhook()`
- Assert 401 handling fires `memory/health.check.requested`

#### 3. Connection lifecycle tests — `api/memory/src/inngest/functions/connection-lifecycle.test.ts`

Port from `apps/gateway/src/workflows/connection-teardown.test.ts`. Key adaptations:
- Assert `step.run()` calls instead of Upstash Workflow `context.run()` calls
- Assert cancel-backfill step sends `memory/backfill.run.cancelled` via `inngest.send()` instead of QStash HTTP
- Assert audit log entries are written to `gatewayLifecycleLogs`

#### 4. Backfill tRPC procedure tests — `api/memory/src/router/memory/backfill.test.ts`

New tests for the tRPC procedures:
- `backfill.trigger`: validates input, sends Inngest event, returns accepted
- `backfill.cancel`: verifies connection exists, sends cancel event
- `backfill.estimate`: probes provider API directly, returns estimate

### Success Criteria

- [ ] All ported tests pass
- [ ] No test depends on `@repo/gateway-service-clients`
- [ ] No test depends on `@vendor/upstash-workflow` or `@vendor/qstash`
- [ ] `pnpm typecheck` passes

---

## Testing Strategy

### Unit Tests

Each function has a dedicated test file following the established patterns:

| Function | Test File | Key Assertions |
|----------|-----------|----------------|
| Orchestrator | `memory-backfill-orchestrator.test.ts` | Direct DB calls, entity worker invoke, gap-aware filtering |
| Entity Worker | `memory-entity-worker.test.ts` | Direct API calls, Inngest event dispatch, 401 retry, rate limit sleep |
| Connection Lifecycle | `connection-lifecycle.test.ts` | 5 Inngest steps, cancel-backfill via Inngest event, audit logs |
| Health Check | `health-check.test.ts` | Cron trigger, lifecycle event on revocation, transient failure counting |
| Token Refresh | `token-refresh.test.ts` | Cron trigger, token decryption, refresh flow |
| Delivery Recovery | `delivery-recovery.test.ts` | Cron trigger, stuck delivery sweep, Inngest event dispatch |
| Backfill tRPC | `backfill.test.ts` | Input validation, Inngest event sends, direct DB queries |

### Integration Tests

Update `packages/integration-tests/src/connections-backfill-trigger.integration.test.ts` to use the tRPC backfill procedures instead of `createBackfillClient()`.

Update `packages/integration-tests/src/full-stack-connection-lifecycle.integration.test.ts` to verify the Inngest-based lifecycle flow.

---

## Performance Considerations

- **Direct DB calls vs HTTP**: Eliminates ~3-5ms per gateway HTTP round-trip per step. For an entity worker processing 100 pages with 2 steps each (fetch + dispatch), this saves ~300-500ms per worker.
- **Inngest event dispatch vs HTTP**: `step.sendEvent()` batches events atomically. A page of 30 webhook events is a single Inngest API call instead of 30 sequential HTTP calls to relay.
- **Single Inngest app**: All memory functions share one Inngest app, enabling `step.invoke()` for orchestrator->worker calls (more efficient than cross-app event bus).
- **Cron consolidation**: Three crons (health check, token refresh, delivery recovery) in one Inngest app means one dashboard, one set of metrics.

---

## Migration Notes

- **Dual-write period**: During migration, both old services and memory can run simultaneously. Event names are different (`backfill/*` vs `memory/*`), so there is no conflict.
- **Consumer migration**: Console currently triggers backfill via `createBackfillClient().trigger()`. After this port, Console can switch to calling `memory.backfill.trigger` tRPC procedure.
- **Gateway teardown**: Console currently calls `gw.deleteConnection()` which triggers the Upstash Workflow. After this port, Console can switch to sending `memory/connection.lifecycle` Inngest event directly.
- **Old event schemas**: Keep `backfill/*` and `platform/*` event schemas in `@repo/inngest` until all consumers are migrated. Then remove in a cleanup phase.

---

## File Inventory

### New Files

| File | Purpose |
|------|---------|
| `api/memory/package.json` | Package shell |
| `api/memory/tsconfig.json` | TypeScript config |
| `api/memory/src/env.ts` | Env validation |
| `api/memory/src/inngest/client.ts` | Inngest client |
| `api/memory/src/inngest/index.ts` | Function barrel export |
| `api/memory/src/inngest/functions/memory-backfill-orchestrator.ts` | Backfill orchestrator |
| `api/memory/src/inngest/functions/memory-entity-worker.ts` | Entity worker |
| `api/memory/src/inngest/functions/connection-lifecycle.ts` | Connection teardown |
| `api/memory/src/inngest/functions/health-check.ts` | Health check cron |
| `api/memory/src/inngest/functions/token-refresh.ts` | Token refresh cron |
| `api/memory/src/inngest/functions/delivery-recovery.ts` | Delivery recovery cron |
| `api/memory/src/lib/encryption.ts` | Encryption key helper |
| `api/memory/src/lib/token-store.ts` | Token persistence |
| `api/memory/src/lib/token-helpers.ts` | Token vault operations |
| `api/memory/src/lib/provider-configs.ts` | Provider config factory |
| `api/memory/src/lib/cache.ts` | Redis key conventions |
| `api/memory/src/lib/constants.ts` | Rate limit / pagination constants |
| `api/memory/src/router/memory/backfill.ts` | Backfill tRPC procedures |
| `packages/inngest/src/schemas/memory.ts` | Memory event schemas |

### Modified Files

| File | Change |
|------|--------|
| `packages/inngest/src/index.ts` | Add `memoryEvents` to `allEvents` |

### Files NOT Modified (remain in old services until cleanup phase)

| File | Reason |
|------|--------|
| `apps/backfill/src/workflows/*` | Old service still runs during dual-write |
| `apps/gateway/src/workflows/*` | Old service still runs during dual-write |
| `apps/gateway/src/functions/*` | Old service still runs during dual-write |
| `apps/relay/src/routes/admin.ts` | Old recovery cron still runs during dual-write |

---

## References

- Backfill orchestrator: `apps/backfill/src/workflows/backfill-orchestrator.ts`
- Entity worker: `apps/backfill/src/workflows/entity-worker.ts`
- Backfill trigger/cancel routes: `apps/backfill/src/routes/trigger.ts`
- Backfill estimate route: `apps/backfill/src/routes/estimate.ts`
- Connection teardown workflow: `apps/gateway/src/workflows/connection-teardown.ts`
- Health check cron: `apps/gateway/src/functions/health-check.ts`
- Token refresh cron: `apps/gateway/src/functions/token-refresh.ts`
- Token helpers: `apps/gateway/src/lib/token-helpers.ts`
- Token store: `apps/gateway/src/lib/token-store.ts`
- Delivery recovery cron: `apps/relay/src/routes/admin.ts:224-249`
- Replay helper: `apps/relay/src/lib/replay.ts`
- Gateway client: `packages/gateway-service-clients/src/gateway.ts`
- Relay client: `packages/gateway-service-clients/src/relay.ts`
- Event schemas: `packages/inngest/src/schemas/backfill.ts`, `packages/inngest/src/schemas/platform.ts`
- Inngest client factory: `packages/inngest/src/client.ts`
- Console Inngest setup (pattern reference): `api/console/src/inngest/index.ts`
- Architecture redesign plan: `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md`

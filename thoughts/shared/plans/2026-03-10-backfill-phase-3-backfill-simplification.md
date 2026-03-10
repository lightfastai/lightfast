# Backfill Phase 3: Gateway Client + Backfill App Simplification

## Overview

Add `executeApi()` and `getApiEndpoints()` to the gateway client. Add proxy wire types to `gateway.ts`. Then replace all `@repo/console-backfill` usage in the backfill app with gateway proxy calls + `console-providers` entity handlers. Rate limit parsing moves to the backfill entity worker (client-side).

## Parent Plan

This is Phase 3 of the Backfill Provider Unification plan. Depends on Phase 2 (gateway proxy routes).

## Current State Analysis

- Gateway proxy routes exist (Phase 2): `POST /:id/proxy/execute` and `GET /:id/proxy/endpoints`
- Gateway client (`packages/gateway-service-clients/src/gateway.ts`) has 5 methods: `getConnection`, `getToken`, `getBackfillRuns`, `upsertBackfillRun`, `getAuthorizeUrl`
- Backfill entity worker (`apps/backfill/src/workflows/entity-worker.ts`) currently:
  - Fetches tokens outside step boundary (line 62)
  - Uses `getConnector()` from `@repo/console-backfill` (lines 65-72)
  - Constructs `BackfillConfig` with `accessToken` (lines 75-84)
  - Handles 401 token refresh inline within step (lines 118-148)
- Backfill orchestrator uses `getConnector()` for entity type resolution
- Estimate route uses `getConnector()` + direct `fetchPage()` calls

## Desired End State

After this phase:
1. Gateway client has `executeApi()` and `getApiEndpoints()` methods
2. `gateway.ts` has proxy wire type schemas (`proxyExecuteRequestSchema`, etc.)
3. Entity worker uses `getProvider()` + entity handlers instead of connectors
4. Entity worker no longer fetches tokens — gateway proxy handles auth
5. No 401 catch-and-retry in entity worker — gateway handles token refresh
6. Orchestrator uses `providerDef.backfill.defaultEntityTypes` instead of `connector.defaultEntityTypes`
7. Estimate route uses gateway proxy instead of direct `fetchPage()` calls
8. No imports of `@repo/console-backfill` remain in `apps/backfill/`

## What We're NOT Doing

- Deleting `@repo/console-backfill` (Phase 6)
- Changing the Inngest workflow structure (orchestrator + entity worker pattern stays)
- Changing the relay dispatch path
- Changing the `holdForReplay` / replay-catchup mechanism
- Moving backfill run tracking (stays in gateway)

## Changes Required

### 1. Add wire types to console-providers gateway.ts

**File**: `packages/console-providers/src/gateway.ts`
**Changes**: Add Zod schemas for the proxy request/response wire format.

```typescript
// ── Proxy wire types ────────────────────────────────────────────────────────────

export const proxyExecuteRequestSchema = z.object({
  endpointId: z.string(),
  pathParams: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

export type ProxyExecuteRequest = z.infer<typeof proxyExecuteRequestSchema>;

export const proxyExecuteResponseSchema = z.object({
  status: z.number(),
  data: z.unknown(),
  headers: z.record(z.string()),
});

export type ProxyExecuteResponse = z.infer<typeof proxyExecuteResponseSchema>;

export const proxyEndpointsResponseSchema = z.object({
  provider: z.string(),
  baseUrl: z.string(),
  endpoints: z.record(
    z.object({
      method: z.enum(["GET", "POST"]),
      path: z.string(),
      description: z.string(),
      timeout: z.number().optional(),
    })
  ),
});

export type ProxyEndpointsResponse = z.infer<typeof proxyEndpointsResponseSchema>;
```

Export these from `packages/console-providers/src/index.ts`.

### 2. Add methods to gateway client

**File**: `packages/gateway-service-clients/src/gateway.ts`
**Changes**: Add `executeApi()` and `getApiEndpoints()` methods to the object returned by `createGatewayClient()`.

```typescript
async executeApi(
  installationId: string,
  request: {
    endpointId: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  }
): Promise<ProxyExecuteResponse> {
  const response = await fetch(
    `${gatewayUrl}/gateway/${installationId}/proxy/execute`,
    {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!response.ok) {
    const err = new Error(
      `Gateway executeApi failed: ${response.status} for ${installationId}`
    );
    (err as any).status = response.status;
    throw err;
  }
  return response.json() as Promise<ProxyExecuteResponse>;
},

async getApiEndpoints(
  installationId: string
): Promise<ProxyEndpointsResponse> {
  const response = await fetch(
    `${gatewayUrl}/gateway/${installationId}/proxy/endpoints`,
    { headers: h, signal: AbortSignal.timeout(10_000) }
  );
  if (!response.ok) {
    throw new Error(
      `Gateway getApiEndpoints failed: ${response.status} for ${installationId}`
    );
  }
  return response.json() as Promise<ProxyEndpointsResponse>;
},
```

Import `ProxyExecuteResponse` and `ProxyEndpointsResponse` from `@repo/console-providers`.

### 3. Simplify entity worker

**File**: `apps/backfill/src/workflows/entity-worker.ts`

**Remove:**
- `import { getConnector } from "@repo/console-backfill"` and `import type { BackfillConfig }`
- Token fetching outside step boundary (line 62)
- Connector resolution (lines 65-72)
- `BackfillConfig` construction (lines 75-84)
- 401 token refresh logic within step (lines 118-148)
- Token re-fetch after refresh (lines 155-158)

**Add:**
- `import { getProvider, type BackfillContext } from "@repo/console-providers"`

**Replace the pagination loop with:**

```typescript
const providerDef = getProvider(provider);
if (!providerDef) {
  throw new NonRetriableError(`Unknown provider: ${provider}`);
}

const entityHandler = providerDef.backfill.entityTypes[entityType];
if (!entityHandler) {
  throw new NonRetriableError(
    `Entity type "${entityType}" is not supported for ${provider} backfill`
  );
}

const ctx: BackfillContext = {
  installationId,
  resource,
  since,
};

let cursor: unknown = null;
let pageNum = 1;
let eventsProduced = 0;
let eventsDispatched = 0;

while (true) {
  const fetchResult = await step.run(
    `fetch-${entityType}-p${pageNum}`,
    async () => {
      const request = entityHandler.buildRequest(ctx, cursor);
      const raw = await gw.executeApi(installationId, {
        endpointId: entityHandler.endpointId,
        ...request,
      });

      if (raw.status !== 200) {
        const err = new Error(`Provider API returned ${raw.status}`);
        (err as any).status = raw.status;
        throw err;
      }

      const processed = entityHandler.processResponse(raw.data, ctx, cursor, raw.headers);

      // Parse rate limits client-side from raw headers
      const rateLimit = providerDef.api.parseRateLimit(new Headers(raw.headers));

      return {
        events: processed.events,
        nextCursor: processed.nextCursor,
        rawCount: processed.rawCount,
        rateLimit: rateLimit
          ? {
              remaining: rateLimit.remaining,
              resetAt: rateLimit.resetAt.toISOString(),
              limit: rateLimit.limit,
            }
          : null,
      };
    }
  );

  eventsProduced += fetchResult.rawCount;

  // dispatch step — unchanged from current implementation
  const dispatched = await step.run(
    `dispatch-${entityType}-p${pageNum}`,
    async () => {
      let count = 0;
      for (let i = 0; i < fetchResult.events.length; i += BATCH_SIZE) {
        const batch = fetchResult.events.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((event) =>
            relay.dispatchWebhook(
              provider,
              {
                connectionId: installationId,
                orgId,
                deliveryId: event.deliveryId,
                eventType: event.eventType,
                payload: event.payload,
                receivedAt: Date.now(),
              },
              holdForReplay
            )
          )
        );
        count += batch.length;
      }
      return count;
    }
  );

  eventsDispatched += dispatched;

  // Rate limit sleep — reads from serialized rateLimit
  if (fetchResult.rateLimit) {
    const { remaining, resetAt, limit } = fetchResult.rateLimit;
    if (remaining < limit * 0.1) {
      const sleepMs = Math.max(0, new Date(resetAt).getTime() - Date.now());
      if (sleepMs > 0) {
        await step.sleep(
          `rate-limit-${entityType}-p${pageNum}`,
          `${Math.ceil(sleepMs / 1000)}s`
        );
      }
    }
  }

  if (!fetchResult.nextCursor) break;
  cursor = fetchResult.nextCursor;
  pageNum++;
}
```

**Key simplifications vs current:**
- No `gw.getToken()` calls — gateway proxy handles auth
- No 401 catch-and-retry — gateway handles token refresh
- No `BackfillConfig` construction — `BackfillContext` is simpler (no token, no provider name)
- No connector registry — entity handlers come from `getProvider()`
- Rate limit parsing happens client-side from raw headers returned by the proxy

### 4. Simplify orchestrator

**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts`

**Remove:**
- `import { getConnector } from "@repo/console-backfill"`

**Replace connector-based entity type resolution:**

```typescript
import { getProvider } from "@repo/console-providers";

const providerDef = getProvider(provider);
if (!providerDef) {
  throw new NonRetriableError(`Unknown provider: ${provider}`);
}

if (providerDef.backfill.supportedEntityTypes.length === 0) {
  throw new NonRetriableError(`Provider ${provider} does not support backfill`);
}

const resolvedEntityTypes =
  entityTypes && entityTypes.length > 0
    ? entityTypes
    : [...providerDef.backfill.defaultEntityTypes];
```

### 5. Simplify estimate route

**File**: `apps/backfill/src/routes/estimate.ts`

**Remove:**
- `import { getConnector } from "@repo/console-backfill"` and `import type { BackfillConfig }`
- Token fetching (lines 53-57)
- Connector resolution (lines 60-63)

**Replace with gateway proxy calls:**

```typescript
import { getProvider, type BackfillContext } from "@repo/console-providers";

const providerDef = getProvider(provider);
const resolvedEntityTypes =
  entityTypes?.length ? entityTypes : [...providerDef.backfill.defaultEntityTypes];

// Build probes — no token needed, gateway handles auth
const probes = resolvedEntityTypes.flatMap((entityType) =>
  connection.resources.map(async (resource) => {
    const entityHandler = providerDef.backfill.entityTypes[entityType];
    if (!entityHandler) return { entityType, resource: resource.providerResourceId, returnedCount: 0, hasMore: false };

    const ctx: BackfillContext = {
      installationId,
      resource: { providerResourceId: resource.providerResourceId, resourceName: resource.resourceName },
      since,
    };

    try {
      const request = entityHandler.buildRequest(ctx, null);
      const raw = await gw.executeApi(installationId, {
        endpointId: entityHandler.endpointId,
        ...request,
      });

      if (raw.status !== 200) {
        return { entityType, resource: resource.providerResourceId, returnedCount: -1, hasMore: false };
      }

      const processed = entityHandler.processResponse(raw.data, ctx, null);
      return {
        entityType,
        resource: resource.providerResourceId,
        returnedCount: processed.rawCount,
        hasMore: processed.nextCursor !== null,
      };
    } catch {
      return { entityType, resource: resource.providerResourceId, returnedCount: -1, hasMore: false };
    }
  })
);
```

### 6. Remove console-backfill dependency

**File**: `apps/backfill/package.json`
**Changes**: Remove `"@repo/console-backfill": "workspace:*"` from dependencies. Ensure `"@repo/console-providers": "workspace:*"` is present.

### 7. Update test mocks

**Files**:
- `apps/backfill/src/workflows/entity-worker.test.ts`
- `apps/backfill/src/workflows/backfill-orchestrator.test.ts`
- `apps/backfill/src/workflows/step-replay.test.ts`
- `apps/backfill/src/routes/estimate.test.ts`

**Changes**: Replace `vi.mock("@repo/console-backfill", ...)` with:

1. Mock `@repo/console-providers` `getProvider`:
```typescript
vi.mock("@repo/console-providers", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProvider: () => ({
      api: {
        parseRateLimit: () => null,
      },
      backfill: {
        supportedEntityTypes: ["pull_request", "issue"],
        defaultEntityTypes: ["pull_request", "issue"],
        entityTypes: {
          pull_request: {
            endpointId: "list-pull-requests",
            buildRequest: vi.fn(() => ({
              pathParams: { owner: "test", repo: "test" },
              queryParams: { per_page: "100" },
            })),
            processResponse: vi.fn((data) => ({
              events: [...],
              nextCursor: null,
              rawCount: Array.isArray(data) ? data.length : 0,
            })),
          },
        },
      },
    }),
  };
});
```

2. Mock gateway client's `executeApi`:
```typescript
executeApi: vi.fn(async () => ({
  status: 200,
  data: [...testData],
  headers: {},
})),
```

## Success Criteria

### Automated Verification:
- [x] `pnpm --filter @lightfast/backfill typecheck` passes
- [x] `pnpm --filter @lightfast/backfill test` passes (all tests updated and passing)
- [x] `pnpm --filter @repo/gateway-service-clients typecheck` passes
- [x] `pnpm --filter @repo/console-providers typecheck` passes
- [x] `pnpm build:backfill` succeeds
- [x] No imports of `@repo/console-backfill` remain in `apps/backfill/`

### Manual Verification:
- [ ] Run a full backfill flow end-to-end with `pnpm dev:app` — trigger a backfill for a GitHub connection, verify events arrive in Console
- [ ] Verify estimate endpoint returns reasonable results via curl
- [ ] Verify cancellation still works (send cancel event, verify workers stop)

**Implementation Note**: After completing this phase, pause for full end-to-end manual testing before proceeding to Phase 4.

## References

- Entity worker: `apps/backfill/src/workflows/entity-worker.ts`
- Orchestrator: `apps/backfill/src/workflows/backfill-orchestrator.ts`
- Estimate endpoint: `apps/backfill/src/routes/estimate.ts`
- Gateway client: `packages/gateway-service-clients/src/gateway.ts`

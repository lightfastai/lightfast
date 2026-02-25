# Backfill Event-Driven Overhaul Implementation Plan

## Overview

Replace the monolithic `backfill-orchestrator.ts` (267 lines, single Inngest function processing entity types sequentially) with an event-driven two-tier fan-out architecture. The orchestrator validates the connection, enumerates all `resource x entityType` work units, dispatches them via `step.sendEvent`, and waits for completion via `step.waitForEvent`. Each entity worker independently fetches its own token, paginates through one resource's one entity type, dispatches to Gateway, and emits a completion event. XState is dropped entirely.

This addresses 6 production failure modes:
1. **Mid-run crash**: Inngest step memoization = page-level cursor checkpointing (free)
2. **Token expiration**: Workers self-fetch tokens + 401 refresh within step boundary
3. **Tenant starvation**: Per-installationId concurrency caps + generous global cap
4. **Rate limit coordination**: Dynamic `step.sleep()` from headers + `throttle` backstop
5. **Gateway backpressure**: Concurrency limit IS the backpressure mechanism
6. **DeliveryId collisions**: Include `resourceId` in deterministic IDs for multi-resource

## Current State Analysis

**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts` (267 lines)

Single Inngest function `apps-backfill/run.orchestrator` that:
- Initializes an XState machine (ephemeral actors via `transitionMachine()`)
- Fetches connection + token from Gateway
- Validates scopes via connector
- Processes entity types **sequentially** in a nested `for...while` loop
- Dispatches each event to Gateway one-by-one per page
- Uses `step.sleep()` for rate limiting (reactive, based on `X-RateLimit-Remaining`)
- Global concurrency: `{ limit: 1, key: installationId }` + `{ limit: 3 }` (3 total!)
- Only processes `config.resources[0]` — single resource, no multi-resource support

### Key Discoveries:
- `backfill-orchestrator.ts:16-18` — Global cap of 3 means one large backfill blocks others
- `packages/console-backfill/src/connectors/github.ts:35` — `config.resources[0]` hardcoded
- `packages/console-backfill/src/connectors/github.ts:99` — `deliveryId` uses `pr.number` without resourceId — collision if multiple repos share an installation
- `apps/backfill/src/machine/backfill-machine.ts:47-53` — XState is "for state definition and validation only" — machine tracking is overhead, not value
- `apps/gateway/src/lib/urls.ts:50-65` — Backfill triggered via QStash from Gateway on new connections

## Desired End State

A two-tier event-driven backfill system where:

```
apps-backfill/run.requested
         |
         v
+----------------------------------------------------------+
|  Orchestrator  (Tier 1 — setup + fan-out + wait)          |
|                                                           |
|  1. get-connection    -> GET /connections/:id              |
|  2. validate-scopes   -> connector.validateScopes()       |
|  3. fan-out           -> step.sendEvent([...workUnits])   |
|  4. wait              -> Promise.all(step.waitForEvent)   |
|  5. aggregate + return                                    |
+----------------------------------------------------------+
         | step.sendEvent for each (resource, entityType) pair
         v
apps-backfill/entity.requested x N
         |
         v
+----------------------------------------------------------+
|  Entity Worker  (Tier 2 — token + paginate + dispatch)    |
|                                                           |
|  Config:                                                  |
|  - concurrency: per-installationId (5) + global (30)     |
|  - throttle: 4000/hr per installationId                  |
|  - cancelOn: apps-backfill/run.cancelled                 |
|                                                           |
|  Steps:                                                   |
|  1. get-token          -> GET /connections/:id/token      |
|  2. fetch-{type}-p{N}  -> connector.fetchPage()          |
|  3. dispatch-{type}-p{N} -> POST /webhooks/:provider     |
|  4. (conditional) step.sleep if rate limited              |
|  5. loop until nextCursor === null                        |
|  6. emit entity.completed event (always, success or fail) |
+----------------------------------------------------------+
```

### Verification:

- `pnpm typecheck` passes with zero errors
- `pnpm lint` passes
- Existing Inngest trigger endpoint (`POST /trigger`) works unchanged
- Entity workers process all resources for a connection (not just `resources[0]`)
- DeliveryIds include resource identifier (no collisions across repos)
- One tenant's backfill cannot block other tenants beyond their concurrency allocation
- If a worker fails at page 40 of 50, retry resumes from page 40 (step memoization)
- If a worker's token expires mid-pagination, it self-refreshes on 401
- Cancelling a backfill cancels all entity workers (shared `cancelOn`)

## What We're NOT Doing

- **Real-time progress UI**: Entity workers emit `entity.completed` events that external services can consume, but we are not building a progress tracking UI or Console-side listener in this plan
- **Centralized Redis rate limiter**: Dynamic `step.sleep()` + Inngest `throttle` is sufficient for current scale (max 5 concurrent workers per installationId). Redis token bucket is future optimization
- **Per-provider entity worker functions**: All providers share one `entity-worker` function. If throttle configs diverge significantly, split later
- **Retry partial entity types**: If `pull_request` fails but `issue` succeeds, the user currently re-triggers the full backfill. Fine-grained per-entity retry is future work (the architecture supports it — just re-send `entity.requested`)
- **New connector implementations**: This refactor only updates GitHub and Vercel connectors

## Implementation Approach

The refactor is a clean rewrite. The backfill service is standalone with no shared state to migrate. The approach is bottom-up: types first, then connectors, then entity worker, then orchestrator, then cleanup.

---

## Phase 1: Event Schema & Type Foundation

### Overview
Define the new event types and update `BackfillConfig` to support singular resource/entityType. Fix the deliveryId format for multi-resource correctness.

### Changes Required:

#### 1. Update BackfillConfig to singular resource
**File**: `packages/console-backfill/src/types.ts`
**Changes**: Replace `resources: Array<...>` with singular `resource`, remove `entityTypes` array (entity worker processes one type)

```typescript
export interface BackfillConfig {
  /** Gateway installation ID (gw_installations.id) */
  installationId: string;
  /** Provider name */
  provider: SourceType;
  /** ISO timestamp = now - depth days */
  since: string;
  /** Decrypted access token from Gateway token vault */
  accessToken: string;
  /** Single resource for this work unit */
  resource: {
    providerResourceId: string;
    resourceName: string | null;
  };
}
```

Remove `BackfillCheckpoint` interface (no longer needed without XState).

Keep `BackfillPage`, `BackfillWebhookEvent`, `BackfillConnector` interfaces. Update `BackfillConnector.validateScopes` and `fetchPage` signatures to use the updated `BackfillConfig`.

#### 2. Add new Inngest event schemas
**File**: `apps/backfill/src/inngest/client.ts`
**Changes**: Add `entity.requested`, `entity.completed` events alongside existing events

```typescript
const eventsMap = {
  "apps-backfill/run.requested": {
    data: z.object({
      installationId: z.string(),
      provider: z.string(),
      orgId: z.string(),
      depth: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
      entityTypes: z.array(z.string()).optional(),
    }),
  },
  "apps-backfill/run.cancelled": {
    data: z.object({
      installationId: z.string(),
    }),
  },
  "apps-backfill/entity.requested": {
    data: z.object({
      /** Correlation ID — matches the orchestrator's trigger event */
      installationId: z.string(),
      provider: z.string(),
      orgId: z.string(),
      /** Single entity type for this work unit */
      entityType: z.string(),
      /** Single resource for this work unit */
      resource: z.object({
        providerResourceId: z.string(),
        resourceName: z.string().nullable(),
      }),
      /** ISO timestamp — computed once by orchestrator */
      since: z.string(),
      /** Depth in days — for logging/context */
      depth: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    }),
  },
  "apps-backfill/entity.completed": {
    data: z.object({
      installationId: z.string(),
      provider: z.string(),
      entityType: z.string(),
      resourceId: z.string(),
      success: z.boolean(),
      eventsProduced: z.number(),
      eventsDispatched: z.number(),
      pagesProcessed: z.number(),
      error: z.string().optional(),
    }),
  },
};
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Review that the event schemas match the architecture diagram above

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Connector Refactor

### Overview
Update GitHub and Vercel connectors to use the new singular `config.resource` instead of `config.resources[0]`. Fix deliveryId format to include resourceId for multi-resource correctness.

### Changes Required:

#### 1. Update GitHub connector
**File**: `packages/console-backfill/src/connectors/github.ts`
**Changes**:
- Replace `config.resources[0]` with `config.resource` throughout
- Fix deliveryId format to include repoId: `backfill-{installationId}-{repoId}-pr-{number}`
- Remove `config.resources[0]` null checks (config.resource is required by type)

Key changes:
```typescript
// Before (github.ts:35-36)
const resource = config.resources[0];
if (!resource?.resourceName) { ... }

// After
const resource = config.resource;
if (!resource.resourceName) { ... }
```

DeliveryId fix (prevents collision when same installation covers multiple repos):
```typescript
// Before (github.ts:99)
deliveryId: `backfill-${config.installationId}-pr-${pr.number as number}`,

// After — include repoId to prevent cross-repo collisions
deliveryId: `backfill-${config.installationId}-${resource.providerResourceId}-pr-${pr.number as number}`,
```

Apply the same deliveryId fix to issues (line 146) and releases (line 193).

#### 2. Update Vercel connector
**File**: `packages/console-backfill/src/connectors/vercel.ts`
**Changes**:
- Replace `config.resources[0]` with `config.resource` throughout (lines 32, 69)
- DeliveryId already includes `deployment.uid` (globally unique) — no collision fix needed, but add resourceId for consistency:

```typescript
// Before (vercel.ts:110)
deliveryId: `backfill-${config.installationId}-deploy-${deployment.uid as string}`,

// After
deliveryId: `backfill-${config.installationId}-${resource.providerResourceId}-deploy-${deployment.uid as string}`,
```

#### 3. Update connector interface if needed
**File**: `packages/console-backfill/src/types.ts`
**Changes**: The `BackfillConnector` interface's `validateScopes` and `fetchPage` methods already take `BackfillConfig` — they automatically pick up the singular `resource` change from Phase 1.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build:console` (to verify no downstream type errors)

#### Manual Verification:
- [ ] Review deliveryId format change — confirm it won't break existing dedup in Gateway's webhook storage (the `deliveryId` is used as a unique key in `workspace-webhook-payloads` table)

**Implementation Note**: The deliveryId format change means re-running a backfill for an already-backfilled resource will produce different IDs than before. This is correct behavior — old IDs didn't include resourceId and were potentially colliding. However, it means a re-backfill will create new rows rather than deduplicating against old ones. This is acceptable since backfill is typically run once per connection. Pause for manual confirmation before proceeding.

---

## Phase 3: Entity Worker Function

### Overview
Create the Tier 2 entity worker — the core workhorse that processes one resource's one entity type. It self-fetches its token, paginates through all pages, dispatches to Gateway, handles rate limits and token expiration, and emits a completion event on success or failure.

### Changes Required:

#### 1. Create entity worker function
**File**: `apps/backfill/src/workflows/entity-worker.ts` (NEW)

```typescript
import { NonRetriableError } from "inngest";
import { inngest } from "../inngest/client";
import { getConnector } from "@repo/console-backfill";
import type { BackfillConfig } from "@repo/console-backfill";
import { env } from "../env";
import { gatewayUrl } from "../lib/related-projects";

export const backfillEntityWorker = inngest.createFunction(
  {
    id: "apps-backfill/entity.worker",
    name: "Backfill Entity Worker",
    retries: 3,
    concurrency: [
      // Per-connection: max 5 entity workers in parallel per installation
      // (prevents one connection from consuming all slots)
      { limit: 5, key: "event.data.installationId" },
      // Global: max 30 entity workers across all connections
      // (allows ~6 connections to run simultaneously at full parallelism)
      { limit: 30 },
    ],
    // Conservative backstop: 4000 req/hr per installation token
    // (GitHub limit is 5000 — leaves 1000 for webhook/realtime traffic)
    throttle: {
      limit: 4000,
      period: "1h",
      key: "event.data.installationId",
    },
    // Workers must declare their own cancelOn — it does NOT propagate from parent
    cancelOn: [
      {
        event: "apps-backfill/run.cancelled",
        match: "data.installationId",
      },
    ],
    timeouts: { start: "5m", finish: "2h" },
  },
  { event: "apps-backfill/entity.requested" },
  async ({ event, step }) => {
    const {
      installationId,
      provider,
      orgId,
      entityType,
      resource,
      since,
      depth,
    } = event.data;

    // ── Step 1: Self-fetch token (not passed via event — security + expiration) ──
    const { accessToken: initialToken } = await step.run(
      "get-token",
      async () => {
        const response = await fetch(
          `${gatewayUrl}/connections/${installationId}/token`,
          { headers: { "X-API-Key": env.GATEWAY_API_KEY } },
        );
        if (!response.ok) {
          throw new Error(
            `Gateway getToken failed: ${response.status} for ${installationId}`,
          );
        }
        return response.json() as Promise<{
          accessToken: string;
          provider: string;
          expiresIn: number | null;
        }>;
      },
    );

    // ── Resolve connector ──
    const connector = getConnector(
      provider as Parameters<typeof getConnector>[0],
    );
    if (!connector) {
      throw new NonRetriableError(
        `No backfill connector for provider: ${provider}`,
      );
    }

    // Build config with singular resource
    const config: BackfillConfig = {
      installationId,
      provider: provider as BackfillConfig["provider"],
      since,
      accessToken: initialToken,
      resource: {
        providerResourceId: resource.providerResourceId,
        resourceName: resource.resourceName,
      },
    };

    // ── Pagination loop ──
    let cursor: unknown = null;
    let pageNum = 1;
    let eventsProduced = 0;
    let eventsDispatched = 0;

    while (true) {
      // Fetch page — includes inline 401 token refresh
      const fetchResult = await step.run(
        `fetch-${entityType}-p${pageNum}`,
        async () => {
          try {
            const page = await connector.fetchPage(config, entityType, cursor);
            return {
              events: page.events,
              nextCursor: page.nextCursor,
              rawCount: page.rawCount,
              rateLimit: page.rateLimit
                ? {
                    remaining: page.rateLimit.remaining,
                    resetAt: page.rateLimit.resetAt.toISOString(),
                    limit: page.rateLimit.limit,
                  }
                : null,
            };
          } catch (err: unknown) {
            // Token expired — refresh and retry within the same step boundary
            // This avoids memoization issues (the step either succeeds or throws)
            const status =
              err instanceof Error && "status" in err
                ? (err as { status: number }).status
                : undefined;
            if (status === 401) {
              const tokenResponse = await fetch(
                `${gatewayUrl}/connections/${installationId}/token`,
                { headers: { "X-API-Key": env.GATEWAY_API_KEY } },
              );
              if (!tokenResponse.ok) throw err; // Can't refresh — rethrow original
              const { accessToken: freshToken } =
                (await tokenResponse.json()) as { accessToken: string };
              config.accessToken = freshToken;

              const page = await connector.fetchPage(
                config,
                entityType,
                cursor,
              );
              return {
                events: page.events,
                nextCursor: page.nextCursor,
                rawCount: page.rawCount,
                rateLimit: page.rateLimit
                  ? {
                      remaining: page.rateLimit.remaining,
                      resetAt: page.rateLimit.resetAt.toISOString(),
                      limit: page.rateLimit.limit,
                    }
                  : null,
              };
            }
            throw err;
          }
        },
      );

      eventsProduced += fetchResult.rawCount;

      // Dispatch each event to Gateway service auth endpoint
      await step.run(`dispatch-${entityType}-p${pageNum}`, async () => {
        for (const webhookEvent of fetchResult.events) {
          const response = await fetch(`${gatewayUrl}/webhooks/${provider}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": env.GATEWAY_API_KEY,
            },
            body: JSON.stringify({
              connectionId: installationId,
              orgId,
              deliveryId: webhookEvent.deliveryId,
              eventType: webhookEvent.eventType,
              payload: webhookEvent.payload,
              receivedAt: Date.now(),
            }),
          });
          if (!response.ok) {
            const text = await response.text().catch(() => "unknown");
            throw new Error(
              `Gateway ingestWebhook failed: ${response.status} — ${text}`,
            );
          }
          eventsDispatched++;
        }
      });

      // Rate limit sleep if near threshold (dynamic, based on response headers)
      if (
        fetchResult.rateLimit &&
        fetchResult.rateLimit.remaining < fetchResult.rateLimit.limit * 0.1
      ) {
        const resetAt = new Date(fetchResult.rateLimit.resetAt);
        const sleepMs = Math.max(0, resetAt.getTime() - Date.now());
        if (sleepMs > 0) {
          await step.sleep(
            `rate-limit-${entityType}-p${pageNum}`,
            `${Math.ceil(sleepMs / 1000)}s`,
          );
        }
      }

      if (!fetchResult.nextCursor) break;
      cursor = fetchResult.nextCursor;
      pageNum++;
    }

    // ── Emit completion event (always — orchestrator's waitForEvent depends on this) ──
    await step.sendEvent("notify-completion", {
      name: "apps-backfill/entity.completed",
      data: {
        installationId,
        provider,
        entityType,
        resourceId: resource.providerResourceId,
        success: true,
        eventsProduced,
        eventsDispatched,
        pagesProcessed: pageNum,
      },
    });

    return { entityType, resource: resource.providerResourceId, eventsProduced, eventsDispatched, pagesProcessed: pageNum };
  },
);
```

**Key design decisions in this code:**

1. **Token self-fetch** (not passed via event): No token in event payloads (security). Workers get their own fresh token. If it expires mid-pagination, the 401 catch-and-refresh within `step.run` handles it transparently.

2. **401 refresh within step boundary**: The entire try-catch-refresh-retry is inside one `step.run`. If it succeeds, the step is memoized with the successful result. On function replay, the memoized result is used — no re-execution, no stale token issue.

3. **Completion event always emitted**: The orchestrator's `step.waitForEvent` depends on receiving `entity.completed`. If the worker crashes before emitting, the orchestrator's wait times out (handled in Phase 4). If the worker succeeds, the event is emitted via `step.sendEvent` (memoized = delivered exactly once).

4. **Concurrency: 5 per installationId + 30 global**: One connection gets max 5 parallel workers (e.g., 3 entity types for 1 repo, or 5 work units across multiple repos). Globally, 30 workers can run = ~6 connections at full parallelism. No single tenant can consume more than 5/30 of total capacity.

5. **Throttle: 4000 req/hr per installationId**: Conservative backstop below GitHub's 5000/hr. Leaves headroom for real-time webhook traffic. Dynamic `step.sleep()` inside the loop handles fine-grained adaptation from actual `X-RateLimit-Remaining` headers.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Entity worker compiles and exports correctly

#### Manual Verification:
- [ ] Review concurrency limits (5 per-installationId, 30 global) — confirm these numbers are appropriate for current scale
- [ ] Review throttle limit (4000/hr) — confirm this leaves enough headroom
- [ ] Review 401 refresh logic — confirm the token refresh pattern handles all edge cases

**Implementation Note**: The entity worker is self-contained and can be tested independently by sending an `apps-backfill/entity.requested` event directly via the Inngest dashboard. Pause for manual confirmation before proceeding.

---

## Phase 4: Orchestrator Rewrite

### Overview
Replace the monolithic orchestrator with a lean setup + fan-out + wait function. It validates the connection, enumerates all `resource x entityType` work units, dispatches them via `step.sendEvent`, waits for all completion events via `Promise.all(step.waitForEvent)`, and returns aggregate results.

### Changes Required:

#### 1. Rewrite orchestrator
**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts` (REWRITE)

```typescript
import { NonRetriableError } from "inngest";
import { inngest } from "../inngest/client";
import { getConnector } from "@repo/console-backfill";
import { env } from "../env";
import { gatewayUrl } from "../lib/related-projects";

export const backfillOrchestrator = inngest.createFunction(
  {
    id: "apps-backfill/run.orchestrator",
    name: "Backfill Orchestrator",
    retries: 3,
    concurrency: [
      // 1 backfill per connection — prevents duplicate backfills
      { limit: 1, key: "event.data.installationId" },
      // 10 total concurrent orchestrators (each lightweight — just fan-out + wait)
      { limit: 10 },
    ],
    cancelOn: [
      {
        event: "apps-backfill/run.cancelled",
        match: "data.installationId",
      },
    ],
    // Orchestrator waits for all entity workers — must accommodate the longest
    // Worst case: 15 work units (5 repos x 3 entities), 5 concurrent, each 2hr
    // = 15/5 * 2hr = 6hr total. Set to 8hr for safety.
    timeouts: { start: "2m", finish: "8h" },
  },
  { event: "apps-backfill/run.requested" },
  async ({ event, step }) => {
    const { installationId, provider, orgId, depth, entityTypes } = event.data;

    // ── Step 1: Fetch connection details from Gateway ──
    const connection = await step.run("get-connection", async () => {
      const response = await fetch(
        `${gatewayUrl}/connections/${installationId}`,
        { headers: { "X-API-Key": env.GATEWAY_API_KEY } },
      );
      if (!response.ok) {
        throw new Error(
          `Gateway getConnection failed: ${response.status} for ${installationId}`,
        );
      }
      const conn = (await response.json()) as {
        id: string;
        provider: string;
        externalId: string;
        orgId: string;
        status: string;
        resources: {
          id: string;
          providerResourceId: string;
          resourceName: string | null;
        }[];
      };
      if (conn.status !== "active") {
        throw new NonRetriableError(
          `Connection is not active: ${installationId} (status: ${conn.status})`,
        );
      }
      return conn;
    });

    // ── Step 2: Resolve entity types and validate connector ──
    const connector = getConnector(
      provider as Parameters<typeof getConnector>[0],
    );
    if (!connector) {
      throw new NonRetriableError(
        `No backfill connector for provider: ${provider}`,
      );
    }

    const resolvedEntityTypes =
      entityTypes && entityTypes.length > 0
        ? entityTypes
        : connector.defaultEntityTypes;

    // Compute `since` once — all work units use the same time window
    const since = new Date(
      Date.now() - depth * 24 * 60 * 60 * 1000,
    ).toISOString();

    // ── Step 3: Enumerate work units (resource x entityType) ──
    const workUnits = connection.resources.flatMap((resource) =>
      resolvedEntityTypes.map((entityType) => ({
        entityType,
        resource: {
          providerResourceId: resource.providerResourceId,
          resourceName: resource.resourceName,
        },
        // Stable ID for step naming
        workUnitId: `${resource.providerResourceId}-${entityType}`,
      })),
    );

    if (workUnits.length === 0) {
      return {
        success: true,
        installationId,
        provider,
        workUnits: 0,
        eventsProduced: 0,
        eventsDispatched: 0,
      };
    }

    // ── Step 4: Fan-out — dispatch all work units ──
    await step.sendEvent(
      "fan-out-entity-workers",
      workUnits.map((wu) => ({
        name: "apps-backfill/entity.requested" as const,
        data: {
          installationId,
          provider,
          orgId,
          entityType: wu.entityType,
          resource: wu.resource,
          since,
          depth,
        },
      })),
    );

    // ── Step 5: Wait for all completion events ──
    // Each waitForEvent is dispatched in parallel via Promise.all
    // As each entity.completed event arrives, the matching wait resolves
    const completionResults = await Promise.all(
      workUnits.map(async (wu) => {
        const result = await step.waitForEvent(
          `wait-${wu.workUnitId}`,
          {
            event: "apps-backfill/entity.completed",
            match: "data.installationId",
            if: `async.data.resourceId == '${wu.resource.providerResourceId}' && async.data.entityType == '${wu.entityType}'`,
            timeout: "4h",
          },
        );

        if (!result) {
          // waitForEvent returns null on timeout
          return {
            entityType: wu.entityType,
            resourceId: wu.resource.providerResourceId,
            success: false,
            eventsProduced: 0,
            eventsDispatched: 0,
            pagesProcessed: 0,
            error: "timeout — entity worker did not complete within 4 hours",
          };
        }

        return result.data;
      }),
    );

    // ── Step 6: Aggregate results ──
    const succeeded = completionResults.filter((r) => r.success);
    const failed = completionResults.filter((r) => !r.success);

    return {
      success: failed.length === 0,
      installationId,
      provider,
      workUnits: workUnits.length,
      completed: succeeded.length,
      failed: failed.length,
      eventsProduced: completionResults.reduce(
        (sum, r) => sum + r.eventsProduced,
        0,
      ),
      eventsDispatched: completionResults.reduce(
        (sum, r) => sum + r.eventsDispatched,
        0,
      ),
      results: completionResults,
    };
  },
);
```

**Key design decisions:**

1. **`step.sendEvent` + `step.waitForEvent`** (not `step.invoke`): Workers are fully independent. No `NonRetriableError` propagation from children. Orchestrator handles timeouts gracefully (returns `null` from `waitForEvent`). Workers can be cancelled independently. The orchestrator is loosely coupled to worker lifecycle.

2. **`Promise.all` for parallel waits**: All `step.waitForEvent` calls are dispatched simultaneously. Inngest registers all waits in parallel. As each `entity.completed` event arrives, the matching wait resolves. Total wall-clock time = longest worker, not sum of all workers.

3. **Timeout per work unit**: Each `waitForEvent` has a 4-hour timeout. If a worker crashes without emitting `entity.completed`, the wait times out and the orchestrator records a timeout failure. No hanging forever.

4. **Multi-resource enumeration**: `connection.resources.flatMap(resource => entityTypes.map(entityType => ...))` creates all (resource, entityType) pairs. A GitHub installation with 5 repos × 3 entity types = 15 work units. Vercel with 1 project × 1 entity type = 1 work unit.

5. **`since` computed once**: All work units share the same time window boundary. Prevents drift if workers start at different times.

6. **Orchestrator concurrency: 1 per installationId, 10 global**: One backfill per connection (no duplicates). 10 concurrent orchestrators (lightweight — just setup + wait). The real parallelism is at the entity worker tier.

7. **`timeouts.finish: "8h"`**: Orchestrator may wait for up to 8 hours. It consumes zero compute while waiting (paused between steps). This accommodates large multi-resource backfills with rate limiting.

#### 2. Update Inngest route registration
**File**: `apps/backfill/src/routes/inngest.ts`
**Changes**: Register both functions

```typescript
import { Hono } from "hono";
import { serve } from "inngest/hono";
import { inngest } from "../inngest/client";
import { backfillOrchestrator } from "../workflows/backfill-orchestrator";
import { backfillEntityWorker } from "../workflows/entity-worker";

const inngestRoute = new Hono();

inngestRoute.on(
  ["GET", "POST", "PUT"],
  "/",
  serve({
    client: inngest,
    functions: [backfillOrchestrator, backfillEntityWorker],
  }),
);

export { inngestRoute };
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm --filter @lightfast/backfill build` (or equivalent)

#### Manual Verification:
- [ ] Review `waitForEvent` matching — `if` expression uses full CEL: `async.data.installationId == '...' && async.data.resourceId == '...' && async.data.entityType == '...'` (note: `match` + `if` are mutually exclusive in Inngest SDK, using only `if`)
- [ ] Review timeout values — 4h per work unit, 8h orchestrator finish
- [ ] Verify that the `POST /trigger` endpoint still works unchanged (it sends `apps-backfill/run.requested` — same event name)
- [ ] Test with Inngest dev server: trigger a backfill, observe fan-out in dashboard

**Implementation Note**: The orchestrator + entity worker can be tested end-to-end via the Inngest dev dashboard by sending an `apps-backfill/run.requested` event. Verify the fan-out creates the expected number of entity worker runs. Pause for manual confirmation before proceeding.

---

## Phase 5: Drop XState & Cleanup

### Overview
Remove the XState machine, helpers, and all related imports. Update package.json to remove the XState dependency.

### Changes Required:

#### 1. Delete XState machine files
**Delete**: `apps/backfill/src/machine/backfill-machine.ts`
**Delete**: `apps/backfill/src/machine/helpers.ts`
**Delete**: `apps/backfill/src/machine/` directory

#### 2. Remove XState imports from orchestrator
**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts`
**Changes**: The rewrite in Phase 4 already removes all XState imports. Verify no residual imports exist:
- Remove `import { createActor } from "xstate"`
- Remove `import { backfillMachine } from "../machine/backfill-machine"`
- Remove `import { transitionMachine, readContext } from "../machine/helpers"`

#### 3. Remove XState from package.json
**File**: `apps/backfill/package.json`
**Changes**: Remove `xstate` from dependencies

```bash
cd apps/backfill && pnpm remove xstate
```

#### 4. Verify no remaining XState references
Run a grep to confirm no imports of `xstate`, `backfillMachine`, `transitionMachine`, or `readContext` remain in `apps/backfill/`.

### Success Criteria:

#### Automated Verification:
- [x] `apps/backfill/src/machine/` directory does not exist
- [x] No `xstate` in `apps/backfill/package.json`
- [x] No remaining imports of xstate or machine helpers: `grep -r "xstate\|backfillMachine\|transitionMachine\|readContext" apps/backfill/src/`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm --filter @lightfast/backfill build`

#### Manual Verification:
- [ ] Full end-to-end test: trigger a backfill via `POST /trigger`, observe orchestrator fan-out + entity worker pagination + completion events in Inngest dashboard
- [ ] Verify aggregate results in orchestrator's return value

**Implementation Note**: This is the final phase. After cleanup, the entire backfill system should be functional with the new event-driven architecture.

---

## Testing Strategy

### Integration Tests (Inngest Dev Server):
1. **Happy path**: Trigger `apps-backfill/run.requested` with a valid connection → orchestrator fans out → entity workers paginate → completion events → orchestrator aggregates and returns
2. **Single resource, single entity type**: Vercel connection (1 project × 1 deployment) — simplest case
3. **Multi-resource**: GitHub installation with 3 repos × 3 entity types = 9 work units — verify all 9 workers are dispatched and all 9 completion events arrive
4. **Cancellation**: Send `apps-backfill/run.cancelled` mid-backfill → verify both orchestrator and entity workers are cancelled
5. **Entity worker failure**: Simulate a connector error → verify the worker emits `entity.completed` with `success: false` → verify orchestrator records the failure in aggregate results
6. **Token expiration**: Simulate a 401 response from the provider API → verify the worker refreshes the token and retries within the same step

### Manual Testing Steps:
1. Start Inngest dev server: `pnpm dev:app`
2. Navigate to Inngest dashboard (http://localhost:8288)
3. Send test event: `apps-backfill/run.requested` with a valid `installationId`
4. Observe:
   - Orchestrator run appears with `get-connection` step
   - `fan-out-entity-workers` step dispatches N events
   - N entity worker runs appear
   - Each entity worker shows `get-token`, `fetch-*-p1`, `dispatch-*-p1`, etc.
   - Completion events arrive
   - Orchestrator aggregates and returns
5. Verify the aggregate result includes per-work-unit stats
6. Send `apps-backfill/run.cancelled` → verify all runs are cancelled

## Performance Considerations

### Step Budget
- **Orchestrator**: ~5 setup steps + 1 sendEvent + N waitForEvent steps = ~6 + N steps. For 15 work units: 21 steps. Well under 1000.
- **Entity worker**: 1 get-token + 2 steps/page (fetch + dispatch) + optional rate-limit sleeps + 1 sendEvent = ~3 + 2P steps. For 50 pages: 103 steps. Well under 1000.

### Concurrency Impact
- Current: 3 total concurrent backfills, sequential entity types → max 3 page-fetches at any time
- New: 30 global entity workers, 5 per installationId → max 30 page-fetches at any time (across different connections)
- Net effect: ~10x more throughput for multiple concurrent tenants, with per-tenant fairness

### Rate Limit Arithmetic
- GitHub: 5000 req/hr per installation token
- `throttle: { limit: 4000, period: "1h", key: installationId }` — leaves 1000 req/hr for real-time webhooks
- 5 concurrent workers × ~2 req/page (fetch + dispatch overhead) = ~10 req/cycle
- At ~1.1 req/sec throttle rate, workers naturally space out

### Wall-Clock Time
- Current (GitHub, 3 entity types, 50 pages each): ~30-60 min sequential
- New (3 entity types in parallel): ~10-20 min per entity type = 10-20 min total
- With multi-resource (5 repos × 3 entities, 5 concurrent): batches of 5, each ~10-20 min = ~30-60 min total for 15 work units
- Rate limiting is the bottleneck, not parallelism

## Migration Notes

- **No data migration needed**: The backfill service is standalone with no persistent state. Old XState snapshots are ephemeral (exist only during function execution).
- **DeliveryId format change**: New deliveryIds include `resourceId`. Re-running a backfill will produce new rows in `workspace-webhook-payloads` rather than deduplicating against old ones. This is acceptable and correct behavior.
- **No rollback needed**: The old monolithic orchestrator is simply replaced. If issues arise, revert the commit.
- **Inngest function ID change**: The orchestrator keeps `apps-backfill/run.orchestrator` (same ID). The entity worker is new: `apps-backfill/entity.worker`. Inngest handles new function registration automatically on deploy.

## Follow-up Work

### Webhook flow gate (event type selector)
Gateway's webhook delivery flow should check whether the event type is enabled for the workspace before pushing to Console (where observation.capture starts). Raw webhook data is always stored in Gateway's DB regardless. This gate applies to both live webhooks and backfill — single control point. If a user re-enables an event type later, data can be replayed from Gateway's DB. This saves Inngest steps by not triggering observation.capture for disabled event types.

### DB-level dedup on deliveryId
Gateway currently deduplicates on deliveryId via Redis SET NX (24h TTL). This is sufficient for normal operation since backfill deliveryIds are deterministic — re-runs within 24h are idempotent. For robustness, add a unique constraint on deliveryId in Gateway's webhook payload storage so re-runs after 24h are also idempotent. Low priority — worst case is duplicate rows, not data loss.

### Progress visibility
User has no way to know if backfill is running/done/failed. Future work.

### Ordering
Parallel workers mean events may arrive at Console out of order. Observation.capture should handle this — not backfill's concern.

## References

- Research: `thoughts/shared/research/2026-02-25-backfill-orchestrator-event-driven-refactor.md`
- Architecture decision: `thoughts/shared/research/2026-02-25-backfill-architecture-decision.md`
- Extraction plan: `thoughts/shared/plans/2026-02-25-backfill-service-extraction.md`
- Inngest docs (fan-out): https://www.inngest.com/docs/guides/step-parallelism
- Inngest docs (concurrency): https://www.inngest.com/docs/guides/concurrency
- Inngest docs (waitForEvent): https://www.inngest.com/docs/reference/functions/step-wait-for-event
- Inngest docs (cancelOn): https://www.inngest.com/docs/features/inngest-functions/cancellation/cancel-on-events
- Inngest queue fairness: https://www.inngest.com/blog/building-the-inngest-queue-pt-i-fairness-multi-tenancy

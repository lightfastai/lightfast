---
date: 2026-03-19
topic: "Neural Pipeline Port to Memory — move event processing pipeline from console to memory service"
tags: [plan, memory, inngest, neural-pipeline, port, event-processing, entity-graph, entity-embed, notifications]
status: draft
dependencies:
  - "apps/memory shell + @api/memory foundation"
  - "@repo/inngest shared package (cross-app event bus)"
---

# Neural Pipeline Port to Memory

## Overview

Move the entire event processing pipeline (4 Inngest functions + supporting libraries) from `api/console` and `apps/console` into the new `api/memory` package and `apps/memory` Next.js app. Additionally, create a new `ingestDelivery` Inngest function that replaces the relay Upstash Workflow + QStash + console ingress Upstash Workflow chain with a single Inngest function.

### What Moves

| Source | Destination | Description |
|--------|-------------|-------------|
| `api/console/src/inngest/workflow/neural/event-store.ts` | `api/memory/src/inngest/functions/memory-event-store.ts` | Event pipeline fast path (store facts + entities) |
| `api/console/src/inngest/workflow/neural/entity-graph.ts` | `api/memory/src/inngest/functions/memory-entity-graph.ts` | Entity edge resolution via co-occurrence |
| `api/console/src/inngest/workflow/neural/entity-embed.ts` | `api/memory/src/inngest/functions/memory-entity-embed.ts` | Narrative embed to Pinecone |
| `api/console/src/inngest/workflow/notifications/dispatch.ts` | `api/memory/src/inngest/functions/memory-notification-dispatch.ts` | High-significance event notifications via Knock |
| `api/console/src/inngest/workflow/neural/on-failure-handler.ts` | `api/memory/src/inngest/on-failure-handler.ts` | Shared onFailure handler factory |
| `api/console/src/inngest/workflow/neural/scoring.ts` | `api/memory/src/lib/scoring.ts` | Significance scoring (pure, no DB) |
| `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts` | `api/memory/src/lib/entity-extraction-patterns.ts` | Entity extraction from text + relations |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts` | `api/memory/src/lib/edge-resolver.ts` | Co-occurrence edge resolver (DB) |
| `api/console/src/inngest/workflow/neural/narrative-builder.ts` | `api/memory/src/lib/narrative-builder.ts` | Entity narrative construction |
| `api/console/src/lib/jobs.ts` | `api/memory/src/lib/jobs.ts` | Job tracking utilities |
| `apps/console/src/app/api/gateway/ingress/_lib/transform.ts` | `api/memory/src/lib/transform.ts` | Webhook envelope transformation |
| `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` | Integrated into `ingestDelivery` | Inngest event emission (no longer separate) |
| (NEW) | `api/memory/src/inngest/functions/ingest-delivery.ts` | Replaces relay workflow + QStash + console ingress |

### What Stays in Console

| File | Why |
|------|-----|
| `api/console/src/inngest/workflow/infrastructure/record-activity.ts` | UI-triggered, batched — console-only concern |
| `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` (`publishEventNotification`) | Upstash Realtime SSE — UI-facing, stays in console |
| `api/console/src/lib/activity.ts` | Activity recording helper — console-only |

### Event Rename Map

| Old Event Name | New Event Name |
|---------------|----------------|
| `console/event.capture` | `memory/event.capture` |
| `console/event.stored` | `memory/event.stored` |
| `console/entity.upserted` | `memory/entity.upserted` |
| `console/entity.graphed` | `memory/entity.graphed` |
| `console/activity.record` | `console/activity.record` (UNCHANGED) |

### New Events

| Event Name | Description |
|-----------|-------------|
| `memory/webhook.received` | Trigger for `ingestDelivery` (replaces relay workflow + QStash chain) |

---

## Current State Analysis

### Event Flow (Today)

```
External webhook
  -> POST /webhooks/:provider (relay Hono)
    -> HMAC verify -> persist delivery -> Upstash Workflow (5 steps)
      -> resolve-connection (DB JOIN) -> route -> publish-to-console via QStash
        -> Console ingress (Upstash Workflow, 2 steps)
          -> resolve-workspace -> transform-store-and-fan-out
            -> inngest.send("console/event.capture")
            -> publishEventNotification (Upstash Realtime SSE)

console/event.capture
  -> eventStore: generate-ids -> resolve-clerk-org -> create-job -> check-duplicate
    -> check-event-allowed (Gate 2) -> evaluate-significance -> extract-entities
    -> store-observation -> upsert-entities-and-junctions
    -> emit: console/entity.upserted + console/event.stored

console/entity.upserted -> entityGraph: resolve-edges -> emit: console/entity.graphed
console/entity.graphed -> entityEmbed: (debounced 30s) fetch -> embed -> Pinecone upsert
console/event.stored -> notificationDispatch: (if score >= 70) -> Knock workflow
```

**Problems with current flow:**
1. 3 durable execution systems (Upstash Workflow in relay, Upstash Workflow in console ingress, Inngest for neural pipeline)
2. QStash as inter-service glue adds latency and complexity
3. Webhook transform logic buried in Next.js API route handler
4. Neural pipeline functions are console concerns but should be memory concerns

### Event Flow (After Port)

```
External webhook
  -> POST /webhooks/:provider (relay Hono, unchanged)
    -> HMAC verify -> persist delivery -> inngest.send("memory/webhook.received")

memory/webhook.received
  -> ingestDelivery (single Inngest function):
    -> resolve-connection (DB JOIN) -> resolve-workspace -> transform payload
    -> store ingest log -> inngest.send("memory/event.capture")
    -> publishEventNotification (Upstash Realtime SSE) [kept for console UI]

memory/event.capture
  -> memoryEventStore: [same steps, renamed IDs]
    -> emit: memory/entity.upserted + memory/event.stored

memory/entity.upserted -> memoryEntityGraph -> emit: memory/entity.graphed
memory/entity.graphed -> memoryEntityEmbed -> Pinecone
memory/event.stored -> memoryNotificationDispatch -> Knock
```

**Improvements:**
1. Single durable execution system (Inngest only)
2. No QStash inter-service glue
3. 7 relay workflow steps + 2 console ingress steps collapsed into 1 Inngest function with ~5 steps
4. Memory pipeline is self-contained in `api/memory`

### Key Dependencies to Port

Each ported function imports from these packages. All are available to `api/memory` via `workspace:*`:

| Package | Used By |
|---------|---------|
| `@db/console/client` | All functions (DB queries) |
| `@db/console/schema` | All functions (table references) |
| `@repo/console-providers` | eventStore (deriveObservationType, getBaseEventType), transform |
| `@repo/console-providers/contracts` | transform (WebhookEnvelope, PostTransformEvent) |
| `@repo/console-validation` | eventStore, on-failure-handler (type definitions) |
| `@repo/console-embed` | entityEmbed (embedding provider) |
| `@repo/console-pinecone` | entityEmbed (vector upsert) |
| `@repo/inngest` | All functions (NonRetriableError, event schemas) |
| `@vendor/observability/log/next` | All functions (structured logging) |
| `@vendor/knock` | notificationDispatch (Knock client) |

---

## Phase 1: Event Schema Migration in `@repo/inngest`

### Overview

Add `memory/*` events to the shared Inngest schema package. Keep `console/*` neural events temporarily as aliases during the transition.

### Changes Required

#### 1. Create `packages/inngest/src/schemas/memory.ts`

New file defining all memory event schemas:

```typescript
import { postTransformEventSchema } from "@repo/console-providers/contracts";
import { ingestionSourceSchema } from "@repo/console-validation";
import { z } from "zod";

export const memoryEvents = {
  "memory/webhook.received": z.object({
    provider: z.string(),
    deliveryId: z.string(),
    eventType: z.string(),
    resourceId: z.string().nullable(),
    payload: z.unknown(),
    receivedAt: z.number(),
    correlationId: z.string().optional(),
    // Pre-resolved connection info (from relay service auth path)
    preResolved: z
      .object({
        connectionId: z.string(),
        orgId: z.string(),
      })
      .optional(),
  }),
  "memory/event.capture": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string().optional(),
    sourceEvent: postTransformEventSchema,
    ingestionSource: ingestionSourceSchema.optional(),
    ingestLogId: z.number().optional(),
    correlationId: z.string().optional(),
  }),
  "memory/event.stored": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string(),
    eventExternalId: z.string(),
    sourceType: z.string(),
    significanceScore: z.number(),
  }),
  "memory/entity.upserted": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    internalEventId: z.number(),
    entityRefs: z.array(
      z.object({
        type: z.string(),
        key: z.string(),
        label: z.string().nullable(),
      })
    ),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
  "memory/entity.graphed": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
};
```

#### 2. Update `packages/inngest/src/index.ts`

Add memory events to the merged export:

```typescript
import { backfillEvents } from "./schemas/backfill.js";
import { consoleEvents } from "./schemas/console.js";
import { memoryEvents } from "./schemas/memory.js";
import { platformEvents } from "./schemas/platform.js";

export { platformEvents, consoleEvents, memoryEvents, backfillEvents };

export const allEvents = {
  ...platformEvents,
  ...consoleEvents,
  ...memoryEvents,
  ...backfillEvents,
} as const;
```

#### 3. Remove neural events from `packages/inngest/src/schemas/console.ts`

Strip `console/event.capture`, `console/event.stored`, `console/entity.upserted`, `console/entity.graphed` from console schemas. Only `console/activity.record` remains:

```typescript
export const consoleEvents = {
  "console/activity.record": z.object({
    workspaceId: z.string(),
    category: z.enum([...]),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    relatedActivityId: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
};
```

### Success Criteria

- [ ] `pnpm --filter @repo/inngest typecheck` passes
- [ ] `pnpm --filter @repo/inngest build` succeeds
- [ ] All `memory/*` events are typed in the `allEvents` export
- [ ] `console/activity.record` is unchanged

---

## Phase 2: Create `api/memory` Package + Inngest Client

### Overview

Scaffold the `api/memory` package following the `@api/console` pattern. Create the Inngest client instance.

### Changes Required

#### 1. Create `api/memory/package.json`

Follow the `@api/console` pattern:

```json
{
  "name": "@api/memory",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
    "./inngest": { "types": "./dist/inngest/index.d.ts", "default": "./src/inngest/index.ts" }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@db/console": "workspace:*",
    "@repo/console-embed": "workspace:*",
    "@repo/console-pinecone": "workspace:*",
    "@repo/console-providers": "workspace:*",
    "@repo/console-validation": "workspace:*",
    "@repo/inngest": "workspace:*",
    "@vendor/inngest": "workspace:*",
    "@vendor/knock": "workspace:*",
    "@vendor/observability": "workspace:*",
    "drizzle-orm": "catalog:",
    "inngest": "catalog:",
    "nanoid": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

#### 2. Create `api/memory/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

#### 3. Create `api/memory/turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tags": ["api"],
  "tasks": {}
}
```

#### 4. Create `api/memory/src/inngest/client.ts`

```typescript
import type { GetEvents } from "@repo/inngest/client";
import { createInngestClient } from "@repo/inngest/client";
import { env } from "@vendor/inngest/env";

const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  withSentry: true,
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

### Success Criteria

- [ ] `pnpm install` resolves all workspace dependencies
- [ ] `pnpm --filter @api/memory typecheck` passes
- [ ] Inngest client creates successfully with all events typed

---

## Phase 3: Port Supporting Libraries

### Overview

Copy the pure-logic libraries that the Inngest functions depend on. These have no Inngest dependency themselves.

### Changes Required

#### 1. `api/memory/src/lib/scoring.ts`

Copy from `api/console/src/inngest/workflow/neural/scoring.ts`. No changes needed -- it imports from `@repo/console-providers` and `@repo/console-validation`, both available to `@api/memory`.

#### 2. `api/memory/src/lib/entity-extraction-patterns.ts`

Copy from `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`. No changes needed -- imports only from `@repo/console-validation`.

#### 3. `api/memory/src/lib/edge-resolver.ts`

Copy from `api/console/src/inngest/workflow/neural/edge-resolver.ts`. No changes needed -- imports from `@db/console`, `@repo/console-providers`, `@vendor/observability`, `drizzle-orm`, `nanoid`.

#### 4. `api/memory/src/lib/narrative-builder.ts`

Copy from `api/console/src/inngest/workflow/neural/narrative-builder.ts`. No changes needed -- pure function, imports only `node:crypto`.

#### 5. `api/memory/src/lib/jobs.ts`

Copy from `api/console/src/lib/jobs.ts`. No changes needed -- imports from `@db/console`, `@repo/console-validation`, `@vendor/observability`, `drizzle-orm`.

#### 6. `api/memory/src/lib/transform.ts`

Copy from `apps/console/src/app/api/gateway/ingress/_lib/transform.ts`. No changes needed -- imports from `@repo/console-providers` and `@repo/console-providers/contracts`.

#### 7. `api/memory/src/inngest/on-failure-handler.ts`

Copy from `api/console/src/inngest/workflow/neural/on-failure-handler.ts`. Update imports:
- `completeJob`, `getJobByInngestRunId` from `../../lib/jobs` (relative path change)
- `Events` type from `../client` (was `../../client/client`)

### Success Criteria

- [ ] `pnpm --filter @api/memory typecheck` passes for all lib files
- [ ] No import resolution errors

---

## Phase 4: Port Inngest Functions

### Overview

Port the 4 neural pipeline functions with event name renames. Each function changes its ID and event trigger from `console/*` to `memory/*`.

### 4.1: `memory-event-store.ts`

**Source**: `api/console/src/inngest/workflow/neural/event-store.ts`
**Destination**: `api/memory/src/inngest/functions/memory-event-store.ts`

Changes from the original:
1. **Function ID**: `"console/event.store"` -> `"memory/event.store"`
2. **Trigger event**: `"console/event.capture"` -> `"memory/event.capture"`
3. **Emitted events**: `"console/entity.upserted"` -> `"memory/entity.upserted"`, `"console/event.stored"` -> `"memory/event.stored"`
4. **Import paths**: Update relative imports to new locations:
   - `inngest` from `../client` (was `../../client/client`)
   - `completeJob`, `createJob`, `updateJobStatus` from `../../lib/jobs` (was `../../../lib/jobs`)
   - `extractEntities`, `extractFromRelations` from `../../lib/entity-extraction-patterns`
   - `createNeuralOnFailureHandler` from `../on-failure-handler`
   - `scoreSignificance` from `../../lib/scoring`
5. **onFailure handler**: Update event name reference from `"console/event.capture"` to `"memory/event.capture"`
6. **Job inngestFunctionId**: Update from `"event.capture"` to `"memory/event.capture"` for consistency

### 4.2: `memory-entity-graph.ts`

**Source**: `api/console/src/inngest/workflow/neural/entity-graph.ts`
**Destination**: `api/memory/src/inngest/functions/memory-entity-graph.ts`

Changes:
1. **Function ID**: `"console/entity.graph"` -> `"memory/entity.graph"`
2. **Trigger event**: `"console/entity.upserted"` -> `"memory/entity.upserted"`
3. **Emitted event**: `"console/entity.graphed"` -> `"memory/entity.graphed"`
4. **Import paths**: `inngest` from `../client`, `resolveEdges` from `../../lib/edge-resolver`

### 4.3: `memory-entity-embed.ts`

**Source**: `api/console/src/inngest/workflow/neural/entity-embed.ts`
**Destination**: `api/memory/src/inngest/functions/memory-entity-embed.ts`

Changes:
1. **Function ID**: `"console/entity.embed"` -> `"memory/entity.embed"`
2. **Trigger event**: `"console/entity.graphed"` -> `"memory/entity.graphed"`
3. **Import paths**: `inngest` from `../client`, `buildEntityNarrative`/`narrativeHash` from `../../lib/narrative-builder`

Note: entityEmbed has a 30s debounce per `entityExternalId` and uses `@repo/console-embed` + `@repo/console-pinecone`. Both packages are already workspace dependencies.

### 4.4: `memory-notification-dispatch.ts`

**Source**: `api/console/src/inngest/workflow/notifications/dispatch.ts`
**Destination**: `api/memory/src/inngest/functions/memory-notification-dispatch.ts`

Changes:
1. **Function ID**: `"console/notification.dispatch"` -> `"memory/notification.dispatch"`
2. **Trigger event**: `"console/event.stored"` -> `"memory/event.stored"`
3. **Import paths**: `inngest` from `../client`

Note: Significance threshold is 70 (score >= 70 triggers Knock workflow). Uses `@vendor/knock`.

### Success Criteria

- [ ] `pnpm --filter @api/memory typecheck` passes for all 4 functions
- [ ] All function IDs use `memory/` prefix
- [ ] All trigger events use `memory/` prefix
- [ ] All emitted events use `memory/` prefix

---

## Phase 5: Create `ingestDelivery` Inngest Function (NEW)

### Overview

This is the key architectural change. `ingestDelivery` replaces the relay Upstash Workflow (5 steps) + QStash dispatch + console ingress Upstash Workflow (2 steps) with a single Inngest function.

**Source**: `apps/relay/src/routes/workflows.ts` (relay workflow) + `apps/console/src/app/api/gateway/ingress/route.ts` (console ingress)
**Destination**: `api/memory/src/inngest/functions/ingest-delivery.ts`

### Function Specification

```
Function ID: "memory/ingest.delivery"
Trigger: "memory/webhook.received"
Concurrency: { limit: 20, key: "event.data.provider" }
Retries: 3
Timeouts: { start: "1m", finish: "3m" }
```

### Step-by-Step Design

**Step 1: `resolve-connection`**

Replaces relay workflow step 2 (`resolve-connection`) with the same DB JOIN:

```typescript
const connectionInfo = await step.run("resolve-connection", async () => {
  if (data.preResolved) {
    return data.preResolved;  // Backfill service auth path (already resolved)
  }
  if (!data.resourceId) {
    return null;
  }
  // Same JOIN as relay workflows.ts:67-83
  const rows = await db
    .select({ installationId: gatewayResources.installationId, orgId: gatewayInstallations.orgId })
    .from(gatewayResources)
    .innerJoin(gatewayInstallations, eq(gatewayResources.installationId, gatewayInstallations.id))
    .where(and(
      eq(gatewayResources.providerResourceId, data.resourceId),
      eq(gatewayResources.status, "active")
    ))
    .limit(1);
  return rows[0] ? { connectionId: rows[0].installationId, orgId: rows[0].orgId } : null;
});
```

If `connectionInfo` is null, throw `NonRetriableError("no_connection")`. The relay DLQ path is handled separately (relay persists to DLQ before sending the Inngest event, or we add a DLQ step here).

**Step 2: `resolve-workspace`**

Replaces console ingress step 1. Looks up workspace from Clerk org ID:

```typescript
const workspace = await step.run("resolve-workspace", async () => {
  const row = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.clerkOrgId, connectionInfo.orgId),
    columns: { id: true, name: true, clerkOrgId: true },
  });
  if (!row) return null;
  return { workspaceId: row.id, workspaceName: row.name, clerkOrgId: row.clerkOrgId };
});
```

If workspace is null, throw `NonRetriableError("unknown_org")`.

**Step 3: `transform-and-store`**

Replaces console ingress step 2 (transform + DB insert):

```typescript
const result = await step.run("transform-and-store", async () => {
  const rawEvent = transformEnvelope({
    provider: data.provider,
    eventType: data.eventType,
    payload: data.payload,
    deliveryId: data.deliveryId,
    receivedAt: data.receivedAt,
    // orgId and connectionId are needed for WebhookEnvelope shape:
    orgId: connectionInfo.orgId,
    connectionId: connectionInfo.connectionId,
  });

  if (!rawEvent) {
    return { status: "unsupported" as const };
  }

  const sourceEvent = sanitizePostTransformEvent(rawEvent);

  const [record] = await db
    .insert(workspaceIngestLogs)
    .values({
      workspaceId: workspace.workspaceId,
      deliveryId: data.deliveryId,
      sourceEvent,
      receivedAt: new Date(data.receivedAt).toISOString(),
      ingestionSource: "webhook",
    })
    .returning({ id: workspaceIngestLogs.id });

  if (!record) throw new Error("Failed to insert ingest log");

  return { status: "transformed" as const, sourceEvent, ingestLogId: record.id };
});
```

If `result.status === "unsupported"`, return early (no downstream events).

**Step 4: `emit-event-capture`**

Sends `memory/event.capture` to trigger the neural pipeline:

```typescript
await step.sendEvent("emit-event-capture", {
  name: "memory/event.capture" as const,
  data: {
    workspaceId: workspace.workspaceId,
    clerkOrgId: workspace.clerkOrgId,
    sourceEvent: result.sourceEvent,
    ingestionSource: "webhook",
    ingestLogId: result.ingestLogId,
    correlationId: data.correlationId,
  },
});
```

**Step 5: `publish-realtime`**

Publishes to Upstash Realtime for console SSE (this stays because it is UI-facing):

```typescript
await step.run("publish-realtime", async () => {
  const channel = realtime.channel(`org-${connectionInfo.orgId}`);
  await channel.emit("workspace.event", {
    eventId: result.ingestLogId,
    workspaceId: workspace.workspaceId,
    sourceEvent: result.sourceEvent,
  });
});
```

### What This Replaces

| Old Component | Steps | New Equivalent |
|--------------|-------|----------------|
| Relay Upstash Workflow (`workflows.ts`) | persist-delivery, resolve-connection, route, publish-to-console, update-status-enqueued (5 steps) | `ingestDelivery` steps 1-2 (resolve-connection, resolve-workspace) |
| QStash dispatch (relay -> console) | 1 HTTP call with retries | Eliminated (Inngest handles durability) |
| Console ingress Upstash Workflow (`ingress/route.ts`) | resolve-workspace, transform-store-and-fan-out (2 steps) | `ingestDelivery` steps 2-5 |

**Net reduction**: 5 + 1 + 2 = 8 external durable steps -> 5 Inngest steps in one function.

### DLQ Handling

The relay currently sends unresolvable webhooks to a QStash DLQ topic. In the new design:
- Relay still persists the webhook delivery to `gatewayWebhookDeliveries` table BEFORE sending the Inngest event
- If `ingestDelivery` fails to resolve a connection, the NonRetriableError is logged by Inngest
- The existing `gatewayWebhookDeliveries` table with `status: "received"` (never progressed to "enqueued") serves as the DLQ
- Admin replay routes can re-trigger by sending a new `memory/webhook.received` event

### Success Criteria

- [ ] `pnpm --filter @api/memory typecheck` passes
- [ ] Function handles both standard path (resourceId-based resolution) and service auth path (preResolved)
- [ ] Unsupported event types return early without sending downstream events
- [ ] Realtime SSE notification fires for console UI

---

## Phase 6: Register Functions in `apps/memory` Inngest Route

### Overview

Create the Inngest serve endpoint in the memory app that registers all 5 functions.

### Changes Required

#### 1. Create `api/memory/src/inngest/index.ts`

```typescript
import { serve } from "inngest/next";
import { inngest } from "./client";
import { ingestDelivery } from "./functions/ingest-delivery";
import { memoryEntityEmbed } from "./functions/memory-entity-embed";
import { memoryEntityGraph } from "./functions/memory-entity-graph";
import { memoryEventStore } from "./functions/memory-event-store";
import { memoryNotificationDispatch } from "./functions/memory-notification-dispatch";

export { inngest };
export { ingestDelivery, memoryEventStore, memoryEntityGraph, memoryEntityEmbed, memoryNotificationDispatch };

/**
 * Create the route context for Next.js API routes
 *
 * Registered functions:
 * 1. ingestDelivery - Webhook delivery -> transform -> emit event.capture
 * 2. memoryEventStore - Event pipeline fast path (store facts + entities)
 * 3. memoryEntityGraph - Entity edge resolution via co-occurrence
 * 4. memoryEntityEmbed - Entity narrative embed to Pinecone layer="entities"
 * 5. memoryNotificationDispatch - High-significance event notifications via Knock
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [
      ingestDelivery,
      memoryEventStore,
      memoryEntityGraph,
      memoryEntityEmbed,
      memoryNotificationDispatch,
    ],
    servePath: "/api/inngest",
  });
}
```

#### 2. Create `api/memory/src/index.ts`

Public API surface:

```typescript
export { createInngestRouteContext, inngest } from "./inngest";
```

#### 3. Create `apps/memory/src/app/api/inngest/route.ts`

```typescript
import { createInngestRouteContext } from "@api/memory/inngest";

const context = createInngestRouteContext();

export const { GET, POST, PUT } = context;
```

### Success Criteria

- [ ] `pnpm --filter apps/memory typecheck` passes
- [ ] All 5 functions registered in the serve endpoint
- [ ] `pnpm dev:memory` starts and Inngest dashboard shows 5 registered functions

---

## Phase 7: Update Relay to Emit `memory/webhook.received`

### Overview

Replace the Upstash Workflow trigger in relay with an Inngest event send. This is the switchover point.

### Changes Required

#### 1. Update `apps/relay/src/routes/webhooks.ts`

**Standard path** (external webhooks): Replace Upstash Workflow trigger with Inngest event:

```typescript
// Before:
await workflowClient.trigger({
  url: `${relayBaseUrl}/workflows/webhook-delivery`,
  body: JSON.stringify(workflowPayload),
  headers: { "Content-Type": "application/json" },
});

// After:
await inngest.send({
  name: "memory/webhook.received",
  data: {
    provider: providerName,
    deliveryId,
    eventType,
    resourceId,
    payload: parsedPayload,
    receivedAt: Date.now(),
    correlationId: c.get("correlationId"),
  },
});
```

**Service auth path** (backfill): Replace QStash publish with Inngest event:

```typescript
// Before:
await getQStashClient().publishJSON({
  url: `${consoleUrl}/api/gateway/ingress`,
  headers: { "X-Correlation-Id": correlationId },
  body: { ... } satisfies WebhookEnvelope,
  retries: 5,
});

// After:
await inngest.send({
  name: "memory/webhook.received",
  data: {
    provider: providerName,
    deliveryId,
    eventType,
    resourceId: null,
    payload: parsedPayload,
    receivedAt: body.receivedAt,
    correlationId,
    preResolved: {
      connectionId: body.connectionId,
      orgId: body.orgId,
    },
  },
});
```

#### 2. Add Inngest client to relay

Either import from a relay-local client or use the shared factory:

```typescript
// apps/relay/src/inngest/client.ts
import { createInngestClient } from "@repo/inngest/client";
import { env } from "../env.js";

export const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
});
```

Note: Relay may already have an Inngest client if the Hono-tRPC migration has happened. If not, add `@repo/inngest` as a dependency.

#### 3. Remove unused relay imports

After switchover:
- Remove `workflowClient` import from `@vendor/upstash-workflow/client`
- Remove `consoleUrl`, `relayBaseUrl` from `../lib/urls.js` (if no longer needed)
- Remove `getQStashClient` from `@vendor/qstash` (if no longer used in webhooks.ts)

#### 4. Remove relay workflow route

`apps/relay/src/routes/workflows.ts` — the entire file can be deleted since the Upstash Workflow is no longer triggered.

Remove the workflow route mount from `apps/relay/src/app.ts`:
```typescript
// Remove: app.route("/workflows", workflows);
```

### Success Criteria

- [ ] `pnpm build:relay` succeeds
- [ ] Standard webhooks trigger `memory/webhook.received` instead of Upstash Workflow
- [ ] Service auth webhooks trigger `memory/webhook.received` instead of QStash
- [ ] No remaining references to the console ingress URL in relay

---

## Phase 8: Remove Neural Pipeline from Console

### Overview

Remove the ported functions and their supporting code from console. Update the console Inngest serve endpoint.

### Changes Required

#### 1. Remove neural workflow files

Delete the following files:
- `api/console/src/inngest/workflow/neural/event-store.ts`
- `api/console/src/inngest/workflow/neural/entity-graph.ts`
- `api/console/src/inngest/workflow/neural/entity-embed.ts`
- `api/console/src/inngest/workflow/neural/on-failure-handler.ts`
- `api/console/src/inngest/workflow/neural/scoring.ts`
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`
- `api/console/src/inngest/workflow/neural/edge-resolver.ts`
- `api/console/src/inngest/workflow/neural/narrative-builder.ts`
- `api/console/src/inngest/workflow/neural/index.ts`
- `api/console/src/inngest/workflow/notifications/dispatch.ts`
- `api/console/src/inngest/workflow/notifications/index.ts`

#### 2. Remove console ingress route

Delete:
- `apps/console/src/app/api/gateway/ingress/route.ts`
- `apps/console/src/app/api/gateway/ingress/_lib/transform.ts`

Keep (if it has other consumers) or delete:
- `apps/console/src/app/api/gateway/ingress/_lib/notify.ts`
  - `publishInngestNotification` is replaced by `ingestDelivery`
  - `publishEventNotification` (Upstash Realtime) is moved into `ingestDelivery` step 5
  - If no other file imports from `notify.ts`, delete it entirely

#### 3. Update console Inngest serve

`api/console/src/inngest/index.ts` — Remove neural and notification functions:

```typescript
import { serve } from "inngest/next";
import { inngest } from "./client/client";
import { recordActivity } from "./workflow/infrastructure/record-activity";

export { inngest };
export { recordActivity };

/**
 * Create the route context for Next.js API routes
 *
 * Registered functions:
 * 1. recordActivity - Activity logging (batched)
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [recordActivity],
    servePath: "/api/inngest",
  });
}
```

#### 4. Verify no dangling imports

Search all `api/console/` and `apps/console/` files for references to deleted modules:
- `from.*neural`
- `from.*notifications/dispatch`
- `from.*gateway/ingress`
- `console/event.capture`
- `console/event.stored`
- `console/entity.upserted`
- `console/entity.graphed`

#### 5. Remove unused `api/console/src/lib/jobs.ts` import check

If `jobs.ts` is ONLY used by neural pipeline functions and `recordActivity` does not use it, delete it from console. If `recordActivity` or other console code uses it, keep it.

### Success Criteria

- [ ] `pnpm --filter @api/console typecheck` passes
- [ ] `pnpm build:console` succeeds
- [ ] Console Inngest dashboard shows only `recordActivity`
- [ ] No 404s from console ingress route (relay no longer calls it)

---

## Phase 9: End-to-End Verification

### Manual Testing

1. **Full webhook flow**: Send a test webhook via ngrok -> relay -> verify `memory/webhook.received` fires -> verify `ingestDelivery` processes -> verify event appears in DB + Pinecone

2. **Backfill flow**: Trigger a backfill from console -> entity worker dispatches to relay -> relay sends `memory/webhook.received` with `preResolved` -> verify events stored

3. **Notification flow**: Send a webhook that scores >= 70 significance -> verify Knock notification fires

4. **Duplicate handling**: Send the same webhook twice -> verify second is filtered as duplicate

5. **Gate 2 filtering**: Send webhook for an inactive integration -> verify event is filtered

6. **Entity embed debounce**: Send 5 rapid events for the same entity -> verify only 1 embed call fires after 30s

7. **Console SSE**: Open console UI -> send webhook -> verify real-time event notification appears

### Automated Verification

```bash
pnpm typecheck             # All packages
pnpm check                 # No lint errors
pnpm build:console         # Console builds without neural pipeline
pnpm build:relay           # Relay builds without Upstash Workflow
pnpm --filter @api/memory typecheck  # Memory package types
```

### Inngest Dashboard Verification

| App | Expected Functions |
|-----|-------------------|
| memory | ingestDelivery, memoryEventStore, memoryEntityGraph, memoryEntityEmbed, memoryNotificationDispatch |
| console | recordActivity |
| backfill | backfillOrchestrator, backfillEntityWorker |

---

## Risk Assessment

### Dual-Write Period

Between Phase 7 (relay switchover) and Phase 8 (console cleanup), both the old and new paths must work. The old console ingress route will still exist but receive no traffic since relay now sends to Inngest instead of QStash.

**Mitigation**: Phase 7 and Phase 8 can be deployed together. The relay switchover and console cleanup are independent operations -- relay sends to Inngest, console no longer receives from QStash. There is no window where both paths need to work simultaneously.

### Inngest Function ID Migration

Renaming function IDs from `console/*` to `memory/*` means Inngest sees them as new functions. Any in-flight `console/*` events will not be processed by the new `memory/*` functions.

**Mitigation**: Deploy memory functions BEFORE deploying the relay switchover. During the gap, console functions still process `console/*` events. Once all in-flight events have drained (typically < 5 minutes), deploy the relay switchover (Phase 7) + console cleanup (Phase 8).

### Upstash Realtime Dependency

The `publishEventNotification` SSE notification must continue working for console UI. It is moved into `ingestDelivery` step 5.

**Mitigation**: `@repo/console-upstash-realtime` is added as a dependency of `@api/memory`. The `realtime.channel().emit()` call is identical.

---

## Code References

### Source Files (to port from)
- `api/console/src/inngest/workflow/neural/event-store.ts` -- 616 lines, 11 steps
- `api/console/src/inngest/workflow/neural/entity-graph.ts` -- 61 lines, 2 steps
- `api/console/src/inngest/workflow/neural/entity-embed.ts` -- 272 lines, 4 steps
- `api/console/src/inngest/workflow/neural/on-failure-handler.ts` -- 96 lines
- `api/console/src/inngest/workflow/neural/scoring.ts` -- 133 lines
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts` -- 221 lines
- `api/console/src/inngest/workflow/neural/edge-resolver.ts` -- 342 lines
- `api/console/src/inngest/workflow/neural/narrative-builder.ts` -- 103 lines
- `api/console/src/inngest/workflow/notifications/dispatch.ts` -- 64 lines
- `api/console/src/lib/jobs.ts` -- 277 lines
- `apps/console/src/app/api/gateway/ingress/route.ts` -- 137 lines
- `apps/console/src/app/api/gateway/ingress/_lib/transform.ts` -- 24 lines
- `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` -- 54 lines
- `apps/relay/src/routes/workflows.ts` -- 237 lines

### Schema Files
- `packages/inngest/src/schemas/console.ts` -- Current neural event schemas
- `packages/inngest/src/schemas/platform.ts` -- Platform event schemas (unchanged)
- `packages/inngest/src/schemas/backfill.ts` -- Backfill event schemas (unchanged)

### Research
- `thoughts/shared/research/2026-03-19-platform-trpc-architecture-patterns.md` -- Complete architecture analysis
- `thoughts/shared/research/2026-03-19-repo-inngest-shared-client-schema-analysis.md` -- Inngest shared package analysis

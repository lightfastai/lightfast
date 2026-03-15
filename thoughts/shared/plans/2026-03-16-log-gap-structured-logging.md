---
date: 2026-03-16T00:00:00+11:00
author: claude
git_commit: 769df1b5ff96c3d36dd7b61b02689b7fad22cb2c
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Structured logging — fix remaining gaps + add happy-path breadcrumbs"
tags: [plan, observability, logging, betterstack, relay, backfill, console]
status: active
---

# Structured Logging — Gaps + Happy-Path Breadcrumbs

## Overview

The branch has already migrated most error-state `console.*` calls to structured `log.*`. What remains is:
1. Two `console.error` calls in `linkVercelProject` (trivial fix)
2. Zero happy-path logs across the entire pipeline — the flow is completely silent on success, making `pnpm dev:log` nearly useless for tracing a working run

This plan adds the breadcrumbs needed so reading `/tmp/lightfast-dev.log` tells a complete story from source link → backfill → relay → ingress.

## Current State

**Already done on this branch:**
- `notifyBackfill` — fully on `log.info/error` with `correlationId`
- `bulkLinkResources` gateway failures — `log.error`
- `bulkLinkResources` correlationId generation before `notifyBackfill`
- `backfill-orchestrator.ts` — `log` imported, error/warn states covered
- `entity-worker.ts` — `log` imported, MAX_PAGES warn covered
- `relay/admin.ts` — delivery-status on `log.warn/info`
- `relay/webhooks.ts` — clean
- `relay/workflows.ts` — clean
- `ingress/route.ts` — `log` imported, unknown orgId + no-transformer covered

**Still remaining:**
- `workspace.ts:564, 614` — `linkVercelProject` gateway failures still on `console.error`
- No happy-path info logs anywhere in the pipeline

## Desired End State

A successful source-link run produces this readable chain in `pnpm dev:log`:

```
[@lightfast/console]  bulkLinkResources: starting  { provider, gwInstallationId, resourceCount }
[@lightfast/console]  bulkLinkResources: categorized  { toCreate, toReactivate, alreadyActive }
[@lightfast/console]  notifyBackfill: starting  { installationId, provider, correlationId }
[@lightfast/console]  notifyBackfill: triggering backfill  { depth, entityTypes, correlationId }
[@lightfast/console]  notifyBackfill: backfill triggered successfully  { correlationId }
[@lightfast/console]  bulkLinkResources: complete  { created, reactivated, skipped }
[@lightfast/backfill]  POST /api/trigger 200 12ms  { correlationId }
[@lightfast/backfill]  backfill-orchestrator: starting  { installationId, provider, depth, correlationId }
[@lightfast/backfill]  backfill-orchestrator: connection fetched  { resourceCount }
[@lightfast/backfill]  backfill-orchestrator: work units planned  { total, afterFilter, skipped }
[@lightfast/backfill]  backfill-orchestrator: dispatching entity workers  { count }
[@lightfast/backfill]  entity-worker: starting  { entityType, resource, correlationId }
[@lightfast/backfill]  entity-worker: page fetched  { page, events, rateLimit.remaining }
[@lightfast/backfill]  entity-worker: page dispatched  { page, count }
[@lightfast/backfill]  entity-worker: complete  { eventsProduced, eventsDispatched, pages }
[@lightfast/backfill]  backfill-orchestrator: complete  { completed, failed, eventsProduced }
[@lightfast/relay]    POST /api/webhooks/github 200 18ms from service  { deliveryId, correlationId }
[@lightfast/relay]    webhook-delivery: dedup passed  { provider, deliveryId }
[@lightfast/relay]    webhook-delivery: connection resolved  { connectionId, source: "cache"|"db" }
[@lightfast/relay]    webhook-delivery: published to console ingress  { deliveryId }
[@lightfast/console]  ingress: workspace resolved  { workspaceId, workspaceName }
[@lightfast/console]  ingress: event transformed  { provider, eventType }
[@lightfast/console]  ingress: event stored  { ingestLogId }
[@lightfast/console]  ingress: fan-out complete  { ingestLogId }
```

## What We're NOT Doing

- No new logging infrastructure
- No Sentry `captureException` additions (separate concern)
- No per-batch logging inside entity-worker dispatch loop (too noisy)
- No per-resource logging inside backfill orchestrator work unit enumeration
- No changes to lifecycle middleware (already correct)

---

## Phase 1: Fix Remaining Raw console.* (2 call sites)

**File**: `api/console/src/router/org/workspace.ts`

`linkVercelProject` still uses `console.error` for gateway registration failures at lines 564 and 614. The `log` import already exists in this file.

```ts
// Line 564 — replace console.error with:
log.error("[linkVercelProject] gateway registerResource failed", {
  installationId,
  projectId,
  err,
});

// Line 614 — replace console.error with:
log.error("[linkVercelProject] gateway registerResource failed", {
  installationId,
  projectId,
  err,
});
```

### Success Criteria

#### Automated:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

---

## Phase 2: Happy-Path Logs — tRPC `bulkLinkResources`

**File**: `api/console/src/router/org/workspace.ts`

Add three `log.info` calls that bookend the mutation and expose the categorization result. The `log` import and `nanoid` already exist.

```ts
// After input destructuring (line ~734), before workspace verify:
log.info("[bulkLinkResources] starting", {
  provider,
  workspaceId,
  gwInstallationId,
  resourceCount: resources.length,
});

// After the categorization for-loop (line ~802), before gateway client creation:
log.info("[bulkLinkResources] resources categorized", {
  provider,
  gwInstallationId,
  toCreate: toCreate.length,
  toReactivate: toReactivate.length,
  alreadyActive: alreadyActive.length,
});

// Before the final return (line ~902):
log.info("[bulkLinkResources] complete", {
  provider,
  gwInstallationId,
  created: toCreate.length,
  reactivated: toReactivate.length,
  skipped: alreadyActive.length,
});
```

### Success Criteria

#### Automated:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

#### Manual:
- [ ] Link a source via UI, confirm start → categorized → complete sequence in `/tmp/lightfast-dev.log`

---

## Phase 3: Happy-Path Logs — Backfill Orchestrator

**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts`

The orchestrator has zero info logs on the happy path. Add breadcrumbs at each significant moment. The `log` import already exists.

```ts
// 1. After event.data destructuring — very first thing in the function:
log.info("[backfill-orchestrator] starting", {
  installationId,
  provider,
  depth,
  entityTypes,
  correlationId,
});

// 2. After the get-connection step resolves (after line ~74):
log.info("[backfill-orchestrator] connection fetched", {
  installationId,
  provider,
  resourceCount: connection.resources.length,
  correlationId,
});

// 3. After filteredWorkUnits is computed (after line ~136):
log.info("[backfill-orchestrator] work units planned", {
  installationId,
  provider,
  total: workUnits.length,
  afterFilter: filteredWorkUnits.length,
  skippedByGapFilter: workUnits.length - filteredWorkUnits.length,
  since,
  correlationId,
});

// 4. Before the Promise.all dispatch (before line ~152):
log.info("[backfill-orchestrator] dispatching entity workers", {
  installationId,
  provider,
  count: filteredWorkUnits.length,
  workUnitIds: filteredWorkUnits.map((wu) => wu.workUnitId),
  correlationId,
});

// 5. Before the holdForReplay replay block (before line ~219):
if (holdForReplay && succeeded.length > 0) {
  log.info("[backfill-orchestrator] replaying held webhooks", {
    installationId,
    succeededWorkers: succeeded.length,
    correlationId,
  });
  // ... existing replay block
}

// 6. Before the final return:
log.info("[backfill-orchestrator] complete", {
  installationId,
  provider,
  completed: succeeded.length,
  failed: failed.length,
  eventsProduced: completionResults.reduce((sum, r) => sum + r.eventsProduced, 0),
  eventsDispatched: completionResults.reduce((sum, r) => sum + r.eventsDispatched, 0),
  correlationId,
});
```

### Success Criteria

#### Automated:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

#### Manual:
- [ ] Trigger a backfill, confirm orchestrator breadcrumbs appear in `/tmp/lightfast-dev.log` in order: starting → connection fetched → work units planned → dispatching → complete

---

## Phase 4: Happy-Path Logs — Entity Worker

**File**: `apps/backfill/src/workflows/entity-worker.ts`

The entity worker processes multiple pages per resource with no visibility into progress. Add start, per-page, and completion logs. The `log` import already exists.

```ts
// 1. After event.data destructuring — very first thing:
log.info("[entity-worker] starting", {
  installationId,
  provider,
  entityType,
  resource: resource.providerResourceId,
  since,
  correlationId,
});

// 2. After the fetch step resolves (after step.run `fetch-${entityType}-p${pageNum}`):
log.info("[entity-worker] page fetched", {
  installationId,
  entityType,
  resource: resource.providerResourceId,
  page: pageNum,
  events: fetchResult.events.length,
  ...(fetchResult.rateLimit && { rateLimitRemaining: fetchResult.rateLimit.remaining }),
  correlationId,
});

// 3. After the dispatch step resolves (after step.run `dispatch-${entityType}-p${pageNum}`):
log.info("[entity-worker] page dispatched", {
  installationId,
  entityType,
  resource: resource.providerResourceId,
  page: pageNum,
  dispatched,
  correlationId,
});

// 4. When rate limit sleep is triggered (before step.sleep):
log.info("[entity-worker] rate limit sleep", {
  installationId,
  entityType,
  resource: resource.providerResourceId,
  sleepMs,
  resetAt,
  correlationId,
});

// 5. Before the final return (after the while loop):
log.info("[entity-worker] complete", {
  installationId,
  provider,
  entityType,
  resource: resource.providerResourceId,
  eventsProduced,
  eventsDispatched,
  pagesProcessed: pageNum,
  correlationId,
});
```

### Success Criteria

#### Automated:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

#### Manual:
- [ ] Trigger a backfill, confirm entity-worker breadcrumbs appear per page: starting → page fetched → page dispatched → complete

---

## Phase 5: Happy-Path Logs — Relay Webhook Handler

**File**: `apps/relay/src/routes/webhooks.ts`

The lifecycle middleware logs one entry per request but nothing inside the handler body tells you what actually happened. Add dedup result and QStash publish confirmation. The `log` import already exists.

**Service-auth path** (backfill-originated):

```ts
// After the dedup NX check — if NOT duplicate (dedupResult !== null):
log.info("[webhooks] new delivery, dedup passed", {
  provider: providerName,
  deliveryId,
  eventType,
  correlationId,
});

// After successful QStash publish:
log.info("[webhooks] published to console ingress", {
  provider: providerName,
  deliveryId,
  correlationId,
});
```

**Standard path** (real provider webhook):

```ts
// After workflowClient.trigger:
log.info("[webhooks] workflow triggered", {
  provider: providerName,
  deliveryId,
  eventType,
  correlationId: c.get("correlationId"),
});
```

### Success Criteria

#### Automated:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

#### Manual:
- [ ] Dispatch a backfill webhook, confirm `dedup passed` and `published to console ingress` appear in `/tmp/lightfast-dev.log` with matching `correlationId`

---

## Phase 6: Happy-Path Logs — Relay Webhook Delivery Workflow

**File**: `apps/relay/src/routes/workflows.ts`

The workflow steps run asynchronously but have no per-step logging. Add breadcrumbs after dedup, connection resolve, and publish. The `log` import needs to be added.

```ts
// Add import:
import { log } from "../logger.js";

// After dedup step — if NOT duplicate:
if (!isDuplicate) {
  log.info("[webhook-delivery] dedup passed", {
    provider: data.provider,
    deliveryId: data.deliveryId,
    correlationId: data.correlationId,
  });
}

// After resolve-connection step — if connection found:
if (connectionInfo) {
  log.info("[webhook-delivery] connection resolved", {
    provider: data.provider,
    deliveryId: data.deliveryId,
    connectionId: connectionInfo.connectionId,
    orgId: connectionInfo.orgId,
    correlationId: data.correlationId,
  });
}

// After publish-to-console step:
log.info("[webhook-delivery] published to console ingress", {
  provider: data.provider,
  deliveryId: data.deliveryId,
  correlationId: data.correlationId,
});
```

### Success Criteria

#### Automated:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

#### Manual:
- [ ] Trigger a standard webhook, confirm workflow breadcrumbs appear: dedup passed → connection resolved → published to console ingress

---

## Phase 7: Happy-Path Logs — Console Ingress

**File**: `apps/console/src/app/api/gateway/ingress/route.ts`

The ingress currently only logs the failure cases. Add breadcrumbs for the four happy-path moments. The `log` import already exists.

```ts
// 1. After workspace resolves successfully (after the !workspace guard, before Step 2):
log.info("[ingress] workspace resolved", {
  workspaceId: workspace.workspaceId,
  workspaceName: workspace.workspaceName,
  provider: envelope.provider,
  deliveryId: envelope.deliveryId,
  correlationId: envelope.correlationId,
});

// 2. After transformEnvelope returns non-null (after the !rawEvent guard):
log.info("[ingress] event transformed", {
  provider: envelope.provider,
  eventType: envelope.eventType,
  deliveryId: envelope.deliveryId,
  correlationId: envelope.correlationId,
});

// 3. After DB insert returns record:
log.info("[ingress] event stored", {
  ingestLogId: record.id,
  workspaceId: workspace.workspaceId,
  deliveryId: envelope.deliveryId,
  correlationId: envelope.correlationId,
});

// 4. After the fan-out Promise.all resolves:
log.info("[ingress] fan-out complete", {
  ingestLogId: record.id,
  workspaceId: workspace.workspaceId,
  correlationId: envelope.correlationId,
});
```

### Success Criteria

#### Automated:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

#### Manual:
- [ ] Inject a test event, confirm all four ingress breadcrumbs appear in `/tmp/lightfast-dev.log`: workspace resolved → event transformed → event stored → fan-out complete

---

## Phase 8: Fan-Out Correlation — Ingress → Event Store → Entity Graph → Entity Embed

### Overview

`event-store` and `entity-embed` have log calls but are unlinked from ingress — `correlationId` is never passed across any of the Inngest event boundaries. `entity-graph` already has `log` imported and a basic log call but also lacks `correlationId`. The fix is to thread `correlationId` through every event emission in the chain:

```
publishInngestNotification
  → event.capture (event-store)
    → entity.upserted (entity-graph)
      → entity.graphed (entity-embed)
```

### Changes Required

#### 1. Thread `correlationId` into `publishInngestNotification`

**File**: `apps/console/src/app/api/gateway/ingress/_lib/notify.ts`

```ts
export async function publishInngestNotification(
  sourceEvent: PostTransformEvent,
  workspace: ResolvedWorkspace,
  ingestLogId: number,
  correlationId?: string,  // add param
): Promise<void> {
  await inngest.send({
    name: "apps-console/event.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent,
      ingestionSource: "webhook",
      ingestLogId,
      correlationId,  // add
    },
  });
}
```

Update the call site in `ingress/route.ts`:

```ts
publishInngestNotification(sourceEvent, workspace, record.id, envelope.correlationId),
```

#### 2. `event-store` — add `ingestLogId` + `correlationId` to log calls, forward through `entity.upserted`

**File**: `api/console/src/inngest/workflow/neural/event-store.ts`

Destructure `correlationId` from `event.data`:

```ts
const {
  workspaceId,
  clerkOrgId: eventClerkOrgId,
  sourceEvent,
  ingestLogId,
  correlationId,  // add
} = event.data;
```

Add to the three existing `log.info` calls:

```ts
// "Storing neural observation" — add:
ingestLogId,
correlationId,

// "Observation stored" — add:
ingestLogId,
correlationId,

// "Entities and junctions stored" — add:
ingestLogId,
correlationId,
```

Forward `correlationId` in the `entity.upserted` emission (~line 526):

```ts
await step.sendEvent("emit-downstream-events", {
  name: "apps-console/entity.upserted" as const,
  data: {
    workspaceId,
    entityExternalId: entityUpsertResult.primaryEntityExternalId,
    entityType: sourceEvent.entity.entityType,
    provider: sourceEvent.provider,
    internalEventId: observation.id,
    entityRefs,
    occurredAt: sourceEvent.occurredAt,
    correlationId,  // add
  },
});
```

#### 3. `entity-graph` — add `correlationId` to log call, forward through `entity.graphed`

**File**: `api/console/src/inngest/workflow/neural/entity-graph.ts`

`log` is already imported and the basic log call exists. Add `correlationId` to the destructuring and log call:

```ts
const { workspaceId, internalEventId, provider, entityRefs, correlationId } = event.data;

// Existing log call — add correlationId:
log.info("[entity-graph] edges resolved", {
  workspaceId,
  internalEventId,
  provider,
  entityExternalId: event.data.entityExternalId,
  edgeCount,
  correlationId,  // add
});
```

Forward `correlationId` in the `entity.graphed` emission:

```ts
await step.sendEvent("emit-entity-graphed", {
  name: "apps-console/entity.graphed" as const,
  data: {
    workspaceId,
    entityExternalId: event.data.entityExternalId,
    entityType: event.data.entityType,
    provider,
    occurredAt: event.data.occurredAt,
    correlationId,  // add
  },
});
```

#### 4. `entity-embed` — add `correlationId` to existing log call

**File**: `api/console/src/inngest/workflow/neural/entity-embed.ts`

`log` is already imported and `log.info("Entity vector upserted", ...)` exists at line 253. Add `correlationId` to the destructuring and that log call:

```ts
const { workspaceId, entityExternalId, provider, correlationId } = event.data;

// Existing "Entity vector upserted" log call — add:
log.info("Entity vector upserted", {
  entityExternalId: entity.externalId,
  entityType: entity.category,
  vectorId: `ent_${entity.externalId}`,
  totalEvents: entity.occurrenceCount,
  edgeCount: edges.length,
  narrativeHash: hash,
  correlationId,  // add
});
```

### Success Criteria

#### Automated:
- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm --filter @api/console build` passes

#### Manual:
- [ ] Inject a test event, confirm `grep "<ingestLogId>"` shows both the ingress "event stored" entry and event-store "Observation stored" entry
- [ ] Confirm `grep "<correlationId>"` traces the full chain: ingress → event-store → entity-graph → entity-embed

---

## Full E2E Verification

After all phases, run a full source-link flow:

```bash
# Terminal 1
pnpm dev:log

# Terminal 2 — live tail filtered to the flow
tail -f /tmp/lightfast-dev.log | grep -E "bulkLink|notifyBackfill|orchestrator|entity-worker|webhooks|webhook-delivery|ingress"

# Terminal 3 — pick a correlationId from the output and trace it end-to-end
grep "<correlationId>" /tmp/lightfast-dev.log
```

Expected: a complete breadcrumb chain from UI mutation through ingress fan-out, all sharing the same `correlationId`.

---

## References

- Research: `thoughts/shared/research/2026-03-16-e2e-flow-logging-observability.md`
- Service logger: `vendor/observability/src/service-log.ts`
- Next.js logger: `vendor/observability/src/log.ts`
- `pnpm dev:log` script: root `package.json`

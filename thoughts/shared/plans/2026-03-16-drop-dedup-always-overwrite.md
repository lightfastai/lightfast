# Drop Dedup — Always Overwrite Implementation Plan

## Overview

Remove all deduplication layers from the ingestion pipeline and replace with
idempotent upsert semantics. Same event re-processed = DB row updated in-place.
Enables clean backfill re-runs, simplifies the architecture, and defers any
re-introduction of dedup until the core pipeline is fully understood.

## Current State Analysis

Five independent dedup/skip mechanisms exist across four layers:

| # | Layer | Mechanism | File:Line |
|---|---|---|---|
| 1 | Relay (service auth) | Redis `SET NX` — drops duplicate `deliveryId` for 24h | `apps/relay/src/routes/webhooks.ts:71-78` |
| 2 | Relay (standard path) | Redis `SET NX` in Upstash Workflow Step 1 | `apps/relay/src/routes/workflows.ts:46-58` |
| 3 | Relay (standard path) | QStash `deduplicationId` on publish | `apps/relay/src/routes/workflows.ts:217` |
| 4 | Ingress → Inngest | Inngest function-level `idempotency` expression | `api/console/src/inngest/workflow/neural/event-store.ts:117-118` |
| 5 | eventStore | `check-duplicate` SELECT + early return | `api/console/src/inngest/workflow/neural/event-store.ts:207-243` |

Additionally, two insert operations use `onConflictDoNothing` (silent discard):
- `gatewayWebhookDeliveries` in relay (both paths)
- `workspaceEvents` insert is a plain insert (no conflict key — `event_source_id_idx` is a non-unique index, so duplicates throw)

## Desired End State

- Any event re-dispatched through the pipeline updates the existing row rather than being silently dropped or erroring.
- `workspaceEvents(workspaceId, sourceId)` is a unique pair — enforced at DB level.
- Re-running backfill for the same resource produces updated rows, not duplicate rows or no-ops.
- `workspaceEntities` already upserts — unchanged.
- `workspaceIngestLogs` remains append-only (pure audit log, duplicates are acceptable).

### Verification
Run backfill for a resource. Note the `workspaceEvents.id` values. Run backfill again for
the same resource with the same depth. The same `id` values exist (no new rows), but
`capturedAt`, `significanceScore`, and other mutable fields reflect the latest run.

## What We're NOT Doing

- Changing the gap-aware filter in backfill orchestrator (`backfill-orchestrator.ts:140-151`) — that avoids redundant API calls, not data overwrites. Leave it.
- Making `workspaceIngestLogs` unique on `deliveryId` — it's a log table, multiple rows per delivery is intentional.
- Removing the resource→connection Redis cache (`gw:resource:*`) — that's a lookup cache, not dedup.
- Changing `workspaceEventEntities` — `onConflictDoNothing` is correct there (junctions don't change per-event, same `eventId` + same `entityId` = same row).

## Phase 1: DB Migration — Unique Constraint on workspaceEvents

### Overview
Change `event_source_id_idx` from a plain index to a unique index on
`(workspaceId, sourceId)`. This is the prerequisite for Phase 2's `onConflictDoUpdate`
on `workspaceEvents`.

### Changes Required

#### 1. Schema
**File:** `db/console/src/schema/tables/workspace-events.ts:164`

```ts
// Before
sourceIdIdx: index("event_source_id_idx").on(
  table.workspaceId,
  table.sourceId
),

// After
sourceIdIdx: uniqueIndex("event_source_id_idx").on(
  table.workspaceId,
  table.sourceId
),
```

### Success Criteria

#### Automated Verification
- [ ] Generate migration: `cd db/console && pnpm db:generate`
  - Drizzle will generate `DROP INDEX "event_source_id_idx"` + `CREATE UNIQUE INDEX "event_source_id_idx" ON "lightfast_workspace_events" ("workspace_id", "source_id")`
- [ ] Apply migration: `pnpm db:migrate`
  - Will fail if duplicate `(workspaceId, sourceId)` pairs exist in the table — clean dev data first if needed
- [ ] `pnpm typecheck` passes

#### Manual Verification
- [ ] `pnpm db:studio` — confirm the index on `lightfast_workspace_events` shows as UNIQUE

**Implementation Note:** Pause after Phase 1 and confirm migration ran cleanly before proceeding.

---

## Phase 2: Remove All Dedup Layers

### Overview
Remove the five dedup mechanisms across relay and eventStore. Replace
`onConflictDoNothing` with `onConflictDoUpdate` at every write site.
All changes in this phase are independent and can be applied together.

### Changes Required

#### 1. `db/console/src/schema/tables/workspace-events.ts` — import cleanup
The `index` import can be removed from the import list if `uniqueIndex` now handles all index definitions.

Check: search for remaining uses of `index(` in the file. If `sourceIdIdx` was the only one,
remove `index` from the drizzle-orm/pg-core import. Otherwise keep it.

---

#### 2. `apps/relay/src/lib/cache.ts` — remove `webhookSeenKey`
**File:** `apps/relay/src/lib/cache.ts`

Remove lines 15–17 (the `webhookSeenKey` export and its comment):
```ts
// Remove:
/** Deduplication key for received webhooks (TTL 86400s) */
export const webhookSeenKey = (provider: SourceType, deliveryId: string) =>
  `gw:webhook:seen:${provider}:${deliveryId}`;
```

If `SourceType` is no longer needed after removing `webhookSeenKey`, remove the import too.
Check: `resourceKey` also uses `SourceType` — keep the import.

---

#### 3. `apps/relay/src/routes/webhooks.ts` — service auth path
**File:** `apps/relay/src/routes/webhooks.ts`

**Remove** `redis` import (line 9) — only used for dedup `SET NX`:
```ts
// Remove:
import { redis } from "@vendor/upstash";
```

**Remove** `webhookSeenKey` import (line 12):
```ts
// Remove:
import { webhookSeenKey } from "../lib/cache.js";
```

**Add** `sql` to the `@vendor/db` import (line 7) — needed for `onConflictDoUpdate`:
```ts
// Before:
import { and, eq } from "@vendor/db";
// After:
import { and, eq, sql } from "@vendor/db";
```

**Remove** the entire Redis dedup block (lines 70–85):
```ts
// Remove:
// Dedup — prevents duplicates from backfill retries and re-runs.
const dedupResult = await redis.set(
  webhookSeenKey(providerName, deliveryId),
  "1",
  { nx: true, ex: 86_400 }
);
if (dedupResult === null) {
  return c.json({ status: "duplicate", deliveryId });
}

log.info("[webhooks] new delivery, dedup passed", {
  provider: providerName,
  deliveryId,
  eventType,
  correlationId: c.get("correlationId"),
});
```

Replace with a single log line:
```ts
log.info("[webhooks] new delivery", {
  provider: providerName,
  deliveryId,
  eventType,
  correlationId: c.get("correlationId"),
});
```

**Change** `onConflictDoNothing` → `onConflictDoUpdate` for `gatewayWebhookDeliveries`
(line 101):
```ts
// Before:
.onConflictDoNothing();

// After:
.onConflictDoUpdate({
  target: [
    gatewayWebhookDeliveries.provider,
    gatewayWebhookDeliveries.deliveryId,
  ],
  set: {
    status: "received",
    eventType: sql`EXCLUDED.event_type`,
    installationId: sql`EXCLUDED.installation_id`,
    payload: sql`EXCLUDED.payload`,
    receivedAt: sql`EXCLUDED.received_at`,
  },
});
```

---

#### 4. `apps/relay/src/routes/workflows.ts` — standard webhook path
**File:** `apps/relay/src/routes/workflows.ts`

**Remove** `webhookSeenKey` from the cache import (line 17):
```ts
// Before:
import {
  RESOURCE_CACHE_TTL,
  resourceKey,
  webhookSeenKey,
} from "../lib/cache.js";

// After:
import { RESOURCE_CACHE_TTL, resourceKey } from "../lib/cache.js";
```

Keep `redis` import (line 10) — still used for the resource→connection cache lookup
at lines 92 and 125–131.

**Add** `sql` to the `@vendor/db` import (line 8):
```ts
// Before:
import { and, eq } from "@vendor/db";
// After:
import { and, eq, sql } from "@vendor/db";
```

**Remove** the entire Step 1 dedup block (lines 44–64):
```ts
// Remove:
// Step 1: Deduplication — SET NX (only if not exists), TTL 24h
// Returns true if this is a duplicate (key already existed).
const isDuplicate = await context.run("dedup", async () => {
  const result = await redis.set(
    webhookSeenKey(data.provider, data.deliveryId),
    "1",
    { nx: true, ex: 86_400 }
  );
  return result === null; // null = key already existed = duplicate
});

if (isDuplicate) {
  // Workflow ends gracefully — duplicate delivery, no further action.
  return;
}

log.info("[webhook-delivery] dedup passed", {
  provider: data.provider,
  deliveryId: data.deliveryId,
  correlationId: data.correlationId,
});
```

**Update** the workflow docstring comment (lines 32–38) to remove dedup reference:
```ts
// Before (Step 1 line):
// * - Step 1: Dedup — skip duplicate deliveries (idempotent, NX set)
// * - Step 2: Resolve connection from resource ID via Redis cache
// * - Step 3: Publish to Console ingress (QStash) or DLQ if unresolvable

// After:
// * - Step 1: Resolve connection from resource ID via Redis cache
// * - Step 2: Publish to Console ingress (QStash) or DLQ if unresolvable
```

**Change** `onConflictDoNothing` → `onConflictDoUpdate` for `gatewayWebhookDeliveries`
(line 80):
```ts
// Before:
.onConflictDoNothing();

// After:
.onConflictDoUpdate({
  target: [
    gatewayWebhookDeliveries.provider,
    gatewayWebhookDeliveries.deliveryId,
  ],
  set: {
    status: "received",
    eventType: sql`EXCLUDED.event_type`,
    payload: sql`EXCLUDED.payload`,
    receivedAt: sql`EXCLUDED.received_at`,
  },
});
```

Note: `installationId` is not set here because it's populated later in step `update-connection`
after connection resolution.

**Remove** `deduplicationId` from the QStash publish (line 217):
```ts
// Before:
await qstash.publishJSON({
  url: `${consoleUrl}/api/gateway/ingress`,
  // ...
  retries: 5,
  deduplicationId: `${data.provider}:${data.deliveryId}`,
  callback: `${relayBaseUrl}/admin/delivery-status?provider=${data.provider}`,
});

// After:
await qstash.publishJSON({
  url: `${consoleUrl}/api/gateway/ingress`,
  // ...
  retries: 5,
  callback: `${relayBaseUrl}/admin/delivery-status?provider=${data.provider}`,
});
```

---

#### 5. `apps/relay/src/lib/replay.ts` — remove Redis dedup clear
**File:** `apps/relay/src/lib/replay.ts`

**Remove** `redis` import (line 10):
```ts
// Remove:
import { redis } from "@vendor/upstash";
```

**Remove** `webhookSeenKey` import (line 13):
```ts
// Remove:
import { webhookSeenKey } from "./cache.js";
```

**Remove** lines 60–61 (Redis key deletion + comment):
```ts
// Remove:
// Clear Redis dedup key so workflow's Step 1 doesn't reject as duplicate
await redis.del(webhookSeenKey(providerName, delivery.deliveryId));
```

---

#### 6. `api/console/src/inngest/workflow/neural/event-store.ts` — remove Inngest dedup
**File:** `api/console/src/inngest/workflow/neural/event-store.ts`

**Remove** `idempotency` expression (lines 116–118):
```ts
// Remove:
// Idempotency by workspace + source ID to prevent duplicate observations per workspace
idempotency:
  "event.data.workspaceId + '-' + event.data.sourceEvent.sourceId",
```

**Remove** the `check-duplicate` step and its early-return block (lines 206–243):
```ts
// Remove:
// Step 1: Check for duplicate
const existing = await step.run("check-duplicate", async () => {
  const obs = await db.query.workspaceEvents.findFirst({
    where: and(
      eq(workspaceEvents.workspaceId, workspaceId),
      eq(workspaceEvents.sourceId, sourceEvent.sourceId)
    ),
  });

  if (obs) {
    log.info("Observation already exists, skipping", {
      observationId: obs.id,
      sourceId: sourceEvent.sourceId,
    });
  }

  return obs ?? null;
});

if (existing) {
  await step.run("complete-job-duplicate", async () => {
    await completeJob({
      jobId,
      status: "completed",
      output: {
        inngestFunctionId: "event.capture",
        status: "filtered",
        reason: "duplicate",
        sourceId: sourceEvent.sourceId,
      } satisfies EventCaptureOutputFiltered,
    });
  });

  return {
    status: "duplicate",
    observationId: existing.id,
    duration: Date.now() - startTime,
  };
}
```

Also remove `EventCaptureOutputFiltered` from the import at line 32–38 if it's no longer
referenced (check: it's also used in `complete-job-filtered` for `event_not_allowed` — keep it).

**Change** the `store-observation` insert to upsert (lines 392–414):
```ts
// Before:
const [obs] = await db
  .insert(workspaceEvents)
  .values({
    externalId,
    workspaceId,
    occurredAt: sourceEvent.occurredAt,
    observationType,
    title: sourceEvent.title,
    content: sourceEvent.body,
    source: sourceEvent.provider,
    sourceType: sourceEvent.eventType,
    sourceId: sourceEvent.sourceId,
    sourceReferences: sourceEvent.relations,
    metadata: sourceEvent.attributes,
    ingestionSource: event.data.ingestionSource ?? "webhook",
    ingestLogId: ingestLogId ?? null,
    significanceScore: significance.score,
  })
  .returning();

// After:
const [obs] = await db
  .insert(workspaceEvents)
  .values({
    externalId,
    workspaceId,
    occurredAt: sourceEvent.occurredAt,
    observationType,
    title: sourceEvent.title,
    content: sourceEvent.body,
    source: sourceEvent.provider,
    sourceType: sourceEvent.eventType,
    sourceId: sourceEvent.sourceId,
    sourceReferences: sourceEvent.relations,
    metadata: sourceEvent.attributes,
    ingestionSource: event.data.ingestionSource ?? "webhook",
    ingestLogId: ingestLogId ?? null,
    significanceScore: significance.score,
  })
  .onConflictDoUpdate({
    target: [workspaceEvents.workspaceId, workspaceEvents.sourceId],
    set: {
      occurredAt: sql`EXCLUDED.occurred_at`,
      capturedAt: sql`CURRENT_TIMESTAMP`,
      observationType: sql`EXCLUDED.observation_type`,
      title: sql`EXCLUDED.title`,
      content: sql`EXCLUDED.content`,
      sourceType: sql`EXCLUDED.source_type`,
      sourceReferences: sql`EXCLUDED.source_references`,
      metadata: sql`EXCLUDED.metadata`,
      ingestionSource: sql`EXCLUDED.ingestion_source`,
      ingestLogId: sql`EXCLUDED.ingest_log_id`,
      significanceScore: sql`EXCLUDED.significance_score`,
    },
  })
  .returning();
```

Note: `id`, `externalId`, `workspaceId`, `source`, `sourceId`, and `createdAt` are
intentionally NOT in the `set` clause. `externalId` must be preserved so the Pinecone
vector ID (`ent_${externalId}`) remains stable across re-runs — entityEmbed will upsert
the same Pinecone record rather than creating orphaned vectors.

**Update** the workflow docstring at lines 1–16 — remove Step 1 (duplicate check):
```ts
// Before step list:
// * 1. Check for duplicate events (idempotency)
// * 2. Check if event is allowed by source config (filtering)
// ...

// After:
// * 1. Check if event is allowed by source config (filtering)
// ...
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck` passes across all packages
- [ ] `pnpm check` passes (no linting errors)

#### Manual Verification
- [ ] Trigger backfill for a resource. Confirm events appear in `workspaceEvents`.
- [ ] Trigger backfill again for the same resource. Confirm:
  - Same `id` values in `workspaceEvents` (rows updated, not duplicated)
  - `capturedAt` updated to latest timestamp
  - No `{ status: "duplicate" }` responses from relay
  - No events silently dropped at any layer
- [ ] Live webhook arrives (GitHub push or similar). Confirm it still processes correctly
  end-to-end: relay → ingress → eventStore → entityGraph → entityEmbed.
- [ ] Check Inngest dashboard: `event.capture` functions complete with `status: "stored"`,
  not `status: "duplicate"`.

**Implementation Note:** After both phases complete and all automated checks pass,
run the manual testing sequence before marking this plan complete.

---

## Data Flow After Changes

```
backfill entity-worker
  └─ relay.dispatchWebhook(provider, { deliveryId, ... }, holdForReplay)
       │
       ▼
relay POST /webhooks/:provider  (service auth path)
  ├─ [REMOVED] Redis SET NX dedup
  ├─ gatewayWebhookDeliveries.onConflictDoUpdate → status="received"
  └─ if !holdForReplay: QStash.publishJSON → /api/gateway/ingress

relay Upstash Workflow  (standard/live webhook path)
  ├─ [REMOVED] Step 1 dedup
  ├─ persist-delivery: gatewayWebhookDeliveries.onConflictDoUpdate → status="received"
  ├─ resolve-connection: Redis cache → DB fallthrough
  └─ publish-to-console: QStash.publishJSON (no deduplicationId)

console /api/gateway/ingress  (unchanged)
  ├─ resolve-workspace
  └─ transform-store-and-fan-out
       ├─ workspaceIngestLogs.insert (append-only — new row each run, fine for log)
       └─ inngest.send("apps-console/event.capture")

eventStore (apps-console/event.capture)
  ├─ [REMOVED] idempotency expression
  ├─ [REMOVED] check-duplicate step
  ├─ check-event-allowed (kept — still filters unregistered resources)
  ├─ evaluate-significance
  ├─ extract-entities
  ├─ store-observation: workspaceEvents.onConflictDoUpdate
  │    target: (workspaceId, sourceId)
  │    set: all mutable fields EXCEPT externalId, createdAt
  ├─ upsert-entities-and-junctions (unchanged)
  └─ emit entity.upserted → entityGraph → entityEmbed (Pinecone upsert via stable externalId)
```

## References

- Relay webhooks handler: `apps/relay/src/routes/webhooks.ts`
- Relay workflow: `apps/relay/src/routes/workflows.ts`
- Relay replay: `apps/relay/src/lib/replay.ts`
- Relay cache keys: `apps/relay/src/lib/cache.ts`
- Console ingress: `apps/console/src/app/api/gateway/ingress/route.ts`
- Event store: `api/console/src/inngest/workflow/neural/event-store.ts`
- Workspace events schema: `db/console/src/schema/tables/workspace-events.ts`
- Gateway deliveries schema: `db/console/src/schema/tables/gateway-webhook-deliveries.ts`

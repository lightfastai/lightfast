---
title: "holdForReplay Fix: Entity Worker Dispatch + Orchestrator Replay"
status: draft
priority: P1
estimated_effort: small
---

# holdForReplay Fix

## Objective

Fix the broken `holdForReplay` semantics in the memory entity worker. Currently, the dispatch step (lines 308-342 of `memory-entity-worker.ts`) always fires `memory/webhook.received` events immediately via `inngest.send()`, regardless of the `holdForReplay` flag. The flag is destructured at line 66 but never read. This means backfill webhooks are processed out-of-chronological-order instead of being held and replayed in sequence after all entity workers complete.

The fix introduces a `"held"` status value (distinct from `"received"`) to prevent collision with the delivery-recovery cron's 5-minute sweep.

## Success Criteria

1. When `holdForReplay=true`, entity worker writes deliveries to `gatewayWebhookDeliveries` with `status: "held"` instead of sending Inngest events.
2. When `holdForReplay=false` (or undefined), entity worker sends Inngest events immediately (current behavior, unchanged).
3. After all entity workers complete, orchestrator's `replay-held-webhooks` step queries `status = "held"` and replays them in chronological order.
4. Delivery-recovery cron continues to sweep only `status = "received"` records and never touches `"held"` records.
5. The `recoveryIdx` partial index (`WHERE status = 'received'`) naturally excludes `"held"` rows -- no index changes needed.

## Implementation Steps

### Step 1: Entity Worker Dispatch Branch

**File**: `api/memory/src/inngest/functions/memory-entity-worker.ts`
**Lines**: 18-19 (imports), 308-342 (dispatch step)

**Current** (lines 308-342): Always sends events via `inngest.send()`:
```ts
const dispatched = await step.run(
  `dispatch-${entityType}-p${pageNum}`,
  async () => {
    const BATCH_SIZE = 5;
    const events = fetchResult.events;
    let count = 0;

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      if (batch.length > 0) {
        await inngest.send(
          batch.map((webhookEvent) => ({
            name: "memory/webhook.received" as const,
            data: {
              provider,
              deliveryId: webhookEvent.deliveryId,
              eventType: webhookEvent.eventType,
              resourceId: null,
              payload: webhookEvent.payload,
              receivedAt: Date.now(),
              preResolved: {
                connectionId: installationId,
                orgId,
              },
              correlationId,
            },
          }))
        );
      }
      count += batch.length;
    }
    return count;
  }
);
```

**Change**:

1. Add import for `gatewayWebhookDeliveries` from `@db/console/schema` (line 19):
```ts
import { gatewayInstallations, gatewayWebhookDeliveries } from "@db/console/schema";
```

2. Replace the dispatch step body (lines 308-342) with a branch on `holdForReplay`:
```ts
const dispatched = await step.run(
  `dispatch-${entityType}-p${pageNum}`,
  async () => {
    const BATCH_SIZE = 5;
    const events = fetchResult.events;
    let count = 0;

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;

      if (holdForReplay) {
        // Persist to DB with status "held" — orchestrator replays after all workers finish
        await db.insert(gatewayWebhookDeliveries).values(
          batch.map((webhookEvent) => ({
            provider,
            deliveryId: webhookEvent.deliveryId,
            eventType: webhookEvent.eventType,
            installationId,
            status: "held" as const,
            payload: JSON.stringify(webhookEvent.payload),
            receivedAt: new Date().toISOString(),
          }))
        ).onConflictDoNothing();
      } else {
        // Send events to Inngest immediately
        await inngest.send(
          batch.map((webhookEvent) => ({
            name: "memory/webhook.received" as const,
            data: {
              provider,
              deliveryId: webhookEvent.deliveryId,
              eventType: webhookEvent.eventType,
              resourceId: null,
              payload: webhookEvent.payload,
              receivedAt: Date.now(),
              preResolved: {
                connectionId: installationId,
                orgId,
              },
              correlationId,
            },
          }))
        );
      }
      count += batch.length;
    }
    return count;
  }
);
```

**Key details**:
- `onConflictDoNothing()` uses the `(provider, deliveryId)` unique index (`gateway_wd_provider_delivery_idx`) to handle retries/duplicates safely.
- `status: "held"` (not `"received"`) avoids collision with delivery-recovery cron.
- `installationId` is set so the orchestrator's replay query can filter by connection.

### Step 2: Schema Status Value

**File**: `db/console/src/schema/tables/gateway-webhook-deliveries.ts`
**Lines**: 25, 43-45

**Check**: The `status` column is `varchar("status", { length: 50 })` -- a free-form string, NOT an enum. The comment documents `received|enqueued|delivered|dlq` as known values. Adding `"held"` requires no schema migration.

**Action**: Update the comment on line 25 to document the new value:
```ts
status: varchar("status", { length: 50 }).notNull(), // held|received|enqueued|delivered|dlq
```

**Partial index impact**: The `recoveryIdx` (lines 43-45) uses `.where(sql`${table.status} = 'received'`)`. Records with `status = "held"` are excluded from this index automatically. No index changes needed.

### Step 3: Orchestrator Replay Query

**File**: `api/memory/src/inngest/functions/memory-backfill-orchestrator.ts`
**Lines**: 348-351

**Current** (line 350):
```ts
const conditions = [
  eq(gatewayWebhookDeliveries.installationId, installationId),
  eq(gatewayWebhookDeliveries.status, "received"),
];
```

**Change** (line 350):
```ts
const conditions = [
  eq(gatewayWebhookDeliveries.installationId, installationId),
  eq(gatewayWebhookDeliveries.status, "held"),
];
```

This ensures the orchestrator replays only records explicitly held by the entity worker, not records that happen to be in `"received"` state from live webhook ingestion.

**Post-replay cleanup**: After replaying, the orchestrator should update the status of replayed records so they are not replayed again on retry. Add after the `inngest.send(events)` call (after line 391), within the same iteration:

```ts
// Mark replayed deliveries so they aren't re-sent on retry
const replayedIds = deliveries.map((d) => d.id);
if (replayedIds.length > 0) {
  await db
    .update(gatewayWebhookDeliveries)
    .set({ status: "enqueued" })
    .where(
      and(
        eq(gatewayWebhookDeliveries.installationId, installationId),
        inArray(gatewayWebhookDeliveries.id, replayedIds)
      )
    );
}
```

This transitions `held -> enqueued` after replay, matching the existing status lifecycle. Requires adding `inArray` to the import from `@vendor/db` (line 28).

### Step 4: Delivery Recovery Cron Verification

**File**: `api/memory/src/inngest/functions/delivery-recovery.ts`
**Lines**: 46-49

**Current** (lines 46-49):
```ts
and(
  eq(gatewayWebhookDeliveries.status, "received"),
  lt(gatewayWebhookDeliveries.receivedAt, staleBeforeIso)
)
```

**Verify**: The cron queries `status = "received"` only. Records with `status = "held"` are never matched. No changes needed.

**Additionally**, the `recoveryIdx` partial index on `(status, receivedAt) WHERE status = 'received'` means the DB planner uses an index scan that physically cannot see `"held"` rows.

## Import Changes Summary

| File | Add to imports |
|------|----------------|
| `memory-entity-worker.ts` | `gatewayWebhookDeliveries` from `@db/console/schema` |
| `memory-backfill-orchestrator.ts` | `inArray` from `@vendor/db` |

## Risks

### Cron Collision (Mitigated)

**Risk**: The delivery-recovery cron sweeps `status = "received"` records older than 5 minutes. If entity workers wrote held records as `"received"` (as the original relay did), long-running backfills (>5 min) would have their held records drained out-of-order by the cron before the orchestrator's replay step.

**Mitigation**: Using `status = "held"` completely sidesteps this. The cron's WHERE clause and partial index both filter on `status = 'received'`, so `"held"` records are invisible to the cron.

### Retry Safety (Mitigated)

**Risk**: If the entity worker's dispatch step retries, it could insert duplicate rows.

**Mitigation**: `onConflictDoNothing()` on the `(provider, deliveryId)` unique index silently drops duplicates.

### Orchestrator Replay Retry (Mitigated)

**Risk**: If the orchestrator's `replay-held-webhooks` step fails mid-way and retries, some deliveries may be sent twice.

**Mitigation**: The post-replay status update (`held -> enqueued`) marks records as replayed. On retry, the query for `status = "held"` skips already-replayed records. The downstream `ingestDelivery` function is also idempotent via the `deliveryId`.

## Testing

1. **Unit**: Mock `db.insert` and verify it is called when `holdForReplay=true`, and `inngest.send` is called when `holdForReplay=false`.
2. **Integration**: Trigger a backfill with `holdForReplay=true`, verify DB rows have `status = "held"`, verify orchestrator replays them in `receivedAt` order, verify final status is `"enqueued"`.
3. **Cron isolation**: Insert a `status = "held"` record older than 5 minutes, run delivery-recovery, verify it is NOT swept.

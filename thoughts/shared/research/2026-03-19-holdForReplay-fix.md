---
date: 2026-03-19
topic: "holdForReplay semantics fix for memory entity worker"
tags: [research, memory, backfill, holdForReplay, entity-worker]
status: complete
---

# holdForReplay Fix — Memory Entity Worker

## Problem

The entity worker's dispatch step (`memory-entity-worker.ts:308-342`) always sends `memory/webhook.received` events immediately via `inngest.send()`, regardless of the `holdForReplay` flag. The flag is destructured at line 66 but never used.

## Original Architecture

When `holdForReplay=true`:
1. Entity worker calls `relay.dispatchWebhook(provider, body, holdForReplay=true)`
2. Relay receives with `X-Backfill-Hold: true` header
3. Relay persists to `gatewayWebhookDeliveries` with `status: "received"`
4. Relay returns early WITHOUT QStash publish
5. After ALL entity workers complete, orchestrator runs `replay-held-webhooks`
6. Replay queries `WHERE installationId=? AND status="received" ORDER BY receivedAt`
7. Replays in chronological order via `inngest.send("memory/webhook.received")`

## Current (Broken) Behavior

Entity worker always calls `inngest.send()` → no DB records written → orchestrator's `replay-held-webhooks` finds 0 rows → no-op.

## Fix

In `memory-entity-worker.ts` dispatch step (lines 308-342):

**When `holdForReplay=true`:**
- Replace `inngest.send()` with `db.insert(gatewayWebhookDeliveries)` using:
  - `provider`, `deliveryId`, `eventType` from the webhook event
  - `installationId` from the worker's input
  - `status: "received"` (the hold sentinel)
  - `payload: JSON.stringify(webhookEvent.payload)`
  - `receivedAt: new Date().toISOString()`
- Use `.onConflictDoNothing()` on `(provider, deliveryId)` unique index

**When `holdForReplay=false`:**
- Keep existing `inngest.send()` path

## Delivery Recovery Cron Collision

**Critical**: `delivery-recovery.ts` sweeps ALL `status="received"` records older than 5 minutes globally. If backfill entity workers take >5 minutes total, the recovery cron will drain held records out-of-order BEFORE the orchestrator's `replay-held-webhooks` step runs.

**Mitigation options:**
1. Add `installationId` filter to delivery-recovery to skip records that belong to active backfill runs
2. Add a `held_for_replay` boolean column to distinguish held records from stuck records
3. Use a different status value (e.g., `"held"`) instead of `"received"` for held records
4. Extend the staleness threshold in delivery-recovery for records with a non-null `installationId`

Option 3 is cleanest — use `status: "held"` and update the orchestrator's replay query to match `status = "held"` instead of `status = "received"`. The recovery cron only sweeps `status = "received"`.

## Key Files

- `api/memory/src/inngest/functions/memory-entity-worker.ts:66,308-342`
- `api/memory/src/inngest/functions/memory-backfill-orchestrator.ts:332-407`
- `api/memory/src/inngest/functions/delivery-recovery.ts:46-49`
- `db/console/src/schema/tables/gateway-webhook-deliveries.ts:38-45`

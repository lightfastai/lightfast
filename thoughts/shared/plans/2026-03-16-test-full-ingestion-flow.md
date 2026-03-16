# Test Full Ingestion Flow — End-to-End Debugging Plan

## Overview

Live debugging session for the full event ingestion pipeline:
**Sources/New UI** → `bulkLinkResources` → `notifyBackfill` → Backfill Inngest → Relay webhook (service auth) → QStash → Console Ingress → Inngest `event.capture` → Neural pipeline (`eventStore` → `entityGraph` → `entityEmbed`).

## Current State Analysis

The pipeline is implemented but has not been E2E verified locally. Two known blockers:

1. **Dedup blocks re-testing**: Backfill deliveryIds are deterministic (`backfill-${installationId}-${resourceId}-pr-${number}`). Redis `SET NX` with 24h TTL means re-running backfill for the same resource silently drops all events as duplicates. No admin endpoint exists to flush these keys.

2. **Gap-aware filter blocks re-backfill**: The orchestrator checks `backfillHistory` from the gateway — if a prior completed run covers the same `(resource, entityType, since)` range, the work unit is skipped entirely before it even reaches relay. The gateway's `backfill_runs` table needs to be cleared between test runs.

## Desired End State

After this plan is executed:
- A dev-only `POST /api/admin/dev/flush-dedup` endpoint exists on relay that deletes all `gw:webhook:seen:*` keys
- A dev-only `DELETE /api/admin/dev/backfill-runs/:installationId` endpoint exists on gateway that clears backfill run history for an installation
- `pnpm dev:log` runs all services and logs to `/tmp/lightfast-dev.log`
- Triggering a source connection produces logs at every stage of the pipeline
- We can identify any breakage point with a `correlationId` as the thread

### Key Discoveries

- Redis dedup key: `gw:webhook:seen:<provider>:<deliveryId>` (TTL 86400s, `apps/relay/src/lib/cache.ts:16`)
- Backfill deliveryId format: `backfill-${installationId}-${resourceId}-pr-${number}` (`packages/console-providers/src/providers/github/backfill.ts:100`)
- Gap-aware filter at `apps/backfill/src/workflows/backfill-orchestrator.ts:140-151` — checks `gw.getBackfillRuns(installationId, "completed")`
- Gateway backfill runs endpoint: `apps/gateway/src/routes/...` (to be discovered during impl)
- No existing endpoint to flush `gw:webhook:seen:*` keys
- `dev:qstash` and `dev:inngest` are separate from `dev:app` — need to be started independently

## What We're NOT Doing

- Not changing any production code paths
- Not modifying deliveryId generation
- Not changing TTLs or dedup logic
- Not adding any monitoring infrastructure beyond what exists
- Not fixing any bugs yet — this plan is for diagnosis first

## Implementation Approach

Add minimal dev-only endpoints behind `VERCEL_ENV !== "production"` guards to allow clean state resets between test runs. Then start the full dev stack and observe.

---

## Phase 1: Dev Flush Endpoints

### Overview

Add two dev-only endpoints:
1. `POST /api/admin/dev/flush-dedup` on relay — deletes all `gw:webhook:seen:*` Redis keys
2. `DELETE /api/admin/dev/backfill-runs/:installationId` on gateway — clears backfill run records for a given installation

Both endpoints require the existing `X-API-Key` auth and are gated on `VERCEL_ENV !== "production"`.

### Changes Required

#### 1. Relay: dev flush-dedup endpoint

**File**: `apps/relay/src/routes/admin.ts`
**Change**: Add `POST /api/admin/dev/flush-dedup` route

```typescript
// Dev-only: flush all webhook dedup keys (gw:webhook:seen:*)
// Allows re-testing backfill flows without waiting 24h for TTL expiry
if (process.env.VERCEL_ENV !== "production") {
  admin.post("/dev/flush-dedup", apiKeyAuth, async (c) => {
    const keys = await redis.keys("gw:webhook:seen:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return c.json({ flushed: keys.length });
  });
}
```

#### 2. Gateway: dev clear-backfill-runs endpoint

**File**: `apps/gateway/src/routes/` (discover the backfill runs route file)
**Change**: Add `DELETE /api/admin/dev/backfill-runs/:installationId` route

```typescript
// Dev-only: clear backfill run history for an installation
// Allows re-testing by bypassing the gap-aware filter in the orchestrator
if (process.env.VERCEL_ENV !== "production") {
  admin.delete("/dev/backfill-runs/:installationId", apiKeyAuth, async (c) => {
    const installationId = c.req.param("installationId");
    // DELETE FROM backfill_runs WHERE installation_id = ?
    // (exact query depends on ORM in gateway)
    return c.json({ cleared: true, installationId });
  });
}
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes

#### Manual Verification:
- [ ] `POST /api/admin/dev/flush-dedup` with `X-API-Key` returns `{ flushed: N }` where N ≥ 0
- [ ] Redis has no `gw:webhook:seen:*` keys after flush

---

## Phase 2: Start Dev Stack & Verify Services

### Overview

Start `pnpm dev:log` in background, verify all services are healthy.

### Steps

1. `pnpm dev:log` → logs to `/tmp/lightfast-dev.log`
2. Verify each service port:
   - Console: `http://localhost:4107`
   - Relay: `http://localhost:4108`
   - Backfill: `http://localhost:4109`
   - Gateway: `http://localhost:4110`
   - QStash emulator: `http://localhost:8080`
   - Inngest: connected to console + backfill

### Success Criteria

#### Automated Verification:
- [ ] `curl -s http://localhost:4108/api/admin/health | jq .` returns `{ redis: "ok", db: "ok" }`

#### Manual Verification:
- [ ] All service ports are responding
- [ ] `tail -f /tmp/lightfast-dev.log` shows no startup errors
- [ ] Inngest dev server shows registered functions: `eventStore`, `entityGraph`, `entityEmbed`, `backfillOrchestrator`, `backfillEntityWorker`

---

## Phase 3: Clear State & Trigger Connection

### Overview

Flush dedup keys and backfill history, then user creates a source connection.

### Steps

1. Call `POST /api/admin/dev/flush-dedup` on relay
2. Call `DELETE /api/admin/dev/backfill-runs/:installationId` on gateway (if re-testing existing connection)
3. User navigates to sources/new and connects a provider
4. Watch `correlationId` thread through all logs

### Log Checkpoints (in order)

| Service | Log Message | File |
|---|---|---|
| Console | `bulkLinkResources called` (or similar) | `api/console/src/router/org/workspace.ts:721` |
| Backfill | `[backfill-orchestrator] starting` | `apps/backfill/src/workflows/backfill-orchestrator.ts:47` |
| Backfill | `[entity-worker] starting` | `apps/backfill/src/workflows/entity-worker.ts:54` |
| Relay | `[webhooks] new delivery, dedup passed` | `apps/relay/src/routes/webhooks.ts:80` |
| Console Ingress | `[ingress] workspace resolved` | `apps/console/src/app/api/gateway/ingress/route.ts:60` |
| Console Ingress | `[ingress] event stored` | `apps/console/src/app/api/gateway/ingress/route.ts:107` |
| Neural | `Storing neural observation` | `api/console/src/inngest/workflow/neural/event-store.ts:170` |
| Neural | `Observation stored` | `api/console/src/inngest/workflow/neural/event-store.ts:416` |
| Neural | `[entity-graph] edges resolved` | `api/console/src/inngest/workflow/neural/entity-graph.ts:38` |
| Neural | `Entity vector upserted` | `api/console/src/inngest/workflow/neural/entity-embed.ts:254` |

### Success Criteria

#### Manual Verification:
- [ ] All log checkpoints appear in `/tmp/lightfast-dev.log`
- [ ] `correlationId` is consistent across relay → ingress → neural logs
- [ ] No errors at any stage
- [ ] Events appear in the Inngest dashboard
- [ ] Entities appear in the Lightfast sources list after connection

---

## Phase 4: Identify & Document Breakage Points

### Overview

If any log checkpoint is missing, diagnose and document.

### Decision Tree

1. If `[backfill-orchestrator] starting` missing → `notifyBackfill` failed (check tRPC response, gateway API key)
2. If `[entity-worker] starting` missing → check gap-aware filter (call `GET /gateway/connections/:id/backfill-runs`)
3. If relay log missing → check entity worker logs for HTTP errors from relay
4. If `[ingress] workspace resolved` missing → check QStash emulator delivery, check `orgId` in envelope
5. If `[ingress] event stored` missing → check transformer for unknown event type
6. If `Storing neural observation` missing → check Inngest delivery to `event.capture`
7. If `Observation stored` missing → check duplicate filter, event filter (integration not found)
8. If `Entity vector upserted` missing → check embedding config in workspace settings

### Success Criteria

#### Manual Verification:
- [ ] All breakage points documented with their root cause
- [ ] Workarounds or next steps identified for each

---

## References

- Relay admin routes: `apps/relay/src/routes/admin.ts`
- Relay cache keys: `apps/relay/src/lib/cache.ts`
- Backfill orchestrator: `apps/backfill/src/workflows/backfill-orchestrator.ts`
- Entity worker: `apps/backfill/src/workflows/entity-worker.ts`
- Console ingress: `apps/console/src/app/api/gateway/ingress/route.ts`
- Neural pipeline entry: `api/console/src/inngest/workflow/neural/event-store.ts`
- Relay dedup analysis: `thoughts/shared/research/2026-03-16-e2e-flow-logging-observability.md`

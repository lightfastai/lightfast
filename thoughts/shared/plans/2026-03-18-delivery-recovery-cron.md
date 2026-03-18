---
date: 2026-03-18T00:00:00+00:00
author: claude
branch: refactor/define-ts-provider-redesign
topic: "Delivery Recovery Cron — implementation plan"
status: draft
---

# Delivery Recovery Cron — Implementation Plan

## Overview

Add a QStash-scheduled cron endpoint to the relay admin router that automatically re-fires webhook deliveries stuck in `status = 'received'` for more than 5 minutes. This is the self-healing mechanism for the write-ahead log pattern: the relay persists every inbound webhook to DB before processing it, so any delivery that survives a relay crash or Upstash Workflow stall can be recovered automatically without operator intervention.

## Current State Analysis

### What exists

- `apps/relay/src/lib/replay.ts` — `replayDeliveries(GatewayWebhookDelivery[])` is the shared re-fire primitive. It re-triggers the full `webhookDeliveryWorkflow` via `workflowClient.trigger()` for each delivery. Already handles null payload (skip), provider extraction failure (non-fatal, resourceId falls back to null), and workflow trigger failure (adds to `failed[]`). This is the function the cron will call directly.
- `apps/relay/src/routes/admin.ts` — `POST /api/admin/replay/catchup` performs a scoped sweep (by `installationId`) using the same `replayDeliveries()` call. The global recovery cron is the same pattern minus the `installationId` filter.
- `apps/relay/src/middleware/auth.ts` — `qstashAuth` middleware already validates `Upstash-Signature` headers. This is the correct auth for a QStash-triggered cron endpoint.
- `apps/relay/vercel.json` — no `crons` array. No cron infrastructure of any kind exists in relay today.
- `db/console/src/schema/tables/gateway-webhook-deliveries.ts` — `statusIdx` covers `WHERE status = 'received'`. Phase 0 adds `recoveryIdx`: a partial index on `(status, received_at) WHERE status = 'received'` — the exact predicate the cron query uses.

### What is missing

1. A `POST /api/admin/recovery/cron` route in `admin.ts`
2. A QStash schedule that calls the endpoint every 5 minutes
3. `CRON_SECRET` env var in `env.ts` and `.env.development.local`
4. The `recoveryIdx` partial index on `gatewayWebhookDeliveries` (Phase 0 DB migration)
5. The `failReason` column on `gatewayWebhookDeliveries` (Phase 0 DB migration — used in test assertions)
6. Tests for the new route in `admin.test.ts`

### Deduplication guarantee (why the cron is safe)

Three independent layers prevent double-delivery regardless of how many times the cron fires:

1. **DB unique index + `onConflictDoNothing`** — `workflows.ts` Step 1 inserts with `ON CONFLICT DO NOTHING` on `(provider, delivery_id)`. A second workflow run for the same delivery silently no-ops at persist.
2. **QStash `deduplicationId`** — Step 4 publishes with `deduplicationId: \`${provider}_${deliveryId}\``. QStash deduplicates within its 24-hour window; the same delivery is never double-sent to Console ingress.
3. **Status progression** — once the workflow advances to `enqueued`, `delivered`, or `dlq`, those rows no longer match `status = 'received'` and are excluded from future sweeps automatically.

### Staleness threshold

5 minutes. The research document used 2 minutes but the task specification says 5. Five minutes is more conservative and avoids false recoveries during brief Upstash Workflow cold-start delays. The `received_at` timestamp is set at ingestion time in `webhooks.ts`, making it a reliable staleness indicator.

## Desired End State

- Every webhook delivery that reaches `status = 'received'` in DB and then stalls (Upstash Workflow failure, QStash delivery failure, cold start, etc.) is automatically re-fired within ~10 minutes (5-minute cron + up to 5 minutes stall window).
- The cron runs as a QStash schedule POSTing to `POST /api/admin/recovery/cron` every 5 minutes.
- The endpoint authenticates via `Upstash-Signature` (the existing `qstashAuth` middleware).
- The endpoint queries all providers globally (no `installationId` filter) for `status = 'received' AND received_at < NOW() - 5 minutes`, then calls `replayDeliveries()`.
- No new dependencies. No Inngest. No Vercel cron. Uses existing QStash client and `qstashAuth` middleware.

### Verification

- Unit tests in `admin.test.ts`: insert a stuck delivery row, call `POST /api/admin/recovery/cron` with a valid QStash signature, assert the delivery was re-triggered and the response contains `{ status: "ok", replayed: [...], skipped: [...], failed: [...] }`.
- Manual: trigger a webhook, kill the Upstash Workflow mid-flight, wait 6 minutes, observe the delivery re-appears as `enqueued` in the DB.

## What We Are NOT Doing

- **No Vercel cron** — Vercel crons use GET requests and `Authorization: Bearer <CRON_SECRET>`. QStash schedules use POST with `Upstash-Signature` — already wired in relay via `qstashAuth`. Simpler, consistent with existing infra.
- **No Inngest** — Relay has no Inngest dependency. Adding it would require `@vendor/inngest` + new env vars and diverges from the relay architecture.
- **No new middleware** — `qstashAuth` already handles the auth for QStash-triggered routes. The new route uses it unchanged.
- **No per-provider filtering in the cron** — the cron sweeps all providers. Provider-scoped recovery is the job of `POST /api/admin/replay/catchup`.
- **No `remaining` count** — the catchup endpoint counts remaining rows after replay. The recovery cron omits this for simplicity; it will pick up the remainder on the next invocation.
- **No QStash schedule registration code in the app** — the schedule is a one-time setup step (via QStash dashboard or `qstash.schedules.create()` called once during deployment). It is not bootstrapped from within relay.

## Implementation Approach

The recovery cron is a thin admin route. The entire recovery logic is already implemented in `replayDeliveries()`. The new route adds only:

1. A DB query scoped to `status = 'received' AND received_at < NOW() - 5 minutes` (global, no `installationId`)
2. A call to `replayDeliveries()`
3. A structured JSON response

Auth is `qstashAuth`. No new middleware, no new dependencies, no new files — the route is appended to `admin.ts`.

The QStash schedule is a deployment concern, not an application concern. The plan documents the setup steps but does not add schedule-registration code to relay.

---

## Phase 0: DB Schema — Recovery Index (Prerequisite)

**Dependency**: This phase must land before Phase 1. It is tracked separately in the Phase 0 DB schema migration plan but reproduced here for completeness.

### Changes Required

#### 1. `gatewayWebhookDeliveries` table — recovery index + failReason column

**File**: `db/console/src/schema/tables/gateway-webhook-deliveries.ts`

Add `sql` import from `drizzle-orm`. Add `failReason` column (nullable varchar 100). Add `recoveryIdx` partial index:

```typescript
// New import:
import { sql } from "drizzle-orm";

// New column (after `payload`):
failReason: varchar("fail_reason", { length: 100 }),

// New index in the index factory:
recoveryIdx: index("gateway_wd_recovery_idx")
  .on(table.status, table.receivedAt)
  .where(sql`${table.status} = 'received'`),
```

The generated SQL:
```sql
ALTER TABLE "lightfast_gateway_webhook_deliveries"
  ADD COLUMN "fail_reason" varchar(100);

CREATE INDEX "gateway_wd_recovery_idx"
  ON "lightfast_gateway_webhook_deliveries" USING btree ("status", "received_at")
  WHERE (status = 'received');
```

### Success Criteria

#### Automated Verification
- [ ] `cd db/console && pnpm db:generate` produces a migration with the `fail_reason` column and `gateway_wd_recovery_idx` partial index
- [ ] `pnpm db:migrate` applies cleanly
- [ ] `pnpm typecheck` passes across the monorepo

---

## Phase 1: Recovery Cron Route

### Overview

Add `POST /api/admin/recovery/cron` to the admin router. The route is authenticated via `qstashAuth`, queries all stuck `received` deliveries older than 5 minutes, calls `replayDeliveries()`, and returns a structured result.

### Changes Required

#### 1. Admin router — new recovery route

**File**: `apps/relay/src/routes/admin.ts`

Add the following import (already imported: `and`, `eq`, `sql` — add `lt` from `@vendor/db`):

```typescript
import { and, eq, gte, lt, lte, notInArray, or, sql } from "@vendor/db";
```

Add the route after `POST /admin/replay/catchup` (before the dev-only block):

```typescript
/**
 * POST /admin/recovery/cron
 *
 * Automated delivery recovery. Called by QStash on a schedule (every 5 minutes).
 * Sweeps all deliveries stuck in status='received' for more than 5 minutes
 * across all providers and installations, then re-triggers the webhook delivery
 * workflow for each one.
 *
 * Auth: QStash Upstash-Signature (qstashAuth middleware).
 * Idempotent: safe to call multiple times — downstream dedup via
 * onConflictDoNothing (DB) and deduplicationId (QStash).
 */
admin.post("/recovery/cron", qstashAuth, async (c) => {
  const BATCH_SIZE = 100;
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const staleBeforeMs = Date.now() - STALE_THRESHOLD_MS;
  const staleBeforeIso = new Date(staleBeforeMs).toISOString();

  const deliveries = await db
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

  if (deliveries.length === 0) {
    return c.json({ status: "ok", replayed: [], skipped: [], failed: [] });
  }

  const result = await replayDeliveries(deliveries);

  return c.json({ status: "ok", ...result });
});
```

**Notes on implementation details:**

- `lt` (less-than) is used for `received_at < staleBeforeIso`. The `lte` already imported for `catchup` is not sufficient here — we need strict less-than to exclude deliveries that arrived exactly at the threshold boundary.
- `staleBeforeIso` is an ISO 8601 string. The `receivedAt` column uses `mode: "string"` with timezone, so string comparison is correct.
- `BATCH_SIZE = 100` is intentionally smaller than the catchup endpoint's max (200). The cron runs every 5 minutes; a batch of 100 is sufficient for normal recovery. If a large backlog accumulates, subsequent invocations drain the remainder.
- No `remaining` count is computed — the next invocation picks up remaining rows.
- The `log` import is already present in `admin.ts` — add structured logging if needed, but the base `replayDeliveries()` already logs per-delivery errors.

#### 2. Env var — no change required

`qstashAuth` reads `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` from the `qstashEnv` preset already included in `env.ts`. No new env vars are needed for the cron route itself.

The QStash schedule URL (the relay deployment URL) is a QStash-side configuration — not an env var in relay.

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck` passes (no new type errors from the `lt` import or route handler)
- [ ] `pnpm check` passes (linting/formatting)
- [ ] New route appears in `apps/relay/src/routes-table.ts` output (if applicable to dev tooling)

#### Manual Verification
- [ ] `curl -X POST https://<relay-url>/api/admin/recovery/cron` without a valid QStash signature returns `401 { "error": "missing_signature" }`
- [ ] Route is not reachable via GET (405)

---

## Phase 2: Tests

### Overview

Add test coverage for `POST /api/admin/recovery/cron` in `admin.test.ts` following the patterns established by the existing admin route tests.

### Changes Required

#### 1. New test suite for the recovery cron route

**File**: `apps/relay/src/routes/admin.test.ts`

Add a `describe("POST /admin/recovery/cron")` block. Key test cases:

**Test 1 — no auth returns 401**
```typescript
it("returns 401 without QStash signature", async () => {
  const res = await app.request("/api/admin/recovery/cron", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(401);
});
```

**Test 2 — no stuck deliveries returns empty result**
```typescript
it("returns ok with empty arrays when no stuck deliveries", async () => {
  // DB seeded with no 'received' rows older than 5 minutes
  const res = await app.request("/api/admin/recovery/cron", {
    method: "POST",
    headers: qstashAuthHeaders({}), // mock valid signature
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ status: "ok", replayed: [], skipped: [], failed: [] });
});
```

**Test 3 — stuck delivery is replayed**
```typescript
it("replays stuck delivery older than 5 minutes", async () => {
  // Insert a delivery with status='received' and receivedAt = 10 minutes ago
  const staleDelivery = await db.insert(gatewayWebhookDeliveries).values({
    id: nanoid(),
    provider: "github",
    deliveryId: "test-delivery-123",
    eventType: "push",
    status: "received",
    payload: JSON.stringify({ ref: "refs/heads/main", repository: { id: 12345 } }),
    receivedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  }).returning();

  const res = await app.request("/api/admin/recovery/cron", {
    method: "POST",
    headers: qstashAuthHeaders({}),
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.replayed).toContain("test-delivery-123");
  expect(body.failed).toHaveLength(0);
});
```

**Test 4 — recent delivery (< 5 minutes) is NOT swept**
```typescript
it("does not replay deliveries received within the last 5 minutes", async () => {
  // Insert a delivery with status='received' and receivedAt = 2 minutes ago
  await db.insert(gatewayWebhookDeliveries).values({
    id: nanoid(),
    provider: "github",
    deliveryId: "fresh-delivery-456",
    eventType: "push",
    status: "received",
    payload: JSON.stringify({ ref: "refs/heads/main", repository: { id: 99999 } }),
    receivedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  });

  const res = await app.request("/api/admin/recovery/cron", {
    method: "POST",
    headers: qstashAuthHeaders({}),
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.replayed).not.toContain("fresh-delivery-456");
  expect(body.skipped).not.toContain("fresh-delivery-456");
});
```

**Test 5 — delivery with null payload is skipped, not failed**
```typescript
it("skips deliveries with null payload", async () => {
  await db.insert(gatewayWebhookDeliveries).values({
    id: nanoid(),
    provider: "github",
    deliveryId: "null-payload-789",
    eventType: "push",
    status: "received",
    payload: null,
    receivedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  });

  const res = await app.request("/api/admin/recovery/cron", {
    method: "POST",
    headers: qstashAuthHeaders({}),
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.skipped).toContain("null-payload-789");
  expect(body.failed).not.toContain("null-payload-789");
});
```

Follow the existing test file's mocking patterns for `workflowClient.trigger()` and `qstashAuth` verification (look at how `relay-fault-injection.test.ts` and `admin.test.ts` mock these). The mock for `qstashAuth` in tests likely bypasses signature verification — confirm the pattern used in existing admin route tests and match it exactly.

### Success Criteria

#### Automated Verification
- [ ] All 5 new test cases pass: `pnpm --filter @lightfast/relay test`
- [ ] No regressions in existing admin tests
- [ ] `pnpm typecheck` passes
- [ ] `pnpm check` passes

---

## Phase 3: QStash Schedule Setup

### Overview

Register a QStash schedule that calls `POST /api/admin/recovery/cron` every 5 minutes. This is a one-time deployment step, not application code.

### Setup Steps

#### Option A: QStash Dashboard (recommended for initial setup)

1. Open the Upstash QStash console
2. Navigate to **Schedules** → **Create Schedule**
3. Configure:
   - **URL**: `https://<relay-production-url>/api/admin/recovery/cron`
   - **Cron**: `*/5 * * * *` (every 5 minutes)
   - **Method**: POST
   - **Body**: `{}` (empty JSON object — the route ignores the body)
   - **Headers**: none required (QStash adds `Upstash-Signature` automatically)
4. Save the schedule

#### Option B: One-time bootstrap script

Run once from a local machine with `QSTASH_TOKEN` set:

```typescript
import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

await qstash.schedules.create({
  destination: "https://<relay-production-url>/api/admin/recovery/cron",
  cron: "*/5 * * * *",
  body: JSON.stringify({}),
  headers: { "Content-Type": "application/json" },
});
```

#### Option C: Environment-based schedule bootstrap (deferred)

If the schedule ever needs to be managed programmatically (e.g., recreated on deploy), a `POST /api/admin/recovery/setup` endpoint guarded by `apiKeyAuth` could idempotently call `qstash.schedules.create()`. This is out of scope for the initial implementation — defer until there is an operational need.

### No `vercel.json` changes

The `apps/relay/vercel.json` does NOT need a `crons` entry. QStash schedules are managed entirely within the Upstash platform — they call the relay endpoint from outside Vercel's cron infrastructure. The relay endpoint is a standard POST route, not a Vercel cron handler.

### Success Criteria

#### Manual Verification
- [ ] QStash schedule appears in the Upstash dashboard for the relay URL
- [ ] Schedule fires at the configured interval (verify via QStash delivery logs)
- [ ] Relay logs show `POST /api/admin/recovery/cron` requests arriving every 5 minutes
- [ ] A test stuck delivery (inserted directly into DB with `status='received'` and `received_at` = 10 minutes ago) is re-triggered within one cron interval and advances to `enqueued`

---

## Testing Strategy

### Unit Tests (`admin.test.ts`)

Five test cases covering:
- Missing auth → 401
- No stuck deliveries → `{ status: "ok", replayed: [], skipped: [], failed: [] }`
- Stale delivery → appears in `replayed[]`
- Fresh delivery (< 5 min) → not included in any result array
- Null payload delivery → appears in `skipped[]`, not `failed[]`

### Integration / Manual Tests

- Insert a row with `status='received'` and `received_at` 10 minutes ago via `pnpm db:studio` or direct SQL
- Wait for the next cron invocation (or call the endpoint manually with a valid QStash test signature from the Upstash dashboard)
- Verify the row moves to `status='enqueued'` within one cron interval
- Verify Console ingress received the re-delivered webhook (check Console ingress logs)

### Regression Tests

All existing admin route tests must continue to pass. The new route does not modify any existing route logic.

## Performance Considerations

- The `recoveryIdx` partial index (Phase 0) ensures the query `WHERE status = 'received' AND received_at < $staleThreshold` is served entirely from the partial index — it never scans rows with other statuses.
- `BATCH_SIZE = 100` bounds the cron's per-invocation DB read and `workflowClient.trigger()` calls. With a 5-minute schedule and normal webhook volumes, 100 should be more than sufficient. If a sustained failure mode fills more than 100 rows per 5-minute window, subsequent invocations drain the backlog.
- `replayDeliveries()` iterates deliveries sequentially (not in parallel) — this is the existing implementation and is acceptable for batch sizes up to a few hundred. No change needed.

## Migration Notes

- Phase 0 must land (DB migration applied) before Phase 1 is deployed. The cron route works without the partial index (it falls back to the existing `statusIdx`), but the partial index is needed for efficient queries at scale.
- The `failReason` column added in Phase 0 is nullable. No data migration required — existing rows will have `null` for `failReason`.
- The QStash schedule (Phase 3) can be registered before the route is deployed — QStash will log delivery failures and retry. Register it after the route is deployed to avoid noise.

## References

- Research: `thoughts/shared/research/2026-03-18-delivery-recovery-cron.md`
- Phase 0 DB schema: `thoughts/shared/research/2026-03-18-phase0-db-schema-migration.md`
- `replayDeliveries()`: `apps/relay/src/lib/replay.ts:27-97`
- Manual catchup endpoint (pattern reference): `apps/relay/src/routes/admin.ts:114-203`
- `qstashAuth` middleware: `apps/relay/src/middleware/auth.ts:30-46`
- `webhookDeliveryWorkflow` (5-step workflow with dedup): `apps/relay/src/routes/workflows.ts:38-225`
- QStash `deduplicationId` in Step 4: `apps/relay/src/routes/workflows.ts:161-191`
- `gatewayWebhookDeliveries` schema: `db/console/src/schema/tables/gateway-webhook-deliveries.ts`

---
date: 2026-03-18T00:00:00+00:00
researcher: claude
git_commit: 335e4cde545d6c236a9ee1945cd723ad4bff4b50
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "Delivery Recovery Cron — automated re-fire of stuck received deliveries"
tags: [research, codebase, relay, upstash-workflow, qstash, webhooks, cron, gatewayWebhookDeliveries]
status: complete
last_updated: 2026-03-18
---

# Research: Delivery Recovery Cron

**Date**: 2026-03-18
**Git Commit**: `335e4cde545d6c236a9ee1945cd723ad4bff4b50`
**Branch**: `refactor/define-ts-provider-redesign`

## Research Question

What is needed to implement an automated cron that re-fires deliveries stuck in `status = 'received'` for more than 2 minutes in `gatewayWebhookDeliveries`? Research covers: the manual `replay/catchup` endpoint, `lib/replay.ts`, the `webhookDeliveryWorkflow`, the table schema, relay's `app.ts` registration pattern, whether relay uses Inngest, the relay directory structure, Vercel crons configuration, `workflowClient.trigger()` options, and how the existing replay path deduplicates re-fired webhooks.

---

## Summary

Relay is a Hono/srvx edge-runtime service that has **no existing cron infrastructure** — no Inngest client, no QStash schedules, and no `crons` entries in `vercel.json`. The manual `POST /api/admin/replay/catchup` endpoint already performs the exact DB query (status=received, by installationId) and calls `replayDeliveries()`. The `replayDeliveries()` function in `lib/replay.ts` is the central re-fire primitive: it triggers `workflowClient.trigger()` to re-run the full `webhookDeliveryWorkflow` for each stuck delivery.

Deduplication for the recovery path relies on two layers:
1. **DB**: `gatewayWebhookDeliveries` has a `UNIQUE(provider, delivery_id)` index + `.onConflictDoNothing()` in the workflow's `persist-delivery` step — re-triggering the same delivery a second time is safe because the persist step is idempotent.
2. **QStash**: `publishJSON` uses `deduplicationId: \`${provider}_${deliveryId}\`` in the `publish-to-console` step — QStash deduplicates within its 24-hour window so the same delivery is never double-published to Console ingress.

The cron mechanism itself does not yet exist. The correct implementation pattern for relay is a **Vercel cron** (`vercel.json` `crons` array pointing to a new `POST /api/admin/recovery` route), since relay is deployed on Vercel and does not use Inngest. Upstash QStash crons (`qstash.schedules.create(...)`) are an alternative since the QStash client is already available in relay.

---

## Detailed Findings

### 1. The `gatewayWebhookDeliveries` Table Schema

**File**: `db/console/src/schema/tables/gateway-webhook-deliveries.ts`

```
lightfast_gateway_webhook_deliveries
├── id             varchar(191) PK (nanoid)
├── provider       varchar(50) NOT NULL
├── delivery_id    varchar(191) NOT NULL
├── event_type     varchar(191) NOT NULL
├── installation_id varchar(191) nullable
├── status         varchar(50) NOT NULL  -- received|enqueued|delivered|dlq
├── payload        text nullable         -- raw JSON payload, for replay
└── received_at    timestamp(tz) NOT NULL
```

**Indexes**:
- `UNIQUE(provider, delivery_id)` — `gateway_wd_provider_delivery_idx`
- `INDEX(status)` — `gateway_wd_status_idx`

The `status` field uses the progression: `received` → `enqueued` → `delivered` (or `dlq`).

A "stuck" delivery is one where `status = 'received'` and `received_at < NOW() - INTERVAL '2 minutes'`. The `payload` column stores the raw JSON needed for re-triggering. There is no `resourceId` column — it is re-extracted from `payload` at replay time via the provider's `extractResourceId()` method.

### 2. The `replayDeliveries()` Function

**File**: `apps/relay/src/lib/replay.ts`

This is the shared replay primitive used by both admin endpoints. It accepts `GatewayWebhookDelivery[]` and returns `{ replayed, skipped, failed }`.

**Per-delivery logic**:
1. Skip if `delivery.payload` is null (adds to `skipped`)
2. Parse `delivery.payload` as JSON
3. Re-extract `resourceId` via `providerDef.webhook.extractResourceId(parsedPayload)` — returns `null` if provider not found or extraction throws (non-fatal, workflow handles null)
4. Call `workflowClient.trigger()` with this payload shape (matching `WebhookReceiptPayload`):
   ```typescript
   {
     provider: delivery.provider,
     deliveryId: delivery.deliveryId,
     eventType: delivery.eventType,
     resourceId,                          // re-extracted or null
     payload: parsedPayload,
     receivedAt: new Date(delivery.receivedAt).getTime(),  // epoch ms
   }
   ```
   Target URL: `${relayBaseUrl}/workflows/webhook-delivery`
   Headers: `{ "Content-Type": "application/json" }`
5. On trigger success: add to `replayed`, then reset DB `status` back to `"received"` (best-effort — DB failure is non-fatal, already in `replayed`)
6. On trigger failure: add to `failed`

**Import path**: `import { replayDeliveries } from "../lib/replay.js"`

### 3. The `workflowClient.trigger()` Call

**File**: `vendor/upstash-workflow/src/client.ts`

The client is `new Client({ token: env.QSTASH_TOKEN })` — a thin wrapper around `@upstash/workflow`'s `Client`. The trigger call used in `replay.ts` uses three options only:

```typescript
await workflowClient.trigger({
  url: string,           // full URL of the Hono workflow endpoint
  body: string,          // JSON.stringify(WebhookReceiptPayload)
  headers: { "Content-Type": "application/json" },
});
```

The same three-option signature is used in `webhooks.ts` (line 156). No workflow-level deduplication options (like `workflowRunId`) are passed — dedup is handled downstream in the workflow itself via `onConflictDoNothing` and QStash `deduplicationId`.

### 4. The `webhookDeliveryWorkflow` — What a Re-fire Triggers

**File**: `apps/relay/src/routes/workflows.ts`

The workflow registered at `POST /api/workflows/webhook-delivery` runs five steps:

| Step | Name | What it does |
|------|------|-------------|
| 1 | `persist-delivery` | `INSERT ... ON CONFLICT DO NOTHING` — **idempotent** |
| 2 | `resolve-connection` | DB lookup: `gatewayResources` → `gatewayInstallations` to get `connectionId + orgId` |
| 3 | `route` | If no connection: publish to `webhook-dlq` QStash topic, update status to `dlq`. If connection: update `installationId` on the row, return `"console"` |
| 4 | `publish-to-console` | `qstash.publishJSON()` to `${consoleUrl}/api/gateway/ingress` with **`deduplicationId: \`${provider}_${deliveryId}\``** and `retries: 5` |
| 5 | `update-status-enqueued` | Sets status = `"enqueued"` |

Step 1 being `onConflictDoNothing` is the critical idempotency guarantee: if the cron re-triggers a delivery that already completed Step 1 (which it did — the original webhook trigger ran Step 1 before the workflow stalled), the DB insert silently no-ops. The workflow still re-runs Steps 2–5.

Step 4's `deduplicationId` ensures QStash will not double-publish to Console ingress within its 24-hour dedup window, even if the recovery cron fires multiple times.

### 5. The Manual `replay/catchup` Endpoint

**File**: `apps/relay/src/routes/admin.ts` (lines 114–203)

`POST /api/admin/replay/catchup` — requires `X-API-Key` auth.

**Request body** (validated with Zod):
```typescript
{
  installationId: string,          // required
  batchSize?: number,              // 1–200, default 50
  provider?: string,               // optional filter
  since?: string,                  // optional receivedAt lower bound (ISO)
  until?: string,                  // optional receivedAt upper bound (ISO)
}
```

**Query logic**:
```typescript
WHERE status = 'received'
  AND installation_id = :installationId
  [AND provider = :provider]
  [AND received_at >= :since]
  [AND received_at <= :until]
ORDER BY received_at ASC
LIMIT :batchSize
```

After calling `replayDeliveries()`, it counts remaining rows (excluding just-replayed IDs) and returns `{ status: "replayed", replayed, skipped, failed, remaining }`.

**Key difference from what the cron needs**: The catchup endpoint requires `installationId` (scoped to one installation). The cron needs to sweep across **all** installations globally, filtering only by `status = 'received'` and `received_at < NOW() - 2 minutes`.

### 6. The Admin DLQ Replay — Deduplication Pattern

**File**: `apps/relay/src/routes/admin.ts` (lines 75–112)

`POST /api/admin/dlq/replay` fetches rows with `status = 'dlq'` then calls `replayDeliveries()`. No explicit dedup check before calling `replayDeliveries()` — relies entirely on the downstream idempotency (DB `onConflictDoNothing` + QStash `deduplicationId`).

The recovery cron can use the same pattern: fetch stuck `received` rows and call `replayDeliveries()` directly without pre-dedup checks.

### 7. Relay's `app.ts` — Route Registration

**File**: `apps/relay/src/app.ts`

Routes registered:
```typescript
app.route("/api/webhooks", webhooks);
app.route("/api/admin", admin);
app.route("/api/workflows", workflows);
```

A new cron handler would be added to the `admin` router (already at `/api/admin`) or as a new top-level route. The admin router is defined in `apps/relay/src/routes/admin.ts` and imported as `admin` in `app.ts`. A new `POST /api/admin/recovery/cron` route appended to `admin.ts` would be the most natural fit — it sits alongside `replay/catchup` and `dlq/replay`.

### 8. Relay's Directory Structure

```
apps/relay/src/
├── app.ts                  # Hono app, route registration
├── env.ts                  # T3 env schema
├── index.ts                # srvx entry point
├── routes-table.ts         # dev route printing
├── sentry-init.ts
├── __fixtures__/           # test fixtures (JSON)
├── lib/
│   ├── replay.ts           # replayDeliveries() — the re-fire primitive
│   ├── replay.test.ts
│   └── urls.ts             # relayBaseUrl, consoleUrl
├── middleware/
│   ├── auth.ts             # apiKeyAuth, qstashAuth
│   ├── error-sanitizer.ts
│   ├── lifecycle.ts
│   ├── request-id.ts
│   ├── sentry.ts
│   └── webhook.ts          # webhook middleware chain (7 steps)
└── routes/
    ├── admin.ts             # /api/admin/* — health, dlq, catchup, delivery-status
    ├── admin.test.ts
    ├── relay-fault-injection.test.ts
    ├── relay-post-teardown.test.ts
    ├── relay-scenario-matrix.test.ts
    ├── webhooks.ts          # /api/webhooks/:provider
    ├── webhooks.test.ts
    ├── workflows.ts         # /api/workflows/webhook-delivery (Upstash Workflow)
    └── workflows.test.ts
```

There is **no `crons/` directory** and no existing cron infrastructure anywhere in relay.

### 9. Vercel Cron Configuration — Current State

**File**: `apps/relay/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm turbo run build --filter=@lightfast/relay...",
  "installCommand": "pnpm install",
  "ignoreCommand": "npx turbo-ignore"
}
```

No `crons` array. Same pattern for `apps/gateway/vercel.json` and `apps/backfill/vercel.json` — **none of the three Hono services have any Vercel crons configured**.

The built Vercel output at `apps/relay/.vercel/output/config.json` shows `"crons": []` — confirming no crons in the current deployment artifact.

### 10. Does Relay Use Inngest?

No. Relay has **no Inngest dependency** anywhere in its source. Inngest is only used in `api/console/src/inngest/` and `apps/backfill/src/inngest/`. Relay uses Upstash Workflow (for durable webhook processing) and QStash (for publishing to Console ingress). The `env.ts` does not include any Inngest env vars.

### 11. Available Scheduling Mechanisms for Relay

Given relay's infrastructure, there are two viable approaches for the cron:

**Option A: Vercel Cron** (most natural for this codebase)
- Add a `crons` entry in `apps/relay/vercel.json`:
  ```json
  "crons": [{ "path": "/api/admin/recovery/cron", "schedule": "* * * * *" }]
  ```
- Vercel calls the endpoint every minute via GET (Vercel crons always use GET)
- The route would need to validate the `Authorization: Bearer <CRON_SECRET>` header (Vercel cron auth pattern)
- Minimum schedule is every minute (`* * * * *`)

**Option B: QStash Schedule** (uses existing infra)
- The QStash client is already available in relay (`@vendor/qstash`)
- QStash schedules can be created via `qstash.schedules.create({ destination, cron, body })` to call the recovery endpoint on a schedule
- Would require a separate bootstrap step to register the schedule

### 12. Authentication for a Cron Route

**File**: `apps/relay/src/middleware/auth.ts`

Two existing middleware:
- `apiKeyAuth` — validates `X-API-Key` against `GATEWAY_API_KEY`. This is used by the existing admin endpoints.
- `qstashAuth` — validates QStash `Upstash-Signature`.

For a Vercel cron, Vercel sends `Authorization: Bearer ${CRON_SECRET}` — this would need a new `cronAuth` middleware or the route can be called through `apiKeyAuth` by pre-configuring a shared secret.

For a QStash-triggered cron, `qstashAuth` is the right middleware (already handles retry signature verification).

### 13. The `WebhookReceiptPayload` Contract

**Import**: `@repo/app-providers/contracts`

Used as the `workflowClient.trigger()` body type in both `webhooks.ts` and `replay.ts`. Fields:
```typescript
{
  provider: string,
  deliveryId: string,
  eventType: string,
  resourceId: string | null,
  payload: unknown,
  receivedAt: number,       // epoch milliseconds
  correlationId?: string,   // optional, not present on replay
}
```

The recovery cron would construct this same shape from the stored DB row fields, identical to how `replayDeliveries()` does it today.

### 14. The `isWebhookProvider` Check in `replayDeliveries`

`replay.ts` calls `getProvider(providerName)` and then `isWebhookProvider(providerDef)` before calling `extractResourceId`. This guard is already present — no additional check needed in the cron path since `replayDeliveries()` handles non-webhook providers gracefully (resourceId falls back to null).

---

## Code References

- `apps/relay/src/lib/replay.ts:27-97` — `replayDeliveries()` — the shared re-fire primitive
- `apps/relay/src/lib/replay.ts:58-69` — `workflowClient.trigger()` call with full payload shape
- `apps/relay/src/routes/admin.ts:114-203` — `POST /api/admin/replay/catchup` — manual sweep endpoint
- `apps/relay/src/routes/admin.ts:154-178` — SQL query for stuck `received` deliveries (catchup query pattern)
- `apps/relay/src/routes/workflows.ts:38-225` — `webhookDeliveryWorkflow` — full 5-step workflow
- `apps/relay/src/routes/workflows.ts:43-57` — Step 1: `persist-delivery` with `onConflictDoNothing` (idempotency)
- `apps/relay/src/routes/workflows.ts:161-191` — Step 4: `publish-to-console` with `deduplicationId: \`${provider}_${deliveryId}\``
- `apps/relay/src/app.ts:65-67` — route registration: admin at `/api/admin`, workflows at `/api/workflows`
- `apps/relay/src/middleware/auth.ts:11-20` — `apiKeyAuth` middleware (X-API-Key validation)
- `apps/relay/src/middleware/auth.ts:30-46` — `qstashAuth` middleware (Upstash-Signature validation)
- `apps/relay/vercel.json` — no `crons` array present
- `apps/relay/.vercel/output/config.json` — `"crons": []` (confirmed empty in last build)
- `db/console/src/schema/tables/gateway-webhook-deliveries.ts:11-46` — full table schema
- `db/console/src/schema/tables/gateway-webhook-deliveries.ts:35-36` — `UNIQUE(provider, delivery_id)` index
- `vendor/upstash-workflow/src/client.ts:4` — `workflowClient` instantiation (`Client({ token: QSTASH_TOKEN })`)

---

## Architecture Documentation

### Deduplication Stack (Why the Cron is Safe)

Re-triggering the same `deliveryId` multiple times is safe due to three independent dedup layers:

1. **DB unique index + onConflictDoNothing** (`workflows.ts:56`): Step 1 of the workflow is a DB INSERT with `ON CONFLICT DO NOTHING` on `(provider, delivery_id)`. Even if the cron fires while a previous workflow run is still in-flight, the second run's persist step silently no-ops.

2. **QStash deduplicationId** (`workflows.ts:180`): `deduplicationId: \`${provider}_${deliveryId}\`` prevents QStash from delivering the same message to Console ingress twice within its 24-hour dedup window.

3. **Status progression**: Once the workflow advances the delivery to `enqueued`, `delivered`, or `dlq`, those rows no longer match `status = 'received'` and are excluded from future cron sweeps.

### The "Stuck in received" Failure Mode

The normal flow for a standard webhook is:
1. `POST /api/webhooks/:provider` → `workflowClient.trigger()` → returns 200 to provider
2. Upstash Workflow calls back `POST /api/workflows/webhook-delivery`
3. Step 1 sets `status = 'received'` in DB
4. Steps 2–5 advance to `enqueued` or `dlq`

A delivery stays at `status = 'received'` if Step 1 of the workflow ran (the DB write happened) but the Upstash Workflow failed to continue beyond Step 1, OR if the initial `workflowClient.trigger()` call in `webhooks.ts` succeeded (so no DB row was written yet) but the workflow's first callback was never received. In the latter case no DB row exists and there is nothing to recover — the cron only rescues rows that reached the `received` state in DB.

The `received_at` timestamp is set at webhook ingestion time, so `received_at < NOW() - 2 minutes` is a reliable staleness indicator.

### Cron Query Shape

The recovery cron needs a query that differs from `replay/catchup` in one key way — it must sweep **all installations globally**, not scoped to one `installationId`:

```sql
SELECT * FROM lightfast_gateway_webhook_deliveries
WHERE status = 'received'
  AND received_at < NOW() - INTERVAL '2 minutes'
ORDER BY received_at ASC
LIMIT :batchSize
```

The `status` index (`gateway_wd_status_idx`) covers this query efficiently.

### Relay Has No Inngest

Relay is purely Upstash/QStash/Hono. The Inngest client only exists in `api/console` (Next.js API routes) and `apps/backfill` (workflow orchestration). Adding Inngest to relay would require adding `@vendor/inngest` as a dep and setting `INNGEST_*` env vars — not the pattern used here.

---

## Historical Context (from thoughts/)

No prior research documents exist specifically about relay cron infrastructure. The most relevant prior research:

- `thoughts/shared/research/2026-03-17-relay-upstash-to-inngest-migration.md` — covers why relay uses Upstash Workflow (not Inngest) and the tradeoffs
- `thoughts/shared/plans/2026-03-18-provider-architecture-redesign.md` — unrelated to cron but covers active refactor context

---

## Open Questions

1. **Vercel cron vs. QStash schedule**: Vercel crons use GET requests and require `CRON_SECRET` env var validation. QStash schedules use POST with `Upstash-Signature` auth (already wired via `qstashAuth`). No prior art in this repo for either pattern.

2. **Batch size for the cron**: The catchup endpoint uses a configurable `batchSize` (1–200, default 50). The cron needs a fixed or env-configured batch size. If there are more stuck deliveries than the batch size, the next cron invocation (1 minute later) picks up the remainder.

3. **Cross-provider scope**: The cron sweeps all providers at once. If provider-specific filtering is needed (e.g., skip certain providers during incidents), the catchup endpoint's `provider` filter shows the pattern.

4. **Auth for GET (Vercel cron)**: `apiKeyAuth` checks `X-API-Key`, not `Authorization: Bearer`. A Vercel cron would need either a new middleware checking `Authorization: Bearer ${CRON_SECRET}` or the endpoint can be conditionally open (no auth) since Vercel internally invokes it — but that is not safe in this codebase's pattern.

5. **`resourceId` staleness**: `replayDeliveries()` re-extracts `resourceId` from the stored payload at replay time. This is correct — the stored `payload` contains the original provider JSON, and `extractResourceId` is deterministic. The `installationId` column may be null at this point (it's set by the workflow's Step 3), but that is expected for stuck deliveries.

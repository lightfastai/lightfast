---
date: 2026-04-03T00:00:00+00:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "NonRetriableError(no_connection) in ingest-delivery — root cause and retry loop"
tags: [research, codebase, ingest-delivery, inngest, gateway, webhook, delivery-recovery]
status: complete
last_updated: 2026-04-03
---

# Research: `NonRetriableError("no_connection")` in `ingest-delivery`

**Date**: 2026-04-03
**Git Commit**: 34f5b76837648856dc476b8f947679021f7a6679
**Branch**: chore/remove-memory-api-key-service-auth

## Research Question

Why does `api/platform/src/inngest/functions/ingest-delivery.ts:87` throw `NonRetriableError("no_connection")`, and is it related to the recent removal of the `MEMORY_API_KEY` service-auth ingest path?

## Summary

The error is **not a regression** from the service-auth removal. It is pre-existing behavior that fires when an incoming webhook's `resourceId` cannot be resolved to an active `gatewayResources` row. In local dev, the proximate cause is orphaned `gatewayWebhookDeliveries` rows whose connections were deleted outside the normal teardown flow. A secondary issue: `NonRetriableError` never writes a terminal DB status, so `delivery-recovery` retries the delivery indefinitely every 5 minutes.

## Detailed Findings

### 1. How `connectionInfo` Is Resolved

`ingest-delivery.ts:51-84` — the `resolve-connection` step has two paths:

1. **`data.preResolved` is set** (line 52-53): returns `{ connectionId, orgId }` directly, skipping DB. Used by backfill-orchestrator, entity-worker, and delivery-recovery (when `installationId` is known).
2. **`data.resourceId` is set** (line 56-83): JOINs `gatewayResources → gatewayInstallations` on `providerResourceId = resourceId AND status = 'active'`. Returns `{ connectionId: installationId, orgId }` or `null` if no row.
3. **Neither**: returns `null` immediately (line 57-58).

`null` → `NonRetriableError("no_connection")` at line 87.

### 2. The Live HTTP Webhook Path

`apps/platform/src/app/api/ingest/[provider]/route.ts:52`:

1. Validates signature via `webhookDef.verifySignature`
2. Extracts `deliveryId`, `eventType`, `resourceId` from parsed payload
3. Inserts into `gatewayWebhookDeliveries` with `installationId: null`, `status: 'received'` (line 167-177)
4. Fires `inngest.send("memory/webhook.received", { ..., resourceId })` — no `preResolved` (line 180-191)

The `installationId: null` on the DB row is important for the retry loop below.

### 3. Which Providers Can Produce Null `resourceId`

All four webhook providers can return `null` from `extractResourceId` for certain event types:

| Provider | Null when... | Example events |
|----------|--------------|----------------|
| GitHub (`github/index.ts:137-149`) | `repository` and `installation` both absent | `ping`, `installation.created`, `marketplace_purchase` |
| Linear (`linear/index.ts:402-405`) | `organizationId` absent | `AppInstalled`, `AppUninstalled`, `AppUserAuthorized` |
| Sentry (`sentry/index.ts:275-278`) | `installation.uuid` absent | `installation.created` (OAuth setup lifecycle) |
| Vercel (`vercel/index.ts:274-290`) | `payload.project.id` and `payload.team.id` both absent | `integration-configuration.removed`, `project.created/removed` |

All four providers use loose Zod schemas that make these fields optional, so lifecycle/system events pass payload validation and reach `extractResourceId`.

### 4. The `delivery-recovery` Infinite Retry Loop

`api/platform/src/inngest/functions/delivery-recovery.ts` — cron `*/5 * * * *`:

1. Queries `gatewayWebhookDeliveries WHERE status = 'received' AND receivedAt < now-5m` (lines 38-48)
2. For each row: if `delivery.installationId` is non-null → builds `preResolved`. If null → omits `preResolved`.
3. Re-fires `memory/webhook.received` with `resourceId` and no `preResolved` (for live webhook rows, which always have `installationId = null`)
4. Writes `status = 'received'` back to DB (lines 124-133) — a no-op since it never changed

**Critical gap**: `ingest-delivery.ts` has no status update on the `NonRetriableError("no_connection")` path. The only status writes in that function are:
- `status = 'skipped'` (line 155-160) — unsupported event types only
- `status = 'processed'` (line 198-203) — successful end-to-end completion

Result: a delivery that fails with `no_connection` stays `status = 'received'` forever, gets picked up by the cron every 5 minutes, re-fails, repeats indefinitely.

### 5. What the Service-Auth Removal Changed

`34f5b76837648856dc476b8f947679021f7a6679` deleted `handleServiceAuth()` from the ingest route — an alternate HTTP path that:
- Authenticated via `x-api-key: MEMORY_API_KEY` header
- Accepted a pre-structured body with `connectionId`, `orgId` already resolved
- Always set `preResolved: { connectionId, orgId }` on the Inngest event

No live callers remained at time of removal (backfill had already migrated to calling `inngest.send()` directly). The `data.preResolved` check in `ingest-delivery.ts:52` remains correct and is still used by backfill-orchestrator, entity-worker, and delivery-recovery (for rows with `installationId` populated).

The service-auth field `serviceAuth: true` was also removed from `api/platform/src/inngest/schemas/memory.ts` — it was a metadata marker that `ingest-delivery.ts` never read.

### 6. Local Dev Context

The `no_connection` errors in local dev stem from orphaned `gatewayWebhookDeliveries` rows whose `gatewayResources`/`gatewayInstallations` rows were deleted manually (not via the teardown flow). The teardown flow (`connection-lifecycle.ts:119-151`) sets `gatewayResources.status = 'removed'` before deletion — manual deletion bypasses this and leaves rows the JOIN can no longer match.

To clear local noise:
```sql
UPDATE lightfast_gateway_webhook_deliveries SET status = 'dlq' WHERE status = 'received';
```

In production, users go through the proper disconnect flow, so this scenario does not arise the same way.

## Code References

- `api/platform/src/inngest/functions/ingest-delivery.ts:51-88` — resolve-connection step and NonRetriableError throw
- `api/platform/src/inngest/functions/delivery-recovery.ts:33-133` — cron query, preResolved branch, re-fire, status reset
- `apps/platform/src/app/api/ingest/[provider]/route.ts:163-191` — extractResourceId call, DB insert with `installationId: null`, Inngest dispatch
- `packages/app-providers/src/providers/github/index.ts:137-149` — GitHub `extractResourceId`
- `packages/app-providers/src/providers/linear/index.ts:402-405` — Linear `extractResourceId`
- `packages/app-providers/src/providers/sentry/index.ts:275-278` — Sentry `extractResourceId`
- `packages/app-providers/src/providers/vercel/index.ts:274-290` — Vercel `extractResourceId`
- `db/app/src/schema/tables/gateway-webhook-deliveries.ts` — table schema, `installationId: null` default for live webhooks
- `db/app/src/schema/tables/gateway-resources.ts:24,29` — `providerResourceId`, `status` columns
- `db/app/src/schema/tables/gateway-installations.ts:30` — `orgId` column
- `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:362-379` — backfill source of `preResolved`
- `api/platform/src/inngest/functions/memory-entity-worker.ts:347-351` — entity-worker source of `preResolved`

## Architecture Documentation

**Connection resolution hierarchy** in `ingest-delivery`:
```
preResolved (internal callers: backfill, entity-worker, delivery-recovery w/ installationId)
  └─ skip DB, use connectionId + orgId directly
resourceId (live HTTP webhooks)
  └─ JOIN gatewayResources.providerResourceId → gatewayInstallations.orgId
     └─ null → NonRetriableError("no_connection")
```

**Status flow for gatewayWebhookDeliveries**:
```
received (inserted by ingest route)
  ├─ processed (successful ingest-delivery run)
  ├─ skipped (unsupported event type)
  ├─ held (backfill hold flag)
  └─ stuck at 'received' if NonRetriableError — delivery-recovery retries every 5m indefinitely
```

**`status = 'active'` on gatewayResources** is set by `connections.registerResource` (OAuth onboarding). Missing active rows = `no_connection`.

## Open Questions

- Should `ingest-delivery.ts` update `gatewayWebhookDeliveries.status = 'dlq'` when throwing `NonRetriableError("no_connection")` to stop the infinite retry loop?
- Should lifecycle/system webhook events (null `resourceId`) be filtered out at the ingest route level before reaching Inngest?

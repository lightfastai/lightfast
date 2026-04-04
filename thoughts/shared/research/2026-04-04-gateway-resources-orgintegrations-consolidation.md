---
date: 2026-04-04T05:30:00+00:00
researcher: claude
git_commit: 3eb07cd5e1e61b92bbdb27a79a9c317872a28e35
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "Consolidate gatewayResources into orgIntegrations — consumer analysis and migration plan"
tags: [research, codebase, gateway-resources, org-integrations, gateway-installations, schema-cleanup, webhook-routing, backfill]
status: superseded-by-plan
last_updated: 2026-04-04
last_updated_note: "CORRECTION: resourceName is load-bearing for backfill API routing (GitHub owner/repo, Sentry orgSlug/projectSlug), not just display. Plan uses live resolution via BackfillDef.resolveResourceMeta instead of migrating stale data. Also found: Vercel disconnect missing orgIntegrations cascade (bug), connectedAt on orgIntegrations unused, 3 dead procedures (get, registerResource, removeResource). See thoughts/shared/plans/2026-04-04-consolidate-gateway-resources-into-org-integrations.md"
---

# Research: Consolidate `gatewayResources` into `orgIntegrations`

**Date**: 2026-04-04T05:30:00+00:00
**Git Commit**: 3eb07cd5e
**Branch**: refactor/drop-workspace-abstraction

## Research Question

`gatewayResources` and `orgIntegrations` both map `installationId + providerResourceId + status` for linked provider resources. Are they redundant? Can we consolidate to a single table, and which consumers need migration?

## Summary

**Yes, they are redundant.** Both tables answer the same question — "which provider resources are linked to which installation?" — but were built for different service boundaries (platform vs app). `orgIntegrations` is the richer table (has `clerkOrgId`, `providerConfig`, `documentCount`) and is the correct survivor. `gatewayResources` adds only `resourceName`, which is **not needed** — resource display names are always fetched live from provider APIs (see `sources/page.tsx` prefetching `listInstallations` which proxies to GitHub/Vercel/Linear APIs for live data). Storing it in the DB is redundant and goes stale. Additionally, 3 columns on `orgIntegrations` and 3 columns on `gatewayInstallations` are completely unused and should be dropped.

---

## Detailed Findings

### 1. Table Schema Comparison

#### `orgIntegrations` (`lightfast_org_integrations`)

**Schema**: `db/app/src/schema/tables/org-integrations.ts:29-113`

| Column | Type | Used? | By whom |
|---|---|---|---|
| `id` | varchar(191) PK | Yes | All consumers |
| `clerkOrgId` | varchar(191) | Yes | App router (org scope), event-store gating |
| `installationId` | varchar(191) FK | Yes | All consumers (joins, filters) |
| `provider` | varchar(50) | Yes | Filters, bulkLink |
| `providerConfig` | jsonb | Yes | event-store gating (`sync.events`), resources.list |
| `providerResourceId` | varchar(191) | Yes | Webhook routing, filters, lookups |
| `status` | varchar(50) | Yes | All consumers |
| `statusReason` | varchar(100) | Yes | event-store (logged), disconnect (written) |
| `documentCount` | integer | Yes | resources.list (returned to UI) |
| `connectedAt` | timestamp | Minimal | Default only |
| `createdAt` | timestamp | Minimal | Default only |
| `updatedAt` | timestamp | Yes | Updated on status changes |
| **`lastSyncedAt`** | **timestamp** | **NO** | **Never written, never read** |
| **`lastSyncStatus`** | **varchar(50)** | **NO** | **Written only by seed CLI, never read by app** |
| **`lastSyncError`** | **text** | **NO** | **Never written, never read** |

Indexes: `clerkOrgId`, `installationId`, `status`, `providerResourceId`

#### `gatewayResources` (`lightfast_gateway_resources`)

**Schema**: `db/app/src/schema/tables/gateway-resources.ts:12-48`

| Column | Type | Used? | Equivalent in orgIntegrations? |
|---|---|---|---|
| `id` | varchar(191) PK | Yes | `id` |
| `installationId` | varchar(191) FK | Yes | `installationId` |
| `providerResourceId` | varchar(191) | Yes | `providerResourceId` |
| `resourceName` | varchar(500) | Yes | **Missing — must add** |
| `status` | varchar(50) | Yes | `status` (different values: `active/removed` vs `active/disconnected`) |
| `createdAt` | timestamp | Minimal | `createdAt` |
| `updatedAt` | timestamp | Yes | `updatedAt` |

Unique index: `(installationId, providerResourceId)`

#### `gatewayInstallations` — Unused Columns

**Schema**: `db/app/src/schema/tables/gateway-installations.ts:17-94`

| Column | Status | Evidence |
|---|---|---|
| **`configStatus`** | Never written | Only default `'unknown'` — no consumer sets it |
| **`webhookSecret`** | Never written, never read | Zero references outside schema |
| **`metadata`** | Never written, never read | Zero references outside schema |

---

### 2. `orgIntegrations` — Complete Consumer Map

#### Consumer 1: `api/app/src/router/org/connections.ts`

| Operation | Lines | Type | Columns |
|---|---|---|---|
| `disconnect` (cascade) | 131-138 | WRITE | `status → 'disconnected'`, `statusReason`, `updatedAt` |
| `resources.list` | 487-507 | READ + JOIN | `id`, `provider`, `providerConfig`, `providerResourceId`, `installationId`, `documentCount` + joined `backfillConfig` |
| `resources.bulkLink` (check) | 597-613 | READ | `id`, `status` |
| `resources.bulkLink` (reactivate) | 618-624 | WRITE | `status → 'active'`, `statusReason → null`, `updatedAt` |
| `resources.bulkLink` (create) | 628-634 | WRITE | `clerkOrgId`, `installationId`, `provider`, `providerConfig`, `providerResourceId` |

#### Consumer 2: `api/platform/src/inngest/functions/memory-event-store.ts`

| Operation | Lines | Type | Columns |
|---|---|---|---|
| `check-event-allowed` step | 242-258 | READ | `status`, `statusReason`, `providerConfig.sync.events` |

Gating query: checks integration is `active` and incoming event type is in the configured allow-list.

#### Consumer 3: `packages/app-test-data/src/cli/seed-integrations.ts`

| Operation | Lines | Type | Columns |
|---|---|---|---|
| Idempotency check | 138-146 | READ | `id` |
| Seed insert | 153-163 | WRITE | `id`, `clerkOrgId`, `installationId`, `provider`, `providerConfig`, `providerResourceId`, `status`, `lastSyncStatus`, `documentCount` |

---

### 3. `gatewayResources` — Complete Consumer Map

#### Consumer 1: `api/app/src/router/org/connections.ts` (bulkLink addition)

| Operation | Lines | Type | Columns |
|---|---|---|---|
| Webhook routing upsert | 639-659 | WRITE | `installationId`, `providerResourceId`, `resourceName`, `status`, `updatedAt` |

**Note**: This was just added during this debugging session — can be removed during consolidation.

#### Consumer 2: `api/platform/src/router/memory/connections.ts`

| Procedure | Lines | Type | Columns | Callers |
|---|---|---|---|---|
| `registerResource` (check) | 328-338 | READ | `id` | **Zero callers** |
| `registerResource` (insert) | 349-369 | WRITE | `installationId`, `providerResourceId`, `resourceName`, `status` | **Zero callers** |
| `get` (relational) | 79-93 | READ | all (projected: `id`, `providerResourceId`, `resourceName`) | Internal |
| `removeResource` (check) | 402-413 | READ | all | Internal |
| `removeResource` (update) | 429-432 | WRITE | `status → 'removed'` | Internal |

#### Consumer 3: `api/platform/src/inngest/functions/ingest-delivery.ts`

| Operation | Lines | Type | Columns |
|---|---|---|---|
| `resolve-connection` step | 61-76 | READ + JOIN | `installationId` + joined `gatewayInstallations.orgId` |

**Critical path**: Webhook arrives → query `gatewayResources` by `providerResourceId` → JOIN `gatewayInstallations` for `orgId` → resolve connection.

**After migration**: Query `orgIntegrations` directly by `providerResourceId` — `clerkOrgId` is already on the row, eliminating the JOIN entirely.

#### Consumer 4: `api/platform/src/inngest/functions/connection-lifecycle.ts`

| Operation | Lines | Type | Columns |
|---|---|---|---|
| `remove-resources` (audit) | 167-175 | READ | `providerResourceId` |
| `remove-resources` (bulk update) | 177-180 | WRITE | `status → 'removed'`, `updatedAt` |

**After migration**: Already handled — `connections.disconnect` at `api/app/src/router/org/connections.ts:131-138` already cascades `orgIntegrations.status → 'disconnected'` on teardown.

#### Consumer 5: `api/platform/src/router/memory/backfill.ts`

| Operation | Lines | Type | Columns |
|---|---|---|---|
| `estimate` | 186-197 | READ | `providerResourceId`, `resourceName` |

#### Consumer 6: `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts`

| Operation | Lines | Type | Columns |
|---|---|---|---|
| `get-connection` step | 102-113 | READ | `providerResourceId`, `resourceName` |

Resources with `null` `resourceName` are skipped at lines 173-180 with a warning log.

---

### 4. Why `orgIntegrations` Is the Survivor

| Criterion | `orgIntegrations` | `gatewayResources` |
|---|---|---|
| Has `clerkOrgId` | Yes — eliminates JOIN for webhook routing | No — requires JOIN to `gatewayInstallations` |
| Has `providerConfig` | Yes — sync event gating | No |
| Has `documentCount` | Yes — UI display | No |
| Has `resourceName` | No — **not needed**, fetched live from provider APIs | Yes (redundant, goes stale) |
| Active app-layer consumers | 3 files | 1 file (just added, can remove) |
| Active platform-layer consumers | 1 file | 5 files (all migratable) |
| `registerResource` procedure | N/A | **Zero callers** — dead code |

---

## Migration Plan

### Phase 1: Schema Changes

**Drop from `orgIntegrations`:**
- `lastSyncedAt` — unused
- `lastSyncStatus` — unused
- `lastSyncError` — unused

**Drop from `gatewayInstallations`:**
- `configStatus` — unused
- `webhookSecret` — unused
- `metadata` — unused

### Phase 2: Migrate Platform Consumers

| File | Change |
|---|---|
| `api/platform/src/inngest/functions/ingest-delivery.ts:61-76` | Replace `gatewayResources` JOIN query with `orgIntegrations` query by `providerResourceId` + `status = 'active'` — read `clerkOrgId` directly, no JOIN |
| `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:102-113` | Replace `gatewayResources` query with `orgIntegrations` query by `installationId` + `status = 'active'` — select `providerResourceId` (drop `resourceName` dependency, resolve live if needed for logging) |
| `api/platform/src/router/memory/backfill.ts:186-197` | Same as orchestrator |
| `api/platform/src/inngest/functions/connection-lifecycle.ts:167-180` | Remove `gatewayResources` teardown step — already handled by app-layer `connections.disconnect` cascade at `connections.ts:131-138` |
| `api/platform/src/router/memory/connections.ts:296-388` | Delete `registerResource` procedure (zero callers) |
| `api/platform/src/router/memory/connections.ts:392-435` | Delete `removeResource` procedure or migrate to `orgIntegrations` |
| `api/platform/src/router/memory/connections.ts:79-93` | Update `get` relational query to use `orgIntegrations` relation instead of `resources` |

### Phase 3: Clean Up App Consumers

| File | Change |
|---|---|
| `api/app/src/router/org/connections.ts:639-659` | Remove `gatewayResources` upsert from `bulkLink` (just added during debugging, no longer needed) |

### Phase 4: Drop `gatewayResources`

1. Remove schema definition (`db/app/src/schema/tables/gateway-resources.ts`)
2. Remove from barrel exports (`db/app/src/schema/tables/index.ts`, `db/app/src/schema/index.ts`, `db/app/src/index.ts`)
3. Remove relation (`db/app/src/schema/relations.ts:47-55`)
4. Remove inverse relation from `gatewayInstallationsRelations` (`relations.ts:24`)
5. Generate migration: `cd db/app && pnpm db:generate`

### Phase 5: Update Seed CLI

- `packages/app-test-data/src/cli/seed-integrations.ts` — remove `lastSyncStatus` from seed inserts (column dropped)

---

## Code References

- `db/app/src/schema/tables/org-integrations.ts:29-113` — orgIntegrations schema
- `db/app/src/schema/tables/gateway-resources.ts:12-48` — gatewayResources schema (to be dropped)
- `db/app/src/schema/tables/gateway-installations.ts:17-94` — gatewayInstallations schema
- `db/app/src/schema/relations.ts:20-65` — Drizzle relations for all three tables
- `api/app/src/router/org/connections.ts:538-636` — bulkLink mutation
- `api/platform/src/router/memory/connections.ts:296-388` �� registerResource (dead code)
- `api/platform/src/inngest/functions/ingest-delivery.ts:51-88` — webhook routing (primary migration target)
- `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:78-113` — backfill resource enumeration
- `api/platform/src/inngest/functions/connection-lifecycle.ts:167-198` — teardown resource cleanup
- `api/platform/src/inngest/functions/memory-event-store.ts:242-295` — event gating (already on orgIntegrations)
- `api/platform/src/router/memory/backfill.ts:186-197` — backfill estimate
- `packages/app-test-data/src/cli/seed-integrations.ts:105-163` — seed CLI

## Open Questions

1. **Backfill orchestrator `resourceName` skip**: The orchestrator skips resources with `null` `resourceName` (`memory-backfill-orchestrator.ts:173-180`). After dropping `resourceName` from the DB, the orchestrator should either remove this skip (use `providerResourceId` for logging) or resolve display names live from the provider API at backfill time.
2. **Status value alignment**: `gatewayResources` uses `active/removed`, `orgIntegrations` uses `active/disconnected`. The `connection-lifecycle` teardown step that currently sets `gatewayResources.status = 'removed'` is already redundant with `connections.disconnect` setting `orgIntegrations.status = 'disconnected'` ��� confirm `disconnected` is the correct value for all downstream consumers.
3. **`connectedBy` on `gatewayInstallations`**: Currently only written during OAuth callback. Verify if any future consumer needs it before considering it for cleanup.

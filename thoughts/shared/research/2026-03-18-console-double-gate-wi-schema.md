---
date: 2026-03-18T09:56:21Z
researcher: claude
git_commit: 6a51a4821a7252e51f44d650534e620e469e5faf
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "console double-gate and workspaceIntegrations schema migration"
tags: [research, codebase, event-store, inngest, workspace-integrations, schema-migration, drizzle, isActive, status, dlq]
status: complete
last_updated: 2026-03-18
---

# Research: Console Double-Gate and workspaceIntegrations Schema Migration

**Date**: 2026-03-18T09:56:21Z
**Git Commit**: 6a51a4821a7252e51f44d650534e620e469e5faf
**Branch**: refactor/define-ts-provider-redesign

## Research Question

Comprehensive research for:
1. Adding a WI.status check (Gate 2) in `eventStore`'s `check-event-allowed` step — currently the step queries `workspaceIntegrations` but never checks `isActive`. Events from torn-down connections still get processed.
2. Migrating `workspaceIntegrations.isActive: boolean` → `status: varchar(50)` + `statusReason: varchar(100)` where status values are `active | disconnected | revoked | suspended | removed | deleted | error`.

## Summary

The `check-event-allowed` step in `event-store.ts` fetches a `workspaceIntegrations` row by `(workspaceId, providerResourceId)` and checks only whether `integration.providerConfig` allows the event type — it never tests `isActive`. This means events continue to flow through for deactivated connections.

`workspaceIntegrations.isActive: boolean` is a flat boolean. 12 distinct code paths read or write it. The `gatewayWebhookDeliveries` table does **not** have a `failReason` column — it has only `status` (varchar, values: `received | enqueued | delivered | dlq`). The `workspaceIngestLogs` table also has no `failReason` column. The DLQ path today lives entirely in the relay's `webhook-delivery` Upstash Workflow: when `resolve-connection` yields null, the delivery is published to the `webhook-dlq` QStash topic and the DB row is updated to `status: 'dlq'`.

---

## Detailed Findings

### 1. The `check-event-allowed` Step — Exact Code Path

**File**: `api/console/src/inngest/workflow/neural/event-store.ts` (lines 247–317)

```ts
// Step 2: Check if event is allowed by source config
const eventAllowed = await step.run("check-event-allowed", async () => {
  // ... resolves resourceId from sourceEvent.attributes (per-provider switch) ...

  const integration = await db.query.workspaceIntegrations.findFirst({
    where: and(
      eq(workspaceIntegrations.workspaceId, workspaceId),
      eq(workspaceIntegrations.providerResourceId, resourceId)
    ),
  });

  if (!integration) {
    // returns false → event rejected
  }

  const baseEventType = getBaseEventType(sourceEvent.provider, sourceEvent.eventType);
  const allowed = isEventAllowed(integration.providerConfig, baseEventType);
  return allowed;
});
```

**Missing**: The query has no `eq(workspaceIntegrations.isActive, true)` predicate. If `isActive` is false (or after migration: `status !== 'active'`), `integration` is still returned from the DB and `allowed` is determined purely from `providerConfig.sync.events`. The returned boolean does not carry any indication of whether the integration is active.

When `eventAllowed` is false, the job is completed with `status: "filtered"` and `reason: "event_not_allowed"` (line 323–337). There is no separate filtered reason for inactive connections.

**Provider → resourceId mapping inside the step** (lines 251–274):
- `github` → `attributes.repoId`
- `vercel` → `attributes.projectId`
- `sentry` → `attributes.projectId`
- `linear` → `attributes.teamId`

### 2. Full `workspaceIntegrations` Schema

**File**: `db/console/src/schema/tables/workspace-integrations.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `varchar(191)` PK | nanoid default |
| `workspaceId` | `varchar(191)` FK → orgWorkspaces | cascade delete |
| `installationId` | `varchar(191)` FK → gatewayInstallations | cascade delete |
| `provider` | `varchar(50)` | denormalized SourceType |
| `providerConfig` | `jsonb` | ProviderConfig — sync settings |
| `providerResourceId` | `varchar(191)` | indexed; repoId/projectId/teamId |
| `isActive` | `boolean` NOT NULL DEFAULT true | **the target column** |
| `lastSyncedAt` | `timestamp` | |
| `lastSyncStatus` | `varchar(50)` | SyncStatus: `success\|failed\|pending` |
| `lastSyncError` | `text` | |
| `documentCount` | `integer` DEFAULT 0 | denormalized |
| `connectedAt` | `timestamp` | |
| `createdAt` / `updatedAt` | `timestamp` | |

**Indexes**: `workspace_source_workspace_id_idx`, `workspace_source_installation_id_idx`, `workspace_source_is_active_idx` (on `isActive`), `workspace_source_provider_resource_id_idx`.

### 3. All Reads of `workspaceIntegrations.isActive`

Every site that reads `isActive` as a filter predicate or return value:

| File | Line(s) | Context |
|------|---------|---------|
| `api/console/src/router/org/workspace.ts` | 367 | `workspace.sources.list` — `WHERE isActive = true` |
| `api/console/src/router/org/workspace.ts` | 350 | `sources.list` SELECT includes `isActive: workspaceIntegrations.isActive` |
| `api/console/src/router/org/workspace.ts` | 390 | Returns `isActive: s.isActive` in list output |
| `api/console/src/router/org/workspace.ts` | 553 | `bulkLinkResources` — `existingIntegration.isActive` branch check |
| `api/console/src/router/org/workspace.ts` | 805 | `bulkLinkResources` — `} else if (existingIntegration.isActive) {` |
| `api/console/src/router/org/workspace.ts` | 552–553 | `linkVercelProject` — `if (!existing.isActive)` for reactivation path |
| `api/console/src/router/m2m/sources.ts` | 71 | `findByGithubRepoId` — `WHERE isActive = true` |
| `api/console/src/router/m2m/sources.ts` | 107 | `getSourceIdByGithubRepoId` — `WHERE isActive = true` |
| `api/console/src/router/m2m/sources.ts` | 136 | `markGithubRepoInactive` — `WHERE isActive = true` (to find targets) |
| `api/console/src/router/m2m/sources.ts` | 210 | `markGithubInstallationInactive` — `WHERE isActive = true` |
| `packages/integration-tests/src/neural-pipeline.integration.test.ts` | — | test setup uses workspaceIntegrations schema |

### 4. All Writes to `workspaceIntegrations.isActive`

Every site that sets `isActive`:

| File | Method | Sets `isActive` to | Context |
|------|--------|-------------------|---------|
| `api/console/src/router/org/workspace.ts:482–484` | `integrations.disconnect` mutation | `false` | User-triggered workspace integration disconnect |
| `api/console/src/router/org/workspace.ts:556–557` | `linkVercelProject` | `true` | Reactivation of existing inactive Vercel project |
| `api/console/src/router/org/workspace.ts:598–601` | `linkVercelProject` insert | `true` | New Vercel project insert |
| `api/console/src/router/org/workspace.ts:656–659` | `integrations.unlinkVercelProject` | `false` | Unlink Vercel project |
| `api/console/src/router/org/workspace.ts:832–839` | `bulkLinkResources` — reactivate path | `true` | Reactivating previously inactive integrations |
| `api/console/src/router/org/workspace.ts:883–884` | `bulkLinkResources` — create path | `true` | New integrations insert |
| `api/console/src/router/m2m/sources.ts:148–153` | `markGithubRepoInactive` | `false` | GitHub webhook: repo removed from installation |
| `api/console/src/router/m2m/sources.ts:233–235` | `markGithubInstallationInactive` | `false` | GitHub webhook: installation deleted/suspended |
| `api/console/src/router/m2m/sources.ts:302–306` | `markGithubDeleted` | `false` | GitHub webhook: repo deleted |
| `packages/console-test-data/src/cli/seed-integrations.ts:181` | seed script | `true` | Demo data seeding |

### 5. Row Creation Paths

**workspaceIntegrations rows are created in three places:**

1. **`workspace.integrations.bulkLinkResources`** (`api/console/src/router/org/workspace.ts:873–889`)
   - Generic mutation for all providers (GitHub, Linear, Sentry, Vercel)
   - Called from the "Add Sources" UI
   - Creates with `isActive: true`
   - Also handles reactivation (`isActive: true`) when row already exists but is inactive

2. **`workspace.integrations.linkVercelProject`** (`api/console/src/router/org/workspace.ts:583–603`)
   - Vercel-specific path (legacy, still used)
   - Creates with `isActive: true`
   - Reactivates if existing row has `isActive: false`

3. **`seed-integrations.ts`** (`packages/console-test-data/src/cli/seed-integrations.ts:173–184`)
   - Demo/testing seed script
   - Creates with `isActive: true`

**gatewayInstallations rows are created in:**
- `apps/gateway/src/routes/connections.ts` — the OAuth callback (`/:provider/callback`) upserts with `status: 'active'`

### 6. Row Deactivation / Disconnect Flows

Four distinct deactivation paths all set `isActive: false`:

**A. User-triggered workspace disconnect** (`workspace.integrations.disconnect`)
- File: `api/console/src/router/org/workspace.ts:464–487`
- Sets `isActive: false, updatedAt: now`
- Does NOT set `lastSyncStatus` or `lastSyncError`

**B. User-triggered Vercel unlink** (`workspace.integrations.unlinkVercelProject`)
- File: `api/console/src/router/org/workspace.ts:641–662`
- Sets `isActive: false, updatedAt: now`

**C. GitHub webhook: repo removed from installation** (`markGithubRepoInactive`)
- File: `api/console/src/router/m2m/sources.ts:128–177`
- Sets `isActive: false, updatedAt: now`
- Records activity `integration.disconnected` with `reason: 'repository_removed'`

**D. GitHub webhook: installation deleted/suspended** (`markGithubInstallationInactive`)
- File: `api/console/src/router/m2m/sources.ts:189–261`
- Sets `isActive: false, lastSyncedAt: now, lastSyncStatus: 'failed', lastSyncError: 'GitHub installation removed or suspended', updatedAt: now`
- Records activity `integration.disconnected` with `reason: 'installation_removed'`

**E. GitHub webhook: repo deleted** (`markGithubDeleted`)
- File: `api/console/src/router/m2m/sources.ts:269–335`
- Sets `isActive: false, lastSyncedAt: now, lastSyncStatus: 'failed', lastSyncError: 'Repository deleted on GitHub', updatedAt: now`
- Records activity `integration.deleted` with `reason: 'repository_deleted'`

**Also note**: `connections.disconnect` (org-level) and `connections.vercel.disconnect` in `api/console/src/router/org/connections.ts` set `gatewayInstallations.status = 'revoked'` — this is the installation level, not the integration level. There is no cascade from `gatewayInstallations.status` change to `workspaceIntegrations.isActive`.

### 7. UI Components Reading `isActive`

**A. Settings > Sources list** (`apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/sources/_components/sources-list.tsx`)
- Uses `trpc.connections.list` which returns `{ isActive: true }` (hardcoded from `connections.list` query filtering `status = 'active'`)
- Checks `i.isActive` on line 43: `const connection = integrations.find(i => i.sourceType === provider && i.isActive)`

**B. Workspace Sources list** (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx`)
- Uses `trpc.workspace.sources.list`
- The tRPC query already filters by `WHERE isActive = true`, so only active integrations are returned
- The UI does not additionally filter on `isActive` — it trusts the server filter
- Has a "status" dropdown filter in UI (active/inactive/all), but the backend query (`workspace.sources.list`) always applies `isActive = true` — inactive integrations are never shown

**C. `connections.list` tRPC router** (`api/console/src/router/org/connections.ts:83–114`)
- Returns `{ isActive: true }` as a hardcoded value derived from filtering `gatewayInstallations.status = 'active'`
- The returned object shape includes `isActive` for UI compatibility

### 8. The `gatewayWebhookDeliveries` Table — DLQ Schema

**File**: `db/console/src/schema/tables/gateway-webhook-deliveries.ts`

Columns:
- `id`, `provider`, `deliveryId` (unique with provider), `eventType`, `installationId`, `status` (varchar: `received|enqueued|delivered|dlq`), `payload` (text), `receivedAt`

**There is no `failReason` column.** The DLQ distinction is encoded only in `status = 'dlq'`.

**DLQ write path** (relay `apps/relay/src/routes/workflows.ts` lines 97–133):
- In Step 3 `route`: if `connectionInfo` is null (resource not found in `gatewayResources`), publishes to QStash `webhook-dlq` topic AND sets `status = 'dlq'`
- The DLQ write is the **relay** workflow's responsibility, triggered before the event ever reaches Console ingress

**Important**: The `check-event-allowed` gate in `event-store.ts` runs **after** the relay already dispatched the event to Console ingress. By the time `event-store.ts` runs, `gatewayWebhookDeliveries.status` is already `'enqueued'` (step 5 of the relay workflow). There is no connection back from the Inngest `event-store` to update `gatewayWebhookDeliveries`.

### 9. The `workspaceIngestLogs` Table

**File**: `db/console/src/schema/tables/workspace-ingest-logs.ts`

Columns: `id` (bigint, monotonic cursor), `workspaceId`, `deliveryId`, `sourceEvent` (jsonb PostTransformEvent), `ingestionSource`, `receivedAt`, `createdAt`

**No `failReason` or `status` column.** Records are inserted only for successfully transformed events (unsupported event types are skipped before insert, in `apps/console/src/app/api/gateway/ingress/route.ts`).

The `ingestLogId` (a bigint from `workspaceIngestLogs`) is passed into the Inngest event payload as `event.data.ingestLogId` from `notify.ts:24` and threaded into `event-store.ts`'s logging context. It is stored on `workspaceEvents` (`ingestLogId` column in the events table) for tracing.

### 10. The Pipeline from Webhook to `event-store`

The full path from inbound webhook to `event-store`:

```
External Webhook → relay POST /webhooks/:provider
  → rawBodyCapture + signatureVerify + payloadParseAndExtract (middleware)
  → workflowClient.trigger('/workflows/webhook-delivery')         [Upstash Workflow]
    → Step 1: INSERT gatewayWebhookDeliveries (status='received')
    → Step 2: resolve-connection (gatewayResources JOIN gatewayInstallations)
    → Step 3: route
      if no connection → DLQ (status='dlq', QStash webhook-dlq topic) → STOP
      if connection found → UPDATE gatewayWebhookDeliveries SET installationId
    → Step 4: publishJSON to consoleUrl/api/gateway/ingress via QStash
    → Step 5: UPDATE gatewayWebhookDeliveries SET status='enqueued'

console POST /api/gateway/ingress              [Upstash Workflow via Next.js serve()]
  → Step 1: resolve-workspace (orgWorkspaces by clerkOrgId)
  → Step 2: transformEnvelope → sanitize → INSERT workspaceIngestLogs
    → publishInngestNotification → inngest.send('apps-console/event.capture')
    → publishEventNotification   → Upstash Realtime

Inngest apps-console/event.capture             [event-store Inngest function]
  → generate-replay-safe-ids
  → resolve-clerk-org-id
  → create-job
  → update-job-running
  → check-duplicate (workspaceEvents by workspaceId + sourceId)
  → check-event-allowed ← GATE 2 GOES HERE
    - currently: only checks integration exists AND providerConfig allows event type
    - missing: isActive check
  → evaluate-significance
  → extract-entities
  → store-observation → INSERT workspaceEvents
  → upsert-entities-and-junctions
  → emit entity.upserted + event.stored
  → complete-job-success
```

### 11. `gatewayInstallations.status` vs `workspaceIntegrations.isActive`

These are two separate lifecycle fields at different scopes:

| Field | Scope | Values | Who writes it |
|-------|-------|--------|---------------|
| `gatewayInstallations.status` | Org-level (installation) | `active\|pending\|error\|revoked` | Gateway OAuth callback (active), `connections.disconnect` (revoked), `connections.vercel.disconnect` (revoked), `connections.generic.listResources` on 401 (error) |
| `workspaceIntegrations.isActive` | Workspace-level (resource) | `true\|false` | tRPC workspace router, m2m sources router |

Revoking a `gatewayInstallation` does NOT cascade to set `workspaceIntegrations.isActive = false`. The m2m sources router (`markGithubInstallationInactive`) handles the GitHub-specific case explicitly, but there is no equivalent for Vercel/Linear/Sentry/Apollo.

### 12. Integration Tests Using `workspaceIntegrations`

**File**: `packages/integration-tests/src/neural-pipeline.integration.test.ts`

Uses `workspaceIntegrations` table via PGlite test DB. The test inserts `workspaceIntegrations` rows with `isActive: true` as part of test setup. The test exercises the full `check-event-allowed` step. Any migration to a `status` field will require updating this test setup.

---

## Code References

- `api/console/src/inngest/workflow/neural/event-store.ts:247–317` — `check-event-allowed` step, the exact location for Gate 2
- `api/console/src/inngest/workflow/neural/event-store.ts:319–338` — filtered path when `!eventAllowed`, logs `reason: "event_not_allowed"`
- `db/console/src/schema/tables/workspace-integrations.ts:76` — `isActive: boolean("is_active").notNull().default(true)`
- `db/console/src/schema/tables/workspace-integrations.ts:112` — `isActiveIdx` on the `isActive` column
- `db/console/src/schema/tables/gateway-webhook-deliveries.ts:24` — `status` varchar, values: `received|enqueued|delivered|dlq`, **no `failReason` column**
- `db/console/src/schema/tables/workspace-ingest-logs.ts` — **no `failReason` or `status` column**
- `api/console/src/router/org/workspace.ts:464–487` — `integrations.disconnect` sets `isActive: false`
- `api/console/src/router/org/workspace.ts:334–405` — `workspace.sources.list` filters `WHERE isActive = true`, returns `isActive` in list items
- `api/console/src/router/org/workspace.ts:800–935` — `bulkLinkResources` uses `existingIntegration.isActive` for categorize-resources logic
- `api/console/src/router/m2m/sources.ts:63–85` — `findByGithubRepoId` filters `WHERE isActive = true`
- `api/console/src/router/m2m/sources.ts:128–177` — `markGithubRepoInactive` sets `isActive: false`
- `api/console/src/router/m2m/sources.ts:189–261` — `markGithubInstallationInactive` sets `isActive: false`
- `apps/relay/src/routes/workflows.ts:97–133` — DLQ route step, the only place `status: 'dlq'` is written
- `apps/console/src/app/api/gateway/ingress/route.ts:29–136` — Console ingress workflow, inserts `workspaceIngestLogs`, fans out to Inngest
- `apps/console/src/app/api/gateway/ingress/_lib/notify.ts:15–32` — `publishInngestNotification` dispatches `apps-console/event.capture`
- `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/sources/_components/sources-list.tsx:43` — UI reads `i.isActive` from `connections.list`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx` — workspace sources UI, trusts backend filter
- `packages/console-test-data/src/cli/seed-integrations.ts:181` — seeds with `isActive: true`

---

## Architecture Documentation

### The Two Distinct Status Systems

1. **Installation-level** (`gatewayInstallations.status`): Controls whether the OAuth connection is valid. Used by the gateway to gate token retrieval and proxy execution. Values: `active | pending | error | revoked`. This is a varchar already.

2. **Integration-level** (`workspaceIntegrations.isActive`): Controls whether a specific resource (repo, project, team) is actively syncing within a workspace. This is the boolean being migrated.

These operate independently. A revoked installation means the auth tokens are gone (org-level), but the workspace integration rows remain in the DB with their last known state.

### The DLQ vs Inactive-Connection Path

The current DLQ (in relay) fires when a provider resource is not found in `gatewayResources` — meaning the webhook arrived for an installation/resource that was never registered in the gateway. This is a **routing** failure (Gate 1).

The proposed Gate 2 in `event-store` is a different check: the resource IS known to the gateway (it passed Gate 1 and was routed to Console), but the workspace integration has been torn down at the workspace level. This is a **workspace policy** failure.

The existing `gatewayWebhookDeliveries` table's `status = 'dlq'` represents Gate 1 failures only. By the time `event-store` runs, `gatewayWebhookDeliveries.status` is already `'enqueued'`. There is no existing mechanism to mark a delivery as rejected at Gate 2 back in the `gatewayWebhookDeliveries` table. Doing so would require a back-write from Inngest to the DB.

### `filteredReason` in EventCaptureOutputFiltered

The filtered output type (`EventCaptureOutputFiltered` from `@repo/console-validation`) accepts `reason: string`. The `event-store` uses `reason: "duplicate"` and `reason: "event_not_allowed"`. A Gate 2 rejection would use a new reason like `"inactive_connection"`.

### `providerConfig` Reactivation Check

When `bulkLinkResources` finds an existing integration with `isActive: false`, it reactivates by setting `isActive: true`. After the schema migration, this logic will need to compare against `status !== 'active'` and set `status: 'active'`. The reactivation also needs to populate `statusReason: null` or clear any prior reason.

---

## Historical Context (from thoughts/)

No existing research documents in `thoughts/shared/` were found that cover this specific double-gate or `workspaceIntegrations` schema migration topic. The existing research docs in this branch focus on provider architecture redesign and type-cast elimination.

---

## Open Questions

1. **`failReason` column destination**: The research brief mentions `gatewayWebhookDeliveries.failReason = 'inactive_connection'`. Currently that table has no such column. Adding it would require a schema migration for `gatewayWebhookDeliveries` as well. Alternatively, the Gate 2 rejection could simply be logged (Inngest job completed with `reason: 'inactive_connection'`) without a back-write to `gatewayWebhookDeliveries`.

2. **Back-write architecture**: Writing from Inngest back to `gatewayWebhookDeliveries` is possible (direct DB access via `@db/console/client`) but introduces coupling between the fast-path Inngest worker and the relay's tracking table. The step would need the `deliveryId` — it is present in `sourceEvent.sourceId`? No, `deliveryId` is not directly in the Inngest event data. Looking at the `publishInngestNotification` signature: it passes `sourceEvent, workspace, ingestLogId`. The `deliveryId` is on `workspaceIngestLogs.deliveryId` and would need to be fetched by `ingestLogId` if a back-write is desired.

3. **`statusReason` length**: The proposed `varchar(100)` for `statusReason` is sufficient for values like `"GitHub installation removed or suspended"` (42 chars) and `"Repository deleted on GitHub"` (27 chars).

4. **Index migration**: The existing `workspace_source_is_active_idx` indexes the `isActive` boolean. After migration to `status varchar(50)`, it should become an index on `status` for the common `WHERE status = 'active'` filter.

5. **`bulkLinkResources` categorization**: Line 805 in `workspace.ts` checks `existingIntegration.isActive` to determine if a resource is "already active" (skip) vs "inactive" (reactivate). After migration this becomes `existingIntegration.status === 'active'` vs any other status value.

6. **`connections.list` hardcoded `isActive: true`**: The `connections.list` tRPC procedure returns `{ isActive: true }` as a hardcoded field (not read from DB). This is safe — it filters only `gatewayInstallations.status = 'active'` rows, so all returned items are definitionally active at the installation level. This field may be renamed or removed as part of the UI-level migration.

7. **Non-GitHub provider teardown**: When `connections.disconnect` (org-level) marks a `gatewayInstallations` row as `status: 'revoked'`, there is currently no code path that cascades to set `workspaceIntegrations.isActive = false` for non-GitHub providers. The m2m router's `markGithubInstallationInactive` handles GitHub explicitly. Vercel/Linear/Sentry/Apollo have no equivalent cascade. This is an existing gap that the new `status` field would need to account for in the disconnect flow.

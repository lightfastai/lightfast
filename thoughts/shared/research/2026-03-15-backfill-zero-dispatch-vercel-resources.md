---
date: 2026-03-15T10:15:56Z
researcher: claude
git_commit: 0095c14aa40068e2daf169f66b31c9e57d28fd86
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Why apps-backfill/run.requested produces 0 dispatched/eventsProduced for Vercel after source connection"
tags: [research, codebase, backfill, vercel, gateway, resources, inngest]
status: complete
last_updated: 2026-03-15
---

# Research: Backfill Zero Dispatch After Vercel Source Connection

**Date**: 2026-03-15T10:15:56Z
**Git Commit**: `0095c14aa40068e2daf169f66b31c9e57d28fd86`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

After connecting a Vercel source through the new source UI, `apps-backfill/run.requested` runs and completes but produces:
```json
{ "dispatched": 0, "eventsDispatched": 0, "eventsProduced": 0, "workUnits": 0, "skipped": 0, "success": true }
```
The connection shows `resources: []`. Deep investigation requested.

## Root Cause

**`bulkLinkResources` writes resources to `lightfast_workspace_integrations` but never to `lightfast_gateway_resources`. The backfill orchestrator reads resources exclusively from `lightfast_gateway_resources` via `gw.getConnection()`. Since that table has no entries for the connection, `connection.resources = []`, which produces zero work units and an immediate early return.**

There are two separate resource tables and the linking flow only populates one:

| Table | Populated by | Read by |
|---|---|---|
| `lightfast_workspace_integrations` | `bulkLinkResources` (workspace.ts:801) | Webhook ingress, relay routing |
| `lightfast_gateway_resources` | `POST /connections/:id/resources` (gateway connections.ts:959) | Backfill orchestrator via `gw.getConnection()` |

`bulkLinkResources` never calls `POST /connections/:id/resources`, so `lightfast_gateway_resources` stays empty. The gateway's `GET /connections/:id` response therefore returns `resources: []` (connections.ts:479 filters to `status = "active"` rows).

---

## Detailed Findings

### 1. The Source Connection UI and `bulkLinkResources`

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/link-sources-button.tsx:43`

When the user clicks "Link Sources", it calls the `workspace.integrations.bulkLinkResources` tRPC mutation. The mutation at `api/console/src/router/org/workspace.ts:684`:

1. Verifies workspace and installation ownership (lines 705–733).
2. Categorizes resources into `toCreate`, `toReactivate`, `alreadyActive` (lines 748–761).
3. Writes rows to **`lightfast_workspace_integrations`** for new resources (lines 801–804):
   - Stores `providerResourceId`, `providerConfig` (JSONB with `projectId`, `teamId`, etc.), `isActive: true`.
4. Calls `notifyBackfill()` fire-and-forget (line 807).
5. **Does NOT call `POST /connections/:id/resources`** on the gateway.

### 2. The Gateway Resources Endpoint — Exists but Unused in This Flow

**File**: `apps/gateway/src/routes/connections.ts:959`

`POST /connections/:id/resources` exists specifically to populate `lightfast_gateway_resources`. It:
- Upserts on `(installationId, providerResourceId)` (lines 1021–1028).
- Sets `status: "active"`.
- Writes a Redis routing cache key `resourceKey(provider, providerResourceId)` → `{ connectionId, orgId }` (lines 1037–1040).

The comment at line 958 says "Callers: console tRPC (org/connections, org/workspace)" but the current `bulkLinkResources` implementation does not call it.

### 3. `notifyBackfill` and Trigger Path

**File**: `api/console/src/router/org/workspace.ts:910`

`notifyBackfill` (called at line 807 from `bulkLinkResources`):
1. Loads `gatewayInstallations.backfillConfig` if `depth`/`entityTypes` not passed (lines 931–957); falls back to `depth: 30` (line 963).
2. POSTs to `${backfillUrl}/trigger` via `createBackfillClient` (line 971).

`apps/backfill/src/routes/trigger.ts:56`:
```ts
await inngest.send({ name: "apps-backfill/run.requested", data: { ... } })
```

### 4. Backfill Orchestrator: Why `workUnits: 0`

**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts`

**Step 1** (`get-connection`, line 59): calls `gw.getConnection(installationId)`.

The gateway `GET /connections/:id` handler at `apps/gateway/src/routes/connections.ts:464` queries `lightfast_gateway_resources` with `eq(gatewayResources.status, "active")` (line 479). Returns `resources: []` because that table has no rows.

**Work unit cross-product** (lines 99–110):
```ts
const workUnits = connection.resources.flatMap((resource) =>
  resolvedEntityTypes.map((entityType: string) => ({ ... }))
);
// connection.resources = [] → workUnits = []
```

For Vercel, `resolvedEntityTypes` would be `["deployment"]` (from `vercelBackfill.defaultEntityTypes` at `packages/console-providers/src/providers/vercel/backfill.ts:75`). But since `connection.resources` is empty, `flatMap` over `[]` returns `[]` regardless.

**Early return** (lines 127–137): when `filteredWorkUnits.length === 0`, the function returns immediately:
```ts
return {
  success: true,
  installationId,
  provider,
  workUnits: workUnits.length,    // 0
  skipped: workUnits.length,       // 0
  dispatched: 0,
  eventsProduced: 0,
  eventsDispatched: 0,
};
```

Note: in the early-return case, `workUnits: 0` and `skipped: 0` because `workUnits.length === 0`. The `dispatched: 0` field in the **normal** (non-early-return) path means something different — it equals `filteredWorkUnits.length` (number of workers actually invoked).

### 5. Normal Backfill Execution Path (When Resources Exist)

When `lightfast_gateway_resources` has entries, the flow would be:

1. `workUnits = [{ entityType: "deployment", resource: { providerResourceId: "<vercel-project-id>", resourceName: "..." }, workUnitId: "<project-id>-deployment" }]` — one per linked project.
2. Gap-aware filter (lines 116–125): checks `gw.getBackfillRuns(installationId, "completed")` for prior completed runs; skips entity types already covered by the `since` window.
3. For each `filteredWorkUnit`, `step.invoke` fires a `backfillEntityWorker` (line 144).
4. Worker calls `vercelBackfill.entityTypes.deployment.buildRequest(ctx, cursor)` → `GET /v6/deployments?projectId=<id>&limit=100&until=<cursor>` (backfill.ts:79–88).
5. `processResponse` (backfill.ts:89–123): filters deployments by `created >= sinceTimestamp`, adapts each into a `PreTransformVercelWebhookPayload`, maps `readyState` to event type (`READY` → `deployment.succeeded`, etc.).
6. Each event dispatched to relay via `relay.dispatchWebhook(provider, { connectionId, orgId, deliveryId, eventType, payload })`.

### 6. The Two-Table Architecture

**`lightfast_workspace_integrations`** (`db/console/src/schema/tables/workspace-integrations.ts:36`):
- One row per resource per workspace.
- Stores full `providerConfig` JSONB (projectId, teamId, sync settings).
- Used by webhook ingress, relay routing lookup when Redis cache misses.

**`lightfast_gateway_resources`** (`db/console/src/schema/tables/gateway-resources.ts:12`):
- One row per resource per installation (gateway-level, not workspace-level).
- Stores `installationId`, `providerResourceId`, `resourceName`, `status`.
- Used by: backfill orchestrator (via `gw.getConnection()`), relay Redis cache key writes.

### 7. `ingress/route.ts` — Not Part of This Flow

`apps/console/src/app/api/gateway/ingress/route.ts` handles QStash-delivered webhooks from Relay. It dispatches `apps-console/event.capture` events and Upstash Realtime SSE notifications. It does not interact with backfill at all.

---

## Code References

| Location | Purpose |
|---|---|
| `api/console/src/router/org/workspace.ts:684` | `bulkLinkResources` — writes `workspaceIntegrations`, calls `notifyBackfill` |
| `api/console/src/router/org/workspace.ts:801` | Inserts into `lightfast_workspace_integrations` (does NOT write `gatewayResources`) |
| `api/console/src/router/org/workspace.ts:910` | `notifyBackfill` — POSTs to backfill service `/trigger` |
| `apps/gateway/src/routes/connections.ts:464` | `GET /connections/:id` — returns `resources` from `lightfast_gateway_resources` |
| `apps/gateway/src/routes/connections.ts:479` | Queries `gatewayResources` filtered by `status = "active"` |
| `apps/gateway/src/routes/connections.ts:959` | `POST /connections/:id/resources` — populates `lightfast_gateway_resources` (unused by bulkLinkResources) |
| `apps/backfill/src/workflows/backfill-orchestrator.ts:59` | `get-connection` step — reads `connection.resources` |
| `apps/backfill/src/workflows/backfill-orchestrator.ts:99` | Work unit cross-product: `resources.flatMap(entityTypes)` |
| `apps/backfill/src/workflows/backfill-orchestrator.ts:127` | Early return when `filteredWorkUnits.length === 0` |
| `packages/console-providers/src/providers/vercel/backfill.ts:73` | `vercelBackfill` — `defaultEntityTypes: ["deployment"]` |
| `packages/console-providers/src/providers/vercel/backfill.ts:79` | `buildRequest` — uses `ctx.resource.providerResourceId` as `projectId` |
| `db/console/src/schema/tables/gateway-resources.ts:12` | `lightfast_gateway_resources` table schema |
| `db/console/src/schema/tables/workspace-integrations.ts:36` | `lightfast_workspace_integrations` table schema |
| `packages/console-providers/src/gateway.ts:72` | `gatewayConnectionSchema` — `resources` array shape |

## Architecture Documentation

### The Missing Write

The linking flow (`bulkLinkResources`) and the backfill consumer (`backfillOrchestrator`) operate on different tables. The gateway service's `POST /connections/:id/resources` is the bridge that populates `lightfast_gateway_resources` — the table that backfill reads. That endpoint exists and is correctly implemented but is not called during the current `bulkLinkResources` path.

### Why Two Resource Tables

- `lightfast_workspace_integrations`: workspace-scoped view. A resource can be linked to multiple workspaces within the same org. Holds full sync configuration per resource+workspace.
- `lightfast_gateway_resources`: installation-scoped view. A resource exists once per gateway installation. Holds only identity (`providerResourceId`, `resourceName`) and `status`. Used for routing (relay Redis cache) and backfill (work unit enumeration).

### What `dispatched` Means

The `dispatched` field in the backfill result is the count of entity worker invocations (one per filtered work unit), NOT the number of events sent to Relay. It is `0` in both the early-return path (zero work units) and the gap-filter-all path (all entity types already covered).

### Gap-Aware Filtering

The orchestrator at lines 116–125 checks `backfillHistory` (completed runs for this installation) per entity type. If any prior completed run for an entity type has `since <= requested_since`, that entity type is considered covered and skipped for ALL resources. This means a second backfill of the same depth within the same window produces `dispatched: 0, skipped: N`.

## Open Questions

1. Should `bulkLinkResources` call `POST /connections/:id/resources` after writing `workspaceIntegrations` rows?
2. Should `backfillOrchestrator` instead derive resources from `lightfast_workspace_integrations` (workspace-level) rather than `lightfast_gateway_resources` (installation-level)?
3. How does `lightfast_gateway_resources` get populated today for other providers (GitHub, Linear, Sentry) — is the same gap present for all?

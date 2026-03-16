# Fix Backfill Zero-Dispatch: Register Resources in Gateway Implementation Plan

## Overview

When a user links a source through the new source UI, `bulkLinkResources` writes the resource to `lightfast_workspace_integrations` but never registers it in `lightfast_gateway_resources`. The backfill orchestrator reads resources exclusively from `lightfast_gateway_resources` via `gw.getConnection()`. Because that table is empty, `connection.resources = []`, producing `workUnits = 0` and an immediate early return — `{ dispatched: 0, eventsProduced: 0 }` for every provider.

## Current State Analysis

**Two resource tables, one missing write:**

| Table | Written by | Read by |
|---|---|---|
| `lightfast_workspace_integrations` | `bulkLinkResources`, `linkVercelProject`, `user/workspace.create` | Webhook routing, relay |
| `lightfast_gateway_resources` | `POST /connections/:id/resources` (gateway connections.ts:959) | Backfill orchestrator |

The gateway endpoint `POST /connections/:id/resources` is fully implemented (connections.ts:959–1050):
- Upserts on `(installationId, providerResourceId)` conflict (unique index on that pair)
- Sets `status: "active"`
- Writes Redis routing cache key `resourceKey(provider, providerResourceId)` — permanent (no TTL)
- Returns 409 if resource already active (idempotent-safe)
- **Bug**: `onConflictDoUpdate` sets `resourceName: body.resourceName` — when `resourceName` is omitted, Drizzle writes `NULL`, overwriting any previously stored name on re-link of a `"removed"` resource

The `createGatewayClient` in `packages/gateway-service-clients/src/gateway.ts` has **no method** for this endpoint. The full URL resolves to `${gatewayUrl}/gateway/${installationId}/resources` (i.e., `http://localhost:4110/services/gateway/:id/resources` in dev — gateway mounts `connections` at `/services/gateway` per app.ts:48).

**`toReactivate` tracking gap:** In `bulkLinkResources`, `toReactivate` currently only stores the integration `id` (workspace.ts:759) — not `providerResourceId`/`resourceName`. Needs restructuring to carry resource identity for gateway registration.

**`linkVercelProject` is a separate legacy mutation** (workspace.ts:490) that inserts/reactivates a single Vercel project and calls neither `registerResource` nor `notifyBackfill`. It has `projectName` in its input so `resourceName` is available.

**`resourceName` is not persisted in `workspaceIntegrations`**: The schema has no `resourceName` column. Vercel's `providerConfig` JSONB stores `projectId`/`teamId` but discards display names by design. The migration script must pass `providerResourceId` only.

**Affected providers:** All — GitHub (repos), Vercel (projects), Linear (teams), Sentry (projects) — all go through `bulkLinkResources` → `notifyBackfill` → backfill orchestrator.

## Desired End State

After linking a source through the UI:
1. `lightfast_workspace_integrations` row written ✓ (existing)
2. `lightfast_gateway_resources` row written ✓ (new)
3. `gw.getConnection(installationId)` returns `resources: [{ providerResourceId, resourceName }]`
4. Backfill orchestrator produces `workUnits > 0` and dispatches entity workers
5. Existing connections (linked before this fix) also have `gatewayResources` rows via migration

### Verification:
- Connect a new Vercel source → backfill Inngest run shows `workUnits: 1, dispatched: 1, eventsProduced: N`
- Connect a new GitHub source with 2 repos → `workUnits: 2` (one per repo × entity types)
- Re-link an existing source → idempotent, no errors, backfill triggers correctly

## What We're NOT Doing

- Deregistering gateway resources when sources are deactivated/removed — `gatewayResources` is per-installation (not per-workspace); multiple workspaces can share the same installation resource, so deactivating one workspace's integration must not remove the gateway resource
- Fixing `user/workspace.ts` GitHub integration path — it inserts `workspaceIntegrations` without calling `notifyBackfill` at all; fixing backfill registration there is meaningless without also adding `notifyBackfill`
- Changing backfill orchestrator to read from `workspaceIntegrations` instead of `gatewayResources`
- Adding entity worker parallelism or backfill logic changes
- Failing the `bulkLinkResources` mutation when gateway registration fails (best-effort consistent with `notifyBackfill`)

## Implementation Approach

Three phases: add the client method → wire it into the linking flow → migrate existing data. Each phase is independently deployable and testable.

---

## Phase 1: Add `registerResource` to Gateway Service Client

### Overview

Add a typed `registerResource` method to `createGatewayClient`. Treats 409 (already registered) as success to make it safe to call idempotently.

### Changes Required

#### 1. Gateway `POST /:id/resources` — fix `onConflictDoUpdate` null overwrite
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Only update `resourceName` in the conflict branch when it is explicitly provided. Prevents re-linking a previously-removed resource (where we may not have the name) from nulling out a stored value.

```ts
// Before (line 1021-1028):
.onConflictDoUpdate({
  target: [gatewayResources.installationId, gatewayResources.providerResourceId],
  set: {
    status: "active",
    resourceName: body.resourceName,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  },
})

// After:
.onConflictDoUpdate({
  target: [gatewayResources.installationId, gatewayResources.providerResourceId],
  set: {
    status: "active",
    ...(body.resourceName !== undefined ? { resourceName: body.resourceName } : {}),
    updatedAt: sql`CURRENT_TIMESTAMP`,
  },
})
```

#### 2. Gateway Service Client — add `registerResource`
**File**: `packages/gateway-service-clients/src/gateway.ts`
**Changes**: Add `registerResource` method to the returned client object.

```ts
async registerResource(
  installationId: string,
  resource: { providerResourceId: string; resourceName?: string }
): Promise<void> {
  const response = await fetch(
    `${gatewayUrl}/gateway/${installationId}/resources`,
    {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify(resource),
      signal: AbortSignal.timeout(10_000),
    }
  );
  // 409 = already registered — treat as success (idempotent)
  if (!response.ok && response.status !== 409) {
    throw new Error(
      `Gateway registerResource failed: ${response.status} for ${installationId}/${resource.providerResourceId}`
    );
  }
},
```

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`

---

## Phase 2: Wire Resource Registration into `bulkLinkResources`

### Overview

In `bulkLinkResources`, call `registerResource` for each resource in both the `toCreate` and `toReactivate` paths before triggering backfill. Registration is best-effort (errors logged, mutation never fails because of it). Also restructures `toReactivate` to carry `providerResourceId` + `resourceName`.

### Changes Required

#### 1. `bulkLinkResources` mutation
**File**: `api/console/src/router/org/workspace.ts`
**Changes**:

**a) Import `createGatewayClient`** — add at top of file if not already present:
```ts
import { createGatewayClient } from "@repo/gateway-service-clients";
```

**b) Restructure `toReactivate`** (line 749) to carry resource identity:
```ts
// Before:
const toReactivate: string[] = [];
// ...
toReactivate.push(existingIntegration.id);

// After:
const toReactivate: Array<{
  id: string;
  providerResourceId: string;
  resourceName: string;
}> = [];
// ...
toReactivate.push({
  id: existingIntegration.id,
  providerResourceId: resource.resourceId,
  resourceName: resource.resourceName,
});
```

**c) Update reactivation DB query** to use mapped IDs:
```ts
// Before (line 771):
.where(inArray(workspaceIntegrations.id, toReactivate));

// After:
.where(inArray(workspaceIntegrations.id, toReactivate.map((r) => r.id)));
```

**d) Instantiate `createGatewayClient` once** at the top of the mutation handler (after ownership checks, before categorization):
```ts
const gw = createGatewayClient({ apiKey: env.GATEWAY_API_KEY });
```

**e) Register resources in gateway before triggering backfill — `toReactivate` path** (after line 772, before `notifyBackfill`):
```ts
// Register reactivated resources in gateway (best-effort)
await Promise.allSettled(
  toReactivate.map((r) =>
    gw
      .registerResource(gwInstallationId, {
        providerResourceId: r.providerResourceId,
        resourceName: r.resourceName,
      })
      .catch((err) =>
        console.error("[bulkLinkResources] gateway registerResource failed (reactivate)", {
          installationId: gwInstallationId,
          providerResourceId: r.providerResourceId,
          err,
        })
      )
  )
);
```

**f) Register resources in gateway before triggering backfill — `toCreate` path** (after line 804, before `notifyBackfill`):
```ts
// Register new resources in gateway (best-effort)
await Promise.allSettled(
  toCreate.map((resource) =>
    gw
      .registerResource(gwInstallationId, {
        providerResourceId: resource.resourceId,
        resourceName: resource.resourceName,
      })
      .catch((err) =>
        console.error("[bulkLinkResources] gateway registerResource failed (create)", {
          installationId: gwInstallationId,
          providerResourceId: resource.resourceId,
          err,
        })
      )
  )
);
```

> **Ordering note**: `registerResource` must complete (or fail) before `notifyBackfill` is called. Backfill is fire-and-forget via Inngest, but Inngest can pick up the event quickly. Awaiting `Promise.allSettled` on registration ensures `gatewayResources` is written before the orchestrator's `get-connection` step runs.

#### 2. `linkVercelProject` mutation — add `registerResource` + `notifyBackfill`
**File**: `api/console/src/router/org/workspace.ts:490`
**Changes**: This legacy mutation has `projectName` in its input but calls neither `registerResource` nor `notifyBackfill`. Add both.

After the existing `isActive` reactivation update (line 554) and after the new insert (line 586), add:

```ts
// For the reactivate path (after line 555):
const gw = createGatewayClient({ apiKey: env.GATEWAY_API_KEY });
await gw.registerResource(installationId, {
  providerResourceId: projectId,
  resourceName: input.projectName,
}).catch((err) =>
  console.error("[linkVercelProject] gateway registerResource failed", { installationId, projectId, err })
);
void notifyBackfill({
  installationId,
  provider: "vercel",
  orgId: ctx.auth.orgId,
});
return { id: existing.id, created: false, reactivated: true };

// For the create path (after line 586, before return):
const gw = createGatewayClient({ apiKey: env.GATEWAY_API_KEY });
await gw.registerResource(installationId, {
  providerResourceId: projectId,
  resourceName: input.projectName,
}).catch((err) =>
  console.error("[linkVercelProject] gateway registerResource failed", { installationId, projectId, err })
);
void notifyBackfill({
  installationId,
  provider: "vercel",
  orgId: ctx.auth.orgId,
});
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Connect a new Vercel source → Inngest `apps-backfill/run.requested` shows `workUnits >= 1, dispatched >= 1`
- [ ] Connect a new GitHub source → same, with `workUnits` matching number of linked repos × entity types
- [ ] Re-link an already-active source → mutation returns `{ skipped: 1 }`, no errors
- [ ] Re-link a previously inactive source → mutation returns `{ reactivated: 1 }`, backfill triggers with work units

**Implementation Note**: Pause here for manual confirmation that backfill is producing events before proceeding to Phase 3.

---

## Phase 3: Migrate Existing Connections

### Overview

Backfill `lightfast_gateway_resources` for all `workspaceIntegrations` rows that are active but have no corresponding gateway resource. Implemented as a standalone script run once at deploy time.

**Note on `resourceName`**: `workspaceIntegrations` has no `resourceName` column — display names are intentionally excluded from the schema. The migration registers resources with `providerResourceId` only (`resourceName` omitted). The gateway's `onConflictDoUpdate` fix (Phase 1) ensures this won't null out future names.

### Changes Required

#### 1. Migration Script
**File**: `scripts/migrate-gateway-resources.ts`

```ts
/**
 * One-time migration: registers existing workspaceIntegrations in lightfast_gateway_resources.
 * resourceName is not stored in workspaceIntegrations — resources are registered with ID only.
 *
 * Run from apps/console/:
 *   pnpm with-env tsx ../../scripts/migrate-gateway-resources.ts
 */
import { db } from "@db/console";
import { workspaceIntegrations } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { createGatewayClient } from "@repo/gateway-service-clients";

const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY;
if (!GATEWAY_API_KEY) throw new Error("GATEWAY_API_KEY required");

const gw = createGatewayClient({ apiKey: GATEWAY_API_KEY });

// 1. Get all active integrations
const active = await db
  .select({
    installationId: workspaceIntegrations.installationId,
    providerResourceId: workspaceIntegrations.providerResourceId,
  })
  .from(workspaceIntegrations)
  .where(eq(workspaceIntegrations.isActive, true));

// 2. Deduplicate by (installationId, providerResourceId)
const unique = [
  ...new Map(
    active.map((r) => [`${r.installationId}:${r.providerResourceId}`, r])
  ).values(),
];

console.log(`Found ${unique.length} unique (installation, resource) pairs to migrate`);

// 3. Register each in gateway — 409 = already exists, treated as success by registerResource
let registered = 0;
let failed = 0;

for (const row of unique) {
  try {
    await gw.registerResource(row.installationId, {
      providerResourceId: row.providerResourceId,
      // resourceName intentionally omitted — not stored in workspaceIntegrations
    });
    registered++;
  } catch (err: any) {
    console.error(`Failed: ${row.installationId}/${row.providerResourceId}`, err?.message);
    failed++;
  }
}

console.log(`Done — registered: ${registered}, failed: ${failed}`);
```

### Success Criteria

#### Automated Verification:
- [x] Script created at `scripts/migrate-gateway-resources.ts`
- [x] Script runs without uncaught exceptions: `cd apps/console && pnpm with-env tsx ../../scripts/migrate-gateway-resources.ts`
- [x] Script output shows `failed: 0` (registered: 7, skipped: 0, failed: 0)

#### Manual Verification:
- [ ] Query `lightfast_gateway_resources` — rows exist for all previously linked sources
- [ ] Manually trigger a backfill for an existing connection → `workUnits > 0`

---

## Testing Strategy

### Manual Testing Steps:
1. Connect a fresh Vercel source via UI → verify Inngest backfill shows `workUnits: 1, dispatched: 1`
2. Check `lightfast_gateway_resources` table has the new row with `status = "active"`
3. Re-run backfill for same connection → gap filter should skip (prior run exists with same `since`)
4. Run migration script → verify `lightfast_gateway_resources` populated for all existing integrations
5. Trigger backfill for an existing integration → verify `workUnits > 0`

## References

- Root cause research: `thoughts/shared/research/2026-03-15-backfill-zero-dispatch-vercel-resources.md`
- Backfill orchestrator: `apps/backfill/src/workflows/backfill-orchestrator.ts:99`
- Gateway resources endpoint: `apps/gateway/src/routes/connections.ts:959`
- Gateway service client: `packages/gateway-service-clients/src/gateway.ts`
- `bulkLinkResources`: `api/console/src/router/org/workspace.ts:684`
- `linkVercelProject` (legacy Vercel mutation): `api/console/src/router/org/workspace.ts:490`
- `workspaceIntegrations` schema (no resourceName column): `db/console/src/schema/tables/workspace-integrations.ts`
- `gatewayResources` schema (unique index on installationId+providerResourceId): `db/console/src/schema/tables/gateway-resources.ts`

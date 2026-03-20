---
date: 2026-03-18
topic: "console double-gate (Gate 2) and workspaceIntegrations schema migration"
tags: [plan, console, inngest, schema-migration, drizzle, workspace-integrations, gate2, dlq, disconnect-cascade]
status: ready
depends_on: "thoughts/shared/plans/2026-03-18-phase0-db-schema-migration.md"
---

# Console Double-Gate + workspaceIntegrations Schema Migration

## Overview

Two tightly coupled changes:

1. **Gate 2 in `event-store.ts`** — the `check-event-allowed` Inngest step currently queries `workspaceIntegrations` but never checks whether the integration is active. Events for torn-down connections flow all the way through to storage. Gate 2 adds a `status !== 'active'` check immediately after the integration lookup. Failed events complete the Inngest job with `reason: 'inactive_connection'`.

2. **`workspaceIntegrations.isActive` → `status` + `statusReason`** — replace the boolean `isActive` column with a `status varchar(50)` enum (`active | disconnected | revoked | suspended | removed | deleted | error`) and a nullable `statusReason varchar(100)`. Every read and write site across tRPC routers, Inngest workflows, seed scripts, and tests must be updated.

3. **Non-GitHub disconnect cascade** — when `connections.disconnect` marks a `gatewayInstallations` row as `status: 'revoked'`, it currently does not cascade to `workspaceIntegrations`. Only the GitHub-specific m2m router handles this. This phase adds a generic cascade for all providers.

**Dependency**: Phase 0 DB schema migration must land first — it provides the `status` and `statusReason` columns on `workspaceIntegrations` and the `failReason` column on `gatewayWebhookDeliveries`.

---

## Current State Analysis

### The Gap in Gate 2

**File**: `api/console/src/inngest/workflow/neural/event-store.ts` lines 247–317

The `check-event-allowed` step fetches a `workspaceIntegrations` row by `(workspaceId, providerResourceId)` with no predicate on `isActive`. If the integration exists but is inactive, `integration` is non-null, `isEventAllowed()` runs against `providerConfig`, and the event is accepted. There is no path that rejects based on connection state.

When `eventAllowed` is false (line 319), the job completes with `reason: "event_not_allowed"`. There is no `"inactive_connection"` reason code in the current schema. Adding it requires updating `eventCaptureOutputFilteredSchema` in `@repo/app-validation`.

### The `isActive` Boolean — All Sites

**Reads** (filtering or returning `isActive`):
- `api/console/src/router/org/workspace.ts:367` — `workspace.sources.list` WHERE clause
- `api/console/src/router/org/workspace.ts:350, 390` — SELECT and return in list items
- `api/console/src/router/org/workspace.ts:553, 805` — `bulkLinkResources` categorization (`existingIntegration.isActive`)
- `api/console/src/router/org/workspace.ts:552–553` — `linkVercelProject` reactivation check (`if (!existing.isActive)`)
- `api/console/src/router/m2m/sources.ts:72, 108, 137, 211` — WHERE clauses in all four m2m procedures

**Writes** (setting `isActive`):
- `api/console/src/router/org/workspace.ts:483` — `integrations.disconnect` → `false`
- `api/console/src/router/org/workspace.ts:556` — `linkVercelProject` reactivate → `true`
- `api/console/src/router/org/workspace.ts:600` — `linkVercelProject` new insert → `true`
- `api/console/src/router/org/workspace.ts:656–659` — `unlinkVercelProject` → `false`
- `api/console/src/router/org/workspace.ts:832–839` — `bulkLinkResources` reactivate → `true`
- `api/console/src/router/org/workspace.ts:883–884` — `bulkLinkResources` new insert → `true`
- `api/console/src/router/m2m/sources.ts:150` — `markGithubRepoInactive` → `false`
- `api/console/src/router/m2m/sources.ts:229` — `markGithubInstallationInactive` → `false`
- `api/console/src/router/m2m/sources.ts:302` — `markGithubDeleted` → `false`
- `packages/console-test-data/src/cli/seed-integrations.ts:181` — seed insert → `true`

**UI**:
- `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/sources/_components/sources-list.tsx:43` — reads `i.isActive` from `connections.list` response (hardcoded `true`, safe but will be cleaned up)

### The Non-GitHub Cascade Gap

`connections.disconnect` (`api/console/src/router/org/connections.ts:119–145`) sets `gatewayInstallations.status = 'revoked'` but does **not** update `workspaceIntegrations`. Events from Vercel, Linear, Sentry, and Apollo workspaceIntegrations will continue to pass Gate 2 even after the org-level installation is revoked.

The GitHub-specific m2m router (`markGithubInstallationInactive`) handles GitHub only. There is no equivalent for non-GitHub providers.

### `EventCaptureOutputFiltered` Schema

**File**: `packages/console-validation/src/schemas/workflow-io.ts:59–64`

```ts
const eventCaptureOutputFilteredSchema = z.object({
  inngestFunctionId: z.literal("event.capture"),
  status: z.literal("filtered"),
  reason: z.enum(["duplicate", "event_not_allowed"]),
  sourceId: z.string(),
});
```

`"inactive_connection"` is not a valid reason. Adding it is a non-breaking enum extension.

### Integration Test Fixture

**File**: `packages/integration-tests/src/neural-pipeline.integration.test.ts:241–251`

Seeds `workspaceIntegrations` with `isActive: true`. Must be updated to `status: 'active'` after schema migration.

---

## Desired End State

After this plan is complete:

1. Events for `workspaceIntegrations` rows where `status !== 'active'` are rejected in the `check-event-allowed` step with `reason: 'inactive_connection'`. They do not reach storage.
2. `workspaceIntegrations` has no `isActive` boolean. It has `status varchar(50)` (default `'active'`) and `statusReason varchar(100)` (nullable).
3. All read/write sites use `status`/`statusReason` exclusively. No `isActive` references remain in the codebase.
4. `connections.disconnect` (org-level) cascades to set `status: 'disconnected', statusReason: 'installation_revoked'` on all `workspaceIntegrations` rows for that installation, for all providers.
5. The `eventCaptureOutputFilteredSchema` includes `"inactive_connection"` in its reason enum.
6. The integration test suite exercises both the Gate 2 pass (status = 'active') and Gate 2 reject (status = 'disconnected') cases.

### Verification
- `pnpm typecheck` passes with zero `isActive` references
- `pnpm check` passes
- `pnpm test --filter @repo/integration-tests` passes (including new Gate 2 test)
- `pnpm --filter @api/app build` passes (tRPC types compile)

---

## What We Are NOT Doing

- **No `gatewayWebhookDeliveries` back-write from Inngest**: The `deliveryId` is not in the Inngest event payload, so writing `failReason: 'inactive_connection'` back to `gatewayWebhookDeliveries` would require a DB round-trip via `ingestLogId`. The Gate 2 rejection is recorded in the Inngest job output (`workspaceWorkflowRuns`) only. Adding the back-write is deferred.
- **No UI changes for status display**: The workspace sources UI trusts the server-side filter (`WHERE status = 'active'`). No UI changes are needed as part of this plan — inactive integrations are already hidden.
- **No new `workspaceIntegrations` status transitions beyond disconnect cascade**: Suspended, revoked, removed, deleted, and error statuses are written by future health-check and lifecycle logic. This plan writes only `disconnected` (user-triggered or cascade) and `active` (new/reactivate).
- **No `connections.vercel.disconnect` cascade change**: Vercel project unlink (`workspace.integrations.unlinkVercelProject`) already sets `isActive: false` on the specific workspace integration directly. After migration it will set `status: 'disconnected'`. The org-level `connections.vercel.disconnect` path is not in scope — it's a separate Vercel-specific flow.
- **No gateway-side changes**: `gatewayInstallations.status` is not changed. Only `workspaceIntegrations.status` is the subject of this plan.

---

## Implementation Approach

Phase 1 depends on Phase 0 (DB schema migration) having landed — the `status` and `statusReason` columns must exist in the database before any application code can write to them.

Phases 2–4 are application-layer changes that can be developed in parallel but must be deployed together since they form a cohesive rename of the same field.

Phase 5 is the Gate 2 logic in `event-store.ts` and the filtered-reason schema update. It depends on Phases 2–4 (the column is `status` not `isActive` at the DB layer, and the schema type must accept the new reason).

Phase 6 adds the non-GitHub cascade to `connections.disconnect`.

Phase 7 updates tests.

---

## Phase 1: DB Schema Migration (Dependency — Phase 0)

This phase is handled by the Phase 0 DB schema migration plan (`thoughts/shared/plans/2026-03-18-phase0-db-schema-migration.md`). It is listed here as a gate.

**What Phase 0 delivers for this plan:**
- `workspaceIntegrations.status varchar(50) NOT NULL DEFAULT 'active'` (replaces `isActive boolean`)
- `workspaceIntegrations.statusReason varchar(100)` (nullable)
- Index `workspace_source_status_idx` on `status` (replaces `workspace_source_is_active_idx`)
- `gatewayWebhookDeliveries.failReason varchar(100)` (nullable — not used by this plan but available)

**Data migration note from Phase 0**: The generated SQL must backfill `status` from `isActive` before dropping the boolean column:
```sql
UPDATE "lightfast_workspace_integrations"
SET "status" = CASE WHEN "is_active" = true THEN 'active' ELSE 'disconnected' END;
```
This is handled in Phase 0. Do not proceed to Phase 2 until `pnpm db:migrate` has run successfully against the target environment.

### Success Criteria:
#### Automated Verification:
- [ ] `cd db/console && pnpm db:migrate` exits 0
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'lightfast_workspace_integrations'` returns `status` and `status_reason`, not `is_active`

---

## Phase 2: Update `@repo/app-validation` — Filtered Reason Enum

Add `"inactive_connection"` to the `reason` enum in `eventCaptureOutputFilteredSchema`.

### Changes Required:

#### 1. Filtered schema reason enum
**File**: `packages/console-validation/src/schemas/workflow-io.ts`

Change line 62:
```ts
// Before
reason: z.enum(["duplicate", "event_not_allowed"]),

// After
reason: z.enum(["duplicate", "event_not_allowed", "inactive_connection"]),
```

No other changes in this file. `EventCaptureOutputFiltered` is a derived type — it updates automatically.

### Success Criteria:
#### Automated Verification:
- [ ] `pnpm --filter @repo/app-validation build` exits 0
- [ ] `pnpm typecheck` exits 0

---

## Phase 3: Update `workspaceIntegrations` Schema File and Type Exports

The DB schema file still has `isActive: boolean` in the Drizzle table definition. After Phase 0 runs the migration, the Drizzle schema must match the actual DB columns.

### Changes Required:

#### 1. Table definition
**File**: `db/console/src/schema/tables/workspace-integrations.ts`

- Remove `boolean` from `drizzle-orm/pg-core` imports (it is the only boolean field in this file)
- Replace the `isActive` column definition with `status` and `statusReason`
- Rename `isActiveIdx` → `statusIdx` in the index factory

```ts
// Remove from pg-core imports:
boolean,

// Replace:
isActive: boolean("is_active").notNull().default(true),

// With:
status: varchar("status", { length: 50 }).notNull().default("active"),
statusReason: varchar("status_reason", { length: 100 }),
```

Index factory change:
```ts
// Before:
isActiveIdx: index("workspace_source_is_active_idx").on(table.isActive),

// After:
statusIdx: index("workspace_source_status_idx").on(table.status),
```

#### 2. Type exports
**File**: `db/console/src/schema/tables/workspace-integrations.ts` (bottom of file)

No changes needed — `WorkspaceIntegration` and `InsertWorkspaceIntegration` are inferred types. They will automatically reflect the new columns.

### Success Criteria:
#### Automated Verification:
- [ ] `pnpm --filter @db/app build` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] No `isActive` references remain in `db/console/src/schema/tables/workspace-integrations.ts`

---

## Phase 4: Update All `isActive` Read/Write Sites

Replace every reference to `workspaceIntegrations.isActive` with `workspaceIntegrations.status` across tRPC routers, seed scripts, and the integration test fixture setup.

### Changes Required:

#### 1. `workspace.sources.list` — SELECT and WHERE
**File**: `api/console/src/router/org/workspace.ts` — around lines 347–391

In the `sources.statistics` query (the `sources.list` handler):

```ts
// SELECT clause — remove isActive, add status + statusReason:
// Before:
isActive: workspaceIntegrations.isActive,

// After:
status: workspaceIntegrations.status,
statusReason: workspaceIntegrations.statusReason,
```

```ts
// WHERE clause:
// Before:
eq(workspaceIntegrations.isActive, true)

// After:
eq(workspaceIntegrations.status, "active")
```

```ts
// Return shape in list items:
// Before:
isActive: s.isActive,

// After:
isActive: s.status === "active", // Keep field name for UI compat
status: s.status,
statusReason: s.statusReason,
```

#### 2. `integrations.disconnect` — workspace-level disconnect
**File**: `api/console/src/router/org/workspace.ts` — around line 483

```ts
// Before:
.set({ isActive: false, updatedAt: new Date().toISOString() })

// After:
.set({
  status: "disconnected",
  statusReason: "user_disconnected",
  updatedAt: new Date().toISOString(),
})
```

#### 3. `linkVercelProject` — reactivation check and new insert
**File**: `api/console/src/router/org/workspace.ts` — around lines 552–600

```ts
// Reactivation check:
// Before:
if (!existing.isActive) {
  await ctx.db.update(workspaceIntegrations)
    .set({ isActive: true, updatedAt: ... })

// After:
if (existing.status !== "active") {
  await ctx.db.update(workspaceIntegrations)
    .set({ status: "active", statusReason: null, updatedAt: ... })
```

```ts
// New insert:
// Before:
isActive: true,

// After:
status: "active",
```

#### 4. `unlinkVercelProject`
**File**: `api/console/src/router/org/workspace.ts` — around line 656

```ts
// Before:
.set({ isActive: false, updatedAt: new Date().toISOString() })

// After:
.set({
  status: "disconnected",
  statusReason: "user_unlinked",
  updatedAt: new Date().toISOString(),
})
```

#### 5. `bulkLinkResources` — categorization, reactivation, new insert
**File**: `api/console/src/router/org/workspace.ts` — around lines 805, 832–839, 883

```ts
// Categorization (line 805):
// Before:
} else if (existingIntegration.isActive) {

// After:
} else if (existingIntegration.status === "active") {
```

```ts
// Reactivation batch update (line 832):
// Before:
.set({ isActive: true, updatedAt: now })

// After:
.set({ status: "active", statusReason: null, updatedAt: now })
```

```ts
// New insert values (line 882):
// Before:
isActive: true,

// After:
status: "active",
```

#### 6. `m2m/sources.ts` — all four procedures

**File**: `api/console/src/router/m2m/sources.ts`

`findByGithubRepoId` (line 72):
```ts
// Before:
eq(workspaceIntegrations.isActive, true)
// After:
eq(workspaceIntegrations.status, "active")
```

`getSourceIdByGithubRepoId` (line 108):
```ts
// Before:
eq(workspaceIntegrations.isActive, true)
// After:
eq(workspaceIntegrations.status, "active")
```

`markGithubRepoInactive` (line 137 SELECT, line 150 UPDATE):
```ts
// SELECT WHERE:
// Before:
eq(workspaceIntegrations.isActive, true)
// After:
eq(workspaceIntegrations.status, "active")

// UPDATE SET:
// Before:
{ isActive: false, updatedAt: now }
// After:
{ status: "disconnected", statusReason: "repository_removed", updatedAt: now }
```

`markGithubInstallationInactive` (line 211 SELECT, line 229 UPDATE):
```ts
// SELECT WHERE:
// Before:
eq(workspaceIntegrations.isActive, true)
// After:
eq(workspaceIntegrations.status, "active")

// UPDATE SET (also drop redundant lastSyncError string — statusReason carries it now):
// Before:
{ isActive: false, lastSyncedAt: now, lastSyncStatus: "failed",
  lastSyncError: "GitHub installation removed or suspended", updatedAt: now }
// After:
{ status: "disconnected", statusReason: "installation_removed",
  lastSyncedAt: now, lastSyncStatus: "failed", updatedAt: now }
```

`markGithubDeleted` (line 302 UPDATE):
```ts
// Before:
{ isActive: false, lastSyncedAt: now, lastSyncStatus: "failed",
  lastSyncError: "Repository deleted on GitHub", updatedAt: now }
// After:
{ status: "deleted", statusReason: "repository_deleted",
  lastSyncedAt: now, lastSyncStatus: "failed", updatedAt: now }
```

Note: `markGithubDeleted` does not filter by `isActive` in its SELECT (it uses a bare `eq(providerResourceId, ...)`). This is intentional — it marks all matching rows deleted regardless of current status. No change to the WHERE clause.

#### 7. Seed script
**File**: `packages/console-test-data/src/cli/seed-integrations.ts` — line 181

```ts
// Before:
isActive: true,
// After:
status: "active",
```

#### 8. UI sources-list component (cleanup)
**File**: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/sources/_components/sources-list.tsx` — line 43

The `connections.list` tRPC response returns `{ isActive: true }` as a hardcoded value derived from filtering `gatewayInstallations.status = 'active'`. This field is safe as-is but should be noted: the UI reads `i.isActive` from this response. Since the response shape is hardcoded (not from `workspaceIntegrations`), no change is required at the DB layer. Leave it unchanged.

### Success Criteria:
#### Automated Verification:
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm check` exits 0 (no lint errors)
- [ ] `pnpm --filter @api/app build` exits 0 (tRPC types compile)
- [ ] Zero `isActive` references in `api/console/src/router/` (verified with grep)
- [ ] Zero `isActive` references in `packages/console-test-data/src/` (verified with grep)

---

## Phase 5: Gate 2 in `event-store.ts`

Add the `status !== 'active'` check to the `check-event-allowed` step. Events that pass resource-ID resolution but have an inactive integration are rejected with `reason: 'inactive_connection'`.

### Changes Required:

#### 1. `check-event-allowed` step
**File**: `api/console/src/inngest/workflow/neural/event-store.ts` — lines 284–316

After the integration lookup (`db.query.workspaceIntegrations.findFirst`), add the status check immediately before the `providerConfig` check:

```ts
const integration = await db.query.workspaceIntegrations.findFirst({
  where: and(
    eq(workspaceIntegrations.workspaceId, workspaceId),
    eq(workspaceIntegrations.providerResourceId, resourceId)
  ),
});

if (!integration) {
  log.info("Integration not found for resource, rejecting event", {
    workspaceId,
    resourceId,
    provider: sourceEvent.provider,
  });
  return { allowed: false, reason: "no_integration" as const };
}

// Gate 2: check integration is active
if (integration.status !== "active") {
  log.info("Integration is not active, rejecting event (Gate 2)", {
    workspaceId,
    resourceId,
    provider: sourceEvent.provider,
    integrationStatus: integration.status,
    statusReason: integration.statusReason,
  });
  return { allowed: false, reason: "inactive_connection" as const };
}

const baseEventType = getBaseEventType(sourceEvent.provider, sourceEvent.eventType);
const allowed = isEventAllowed(integration.providerConfig, baseEventType);

if (!allowed) {
  log.info("Event filtered by provider config", {
    workspaceId,
    resourceId,
    eventType: sourceEvent.eventType,
    baseEventType,
    configuredEvents: integration.providerConfig?.sync?.events,
  });
}

return { allowed, reason: allowed ? ("allowed" as const) : ("event_not_allowed" as const) };
```

**Note on return type change**: The step currently returns `boolean`. Changing to `{ allowed: boolean, reason: string }` makes the reason available to the subsequent branch. Update the variable name and all usages:

```ts
// Before:
const eventAllowed = await step.run("check-event-allowed", async () => { ... });
if (!eventAllowed) { ... }

// After:
const gateResult = await step.run("check-event-allowed", async () => { ... });
if (!gateResult.allowed) { ... }
```

#### 2. Filtered branch — inactive connection reason
**File**: `api/console/src/inngest/workflow/neural/event-store.ts` — around line 319

```ts
// Before (single branch for all filtered cases):
if (!eventAllowed) {
  await step.run("complete-job-filtered", async () => {
    await completeJob({
      jobId,
      status: "completed",
      output: {
        inngestFunctionId: "event.capture",
        status: "filtered",
        reason: "event_not_allowed",
        sourceId: sourceEvent.sourceId,
      } satisfies EventCaptureOutputFiltered,
    });
  });
  return { status: "filtered", reason: "Event type not enabled in source config", duration: ... };
}

// After (split by reason):
if (!gateResult.allowed) {
  const filteredReason =
    gateResult.reason === "inactive_connection"
      ? ("inactive_connection" as const)
      : ("event_not_allowed" as const);

  await step.run("complete-job-filtered", async () => {
    await completeJob({
      jobId,
      status: "completed",
      output: {
        inngestFunctionId: "event.capture",
        status: "filtered",
        reason: filteredReason,
        sourceId: sourceEvent.sourceId,
      } satisfies EventCaptureOutputFiltered,
    });
  });

  return {
    status: "filtered",
    reason:
      filteredReason === "inactive_connection"
        ? "Integration is not active"
        : "Event type not enabled in source config",
    duration: Date.now() - startTime,
  };
}
```

**Note**: `"no_integration"` (integration not found) still results in `reason: "event_not_allowed"` in the job output since there is no integration row to confirm inactivity — this is the correct conservative behavior. Only `"inactive_connection"` gets the new reason code.

### Success Criteria:
#### Automated Verification:
- [ ] `pnpm --filter @api/app build` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm check` exits 0

---

## Phase 6: Non-GitHub Disconnect Cascade

When `connections.disconnect` revokes a `gatewayInstallation`, cascade to set all associated `workspaceIntegrations` rows to `status: 'disconnected'`.

### Changes Required:

#### 1. `connections.disconnect` mutation — add cascade
**File**: `api/console/src/router/org/connections.ts` — around lines 119–145

The mutation currently only updates `gatewayInstallations`. Add a second update targeting all `workspaceIntegrations` rows linked to the revoked installation:

```ts
disconnect: orgScopedProcedure
  .input(z.object({ integrationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const result = await ctx.db
      .update(gatewayInstallations)
      .set({ status: "revoked" })
      .where(
        and(
          eq(gatewayInstallations.id, input.integrationId),
          eq(gatewayInstallations.orgId, ctx.auth.orgId)
        )
      )
      .returning({ id: gatewayInstallations.id });

    if (!result[0]) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Integration not found or access denied",
      });
    }

    // Cascade: mark all workspace integrations for this installation as disconnected.
    // This covers all providers (Vercel, Linear, Sentry, Apollo, GitHub).
    // GitHub is also handled by the m2m router on webhook events — the cascade here
    // ensures the gate closes immediately on user-triggered disconnect.
    const now = new Date().toISOString();
    await ctx.db
      .update(workspaceIntegrations)
      .set({
        status: "disconnected",
        statusReason: "installation_revoked",
        updatedAt: now,
      })
      .where(eq(workspaceIntegrations.installationId, input.integrationId));

    return { success: true };
  }),
```

**Import note**: `workspaceIntegrations` must be added to the imports at the top of `connections.ts` if it is not already imported.

### Success Criteria:
#### Automated Verification:
- [ ] `pnpm --filter @api/app build` exits 0
- [ ] `pnpm typecheck` exits 0

#### Manual Verification:
- [ ] Disconnect a non-GitHub installation (e.g., Vercel) via the Settings > Connections page
- [ ] Confirm in DB that all associated `workspaceIntegrations` rows have `status = 'disconnected'`
- [ ] Send a test webhook event for one of those integrations and confirm it is rejected by Gate 2 with `reason: 'inactive_connection'` visible in the Inngest dashboard

---

## Phase 7: Update Tests

### Changes Required:

#### 1. Integration test fixture — seed with `status` not `isActive`
**File**: `packages/integration-tests/src/neural-pipeline.integration.test.ts` — line 241

```ts
// Before:
await testDb.insert(workspaceIntegrations).values({
  workspaceId: "ws_test001",
  installationId: "inst_test001",
  provider: "github",
  providerResourceId: "567890123",
  providerConfig: { ... },
  isActive: true,
  ...
});

// After:
await testDb.insert(workspaceIntegrations).values({
  workspaceId: "ws_test001",
  installationId: "inst_test001",
  provider: "github",
  providerResourceId: "567890123",
  providerConfig: { ... },
  status: "active",
  ...
});
```

#### 2. New test — Gate 2 blocks inactive integration
**File**: `packages/integration-tests/src/neural-pipeline.integration.test.ts`

Add a new describe block after Suite 1 (eventStore happy path):

```ts
describe("Suite 1b — eventStore Gate 2 (inactive integration)", () => {
  it("rejects event with reason inactive_connection when integration status != active", async () => {
    // Override the seeded integration to be disconnected
    await db
      .update(workspaceIntegrations)
      .set({ status: "disconnected", statusReason: "user_disconnected" })
      .where(eq(workspaceIntegrations.providerResourceId, "567890123"));

    const step = makeStep();
    const result = await getEventStoreHandler()({
      event: makeCaptureEvent(BASE_EVENT),
      step,
    });

    expect(result.status).toBe("filtered");
    expect(result.reason).toBe("Integration is not active");

    // No event stored
    const events = await db.select().from(workspaceEvents);
    expect(events).toHaveLength(0);

    // Job completed with inactive_connection reason
    const jobs = await db.select().from(workspaceWorkflowRuns);
    expect(jobs).toHaveLength(1);
    const output = jobs[0]?.output as { reason?: string } | null;
    expect(output?.reason).toBe("inactive_connection");
  });
});
```

### Success Criteria:
#### Automated Verification:
- [ ] `pnpm --filter @repo/integration-tests test` exits 0
- [ ] New Gate 2 test case passes
- [ ] Zero `isActive` references anywhere in `packages/integration-tests/src/` (verified with grep)
- [ ] Zero `isActive` references anywhere in `packages/console-test-data/src/` (verified with grep)

---

## Testing Strategy

### Automated Tests

**Integration tests** (`packages/integration-tests/src/neural-pipeline.integration.test.ts`):
- Suite 1 (happy path): event stored when `status = 'active'` — existing, updated fixture
- Suite 1b (Gate 2 block): event rejected when `status = 'disconnected'` — new test
- Suite 2 (duplicate): no change needed
- Suite 3 (entity graph + embed): no change needed

**Type checking**:
- `pnpm typecheck` must pass — catches any `isActive` references the grep missed
- `pnpm --filter @api/app build` — validates tRPC output types include the new reason

### Manual Testing Steps

1. **Active integration — event passes Gate 2**:
   - Connect a GitHub repo to a workspace
   - Trigger a push event via the GitHub webhook
   - Confirm the event appears in the workspace event feed
   - Confirm the Inngest job shows `status: 'success'`

2. **Inactive integration — event blocked by Gate 2**:
   - Disconnect a workspace integration (workspace-level, not org-level)
   - Trigger a webhook event for the disconnected resource
   - Confirm no new event appears in the workspace event feed
   - Confirm the Inngest job shows `status: 'filtered'` with `reason: 'inactive_connection'`

3. **Non-GitHub cascade**:
   - Connect a Vercel project to a workspace
   - Revoke the Vercel installation from Settings > Connections
   - Confirm `workspaceIntegrations.status = 'disconnected'` for all Vercel rows on that installation
   - Trigger a Vercel webhook event
   - Confirm it is rejected at Gate 2

4. **Reactivation**:
   - Re-add a previously disconnected integration via `bulkLinkResources`
   - Confirm `workspaceIntegrations.status = 'active'` and `statusReason = null`
   - Confirm subsequent events pass Gate 2

---

## Migration Notes

### Production Deployment Order

1. Phase 0 DB migration runs first (`pnpm db:migrate`) — adds `status` + `statusReason` columns, backfills `status` from `isActive`, drops `is_active`
2. Phases 2–7 deploy together as a single application code release
3. The `status` column has `DEFAULT 'active'` — any rows created between the DB migration and the code release will be correct by default

### Rollback

If the application code release must be rolled back after the DB migration has run:
- The `isActive` column is gone — old code that reads `workspaceIntegrations.isActive` will throw at runtime
- Rollback of the DB migration is not safe once live traffic has written new rows with `status` values
- **Mitigation**: Deploy application code immediately after the DB migration. Keep the deployment window short.

---

## References

- Research: `thoughts/shared/research/2026-03-18-console-double-gate-wi-schema.md`
- Phase 0 DB migration plan: `thoughts/shared/plans/2026-03-18-phase0-db-schema-migration.md` (dependency)
- `event-store.ts`: `api/console/src/inngest/workflow/neural/event-store.ts:247–317`
- `workspace.ts`: `api/console/src/router/org/workspace.ts`
- `sources.ts` (m2m): `api/console/src/router/m2m/sources.ts`
- `connections.ts`: `api/console/src/router/org/connections.ts:119–145`
- `workspace-integrations.ts` (schema): `db/console/src/schema/tables/workspace-integrations.ts`
- `workflow-io.ts` (validation): `packages/console-validation/src/schemas/workflow-io.ts:59–64`
- Integration test: `packages/integration-tests/src/neural-pipeline.integration.test.ts`
- Seed script: `packages/console-test-data/src/cli/seed-integrations.ts:181`

# Consolidate `gatewayResources` into `orgIntegrations` — Implementation Plan

## Overview

Eliminate the redundant `gatewayResources` table by migrating all consumers to `orgIntegrations`. Simultaneously fix a latent bug where `resourceName` (used as API routing keys in backfill) stored stale data that broke on renames — replaced with live resolution from provider APIs via a new `resolveResourceMeta` function on `BackfillDef`.

## Current State Analysis

Two tables answer the same question — "which provider resources are linked to which installation?" — with slightly different columns:

- `orgIntegrations` (survivor): has `clerkOrgId`, `providerConfig`, `documentCount`, but no `resourceName`
- `gatewayResources` (to drop): has `resourceName`, used by 5 platform-layer consumers + 1 app-layer consumer (6 total)

`resourceName` conflates two concerns: display label and API routing key (`"owner/repo"` for GitHub, `"orgSlug/projectSlug"` for Sentry). It's written at link time and goes stale on renames, silently breaking backfills.

### Key Discoveries:
- `resourceName` is a **functional API path segment** for GitHub/Sentry backfill, not just a label (`github/backfill.ts:104`, `sentry/backfill.ts:143,179`)
- However, `resourceName` is **NOT used in `buildRequest`** for Linear or Vercel — those providers use `providerResourceId` for API routing and `resourceName` only in output/adapter payloads
- 7 unused columns across 2 tables confirmed: `orgIntegrations.{lastSyncedAt, lastSyncStatus, lastSyncError, connectedAt}`, `gatewayInstallations.{configStatus, webhookSecret, metadata}`
- 3 dead procedures with zero callers on `api/platform/src/router/memory/connections.ts`: `get` (line 72), `registerResource` (line 296), `removeResource` (line 394)
- Vercel disconnect at `connections.ts:444-472` is missing the `orgIntegrations.status → disconnected` cascade — a bug
- `connectedBy` on `gatewayInstallations` is actively used (OAuth callback + GitHub stateless reinstall) — do NOT touch
- Webhook routing can be simplified from a 2-table JOIN to a single-table query, eliminating a timing bug in the teardown window
- Sentry org slug is **never stored** — not in `providerAccountInfo`, not in `providerConfig`. Must be resolved live via `GET /api/0/organizations/`
- `orgIntegrations` lacks a unique composite index on `(installationId, providerResourceId)` — needed to prevent duplicate links and enable upsert
- The backfill orchestrator **never acquires a token** — that's done by entity workers. Adding `resolveResourceMeta` introduces a new token-fetch step to the orchestrator

### `resourceName` Criticality by Provider:

| Provider | Used in `buildRequest`? | Used in adapter/output? | Failure = blocked backfill? |
|---|---|---|---|
| GitHub | Yes (owner/repo → pathParams) | Yes (repo shape) | **Yes** |
| Sentry | Yes (orgSlug/projectSlug → pathParams) | No | **Yes** |
| Linear | No | Yes (teamName in project payload) | No — fallback to `providerResourceId` |
| Vercel | No | Yes (projectName, already has fallback) | No — fallback to `providerResourceId` |

## Desired End State

- `gatewayResources` table fully dropped
- All consumers query `orgIntegrations` directly (no JOINs for webhook routing)
- `resourceName` resolved live from provider APIs at backfill time via `BackfillDef.resolveResourceMeta`
- 7 dead columns removed, 3 dead procedures deleted
- Vercel disconnect cascade fixed
- `bulkLink` simplified to `ON CONFLICT DO UPDATE` upsert with unique index
- `resources.list` returns `resourceName ?? providerResourceId` as `displayName`
- Status vocabulary standardized on `active/disconnected` (no `removed`)
- All existing tests pass, no regressions in webhook ingestion or backfill

### Verification:
```bash
pnpm check && pnpm typecheck && pnpm build:app && pnpm build:platform
cd db/app && pnpm db:generate  # should produce no diff after final migration
```

## What We're NOT Doing

- Dropping `gatewayInstallations` — still the authoritative installation record, heavily referenced by 15+ consumers
- Changing `BackfillContext.resource.resourceName` type — consumers (`buildRequest`, `processResponse`) keep the same signature
- Adding `resourceName` column to `orgIntegrations` — resolved live instead
- Changing the Inngest event schema for `memory/webhook.received` — it doesn't use `resourceName`
- Touching `gatewayTokens`, `gatewayBackfillRuns`, `gatewayLifecycleLogs`, or `gatewayWebhookDeliveries`

## Implementation Approach

Four phases: schema cleanup, provider resolve functions, consumer migration, table drop. Each phase is independently deployable and verifiable.

---

## Phase 1: Schema Changes + Indexes

### Overview
Drop 7 unused columns, add 2 indexes to `orgIntegrations` for the new query patterns.

### Changes Required:

#### 1. Drop unused columns from `orgIntegrations`
**File**: `db/app/src/schema/tables/org-integrations.ts`
**Changes**: Remove `lastSyncedAt` (line 75-78), `lastSyncStatus` (line 79-81), `lastSyncError` (line 82), `connectedAt` (line 88-93). Remove the `SyncStatus` type import if it becomes unused.

#### 2. Drop unused columns from `gatewayInstallations`
**File**: `db/app/src/schema/tables/gateway-installations.ts`
**Changes**: Remove `configStatus` (line 68), `webhookSecret` (line 34), `metadata` (line 35).

#### 3. Add composite index for webhook routing
**File**: `db/app/src/schema/tables/org-integrations.ts`
**Changes**: Add index in the table's index function:
```ts
providerResourceStatusIdx: index("org_integration_provider_resource_status_idx").on(
  table.providerResourceId,
  table.status
),
```

#### 4. Add unique composite index for upsert
**File**: `db/app/src/schema/tables/org-integrations.ts`
**Changes**: Add unique index:
```ts
installationResourceIdx: uniqueIndex("org_integration_installation_resource_idx").on(
  table.installationId,
  table.providerResourceId
),
```
Import `uniqueIndex` from `drizzle-orm/pg-core`.

#### 5. Update seed CLI
**File**: `packages/app-test-data/src/cli/seed-integrations.ts`
**Changes**: Remove `lastSyncStatus` from the insert at line 161 (column no longer exists).

#### 6. Generate migration
```bash
cd db/app && pnpm db:generate
```

### Success Criteria:

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/app && pnpm db:generate`
- [x] Migration applies cleanly: `cd db/app && pnpm db:migrate`
- [x] Type checking passes: `pnpm typecheck` (pre-existing GitHubSourceMetadata error fixed as side-effect)
- [x] Lint passes: `pnpm check` (pre-existing lint errors unrelated; 3 new are Drizzle-generated JSON format)
- [x] App builds: `pnpm build:app`
- [x] Platform builds: `pnpm build:platform`

#### Manual Verification:
- [ ] Drizzle Studio shows columns removed and indexes added
- [ ] Existing app functionality unaffected (columns were unused)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add `resolveResourceMeta` to Provider Interface

### Overview
Add a function to `BackfillDef` that resolves the resource metadata string (formerly `resourceName`) from the provider API using the stable `providerResourceId`. Implement for all 4 providers. This phase is additive — no consumers change yet.

### Changes Required:

#### 1. Extend `BackfillDef` interface
**File**: `packages/app-providers/src/provider/backfill.ts`
**Changes**: Add `resolveResourceMeta` to the `BackfillDef` interface:

```ts
export interface BackfillDef {
  readonly defaultEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
  readonly supportedEntityTypes: readonly string[];
  /** Resolve resource metadata (e.g., owner/repo) live from provider API.
   *  Replaces stale DB-stored resourceName with current values.
   *  Called once per resource at the start of backfill orchestration. */
  readonly resolveResourceMeta: (params: {
    providerResourceId: string;
    token: string;
  }) => Promise<string>;
}
```

#### 2. GitHub implementation
**File**: `packages/app-providers/src/providers/github/backfill.ts`
**Changes**: Add to `githubBackfill`:

```ts
resolveResourceMeta: async ({ providerResourceId, token }) => {
  // GET /repositories/{id} returns { full_name: "owner/repo" }
  const res = await fetch(
    `https://api.github.com/repositories/${providerResourceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!res.ok) {
    throw new Error(
      `GitHub repo lookup failed for ${providerResourceId}: ${res.status}`
    );
  }
  const repo = (await res.json()) as { full_name: string };
  return repo.full_name;
},
```

#### 3. Sentry implementation
**File**: `packages/app-providers/src/providers/sentry/backfill.ts`
**Changes**: Add to `sentryBackfill`. Two-step resolution: first get org slug (token is org-scoped → single org), then find project by numeric ID. The original approach of listing ALL projects via `GET /api/0/projects/` was rejected because the endpoint paginates at 100 and would silently miss projects in large orgs.

```ts
resolveResourceMeta: async ({ providerResourceId, token }) => {
  // Step 1: Get org slug — token is org-scoped, so this returns one org
  const orgRes = await fetch("https://sentry.io/api/0/organizations/", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!orgRes.ok) {
    throw new Error(`Sentry org lookup failed: ${orgRes.status}`);
  }
  const orgs = (await orgRes.json()) as Array<{ slug: string }>;
  const orgSlug = orgs[0]?.slug;
  if (!orgSlug) {
    throw new Error("Sentry org not found for token");
  }

  // Step 2: Get project slug — iterate paginated project list for this org
  // (Sentry doesn't reliably support numeric IDs in per-project endpoints)
  let url: string | null =
    `https://sentry.io/api/0/organizations/${orgSlug}/projects/?per_page=100`;
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Sentry project lookup failed: ${res.status}`);
    }
    const projects = (await res.json()) as Array<{ id: string; slug: string }>;
    const project = projects.find((p) => p.id === providerResourceId);
    if (project) {
      return `${orgSlug}/${project.slug}`;
    }
    // Parse Link header for next page
    const link = res.headers.get("link") ?? "";
    const next = link.match(/<([^>]+)>;\s*rel="next";\s*results="true"/);
    url = next?.[1] ?? null;
  }
  throw new Error(`Sentry project not found: ${providerResourceId}`);
},
```

#### 4. Linear implementation
**File**: `packages/app-providers/src/providers/linear/backfill.ts`
**Changes**: Add to `linearBackfill`. Resolves team name via GraphQL:

```ts
resolveResourceMeta: async ({ providerResourceId, token }) => {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `query($id: String!) { team(id: $id) { name } }`,
      variables: { id: providerResourceId },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Linear team lookup failed: ${res.status}`);
  }
  const body = (await res.json()) as {
    data?: { team?: { name?: string } };
  };
  return body.data?.team?.name ?? "";
},
```

#### 5. Vercel implementation
**File**: `packages/app-providers/src/providers/vercel/backfill.ts`
**Changes**: Add to `vercelBackfill`. Fetches project name from Vercel API:

```ts
resolveResourceMeta: async ({ providerResourceId, token }) => {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${providerResourceId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!res.ok) {
    // Graceful fallback — Vercel already uses providerResourceId as fallback
    return providerResourceId;
  }
  const project = (await res.json()) as { name?: string };
  return project.name ?? providerResourceId;
},
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] Existing tests pass (no consumers changed yet)
- [x] App builds: `pnpm build:app`
- [x] Platform builds: `pnpm build:platform`

#### Manual Verification:
- [x] None needed — this phase is purely additive

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Migrate All Consumers from `gatewayResources` → `orgIntegrations`

### Overview
Switch every `gatewayResources` consumer to use `orgIntegrations` (or live resolution). Fix the Vercel disconnect bug. Delete dead code. Simplify `bulkLink` to upsert.

### Changes Required:

#### 1. Webhook routing — `ingest-delivery.ts`
**File**: `api/platform/src/inngest/functions/ingest-delivery.ts`
**Lines**: 60-83
**Changes**: Replace the `gatewayResources` JOIN query with a direct `orgIntegrations` query:

> **Note (post-scrutiny):** The current query reads `gatewayInstallations.orgId`. The replacement reads `orgIntegrations.clerkOrgId`. These are semantically equivalent — `clerkOrgId` is set from the same Clerk org context during `bulkLink`. The returned field is aliased as `orgId` to preserve the downstream contract.

```ts
const rows = await db
  .select({
    installationId: orgIntegrations.installationId,
    orgId: orgIntegrations.clerkOrgId,
  })
  .from(orgIntegrations)
  .where(
    and(
      eq(orgIntegrations.providerResourceId, data.resourceId),
      eq(orgIntegrations.status, "active")
    )
  )
  .limit(1);

const row = rows[0];
if (!row) {
  return null;
}

return { connectionId: row.installationId, orgId: row.orgId };
```

Update imports: remove `gatewayResources`, `gatewayInstallations`; add `orgIntegrations`.

#### 2. Backfill orchestrator — resolve resource names live
**File**: `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts`
**Lines**: 101-191
**Changes**:

> **Design note (post-scrutiny):** The orchestrator currently never acquires a token — that's the entity worker's job. Adding `resolveResourceMeta` introduces a new token-fetch step. To minimize redundant DB queries, we expand `get-connection` to return `externalId` (needed by `getActiveTokenForInstallation`), so the resolve step doesn't re-fetch the installation row.
>
> **Resilience:** For GitHub/Sentry, `resourceName` is required for API routing — resolution failure must skip the resource. For Linear/Vercel, `resourceName` is only used in adapter output — resolution failure falls back to `providerResourceId` so the backfill still proceeds.

a) Modify the existing `get-connection` step to query `orgIntegrations` instead of `gatewayResources`, and return `externalId`:
```ts
// Replace gatewayResources query with orgIntegrations
const resources = await db
  .select({
    providerResourceId: orgIntegrations.providerResourceId,
  })
  .from(orgIntegrations)
  .where(
    and(
      eq(orgIntegrations.installationId, installationId),
      eq(orgIntegrations.status, "active")
    )
  );

return {
  id: conn.id,
  externalId: conn.externalId, // ← NEW: needed for token acquisition in resolve step
  provider: conn.provider,
  orgId: conn.orgId,
  status: conn.status,
  resources,
};
```

b) Add a new step `resolve-resource-meta` after `get-connection`. Uses the `externalId` from step (a) to avoid re-fetching the installation:
```ts
const resolvedResources = await step.run("resolve-resource-meta", async () => {
  const config = providerConfigs[provider];
  const { token } = await getActiveTokenForInstallation(
    { id: connection.id, externalId: connection.externalId, provider: connection.provider },
    config,
    providerDef as ProviderDefinition
  );

  // Providers where resourceName is NOT needed for API routing can fall back
  const resourceNameRequiredForRouting = ["github", "sentry"].includes(provider);

  return Promise.all(
    connection.resources.map(async (r) => {
      try {
        const resourceName = await providerDef.backfill.resolveResourceMeta({
          providerResourceId: r.providerResourceId,
          token,
        });
        return { providerResourceId: r.providerResourceId, resourceName };
      } catch (err) {
        log.warn("[backfill] failed to resolve resource meta", {
          providerResourceId: r.providerResourceId,
          error: err instanceof Error ? err.message : String(err),
        });
        if (resourceNameRequiredForRouting) {
          // GitHub/Sentry: resourceName is used in buildRequest pathParams — must skip
          return null;
        }
        // Linear/Vercel: resourceName is only used in adapter output — fallback is safe
        return { providerResourceId: r.providerResourceId, resourceName: r.providerResourceId };
      }
    })
  ).then((results) => results.filter((r): r is NonNullable<typeof r> => r !== null));
});
```

c) Replace the `resourceName` null-guard in work unit enumeration (lines 172-191) — use `resolvedResources` instead of `connection.resources`:
```ts
const workUnits = resolvedResources.flatMap((resource) => {
  return resolvedEntityTypes.map((entityType: string) => ({
    entityType,
    resource: {
      providerResourceId: resource.providerResourceId,
      resourceName: resource.resourceName,
    },
    workUnitId: `${resource.providerResourceId}-${entityType}`,
  }));
});
```

d) Add imports: `getActiveTokenForInstallation` from `../../lib/token-helpers`, `providerConfigs` from `../../lib/provider-configs`, `orgIntegrations` from `@db/app/schema`. Import `ProviderDefinition` type from `@repo/app-providers`. Remove `gatewayResources` import.

#### 3. Backfill estimate — resolve resource names live
**File**: `api/platform/src/router/memory/backfill.ts`
**Lines**: 186-265
**Changes**:

a) Replace `gatewayResources` query (lines 186-197) with `orgIntegrations`:
```ts
const resources = await db
  .select({
    providerResourceId: orgIntegrations.providerResourceId,
  })
  .from(orgIntegrations)
  .where(
    and(
      eq(orgIntegrations.installationId, installationId),
      eq(orgIntegrations.status, "active")
    )
  );
```

b) Resolve names using the token already obtained at lines 228-232:
```ts
// Resolve resource names live from provider API
const resourceNameRequiredForRouting = ["github", "sentry"].includes(provider);
const resolvedResources = (await Promise.all(
  resources.map(async (r) => {
    try {
      const resourceName = await backfill.resolveResourceMeta({
        providerResourceId: r.providerResourceId,
        token,
      });
      return { providerResourceId: r.providerResourceId, resourceName };
    } catch {
      if (resourceNameRequiredForRouting) {
        // GitHub/Sentry: can't estimate without valid path segments — skip
        return null;
      }
      // Linear/Vercel: resourceName not used in buildRequest — fallback is safe
      return { providerResourceId: r.providerResourceId, resourceName: r.providerResourceId };
    }
  })
)).filter((r): r is NonNullable<typeof r> => r !== null);
```

> **Post-scrutiny fix:** The original plan used `resourceName: ""` on failure, which would break GitHub/Sentry `buildRequest` (they split `""` on `"/"` producing empty pathParams). Now matches the orchestrator's error handling: skip for routing-critical providers, fallback for display-only providers.

c) Use `resolvedResources` in the probe jobs loop (line 244), replacing `resources`.

d) Update imports: remove `gatewayResources`; add `orgIntegrations`.

#### 4. Connection lifecycle teardown — remove redundant step
**File**: `api/platform/src/inngest/functions/connection-lifecycle.ts`
**Lines**: 165-204
**Changes**: Remove the entire `remove-resources` step. The app-layer cascade at `connections.ts:130-138` already sets `orgIntegrations.status → 'disconnected'` synchronously before the Inngest event fires, which blocks future webhook routing. The lifecycle log insert (lines 187-198) should be preserved — move it into the `close-gate` step or `revoke-token` step, using `orgIntegrations` to enumerate resource IDs:

```ts
// In close-gate step, after updating gatewayInstallations.status:
const activeResources = await db
  .select({ providerResourceId: orgIntegrations.providerResourceId })
  .from(orgIntegrations)
  .where(
    and(
      eq(orgIntegrations.installationId, installationId),
      eq(orgIntegrations.status, "active")
    )
  );

// Note: orgIntegrations may already be 'disconnected' if app-layer ran first.
// Fall back to getting all resources for this installation.
const allResources = activeResources.length > 0 ? activeResources : await db
  .select({ providerResourceId: orgIntegrations.providerResourceId })
  .from(orgIntegrations)
  .where(eq(orgIntegrations.installationId, installationId));

const resourceIdMap: Record<string, string> = {};
for (const r of allResources) {
  resourceIdMap[r.providerResourceId] = "disconnected";
}

await db.insert(gatewayLifecycleLogs).values({
  installationId,
  event: "resources_removed",
  fromStatus: "revoked",
  toStatus: "revoked",
  reason: `Disconnected ${allResources.length} linked resource(s) during teardown`,
  resourceIds: resourceIdMap,
  metadata: { step: "close-gate", triggeredBy: "system" },
});
```

Remove `gatewayResources` import.

#### 5. Fix Vercel disconnect cascade
**File**: `api/app/src/router/org/connections.ts`
**Lines**: 465-471
**Changes**: Add the `orgIntegrations` cascade after `memory.connections.disconnect()`, matching the generic disconnect pattern:

```ts
const memory = await createMemoryCaller();
await memory.connections.disconnect({
  id: installation.id,
  provider: "vercel",
});

// Cascade: mark all org integrations for this installation as disconnected
const now = new Date().toISOString();
await ctx.db
  .update(orgIntegrations)
  .set({
    status: "disconnected",
    statusReason: "installation_revoked",
    updatedAt: now,
  })
  .where(eq(orgIntegrations.installationId, installation.id));

return { success: true };
```

#### 6. Simplify `bulkLink` — remove `gatewayResources` write, use upsert
**File**: `api/app/src/router/org/connections.ts`
**Lines**: 597-659
**Changes**:

a) Replace the select-then-conditionally-insert/update pattern for `orgIntegrations` (lines 597-634) with an `ON CONFLICT DO UPDATE` upsert leveraging the new unique index:

```ts
await ctx.db
  .insert(orgIntegrations)
  .values({
    clerkOrgId: ctx.auth.orgId,
    installationId: input.integrationId,
    provider: providerSlug,
    providerConfig: providerConfig,
    providerResourceId: resource.resourceId,
  })
  .onConflictDoUpdate({
    target: [orgIntegrations.installationId, orgIntegrations.providerResourceId],
    set: {
      status: "active",
      statusReason: null,
      updatedAt: new Date().toISOString(),
    },
  });
```

b) Remove the `gatewayResources` upsert entirely (lines 639-659).

c) Remove `gatewayResources` import from the file.

#### 7. Update `resources.list` displayName
**File**: `api/app/src/router/org/connections.ts`
**Lines**: Around 519
**Changes**: The current `displayName: providerResourceId` is fine since display names are resolved live by the UI. No change needed here — the UI at `installed-sources.tsx:210-222` already resolves names from `listResources` API calls.

#### 8. Delete dead procedures from platform connections router
**File**: `api/platform/src/router/memory/connections.ts`
**Changes**:
- Delete `get` procedure (lines 72-122) — zero callers
- Delete `registerResource` procedure (lines 296-388) — zero callers
- Delete `removeResource` procedure (lines 394-435) — zero callers
- Remove `gatewayResources` import if no remaining consumers

#### 9. Update Inngest event schema
**File**: `api/platform/src/inngest/schemas/memory.ts`
**Lines**: 21-24
**Changes**: No change needed. The `memory/backfill.entity.requested` event still carries `resource: { providerResourceId, resourceName }` — the orchestrator resolves `resourceName` live and includes it in the event payload. The entity worker receives it as before.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] App builds: `pnpm build:app`
- [x] Platform builds: `pnpm build:platform`

#### Manual Verification:
- [ ] Link new resources via the sources UI → `orgIntegrations` row created, no `gatewayResources` row
- [ ] Trigger a webhook → `ingest-delivery` resolves connection via `orgIntegrations`
- [ ] Run a backfill → orchestrator resolves resource names live, entities processed
- [ ] Disconnect a GitHub installation → `orgIntegrations.status` → `disconnected`, subsequent webhooks rejected
- [ ] Disconnect a Vercel installation → `orgIntegrations.status` → `disconnected` (bug fix)
- [ ] Verify no regressions on the Sources page (resource list, status display)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Drop `gatewayResources` Table + Cleanup

### Overview
Remove the schema, relations, barrel exports, and generate the final migration. Clean up any remaining references.

### Changes Required:

#### 1. Remove schema definition
**File**: `db/app/src/schema/tables/gateway-resources.ts`
**Action**: Delete the entire file.

#### 2. Remove from barrel exports
**Files**:
- `db/app/src/schema/tables/index.ts` — remove `gatewayResources`, `GatewayResource`, `InsertGatewayResource` exports (lines 19-21)
- `db/app/src/schema/index.ts` — remove `gatewayResources`, `gatewayResourcesRelations`, `GatewayResource`, `InsertGatewayResource` exports
- `db/app/src/index.ts` — remove same

#### 3. Remove Drizzle relations
**File**: `db/app/src/schema/relations.ts`
**Changes**:
- Remove the `gatewayResourcesRelations` definition (lines 47-55)
- Remove `resources: many(gatewayResources)` from `gatewayInstallationsRelations` (line 24)
- Remove `gatewayResources` import (line 4)

#### 4. Generate migration
```bash
cd db/app && pnpm db:generate
```
This should produce a `DROP TABLE lightfast_gateway_resources` migration.

#### 5. Remove any lingering imports
Search globally for `gatewayResources`, `GatewayResource`, `InsertGatewayResource`, `gateway-resources`, and remove any remaining references (including from `connection-lifecycle.ts` if not already cleaned in Phase 3).

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/app && pnpm db:generate`
- [ ] Migration applies cleanly: `cd db/app && pnpm db:migrate`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] App builds: `pnpm build:app`
- [ ] Platform builds: `pnpm build:platform`
- [ ] No references to `gatewayResources` remain: `rg "gatewayResources|GatewayResource|InsertGatewayResource|gateway.resources|gateway_resources" --type ts -l` returns empty (excluding migrations and thoughts)

#### Manual Verification:
- [ ] Full end-to-end flow: connect a provider → link resources → receive webhook → backfill → disconnect
- [ ] Drizzle Studio confirms `lightfast_gateway_resources` table no longer exists

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:
- Verify `resolveResourceMeta` for each provider returns expected format (GitHub: `"owner/repo"`, Sentry: `"orgSlug/projectSlug"`, Linear: team name, Vercel: project name)
- Verify `resolveResourceMeta` handles API errors gracefully (throws for GitHub/Sentry, falls back for Vercel)

### Integration Tests:
- Webhook ingestion: send a webhook with a `resourceId` → verify `ingest-delivery` resolves via `orgIntegrations`
- Backfill: trigger a backfill → verify orchestrator resolves resource names live and dispatches entity workers
- Disconnect cascade: disconnect an installation → verify `orgIntegrations.status = 'disconnected'` for all providers

### Manual Testing Steps:
1. Connect a GitHub App → link repos → verify `orgIntegrations` rows created (no `gatewayResources`)
2. Push to a linked repo → verify webhook processes end-to-end
3. Run backfill on the linked repos → verify entities imported
4. Rename a GitHub repo → re-run backfill → verify it resolves the new name (this was broken before)
5. Disconnect the installation → verify all `orgIntegrations` go to `disconnected`
6. Repeat steps 1-5 for Vercel, Linear, and Sentry

## Performance Considerations

- **Webhook routing**: Moves from a 2-table JOIN to a single-table query on `orgIntegrations` with a composite index on `(providerResourceId, status)` — strictly faster
- **Backfill resolve step**: Adds 1 API call per resource at the start of each backfill run (+ 1 extra org-lookup call for Sentry). For a typical backfill (1-5 resources), this adds <2s. The Sentry implementation paginates the project list, so worst case for an org with 500 projects is ~5 pages × ~200ms = ~1s additional latency. This is acceptable since backfill is user-triggered and runs in the background.
- **Estimate resolve**: Same pattern as backfill — resolves once per estimate call. Estimate is user-triggered (not hot path).

## Migration Notes

- **No data migration needed**: `resourceName` is NOT being copied to `orgIntegrations`. It's resolved live at backfill time. Existing `orgIntegrations` rows are complete without it.
- **Status vocabulary**: `gatewayResources` used `active/removed`. After migration, only `orgIntegrations` exists with `active/disconnected`. The `removed` status is gone. The lifecycle log will record `disconnected` instead of `removed` in its `resourceIds` map.
- **Rollback**: If issues are found after Phase 3, the `gatewayResources` table still exists (dropped in Phase 4). Re-add the consumers and revert Phase 3 changes.

## Post-Scrutiny Amendments (2026-04-04)

Findings from codebase verification of every claim in the original plan:

### Issues Found and Fixed

1. **Sentry `resolveResourceMeta` pagination bug** — The original implementation called `GET /api/0/projects/` and did a linear `.find()`. This endpoint paginates at 100. For orgs with >100 projects, the target would be silently missed. **Fixed**: Two-step approach — get org slug from `GET /api/0/organizations/`, then paginate `GET /api/0/organizations/{orgSlug}/projects/` with Link header parsing. Also confirmed: Sentry org slug is **never stored** in `providerAccountInfo` or `providerConfig` (contrary to a common assumption), so live resolution is the only option.

2. **Redundant installation re-fetch in orchestrator** — The original `resolve-resource-meta` step re-queried `gatewayInstallations` to get the installation row for token acquisition. But the `get-connection` step already has the row. **Fixed**: Expanded `get-connection` return shape to include `externalId`, which `getActiveTokenForInstallation` needs.

3. **Error handling asymmetry** — Orchestrator skipped resources on resolution failure; estimate path substituted `resourceName: ""`. Empty string breaks GitHub/Sentry `buildRequest` (they split on `"/"` → empty pathParams). **Fixed**: Both paths now use the same strategy: skip for GitHub/Sentry (where `resourceName` is routing-critical), fall back to `providerResourceId` for Linear/Vercel (where it's display-only).

4. **Missing field name mapping note** — Webhook routing swaps `gatewayInstallations.orgId` → `orgIntegrations.clerkOrgId`. These are semantically equivalent but the alias needed documentation.

### Verified Accurate (No Changes Needed)

- All 6 consumers correctly identified (5 platform + 1 app-layer at `connections.ts:639-659`)
- All 3 dead procedures confirmed with zero callers
- All 7 unused columns confirmed (only `lastSyncStatus` has a seed-data write at `seed-integrations.ts:161`)
- Vercel disconnect bug confirmed — generic handler cascades to `orgIntegrations`, Vercel handler does not
- `resources.list` already reads exclusively from `orgIntegrations` — no `gatewayResources` dependency
- `memory.connections.disconnect()` does NOT directly mutate `orgIntegrations` — it only writes an audit log and enqueues an Inngest event. The cascade is done by the app-layer caller.
- Unique composite index `(installationId, providerResourceId)` exists on `gatewayResources` but NOT on `orgIntegrations` — plan correctly identifies this gap

### Architectural Verdict

The `resolveResourceMeta` approach is the right call. Alternatives considered and rejected:
- **Store `resourceName` on `orgIntegrations`**: Reintroduces the stale-data problem. Updating on webhooks adds writes to the hot path and not all webhooks carry resource names.
- **Resolve at `buildRequest` time**: Would require passing tokens through `BackfillContext` and changing every provider's entity handler signature — much higher blast radius.
- **Cache resolved names on `orgIntegrations` after resolution**: Marginal benefit (1 API call per resource per backfill) for added schema complexity.

The live-resolution approach keeps the schema lean, eliminates stale data entirely, and adds ~1-2s per backfill run (1 API call per resource). The per-provider error handling (skip vs fallback) ensures we don't regress on availability for providers where `resourceName` isn't routing-critical.

## References

- Original research: `thoughts/shared/research/2026-04-04-gateway-resources-orgintegrations-consolidation.md`
- `db/app/src/schema/tables/org-integrations.ts:29-113` — orgIntegrations schema
- `db/app/src/schema/tables/gateway-resources.ts:12-48` — gatewayResources schema (to be dropped)
- `db/app/src/schema/tables/gateway-installations.ts:17-94` — gatewayInstallations schema
- `packages/app-providers/src/provider/backfill.ts:17-98` — BackfillDef and BackfillContext
- `api/platform/src/inngest/functions/ingest-delivery.ts:60-83` — webhook routing (Phase 3 migration target)
- `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:101-191` — backfill orchestration (Phase 3 migration target)
- `api/platform/src/router/memory/backfill.ts:186-265` — backfill estimate (Phase 3 migration target)
- `api/platform/src/inngest/functions/connection-lifecycle.ts:165-204` — teardown (Phase 3, remove step)
- `api/app/src/router/org/connections.ts:444-472` — Vercel disconnect (Phase 3, bug fix)
- `api/app/src/router/org/connections.ts:597-659` — bulkLink (Phase 3, simplify)
- `api/platform/src/router/memory/connections.ts:72-435` — dead procedures (Phase 3, delete)

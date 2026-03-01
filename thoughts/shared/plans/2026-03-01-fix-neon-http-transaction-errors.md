# Fix neon-http Transaction Errors Implementation Plan

## Overview

The `drizzle-orm/neon-http` driver does not support `db.transaction()` — it throws `"No transactions support in neon-http driver"` at runtime. There are 7 call sites across the console codebase using `db.transaction()` with this driver. All will fail when triggered. The immediate error is on workspace creation (`createCustomWorkspace`), but all 7 must be fixed.

## Current State Analysis

**Driver**: `drizzle-orm@0.43.1` `neon-http` session (`session.js:141-142`) explicitly throws:
```js
async transaction(_transaction, _config = {}) {
    throw new Error("No transactions support in neon-http driver");
}
```

**Available alternative**: `db.batch()` — sends multiple queries in a single HTTP request using Neon's transaction protocol. Provides atomicity (all-or-nothing) but queries cannot reference each other's results within the batch.

**Affected files** (all use `@db/console/client` → neon-http driver):
1. `db/console/src/utils/workspace.ts:82` — check-then-insert
2. `api/console/src/router/user/user-api-keys.ts:217` — revoke + create
3. `api/console/src/router/org/org-api-keys.ts:356` — revoke + create
4. `api/console/src/router/m2m/sources.ts:152` — batch deactivation loop
5. `apps/console/src/lib/neural/temporal-state.ts:101` — close old + open new state
6. `apps/connections/src/workflows/connection-teardown.ts:115` — soft-delete two tables
7. `api/console/src/inngest/workflow/neural/observation-capture.ts:969` — insert observation + upsert entities

**Not affected** (uses MySQL/PlanetScale driver):
- `api/chat/src/router/chat/usage.ts` (6 call sites)
- `api/chat/src/router/chat/message.ts` (1 call site)

## Desired End State

All 7 transaction call sites are replaced with either:
- `db.batch([...])` for multi-write operations without inter-query dependencies
- Direct insert + conflict handling for check-then-insert patterns
- Sequential queries for operations with output dependencies

No `db.transaction()` calls remain against the neon-http driver. Workspace creation works without errors.

### Key Discoveries:
- `db.batch()` is available on `NeonHttpDatabase` (`driver.d.ts:25`) and sends queries atomically via HTTP
- The workspace `orgWorkspaces` table has a unique constraint `workspace_org_name_idx` on `(clerkOrgId, name)` — making the check-then-insert transaction unnecessary
- `observation-capture.ts` has a dependency: entity inserts reference `obs.id` (auto-generated BIGINT) — this cannot use `db.batch()` directly

## What We're NOT Doing

- **NOT** switching to `neon-serverless` websocket driver (would affect edge compatibility)
- **NOT** changing the database schema or adding migrations
- **NOT** modifying `api/chat` transaction patterns (those use a different MySQL driver)
- **NOT** adding a generic transaction utility — each fix is tailored to its use case

## Implementation Approach

Each transaction is replaced with the simplest correct alternative:
- **`db.batch()`** when all queries are independent writes (6 of 7 cases)
- **Sequential queries** when results from one query are needed in the next (1 case)
- **Insert + catch constraint violation** for the workspace check-then-insert pattern

---

## Phase 1: Fix Workspace Creation (Immediate Error)

### Overview
Fix the `createCustomWorkspace` function that's currently blocking workspace creation.

### Changes Required:

#### 1. Remove transaction from workspace creation
**File**: `db/console/src/utils/workspace.ts`
**Changes**: Replace transaction with direct insert + unique constraint error handling

The database already has a unique constraint (`workspace_org_name_idx`) on `(clerkOrgId, name)`. We can optimistically insert and catch the constraint violation, which is actually more robust than the check-then-insert pattern.

```typescript
export async function createCustomWorkspace(
  clerkOrgId: string,
  name: string,
): Promise<string> {
  const slug = generateRandomSlug();
  const { nanoid } = await import("@repo/lib");
  const workspaceId = nanoid();

  try {
    const [newWorkspace] = await db
      .insert(orgWorkspaces)
      .values({
        id: workspaceId,
        clerkOrgId,
        name,
        slug,
        settings: buildWorkspaceSettings(clerkOrgId, workspaceId),
      })
      .returning({ id: orgWorkspaces.id });

    if (!newWorkspace) {
      throw new Error("Failed to create workspace");
    }

    return newWorkspace.id;
  } catch (error) {
    // Database unique constraint (workspace_org_name_idx) catches duplicates
    if (
      error instanceof Error &&
      (error.message.includes("unique constraint") ||
        error.message.includes("duplicate key"))
    ) {
      throw new Error(`Workspace with name "${name}" already exists`);
    }
    throw error;
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Workspace creation works via the UI (navigate to new workspace page, enter name, create)
- [ ] Duplicate workspace name shows appropriate error message
- [ ] Created workspace appears in workspace list

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that workspace creation works before proceeding to Phase 2.

---

## Phase 2: Fix API Key Rotation (User + Org)

### Overview
Replace transactions in both user and org API key rotation with `db.batch()`. Both follow the same pattern: revoke old key + create new key.

### Changes Required:

#### 1. Fix user API key rotation
**File**: `api/console/src/router/user/user-api-keys.ts` (around line 217)
**Changes**: Replace `ctx.db.transaction()` with `ctx.db.batch()`

```typescript
// 3. Atomically swap keys using batch
const [, [created]] = await ctx.db.batch([
  // Revoke old key
  ctx.db
    .update(userApiKeys)
    .set({ isActive: false })
    .where(eq(userApiKeys.id, input.keyId)),
  // Create new key with same settings
  ctx.db
    .insert(userApiKeys)
    .values({
      userId: ctx.auth.userId,
      name: oldKey.name,
      keyHash: newKeyHash,
      keyPrefix: prefix,
      keySuffix: suffix,
      isActive: true,
      expiresAt: oldKey.expiresAt,
    })
    .returning({
      id: userApiKeys.id,
      name: userApiKeys.name,
      keyPrefix: userApiKeys.keyPrefix,
      keySuffix: userApiKeys.keySuffix,
      createdAt: userApiKeys.createdAt,
    }),
] as const);

const result = created;
```

#### 2. Fix org API key rotation
**File**: `api/console/src/router/org/org-api-keys.ts` (around line 356)
**Changes**: Replace `db.transaction()` with `db.batch()`

```typescript
// Batch: revoke old, create new (atomic)
const [, insertResult] = await db.batch([
  // Revoke old key
  db
    .update(orgApiKeys)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(orgApiKeys.id, existingKey.id)),
  // Create new key
  db
    .insert(orgApiKeys)
    .values({
      workspaceId: existingKey.workspaceId,
      clerkOrgId: existingKey.clerkOrgId,
      createdByUserId: ctx.auth.userId,
      name: existingKey.name,
      keyHash,
      keyPrefix: prefix,
      keySuffix: suffix,
      expiresAt: input.expiresAt?.toISOString(),
    })
    .returning({
      id: orgApiKeys.id,
      publicId: orgApiKeys.publicId,
    }),
] as const);

const [newKey] = insertResult;
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] User API key rotation works via UI
- [ ] Org API key rotation works via UI
- [ ] Old key is revoked after rotation
- [ ] New key is returned and usable

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that API key rotation works before proceeding.

---

## Phase 3: Fix Remaining Transaction Usages

### Overview
Fix the remaining 4 transaction usages: m2m sources batch update, temporal state transitions, connection teardown, and observation capture.

### Changes Required:

#### 1. Fix m2m sources batch deactivation
**File**: `api/console/src/router/m2m/sources.ts` (around line 152)
**Changes**: Replace transaction loop with `db.batch()`

```typescript
const now = new Date().toISOString();
const updates = await db.batch(
  sources.map((source) =>
    db
      .update(workspaceIntegrations)
      .set({
        isActive: false,
        updatedAt: now,
      })
      .where(eq(workspaceIntegrations.id, source.id))
  ) as [typeof sources[0] extends any ? ReturnType<typeof db.update> : never, ...any[]]
);
```

Note: `db.batch()` requires a tuple of at least 1 element. Since we already guard `sources.length === 0` above (line 147-149), this is safe. The type cast is needed because `db.batch()` expects a tuple, not an array.

#### 2. Fix temporal state transition
**File**: `apps/console/src/lib/neural/temporal-state.ts` (around line 101)
**Changes**: Replace transaction with `db.batch()` for the close + open pair. Since both writes are independent (update doesn't return a value used by insert), batch works.

```typescript
export async function recordStateChange(
  input: Omit<InsertWorkspaceTemporalState, "id" | "isCurrent" | "createdAt" | "validTo">
): Promise<WorkspaceTemporalState> {
  const [, [newState]] = await db.batch([
    // 1. Close the previous current state (if exists)
    db
      .update(workspaceTemporalStates)
      .set({
        isCurrent: false,
        validTo: input.validFrom,
      })
      .where(
        and(
          eq(workspaceTemporalStates.workspaceId, input.workspaceId),
          eq(workspaceTemporalStates.entityType, input.entityType),
          eq(workspaceTemporalStates.entityId, input.entityId),
          eq(workspaceTemporalStates.stateType, input.stateType),
          eq(workspaceTemporalStates.isCurrent, true)
        )
      ),
    // 2. Insert the new current state
    db
      .insert(workspaceTemporalStates)
      .values({
        ...input,
        isCurrent: true,
        validTo: null,
      })
      .returning(),
  ] as const);

  if (!newState) {
    throw new Error("Failed to insert new temporal state");
  }

  return newState;
}
```

#### 3. Fix connection teardown soft-delete
**File**: `apps/connections/src/workflows/connection-teardown.ts` (around line 115)
**Changes**: Replace transaction with `db.batch()`

```typescript
// Step 5: Soft-delete installation and resources in DB
await context.run("soft-delete", async () => {
  await db.batch([
    db
      .update(gwInstallations)
      .set({ status: "revoked", updatedAt: new Date().toISOString() })
      .where(eq(gwInstallations.id, installationId)),
    db
      .update(gwResources)
      .set({ status: "removed", updatedAt: new Date().toISOString() })
      .where(eq(gwResources.installationId, installationId)),
  ] as const);
});
```

#### 4. Fix observation + entity storage
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts` (around line 969)
**Changes**: Replace transaction with sequential insert (observation first) + batch (entities). The entity inserts depend on `obs.id` (auto-generated BIGINT), so they cannot be batched with the observation insert. Inngest step durability provides retry guarantees if entity inserts fail.

```typescript
return await (async () => {
  const observationType = deriveObservationType(sourceEvent);

  // 1. Insert observation first (need auto-generated BIGINT id)
  const [obs] = await db
    .insert(workspaceNeuralObservations)
    .values({
      externalId,
      workspaceId,
      occurredAt: sourceEvent.occurredAt,
      actor: sourceEvent.actor ?? null,
      observationType,
      title: sourceEvent.title,
      content: sourceEvent.body,
      topics,
      significanceScore: significance.score,
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      sourceId: sourceEvent.sourceId,
      sourceReferences: sourceEvent.references,
      metadata: sourceEvent.metadata,
      embeddingVectorId: embeddingResult.legacyVectorId,
      embeddingTitleId: embeddingResult.title.vectorId,
      embeddingContentId: embeddingResult.content.vectorId,
      embeddingSummaryId: embeddingResult.summary.vectorId,
      ingestionSource: event.data.ingestionSource ?? "webhook",
    })
    .returning();

  if (!obs) {
    throw new Error("Failed to insert observation");
  }

  // 2. Batch upsert entities (all use obs.id as foreign key)
  let entitiesStored = 0;
  if (extractedEntities.length > 0) {
    const entityQueries = extractedEntities.map((entity) =>
      db
        .insert(workspaceNeuralEntities)
        .values({
          workspaceId,
          category: entity.category,
          key: entity.key,
          value: entity.value,
          sourceObservationId: obs.id,
          evidenceSnippet: entity.evidence,
          confidence: entity.confidence,
        })
        .onConflictDoUpdate({
          target: [
            workspaceNeuralEntities.workspaceId,
            workspaceNeuralEntities.category,
            workspaceNeuralEntities.key,
          ],
          set: {
            lastSeenAt: new Date().toISOString(),
            occurrenceCount: sql`${workspaceNeuralEntities.occurrenceCount} + 1`,
            updatedAt: new Date().toISOString(),
          },
        })
    );

    await db.batch(entityQueries as [typeof entityQueries[0], ...typeof entityQueries]);
    entitiesStored = extractedEntities.length;
  }

  log.info("Observation and entities stored", {
    observationId: obs.id,
    externalId: obs.externalId,
    observationType,
    entitiesExtracted: extractedEntities.length,
    entitiesStored,
  });

  return { observation: obs, entitiesStored };
})();
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Source deactivation works when GitHub repos are removed (via webhook)
- [ ] Temporal state recording works (neural features)
- [ ] Connection teardown workflow completes (uninstall a connection)
- [ ] Observation capture pipeline works end-to-end (trigger a webhook event)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation of the critical paths.

---

## Testing Strategy

### Unit Tests:
- No new tests needed — the changes are behavioral replacements, not new features
- Existing tests should continue to pass (integration tests use PGlite which supports transactions)

### Integration Tests:
- Integration tests in `packages/integration-tests/` use PGlite (not neon-http), so they will continue to work
- The PGlite driver supports `.transaction()` natively, meaning integration tests won't catch this class of error
- Consider adding a lint rule or grep check to prevent future `db.transaction()` usage with neon-http

### Manual Testing Steps:
1. Create a new workspace with a custom name → should succeed
2. Try creating a workspace with a duplicate name → should show "already exists" error
3. Rotate a user API key → old key should be revoked, new key returned
4. Rotate an org API key → same behavior
5. Uninstall a GitHub connection → teardown workflow should complete

## Performance Considerations

- `db.batch()` sends all queries in a single HTTP request, which is actually more efficient than a transaction that would require multiple round-trips (if it were supported)
- The observation-capture change goes from 1 HTTP request (transaction) to 2 HTTP requests (insert + batch entities), but the entity batch is still a single request regardless of entity count
- No performance regression expected

## References

- Error source: `drizzle-orm@0.43.1` `neon-http/session.js:141-142`
- Drizzle neon-http batch API: `NeonHttpDatabase.batch()` at `neon-http/driver.d.ts:25`
- Database client: `db/console/src/client.ts:1-24`
- Unique constraint: `workspace_org_name_idx` on `orgWorkspaces(clerkOrgId, name)`

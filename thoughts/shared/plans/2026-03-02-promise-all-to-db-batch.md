# Replace Promise.all with db.batch in sources M2M router

## Overview

Three mutation handlers in `api/console/src/router/m2m/sources.ts` use `Promise.all` for bulk updates instead of the `db.batch` pattern already established in the same file. This plan converts them for consistency and atomicity (neon-http doesn't support transactions, so `db.batch` is the preferred alternative).

## Current State Analysis

**File**: `api/console/src/router/m2m/sources.ts`

**Reference pattern** (already correct — `markGithubRepoInactive`, lines 152-162):
```ts
const updateQueries = sources.map((source) =>
  db.update(workspaceIntegrations).set({ isActive: false, updatedAt: now })
    .where(eq(workspaceIntegrations.id, source.id))
);
const updates = await db.batch(updateQueries as [typeof updateQueries[0], ...typeof updateQueries]);
```

Key aspects of the reference pattern:
- Builds array of query objects (not promises)
- Uses non-empty tuple cast: `as [typeof updateQueries[0], ...typeof updateQueries]`
- Has early-return guard before reaching `db.batch` (line 147-149)

**Three handlers need conversion:**

| Handler | Lines | Complication |
|---------|-------|-------------|
| `markGithubInstallationInactive` | 219-232 | None — sources pre-filtered at line 204 |
| `markGithubDeleted` | 282-307 | Inline type guard returns `Promise.resolve(null)` |
| `updateGithubMetadata` | 361-394 | Inline type guard returns `Promise.resolve(null)` |

## Desired End State

All three handlers use the same `db.batch` pattern as `markGithubRepoInactive`. Each has an early-empty-array guard so `db.batch` is never called with an empty array.

## What We're NOT Doing

- Not changing any fields being set (isActive, updatedAt, sourceConfig, lastSync*, etc.)
- Not changing the activity recording logic
- Not changing the query/filter logic for finding sources
- Not touching `markGithubRepoInactive` (already correct)
- Not changing the return values

## Implementation Approach

Single phase, three changes in one file.

## Phase 1: Convert Promise.all to db.batch

### Changes Required:

#### 1. `markGithubInstallationInactive` (lines 217-232)

**Current** (lines 217-232):
```ts
// Update all matching sources
const now = new Date().toISOString();
const updates = await Promise.all(
  installationSources.map((source) =>
    db
      .update(workspaceIntegrations)
      .set({
        isActive: false,
        lastSyncedAt: now,
        lastSyncStatus: "failed",
        lastSyncError: "GitHub installation removed or suspended",
        updatedAt: now,
      })
      .where(eq(workspaceIntegrations.id, source.id))
  )
);
```

**Replace with:**
```ts
// Update all matching sources
const now = new Date().toISOString();
const updateQueries = installationSources.map((source) =>
  db
    .update(workspaceIntegrations)
    .set({
      isActive: false,
      lastSyncedAt: now,
      lastSyncStatus: "failed",
      lastSyncError: "GitHub installation removed or suspended",
      updatedAt: now,
    })
    .where(eq(workspaceIntegrations.id, source.id))
);
// Batch: deactivate all sources atomically (neon-http doesn't support transactions)
const updates = await db.batch(updateQueries as [typeof updateQueries[0], ...typeof updateQueries]);
```

No other changes needed — early guard already exists at line 210, return uses `updates.length` which works the same.

#### 2. `markGithubDeleted` (lines 280-307)

**Current** (lines 280-307):
```ts
// Update all matching sources
const now = new Date().toISOString();
const updates = await Promise.all(
  sources.map((source) => {
    if (source.sourceConfig.sourceType !== "github") {
      return Promise.resolve(null);
    }
    const updatedConfig = { ...source.sourceConfig, isArchived: true };
    return db
      .update(workspaceIntegrations)
      .set({
        isActive: false,
        sourceConfig: updatedConfig,
        lastSyncedAt: now,
        lastSyncStatus: "failed",
        lastSyncError: "Repository deleted on GitHub",
        updatedAt: now,
      })
      .where(eq(workspaceIntegrations.id, source.id));
  })
);
```

**Replace with** (pre-filter, then batch):
```ts
// Filter to GitHub sources and update
const now = new Date().toISOString();
const githubSources = sources.filter(
  (source) => source.sourceConfig.sourceType === "github"
);

if (githubSources.length === 0) {
  return { success: true, updated: 0 };
}

const updateQueries = githubSources.map((source) => {
  const updatedConfig = {
    ...source.sourceConfig,
    isArchived: true,
  };

  return db
    .update(workspaceIntegrations)
    .set({
      isActive: false,
      sourceConfig: updatedConfig,
      lastSyncedAt: now,
      lastSyncStatus: "failed",
      lastSyncError: "Repository deleted on GitHub",
      updatedAt: now,
    })
    .where(eq(workspaceIntegrations.id, source.id));
});
// Batch: mark deleted atomically (neon-http doesn't support transactions)
const updates = await db.batch(updateQueries as [typeof updateQueries[0], ...typeof updateQueries]);
```

Also update the return value (line 330):
```ts
// Before:
updated: updates.filter((u) => u !== null).length,
// After:
updated: updates.length,
```

#### 3. `updateGithubMetadata` (lines 359-394)

**Current** (lines 359-394):
```ts
// Update all matching sources
const now = new Date().toISOString();
const updates = await Promise.all(
  sources.map((source) => {
    if (source.sourceConfig.sourceType !== "github") {
      return Promise.resolve(null);
    }
    const updatedConfig = { ...source.sourceConfig, ...mergedFields };
    return db
      .update(workspaceIntegrations)
      .set({ sourceConfig: updatedConfig, updatedAt: now })
      .where(eq(workspaceIntegrations.id, source.id));
  })
);
```

**Replace with** (pre-filter, then batch):
```ts
// Filter to GitHub sources and update metadata
const now = new Date().toISOString();
const githubSources = sources.filter(
  (source) => source.sourceConfig.sourceType === "github"
);

if (githubSources.length === 0) {
  return { success: true, updated: 0 };
}

const updateQueries = githubSources.map((source) => {
  const updatedConfig = {
    ...source.sourceConfig,
    ...(input.metadata.repoFullName && {
      repoFullName: input.metadata.repoFullName,
      repoName: input.metadata.repoFullName.split("/")[1] ?? source.sourceConfig.repoName,
    }),
    ...(input.metadata.defaultBranch && {
      defaultBranch: input.metadata.defaultBranch,
    }),
    ...(input.metadata.isPrivate !== undefined && {
      isPrivate: input.metadata.isPrivate,
    }),
    ...(input.metadata.isArchived !== undefined && {
      isArchived: input.metadata.isArchived,
    }),
  };

  return db
    .update(workspaceIntegrations)
    .set({
      sourceConfig: updatedConfig,
      updatedAt: now,
    })
    .where(eq(workspaceIntegrations.id, source.id));
});
// Batch: update metadata atomically (neon-http doesn't support transactions)
const updates = await db.batch(updateQueries as [typeof updateQueries[0], ...typeof updateQueries]);
```

Also update the return value (line 417):
```ts
// Before:
updated: updates.filter((u) => u !== null).length,
// After:
updated: updates.length,
```

**Note on `updateGithubMetadata`**: The early-return for `githubSources.length === 0` returns `{ success: true, updated: 0 }` instead of throwing NOT_FOUND. The existing NOT_FOUND throw at line 353 already handles the case where *no sources at all* match the repo ID. The new guard only fires if sources exist but none are GitHub type — returning 0 updated is correct here.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Verify no `Promise.all` remains in the file for bulk update patterns
- [ ] Verify all three converted handlers have early-empty-array guards before `db.batch`
- [ ] Verify the tuple cast matches the reference pattern exactly

## References

- File: `api/console/src/router/m2m/sources.ts`
- Reference pattern: lines 152-162 (`markGithubRepoInactive`)

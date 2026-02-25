# User-Sources Deletion & Connections Migration Plan

**Status: COMPLETE** (Phase 3 skipped — see below)

## Overview

Delete the legacy `userSources` naming layer and `lightfast_user_sources` table, rename the tRPC router to `connections` under `orgRouter`. Originally also planned to split the monolithic `sourceConfig` JSONB column into `resourceMeta` + `syncConfig` + `backfillState`, but this was skipped after analysis.

This implements the remaining work from the gateway-console DB consolidation: Phases 6 (client-side refactor) and 7 (route & package cleanup) from `thoughts/shared/plans/2026-02-25-gateway-console-db-consolidation.md`.

## Completion Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Router rename `userSources` → `connections` | **COMPLETE** |
| Phase 2 | Drop legacy `user_sources` table + columns | **COMPLETE** |
| Phase 3 | `sourceConfig` split into `resourceMeta` + `syncConfig` + `backfillState` | **SKIPPED** |

**Phase 3 skip rationale**: With GitHub push sync removed (no more `branches`/`paths` in sync config), the sync portion is just `{ events: InternalEventType[], autoSync: boolean }` — two fields. Not worth 8+ write path changes and a data migration. If backfill state tracking is needed later, it can be added as a standalone column without splitting `sourceConfig`.

## Current State (post-migration)

All migration work has been completed on `feat/gateway-foundation`. The codebase is now in the desired end state for Phases 1 and 2.

### Architecture

```
orgRouter
  └── connections                    ← renamed from userSources, moved from userRouter
        ├── getAuthorizeUrl          ← proxies connections service
        ├── list                     ← queries gwInstallations
        ├── disconnect               ← queries gwInstallations
        ├── github.*                 ← queries gwInstallations
        └── vercel.*                 ← queries gwInstallations

workspaceIntegrations table:
  ├── installationId                 ← FK to gwInstallations (sole FK)
  ├── provider                       ← varchar, denormalized for fast filtering
  ├── sourceConfig (JSONB)           ← kept as-is (split was skipped)
  └── (userSourceId DROPPED)
  └── (gatewayInstallationId DROPPED)

lightfast_user_sources table: DELETED
user-sources.ts schema file: DELETED
```

### What Was Completed:
- `pnpm typecheck` passes with zero references to `userSources`
- All frontend tRPC calls use `trpc.connections.*` and `orgTrpc.connections.*`
- Legacy table and redundant columns dropped
- Seed script updated to no longer reference `userSources`

### What We Did NOT Do (and still haven't):
- **No page/route restructuring**: The `(user)/account/settings/sources/` page stays where it is despite conceptually being org-level. Route moves are a separate concern.
- **No connections service changes**: `apps/connections/` is unchanged. The tRPC router continues to proxy OAuth through the connections service.
- **No disconnect flow changes**: The `disconnect` procedure still updates `gwInstallations.status` directly rather than proxying through the connections service teardown endpoint. This is tracked as a separate item.
- **No Linear/Sentry UI**: Those providers exist in the connections service but have no frontend entrypoint yet.
- **No sourceConfig split**: Kept as-is (see Phase 3 skip rationale above).

---

## Phase 1: Rename `userSources` → `connections` — COMPLETE

### Overview
Renamed the tRPC router from `userSources` to `connections`, moved from `userRouter` to `orgRouter`, updated the client splitLink routing, and renamed all 14 frontend references. All server prefetches switched from `userTrpc` to `orgTrpc`. Empty stub routers (`org/integration.ts`, `org/sources.ts`) deleted.

### Changes Made:

#### 1.1 Move and rename the router file
**File**: `api/console/src/router/user/user-sources.ts` → `api/console/src/router/org/connections.ts`
**Changes**:
- Rename the file (move from `user/` to `org/`)
- Rename the export from `userSourcesRouter` to `connectionsRouter`
- Update console.error log strings from `"[tRPC userSources..."` to `"[tRPC connections..."`
- Update JSDoc comment at top of file

#### 1.2 Update root router assembly
**File**: `api/console/src/root.ts`
**Changes**:
- Remove `import { userSourcesRouter } from "./router/user/user-sources"` (line 18)
- Add `import { connectionsRouter } from "./router/org/connections"`
- Remove `userSources: userSourcesRouter` from `userRouter` (line 52)
- Add `connections: connectionsRouter` to `orgRouter`
- Remove `integration: integrationRouter` from `orgRouter` (empty stub, line 81)
- Remove `sources: sourcesRouter` from `orgRouter` (empty stub, line 84)
- Remove the imports for `integrationRouter` and `sourcesRouter`
- Update JSDoc comment at line 45

#### 1.3 Delete empty stub routers
**Delete**: `api/console/src/router/org/integration.ts`
**Delete**: `api/console/src/router/org/sources.ts`

#### 1.4 Update tRPC splitLink routing
**File**: `packages/console-trpc/src/react.tsx`
**Changes**: Remove `path.startsWith("userSources.")` from the splitLink condition (line 78). Since `connections` is now on `orgRouter`, it naturally routes through `/api/trpc/org` (the `false` branch).

```typescript
// Before (line 74-80):
return (
  path.startsWith("organization.") ||
  path.startsWith("account.") ||
  path.startsWith("workspaceAccess.") ||
  path.startsWith("userSources.") ||
  path.startsWith("userApiKeys.")
);

// After:
return (
  path.startsWith("organization.") ||
  path.startsWith("account.") ||
  path.startsWith("workspaceAccess.") ||
  path.startsWith("userApiKeys.")
);
```

#### 1.5 Update server prefetch pages (3 files)

These pages change from `userTrpc` to `orgTrpc`:

**File**: `apps/console/src/app/(app)/(user)/account/settings/sources/page.tsx`
- Line 30: `prefetch(userTrpc.userSources.list.queryOptions())` → `prefetch(orgTrpc.connections.list.queryOptions())`
- Update import: add `orgTrpc`, remove `userTrpc` if no longer needed

**File**: `apps/console/src/app/(app)/(user)/new/page.tsx`
- Line 58: `prefetch(userTrpc.userSources.github.get.queryOptions())` → `prefetch(orgTrpc.connections.github.get.queryOptions())`
- Update import: add `orgTrpc`, remove `userTrpc` if no longer needed

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/page.tsx`
- Lines 27-28: Change both prefetch calls from `userTrpc.userSources.*` → `orgTrpc.connections.*`
- Update import: add `orgTrpc`, remove `userTrpc` if no longer needed

#### 1.6 Update frontend client components (11 files)

All `trpc.userSources.*` calls become `trpc.connections.*`:

**File**: `apps/console/src/app/(app)/(user)/account/settings/sources/_components/sources-list.tsx`
- Line 47: `trpc.userSources.list.queryOptions()` → `trpc.connections.list.queryOptions()`
- Line 54: `trpc.userSources.disconnect.mutationOptions(...)` → `trpc.connections.disconnect.mutationOptions(...)`
- Line 58: `trpc.userSources.list.queryOptions().queryKey` → `trpc.connections.list.queryOptions().queryKey`
- Line 81: `trpc.userSources.getAuthorizeUrl.queryOptions(...)` → `trpc.connections.getAuthorizeUrl.queryOptions(...)`
- Line 102: `trpc.userSources.list.queryOptions().queryKey` → `trpc.connections.list.queryOptions().queryKey`

**File**: `apps/console/src/components/github-connect-dialog.tsx`
- Line 47: `trpc.userSources.getAuthorizeUrl.queryOptions(...)` → `trpc.connections.getAuthorizeUrl.queryOptions(...)`

**File**: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
- Line 33: `trpc.userSources.github.get.queryOptions()` → `trpc.connections.github.get.queryOptions()`
- Line 98: `trpc.userSources.getAuthorizeUrl.queryOptions(...)` → `trpc.connections.getAuthorizeUrl.queryOptions(...)`

**File**: `apps/console/src/app/(app)/(user)/new/_components/repository-picker.tsx`
- Line 43: `trpc.userSources.github.repositories.queryOptions(...)` → `trpc.connections.github.repositories.queryOptions(...)`
- Rename prop `userSourceId` → `installationId` (line 25, 29, 44, 47)

**File**: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
- Rename state and context: `userSourceId` → `installationId`, `setUserSourceId` → `setInstallationId` (lines 45, 46, 76, 98, 99)

**File**: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx` (same file as above)
- Rename destructured values: `userSourceId` → `installationId`, `setUserSourceId` → `setInstallationId` (lines 22, 23, 44-48)
- Line 150: `userSourceId={userSourceId}` → `installationId={installationId}` (prop to RepositoryPicker)

**File**: `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`
- Line 46: rename destructured `userSourceId` → `installationId`
- Line 170: update guard condition
- Line 174: `gwInstallationId: userSourceId` → `gwInstallationId: installationId`

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/_components/connect-form-provider.tsx`
- Lines 55, 60: `trpc.userSources.github.get.queryOptions()` → `trpc.connections.github.get.queryOptions()`
- Lines 55, 60: `trpc.userSources.vercel.get.queryOptions()` → `trpc.connections.vercel.get.queryOptions()`
- Line 20: rename `userSourceId` → `installationId` in context type
- Line 64-68: rename local variable
- Line 87: rename in context value

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/_components/connect-button.tsx`
- Line 19: rename destructured `userSourceId` → `installationId`
- Lines 58, 61, 68, 71: update references

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/_components/github-connector.tsx`
- Line 37: `trpc.userSources.github.get.queryOptions()` → `trpc.connections.github.get.queryOptions()`
- Line 52: `trpc.userSources.getAuthorizeUrl.queryOptions(...)` → `trpc.connections.getAuthorizeUrl.queryOptions(...)`
- Line 180: `userSourceId={...}` → `installationId={...}` (prop to GitHubRepoSelector)

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/_components/vercel-connector.tsx`
- Line 29: `trpc.userSources.vercel.get.queryOptions()` → `trpc.connections.vercel.get.queryOptions()`
- Line 44: `trpc.userSources.getAuthorizeUrl.queryOptions(...)` → `trpc.connections.getAuthorizeUrl.queryOptions(...)`

#### 1.7 Update shared component props (2 files)

**File**: `apps/console/src/components/integrations/github-repo-selector.tsx`
- Line 24: rename prop `userSourceId: string` → `installationId: string`
- Line 37: rename destructured value
- Line 55: `trpc.userSources.github.repositories.queryOptions(...)` → `trpc.connections.github.repositories.queryOptions(...)`
- Line 56: `integrationId: userSourceId` → `integrationId: installationId`

**File**: `apps/console/src/components/integrations/vercel-project-selector.tsx`
- Line 49: `trpc.userSources.vercel.listProjects.queryOptions(...)` → `trpc.connections.vercel.listProjects.queryOptions(...)`

#### 1.8 Update type extraction

**File**: `apps/console/src/types/index.ts`
- Line 74: `RouterOutputs["userSources"]["github"]["get"]` → `RouterOutputs["connections"]["github"]["get"]`

#### 1.9 Clean up comments

**File**: `api/console/src/router/user/workspace.ts:99`
- Remove `// gwInstallations.id (was userSourceId)` comment

**File**: `api/console/src/router/org/workspace.ts:908, 1111, 1266`
- Remove `// gwInstallations.id (was userSourceId)` comments

**File**: `api/console/src/router/org/connections.ts:631` (the renamed file)
- Remove `// gwInstallations.id (was userSourceId)` comment

### Success Criteria: ALL MET

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:console`
- [x] Zero grep results for `userSources` in `apps/console/src/` and `api/console/src/router/`
- [x] Zero grep results for `userSourceId` in `apps/console/src/` (except DB schema references)
- [x] File `api/console/src/router/user/user-sources.ts` does not exist
- [x] Files `api/console/src/router/org/integration.ts` and `api/console/src/router/org/sources.ts` do not exist

---

## Phase 2: Drop Legacy `user_sources` Table — COMPLETE

### Overview
Removed the `lightfast_user_sources` table, dropped the `userSourceId` and `gatewayInstallationId` columns from `workspaceIntegrations`, cleaned up all schema references, and updated the seed script.

### Changes Made:

#### 2.1 Delete the user-sources schema file
**Delete**: `db/console/src/schema/tables/user-sources.ts`

#### 2.2 Remove columns from workspace-integrations schema
**File**: `db/console/src/schema/tables/workspace-integrations.ts`
**Changes**:
- Remove `import { userSources } from "./user-sources"` (line 5)
- Remove `userSourceId` column definition (lines 36-38)
- Remove `gatewayInstallationId` column definition (line 139)
- Remove `userSourceIdIdx` from indexes (line 159)
- Update JSDoc comments to remove references to `userSource`

#### 2.3 Remove from relations
**File**: `db/console/src/schema/relations.ts`
**Changes**:
- Remove `import { userSources } from "./tables/user-sources"` (line 7)
- Remove the `userSource: one(userSources, ...)` relation entry (lines 91-94)

#### 2.4 Remove from barrel exports
**File**: `db/console/src/schema/tables/index.ts`
- Remove line 9: `export { userSources, type UserSource, ... } from "./user-sources"`

**File**: `db/console/src/schema/index.ts`
- Remove `userSources, type UserSource, type InsertUserSource, type GitHubUserSource, type VercelUserSource` from re-exports (line 10)

**File**: `db/console/src/index.ts`
- Remove `userSources, type UserSource, type InsertUserSource, type GitHubUserSource, type VercelUserSource` from re-exports (line 10)

#### 2.5 Update seed script
**File**: `packages/console-test-data/src/cli/seed-integrations.ts`
**Changes**:
- Remove `import { userSources, ... } from "@db/console/schema"` (line 13)
- Remove the `userSources` SELECT/INSERT block (lines 148-168)
- Remove `userSourceId` from `workspaceIntegrations` insert (line 190)
- Remove `eq(workspaceIntegrations.userSourceId, userSourceId)` filter (line 178)
- Instead, use `installationId` from `gwInstallations` for the workspace integration insert

#### 2.6 Update validation package comment
**File**: `packages/console-validation/src/schemas/sources.ts`
- Line 15: remove `* - user_sources table (OAuth connections)` from JSDoc comment

#### 2.7 Generate migration
```bash
cd db/console && pnpm db:generate
```

The generated migration will:
- DROP FK constraint `lightfast_workspace_integrations_user_source_id_lightfast_user_sources_id_fk`
- DROP INDEX `workspace_source_user_source_id_idx`
- ALTER TABLE `lightfast_workspace_integrations` DROP COLUMN `user_source_id`
- ALTER TABLE `lightfast_workspace_integrations` DROP COLUMN `gateway_installation_id`
- DROP TABLE `lightfast_user_sources` (with all its indexes)

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate` (no errors)
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] Zero grep results for `userSources` in `db/console/src/schema/` (the Drizzle table)
- [ ] Zero grep results for `userSourceId` in `db/console/src/schema/`
- [ ] Zero grep results for `gatewayInstallationId` in `db/console/src/schema/tables/workspace-integrations.ts`
- [ ] File `db/console/src/schema/tables/user-sources.ts` does not exist

#### Manual Verification:
- [ ] Migration applies cleanly to dev database: `cd db/console && pnpm db:migrate`
- [ ] DB Studio shows `lightfast_user_sources` table no longer exists
- [ ] DB Studio shows `user_source_id` and `gateway_installation_id` columns removed from `lightfast_workspace_integrations`
- [ ] Existing `workspaceIntegrations` rows with `installationId` are preserved
- [ ] Connect and disconnect flows still work (end-to-end)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3a: sourceConfig Split — Add New Columns + Dual-Write

### Overview
Add `resourceMeta`, `syncConfig`, and `backfillState` as new nullable JSONB columns alongside the existing `sourceConfig`. Update all write paths to dual-write both `sourceConfig` (for backward compatibility) and the new columns. Run a data migration script to populate new columns for existing rows.

### New Column Types:

```typescript
// resourceMeta — What the resource IS
type ResourceMeta =
  | {
      sourceType: "github";
      type: "repository";
      installationId: string;        // GitHub App installation ID
      repoId: string;
      repoName: string;
      repoFullName: string;
      defaultBranch: string;
      isPrivate: boolean;
      isArchived: boolean;
      status?: {
        configStatus?: "configured" | "awaiting_config";
        configPath?: string;
        lastConfigCheck?: string;
      };
    }
  | {
      sourceType: "vercel";
      type: "project";
      projectId: string;
      projectName: string;
      teamId?: string;
      teamSlug?: string;
      configurationId: string;
    };

// syncConfig — HOW it should be synced
type SyncConfig = {
  branches?: string[];
  paths?: string[];
  events?: string[];
  autoSync: boolean;
};

// backfillState — Backfill progress tracking (new, for future use)
type BackfillState = {
  status?: "idle" | "running" | "completed" | "failed";
  cursor?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
} | null;
```

### Changes Required:

#### 3a.1 Add new columns to schema (nullable for now)
**File**: `db/console/src/schema/tables/workspace-integrations.ts`
**Changes**: Add three new columns after `sourceConfig`:

```typescript
// Resource identity — what the provider resource IS
resourceMeta: jsonb("resource_meta").$type<ResourceMeta>(),

// Sync preferences — HOW to sync this resource
syncConfig: jsonb("sync_config").$type<SyncConfig>(),

// Backfill progress tracking (new)
backfillState: jsonb("backfill_state").$type<BackfillState>(),
```

Also make `provider` NOT NULL (currently nullable):
```typescript
provider: varchar("provider", { length: 50 }).notNull(),
```

#### 3a.2 Generate migration for new columns
```bash
cd db/console && pnpm db:generate
```

This generates a migration that ADDs the three new columns and ALTERs `provider` to NOT NULL.

#### 3a.3 Apply migration
```bash
cd db/console && pnpm db:migrate
```

#### 3a.4 Update all write paths to dual-write

Every location that writes `sourceConfig` must also write `resourceMeta` + `syncConfig`. Extract helper functions to avoid duplication.

**New helper file**: `api/console/src/lib/source-config.ts`

```typescript
import type { WorkspaceIntegration } from "@db/console";

type SourceConfig = NonNullable<WorkspaceIntegration["sourceConfig"]>;

/**
 * Extract resourceMeta from a sourceConfig blob.
 * Used during dual-write migration.
 */
export function extractResourceMeta(config: SourceConfig) {
  const { sync: _sync, version: _version, ...resourceMeta } = config as Record<string, unknown>;
  return resourceMeta;
}

/**
 * Extract syncConfig from a sourceConfig blob.
 * Used during dual-write migration.
 */
export function extractSyncConfig(config: SourceConfig) {
  return (config as Record<string, unknown>).sync as {
    branches?: string[];
    paths?: string[];
    events?: string[];
    autoSync: boolean;
  };
}
```

**Files to update** (all write paths — 8 locations):

| File | Lines | Operation | Change |
|---|---|---|---|
| `api/console/src/router/user/workspace.ts` | 220-232 | UPDATE sync | Add `syncConfig` + `resourceMeta` to `.set()` |
| `api/console/src/router/user/workspace.ts` | 238-259 | INSERT | Add `resourceMeta`, `syncConfig` alongside `sourceConfig` |
| `api/console/src/router/org/workspace.ts` | 975-1006 | INSERT Vercel | Add `resourceMeta`, `syncConfig` alongside `sourceConfig` |
| `api/console/src/router/org/workspace.ts` | 1078-1096 | UPDATE events | Add `syncConfig` to `.set()` |
| `api/console/src/router/org/workspace.ts` | 1215-1243 | Bulk INSERT GitHub | Add `resourceMeta`, `syncConfig` alongside `sourceConfig` |
| `api/console/src/router/org/workspace.ts` | 1356-1389 | Bulk INSERT Vercel | Add `resourceMeta`, `syncConfig` alongside `sourceConfig` |
| `api/console/src/router/m2m/sources.ts` | 279-299 | UPDATE mark deleted | Add `resourceMeta` to `.set()` |
| `api/console/src/router/m2m/sources.ts` | 358-386 | UPDATE metadata | Add `resourceMeta` to `.set()` |

For each INSERT, extract `resourceMeta` and `syncConfig` from the `sourceConfig` object being written. Example for bulk GitHub link:

```typescript
// Before:
sourceConfig: { version: 1, sourceType: "github", ..., sync: { ... } },

// After (dual-write):
sourceConfig: { version: 1, sourceType: "github", ..., sync: { ... } },
resourceMeta: { sourceType: "github", type: "repository", installationId: ..., repoId: ..., ... },
syncConfig: { branches: ["main"], paths: ["**/*"], events: [...], autoSync: true },
provider: "github",
```

#### 3a.5 Data migration script for existing rows
**New file**: `packages/console-test-data/src/cli/backfill-source-config-split.ts`

A one-time script that reads all `workspaceIntegrations` rows and populates `resourceMeta` + `syncConfig` from `sourceConfig`:

```typescript
// For each row:
const { sync, version, ...resourceMeta } = row.sourceConfig;
await db.update(workspaceIntegrations)
  .set({
    resourceMeta,
    syncConfig: sync,
    provider: row.sourceConfig.sourceType,
  })
  .where(eq(workspaceIntegrations.id, row.id));
```

Run with: `cd packages/console-test-data && pnpm with-env tsx src/cli/backfill-source-config-split.ts`

#### 3a.6 Update seed script
**File**: `packages/console-test-data/src/cli/seed-integrations.ts`
**Changes**: Add `resourceMeta`, `syncConfig`, and `provider` to all seed inserts alongside existing `sourceConfig`.

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate` (no pending changes)
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [ ] Data migration script runs successfully — all rows have `resourceMeta` and `syncConfig` populated
- [ ] DB Studio shows new columns populated for all existing rows
- [ ] Connect flow creates new rows with both old and new columns populated
- [ ] Webhook updates (metadata, mark deleted) write to both old and new columns

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3b: sourceConfig Split — Cut Over and Drop

### Overview
Update all read paths to use `resourceMeta` + `syncConfig` instead of `sourceConfig`. Make new columns NOT NULL. Drop the old `sourceConfig` column. Remove dual-write code.

### Changes Required:

#### 3b.1 Update all read paths (9 locations)

| File | Lines | Current Read | New Read |
|---|---|---|---|
| `api/console/src/router/user/workspace.ts` | 208-213 | `sourceConfig.sourceType`, `sourceConfig.repoId` | `resourceMeta.sourceType`, `resourceMeta.repoId` |
| `api/console/src/router/user/workspace.ts` | 220-221 | `sourceConfig.sourceType` | `resourceMeta.sourceType` |
| `api/console/src/router/org/workspace.ts` | 578 | SELECT `sourceConfig` | SELECT `resourceMeta`, `syncConfig` |
| `api/console/src/router/org/workspace.ts` | 603-616 | `sourceConfig.sourceType`, `sourceConfig.repoFullName`, full as `metadata` | `resourceMeta.sourceType`, `resourceMeta.repoFullName`, `resourceMeta` as `metadata` |
| `api/console/src/router/org/workspace.ts` | 1078 | `integration.sourceConfig` | `integration.syncConfig` (for events update) |
| `api/console/src/router/m2m/sources.ts` | 83, 121 | `sourceConfig.sourceType` | `resourceMeta.sourceType` (or use top-level `provider`) |
| `api/console/src/router/m2m/sources.ts` | 200-201 | `sourceConfig.sourceType`, `sourceConfig.installationId` | `resourceMeta.sourceType`, `resourceMeta.installationId` (or use top-level `provider` + `installationId` FK) |
| `api/console/src/router/m2m/sources.ts` | 279, 305, 358, 392 | `sourceConfig.sourceType` | `provider` column (top-level, now NOT NULL) |
| `api/console/src/inngest/workflow/neural/observation-capture.ts` | 573-582 | `sourceConfig` cast to `{ sync?: { events?: string[] } }` | `syncConfig.events` directly |

#### 3b.2 Update all write paths — remove `sourceConfig`, keep only new columns

Remove `sourceConfig` from all `.set()` and `.values()` calls. The 8 write locations from Phase 3a now write ONLY `resourceMeta` + `syncConfig`.

For UPDATE operations (events update, mark deleted, metadata update):
- `integrations.updateEvents`: `.set({ syncConfig: { ...existing.syncConfig, events: input.events } })`
- `markGithubDeleted`: `.set({ resourceMeta: { ...existing.resourceMeta, isArchived: true } })`
- `updateGithubMetadata`: `.set({ resourceMeta: { ...existing.resourceMeta, ...updatedFields } })`

For INSERT operations:
- Remove `sourceConfig` field entirely from all `.values({})`

#### 3b.3 Remove dual-write helpers
**Delete**: `api/console/src/lib/source-config.ts` (the extraction helpers are no longer needed)

#### 3b.4 Update schema — make columns NOT NULL, drop sourceConfig
**File**: `db/console/src/schema/tables/workspace-integrations.ts`
**Changes**:
- Remove `sourceConfig` column definition (lines 88-126)
- Remove the JSDoc comment block above it (lines 50-87)
- Change `resourceMeta` from nullable to `.notNull()`
- Change `syncConfig` from nullable to `.notNull()`
- Keep `backfillState` as nullable (no data yet)

#### 3b.5 Update the response shape in `sources.list`
**File**: `api/console/src/router/org/workspace.ts`
**Changes** at line 603-616: The `metadata` and `resource.resourceData` fields currently expose the raw `sourceConfig`. Update to expose `resourceMeta`:

```typescript
// Before:
metadata: s.sourceConfig,
resource: { id: s.id, resourceData: s.sourceConfig },

// After:
metadata: s.resourceMeta,
resource: { id: s.id, resourceData: s.resourceMeta },
```

Check if any frontend component consumes `metadata.sync.*` — if so, also include `syncConfig` in the response.

#### 3b.6 Update observation-capture event filtering
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes** at line 573-582:

```typescript
// Before:
const configWithSync = integration.sourceConfig as { sync?: { events?: string[] } } | null;

// After:
const syncConfig = integration.syncConfig;
```

The `isEventAllowed` call then uses `syncConfig?.events` instead of `configWithSync?.sync?.events`.

#### 3b.7 Generate migration
```bash
cd db/console && pnpm db:generate
```

This generates a migration that:
- ALTERs `resource_meta` to NOT NULL
- ALTERs `sync_config` to NOT NULL
- DROPs `source_config` column

#### 3b.8 Update seed script — remove sourceConfig from inserts
**File**: `packages/console-test-data/src/cli/seed-integrations.ts`
**Changes**: Remove `sourceConfig` from all seed data inserts (it was kept during dual-write; now removed).

#### 3b.9 Delete the backfill script
**Delete**: `packages/console-test-data/src/cli/backfill-source-config-split.ts` (one-time script, no longer needed)

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate` (no pending changes)
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] Zero grep results for `sourceConfig` in application code (`api/console/src/`, `apps/console/src/`, `apps/backfill/src/`)
- [ ] Zero grep results for `sourceConfig` in `db/console/src/schema/tables/workspace-integrations.ts`

#### Manual Verification:
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [ ] DB Studio shows `source_config` column removed from `lightfast_workspace_integrations`
- [ ] DB Studio shows `resource_meta` and `sync_config` columns are NOT NULL
- [ ] Connect flow creates new rows with correct `resourceMeta` + `syncConfig`
- [ ] Sources list page shows correct display names and metadata
- [ ] Update events flow (change event subscriptions) works correctly
- [ ] Webhook metadata updates (repo rename, default branch change) persist correctly
- [ ] Observation capture correctly filters events based on `syncConfig.events`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:
- Verify `extractResourceMeta` and `extractSyncConfig` helpers produce correct output for both GitHub and Vercel shapes
- Verify the data migration script handles edge cases (null sourceConfig, unknown sourceType)

### Integration Tests:
- tRPC procedure tests: `connections.list`, `connections.github.get`, `connections.getAuthorizeUrl`
- Write path tests: bulk link GitHub, link Vercel, update events, mark deleted, update metadata
- Read path tests: sources list, observation capture event filtering

### Manual Testing Steps:
1. Full OAuth connect flow for GitHub (popup → callback → connection appears)
2. Full OAuth connect flow for Vercel
3. Link repositories to workspace via connect page
4. Link Vercel projects to workspace
5. Update event subscriptions on a connected source
6. Disconnect a source from settings page
7. Verify workspace dashboard shows correct source count
8. Trigger a webhook event and verify observation capture filters correctly

## Performance Considerations

- The `provider` column is now NOT NULL and can be used for fast filtering instead of parsing `resourceMeta.sourceType`. The `m2m/sources.ts` type guards should use the top-level `provider` column where possible.
- The `resourceMeta.installationId` in-memory filter at `m2m/sources.ts:200-201` should eventually be replaced by a join on the top-level `installationId` FK column, avoiding full-table scan.

## Migration Notes

- **Phase 2 migration** drops the `lightfast_user_sources` table. Any existing data in this table will be lost. No active code reads from it, but verify no manual queries depend on it.
- **Phase 3a migration** adds nullable columns. Safe to apply without downtime.
- **Phase 3b migration** drops `source_config` and sets NOT NULL. Must run AFTER the data migration script from Phase 3a populates all rows. If any rows have NULL `resource_meta` or `sync_config` after the backfill, the NOT NULL alter will fail.
- All migrations are forward-only. Rollback requires restoring from backup.

## References

- Research audit: `thoughts/shared/research/2026-02-25-user-sources-connections-migration-audit.md`
- Consolidation plan: `thoughts/shared/plans/2026-02-25-gateway-console-db-consolidation.md`
- OAuth architecture decision: `thoughts/shared/research/2026-02-10-oauth-architecture-decision-user-vs-workspace-owned.md`
- Console DB architecture: `thoughts/shared/research/2026-02-25-console-db-architecture-gateway-integration.md`

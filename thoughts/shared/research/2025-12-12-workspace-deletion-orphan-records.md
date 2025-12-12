---
date: 2025-12-12T21:45:00+08:00
researcher: Claude
git_commit: 474e7bd3eb28682238c2f046dda1c1a28ba18b2e
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Workspace Deletion and User Activities / Workflow Runs Orphan Behavior"
tags: [research, codebase, workspace, deletion, foreign-keys, cascade-delete, schema]
status: complete
last_updated: 2025-12-12
last_updated_by: Claude
last_updated_note: "Added backend schema recommendation for soft delete + FK constraints"
---

# Research: Workspace Deletion and User Activities / Workflow Runs Orphan Behavior

**Date**: 2025-12-12T21:45:00+08:00
**Researcher**: Claude
**Git Commit**: 474e7bd3eb28682238c2f046dda1c1a28ba18b2e
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question
When deleting a workspace, user activities workflow runs don't get deleted. Is that the desired behavior?

## Summary

**Short Answer**: There is currently NO workspace deletion functionality implemented. However, if it were implemented, user activities and workflow runs would NOT be automatically deleted because these tables lack foreign key constraints with cascade delete.

This appears to be an **inconsistency in the schema design**:
- **6 tables** have proper `ON DELETE CASCADE` foreign keys to workspaces
- **3 tables** (workflow_runs, user_activities, operations_metrics) have **no foreign key constraints** - only indexes

## Detailed Findings

### Current State: No Workspace Deletion Feature

There is no workspace deletion functionality anywhere in the codebase:
- **No tRPC mutation** in `api/console/src/router/org/workspace.ts`
- **No UI component** in workspace settings
- **No Inngest workflow** for workspace cleanup
- **No validation schema** for workspace deletion

The workspace router (`workspace.ts:1384 lines`) only supports:
- `listByClerkOrgSlug`, `getByName`, `create`, `updateName`
- Integration management: `disconnect`, `linkVercelProject`, `bulkLinkGitHubRepositories`

### Schema: Foreign Key Inconsistency

#### Tables WITH CASCADE DELETE (6 tables)

| Table | Schema Location | FK Line |
|-------|-----------------|---------|
| `workspace_integrations` | `workspace-integrations.ts:33` | `onDelete: "cascade"` |
| `workspace_knowledge_documents` | `workspace-knowledge-documents.ts:34` | `onDelete: "cascade"` |
| `workspace_knowledge_vector_chunks` | `workspace-knowledge-vector-chunks.ts:29` | `onDelete: "cascade"` |
| `workspace_neural_observations` | `workspace-neural-observations.ts:62` | `onDelete: "cascade"` |
| `workspace_observation_clusters` | `workspace-observation-clusters.ts:33` | `onDelete: "cascade"` |
| `workspace_webhook_payloads` | `workspace-webhook-payloads.ts:38` | `onDelete: "cascade"` |

#### Tables WITHOUT CASCADE DELETE (3 tables)

| Table | Schema Location | Issue |
|-------|-----------------|-------|
| `workspace_workflow_runs` | `workspace-workflow-runs.ts:37` | No `.references()` call |
| `workspace_user_activities` | `workspace-user-activities.ts:48` | No `.references()` call |
| `workspace_operations_metrics` | `workspace-operations-metrics.ts:58` | No `.references()` call |

These three tables have:
- `workspaceId varchar(191) NOT NULL` column
- Indexes for query performance (e.g., `job_workspace_id_idx`)
- NO database-level foreign key constraint

### Drizzle Relations (TypeScript Only)

The `relations.ts` file defines TypeScript-only relationships:

```typescript
// db/console/src/schema/relations.ts:45-54
export const workspaceUserActivitiesRelations = relations(workspaceUserActivities, ({ one }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceUserActivities.workspaceId],
    references: [orgWorkspaces.id],
  }),
}));
```

This provides TypeScript type safety but **does not enforce referential integrity at the database level**.

### Historical Context: Store Table Removal

Migration `0005_daily_ikaris.sql` removed the `lightfast_workspace_stores` table:
- Documents and vector chunks got new `workspace_id` FKs with CASCADE
- `workflow_runs` had its `store_id` column dropped (line 70) but **no `workspace_id` FK was added**
- This appears to be when the inconsistency was introduced

### Impact If Workspace Deletion Were Implemented

If a workspace were deleted via `DELETE FROM lightfast_org_workspaces WHERE id = ?`:

**Auto-deleted (CASCADE)**:
- workspace_integrations
- workspace_knowledge_documents
- workspace_knowledge_vector_chunks
- workspace_neural_observations
- workspace_observation_clusters
- workspace_webhook_payloads

**NOT deleted (ORPHANED)**:
- workspace_workflow_runs
- workspace_user_activities
- workspace_operations_metrics

## Code References

### Schema Files
- `db/console/src/schema/tables/workspace-workflow-runs.ts:37` - No FK constraint
- `db/console/src/schema/tables/workspace-user-activities.ts:48` - No FK constraint
- `db/console/src/schema/tables/workspace-operations-metrics.ts:58` - No FK constraint
- `db/console/src/schema/relations.ts:45-54` - TypeScript-only relations

### Router Files
- `api/console/src/router/org/workspace.ts` - No delete mutation
- `api/console/src/router/org/jobs.ts` - Jobs/workflow runs management
- `api/console/src/router/org/activities.ts` - Activities queries

### Migrations
- `db/console/src/migrations/0000_thick_blizzard.sql:100-119` - workflow_runs created without FK
- `db/console/src/migrations/0000_thick_blizzard.sql:134-152` - activities created without FK
- `db/console/src/migrations/0005_daily_ikaris.sql:70` - store_id removed, no workspace FK added

## Architecture Documentation

### Current Relationship Model

```
orgWorkspaces (id)
    │
    ├── [FK CASCADE] workspace_integrations
    ├── [FK CASCADE] workspace_knowledge_documents
    │       └── [FK CASCADE] workspace_knowledge_vector_chunks
    ├── [FK CASCADE] workspace_neural_observations
    ├── [FK CASCADE] workspace_observation_clusters
    ├── [FK CASCADE] workspace_webhook_payloads
    │
    ├── [INDEX ONLY] workspace_workflow_runs ❌
    ├── [INDEX ONLY] workspace_user_activities ❌
    └── [INDEX ONLY] workspace_operations_metrics ❌
```

### Why These Tables May Have Been Left Without FKs

Possible intentional reasons:
1. **Audit trail preservation**: Activities might be intentionally kept for compliance
2. **Performance**: High-volume tables may avoid FK overhead
3. **Historical records**: Workflow runs may be needed for billing/reporting even after workspace deletion

Possible unintentional:
1. **Migration oversight** during store table removal
2. **Schema evolution** without updating FK constraints

## Recommendation: Backend Schema Changes

The inconsistency should be fixed at the schema level. This section outlines the backend-only changes needed.

### Decision: Soft Delete + Consistent FK Constraints

**Approach**: Add `deletedAt` column for soft delete support, and add missing FK constraints to ensure schema consistency.

### Step 1: Add `deletedAt` to Workspaces

Update `db/console/src/schema/tables/org-workspaces.ts`:

```typescript
deletedAt: timestamp("deleted_at"),
```

**Rationale**:
- Enables future soft delete without data loss
- Preserves audit trail and historical records
- Allows "undo" capability within a grace period
- No breaking changes to existing queries (just add `WHERE deletedAt IS NULL`)

### Step 2: Add Missing FK Constraints

Update the 3 tables to include proper foreign key references:

**`workspace-workflow-runs.ts:37`**:
```typescript
// Before
workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

// After
workspaceId: varchar("workspace_id", { length: 191 })
  .notNull()
  .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
```

**`workspace-user-activities.ts:48`**:
```typescript
// Before
workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

// After
workspaceId: varchar("workspace_id", { length: 191 })
  .notNull()
  .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
```

**`workspace-operations-metrics.ts:58`**:
```typescript
// Before
workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

// After
workspaceId: varchar("workspace_id", { length: 191 })
  .notNull()
  .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
```

### Step 3: Verify No Orphaned Records Before Migration

Before running `pnpm db:generate`, verify no orphans exist:

```sql
-- Check for orphaned workflow runs
SELECT COUNT(*) FROM lightfast_workspace_workflow_runs
WHERE workspace_id NOT IN (SELECT id FROM lightfast_org_workspaces);

-- Check for orphaned user activities
SELECT COUNT(*) FROM lightfast_workspace_user_activities
WHERE workspace_id NOT IN (SELECT id FROM lightfast_org_workspaces);

-- Check for orphaned operations metrics
SELECT COUNT(*) FROM lightfast_workspace_operations_metrics
WHERE workspace_id NOT IN (SELECT id FROM lightfast_org_workspaces);
```

If orphans exist, clean them up before adding FK constraints:
```sql
DELETE FROM lightfast_workspace_workflow_runs
WHERE workspace_id NOT IN (SELECT id FROM lightfast_org_workspaces);
-- Repeat for other tables
```

### Step 4: Generate and Run Migration

```bash
cd db/console
pnpm db:generate
pnpm db:migrate
```

### Expected Migration Output

The generated migration should include:
```sql
-- Add deletedAt column
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN "deleted_at" timestamp;

-- Add FK constraints
ALTER TABLE "lightfast_workspace_workflow_runs"
ADD CONSTRAINT "workflow_runs_workspace_id_fk"
FOREIGN KEY ("workspace_id") REFERENCES "lightfast_org_workspaces"("id")
ON DELETE CASCADE;

ALTER TABLE "lightfast_workspace_user_activities"
ADD CONSTRAINT "activities_workspace_id_fk"
FOREIGN KEY ("workspace_id") REFERENCES "lightfast_org_workspaces"("id")
ON DELETE CASCADE;

ALTER TABLE "lightfast_workspace_operations_metrics"
ADD CONSTRAINT "metrics_workspace_id_fk"
FOREIGN KEY ("workspace_id") REFERENCES "lightfast_org_workspaces"("id")
ON DELETE CASCADE;
```

### Result: Consistent Schema

After these changes:

```
orgWorkspaces (id, deletedAt)
    │
    ├── [FK CASCADE] workspace_integrations
    ├── [FK CASCADE] workspace_knowledge_documents
    │       └── [FK CASCADE] workspace_knowledge_vector_chunks
    ├── [FK CASCADE] workspace_neural_observations
    ├── [FK CASCADE] workspace_observation_clusters
    ├── [FK CASCADE] workspace_webhook_payloads
    ├── [FK CASCADE] workspace_workflow_runs ✅
    ├── [FK CASCADE] workspace_user_activities ✅
    └── [FK CASCADE] workspace_operations_metrics ✅
```

### Future Work (Out of Scope)

The following are NOT part of this backend schema fix:
- tRPC mutation for workspace deletion
- UI components for delete confirmation
- Inngest workflow for deferred hard delete
- Pinecone vector cleanup logic

These can be implemented later when the deletion feature is needed.

---

## Open Questions

1. **Pinecone cleanup**: When hard delete is implemented, vectors must be deleted from Pinecone separately (not handled by DB cascade)
2. **Soft delete query filtering**: Queries will need `WHERE deletedAt IS NULL` - consider a Drizzle helper or view

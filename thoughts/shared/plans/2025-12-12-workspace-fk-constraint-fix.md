# Workspace FK Constraint Fix Implementation Plan

## Overview

Add missing foreign key constraints to 3 tables that reference `orgWorkspaces` but currently only have indexes (no referential integrity). This fixes a schema inconsistency where 6 tables have proper `ON DELETE CASCADE` constraints while 3 do not.

## Current State Analysis

### Tables WITH CASCADE DELETE (6 tables) - Correct
- `workspace_integrations`
- `workspace_knowledge_documents`
- `workspace_knowledge_vector_chunks`
- `workspace_neural_observations`
- `workspace_observation_clusters`
- `workspace_webhook_payloads`

### Tables WITHOUT CASCADE DELETE (3 tables) - Need Fix
| Table | File | Line |
|-------|------|------|
| `workspace_workflow_runs` | `db/console/src/schema/tables/workspace-workflow-runs.ts` | 37 |
| `workspace_user_activities` | `db/console/src/schema/tables/workspace-user-activities.ts` | 48 |
| `workspace_operations_metrics` | `db/console/src/schema/tables/workspace-operations-metrics.ts` | 58 |

### Key Discoveries
- Pattern to follow from `workspace-integrations.ts:31-33`:
  ```typescript
  workspaceId: varchar("workspace_id", { length: 191 })
    .notNull()
    .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
  ```
- `relations.ts` has TypeScript-only relations for `workspaceUserActivities` but NOT for `workspaceWorkflowRuns` or `workspaceOperationsMetrics`

## Desired End State

All 9 workspace-related tables have consistent FK constraints:

```
orgWorkspaces (id)
    │
    ├── [FK CASCADE] workspace_integrations
    ├── [FK CASCADE] workspace_knowledge_documents
    │       └── [FK CASCADE] workspace_knowledge_vector_chunks
    ├── [FK CASCADE] workspace_neural_observations
    ├── [FK CASCADE] workspace_observation_clusters
    ├── [FK CASCADE] workspace_webhook_payloads
    ├── [FK CASCADE] workspace_workflow_runs ✅ (fixed)
    ├── [FK CASCADE] workspace_user_activities ✅ (fixed)
    └── [FK CASCADE] workspace_operations_metrics ✅ (fixed)
```

## What We're NOT Doing

- Adding `deletedAt` column for soft delete (out of scope)
- Implementing workspace deletion UI/API (separate feature)
- Adding relations to `relations.ts` (TypeScript relations are optional, FK is the fix)

## Implementation Approach

1. Update 3 schema files to add `.references()` with cascade delete
2. Generate migration with Drizzle
3. Verify migration applies cleanly

## Phase 1: Add FK Constraints to Schema Files

### Overview
Modify 3 schema files to add proper foreign key references to `orgWorkspaces`.

### Changes Required:

#### 1. workspace-workflow-runs.ts
**File**: `db/console/src/schema/tables/workspace-workflow-runs.ts`

Add import at top:
```typescript
import { orgWorkspaces } from "./org-workspaces";
```

Change line 37 from:
```typescript
workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
```

To:
```typescript
workspaceId: varchar("workspace_id", { length: 191 })
  .notNull()
  .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
```

#### 2. workspace-user-activities.ts
**File**: `db/console/src/schema/tables/workspace-user-activities.ts`

Add import at top:
```typescript
import { orgWorkspaces } from "./org-workspaces";
```

Change line 48 from:
```typescript
workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
```

To:
```typescript
workspaceId: varchar("workspace_id", { length: 191 })
  .notNull()
  .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
```

#### 3. workspace-operations-metrics.ts
**File**: `db/console/src/schema/tables/workspace-operations-metrics.ts`

Add import at top:
```typescript
import { orgWorkspaces } from "./org-workspaces";
```

Change line 58 from:
```typescript
workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
```

To:
```typescript
workspaceId: varchar("workspace_id", { length: 191 })
  .notNull()
  .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
```

---

## Phase 2: Generate and Apply Migration

### Overview
Use Drizzle to generate the migration and apply it.

### Steps:

1. **Verify no orphaned records exist** (optional safety check):
   ```sql
   -- Run against production DB before migration
   SELECT COUNT(*) FROM lightfast_workspace_workflow_runs
   WHERE workspace_id NOT IN (SELECT id FROM lightfast_org_workspaces);

   SELECT COUNT(*) FROM lightfast_workspace_user_activities
   WHERE workspace_id NOT IN (SELECT id FROM lightfast_org_workspaces);

   SELECT COUNT(*) FROM lightfast_workspace_operations_metrics
   WHERE workspace_id NOT IN (SELECT id FROM lightfast_org_workspaces);
   ```

2. **Generate migration**:
   ```bash
   cd db/console && pnpm db:generate
   ```

3. **Apply migration**:
   ```bash
   cd db/console && pnpm db:migrate
   ```

### Expected Migration Output

The generated SQL should include:
```sql
ALTER TABLE "lightfast_workspace_workflow_runs"
ADD CONSTRAINT "lightfast_workspace_workflow_runs_workspace_id_lightfast_org_workspaces_id_fk"
FOREIGN KEY ("workspace_id") REFERENCES "lightfast_org_workspaces"("id")
ON DELETE CASCADE;

ALTER TABLE "lightfast_workspace_user_activities"
ADD CONSTRAINT "lightfast_workspace_user_activities_workspace_id_lightfast_org_workspaces_id_fk"
FOREIGN KEY ("workspace_id") REFERENCES "lightfast_org_workspaces"("id")
ON DELETE CASCADE;

ALTER TABLE "lightfast_workspace_operations_metrics"
ADD CONSTRAINT "lightfast_workspace_operations_metrics_workspace_id_lightfast_org_workspaces_id_fk"
FOREIGN KEY ("workspace_id") REFERENCES "lightfast_org_workspaces"("id")
ON DELETE CASCADE;
```

### Success Criteria:

#### Automated Verification:
- [ ] Schema files have correct imports and `.references()` calls
- [ ] `pnpm db:generate` completes without errors
- [ ] `pnpm db:migrate` applies cleanly
- [ ] `pnpm --filter @vendor/db build` succeeds
- [ ] `pnpm typecheck` passes

#### Manual Verification:
- [ ] Migration SQL contains expected FK constraints with CASCADE
- [ ] Database schema shows FK constraints on all 3 tables

---

## Testing Strategy

### Automated Tests:
- TypeScript compilation verifies schema is valid
- Build succeeds

### Manual Testing:
- Inspect generated migration SQL before applying
- Query database to verify FK constraints exist after migration

## Migration Notes

- **Risk**: If orphaned records exist, migration will fail
- **Mitigation**: Run orphan check queries before migration; delete orphans if found
- **Rollback**: Drop the FK constraints if needed (though unlikely)

## References

- Research document: `thoughts/shared/research/2025-12-12-workspace-deletion-orphan-records.md`
- Pattern reference: `db/console/src/schema/tables/workspace-integrations.ts:31-33`

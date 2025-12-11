---
date: 2025-12-11T00:46:40Z
researcher: Claude
git_commit: dd52c933bfc136cdaecb5e5d2d175063d1a102d3
branch: feat/memory-layer-foundation
repository: lightfastai/lightfast
topic: "Multi-Store Architecture Removal - Code Impact Analysis"
tags: [research, codebase, stores, pinecone, architecture, neural-memory]
status: complete
last_updated: 2025-12-11
last_updated_by: Claude
---

# Research: Multi-Store Architecture Removal - Code Impact Analysis

**Date**: 2025-12-11T00:46:40Z
**Researcher**: Claude
**Git Commit**: dd52c933bfc136cdaecb5e5d2d175063d1a102d3
**Branch**: feat/memory-layer-foundation
**Repository**: lightfastai/lightfast

## Research Question

Find all pieces of code related to the multi-store architecture that need changes when simplifying from multi-store per workspace to single-store per workspace.

## Summary

The multi-store architecture allows each workspace to have multiple stores (identified by `slug`), but in practice only the "default" store is ever used. The codebase has **27 files** that reference stores, with the following breakdown:

- **1 database schema file** defining the `workspaceStores` table
- **3 related tables** with foreign keys to `storeId`
- **6 Inngest workflows** referencing stores
- **3 tRPC routers** with store procedures
- **2 webhook handlers** querying stores
- **6 UI components** displaying store information
- **1 API search route** using stores for Pinecone queries

The simplification would:
1. Eliminate the `slug` column from `workspaceStores`
2. Change namespace format from `org_{clerkOrgId}:ws_{workspaceId}:store_{storeSlug}` to `org_{clerkOrgId}:ws_{workspaceId}`
3. Remove store selection UI and tRPC list procedures
4. Simplify all queries from `(workspaceId, slug)` to just `workspaceId`

---

## Detailed Findings

### 1. Database Schema

#### Primary Table: `workspace-stores.ts`
**File**: `db/console/src/schema/tables/workspace-stores.ts`

The `lightfast_workspace_stores` table defines:
- **Line 38**: `id` - Primary key (format: `{workspaceId}_{storeSlug}`)
- **Line 40-42**: `workspaceId` - FK to `orgWorkspaces.id`
- **Line 44**: `slug` - URL-safe identifier (max 20 chars) - **TO BE REMOVED**
- **Lines 46-83**: Pinecone and embedding configuration fields
- **Line 96**: Unique constraint on `(workspaceId, slug)` - **TO BE CHANGED**

**Changes Required**:
- Remove `slug` column (line 44)
- Change `id` format from `{workspaceId}_{slug}` to just `workspaceId`
- Change unique constraint from `(workspaceId, slug)` to just `workspaceId`
- Update `namespaceName` format (line 53-59) to exclude store segment

#### Foreign Key References (3 tables)

| File | Table | Field | Line |
|------|-------|-------|------|
| `workspace-knowledge-documents.ts` | `lightfast_workspace_knowledge_documents` | `storeId` | 30 |
| `workspace-knowledge-vector-chunks.ts` | `lightfast_workspace_knowledge_vector_chunks` | `storeId` | 30 |
| `workspace-workflow-runs.ts` | `lightfast_workspace_workflow_runs` | `storeId` | 45 |

**Note**: These tables reference `storeId` which will still exist - no schema changes needed.

#### Relations
**File**: `db/console/src/schema/relations.ts`

- **Lines 22-29**: `workspaceStoresRelations` - defines one-to-many with documents and vector chunks
- No changes needed if `storeId` remains as FK

---

### 2. Pinecone Integration

#### Namespace Resolution
**File**: `api/console/src/inngest/workflow/infrastructure/ensure-store.ts`

**Current Format** (line 54-68):
```typescript
function resolveNamespaceName(clerkOrgId: string, workspaceId: string, storeSlug: string): string {
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}:store_${sanitize(storeSlug)}`;
}
```

**Changes Required**:
- Simplify to: `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`
- Remove `storeSlug` parameter

#### Store ID Generation
**File**: `api/console/src/inngest/workflow/infrastructure/ensure-store.ts:299`

**Current**:
```typescript
id: `${workspaceId}_${storeSlug}`
```

**Changes Required**:
- Simplify to just use `workspaceId` as store ID

#### Legacy Store Utilities (DEPRECATED)
**File**: `api/console/src/lib/stores.ts`

- Lines 31-42: `resolveIndexName()` - already deprecated
- Lines 65-155: `getOrCreateStore()` - already deprecated
- These can be deleted entirely

---

### 3. tRPC Routers

#### M2M Store Router
**File**: `api/console/src/router/m2m/stores.ts`

| Procedure | Lines | Input | Changes Required |
|-----------|-------|-------|------------------|
| `stores.get` | 33-49 | `{ workspaceId, storeSlug }` | Remove `storeSlug`, query by `workspaceId` only |
| `stores.create` | 57-102 | Full store config with `slug` | Remove `slug` field |

#### Workspace Stores Sub-Router
**File**: `api/console/src/router/org/workspace.ts:622-664`

| Procedure | Lines | Changes Required |
|-----------|-------|------------------|
| `workspace.stores.list` | 627-663 | Remove entirely (single store per workspace = no list needed) |

**Alternative**: Convert to `workspace.store.get` returning single store

#### Deprecated Store Router
**File**: `api/console/src/router/org/stores.ts`

- Already deprecated - can be deleted

#### Procedures Using storeId

| File | Procedure | Lines | Impact |
|------|-----------|-------|--------|
| `router/m2m/jobs.ts` | `jobs.create` | 40 | No change - still uses `storeId` |
| `router/org/jobs.ts` | `jobs.restart` | 435-491 | Remove `storeSlug: "default"` hardcoding |
| `router/org/search.ts` | `search.query` | 60-96 | Remove store filter parsing, get store directly |
| `router/org/contents.ts` | `contents.fetch` | 57, 61 | No change - joins via `storeId` |

---

### 4. Inngest Workflows

#### Workflows Requiring Changes

| File | Function | Lines | Changes Required |
|------|----------|-------|------------------|
| `infrastructure/ensure-store.ts` | `ensureStore` | All | Remove `storeSlug` from event/logic |
| `processing/process-documents.ts` | `processDocuments` | 370-392 | Change `getStore()` to query by `workspaceId` only |
| `processing/delete-documents.ts` | `deleteDocuments` | 76-87 | Query store by `workspaceId` only |
| `orchestration/sync-orchestrator.ts` | `syncOrchestrator` | 157-182 | Remove `storeSlug` from ensure-store invoke |
| `sources/github-sync-orchestrator.ts` | `githubSyncOrchestrator` | 197-198 | Remove `storeSlug` from event data |
| `providers/github/push-handler.ts` | `githubPushHandler` | 84-98 | Remove `slug: "default"` filter |
| `processing/files-batch-processor.ts` | `filesBatchProcessor` | 70 | Remove `storeSlug` from event data |

#### Inngest Event Schemas
**File**: `api/console/src/inngest/client/client.ts`

Events with `storeSlug` field to update:
- `apps-console/store.ensure`
- `apps-console/documents.process`
- `apps-console/documents.delete`
- `apps-console/github.sync.trigger`
- `apps-console/files.batch.process`

---

### 5. Webhook Handlers

#### Vercel Webhooks
**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

**Current** (lines 50-56):
```typescript
const store = await db.query.workspaceStores.findFirst({
  where: and(
    eq(workspaceStores.workspaceId, workspaceId),
    eq(workspaceStores.slug, "default"),
  ),
});
```

**Changes Required**:
- Remove `slug` filter, query by `workspaceId` only

#### GitHub Webhooks
**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`

- Does NOT reference stores directly
- Triggers Inngest workflows that handle stores
- No direct changes needed

#### Workspace Search API
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

**Current** (lines 146-158):
```typescript
const store = await db.query.workspaceStores.findFirst({
  where: and(
    eq(workspaceStores.slug, storeSlug),
    eq(workspaceStores.workspaceId, workspaceId)
  ),
});
```

**Changes Required**:
- Remove `storeSlug` from request schema
- Query by `workspaceId` only

---

### 6. UI Components

#### Components to Modify

| Component | File | Changes Required |
|-----------|------|------------------|
| `StoresOverview` | `components/stores-overview.tsx` | Remove or convert to single store display |
| `WorkspaceSearch` | `components/workspace-search.tsx` | Remove store selection dropdown (lines 159-186) |
| `SystemHealthOverview` | `components/system-health-overview.tsx` | Simplify store display (no expandable list) |
| `LightfastConfigOverview` | `components/lightfast-config-overview.tsx` | Remove stores loop, show single store config |
| `WorkspaceDashboard` | `components/workspace-dashboard.tsx` | Update store data fetching |
| `SetupGuideModal` | `components/setup-guide-modal.tsx` | Update YAML template (remove `store:` field) |

#### Type Definitions
**File**: `apps/console/src/types/index.ts`

```typescript
// Current
type StoresList = RouterOutputs["workspace"]["stores"]["list"];
type Store = StoresList["list"][number];

// Change to
type Store = RouterOutputs["workspace"]["store"]["get"];
```

---

## Code References

### Database
- `db/console/src/schema/tables/workspace-stores.ts:34-102` - Main schema
- `db/console/src/schema/relations.ts:22-29` - Store relations

### tRPC
- `api/console/src/router/m2m/stores.ts:33-102` - M2M procedures
- `api/console/src/router/org/workspace.ts:622-664` - User-facing list
- `api/console/src/router/org/search.ts:60-96` - Store resolution for search

### Inngest
- `api/console/src/inngest/workflow/infrastructure/ensure-store.ts:54-68` - Namespace generation
- `api/console/src/inngest/workflow/processing/process-documents.ts:370-392` - Store lookup

### Webhooks
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:50-56` - Default store query
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:146-158` - Search store query

### UI
- `apps/console/src/components/stores-overview.tsx` - Store list display
- `apps/console/src/components/workspace-search.tsx:159-186` - Store dropdown

---

## Architecture Documentation

### Current Multi-Store Pattern
```
Workspace (1) ──────┬────── Store "default" ──── Documents, Vectors
                    │
                    ├────── Store "docs" ──────── Documents, Vectors
                    │
                    └────── Store "api" ──────── Documents, Vectors
```

### Proposed Single-Store Pattern
```
Workspace (1) ══════════════ Store ══════════════ Documents, Vectors
```

### Namespace Format Change
```
Current:  org_{clerkOrgId}:ws_{workspaceId}:store_{storeSlug}
Proposed: org_{clerkOrgId}:ws_{workspaceId}
```

### Store ID Format Change
```
Current:  {workspaceId}_{storeSlug}
Proposed: {workspaceId}
```

---

## Migration Impact

Since we're not in production:
- No data migration needed
- No backward compatibility concerns
- Can directly modify schema and regenerate

### Files to Delete (Post-Migration)
1. `api/console/src/lib/stores.ts` - Deprecated utilities
2. `api/console/src/router/org/stores.ts` - Deprecated router

### Files Requiring Major Refactoring
1. `ensure-store.ts` - Remove slug from all logic
2. `workspace.ts` router - Convert list to single get
3. `stores-overview.tsx` - Convert to single store display
4. `workspace-search.tsx` - Remove store dropdown

---

## Summary: Files Requiring Changes

### High Impact (Core Logic Changes)
1. `db/console/src/schema/tables/workspace-stores.ts`
2. `api/console/src/inngest/workflow/infrastructure/ensure-store.ts`
3. `api/console/src/router/m2m/stores.ts`
4. `api/console/src/router/org/workspace.ts`
5. `api/console/src/inngest/client/client.ts` (event schemas)

### Medium Impact (Query Changes)
6. `api/console/src/inngest/workflow/processing/process-documents.ts`
7. `api/console/src/inngest/workflow/processing/delete-documents.ts`
8. `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts`
9. `api/console/src/inngest/workflow/providers/github/push-handler.ts`
10. `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
11. `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
12. `api/console/src/router/org/search.ts`

### Low Impact (UI Updates)
13. `apps/console/src/components/stores-overview.tsx`
14. `apps/console/src/components/workspace-search.tsx`
15. `apps/console/src/components/system-health-overview.tsx`
16. `apps/console/src/components/lightfast-config-overview.tsx`
17. `apps/console/src/components/workspace-dashboard.tsx`
18. `apps/console/src/components/setup-guide-modal.tsx`
19. `apps/console/src/types/index.ts`

### Deletable Files
20. `api/console/src/lib/stores.ts`
21. `api/console/src/router/org/stores.ts`

---

## Open Questions

1. Should `storeId` remain as the FK in related tables, or should it become `workspaceId` directly?
2. Should the `workspaceStores` table be renamed to `workspaceStore` (singular)?
3. Should we keep the store abstraction at all, or merge store config directly into `orgWorkspaces`?

---

## Related Research

- `thoughts/shared/plans/2025-12-11-neural-memory-observation-pipeline.md` - Neural memory pipeline plan
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Neural memory design doc

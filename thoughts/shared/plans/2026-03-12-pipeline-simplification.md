# Pipeline Simplification: Delete Clusters, Actor Reconciliation, LLM Extraction

## Overview

Strip the observation pipeline down to essentials. Delete the cluster system entirely (~715 lines), actor reconciliation (~100 lines), and the LLM entity extraction workflow (~320 lines). Clean up ~1,135 lines of dead code and simplify `observation-capture.ts` from 1,202 to ~1,000 lines.

## Current State Analysis

The observation pipeline (`observation-capture.ts`) is a 1,202-line monolith that does too much:
- Dedup, event filter, significance gate (necessary)
- Classification via LLM (necessary)
- Multi-view embedding (necessary)
- Entity extraction from references (necessary)
- Actor resolution (necessary)
- **Cluster assignment** (DELETE — premature, replaced by nothing for now)
- Pinecone vector upsert (necessary)
- Store observation + entities (necessary)
- Relationship detection (necessary)
- **Vercel actor reconciliation** (DELETE — unnecessary cross-source complexity)
- Event emission including **cluster summary** and **LLM entity extraction** events (DELETE triggers)

### Key Discoveries:
- `workspaceObservationClusters` table at `db/console/src/schema/tables/workspace-observation-clusters.ts:19`
- `clusterId` column on observation table at `db/console/src/schema/tables/workspace-neural-observations.ts:86`
- `cluster-assignment.ts` (300 lines) at `api/console/src/inngest/workflow/neural/cluster-assignment.ts`
- `cluster-summary.ts` (315 lines) at `api/console/src/inngest/workflow/neural/cluster-summary.ts`
- `cluster-search.ts` (97 lines) at `apps/console/src/lib/neural/cluster-search.ts`
- `llm-entity-extraction-workflow.ts` (277 lines) at `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts`
- `llm-entity-extraction.ts` (42 lines) at `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts`
- `reconcileVercelActorsForCommit` defined at `observation-capture.ts:178` — only called at line 1054
- Notification dispatch at `api/console/src/inngest/workflow/notifications/dispatch.ts:43` destructures `clusterId`
- Four-path search at `apps/console/src/lib/neural/four-path-search.ts:505` conditionally runs cluster search
- Workspace cache at `packages/console-workspace-cache/src/config.ts:99-100` queries cluster count for `hasClusters`
- `id-resolver.ts` returns `clusterId` in `ResolvedObservation` interface at line 21
- `findsimilar.ts` uses `clusterId` for `sameCluster` boost at line 302-303

## Desired End State

- `workspaceObservationClusters` table dropped
- `clusterId` column removed from `workspaceNeuralObservations`
- No cluster-related code, metrics, or events anywhere in the codebase
- No actor reconciliation code
- No LLM entity extraction workflow (inline extraction in main function is sufficient)
- `observation-capture.ts` is ~1,000 lines (focused: store → classify → embed → extract → link)
- Four-path search becomes three-path search (vector, entity, actor)
- `pnpm check && pnpm typecheck` pass cleanly

## What We're NOT Doing

- NOT splitting observation-capture.ts into 2 Inngest functions (defer to next iteration)
- NOT creating a separate interpretation table (defer — fact/interpretation separation is correct but not urgent pre-production)
- NOT adding entity↔observation junction table (defer)
- NOT deleting profile update workflow or actor profiles table (user-facing functionality)
- NOT deleting relationship detection (still useful for graph edges)
- NOT changing the relay → QStash → ingress pipeline (working fine)

## Implementation Approach

Work inside-out: clean up code consumers first, then remove schema definitions, then generate migration. Pre-production system — no data to migrate.

---

## Phase 1: Delete Cluster Code + Actor Reconciliation + LLM Extraction

### Overview
Remove all cluster-related code, actor reconciliation, and the LLM entity extraction workflow. This is pure deletion — no new code.

### Changes Required:

#### 1. Delete cluster files entirely
**Delete these files:**
- `api/console/src/inngest/workflow/neural/cluster-assignment.ts` (300 lines)
- `api/console/src/inngest/workflow/neural/cluster-summary.ts` (315 lines)
- `apps/console/src/lib/neural/cluster-search.ts` (97 lines)

#### 2. Delete LLM entity extraction files entirely
**Delete these files:**
- `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts` (277 lines)
- `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts` (42 lines)

#### 3. Clean up `observation-capture.ts`
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Remove cluster assignment, actor reconciliation, LLM extraction, and related metrics

Remove these imports:
```typescript
// DELETE
import { assignToCluster } from "./cluster-assignment";
```

Remove `reconcileVercelActorsForCommit` function (lines 178-275).

Remove the `assign-cluster` step (lines 818-835):
```typescript
// DELETE entire step.run("assign-cluster", ...) block
```

Remove cluster_affinity metric (lines 837-850):
```typescript
// DELETE void recordJobMetric({ ... type: "cluster_affinity" ... })
```

Remove the `reconcile-vercel-actors` step (lines 1040-1065):
```typescript
// DELETE entire if (sourceEvent.source === "github" && sourceEvent.sourceType === "push") block
```

Update `step.sendEvent("emit-events")` (lines 1070-1125):
- Remove `clusterId` and `clusterIsNew` from `observation.captured` event data
- Remove entire `cluster.check-summary` event object
- Remove entire `llm-entity-extraction.requested` event object

Update `complete-job-success` output (lines 1129-1143):
- Remove `clusterId` and `clusterIsNew` from output

Remove cluster_assigned metric (lines 1178-1190):
```typescript
// DELETE void recordJobMetric({ ... type: "cluster_assigned" ... })
```

Remove cluster-related return value fields.

#### 4. Update neural workflow index
**File**: `api/console/src/inngest/workflow/neural/index.ts`
**Changes**: Remove deleted exports

```typescript
// BEFORE
export { clusterSummaryCheck } from "./cluster-summary";
export { llmEntityExtractionWorkflow } from "./llm-entity-extraction-workflow";
export { observationCapture } from "./observation-capture";
export { profileUpdate } from "./profile-update";

// AFTER
export { observationCapture } from "./observation-capture";
export { profileUpdate } from "./profile-update";
```

#### 5. Update Inngest function registry
**File**: `api/console/src/inngest/index.ts`
**Changes**: Remove deleted workflow imports and registrations

Remove imports of `clusterSummaryCheck` and `llmEntityExtractionWorkflow` from `"./workflow/neural"`.

Remove from exports:
```typescript
// DELETE these from the export block
clusterSummaryCheck,
llmEntityExtractionWorkflow,
```

Remove from `createInngestRouteContext` functions array:
```typescript
// DELETE
clusterSummaryCheck,
llmEntityExtractionWorkflow,
```

Update the JSDoc comment listing registered functions.

#### 6. Update Inngest client event schemas
**File**: `api/console/src/inngest/client/client.ts`
**Changes**: Remove deleted event schemas

Remove these event definitions from `eventsMap`:
```typescript
// DELETE
"apps-console/neural/cluster.check-summary": z.object({ ... })
"apps-console/neural/llm-entity-extraction.requested": z.object({ ... })
```

Remove `clusterId` and `clusterIsNew` from `observation.captured` event:
```typescript
"apps-console/neural/observation.captured": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string().optional(),
    observationId: z.string(),
    sourceId: z.string(),
    observationType: z.string(),
    significanceScore: z.number().optional(),
    topics: z.array(z.string()).optional(),
    entitiesExtracted: z.number().optional(),
    // DELETED: clusterId, clusterIsNew
}),
```

#### 7. Update notification dispatch
**File**: `api/console/src/inngest/workflow/notifications/dispatch.ts`
**Changes**: Remove `clusterId` from destructured event data and Knock payload

```typescript
// BEFORE (line 43)
const { workspaceId, clerkOrgId, observationId, observationType, significanceScore, topics, clusterId } = event.data;

// AFTER
const { workspaceId, clerkOrgId, observationId, observationType, significanceScore, topics } = event.data;
```

Remove `clusterId` from Knock workflow data (line 85).

#### 8. Update four-path search → three-path search
**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Changes**: Remove cluster search path

Remove `searchClusters` import from `"./cluster-search"`.
Remove `hasClusters` from workspace config destructuring (line 432).
Remove entire Path 3 (cluster search) from the `Promise.all` array (lines 504-523).
Remove `clusterResults` from destructuring and logging.
Update `clusterSkipped` log field removal.
Remove `EMPTY_CLUSTER_RESULT` if defined in this file.

Note: The `ClusterSearchResult` type import also gets removed since `cluster-search.ts` is deleted.

#### 9. Update workspace cache
**File**: `packages/console-workspace-cache/src/config.ts`
**Changes**: Remove cluster count query and `hasClusters` flag

Remove `workspaceObservationClusters` import.
Remove cluster count query from `fetchWorkspaceConfigFromDB` (lines 97-101).
Remove `hasClusters` from returned config (line 124).

**File**: `packages/console-workspace-cache/src/types.ts`
**Changes**: Remove `hasClusters` from `CachedWorkspaceConfig`

```typescript
export interface CachedWorkspaceConfig {
  embeddingDim: number;
  embeddingModel: string;
  hasActors: boolean;
  // DELETED: hasClusters: boolean;
  indexName: string;
  namespaceName: string;
}
```

#### 10. Update ID resolver
**File**: `apps/console/src/lib/neural/id-resolver.ts`
**Changes**: Remove `clusterId` from `ResolvedObservation` interface and all query results

Remove `clusterId: number | null` from `ResolvedObservation` interface (line 21).
Remove `clusterId: true` from all `columns` objects in queries.
Remove `clusterId: obs.clusterId` from all result mappings.

#### 11. Update findsimilar
**File**: `apps/console/src/lib/v1/findsimilar.ts`
**Changes**: Remove `clusterId` usage for `sameCluster` boost

Remove `clusterId` from source content resolution (lines 210, 223, 234).
Remove `sourceClusterId` parameter from `enrichResults` function (line 245).
Remove `sameCluster` field from enriched results (line 302-303).
Simplify `enrichResults` call to not pass cluster context.

#### 12. Update reset-demo script
**File**: `packages/console-test-data/src/cli/reset-demo.ts`
**Changes**: Remove cluster table references

Remove `workspaceObservationClusters` import.
Remove any delete/query operations on the cluster table.

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm typecheck`
- [x] No lint errors: `pnpm check`
- [x] These files are deleted: `cluster-assignment.ts`, `cluster-summary.ts`, `cluster-search.ts`, `llm-entity-extraction-workflow.ts`, `llm-entity-extraction.ts`
- [x] `grep -r "clusterSummaryCheck\|llmEntityExtractionWorkflow\|assignToCluster\|reconcileVercelActorsForCommit\|cluster-assignment\|cluster-summary\|cluster-search\|llm-entity-extraction" --include="*.ts" api/ apps/ packages/ db/` returns no matches (remaining match in `workflow-io.ts` is schema literals, cleaned in Phase 3)

---

## Phase 2: Schema Cleanup

### Overview
Remove the `workspaceObservationClusters` table, the `clusterId` column from observations, and clean up cluster/actor-reconciliation metric types.

### Changes Required:

#### 1. Remove cluster table schema
**Delete file**: `db/console/src/schema/tables/workspace-observation-clusters.ts`

#### 2. Remove clusterId column from observations
**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`
**Changes**:

Remove `clusterId` column (line 86):
```typescript
// DELETE
clusterId: bigint("cluster_id", { mode: "number" }),
```

Remove `clusterIdx` index (line 232):
```typescript
// DELETE
clusterIdx: index("obs_cluster_idx").on(table.clusterId),
```

#### 3. Remove cluster relations
**File**: `db/console/src/schema/relations.ts`
**Changes**:

Remove `workspaceObservationClusters` import (line 12).
Remove `observationClusters: many(workspaceObservationClusters)` from `orgWorkspacesRelations` (line 52).
Remove `cluster` relation from `workspaceNeuralObservationsRelations` (lines 117-119).
Delete entire `workspaceObservationClustersRelations` block (lines 124-133).

#### 4. Remove cluster exports from schema barrel files
**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Remove lines 86-90 (cluster table exports)

```typescript
// DELETE
export {
  type InsertWorkspaceObservationCluster,
  type WorkspaceObservationCluster,
  workspaceObservationClusters,
} from "./workspace-observation-clusters";
```

**File**: `db/console/src/schema/index.ts`
**Changes**:
- Remove `workspaceObservationClustersRelations` from relations re-export (line 15)
- Remove `InsertWorkspaceObservationCluster` from type re-exports (line 69)
- Remove `WorkspaceObservationCluster` from type re-exports (line 91)
- Remove `workspaceObservationClusters` from table re-exports (line 107)

**File**: `db/console/src/index.ts`
**Changes**: Remove cluster table and relations re-exports

#### 5. Clean up metrics schemas
**File**: `packages/console-validation/src/schemas/metrics.ts`
**Changes**:

Remove these metric types from `operationMetricTypeSchema`:
- `"cluster_assigned"` (line 50)
- `"cluster_summary_generated"` (line 51)
- `"cluster_affinity"` (line 55)

Remove these schemas:
- `clusterTagsSchema` (lines 131-135) and `ClusterTags` type (line 148)
- `clusterAffinityTagsSchema` (lines 172-178) and `ClusterAffinityTags` type (line 183)
- `clusterAssignedMetricSchema` (lines 261-266)
- `clusterSummaryGeneratedMetricSchema` (lines 268-278)
- `clusterAffinityMetricSchema` (lines 297-302)

Remove the corresponding entries from the `operationMetricSchema` union.

Note: Keep `actorResolutionTagsSchema` and `ActorResolutionTags` — actor resolution (not reconciliation) is still used.

#### 6. Update operations metrics table types
**File**: `db/console/src/schema/tables/workspace-operations-metrics.ts`
**Changes**:

Remove imports of `ClusterAffinityTags` and `ClusterTags`.
Remove from `OperationMetricTags` discriminated union:
- `{ type: "cluster_assigned"; ... }`
- `{ type: "cluster_summary_generated"; ... }`
- `{ type: "cluster_affinity"; ... }`

Remove from re-export chains in `tables/index.ts`, `schema/index.ts`, and `db/console/src/index.ts`:
- `ClusterAffinityTags`
- `ClusterTags`

#### 7. Update jobs.ts metric types
**File**: `api/console/src/lib/jobs.ts`
**Changes**:

Remove imports of `ClusterAffinityTags` and `ClusterTags`.
Remove from `recordJobMetric` overload/discriminated union:
- `type: "cluster_assigned"` arm
- `type: "cluster_affinity"` arm
- `type: "cluster_summary_generated"` arm (if present)

#### 8. Generate migration
```bash
cd db/console && pnpm db:generate
```

This will generate a migration that:
- Drops `lightfast_workspace_observation_clusters` table
- Drops `cluster_id` column from `lightfast_workspace_neural_observations`
- Drops `obs_cluster_idx` index

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [ ] No TypeScript errors: `pnpm typecheck`
- [ ] No lint errors: `pnpm check`
- [ ] `grep -r "workspaceObservationClusters\|clusterId\|ClusterTags\|ClusterAffinityTags\|cluster_assigned\|cluster_affinity\|cluster_summary" --include="*.ts" db/ api/ apps/ packages/` returns no matches (excluding migration files)

#### Manual Verification:
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [ ] Dev server starts: `pnpm dev:console`
- [ ] Search endpoint works without cluster path (v1/search)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that migration applies and dev server runs.

---

## Phase 3: Validation & Cleanup

### Overview
Final verification pass. Ensure no orphaned references, clean up validation schemas, and verify the pipeline end-to-end.

### Changes Required:

#### 1. Clean up validation schemas
**File**: `packages/console-validation/src/schemas/workflow-io.ts`
**Changes**: If there are workflow input/output schemas for deleted workflows (cluster summary, LLM entity extraction), remove them.

#### 2. Verify observation-capture.ts is clean
After all removals, verify:
- No references to `clusterId`, `clusterResult`, `assignToCluster`
- No references to `reconcileVercelActorsForCommit`
- No references to `llm-entity-extraction`
- `step.sendEvent("emit-events")` only emits: `observation.captured` and `profile.update`
- Store observation step doesn't write cluster-related fields

#### 3. Clean up on-failure-handler.ts
**File**: `api/console/src/inngest/workflow/neural/on-failure-handler.ts`
**Changes**: If JSDoc references deleted events, update the comments.

### Success Criteria:

#### Automated Verification:
- [ ] Full typecheck passes: `pnpm typecheck`
- [ ] Full lint passes: `pnpm check`
- [ ] No orphaned imports: `pnpm check` catches unused imports
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Send a test webhook through relay → observe it flowing through the simplified pipeline
- [ ] Search works via v1/search endpoint (now 3-path: vector + entity + actor)
- [ ] Verify no Inngest function registration errors in dev console

---

## Deletion Summary

### Files Deleted (6 files, ~1,031 lines)
| File | Lines | What it did |
|------|-------|-------------|
| `api/console/src/inngest/workflow/neural/cluster-assignment.ts` | 300 | Cluster affinity scoring + assignment |
| `api/console/src/inngest/workflow/neural/cluster-summary.ts` | 315 | LLM-generated cluster summaries |
| `apps/console/src/lib/neural/cluster-search.ts` | 97 | Pinecone centroid search for clusters |
| `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts` | 277 | Async LLM entity extraction for rich content |
| `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts` | 42 | Helper for LLM entity extraction |
| `db/console/src/schema/tables/workspace-observation-clusters.ts` | ~157 | Cluster table schema |

### Code Removed from Existing Files (~300+ lines)
| File | Lines removed | What |
|------|---------------|------|
| `observation-capture.ts` | ~190 | Cluster assignment, reconciliation, extraction events, metrics |
| `client.ts` | ~20 | 2 event schemas + clusterId/clusterIsNew fields |
| `dispatch.ts` | ~3 | clusterId destructuring + Knock data |
| `four-path-search.ts` | ~30 | Cluster search path |
| `id-resolver.ts` | ~20 | clusterId from interface + all query results |
| `findsimilar.ts` | ~20 | clusterId + sameCluster logic |
| `config.ts` + `types.ts` | ~10 | hasClusters query + flag |
| `relations.ts` | ~15 | Cluster relations |
| Various barrel exports | ~20 | Cluster re-exports through schema chain |
| `metrics.ts` | ~40 | 3 metric types + schemas |
| `jobs.ts` | ~15 | 3 metric overloads |

### Total: ~1,400 lines deleted/removed

### What Remains
- `observation-capture.ts` (~1,000 lines): dedup → filter → significance → classify → embed → extract → actor → store → link → emit
- `profile-update.ts` (278 lines): actor profile maintenance (user-facing)
- `relationship-detection.ts` (494 lines): observation edge creation (necessary)
- Actor profiles table + search: used by tRPC workspace router and search
- Three-path search: vector + entity + actor

## References

- Architecture critique conversation: 2026-03-12
- Original monolith research: `thoughts/shared/research/2026-03-10-graph-linker-deep-dive.md`
- Multi-layer architecture doc (superseded by this simplification): `thoughts/shared/research/2026-03-10-multi-layer-event-graph-architecture.md`

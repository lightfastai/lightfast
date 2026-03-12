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

#### 4. Delete actor logic files entirely
**Delete these files:**
- `api/console/src/inngest/workflow/neural/actor-resolution.ts` (~141 lines) — `resolveActor` function
- `api/console/src/inngest/workflow/neural/profile-update.ts` (~278 lines) — actor profile upsert workflow
- `api/console/src/lib/actor-identity.ts` — `upsertOrgActorIdentity` (only caller: profile-update.ts)
- `api/console/src/lib/actor-linking.ts` — `ensureActorLinked` (lazy Clerk linking)
- `apps/console/src/lib/neural/actor-search.ts` — `searchActorProfiles` (only caller: four-path-search.ts)

#### 5. Remove actor logic from observation-capture.ts
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**:

Remove import:
```typescript
// DELETE
import { resolveActor } from "./actor-resolution";
```

Remove `resolveActor` from the parallel `Promise.all` step (line 657-659). The `resolvedActor` variable and all downstream uses disappear:
- Remove `resolve-actor` step from `Promise.all`
- Remove `getActorResolutionMethod` helper function (lines 662-696)
- Remove `profile.update` event from `step.sendEvent("emit-events")` (lines 904-917)
- Simplify `Promise.all` to only: `generate-multi-view-embeddings` + `extract-entities`

Note: The raw `sourceEvent.actor` JSONB is still stored on the observation row (it's a fact). We're only removing the resolution/profile layer.

#### 6. Remove actor filter UI components
**File**: `apps/console/src/components/actor-filter.tsx` — **Delete entire file**
**File**: `apps/console/src/components/search-filters.tsx` — Remove `<ActorFilter>` import and rendering (line 286), remove `actorNames`/`onActorNamesChange` props

#### 7. Remove actor tRPC procedures and lazy linking
**File**: `api/console/src/router/org/workspace.ts`
**Changes**:
- Remove `import { ensureActorLinked } from "../../lib/actor-linking"` (line 52)
- Remove `ensureActorLinked(...)` call in workspace `get` procedure (line 156)
- Remove `import { workspaceActorProfiles } from "@db/console/schema"` (line 5)
- Remove entire `getActors` tRPC procedure (lines 1273-1292)

**File**: `api/console/src/router/org/__tests__/notify-backfill.test.ts`
- Remove `vi.mock("../../../lib/actor-linking", ...)` mock (line 74-76)
- Remove `workspaceActorProfiles` mock if present

#### 8. Update neural workflow index
**File**: `api/console/src/inngest/workflow/neural/index.ts`
**Changes**: Remove all deleted exports

```typescript
// BEFORE
export { clusterSummaryCheck } from "./cluster-summary";
export { llmEntityExtractionWorkflow } from "./llm-entity-extraction-workflow";
export { observationCapture } from "./observation-capture";
export { profileUpdate } from "./profile-update";

// AFTER
export { observationCapture } from "./observation-capture";
```

#### 9. Update Inngest function registry
**File**: `api/console/src/inngest/index.ts`
**Changes**: Remove all deleted workflow imports and registrations

Remove imports of `clusterSummaryCheck`, `llmEntityExtractionWorkflow`, and `profileUpdate` from `"./workflow/neural"`.

Remove from exports and `createInngestRouteContext` functions array:
```typescript
// DELETE all three
clusterSummaryCheck,
llmEntityExtractionWorkflow,
profileUpdate,
```

Update the JSDoc comment listing registered functions.

#### 10. Update Inngest client event schemas
**File**: `api/console/src/inngest/client/client.ts`
**Changes**: Remove deleted event schemas

Remove these event definitions from `eventsMap`:
```typescript
// DELETE
"apps-console/neural/cluster.check-summary": z.object({ ... })
"apps-console/neural/llm-entity-extraction.requested": z.object({ ... })
"apps-console/neural/profile.update": z.object({ ... })
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

#### 12. Update four-path search → two-path search
**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Changes**: Remove cluster AND actor search paths — only vector + entity remain

Remove imports:
- `searchClusters` from `"./cluster-search"`
- `searchActorProfiles` from `"./actor-search"`

Remove `hasClusters` and `hasActors` from workspace config destructuring (line 432).
Remove `EMPTY_CLUSTER_RESULT` and `EMPTY_ACTOR_RESULT` constants.
Remove Path 3 (cluster search) and Path 4 (actor search) from the `Promise.all` array.
Update destructuring to `[vectorResults, entityResults]`.
Remove `clusterResults`, `actorResults`, `clusterMatches`, `actorMatches`, `clusterSkipped`, `actorSkipped` from logging.

Rename file/function from "four-path" to "search" if desired (optional, cosmetic).

#### 13. Update workspace cache
**File**: `packages/console-workspace-cache/src/config.ts`
**Changes**: Remove cluster AND actor queries

Remove imports of `workspaceObservationClusters` and `workspaceActorProfiles`.
Remove cluster count query (lines 97-101) and actor count query (lines 103-107) from `fetchWorkspaceConfigFromDB`.
Remove `hasClusters` and `hasActors` from returned config.
Simplify `Promise.all` to just the workspace settings query.

**File**: `packages/console-workspace-cache/src/types.ts`
**Changes**: Remove both capability flags

```typescript
export interface CachedWorkspaceConfig {
  embeddingDim: number;
  embeddingModel: string;
  // DELETED: hasActors: boolean;
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

#### 1b. Remove actor tables
**Delete file**: `db/console/src/schema/tables/workspace-actor-profiles.ts`
**Delete file**: `db/console/src/schema/tables/org-actor-identities.ts`

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

#### 3. Remove cluster + actor relations
**File**: `db/console/src/schema/relations.ts`
**Changes**:

Remove imports: `workspaceObservationClusters` (line 12), `workspaceActorProfiles` (line 7), `orgActorIdentities` (line 5).
Remove `observationClusters: many(workspaceObservationClusters)` from `orgWorkspacesRelations` (line 52).
Remove `actorProfiles: many(workspaceActorProfiles)` from `orgWorkspacesRelations` (line 53).
Remove `cluster` relation from `workspaceNeuralObservationsRelations` (lines 117-119).
Delete entire `workspaceObservationClustersRelations` block (lines 124-133).
Delete entire `workspaceActorProfilesRelations` block (lines 136-145).
Delete entire `orgActorIdentitiesRelations` block (lines 160-166).

#### 4. Remove cluster + actor exports from schema barrel files
**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Remove exports for all 3 deleted tables:

```typescript
// DELETE — cluster
export { type InsertWorkspaceObservationCluster, type WorkspaceObservationCluster, workspaceObservationClusters } from "./workspace-observation-clusters";

// DELETE — actor profiles
export { type InsertWorkspaceActorProfile, type WorkspaceActorProfile, workspaceActorProfiles } from "./workspace-actor-profiles";

// DELETE — actor identities
export { type InsertOrgActorIdentity, type OrgActorIdentity, orgActorIdentities } from "./org-actor-identities";
```

**File**: `db/console/src/schema/index.ts`
**Changes**:
- Remove `workspaceObservationClustersRelations`, `workspaceActorProfilesRelations`, `orgActorIdentitiesRelations` from relations re-export
- Remove all type/table re-exports for the 3 deleted tables

**File**: `db/console/src/index.ts`
**Changes**: Remove all re-exports for the 3 deleted tables and their relations

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
- Drops `lightfast_workspace_actor_profiles` table (Phase 2 addition)
- Drops `lightfast_org_actor_identities` table (Phase 2 addition)
- Drops `cluster_id` column from `lightfast_workspace_neural_observations`
- Drops `obs_cluster_idx` index

### Success Criteria:

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] No TypeScript errors: `pnpm typecheck`
- [x] No lint errors: `pnpm check`
- [x] `grep -r "workspaceObservationClusters\|clusterId\|ClusterTags\|ClusterAffinityTags\|cluster_assigned\|cluster_affinity\|cluster_summary" --include="*.ts" db/ api/ apps/ packages/` returns no matches (excluding migration files)

#### Manual Verification:
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [ ] Dev server starts: `pnpm dev:console`
- [ ] Search endpoint works without cluster path (v1/search)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that migration applies and dev server runs.

---

## Phase 3: Dead Tables, Orphaned Schemas & Final Cleanup

### Overview
Drop dead tables, remove orphaned validation schemas from the simplification, and verify the pipeline end-to-end.

### Changes Required:

#### 1. Drop `workspaceTemporalStates` table (zero runtime consumers)
**Delete file**: `db/console/src/schema/tables/workspace-temporal-states.ts`

Remove from:
- `db/console/src/schema/relations.ts` — import (line 14), `temporalStates: many(workspaceTemporalStates)` on orgWorkspaces (line 54), `workspaceTemporalStatesRelations` block (lines 148-156)
- `db/console/src/schema/tables/index.ts` — re-exports of `TemporalEntityType`, `TemporalStateType`, `InsertWorkspaceTemporalState`, `WorkspaceTemporalState`, `workspaceTemporalStates` (lines 116-124)
- `db/console/src/schema/index.ts` — re-exports of `workspaceTemporalStatesRelations` (line 17), `TemporalEntityType`, `TemporalStateType` types (lines from tables re-export)
- `db/console/src/index.ts` — re-exports of table + relations

#### 2. Drop `workspaceOperationsMetrics` table (write-only, never read)
**Delete file**: `db/console/src/schema/tables/workspace-operations-metrics.ts`

Remove from:
- `db/console/src/schema/tables/index.ts` — re-exports of `ActorResolutionTags`, `ClusterAffinityTags`, `ClusterTags`, `DocumentsIndexedTags`, `EntityExtractionTags`, `ErrorTags`, `JobDurationTags`, `NeuralObservationTags`, `ProfileUpdateTags`, `InsertWorkspaceOperationMetric`, `OperationMetricTags`, `WorkspaceOperationMetric`, `workspaceOperationsMetrics` (lines 99-115)
- `db/console/src/schema/index.ts` — all metrics type re-exports
- `db/console/src/index.ts` — table + type re-exports
- `api/console/src/lib/jobs.ts` — delete the entire `recordJobMetric()` function and its type imports
- `api/console/src/inngest/workflow/neural/observation-capture.ts` — remove all `void recordJobMetric(...)` calls (6 call sites)
- `api/console/src/inngest/workflow/neural/profile-update.ts` — remove `recordJobMetric(...)` call
- `api/console/src/router/m2m/jobs.ts` — remove `recordJobMetric(...)` call
- `packages/console-validation/src/schemas/metrics.ts` — delete the entire file (all metric types are for this table)

#### 3. Clean up orphaned validation schemas
**File**: `packages/console-validation/src/schemas/workflow-io.ts`
**Changes**: Remove dead schemas for deleted workflows:
- `neuralClusterSummaryInputSchema` and its type (lines 30-34)
- `neuralLLMEntityExtractionInputSchema` and its type (lines 40-44)
- 6 output schemas: `NeuralClusterSummaryOutputSuccess/Skipped/Failure`, `NeuralLLMEntityExtractionOutputSuccess/Skipped/Failure` (lines 150-217)
- Remove from `workflowOutputSchema` union (lines 253-269)

**File**: `packages/console-validation/src/schemas/neural.ts`
**Changes**: Remove dead cluster schemas:
- `clusterAssignmentInputSchema` + `ClusterAssignmentInput` (lines 79-93)
- `clusterAssignmentResultSchema` + `ClusterAssignmentResult` (lines 96-104)
- `clusterSummarySchema` + `ClusterSummary` (lines 120-135)

**File**: `packages/console-config/src/neural.ts`
**Changes**: Delete `LLM_ENTITY_EXTRACTION_CONFIG` and `LLMEntityExtractionConfig` (entire file if nothing else in it). Remove re-export from `packages/console-config/src/index.ts`.

#### 4. Verify observation-capture.ts is clean
After all removals, verify:
- No references to `clusterId`, `clusterResult`, `assignToCluster`
- No references to `reconcileVercelActorsForCommit`
- No references to `llm-entity-extraction`
- No references to `recordJobMetric`
- `step.sendEvent("emit-events")` only emits: `observation.captured` and `profile.update`
- Store observation step doesn't write cluster-related fields

#### 5. Clean up on-failure-handler.ts
**File**: `api/console/src/inngest/workflow/neural/on-failure-handler.ts`
**Changes**: If JSDoc references deleted events, update the comments.

#### 6. Generate migration
```bash
cd db/console && pnpm db:generate
```

This will additionally generate drops for:
- `lightfast_workspace_temporal_states` table
- `lightfast_workspace_operations_metrics` table

Note: Combined with Phase 2, the single migration drops 6 tables total.

### Success Criteria:

#### Automated Verification:
- [x] Full typecheck passes: `pnpm typecheck`
- [x] Full lint passes: `pnpm check`
- [x] No orphaned imports: `pnpm check` catches unused imports
- [x] Build succeeds: `pnpm build:console`
- [x] `grep -r "workspaceTemporalStates\|workspaceOperationsMetrics\|recordJobMetric\|ClusterAssignmentInput\|ClusterSummary\|LLM_ENTITY_EXTRACTION_CONFIG" --include="*.ts" db/ api/ apps/ packages/` returns no matches (excluding migration files)

#### Manual Verification:
- [ ] Send a test webhook through relay → observe it flowing through the simplified pipeline
- [ ] Search works via v1/search endpoint (now 2-path: vector + entity)
- [ ] Verify no Inngest function registration errors in dev console

---

## Deletion Summary

### Files Deleted (17 files, ~2,800+ lines)
| File | Lines | What it did |
|------|-------|-------------|
| `api/console/src/inngest/workflow/neural/cluster-assignment.ts` | 300 | Cluster affinity scoring + assignment |
| `api/console/src/inngest/workflow/neural/cluster-summary.ts` | 315 | LLM-generated cluster summaries |
| `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts` | 277 | Async LLM entity extraction for rich content |
| `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts` | 42 | Helper for LLM entity extraction |
| `api/console/src/inngest/workflow/neural/actor-resolution.ts` | ~141 | Actor ID resolution from source events |
| `api/console/src/inngest/workflow/neural/profile-update.ts` | ~278 | Actor profile upsert workflow |
| `api/console/src/lib/actor-identity.ts` | ~65 | Org-level actor identity upsert |
| `api/console/src/lib/actor-linking.ts` | ~65 | Lazy Clerk user → actor linking |
| `apps/console/src/lib/neural/cluster-search.ts` | 97 | Pinecone centroid search for clusters |
| `apps/console/src/lib/neural/actor-search.ts` | ~160 | Actor profile search for search pipeline |
| `apps/console/src/components/actor-filter.tsx` | ~50 | Actor filter UI component |
| `db/console/src/schema/tables/workspace-observation-clusters.ts` | ~157 | Cluster table schema |
| `db/console/src/schema/tables/workspace-actor-profiles.ts` | ~140 | Actor profiles table schema |
| `db/console/src/schema/tables/org-actor-identities.ts` | ~100 | Org-level actor identities table schema |
| `db/console/src/schema/tables/workspace-temporal-states.ts` | ~193 | SCD Type 2 state history (never used) |
| `db/console/src/schema/tables/workspace-operations-metrics.ts` | ~210 | Write-only metrics table (never read) |
| `packages/console-validation/src/schemas/metrics.ts` | ~340 | All metric type schemas (consumers of dead table) |
| `packages/console-config/src/neural.ts` | ~35 | Dead LLM extraction config |

### Code Removed from Existing Files (~700+ lines)
| File | Lines removed | What |
|------|---------------|------|
| `observation-capture.ts` | ~300 | Cluster assignment, actor reconciliation, actor resolution step, extraction/profile events, all `recordJobMetric` calls |
| `jobs.ts` | ~100 | `recordJobMetric()` function + all metric type imports |
| `client.ts` | ~40 | 3 event schemas (cluster, LLM extraction, profile.update) + clusterId/clusterIsNew fields |
| `dispatch.ts` | ~3 | clusterId destructuring + Knock data |
| `four-path-search.ts` | ~60 | Cluster + actor search paths (4-path → 2-path) |
| `id-resolver.ts` | ~20 | clusterId from interface + all query results |
| `findsimilar.ts` | ~20 | clusterId + sameCluster logic |
| `config.ts` + `types.ts` | ~20 | hasClusters + hasActors queries + flags |
| `relations.ts` | ~40 | Cluster + actor profile + actor identity + temporal state relations |
| `workspace.ts` (router) | ~25 | ensureActorLinked call + getActors tRPC procedure |
| `search-filters.tsx` | ~10 | ActorFilter import + rendering |
| `workflow-io.ts` | ~90 | Dead cluster/LLM extraction/profile update workflow schemas |
| `neural.ts` (validation) | ~60 | Dead cluster + resolvedActor schemas |
| Various barrel exports | ~60 | Dead re-exports for 6 dropped tables through schema chain |
| `m2m/jobs.ts` | ~5 | `recordJobMetric` call |

### Total: ~3,500+ lines deleted/removed (6 tables dropped)

### What Remains
- `observation-capture.ts` (~900 lines): dedup → filter → significance → classify → embed → extract → store → link → emit
- `relationship-detection.ts` (494 lines): observation edge creation (necessary)
- `classification.ts` (225 lines), `entity-extraction-patterns.ts` (222 lines), `scoring.ts` (142 lines): pipeline helpers
- Two-path search: vector + entity
- Raw `actor` JSONB on observation row (fact from source — no resolution layer)

## References

- Architecture critique conversation: 2026-03-12
- Original monolith research: `thoughts/shared/research/2026-03-10-graph-linker-deep-dive.md`
- Multi-layer architecture doc (superseded by this simplification): `thoughts/shared/research/2026-03-10-multi-layer-event-graph-architecture.md`

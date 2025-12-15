# Skip Empty Search Paths Implementation Plan

## Overview

Add capability flags (`hasClusters`, `hasActors`) to the workspace config cache to conditionally skip cluster and actor search paths in `four-path-search.ts`. This optimization saves 15-70ms per request for workspaces that haven't created clusters or actors yet.

## Current State Analysis

### Problem
The four-path parallel search (`four-path-search.ts:390-443`) executes ALL 4 search paths unconditionally:
- **Vector search**: Always needed (core semantic search)
- **Entity search**: Always needed (fast pattern matching)
- **Cluster search**: Queries Pinecone even if workspace has no clusters
- **Actor search**: Queries database even if workspace has no actors

For new workspaces or workspaces without neural memory features enabled, cluster and actor searches waste 15-70ms total.

### Current Implementation
```typescript
// four-path-search.ts:390-443
const [vectorResults, entityResults, clusterResults, actorResults] = await Promise.all([
  // Path 1: Vector similarity search - ALWAYS NEEDED
  (async () => { ... })(),
  // Path 2: Entity search - ALWAYS NEEDED
  (async () => { ... })(),
  // Path 3: Cluster context search - WASTEFUL IF NO CLUSTERS
  (async () => { ... })(),
  // Path 4: Actor profile search - WASTEFUL IF NO ACTORS
  (async () => { ... })(),
]);
```

### Key Discoveries
- `CachedWorkspaceConfig` (`packages/console-workspace-cache/src/types.ts:5-10`) has no capability flags
- Cluster search hits Pinecone with `{ layer: { $eq: "clusters" } }` filter
- Actor search queries `workspaceActorIdentities` and `workspaceActorProfiles` tables
- No existing constants for empty results - uses inline `{ results: [], latency: 0 }`

## Desired End State

After implementation:
1. `CachedWorkspaceConfig` includes `hasClusters` and `hasActors` boolean flags
2. `four-path-search.ts` skips cluster/actor paths when flags are false
3. Cache is invalidated when first cluster or actor is created
4. Workspaces without clusters/actors see 15-70ms latency improvement

### Verification
- Run search on workspace with no clusters/actors - latency breakdown shows 0ms for skipped paths
- Create first cluster - subsequent searches include cluster path
- Create first actor - subsequent searches include actor path

## What We're NOT Doing

- **Not adding schema columns**: Capability flags are derived at cache-population time, not stored in DB
- **Not modifying ingestion pipelines**: Only adding cache invalidation calls
- **Not changing API contracts**: Search results structure unchanged
- **Not implementing embedding caching**: Deferred to post-launch per research doc

## Implementation Approach

Extend the existing workspace config cache with capability detection. Run count queries during cache population (adds ~10ms on cache miss, but cache hits are free). Invalidate cache when clusters/actors are created to ensure flags update.

---

## Phase 1: Extend CachedWorkspaceConfig Interface

### Overview
Add `hasClusters` and `hasActors` boolean fields to the cached workspace config type and population logic.

### Changes Required:

#### 1. Update Type Definition
**File**: `packages/console-workspace-cache/src/types.ts`
**Changes**: Add capability flags to interface

```typescript
/**
 * Cached workspace configuration for neural search operations.
 * Contains only the fields needed for Pinecone queries and embedding generation.
 */
export interface CachedWorkspaceConfig {
  indexName: string;
  namespaceName: string;
  embeddingModel: string;
  embeddingDim: number;
  // Capability flags for search path optimization
  hasClusters: boolean;
  hasActors: boolean;
}
```

#### 2. Update Cache Population Logic
**File**: `packages/console-workspace-cache/src/config.ts`
**Changes**: Add count queries during cache miss

```typescript
import { redis } from "@vendor/upstash";
import { db, sql } from "@db/console/client";
import { orgWorkspaces, workspaceObservationClusters, workspaceActorProfiles } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { getWorkspaceConfigCacheKey } from "./keys";
import type { CachedWorkspaceConfig } from "./types";

/** Cache TTL in seconds (1 hour - workspace config rarely changes) */
const CACHE_TTL_SECONDS = 3600;

// ... getCachedWorkspaceConfig stays the same ...

/**
 * Fetch workspace config directly from database.
 * Used on cache miss or as fallback on cache failure.
 *
 * Runs parallel queries for:
 * 1. Workspace settings (indexName, namespace, embedding config)
 * 2. Cluster count (capability detection)
 * 3. Actor count (capability detection)
 */
async function fetchWorkspaceConfigFromDB(
  workspaceId: string
): Promise<CachedWorkspaceConfig | null> {
  // Run all queries in parallel for efficiency
  const [workspace, clusterCountResult, actorCountResult] = await Promise.all([
    // 1. Workspace settings
    db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
      columns: {
        indexName: true,
        namespaceName: true,
        embeddingModel: true,
        embeddingDim: true,
      },
    }),
    // 2. Cluster count (just need to know if > 0)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceObservationClusters)
      .where(eq(workspaceObservationClusters.workspaceId, workspaceId))
      .limit(1),
    // 3. Actor count (just need to know if > 0)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceActorProfiles)
      .where(eq(workspaceActorProfiles.workspaceId, workspaceId))
      .limit(1),
  ]);

  if (!workspace?.indexName || !workspace.namespaceName) {
    return null;
  }

  const clusterCount = clusterCountResult[0]?.count ?? 0;
  const actorCount = actorCountResult[0]?.count ?? 0;

  return {
    indexName: workspace.indexName,
    namespaceName: workspace.namespaceName,
    embeddingModel: workspace.embeddingModel,
    embeddingDim: workspace.embeddingDim,
    hasClusters: clusterCount > 0,
    hasActors: actorCount > 0,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @repo/console-workspace-cache typecheck`
- [x] Package builds successfully: `pnpm --filter @repo/console-workspace-cache build`
- [x] Dependent packages build: `pnpm build:console`

#### Manual Verification:
- [ ] Cache miss populates `hasClusters` and `hasActors` correctly
- [ ] Existing cached values are invalidated (or TTL expires)

---

## Phase 2: Update Four-Path Search to Skip Empty Paths

### Overview
Modify the Promise.all in `four-path-search.ts` to conditionally skip cluster and actor searches based on capability flags.

### Changes Required:

#### 1. Add Empty Result Constants
**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Changes**: Add constants for empty path results (cleaner than inline objects)

```typescript
// Add after imports, before VECTOR ID NORMALIZATION section

// ============================================================================
// EMPTY RESULT CONSTANTS
// ============================================================================

/** Empty cluster result for skipped path */
const EMPTY_CLUSTER_RESULT = { results: [], latency: 0 } as const;

/** Empty actor result for skipped path */
const EMPTY_ACTOR_RESULT = { results: [], latency: 0 } as const;
```

#### 2. Modify Promise.all to Use Capability Flags
**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Changes**: Update lines 390-443 to conditionally execute cluster/actor paths

Replace the current Promise.all block with:

```typescript
  // 3. Execute 4-path parallel retrieval (skip empty paths)
  const pineconeFilter = buildPineconeFilter(filters);
  const parallelStart = Date.now();

  // Destructure capability flags from workspace config
  const { hasClusters, hasActors } = workspace;

  const [vectorResults, entityResults, clusterResults, actorResults] = await Promise.all([
    // Path 1: Vector similarity search (always execute)
    (async () => {
      const start = Date.now();
      try {
        const results = await pineconeClient.query<VectorMetadata>(
          indexName,
          {
            vector: queryVector,
            topK,
            includeMetadata: true,
            filter: pineconeFilter,
          },
          namespaceName
        );
        return { results, latency: Date.now() - start, success: true };
      } catch (error) {
        log.error("Vector search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
        return { results: { matches: [] }, latency: Date.now() - start, success: false };
      }
    })(),

    // Path 2: Entity search (always execute - fast pattern matching)
    (async () => {
      const start = Date.now();
      try {
        const results = await searchByEntities(query, workspaceId, topK);
        return { results, latency: Date.now() - start, success: true };
      } catch (error) {
        log.error("Entity search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
        return { results: [], latency: Date.now() - start, success: false };
      }
    })(),

    // Path 3: Cluster context search (skip if no clusters)
    hasClusters
      ? (async () => {
          try {
            return await searchClusters(workspaceId, indexName, namespaceName, queryVector, 3);
          } catch (error) {
            log.error("Cluster search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
            return EMPTY_CLUSTER_RESULT;
          }
        })()
      : Promise.resolve(EMPTY_CLUSTER_RESULT),

    // Path 4: Actor profile search (skip if no actors)
    hasActors
      ? (async () => {
          try {
            return await searchActorProfiles(workspaceId, query, 5);
          } catch (error) {
            log.error("Actor search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
            return EMPTY_ACTOR_RESULT;
          }
        })()
      : Promise.resolve(EMPTY_ACTOR_RESULT),
  ]);

  log.info("4-path parallel search complete", {
    requestId,
    totalLatency: Date.now() - parallelStart,
    vectorMatches: vectorResults.results.matches.length,
    entityMatches: entityResults.results.length,
    clusterMatches: clusterResults.results.length,
    actorMatches: actorResults.results.length,
    // Add skip indicators for observability
    clusterSkipped: !hasClusters,
    actorSkipped: !hasActors,
  });
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Console app builds: `pnpm build:console`
- [x] No lint errors: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] Search on workspace with no clusters/actors shows `clusterSkipped: true, actorSkipped: true` in logs
- [ ] Latency breakdown shows 0ms for skipped paths
- [ ] Search results unchanged (same candidates returned)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that searches work correctly before proceeding to Phase 3.

---

## Phase 3: Add Cache Invalidation Triggers

### Overview
Invalidate workspace config cache when the first cluster or actor is created, ensuring capability flags update promptly.

### Changes Required:

#### 1. Invalidate on Cluster Creation
**File**: `api/console/src/inngest/workflow/neural/cluster-assignment.ts`
**Changes**: Import and call `invalidateWorkspaceConfig` after creating a new cluster

Find the `createNewCluster` function (around line 175-230) and add invalidation:

```typescript
import { invalidateWorkspaceConfig } from "@repo/console-workspace-cache";

// Inside createNewCluster function, after successful insert:
// ... existing cluster creation code ...

// Invalidate workspace config cache so hasClusters flag updates
await invalidateWorkspaceConfig(workspaceId);

log.info("New cluster created, workspace config cache invalidated", {
  workspaceId,
  clusterId: newCluster.id,
});
```

#### 2. Invalidate on Actor Profile Creation
**File**: `api/console/src/inngest/workflow/neural/profile-update.ts`
**Changes**: Import and call `invalidateWorkspaceConfig` when creating a new actor profile

Find the upsert logic (around line 71-95) and add conditional invalidation:

```typescript
import { invalidateWorkspaceConfig } from "@repo/console-workspace-cache";

// Inside the profile update step, after the upsert:
// ... existing upsert code ...

// Check if this was an insert (new profile) vs update
// We can detect this by checking if observationCount was 1 (first observation for this actor)
if (updatedProfile.observationCount === 1) {
  // First profile for this actor - might be first actor in workspace
  // Invalidate to update hasActors flag
  await invalidateWorkspaceConfig(workspaceId);

  log.info("New actor profile created, workspace config cache invalidated", {
    workspaceId,
    actorId: updatedProfile.actorId,
  });
}
```

**Note**: This is a conservative approach - we invalidate on every new actor profile creation. Since profile creation is infrequent (only on first observation per actor), this won't cause cache thrashing.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @api/console typecheck`
- [x] API package builds: `pnpm --filter @api/console build`
- [x] No lint errors in modified files (pre-existing lint errors in package)

#### Manual Verification:
- [ ] Create observation that triggers new cluster - cache is invalidated
- [ ] Create observation from new actor - cache is invalidated
- [ ] Subsequent search includes cluster/actor paths after invalidation

---

## Testing Strategy

### Unit Tests
- Mock `getCachedWorkspaceConfig` to return configs with different capability flags
- Verify `fourPathParallelSearch` skips paths when flags are false
- Verify correct results returned regardless of path execution

### Integration Tests
- Search on empty workspace: verify cluster/actor paths skipped
- Create cluster: verify next search includes cluster path
- Create actor: verify next search includes actor path

### Manual Testing Steps
1. Find or create a workspace with no clusters/actors
2. Run search, check logs for `clusterSkipped: true, actorSkipped: true`
3. Trigger observation capture that creates a cluster
4. Run search again, check logs for `clusterSkipped: false`
5. Verify latency improvement in `latency.cluster` and `latency.actor` fields

## Performance Considerations

### Cache Miss Overhead
- Adding 2 count queries adds ~10ms to cache miss path
- Cache hits (99%+ of requests) have zero overhead
- Count queries use indexed `workspaceId` column - very fast

### Memory Impact
- Adding 2 boolean fields to cached config: negligible
- No increase in cache key count

### Expected Latency Improvement
| Scenario | Current | After | Savings |
|----------|---------|-------|---------|
| No clusters, no actors | 70ms | 0ms | 70ms |
| Has clusters, no actors | 35ms | 0ms | 35ms |
| No clusters, has actors | 35ms | 0ms | 35ms |
| Has clusters and actors | 0ms | 0ms | 0ms |

## Migration Notes

- No database schema changes required
- Existing cached configs will be missing new fields
- On first access after deployment, cache miss will populate new fields
- No backfill needed - cache naturally updates within 1 hour (TTL)

## References

- Research document: `thoughts/shared/research/2025-12-15-v1-route-optimization-integration-analysis.md`
- Workspace cache package: `packages/console-workspace-cache/`
- Four-path search: `apps/console/src/lib/neural/four-path-search.ts:390-443`
- Cluster assignment workflow: `api/console/src/inngest/workflow/neural/cluster-assignment.ts`
- Profile update workflow: `api/console/src/inngest/workflow/neural/profile-update.ts`

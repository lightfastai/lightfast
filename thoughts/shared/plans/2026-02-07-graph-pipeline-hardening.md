# Graph Pipeline Hardening Implementation Plan

## Overview

Harden the graph pipeline end-to-end by fixing the critical write-ordering vulnerability, adding proper error codes, improving agent error recovery, validating embeddings, filtering orphaned vectors from search results, and enriching graph API responses. This plan covers all P0 fixes and key P1 improvements from the [architecture design](../research/2026-02-07-graph-pipeline-architecture-design.md).

## Current State Analysis

The observation capture pipeline (`webhook → transformer → Inngest → embedding → Pinecone → DB → relationships`) has a critical ordering vulnerability where Pinecone vectors are upserted **before** the DB record is created. This creates orphaned vectors when DB inserts fail, causing "Observation not found" errors when the agent traverses the graph. The graph/related APIs return 500 errors instead of 404s, preventing the agent from recovering gracefully.

### Key Discoveries:
- **Write ordering bug**: `observation-capture.ts` Step 6 (line 852) upserts to Pinecone, Step 7 (line 922) inserts to DB. If Step 7 fails, orphaned Pinecone vectors exist with valid `observationId` metadata pointing to non-existent DB records
- **No custom error classes**: All logic functions throw generic `Error`, caught as 500 by route handlers (`graph.ts:77`, `related.ts:66`)
- **`ErrorCode` enum exists**: `packages/console-types/src/error.ts:8-15` has standard codes but no `NOT_FOUND` code
- **No dimension validation**: Embedding dimensions are not checked before Pinecone upsert (`observation-capture.ts:731-733` only checks presence)
- **Phase 3 metadata trusts Pinecone**: `normalizeVectorIds` in `four-path-search.ts:110-124` extracts `observationId` from Pinecone metadata without verifying DB existence
- **Graph edges missing `linkingKeyType`**: `graph.ts:147-153` returns `linkingKey` but not `linkingKeyType`, though the DB column exists
- **Agent tool handlers have no try-catch**: `route.ts:147-175` calls `graphLogic`/`relatedLogic` directly, errors propagate to top-level `onError`

## Desired End State

After this plan is complete:

1. **DB is always written before Pinecone** — orphaned vectors cannot be created during normal operation
2. **Embedding dimensions are validated** before Pinecone upsert, catching configuration errors at ingestion time
3. **Graph/related APIs return 404** for missing observations instead of 500
4. **Agent receives actionable error messages** with `suggestedAction` field when observations aren't found
5. **Search results are guaranteed valid** — `normalizeVectorIds` filters out observations that don't exist in DB
6. **Graph edges include `linkingKeyType`** so the agent can explain WHY observations are connected

### Verification:
- `pnpm lint && pnpm typecheck` passes
- `pnpm build:console` succeeds
- Manual: Trigger sandbox data load → search → graph traversal produces no 500 errors
- Manual: Query graph with non-existent observation ID → returns 404 with helpful message
- Manual: Capture workflow succeeds end-to-end with DB record created before Pinecone vector

## What We're NOT Doing

- **Orphaned vector reconciliation job** (P1.1) — deferred, write reorder + existence check eliminates the primary cause
- **Relationship backfill** (P1.3) — deferred, requires a new scheduled Inngest function
- **Entity-based graph entry point** (P2.1) — deferred, new endpoint
- **Graph-augmented search / 5th path** (P2.4) — deferred, significant search pipeline change
- **Temporal edge invalidation** (P2.5) — deferred, requires DB migration
- **Neo4j or dedicated graph DB** — confirmed not needed at current scale

## Implementation Approach

We implement in 4 phases, each independently deployable and testable. Phase 1 (error infrastructure) is the foundation. Phase 2 (pipeline hardening) fixes the root cause. Phase 3 (search resilience) adds defense-in-depth. Phase 4 (graph enrichment) improves agent experience.

---

## Phase 1: Error Infrastructure

### Overview
Add a `NotFoundError` class and `NOT_FOUND` error code, update graph/related route handlers to return 404, and add workspaceId to error logs. This is the foundation that all subsequent phases build on.

### Changes Required:

#### 1. Add `NOT_FOUND` to ErrorCode enum and create `NotFoundError` class
**File**: `packages/console-types/src/error.ts`
**Changes**: Add `NOT_FOUND` to `ErrorCode` enum and export a `NotFoundError` class.

```typescript
export enum ErrorCode {
  INVALID_REQUEST = "INVALID_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  NOT_FOUND = "NOT_FOUND",
  STORE_NOT_FOUND = "STORE_NOT_FOUND",
  WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Typed error for resources that don't exist.
 * Route handlers should catch this and return 404.
 */
export class NotFoundError extends Error {
  readonly code = ErrorCode.NOT_FOUND;

  constructor(
    public readonly resource: string,
    public readonly resourceId: string,
  ) {
    super(`${resource} not found: ${resourceId}`);
    this.name = "NotFoundError";
  }
}
```

#### 2. Update `graphLogic` to throw `NotFoundError` and log workspaceId
**File**: `apps/console/src/lib/v1/graph.ts`
**Changes**: Import `NotFoundError`, replace generic Error throw at line 77, add workspaceId to log, add `linkingKeyType` to edge type.

Replace line 76-78:
```typescript
// Before:
if (!rootObs) {
  throw new Error(`Observation not found: ${input.observationId}`);
}

// After:
if (!rootObs) {
  log.warn("Graph query - observation not found", {
    observationId: input.observationId,
    workspaceId: auth.workspaceId,
    requestId: input.requestId,
  });
  throw new NotFoundError("Observation", input.observationId);
}
```

Update `GraphLogicOutput` edge type (line 34-40) to include `linkingKeyType`:
```typescript
edges: {
  source: string;
  target: string;
  type: string;
  linkingKey: string | null;
  linkingKeyType: string | null;
  confidence: number;
}[];
```

Update edge push (line 147-153) to include `linkingKeyType`:
```typescript
edges.push({
  source: sourceNode.externalId,
  target: targetNode.externalId,
  type: rel.relationshipType,
  linkingKey: rel.linkingKey,
  linkingKeyType: rel.linkingKeyType,
  confidence: rel.confidence,
});
```

#### 3. Update `relatedLogic` to throw `NotFoundError` and log workspaceId
**File**: `apps/console/src/lib/v1/related.ts`
**Changes**: Import `NotFoundError`, replace generic Error throw at line 66.

Replace line 65-67:
```typescript
// Before:
if (!sourceObs) {
  throw new Error(`Observation not found: ${input.observationId}`);
}

// After:
if (!sourceObs) {
  log.warn("Related query - observation not found", {
    observationId: input.observationId,
    workspaceId: auth.workspaceId,
    requestId: input.requestId,
  });
  throw new NotFoundError("Observation", input.observationId);
}
```

#### 4. Update graph route handler to catch `NotFoundError` → 404
**File**: `apps/console/src/app/(api)/v1/graph/[id]/route.ts`
**Changes**: Import `NotFoundError`, add specific catch before generic catch.

Replace catch block (lines 66-80):
```typescript
} catch (error) {
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: error.message,
        requestId,
      },
      { status: 404 }
    );
  }

  log.error("v1/graph error", {
    requestId,
    error: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    {
      error: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Graph traversal failed",
      requestId,
    },
    { status: 500 }
  );
}
```

#### 5. Update related route handler to catch `NotFoundError` → 404
**File**: `apps/console/src/app/(api)/v1/related/[id]/route.ts`
**Changes**: Import `NotFoundError`, add specific catch before generic catch.

Replace catch block (lines 56-70):
```typescript
} catch (error) {
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: error.message,
        requestId,
      },
      { status: 404 }
    );
  }

  log.error("v1/related error", {
    requestId,
    error: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    {
      error: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Related lookup failed",
      requestId,
    },
    { status: 500 }
  );
}
```

#### 6. Update agent tool handlers with try-catch and actionable error messages
**File**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`
**Changes**: Wrap `workspaceGraph` and `workspaceRelated` handlers in try-catch.

Replace `workspaceGraph` handler (lines 147-161):
```typescript
workspaceGraph: {
  handler: async (input) => {
    try {
      return await graphLogic(
        {
          workspaceId: authData.workspaceId,
          userId: authData.userId,
          authType: "session",
        },
        {
          observationId: input.id,
          depth: input.depth ?? 1,
          requestId: randomUUID(),
        },
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        return {
          error: "not_found",
          message: `Observation ${input.id} was not found. It may have been deleted or not yet ingested. Try searching for the topic instead using workspaceSearch.`,
          suggestedAction: "workspaceSearch",
        };
      }
      throw error;
    }
  },
},
```

Replace `workspaceRelated` handler (lines 162-175):
```typescript
workspaceRelated: {
  handler: async (input) => {
    try {
      return await relatedLogic(
        {
          workspaceId: authData.workspaceId,
          userId: authData.userId,
          authType: "session",
        },
        {
          observationId: input.id,
          requestId: randomUUID(),
        },
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        return {
          error: "not_found",
          message: `Observation ${input.id} was not found. It may have been deleted or not yet ingested. Try searching for the topic instead using workspaceSearch.`,
          suggestedAction: "workspaceSearch",
        };
      }
      throw error;
    }
  },
},
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (pre-existing failures in unrelated packages)
- [x] Console builds: `pnpm build:console` (pre-existing 500.html export artifact failure)

#### Manual Verification:
- [ ] `GET /v1/graph/nonexistent-id` returns `{ "error": "NOT_FOUND", "message": "Observation not found: nonexistent-id" }` with status 404
- [ ] `GET /v1/related/nonexistent-id` returns `{ "error": "NOT_FOUND", "message": "Observation not found: nonexistent-id" }` with status 404
- [ ] Agent calling `workspaceGraph` with stale ID gets helpful message suggesting `workspaceSearch`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Pipeline Write Ordering & Dimension Validation

### Overview
Swap the Pinecone upsert and DB insert steps in the observation capture workflow so DB is written first (source of truth), and add embedding dimension validation before Pinecone upsert.

### Changes Required:

#### 1. Reorder steps: DB insert before Pinecone upsert
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Move the `"store-observation"` step (currently lines 922-1000) BEFORE the `"upsert-multi-view-vectors"` step (currently lines 852-918). The relationship detection step stays after both.

The new ordering becomes:
```
Step 5.5: assign-cluster (unchanged)
Step 6:   store-observation (was Step 7 — DB insert FIRST, source of truth)
Step 7:   upsert-multi-view-vectors (was Step 6 — Pinecone upsert SECOND, derived index)
Step 7.5: detect-relationships (unchanged, still needs observation.id from DB)
```

Concretely, cut lines 922-1000 (the `store-observation` step) and paste them where lines 852-918 (the `upsert-multi-view-vectors` step) currently starts. Then place the `upsert-multi-view-vectors` step after `store-observation`.

Update the step comments to reflect new numbering:
```typescript
// Step 6: Store observation + entities (transactional) — SOURCE OF TRUTH
// DB record is created first. If Pinecone upsert fails, observation exists but
// isn't searchable — a safe failure mode that Inngest retries will resolve.
const { observation, entitiesStored } = await step.run("store-observation", async () => {
  // ... existing code unchanged ...
});

// Step 7: Upsert multi-view vectors to Pinecone — DERIVED INDEX
// If this fails, observation exists in DB but isn't searchable.
// Inngest retries will attempt the upsert again. No orphaned vectors.
await step.run("upsert-multi-view-vectors", async () => {
  // ... existing code unchanged ...
});
```

**Important**: The `detect-relationships` step (line 1004) already uses `observation.id` from the `store-observation` result. Since `store-observation` now runs before Pinecone upsert, this dependency is preserved.

#### 2. Add embedding dimension validation
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Add dimension validation after embedding generation (line 731-733), before the vectors are used.

After the existing null check (line 731-733), add:
```typescript
if (!result.embeddings[0] || !result.embeddings[1] || !result.embeddings[2]) {
  throw new Error("Failed to generate all multi-view embeddings");
}

// Validate embedding dimensions match workspace config
const expectedDim = workspace.settings.embedding.embeddingDim;
for (const [viewName, embedding] of [
  ["title", result.embeddings[0]],
  ["content", result.embeddings[1]],
  ["summary", result.embeddings[2]],
] as const) {
  if (embedding.length !== expectedDim) {
    throw new NonRetriableError(
      `Embedding dimension mismatch for ${viewName}: got ${embedding.length}, expected ${expectedDim}. Check embedding model configuration.`
    );
  }
}
```

Note: `NonRetriableError` is already imported from `inngest` at the top of the file (used elsewhere in the workflow). This prevents Inngest from retrying a configuration error.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (pre-existing failures in unrelated packages)
- [x] Console API builds: `pnpm --filter @api/console build` (typecheck passes)

#### Manual Verification:
- [ ] Trigger a webhook event → observe Inngest dashboard → verify `store-observation` step runs before `upsert-multi-view-vectors`
- [ ] All 3 steps (store → upsert → detect-relationships) complete successfully
- [ ] The observation is searchable via `workspaceSearch` after pipeline completes
- [ ] Relationships are correctly detected for the observation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Search Resilience — Existence Check in normalizeVectorIds

### Overview
Add a lightweight DB existence check in `normalizeVectorIds` for Phase 3 (metadata-based) observation IDs before returning them as search results. This eliminates the entire class of "Observation not found" errors from orphaned vectors, providing defense-in-depth alongside the write reorder.

### Changes Required:

#### 1. Add batch existence check for Phase 3 observation IDs
**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Changes**: After Phase 3 observations are collected (line 124, after the `for` loop), verify their existence in DB before proceeding.

After line 124 (`}` closing the Phase 3 for-loop), before the legacy path at line 126, add:
```typescript
// Verify Phase 3 observation IDs exist in DB (defense against orphaned Pinecone vectors)
if (withObsId.length > 0) {
  const phase3ObsIds = Array.from(
    new Set(withObsId.map((m) => (m.metadata as Record<string, unknown>).observationId as string))
  );

  const existingObs = await db
    .select({ externalId: workspaceNeuralObservations.externalId })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        inArray(workspaceNeuralObservations.externalId, phase3ObsIds)
      )
    );

  const existingSet = new Set(existingObs.map((r) => r.externalId));
  const orphanedCount = phase3ObsIds.length - existingSet.size;

  if (orphanedCount > 0) {
    log.warn("Orphaned Pinecone vectors detected", {
      requestId,
      orphanedCount,
      totalPhase3: phase3ObsIds.length,
    });

    // Remove orphaned entries from obsGroups
    for (const obsId of phase3ObsIds) {
      if (!existingSet.has(obsId)) {
        obsGroups.delete(obsId);
      }
    }
  }
}
```

**Trade-off**: Adds ~5-10ms DB query (batch select with indexed `externalId` column) to search path. Eliminates all downstream "Observation not found" errors from orphaned Pinecone vectors.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (pre-existing failures in unrelated packages)
- [x] Console builds: `pnpm build:console` (typecheck passes)

#### Manual Verification:
- [ ] Search results only contain observations that exist in the database
- [ ] Log message "Orphaned Pinecone vectors detected" appears if orphans exist (can verify by checking logs after a search)
- [ ] Search latency increase is negligible (< 10ms)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Graph Edge Enrichment — Add `linkingKeyType`

### Overview
Include `linkingKeyType` in graph edge responses so the agent can explain WHY two observations are connected (e.g., "linked via commit SHA" vs "linked via issue ID").

### Changes Required:

This is already included in Phase 1 (step 2) as part of the `graph.ts` changes. The changes are:

1. Update `GraphLogicOutput` edge type to include `linkingKeyType: string | null`
2. Add `linkingKeyType: rel.linkingKeyType` to the edge push at line 152

No additional changes needed beyond Phase 1.

### Success Criteria:

#### Automated Verification:
- [x] (Already covered by Phase 1 verification)

#### Manual Verification:
- [ ] `GET /v1/graph/{id}` response edges include `linkingKeyType` field (e.g., `"linkingKeyType": "commit"`)
- [ ] Agent can reference `linkingKeyType` when explaining observation relationships

---

## Testing Strategy

### Unit Tests:
- No existing unit test files for `graph.ts`, `related.ts`, or `observation-capture.ts` — these are tested via integration tests and the Inngest dashboard

### Integration Tests:
- Trigger sandbox data load → wait for ingestion → search → graph traversal should work end-to-end without 500 errors
- Query graph/related with non-existent observation IDs → should return 404

### Manual Testing Steps:
1. Deploy Phase 1 → call `GET /v1/graph/fake-id` → verify 404 response
2. Deploy Phase 2 → trigger webhook → check Inngest step ordering in dashboard
3. Deploy Phase 3 → run search → verify no orphaned observation IDs in results
4. Deploy Phase 4 → call `GET /v1/graph/{valid-id}` → verify edges have `linkingKeyType`

## Performance Considerations

- **Phase 2 (write reorder)**: No performance impact — same steps, different order
- **Phase 2 (dimension validation)**: Negligible — 3 array length checks per observation
- **Phase 3 (existence check)**: ~5-10ms added to search path (single indexed batch query). Acceptable trade-off for eliminating "Observation not found" errors entirely

## Migration Notes

- **No database migrations required** — all changes are code-level
- **Backwards compatible** — `linkingKeyType` is added to API response, doesn't break existing consumers
- **Zero downtime** — all phases can be deployed independently with no rollback risk
- **Inngest step name stability** — Inngest uses step names for idempotency. We are NOT renaming steps, only reordering them. In-flight workflows at deploy time will complete with the old ordering; new workflows use the new ordering

## Rollback Plan

All changes are individually reversible:
- **Phase 1**: Revert error handling changes (no data impact)
- **Phase 2**: Swap steps back to original order
- **Phase 3**: Remove existence check from `normalizeVectorIds`
- **Phase 4**: Remove `linkingKeyType` from edge response

No database migrations to rollback.

## References

- Architecture design: `thoughts/shared/research/2026-02-07-graph-pipeline-architecture-design.md`
- External research: `thoughts/shared/research/2026-02-07-graph-pipeline-external-research.md`
- Codebase deep dive: `thoughts/shared/research/2026-02-07-graph-pipeline-codebase-deep-dive.md`

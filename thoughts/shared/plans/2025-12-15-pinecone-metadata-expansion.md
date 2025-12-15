# Pinecone Metadata Expansion Implementation Plan

## Overview

Expand Pinecone vector metadata to include pre-computed `url` and `entities` fields, enabling fast-mode search responses without database enrichment queries. This optimization eliminates 15-40ms of DB latency for fast mode searches.

## Current State Analysis

### Ingestion Pipeline

**Location**: `api/console/src/inngest/workflow/neural/observation-capture.ts:477-546`

Current observation vector metadata stored in Pinecone:
```typescript
interface ObservationVectorMetadata {
  layer: string;
  view: "title" | "content" | "summary";
  observationType: string;
  source: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  occurredAt: string;
  actorName: string;
  observationId: string;
}
```

**Missing fields for fast-mode enrichment:**
- `url`: Pre-computed source URL
- `entities`: Top entity keys for display (max 5)

### URL Building Infrastructure

**Exists**: `apps/console/src/lib/neural/url-builder.ts:17-36`
- `buildSourceUrl(source, sourceId, metadata)` handles GitHub, Vercel, Linear sources
- Already imported by other files but **not used during ingestion**

### Entity Extraction

**Location**: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`
- Entities are already extracted in step 5 of the workflow
- `extractedEntities` is available at the vector upsert step (line 477)
- Need to serialize top 5 entity keys into metadata

### Search Enrichment

**Location**: `apps/console/src/lib/neural/four-path-search.ts:541-639`

Current `enrichSearchResults()`:
1. Queries `workspaceNeuralObservations` by externalId (~10-30ms)
2. Queries `workspaceNeuralEntities` by internal observation IDs (~5-15ms)
3. Builds URL from observation metadata

**Opportunity**: Skip both queries for vectors with pre-computed metadata.

## Desired End State

After implementation:
1. New observations have `url` and `entities` in Pinecone metadata
2. Fast-mode search skips DB enrichment and uses metadata directly
3. Legacy observations (without new metadata) fall back to DB enrichment
4. Latency savings: 15-40ms for fast-mode searches

### Success Verification

```bash
# After deploying, verify metadata in Pinecone (via Pinecone Console):
# 1. Navigate to index → namespace → Browse
# 2. Find a recent observation vector
# 3. Verify metadata contains: url, entities fields

# Latency verification (via console logs):
# Look for: "enrichSearchResults skipped (fast mode with metadata)"
# vs: "enrichSearchResults completed in Xms"
```

## What We're NOT Doing

- **Backfilling existing observations**: Legacy vectors without `url`/`entities` continue to work via DB enrichment
- **Changing API response format**: Output remains identical
- **Modifying entity extraction logic**: We only serialize existing extraction results
- **Adding new entity types**: Using existing entity keys only

## Implementation Approach

The changes are additive and backwards-compatible:
1. Extend metadata interface with optional `url` and `entities` fields
2. Compute URL and top entities during ingestion
3. Add fast-path in `enrichSearchResults()` to use metadata when available
4. Test with new observations while legacy observations continue working

---

## Phase 1: Extend Metadata Interface

### Overview

Add `url` and `entities` fields to the Pinecone metadata interface.

### Changes Required

#### 1. Update ObservationVectorMetadata Interface

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Location**: Lines 44-60

**Current code:**
```typescript
interface ObservationVectorMetadata {
  layer: string;
  view: "title" | "content" | "summary";
  observationType: string;
  source: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  occurredAt: string;
  actorName: string;
  observationId: string;
  [key: string]: string | number | boolean | string[];
}
```

**New code:**
```typescript
interface ObservationVectorMetadata {
  layer: string;
  view: "title" | "content" | "summary";
  observationType: string;
  source: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  occurredAt: string;
  actorName: string;
  observationId: string;
  /** Pre-computed source URL (Phase 6 optimization) */
  url: string;
  /** Top entity keys for fast-mode display (max 5) */
  entities: string[];
  [key: string]: string | number | boolean | string[];
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles without errors: `pnpm --filter @api/console build`
- [ ] Existing tests pass: `pnpm --filter @api/console test`

#### Manual Verification:
- [ ] Interface change is purely additive (no breaking changes)

**Implementation Note**: This phase is purely a type change. Proceed to Phase 2 immediately.

---

## Phase 2: Compute Metadata During Ingestion

### Overview

Add URL computation and entity serialization to the observation capture workflow.

### Changes Required

#### 1. Import URL Builder

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Location**: After line 38 (imports section)

**Add:**
```typescript
import { buildSourceUrl } from "@/lib/neural/url-builder";
```

**Note**: Need to check if the `@/` alias works from the API package. May need to use relative import or re-export from a shared package.

#### 2. Alternative: Copy URL Builder Logic

If import path doesn't work, create a local utility:

**File**: `api/console/src/inngest/workflow/neural/url-builder.ts`

Copy the `buildSourceUrl` function from `apps/console/src/lib/neural/url-builder.ts`. This is acceptable because:
- The function has no dependencies
- Keeps the workflow self-contained
- Avoids cross-package import complexity

#### 3. Compute URL and Entities in Base Metadata

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Location**: Lines 483-496 (inside `upsert-multi-view-vectors` step)

**Current code (lines 483-496):**
```typescript
// Base metadata shared across all views
const baseMetadata = {
  layer: "observations",
  observationType: deriveObservationType(sourceEvent),
  source: sourceEvent.source,
  sourceType: sourceEvent.sourceType,
  sourceId: sourceEvent.sourceId,
  occurredAt: sourceEvent.occurredAt,
  actorName: sourceEvent.actor?.name || "unknown",
  observationId: externalId,
};
```

**New code:**
```typescript
// Pre-compute URL from source metadata (Phase 6 optimization)
const url = buildSourceUrl(
  sourceEvent.source,
  sourceEvent.sourceId,
  sourceEvent.metadata as Record<string, unknown>
);

// Serialize top 5 entity keys for fast-mode display
// Prioritize high-confidence entities (already sorted by extraction)
const topEntityKeys = extractedEntities
  .slice(0, 5)
  .map((e) => e.key);

// Base metadata shared across all views
const baseMetadata = {
  layer: "observations",
  observationType: deriveObservationType(sourceEvent),
  source: sourceEvent.source,
  sourceType: sourceEvent.sourceType,
  sourceId: sourceEvent.sourceId,
  occurredAt: sourceEvent.occurredAt,
  actorName: sourceEvent.actor?.name || "unknown",
  observationId: externalId,
  // Phase 6: Pre-computed enrichment data
  url,
  entities: topEntityKeys,
};
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @api/console build`
- [ ] Unit tests pass: `pnpm --filter @api/console test`
- [ ] Lint passes: `pnpm --filter @api/console lint`

#### Manual Verification:
- [ ] Trigger a test webhook (GitHub PR event)
- [ ] Check Pinecone console for the new vector
- [ ] Verify `url` and `entities` fields in metadata
- [ ] Verify URL is correctly formatted for the source type

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that metadata appears correctly in Pinecone before proceeding to Phase 3.

---

## Phase 3: Add Fast-Path in Search Enrichment

### Overview

Skip database queries when Pinecone metadata contains enrichment data.

### Changes Required

#### 1. Update enrichSearchResults Function

**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Location**: Lines 541-639

**New implementation:**

```typescript
/**
 * Enrich reranked results with full metadata from database
 *
 * Optimizations:
 * - Phase 6: If metadata contains url and entities, skip DB queries entirely
 * - Parallel queries with Promise.all (vs sequential)
 * - Skips content column (uses candidate snippet from Pinecone instead)
 */
export async function enrichSearchResults(
  results: { id: string; score: number }[],
  candidates: FilterCandidate[],
  workspaceId: string,
  options?: { useFastPath?: boolean }
): Promise<EnrichedResult[]> {
  if (results.length === 0) {
    return [];
  }

  const resultIds = results.map((r) => r.id);

  // Build candidate map for O(1) lookup
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  // Phase 6: Fast path - use Pinecone metadata if available
  if (options?.useFastPath) {
    const fastResults: EnrichedResult[] = [];
    const needsDbEnrichment: { id: string; score: number }[] = [];

    for (const r of results) {
      const candidate = candidateMap.get(r.id);
      const metadata = candidate?.metadata as Record<string, unknown> | undefined;

      // Check if metadata has Phase 6 fields
      if (
        metadata &&
        typeof metadata.url === "string" &&
        Array.isArray(metadata.entities)
      ) {
        // Fast path: use metadata directly
        fastResults.push({
          id: r.id,
          title: candidate?.title ?? "",
          url: metadata.url,
          snippet: candidate?.snippet ?? "",
          score: r.score,
          source: typeof metadata.source === "string" ? metadata.source : "unknown",
          type: typeof metadata.observationType === "string" ? metadata.observationType : "unknown",
          occurredAt: typeof metadata.occurredAt === "string" ? metadata.occurredAt : null,
          entities: (metadata.entities as string[]).map((key) => ({
            key,
            category: "unknown", // Category not stored in metadata
          })),
        });
      } else {
        // Needs DB enrichment
        needsDbEnrichment.push(r);
      }
    }

    // If all results used fast path, return early
    if (needsDbEnrichment.length === 0) {
      log.info("enrichSearchResults fast path", {
        total: results.length,
        fastPath: fastResults.length,
      });
      return fastResults.sort((a, b) => b.score - a.score);
    }

    // Mixed: some fast, some need DB
    // Continue with DB enrichment for remaining results
    log.info("enrichSearchResults mixed path", {
      total: results.length,
      fastPath: fastResults.length,
      dbPath: needsDbEnrichment.length,
    });

    const dbResults = await enrichFromDatabase(
      needsDbEnrichment,
      candidateMap,
      workspaceId
    );

    return [...fastResults, ...dbResults].sort((a, b) => b.score - a.score);
  }

  // Standard path: DB enrichment
  return enrichFromDatabase(results, candidateMap, workspaceId);
}

/**
 * Enrich results from database (extracted for reuse)
 */
async function enrichFromDatabase(
  results: { id: string; score: number }[],
  candidateMap: Map<string, FilterCandidate>,
  workspaceId: string
): Promise<EnrichedResult[]> {
  if (results.length === 0) {
    return [];
  }

  const resultIds = results.map((r) => r.id);

  // Fetch observations first, then entities using internal IDs
  const observations = await db
    .select({
      id: workspaceNeuralObservations.id,
      externalId: workspaceNeuralObservations.externalId,
      title: workspaceNeuralObservations.title,
      source: workspaceNeuralObservations.source,
      observationType: workspaceNeuralObservations.observationType,
      occurredAt: workspaceNeuralObservations.occurredAt,
      metadata: workspaceNeuralObservations.metadata,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        inArray(workspaceNeuralObservations.externalId, resultIds)
      )
    );

  // Get internal IDs for entity query
  const internalObsIds = observations.map((o) => o.id);

  // Query entities using internal BIGINT IDs
  const entities = internalObsIds.length > 0
    ? await db
        .select({
          observationId: workspaceNeuralEntities.sourceObservationId,
          key: workspaceNeuralEntities.key,
          category: workspaceNeuralEntities.category,
        })
        .from(workspaceNeuralEntities)
        .where(
          and(
            eq(workspaceNeuralEntities.workspaceId, workspaceId),
            inArray(workspaceNeuralEntities.sourceObservationId, internalObsIds)
          )
        )
    : [];

  // Build internal ID to externalId map for entity grouping
  const internalToExternalMap = new Map(observations.map((o) => [o.id, o.externalId]));

  // Group entities by externalId
  const entityMap = new Map<string, { key: string; category: string }[]>();
  for (const entity of entities) {
    if (entity.observationId !== null) {
      const externalId = internalToExternalMap.get(entity.observationId);
      if (externalId) {
        const existing = entityMap.get(externalId) ?? [];
        existing.push({ key: entity.key, category: entity.category });
        entityMap.set(externalId, existing);
      }
    }
  }

  // Build observation map keyed by externalId
  const observationMap = new Map(observations.map((o) => [o.externalId, o]));

  // Map results with enrichment
  return results.map((r) => {
    const obs = observationMap.get(r.id);
    const candidate = candidateMap.get(r.id);

    // Extract URL from metadata if available
    const metadata = obs?.metadata as Record<string, unknown> | undefined;
    const metadataUrl = metadata?.url;
    const url = typeof metadataUrl === "string" ? metadataUrl : "";

    // Use candidate snippet from Pinecone
    const snippet = candidate?.snippet ?? "";

    return {
      id: r.id,
      title: obs?.title ?? candidate?.title ?? "",
      url,
      snippet,
      score: r.score,
      source: obs?.source ?? "unknown",
      type: obs?.observationType ?? "unknown",
      occurredAt: obs?.occurredAt ?? null,
      entities: entityMap.get(r.id) ?? [],
    };
  });
}
```

#### 2. Update FilterCandidate Type

**File**: `apps/console/src/lib/neural/llm-filter.ts` (or wherever FilterCandidate is defined)

Need to ensure `FilterCandidate` can carry metadata:

```typescript
export interface FilterCandidate {
  id: string;
  title: string;
  snippet: string;
  score: number;
  metadata?: VectorMetadata; // Add this if not present
}
```

#### 3. Pass Metadata Through mergeSearchResults

**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Location**: Lines 302-343

Update `mergeSearchResults` to preserve metadata:

```typescript
function mergeSearchResults(
  normalizedVectorResults: NormalizedVectorResult[],
  entityResults: EntitySearchResult[],
  limit: number
): FilterCandidate[] {
  const resultMap = new Map<string, FilterCandidate>();

  // Add normalized vector results with metadata
  for (const result of normalizedVectorResults) {
    resultMap.set(result.observationId, {
      id: result.observationId,
      title: String(result.metadata?.title ?? ""),
      snippet: String(result.metadata?.snippet ?? ""),
      score: result.score,
      metadata: result.metadata, // Preserve for fast path
    });
  }

  // ... rest of function unchanged
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console build`
- [ ] Unit tests pass: `pnpm test`
- [ ] Lint passes: `pnpm lint`
- [ ] Type check passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Search for a recently-created observation (with metadata)
- [ ] Verify fast path is used (check logs for "fast path" message)
- [ ] Verify results contain correct url and entities
- [ ] Search for an older observation (without metadata)
- [ ] Verify DB path is used as fallback
- [ ] Compare search latency before/after

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that both fast path and DB fallback work correctly.

---

## Phase 4: Enable Fast Path in Search Routes

### Overview

Wire up the fast path option in the v1 search route.

### Changes Required

#### 1. Update v1 Search Route

**File**: `apps/console/src/app/(api)/v1/search/route.ts`

Find where `enrichSearchResults` is called and add the `useFastPath` option for fast mode:

```typescript
// For fast mode, enable fast path enrichment
const enrichedResults = await enrichSearchResults(
  rerankResults,
  candidates,
  workspaceId,
  { useFastPath: mode === "fast" }
);
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm build:console`
- [ ] API route tests pass
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Call `/v1/search` with `mode=fast`
- [ ] Verify response time improvement (15-40ms faster)
- [ ] Verify response format is unchanged
- [ ] Call `/v1/search` with `mode=balanced` (default)
- [ ] Verify DB enrichment path still works

---

## Testing Strategy

### Unit Tests

**New tests to add:**

1. `observation-capture.test.ts`:
   - Test that `url` is correctly computed for GitHub PRs, issues, commits
   - Test that `entities` contains top 5 keys
   - Test empty URL handling (unknown source types)

2. `four-path-search.test.ts`:
   - Test fast path with complete metadata
   - Test fallback path with missing metadata
   - Test mixed path (some with metadata, some without)

### Integration Tests

1. **End-to-end ingestion test**:
   - Send test webhook
   - Verify Pinecone metadata contains url and entities
   - Search for the observation
   - Verify fast path is used

### Manual Testing Steps

1. **Test new observation ingestion**:
   - Create a GitHub PR in a connected repo
   - Wait for webhook processing
   - Check Pinecone console for metadata fields

2. **Test fast mode search**:
   ```bash
   curl -X POST 'https://localhost:4107/v1/search' \
     -H 'Authorization: Bearer <api_key>' \
     -H 'Content-Type: application/json' \
     -d '{"workspace": "ws_xxx", "query": "test", "mode": "fast"}'
   ```
   - Verify response latency
   - Verify response contains url and entities

3. **Test backwards compatibility**:
   - Search for an old observation (pre-metadata)
   - Verify DB enrichment works correctly

## Performance Considerations

### Expected Latency Improvements

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| Fast mode (new obs) | 50-80ms | 10-30ms | 20-50ms |
| Fast mode (legacy obs) | 50-80ms | 50-80ms | 0ms (fallback) |
| Balanced/thorough | 50-80ms | 50-80ms | 0ms (no change) |

### Pinecone Metadata Size

- `url`: ~50-100 bytes (GitHub URLs)
- `entities`: ~50-150 bytes (5 keys)
- Total increase: ~100-250 bytes per vector
- Well within Pinecone's 40KB metadata limit

## Migration Notes

### No Backfill Required

- Legacy observations continue to work via DB enrichment
- New observations automatically get enriched metadata
- Gradual migration as observations are created

### Future Backfill Option

If needed later, a backfill script could:
1. Query observations without Pinecone `url` field
2. Compute URL and entities
3. Update Pinecone metadata via `pineconeClient.update()`

This is **not** part of this implementation plan.

## References

- Research: `thoughts/shared/research/2025-12-15-v1-route-optimization-integration-analysis.md` (Part 6)
- URL Builder: `apps/console/src/lib/neural/url-builder.ts`
- Observation Capture: `api/console/src/inngest/workflow/neural/observation-capture.ts:477-546`
- Search Enrichment: `apps/console/src/lib/neural/four-path-search.ts:541-639`
- Entity Extraction: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`

# Balanced Mode Threshold Fix & Latency Tracking Enhancement

## Overview

Fix the issue where balanced mode returns 0 results when Cohere's default 0.4 threshold filters out all candidates, and enhance latency reporting to better represent parallel operation timing.

## Current State Analysis

### Problem 1: Balanced Mode Zero Results

**Root Cause Chain**:
1. `v1/search/route.ts:123` - Passes `threshold: undefined` for balanced mode
2. `cohere.ts:76` - Uses `defaultThreshold` (0.4) when undefined
3. `cohere.ts:131` - Filters results where `relevance >= threshold`
4. When all Cohere scores < 0.4, result set is empty

**Why Other Modes Work**:
- **Fast mode**: Passthrough provider uses threshold `0` (no filtering)
- **Thorough mode**: LLM scoring may produce higher scores; fallback exists for errors

### Problem 2: Latency Representation

**Current State**:
- Individual path latencies measured independently (`four-path-search.ts:215-265`)
- `total` field measures wall-clock time correctly
- Sum of individual latencies exceeds `total` (confusing for parallel ops)
- No indication of which parallel operation was the bottleneck

### Key Discoveries:
- Existing fallback pattern: `bypassed: true` flag used for error fallback (`cohere.ts:167`)
- LLM provider has `bypassThreshold` pattern for small result sets (`llm.ts:125`)
- Passthrough provider correctly uses threshold `0` (`passthrough.ts:32`)

## Desired End State

### For Threshold Issue:
1. Balanced mode always returns results (unless truly no candidates exist)
2. Quality filtering still applied when meaningful
3. Clear indication when fallback was used
4. Backward compatible API response structure

### For Latency Tracking:
1. `maxParallel` field showing the bottleneck operation latency
2. Clear documentation of what each latency field represents
3. Backward compatible with existing schema

### Verification:
1. Run balanced mode search → always returns results
2. Check `latency.maxParallel` equals max of parallel operation latencies
3. Response includes `rerank.fallback: true` when minimum guarantee used

## What We're NOT Doing

- Not changing default thresholds globally (would affect other consumers)
- Not adding dynamic threshold adjustment based on score distribution (too complex)
- Not adding detailed per-operation logging (already exists)
- Not restructuring the entire latency object (backward compatibility)

## Implementation Approach

**Threshold Strategy**: Minimum Results Guarantee
- After threshold filtering, if results are empty, return top-N by Cohere score (ignoring threshold)
- This preserves semantic ranking while guaranteeing results
- Matches existing fallback philosophy (return something useful)

**Latency Strategy**: Add `maxParallel` Field
- Add single field showing max of parallel operation latencies
- Represents the bottleneck operation
- Minimal change, maximum insight

---

## Phase 1: Add Minimum Results Guarantee to Cohere Provider

### Overview
Modify the Cohere rerank provider to guarantee minimum results when threshold filtering would return empty results.

### Changes Required:

#### 1. Update Rerank Types
**File**: `packages/console-rerank/src/types.ts`
**Changes**: Add `minResults` option and `fallback` flag to response

```typescript
// Add to RerankOptions interface (around line 92)
/**
 * Minimum number of results to return. If threshold filtering
 * would return fewer than this, top results by score are returned
 * regardless of threshold.
 * @default 0 (no minimum guarantee)
 */
minResults?: number;

// Add to RerankResponse interface (around line 62)
/**
 * True if minimum results guarantee was used (threshold bypassed)
 */
fallback?: boolean;
```

#### 2. Implement Minimum Guarantee in Cohere Provider
**File**: `packages/console-rerank/src/providers/cohere.ts`
**Changes**: Add fallback logic after threshold filtering

```typescript
// After line 133 (current filtering and sorting), before return:
async rerank(
  query: string,
  candidates: RerankCandidate[],
  options?: RerankOptions,
): Promise<RerankResponse> {
  // ... existing code up to line 133 ...

  const threshold = options?.threshold ?? this.defaultThreshold;
  const minResults = options?.minResults ?? 0;

  // Build scored results with filtering
  let results = candidates
    .map((c, index) => {
      const relevance = scoreMap.get(index) ?? 0;
      return {
        id: c.id,
        score: relevance,
        relevance,
        originalScore: c.score,
      };
    })
    .filter((r) => r.relevance >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  let fallback = false;

  // Minimum results guarantee: if filtering returned too few results,
  // return top results by score regardless of threshold
  if (results.length < minResults && candidates.length > 0) {
    log.info("Cohere rerank using minimum results fallback", {
      requestId,
      filteredCount: results.length,
      minResults,
      threshold,
    });

    results = candidates
      .map((c, index) => {
        const relevance = scoreMap.get(index) ?? 0;
        return {
          id: c.id,
          score: relevance,
          relevance,
          originalScore: c.score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(topK, minResults));

    fallback = true;
  }

  return {
    results,
    latency,
    provider: this.name,
    filtered: candidates.length - results.length,
    bypassed: false,
    fallback,
  };
}
```

#### 3. Update Route to Pass minResults
**File**: `apps/console/src/app/(api)/v1/search/route.ts`
**Changes**: Add minResults option for balanced mode

```typescript
// Around line 121-124, update rerank call:
const rerankResponse = await reranker.rerank(query, rerankCandidates, {
  topK: limit + offset,
  threshold: mode === "thorough" ? 0.4 : undefined,
  minResults: mode === "balanced" ? Math.max(3, Math.ceil(limit / 2)) : undefined,
});
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/console build`
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/console lint`
- [x] Package build: `pnpm --filter @repo/console-rerank build`

#### Manual Verification:
- [ ] Balanced mode search that previously returned 0 results now returns results
- [ ] Results are ordered by Cohere relevance score
- [ ] Response includes indication when fallback was used

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Add maxParallel Latency Field

### Overview
Add a `maxParallel` field to latency reporting that shows the bottleneck operation among parallel searches.

### Changes Required:

#### 1. Update Latency Schema
**File**: `packages/console-types/src/api/v1/search.ts`
**Changes**: Add maxParallel field to latency schema

```typescript
// Update V1SearchLatencySchema (around line 131):
export const V1SearchLatencySchema = z.object({
  total: z.number().nonnegative(),
  embedding: z.number().nonnegative().optional(),
  retrieval: z.number().nonnegative(),
  entitySearch: z.number().nonnegative().optional(),
  clusterSearch: z.number().nonnegative().optional(),
  actorSearch: z.number().nonnegative().optional(),
  rerank: z.number().nonnegative(),
  /**
   * Maximum latency among parallel operations (retrieval, entitySearch, clusterSearch, actorSearch).
   * This represents the bottleneck operation that determines parallel phase duration.
   */
  maxParallel: z.number().nonnegative().optional(),
});
```

#### 2. Calculate and Include maxParallel in Response
**File**: `apps/console/src/app/(api)/v1/search/route.ts`
**Changes**: Calculate maxParallel from search results

```typescript
// Around line 190-199, update latency object:
const parallelLatencies = [
  searchResult.latency.vector,
  searchResult.latency.entity,
  searchResult.latency.cluster,
  searchResult.latency.actor,
].filter((l): l is number => l !== undefined);

const maxParallel = parallelLatencies.length > 0
  ? Math.max(...parallelLatencies)
  : 0;

const response: V1SearchResponse = {
  // ... existing fields ...
  latency: {
    total: Date.now() - startTime,
    embedding: searchResult.latency.embedding,
    retrieval: searchResult.latency.vector,
    entitySearch: searchResult.latency.entity,
    clusterSearch: searchResult.latency.cluster,
    actorSearch: searchResult.latency.actor,
    rerank: rerankLatency,
    maxParallel,
  },
  requestId,
};
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/console build`
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [x] Package types build: `pnpm --filter @repo/console-types build`

#### Manual Verification:
- [ ] API response includes `latency.maxParallel` field
- [ ] Value equals max of retrieval, entitySearch, clusterSearch, actorSearch
- [ ] Value is less than or equal to `latency.total`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Update LLM Provider for Consistency

### Overview
Apply the same minimum results guarantee pattern to the LLM provider for consistency.

### Changes Required:

#### 1. Update LLM Provider
**File**: `packages/console-rerank/src/providers/llm.ts`
**Changes**: Add minimum results fallback (same pattern as Cohere)

```typescript
// After the filtering logic (around line 189-191):
const minResults = options?.minResults ?? 0;
let fallback = false;

let results = candidates
  .map((c) => {
    const llmRelevance = scoreMap.get(c.id) ?? 0.5;
    const finalScore =
      this.config.llmWeight * llmRelevance +
      this.config.vectorWeight * c.score;
    return {
      id: c.id,
      score: finalScore,
      relevance: llmRelevance,
      originalScore: c.score,
    };
  })
  .filter((r) => r.relevance >= threshold)
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);

// Minimum results guarantee
if (results.length < minResults && candidates.length > 0) {
  log.info("LLM rerank using minimum results fallback", {
    requestId,
    filteredCount: results.length,
    minResults,
    threshold,
  });

  results = candidates
    .map((c) => {
      const llmRelevance = scoreMap.get(c.id) ?? 0.5;
      const finalScore =
        this.config.llmWeight * llmRelevance +
        this.config.vectorWeight * c.score;
      return {
        id: c.id,
        score: finalScore,
        relevance: llmRelevance,
        originalScore: c.score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(topK, minResults));

  fallback = true;
}

return {
  results,
  latency,
  provider: this.name,
  filtered: candidates.length - results.length,
  bypassed: false,
  fallback,
};
```

### Success Criteria:

#### Automated Verification:
- [x] Package build passes: `pnpm --filter @repo/console-rerank build`
- [x] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Thorough mode with low-scoring results still returns minimum results
- [ ] Fallback flag set correctly when minimum guarantee used

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests:
- Test Cohere provider returns minResults when all scores below threshold
- Test Cohere provider returns fewer than minResults when candidates < minResults
- Test maxParallel calculation with various latency combinations
- Test fallback flag is set correctly

### Integration Tests:
- v1/search with balanced mode returns results even with low Cohere scores
- Response includes maxParallel in latency object
- Response includes fallback indicator when minimum guarantee used

### Manual Testing Steps:
1. Search with query that produces low Cohere relevance scores in balanced mode
2. Verify results are returned (previously returned 0)
3. Check `latency.maxParallel` equals max of parallel operation latencies
4. Verify the fallback indication in response when applicable

## Performance Considerations

- Minimum results fallback: Negligible overhead (array already scored, just re-slice)
- maxParallel calculation: O(4) max operation, negligible

## Migration Notes

- API response is backward compatible (new optional fields)
- Existing consumers unaffected (they already handle variable result counts)

## References

- Original research: `thoughts/shared/research/2025-12-14-balanced-mode-zero-results.md`
- Cohere provider: `packages/console-rerank/src/providers/cohere.ts:68-131`
- Passthrough provider: `packages/console-rerank/src/providers/passthrough.ts:32`
- LLM provider: `packages/console-rerank/src/providers/llm.ts:77-191`
- Four-path search latency: `apps/console/src/lib/neural/four-path-search.ts:212-302`
- v1/search route: `apps/console/src/app/(api)/v1/search/route.ts:121-199`

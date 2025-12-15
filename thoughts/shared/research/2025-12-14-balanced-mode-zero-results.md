---
date: 2025-12-14T00:00:00+08:00
researcher: claude
git_commit: 4e4abcf4
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Why balanced mode returns 0 results and latency tracking for parallel operations"
tags: [research, codebase, v1-search, rerank, latency]
status: complete
last_updated: 2025-12-14
last_updated_by: claude
---

# Research: Balanced Mode Zero Results & Latency Tracking

**Date**: 2025-12-14
**Researcher**: claude
**Git Commit**: 4e4abcf4
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Questions

1. Why does "balanced" mode return 0 results when "fast" and "thorough" work fine?
2. Is the latency tracking accidentally summing parallel operations instead of using the max?

## Summary

### Issue 1: Balanced Mode Returns 0 Results

**Root Cause**: The Cohere rerank provider has a default threshold of `0.4` that filters out all results with relevance scores below that threshold. The query "security" against the workspace's indexed content resulted in all 20 candidates scoring below 0.4 in Cohere's semantic relevance scoring.

**Key Code Paths**:

1. `route.ts:123` - Threshold only explicitly set for "thorough" mode:
   ```typescript
   threshold: mode === "thorough" ? 0.4 : undefined,
   ```

2. `cohere.ts:76` - When threshold is undefined, defaults to `this.defaultThreshold`:
   ```typescript
   const threshold = options?.threshold ?? this.defaultThreshold;
   ```

3. `cohere.ts:68` - Default threshold is 0.4:
   ```typescript
   this.defaultThreshold = config?.threshold ?? 0.4;
   ```

4. `cohere.ts:131` - Filtering happens here:
   ```typescript
   .filter((r) => r.relevance >= threshold)
   ```

**Why Fast Mode Works**: The passthrough provider (`passthrough.ts:32`) uses a default threshold of `0`, so no candidates are filtered out.

**Why Thorough Mode Works**: The LLM rerank provider may have different scoring behavior or no threshold filtering.

### Issue 2: Latency Tracking

**Answer**: Yes, the latency numbers are individual per-path measurements, not representing actual wall-clock time for parallel operations.

From the logs:
```
retrieval: 1579,
entitySearch: 0,
clusterSearch: 1578,
actorSearch: 533,
```

These ran in parallel (Promise.all at `four-path-search.ts:212`), but each measures its own elapsed time independently. The `total` field correctly measures wall-clock time, but the individual fields show each operation's duration, which when summed would exceed the total.

## Detailed Findings

### Cohere Rerank Provider Behavior

Location: `packages/console-rerank/src/providers/cohere.ts`

The Cohere provider:
1. Sends all candidates to Cohere's rerank API (line 98-104)
2. Gets back relevance scores from 0-1 for each candidate
3. Filters results where `relevance >= threshold` (line 131)
4. Returns empty array if all candidates score below threshold

```typescript
// Line 121-133
const results = candidates
  .map((c, index) => {
    const relevance = scoreMap.get(index) ?? 0;
    return {
      id: c.id,
      score: relevance,
      relevance,
      originalScore: c.score,
    };
  })
  .filter((r) => r.relevance >= threshold)  // <-- FILTERING HERE
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);
```

### Latency Tracking Implementation

Location: `apps/console/src/lib/neural/four-path-search.ts`

```typescript
// Line 212-265
const [vectorResults, entityResults, clusterResults, actorResults] = await Promise.all([
  // Path 1: Vector
  (async () => {
    const start = Date.now();
    // ... operation ...
    return { results, latency: Date.now() - start, success: true };
  })(),
  // Path 2, 3, 4 similar pattern...
]);

// Line 296-302 - Returns individual latencies
latency: {
  embedding: embedLatency,
  vector: vectorResults.latency,
  entity: entityResults.latency,
  cluster: clusterResults.latency,
  actor: actorResults.latency,
  total: Date.now() - startTime,  // <-- This is correct wall-clock time
},
```

The `total` field is correct, but individual latencies represent per-operation time, not contributing to wall-clock time understanding for parallel ops.

## Code References

- `apps/console/src/app/(api)/v1/search/route.ts:123` - Threshold configuration
- `packages/console-rerank/src/providers/cohere.ts:68` - Default threshold 0.4
- `packages/console-rerank/src/providers/cohere.ts:131` - Relevance filtering
- `packages/console-rerank/src/providers/passthrough.ts:32` - Default threshold 0
- `apps/console/src/lib/neural/four-path-search.ts:212-265` - Parallel execution
- `apps/console/src/lib/neural/four-path-search.ts:296-302` - Latency reporting

## Architecture Documentation

### Rerank Mode Behavior Matrix

| Mode      | Provider     | Default Threshold | Notes                     |
|-----------|--------------|-------------------|---------------------------|
| fast      | Passthrough  | 0                 | No filtering, vector only |
| balanced  | Cohere       | 0.4               | Semantic rerank + filter  |
| thorough  | LLM          | 0.4 (explicit)    | LLM-based scoring         |

### Latency Fields

| Field        | Meaning                                | Notes                |
|--------------|----------------------------------------|----------------------|
| total        | Wall-clock time from start to end      | Accurate             |
| embedding    | Time to generate query embedding       | Sequential, pre-parallel |
| retrieval    | Vector search duration                 | Parallel operation   |
| entitySearch | Entity pattern matching duration       | Parallel operation   |
| clusterSearch| Cluster centroid search duration       | Parallel operation   |
| actorSearch  | Actor profile search duration          | Parallel operation   |
| rerank       | Reranking duration                     | Sequential, post-parallel |

## Open Questions

1. Should balanced mode have a lower default threshold (e.g., 0.2) to avoid returning empty results?
2. Should the API response include a `maxParallelLatency` field instead of/in addition to individual latencies?
3. Should there be a fallback when balanced mode filters to 0 results (e.g., return top-N by vector score)?

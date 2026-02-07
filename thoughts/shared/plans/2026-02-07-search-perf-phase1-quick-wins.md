# Search Performance Phase 1: Quick Wins Implementation Plan

## Overview

Optimize the `v1/search` API from 6-7s (balanced mode) to ~1-2s through five quick-win optimizations that eliminate connection overhead, add caching, restructure parallelism, and reduce rerank payload size. These are low-risk, high-ROI changes that require no architectural changes or re-indexing.

Based on: `thoughts/shared/research/2026-02-07-search-perf-architecture-design.md`

## Current State Analysis

The v1/search pipeline has a sequential waterfall:
```
Auth (10-50ms) → Parse (<5ms) → Config (5-20ms cached)
    → Embed (200-400ms, P99 up to 5s) ← SEQUENTIAL, UNCACHED, NEW CLIENT PER REQUEST
        → 4-Path Search (200-500ms) ← Entity/actor blocked by embedding unnecessarily
            → Normalize (0-200ms)
                → Rerank (200-500ms) ← NEW CLIENT PER REQUEST, NO TRUNCATION
                    → Enrich (50-200ms) ← 2 SEQUENTIAL DB queries
                        → Response (<1ms)
```

Key bottlenecks verified in code:
- `packages/console-embed/src/utils.ts:154` — New `CohereEmbedding` (new `CohereClient`) per request
- `packages/console-rerank/src/factory.ts:40` — New `CohereRerankProvider` (new `CohereClient`) per request
- `apps/console/src/lib/neural/four-path-search.ts:378-394` — Embedding blocks entity/actor search
- `apps/console/src/lib/neural/four-path-search.ts:569-606` — 2 sequential DB queries in enrichment
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:56` — `console.log(request.headers)` on every request
- Zero caching for embeddings or full search results

### Key Discoveries:
- Pinecone client is already a singleton (`packages/console-pinecone/src/client.ts:160`) — good pattern to follow
- Redis caching pattern exists in `packages/console-workspace-cache/` with `@vendor/upstash` — reuse for embedding cache
- Entity search (`entity-search.ts:71`) and actor search (`actor-search.ts:50`) use query text, NOT the embedding vector
- Cluster search (`cluster-search.ts:29`) DOES need the embedding vector
- Rerank sends full untrimmed content with `topN: candidates.length` (`cohere.ts:95-103`)

## Desired End State

After Phase 1:
- **Cache hit (full result)**: <10ms
- **Cache hit (embedding only) + fast mode**: 50-150ms
- **Warm, balanced mode**: ~800ms-1.5s (down from 6-7s)
- **Cold, balanced mode**: ~1.5-2.5s

Verification: Compare `response.latency` breakdown before and after via the existing latency tracking in the API response.

## What We're NOT Doing

- **RRF reranking** (Phase 2) — Requires quality evaluation and A/B testing
- **Parallel enrichment JOIN** (Phase 2) — Requires Drizzle JOIN refactoring
- **Streaming SSE** (Phase 3) — Requires new endpoint and client changes
- **Denormalized Pinecone metadata** (Phase 3) — Requires re-indexing
- **Local ONNX embeddings** (Phase 3) — Requires model compatibility analysis
- **Semantic caching** (Phase 3) — Requires Upstash Vector setup
- **Pinecone keep-alive** — Separate operational concern

## Implementation Approach

Five independent optimizations, each building on but not blocking the others. Can be implemented and tested individually.

---

## Phase 1A: Remove console.log + CohereClient Singletons

### Overview
Eliminate debug logging overhead and HTTP connection re-establishment by making Cohere clients singletons, matching the existing Pinecone singleton pattern.

### Changes Required:

#### 1. Remove `console.log(request.headers)` from auth
**File**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:56`

Remove the line:
```typescript
console.log(request.headers);
```

This serializes the entire Headers object to stdout on every request. No replacement needed — the structured log at line 52-59 already captures the relevant auth metadata.

#### 2. Create singleton `CohereRerankProvider` in factory
**File**: `packages/console-rerank/src/factory.ts`

Current code (line 40):
```typescript
case "balanced":
  return new CohereRerankProvider();
```

Change to module-level singleton:
```typescript
import type { RerankProvider, RerankMode } from "./types";
import { PassthroughRerankProvider } from "./providers/passthrough";
import { CohereRerankProvider } from "./providers/cohere";
import { LLMRerankProvider } from "./providers/llm";

// Singleton instances — reuse across requests for HTTP connection pooling
const cohereReranker = new CohereRerankProvider();
const llmReranker = new LLMRerankProvider();

export function createRerankProvider(mode: RerankMode): RerankProvider {
  switch (mode) {
    case "fast":
      return new PassthroughRerankProvider();
    case "balanced":
      return cohereReranker;
    case "thorough":
      return llmReranker;
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unknown rerank mode: ${exhaustiveCheck as string}`);
    }
  }
}
```

Note: `PassthroughRerankProvider` is stateless and cheap to construct, so a new instance per call is fine. `CohereRerankProvider` and `LLMRerankProvider` create `CohereClient` instances with TCP connections, so singleton is important.

Verify `LLMRerankProvider` is also safe to singleton — it should be stateless between calls. Check the constructor doesn't hold per-request state.

#### 3. Create singleton embedding provider cache
**File**: `packages/console-embed/src/utils.ts`

Current code (line 150-160) creates a new `CohereEmbedding` on every call. Add a `Map` cache keyed by configuration tuple:

```typescript
// Singleton cache for embedding providers — keyed by (model, inputType, dimension)
// CohereEmbedding creates a new CohereClient in its constructor, so reusing
// providers enables HTTP connection pooling (keep-alive).
const embeddingProviderCache = new Map<string, EmbeddingProvider>();

export function createEmbeddingProviderForWorkspace(
	workspace: WorkspaceEmbeddingConfig,
	config: EmbeddingProviderConfig,
): EmbeddingProvider {
	const dimension = workspace.embeddingDim ?? EMBEDDING_CONFIG.cohere.dimension;
	const cacheKey = `${EMBEDDING_CONFIG.cohere.model}:${config.inputType}:${dimension}`;

	let provider = embeddingProviderCache.get(cacheKey);
	if (!provider) {
		provider = createCohereEmbedding({
			apiKey: embedEnv.COHERE_API_KEY,
			model: EMBEDDING_CONFIG.cohere.model,
			inputType: config.inputType as CohereInputType,
			dimension,
		});
		embeddingProviderCache.set(cacheKey, provider);
	}
	return provider;
}
```

This is safe because:
- API key is the same across all calls (`embedEnv.COHERE_API_KEY`)
- Model is constant (`EMBEDDING_CONFIG.cohere.model`)
- `CohereEmbedding.embed()` is stateless — it only uses `this.client`, `this.model`, `this.inputType`
- The `Map` acts as a memoization cache, not a data cache

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (console-rerank, console-embed pass; pre-existing ai-sdk failure unrelated)
- [x] Linting passes: `pnpm lint` (console-rerank passes; console-embed has no eslint config — pre-existing)
- [ ] Build succeeds: `pnpm build:console` (pre-existing env var issue — unrelated to changes)
- [ ] No runtime errors on dev server startup: `pnpm dev:console`

#### Manual Verification:
- [ ] Search API returns correct results (same as before)
- [ ] Latency reduction of ~20-50ms visible in `response.latency` on repeated requests (connection reuse)
- [ ] `console.log(request.headers)` no longer appears in server logs
- [ ] No `CohereClient` constructor errors on first request

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 1B: Redis Embedding Cache

### Overview
Cache query embeddings in Redis to eliminate the most expensive and variable API call (200-400ms typical, up to 5s P99). Uses the same `@vendor/upstash` Redis client and caching pattern established in `console-workspace-cache`.

### Changes Required:

#### 1. Add embedding cache utility inline in four-path-search
**File**: `apps/console/src/lib/neural/four-path-search.ts`

Add at the top of the file (after existing imports):

```typescript
import { redis } from "@vendor/upstash";
import { createHash } from "node:crypto";

const EMBED_CACHE_TTL = 3600; // 1 hour, matches workspace config cache TTL

function embedCacheKey(query: string, model: string, dim: number): string {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  const hash = createHash("sha256")
    .update(`${normalized}:${model}:${dim}`)
    .digest("hex")
    .slice(0, 16);
  return `embed:v1:${hash}`;
}

async function getCachedEmbedding(
  query: string,
  model: string,
  dim: number
): Promise<number[] | null> {
  try {
    return await redis.get<number[]>(embedCacheKey(query, model, dim));
  } catch (error) {
    log.warn("Embedding cache read failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function setCachedEmbedding(
  query: string,
  model: string,
  dim: number,
  embedding: number[]
): void {
  // Fire-and-forget — don't block the response path
  redis
    .set(embedCacheKey(query, model, dim), embedding, { ex: EMBED_CACHE_TTL })
    .catch((error) => {
      log.warn("Embedding cache write failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}
```

Design decisions:
- **Inline in four-path-search** rather than a separate package: This is the only consumer, and keeping it local avoids package plumbing overhead. Can be extracted later if needed elsewhere.
- **SHA-256 hash with model+dim in key**: Prevents cross-model collisions. 16 hex chars = 64 bits, negligible collision probability for cache keys.
- **Query normalization** (lowercase, trim, collapse whitespace): Increases hit rate for trivially different queries like `"Hello World"` vs `"hello world"`.
- **Fire-and-forget write**: Matches the pattern in `console-workspace-cache/src/config.ts:59-64`.
- **Graceful error handling**: Cache failures fall through to API call, matching existing pattern.

#### 2. Integrate cache into embedding generation
**File**: `apps/console/src/lib/neural/four-path-search.ts:377-394`

Replace the current embedding generation block:

```typescript
// Current (lines 377-394):
const embedStart = Date.now();
const embedding = createEmbeddingProviderForWorkspace(
  { id: workspaceId, embeddingModel, embeddingDim },
  { inputType: "search_query" }
);
const { embeddings } = await embedding.embed([query]);
const embedLatency = Date.now() - embedStart;
const queryVector = embeddings[0];
if (!queryVector) {
  throw new Error("Failed to generate query embedding");
}
```

With cache-aware version:

```typescript
// 2. Generate query embedding (with cache)
const embedStart = Date.now();
const embeddingDimResolved = embeddingDim ?? 1024;
let queryVector = await getCachedEmbedding(query, embeddingModel ?? "embed-english-v3.0", embeddingDimResolved);
let embedCacheHit = false;

if (queryVector) {
  embedCacheHit = true;
  log.debug("Embedding cache hit", { requestId, queryLength: query.length });
} else {
  const embedding = createEmbeddingProviderForWorkspace(
    { id: workspaceId, embeddingModel, embeddingDim },
    { inputType: "search_query" }
  );
  const { embeddings } = await embedding.embed([query]);
  queryVector = embeddings[0];
  if (!queryVector) {
    throw new Error("Failed to generate query embedding");
  }
  setCachedEmbedding(query, embeddingModel ?? "embed-english-v3.0", embeddingDimResolved, queryVector);
}
const embedLatency = Date.now() - embedStart;
```

#### 3. Add cache hit indicator to latency response
**File**: `apps/console/src/lib/neural/four-path-search.ts` — in the return object (~line 507)

Add `embedCacheHit` to the latency object so it's visible in the API response for monitoring. This requires updating the return type and the latency object in `search.ts`.

For simplicity, add it to the log output instead to avoid type changes:

```typescript
log.info("4-path parallel search complete", {
  requestId,
  // ... existing fields
  embedCacheHit,
  embedLatency,
});
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console` (pre-existing env var issue)

#### Manual Verification:
- [ ] First search query: embedding generated and cached (check logs for "Embedding cache hit" absence)
- [ ] Second identical query: embedding served from cache (check logs for "Embedding cache hit")
- [ ] Embedding latency drops from 200-400ms to <5ms on cache hit (visible in `response.latency.embedding`)
- [ ] Trivially different queries hit cache (e.g., extra space, different case)
- [ ] Results are identical between cached and uncached paths

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 1C: Parallelize Entity/Actor Search with Embedding

### Overview
Restructure `fourPathParallelSearch` so entity search and actor search run in parallel with embedding generation, since they don't need the query vector. Only vector search and cluster search wait for the embedding.

### Changes Required:

#### 1. Restructure fourPathParallelSearch
**File**: `apps/console/src/lib/neural/four-path-search.ts:377-457`

Replace the current sequential structure (embed → 4-path parallel) with a two-stage parallel structure:

```typescript
// 2. Stage 1: Run embedding generation IN PARALLEL with entity/actor search
//    Entity search uses text pattern matching, not embeddings
//    Actor search uses name/username matching, not embeddings
const embedStart = Date.now();
const embeddingDimResolved = embeddingDim ?? 1024;
const embeddingModelResolved = embeddingModel ?? "embed-english-v3.0";

const [queryVector, entityResults, actorResults] = await Promise.all([
  // Embedding generation (200-400ms, or <5ms on cache hit)
  (async () => {
    let vector = await getCachedEmbedding(query, embeddingModelResolved, embeddingDimResolved);
    if (vector) {
      log.debug("Embedding cache hit", { requestId, queryLength: query.length });
      return vector;
    }
    const embedding = createEmbeddingProviderForWorkspace(
      { id: workspaceId, embeddingModel, embeddingDim },
      { inputType: "search_query" }
    );
    const { embeddings } = await embedding.embed([query]);
    vector = embeddings[0];
    if (!vector) {
      throw new Error("Failed to generate query embedding");
    }
    setCachedEmbedding(query, embeddingModelResolved, embeddingDimResolved, vector);
    return vector;
  })(),

  // Path 2: Entity search (fast pattern matching — no embedding needed)
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

  // Path 4: Actor profile search (name matching — no embedding needed)
  hasActors
    ? (async () => {
        const start = Date.now();
        try {
          const result = await searchActorProfiles(workspaceId, query, 5);
          return { ...result, latency: Date.now() - start, success: true };
        } catch (error) {
          log.error("Actor search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
          return { ...EMPTY_ACTOR_RESULT, latency: Date.now() - start, success: false };
        }
      })()
    : Promise.resolve({ ...EMPTY_ACTOR_RESULT, latency: 0, success: true }),
]);

const embedLatency = Date.now() - embedStart;

// 3. Stage 2: Run embedding-dependent paths (vector + cluster)
const pineconeFilter = buildPineconeFilter(filters);
const parallelStart = Date.now();

const [vectorResults, clusterResults] = await Promise.all([
  // Path 1: Vector similarity search (needs embedding)
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

  // Path 3: Cluster context search (needs embedding)
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
]);
```

The actor search result type needs adjustment since `searchActorProfiles` returns `{ results, latency }` directly. Check the actual return type and adjust wrapping accordingly. The key change is: entity/actor latency is now hidden behind embedding generation.

#### 2. Update logging and latency tracking

Update the log and latency return to reflect the new two-stage structure:

```typescript
log.info("4-path parallel search complete", {
  requestId,
  embedLatency,
  stage2Latency: Date.now() - parallelStart,
  vectorMatches: vectorResults.results.matches.length,
  entityMatches: entityResults.results.length,
  clusterMatches: clusterResults.results.length,
  actorMatches: actorResults.results.length,
  clusterSkipped: !hasClusters,
  actorSkipped: !hasActors,
});
```

The latency return object should continue to expose individual path latencies for backward compatibility in the API response.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console` (pre-existing env var issue)

#### Manual Verification:
- [ ] Search results are identical to before (same ordering, same scores)
- [ ] Entity search and actor search latency are now hidden behind embedding generation (visible in logs)
- [ ] For workspaces with actors/entities, total search latency is reduced by the entity/actor search time
- [ ] Error handling still works: if entity search fails, vector results still return correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 1D: Full Result Cache

### Overview
Cache complete search results at the `searchLogic` entry point. Eliminates the entire pipeline on cache hit for repeated queries (<10ms response). Uses the same Redis pattern as workspace config caching.

### Changes Required:

#### 1. Add result cache utilities to search.ts
**File**: `apps/console/src/lib/v1/search.ts`

Add at the top (after imports):

```typescript
import { redis } from "@vendor/upstash";
import { createHash } from "node:crypto";

const RESULT_CACHE_TTL = 300; // 5 minutes — short TTL for freshness

function resultCacheKey(workspaceId: string, input: SearchLogicInput): string {
  const payload = JSON.stringify({
    q: input.query.toLowerCase().trim().replace(/\s+/g, " "),
    m: input.mode,
    l: input.limit,
    o: input.offset,
    f: input.filters ?? null,
    c: input.includeContext,
    h: input.includeHighlights,
  });
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return `search:v1:${workspaceId}:${hash}`;
}
```

Design decisions:
- **workspaceId in key**: Security — prevents cross-workspace data leakage
- **5 minute TTL**: Balances freshness with cache hit rate. Dashboard widgets and repeated queries benefit most.
- **All parameters in hash**: Ensures different mode/limit/filter combinations get separate cache entries
- **Query normalization**: Same as embedding cache — lowercase, trim, collapse whitespace

#### 2. Add cache check at searchLogic entry
**File**: `apps/console/src/lib/v1/search.ts:28-34`

Add cache check after function entry, before any computation:

```typescript
export async function searchLogic(
  auth: V1AuthContext,
  input: SearchLogicInput,
): Promise<SearchLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/search logic executing", { requestId: input.requestId });

  // Check full result cache
  const cacheKey = resultCacheKey(auth.workspaceId, input);
  try {
    const cached = await redis.get<SearchLogicOutput>(cacheKey);
    if (cached) {
      log.info("Search result cache hit", { requestId: input.requestId, workspaceId: auth.workspaceId });
      // Update latency to reflect actual response time
      cached.latency.total = Date.now() - startTime;
      cached.requestId = input.requestId;
      return cached;
    }
  } catch (error) {
    log.warn("Search result cache read failed", {
      requestId: input.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ... existing pipeline code ...
```

#### 3. Add cache write after response building
**File**: `apps/console/src/lib/v1/search.ts` — after response is built (~line 161), before activity tracking:

```typescript
  // Cache the result (fire-and-forget)
  redis.set(cacheKey, response, { ex: RESULT_CACHE_TTL }).catch((error) => {
    log.warn("Search result cache write failed", {
      requestId: input.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // Track search query (fire-and-forget, non-blocking)
  recordSystemActivity({
```

Important: The activity tracking should fire on BOTH cache hits and misses, so the `recordSystemActivity` call should be moved to before the cache check return OR duplicated. Recommendation: Keep activity tracking where it is for cache misses. For cache hits, the log statement at "Search result cache hit" provides sufficient observability. Activity tracking on cache hits would add unnecessary Redis/DB load.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] First search query: full pipeline executes, result cached
- [ ] Second identical query within 5 minutes: cache hit, <10ms response time
- [ ] Different query: cache miss, full pipeline executes
- [ ] Same query with different mode: cache miss (separate cache entry)
- [ ] Same query in different workspace: cache miss (workspace isolation verified)
- [ ] `response.latency.total` reflects actual time (<10ms on hit, not the original pipeline time)
- [ ] `response.requestId` is unique per request (not the cached request ID)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 1E: Rerank Document Truncation + TopN Optimization

### Overview
Reduce the payload sent to Cohere rerank by truncating document content and only requesting the scores we actually need, reducing rerank latency.

### Changes Required:

#### 1. Truncate document content
**File**: `packages/console-rerank/src/providers/cohere.ts:94-97`

Current code:
```typescript
const documents = candidates.map((c) => ({
  text: `${c.title}: ${c.content}`,
}));
```

Change to:
```typescript
const documents = candidates.map((c) => ({
  text: `${c.title}: ${(c.content || "").slice(0, 1000)}`,
}));
```

Rationale: Cohere rerank latency scales with total token count. Title + first ~256 tokens (~1000 chars) captures the most relevant signals. Long documents add latency without meaningfully improving rerank quality.

#### 2. Reduce topN to only what's needed
**File**: `packages/console-rerank/src/providers/cohere.ts:99-105`

Current code:
```typescript
const response = await this.client.rerank({
  model: this.model,
  query,
  documents,
  topN: candidates.length, // Get all scores, filter ourselves
  returnDocuments: false,
});
```

Change to:
```typescript
const response = await this.client.rerank({
  model: this.model,
  query,
  documents,
  topN: topK, // Only get scores we need
  returnDocuments: false,
});
```

This is correct because `topK` is already computed at line 77 as `options?.topK ?? candidates.length`. For balanced mode, this is `input.limit + input.offset` (from `search.ts:62`), which is typically 10-20 instead of the full candidate count (often 40+). The Cohere API returns results sorted by relevance, so requesting fewer scores is faster.

**Important**: The threshold filtering and minResults fallback logic (lines 122-162) must be updated to account for the fact that we may not have scores for all candidates. The current logic at line 148-159 re-maps ALL candidates — this needs to fall back to the top `topK` results only:

```typescript
// Updated minResults fallback (line 140-162):
if (results.length < minResults && candidates.length > 0) {
  log.info("Cohere rerank using minimum results fallback", {
    requestId,
    filteredCount: results.length,
    minResults,
    threshold,
  });

  // We already have the top results from the API response, just relax the threshold
  results = candidates
    .map((c, index) => {
      const relevance = scoreMap.get(index) ?? -1;
      if (relevance < 0) return null; // No score from API (beyond topN)
      return {
        id: c.id,
        score: relevance,
        relevance,
        originalScore: c.score,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(topK, minResults));

  fallback = true;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console` (pre-existing env var issue)

#### Manual Verification:
- [ ] Search results are still relevant and properly ordered
- [ ] Rerank latency reduced by 10-50ms (visible in `response.latency.rerank`)
- [ ] MinResults fallback still works for balanced mode (search with queries that have low relevance scores)
- [ ] No missing results compared to before (for typical limit=10 queries)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:
- Embedding cache: Test `embedCacheKey` normalization (case, whitespace, model+dim isolation)
- Result cache: Test `resultCacheKey` includes all parameters and workspaceId isolation
- Rerank truncation: Ensure documents >1000 chars are truncated
- Rerank topN: Verify correct number of results returned with reduced topN

### Integration Tests:
- Full search pipeline with and without cache hits
- Cache invalidation: Verify TTL expiry works correctly
- Error resilience: Redis failures don't crash the pipeline

### Manual Testing Steps:
1. Run same search query twice — verify second is dramatically faster
2. Run search with different modes — verify separate cache entries
3. Kill Redis connection — verify pipeline still works (cache miss fallback)
4. Search with actors/entities — verify parallel execution doesn't affect results
5. Compare search result quality before/after rerank truncation

## Performance Considerations

- **Redis latency**: Upstash Redis adds ~1-5ms per cache check. On hit, saves 200-5000ms (embedding) or entire pipeline (result cache). Net positive even with 100% miss rate due to client singletons.
- **Memory**: Embedding cache stores float arrays (~4KB per entry for 1024-dim). Result cache stores full response JSON (~2-10KB per entry). With 1h/5min TTLs, this is negligible.
- **Cache key collisions**: SHA-256 with 64-bit truncation has negligible collision probability (<1 in 10^18) for the cache key space.

## Migration Notes

- No database migrations required
- No re-indexing required
- All changes are backward compatible — API response format is unchanged
- Caches can be cleared at any time by flushing Redis keys matching `embed:v1:*` or `search:v1:*`
- Rollback: Revert code changes. Caches expire naturally via TTL.

## References

- Architecture design: `thoughts/shared/research/2026-02-07-search-perf-architecture-design.md`
- Codebase deep dive: `thoughts/shared/research/2026-02-07-search-perf-codebase-deep-dive.md`
- External research: `thoughts/shared/research/2026-02-07-search-perf-external-research.md`
- Review: `thoughts/shared/research/2026-02-07-search-perf-review.md`
- Existing cache pattern: `packages/console-workspace-cache/src/config.ts`
- Pinecone singleton pattern: `packages/console-pinecone/src/client.ts:160`

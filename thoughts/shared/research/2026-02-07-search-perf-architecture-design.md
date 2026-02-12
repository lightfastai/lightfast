---
date: 2026-02-07
researcher: architect-agent
topic: "v1/search API performance optimization"
tags: [research, architecture, search, performance]
status: complete
based_on:
  - 2026-02-07-search-perf-codebase-deep-dive.md
  - 2026-02-07-search-perf-external-research.md
---

# Architecture Design: Search Performance Optimization

## Research Question
How to optimize v1/search from 6-7s balanced mode to as fast as possible?

## Executive Summary

The v1/search pipeline currently takes 6-7s in balanced mode due to a **sequential waterfall of three external API calls** (Cohere embed → Pinecone search → Cohere rerank), **zero caching at any layer**, **new CohereClient instances per request** (no HTTP connection reuse), and **sequential enrichment DB queries**. External research across 32 sources confirms this is 6-10x slower than production norms for equivalent stacks.

**Target latencies:**
- **Cache hit (full result)**: <10ms
- **Cache hit (embedding only) + fast mode**: 50-150ms
- **Warm, balanced mode**: 400-800ms
- **Cold, balanced mode**: 1-2s

The proposed optimizations are organized in three phases. Phase 1 (quick wins, <1 day each) targets reducing balanced mode from ~6-7s to ~800ms-1.5s. Phase 2 (medium effort, 1-3 days each) targets 400-800ms. Phase 3 (larger initiatives) targets sustained sub-400ms with full-result caching hitting <10ms.

## Current State (from Codebase Deep Dive)

### Pipeline Waterfall (Balanced Mode)
```
Auth (10-50ms) → Parse (<5ms) → Config (5-20ms cached)
    → Embed (200-400ms, P99 up to 5s) ← SEQUENTIAL, UNCACHED
        → 4-Path Search (200-500ms) ← PARALLEL, good
            → Normalize (0-200ms) ← SEQUENTIAL
                → Rerank (200-500ms) ← SEQUENTIAL, UNCACHED
                    → Enrich (50-200ms) ← 2 SEQUENTIAL DB queries
                        → Response (<1ms)
```

### Critical Bottlenecks Identified
1. **Cohere embedding API** (`vendor/embed/src/provider/cohere.ts:102-139`): 200-400ms typical, P99 up to 5s. Zero caching. New `CohereClient` per request (`packages/console-embed/src/utils.ts:154`).
2. **Cohere rerank API** (`packages/console-rerank/src/providers/cohere.ts:99-105`): 200-500ms. New `CohereClient` per request (line 64). Sequential after search.
3. **Pinecone vector search** (`packages/console-pinecone/src/client.ts:125-131`): 200-500ms. Blocked by embedding completion. Already uses singleton client.
4. **Enrichment queries** (`four-path-search.ts:569-606`): 2 sequential DB queries (observations then entities). 50-200ms.
5. **Entity/actor search don't need embeddings** but are blocked by the embedding step because they're inside the same `Promise.all` that uses the query vector.
6. **`console.log(request.headers)`** in auth (`with-dual-auth.ts:56`): Unnecessary I/O on every request.

### What's Already Good
- Pinecone client is a module-level singleton (`packages/console-pinecone/src/client.ts:160`)
- 4-path search uses `Promise.all` for parallel retrieval (`four-path-search.ts:400-457`)
- Workspace config is Redis-cached with 1h TTL (`console-workspace-cache/src/config.ts:10`)
- `recordSystemActivity` is fire-and-forget (non-blocking)
- API key `lastUsedAt` update is non-blocking

## Available Optimizations (from External Research)

| Technique | Latency Savings | Quality Impact | Applicable? |
|-----------|----------------|----------------|-------------|
| Redis embedding cache | 200-5000ms on hit | None | **Yes - highest ROI** |
| Full result cache | Entire pipeline | None | **Yes - for repeated queries** |
| CohereClient singleton | 20-50ms/request | None | **Yes - trivial fix** |
| RRF instead of model rerank | 150-460ms | -3.86% NDCG@10 | **Yes - for balanced mode option** |
| Parallel entity/actor with embed | 0-200ms | None | **Yes - restructure Promise.all** |
| Parallel enrichment queries | 20-100ms | None | **Yes - use JOIN or Promise.all** |
| Reduce topK for reranker | 10-50ms | Minimal | **Yes - send fewer docs** |
| Truncate rerank documents | 10-30ms | Minimal | **Yes - limit token count** |
| Streaming SSE | Perceived: 2-4s | None | Medium effort, UX improvement |
| Local embeddings (ONNX) | 190-4990ms vs API | Model-dependent | High effort, eliminates API dep |
| Pinecone integrated inference | 100-300ms fewer round-trips | Comparable | Architecture change |

## Proposed Optimizations

### Phase 1: Quick Wins (< 1 day each)

#### 1.1 CohereClient Singletons for Embedding and Reranking

**What to change:**
- `packages/console-embed/src/utils.ts:150-160` — `createEmbeddingProviderForWorkspace()` creates a new `CohereEmbedding` (and thus new `CohereClient`) per call
- `vendor/embed/src/provider/cohere.ts:88-90` — `CohereClient` instantiated in constructor
- `packages/console-rerank/src/factory.ts:40` — `new CohereRerankProvider()` creates new `CohereClient` per call
- `packages/console-rerank/src/providers/cohere.ts:64` — `CohereClient` instantiated in constructor

**Proposed change:**
Create module-level singleton CohereClient instances for both embedding and reranking. The config (API key, model) doesn't change between requests, so there's no reason to recreate clients.

For embedding: Create a singleton `CohereClient` in `vendor/embed/src/provider/cohere.ts` and reuse it across `CohereEmbedding` instances. Or better, create a singleton `CohereEmbedding` per (model, inputType, dimension) tuple in `packages/console-embed/src/utils.ts`.

For reranking: Create a singleton `CohereRerankProvider` in `packages/console-rerank/src/factory.ts` instead of `new CohereRerankProvider()` on every call.

**Expected improvement:** 20-50ms per request (eliminates TCP handshake / TLS negotiation overhead and enables HTTP keep-alive connection reuse).

**Risk:** Low. Same API key and model config across all requests.

**Implementation notes:**
```typescript
// packages/console-rerank/src/factory.ts
// Before:
case "balanced":
  return new CohereRerankProvider();
// After:
const cohereReranker = new CohereRerankProvider();
// ...
case "balanced":
  return cohereReranker;
```

```typescript
// packages/console-embed/src/utils.ts
// Create singleton map keyed by (model, inputType, dimension)
const embeddingProviderCache = new Map<string, EmbeddingProvider>();

export function createEmbeddingProviderForWorkspace(
  workspace: WorkspaceEmbeddingConfig,
  config: EmbeddingProviderConfig,
): EmbeddingProvider {
  const key = `${EMBEDDING_CONFIG.cohere.model}:${config.inputType}:${workspace.embeddingDim ?? EMBEDDING_CONFIG.cohere.dimension}`;
  let provider = embeddingProviderCache.get(key);
  if (!provider) {
    provider = createCohereEmbedding({...});
    embeddingProviderCache.set(key, provider);
  }
  return provider;
}
```

---

#### 1.2 Redis Embedding Cache

**What to change:**
- `apps/console/src/lib/neural/four-path-search.ts:378-394` — Embedding generation in `fourPathParallelSearch()`

**Proposed change:**
Add a Redis cache layer for query embeddings. Key: `embed:v1:${hash(normalizedQuery + model + dimension)}`. Value: serialized float array. TTL: 3600s (1 hour, matches workspace config cache TTL).

Normalize queries before hashing: lowercase, trim, collapse whitespace. This increases cache hit rate for trivially-different queries.

**Expected improvement:** 200-400ms (typical) to 5000ms (P99) eliminated on cache hit. With FAQ-style/repeated queries, expect 40-60% hit rate.

**Risk:** Low. Embeddings are deterministic for the same input. Cache invalidation is not needed (embeddings don't change unless the model changes, which is tied to workspace config).

**Implementation notes:**
- Use existing `@vendor/upstash` Redis client (already in the stack for workspace config caching)
- Store embeddings as JSON arrays in Redis (Upstash supports this natively)
- Cache key should include model name and dimension to prevent cross-model collisions
- Add a `getCachedEmbedding` / `setCachedEmbedding` utility alongside the existing workspace cache in `packages/console-workspace-cache` or create a new `packages/console-embed-cache`

```typescript
// New: packages/console-embed-cache/src/index.ts (or inline in four-path-search)
import { redis } from "@vendor/upstash";
import { createHash } from "node:crypto";

const EMBED_CACHE_TTL = 3600; // 1 hour

function embedCacheKey(query: string, model: string, dim: number): string {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  const hash = createHash("sha256").update(`${normalized}:${model}:${dim}`).digest("hex").slice(0, 16);
  return `embed:v1:${hash}`;
}

export async function getCachedEmbedding(query: string, model: string, dim: number): Promise<number[] | null> {
  const key = embedCacheKey(query, model, dim);
  return redis.get<number[]>(key);
}

export async function setCachedEmbedding(query: string, model: string, dim: number, embedding: number[]): Promise<void> {
  const key = embedCacheKey(query, model, dim);
  await redis.set(key, embedding, { ex: EMBED_CACHE_TTL });
}
```

---

#### 1.3 Parallelize Entity/Actor Search with Embedding Generation

**What to change:**
- `apps/console/src/lib/neural/four-path-search.ts:362-524` — `fourPathParallelSearch()` structure

**Current problem:** The function first generates the embedding (line 378-394), THEN runs the 4-path parallel search (line 400-457). But entity search (`searchByEntities`) and actor search (`searchActorProfiles`) do NOT need the query vector — they use text pattern matching and DB lookups respectively. Only vector search and cluster search need the embedding.

**Proposed change:**
Restructure to run embedding generation IN PARALLEL with entity search and actor search. Vector search and cluster search wait for the embedding, but entity/actor search start immediately.

```typescript
// Before (simplified):
const embedding = await generateEmbedding(query);  // 200-400ms
const [vector, entity, cluster, actor] = await Promise.all([
  vectorSearch(embedding),   // needs embedding
  entitySearch(query),       // does NOT need embedding
  clusterSearch(embedding),  // needs embedding
  actorSearch(query),        // does NOT need embedding
]);

// After:
const [embeddingResult, entityResults, actorResults] = await Promise.all([
  generateEmbedding(query),          // 200-400ms
  searchByEntities(query, ...),      // 0-150ms, runs in parallel
  hasActors ? searchActorProfiles(...) : EMPTY_ACTOR_RESULT, // 0-400ms, runs in parallel
]);

// Now run vector-dependent paths
const [vectorResults, clusterResults] = await Promise.all([
  vectorSearch(embeddingResult),     // 200-500ms
  hasClusters ? clusterSearch(embeddingResult) : EMPTY_CLUSTER_RESULT,
]);
```

**Expected improvement:** Entity search and actor search latency is now hidden behind embedding generation. Saves 0-200ms depending on whether these paths are active (for workspaces with actors and entities, this is meaningful).

**Risk:** Low. No behavior change, only execution ordering changes.

---

#### 1.4 Remove `console.log(request.headers)` from Auth

**What to change:**
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:56`

**Current code:** `console.log(request.headers)` — logs ALL headers on every request.

**Proposed change:** Remove this line entirely, or replace with `log.debug("auth headers", { authorization: "***", workspace: request.headers.get("x-workspace-id") })` if debug logging is needed.

**Expected improvement:** 1-5ms (eliminates serialization of entire Headers object to stdout on every request).

**Risk:** None. This is debug logging that should not be in production.

---

#### 1.5 Full Result Cache

**What to change:**
- `apps/console/src/app/(api)/v1/search/route.ts:107-120` — Before calling `searchLogic()`
- `apps/console/src/lib/v1/search.ts:28-192` — `searchLogic()` entry point

**Proposed change:**
Add a full result cache at the route handler or `searchLogic` entry point. Cache key: `search:v1:${workspaceId}:${hash(query + JSON.stringify(filters) + mode + limit + offset)}`. TTL: 60-300s (1-5 minutes). This is especially effective for dashboard/widget contexts where the same query is repeated.

**Expected improvement:** Entire pipeline eliminated on cache hit. <10ms response time for repeated queries. Even with modest 20-30% hit rate, this dramatically reduces average latency.

**Risk:** Low-medium. Stale results for up to TTL duration. Mitigated by short TTL and cache invalidation on workspace data changes (tie into existing `invalidateWorkspaceConfig` pattern).

**Implementation notes:**
- Check cache AFTER auth (to ensure proper authorization) but BEFORE any computation
- Include `workspaceId` in cache key (security: prevents cross-workspace data leakage)
- On cache hit, still update `latency.total` to reflect actual response time
- Fire-and-forget cache write after computing results (don't add latency to the response path)

---

### Phase 2: Medium Effort (1-3 days each)

#### 2.1 RRF (Reciprocal Rank Fusion) as Balanced Mode Alternative

**What to change:**
- `packages/console-rerank/src/factory.ts:35-48` — Add new mode or modify balanced
- New file: `packages/console-rerank/src/providers/rrf.ts`

**Proposed change:**
Implement Reciprocal Rank Fusion as a reranking strategy. RRF combines scores from multiple retrieval paths using the formula `score = Σ 1/(k + rank_i)` where k=60 is standard. This is particularly well-suited for the existing 4-path architecture since we already have multiple ranked lists (vector, entity, cluster, actor).

Options:
- **Option A**: Replace balanced mode's Cohere rerank with RRF (breaking change in quality, saves 200-500ms)
- **Option B**: Add a new "balanced-fast" mode that uses RRF (non-breaking, user chooses)
- **Option C**: Use RRF as default for balanced, with a `reranker: "model"` option to opt into Cohere (recommended)

**Expected improvement:** 200-500ms (eliminates Cohere rerank API call entirely). Quality impact: -3.86% NDCG@10 per external benchmarks, which is acceptable for most use cases.

**Risk:** Medium. Quality regression for users currently relying on balanced mode's Cohere reranking. Mitigated by making it configurable.

---

#### 2.2 Parallel Enrichment Queries with JOIN

**What to change:**
- `apps/console/src/lib/neural/four-path-search.ts:553-657` — `enrichSearchResults()`

**Current problem:** Two sequential DB queries — first observations (line 569-586), then entities using internal IDs from observations (line 592-606). The entity query depends on the observation query's `id` field.

**Proposed change (Option A — JOIN):**
Replace the 2 sequential queries with a single LEFT JOIN query that fetches observations and their entities in one round-trip.

```sql
SELECT o.*, e.key, e.category
FROM workspaceNeuralObservations o
LEFT JOIN workspaceNeuralEntities e
  ON e.sourceObservationId = o.id AND e.workspaceId = o.workspaceId
WHERE o.workspaceId = ? AND o.externalId IN (?)
```

**Proposed change (Option B — Denormalize into Pinecone metadata):**
Store `source`, `observationType`, `occurredAt`, `url`, and top entities directly in Pinecone metadata during indexing. This eliminates the enrichment DB queries entirely for common fields.

This is a larger change (requires re-indexing) but eliminates 50-200ms permanently.

**Expected improvement:**
- Option A: 20-100ms (one round-trip instead of two)
- Option B: 50-200ms (eliminates enrichment queries entirely)

**Risk:** Option A is low risk. Option B requires re-indexing all workspaces (medium risk, can be done incrementally).

---

#### 2.3 Reduce Rerank Document Size

**What to change:**
- `packages/console-rerank/src/providers/cohere.ts:95-97` — Document preparation

**Current code:** Documents are formatted as `${c.title}: ${c.content}` with no truncation.

**Proposed change:**
Truncate content to first 256 tokens (~1000 chars) before sending to Cohere rerank. Reranking latency scales with total token count.

```typescript
const documents = candidates.map((c) => ({
  text: `${c.title}: ${(c.content || "").slice(0, 1000)}`,
}));
```

Also reduce `topN` from `candidates.length` (currently gets ALL scores) to just `topK` (what we actually need). The current approach requests scores for all candidates but only uses the top ones.

**Expected improvement:** 10-50ms depending on document sizes. More impactful for workspaces with long content.

**Risk:** Low. Title + first 256 tokens captures the most relevant signals for reranking.

---

#### 2.4 Conditional Reranking Skip

**What to change:**
- `apps/console/src/lib/v1/search.ts:48-67` — Reranking section

**Proposed change:**
Skip Cohere reranking when the top vector similarity score is very high (>0.90), since results are already well-ordered by the vector search. Also skip when result count is <= 3 (not enough candidates to meaningfully reorder).

```typescript
const topScore = rerankCandidates[0]?.score ?? 0;
const shouldSkipRerank =
  input.mode === "fast" ||
  topScore > 0.90 ||
  rerankCandidates.length <= 3;

const reranker = shouldSkipRerank
  ? new PassthroughRerankProvider()
  : createRerankProvider(input.mode);
```

**Expected improvement:** 200-500ms saved when conditions are met. Frequency depends on query/data characteristics.

**Risk:** Low-medium. High-similarity results are already well-ordered. The 0.90 threshold is conservative.

---

### Phase 3: Larger Initiatives (3+ days each)

#### 3.1 Streaming SSE Responses

**What to change:**
- `apps/console/src/app/(api)/v1/search/route.ts` — New streaming endpoint
- New: `apps/console/src/app/(api)/v1/search/stream/route.ts`

**Proposed change:**
Add a `/v1/search/stream` endpoint that returns results progressively via Server-Sent Events:
1. Immediately return cache results (if available)
2. Stream vector search results as they arrive (before reranking)
3. Stream reranked results as final update

This doesn't reduce actual pipeline time but dramatically reduces **perceived** latency. Users see first results within 200-400ms instead of waiting 1-2s.

**Expected improvement:** Perceived latency drops from 1-2s to 200-400ms for first results. Total pipeline time unchanged.

**Risk:** Medium. Requires client-side changes to consume SSE stream. The existing JSON endpoint remains unchanged for backward compatibility.

---

#### 3.2 Denormalize Enrichment Data into Pinecone Metadata

**What to change:**
- Indexing pipeline (Inngest workflows in `api/console/src/inngest/workflow/`)
- `apps/console/src/lib/neural/four-path-search.ts:553-657` — Simplify enrichment

**Proposed change:**
During document indexing, store enrichment metadata directly in Pinecone vector metadata:
- `source`, `observationType`, `occurredAt`, `url` — already partially there
- Top 3 entity keys and categories
- Source references

This allows the response to be built entirely from Pinecone results + reranking, eliminating the enrichment DB queries.

**Expected improvement:** 50-200ms eliminated permanently. Also reduces PlanetScale query load.

**Risk:** Medium. Requires re-indexing all workspaces. Pinecone metadata has a 40KB limit per vector, which is sufficient for these fields. Can be rolled out incrementally per workspace.

---

#### 3.3 Semantic Caching (Similar Query Matching)

**What to change:**
- New cache layer before embedding generation

**Proposed change:**
Use Upstash Vector (already in the vendor stack) to store recent query embeddings and their full results. For incoming queries, compute the embedding (or use cached embedding), then check if any cached query has cosine similarity > 0.95. If so, return the cached result.

This extends the full result cache (Phase 1.5) to cover **paraphrased** queries, dramatically increasing cache hit rate.

**Expected improvement:** Cache hit rate increases from 20-30% (exact match) to potentially 50-70% (semantic match). Each cache hit saves the entire pipeline.

**Risk:** Medium-high. Requires careful threshold tuning. Too aggressive (0.90) returns wrong results; too conservative (0.99) doesn't help much. Start with 0.95 and tune based on user feedback.

---

#### 3.4 Local Embedding Inference (ONNX)

**What to change:**
- New provider: `vendor/embed/src/provider/local-onnx.ts`
- `packages/console-embed/src/utils.ts` — Add local provider option

**Proposed change:**
Deploy a quantized embedding model (e.g., `nomic-embed-text` via FastEmbed/ONNX Runtime) for query-time embedding. This eliminates the Cohere API call entirely for search queries (indexing can still use Cohere for consistency).

**Critical caveat:** The local model must produce embeddings in the same vector space as Cohere `embed-english-v3.0`. If using a different model, all existing vectors would need re-indexing. This optimization is only viable if:
1. Using the same model locally (Cohere doesn't offer local inference), OR
2. Willing to re-index with a model that has both API and local variants (e.g., switch to a model available on HuggingFace)

**Expected improvement:** 200-400ms → 2-10ms for embedding generation. Eliminates P99 5s tail latency.

**Risk:** High. Model compatibility is the main concern. Would require re-indexing if switching embedding models.

---

## Expected Latency Breakdown (Before vs After)

| Stage | Current (est.) | After Phase 1 | After Phase 2 | After Phase 3 |
|-------|---------------|---------------|---------------|---------------|
| Auth | 10-50ms | 10-50ms | 10-50ms | 10-50ms |
| Parse | <5ms | <5ms | <5ms | <5ms |
| **Result Cache Check** | N/A | **<5ms** (miss) / **<10ms** (hit→return) | <5ms | <5ms |
| Config | 5-20ms | 5-20ms | 5-20ms | 5-20ms |
| **Embed** | **200-400ms** | **<5ms** (cache hit) / 200-400ms (miss) | <5ms / 200-400ms | **2-10ms** (local) |
| **Entity/Actor** | Hidden in parallel | **Parallel with embed** (free) | Parallel with embed | Parallel with embed |
| **Vector Search** | 200-500ms | 200-500ms | 200-500ms | 200-500ms |
| Normalize | 0-50ms | 0-50ms | 0-50ms | 0-50ms |
| **Rerank** | **200-500ms** | 200-500ms | **<1ms** (RRF) / 200-500ms (Cohere) | <1ms (RRF) |
| **Enrich** | **50-200ms** | 50-200ms | **<5ms** (JOIN) / **0ms** (denormalized) | 0ms |
| Response | <1ms | <1ms | <1ms | <1ms |
| **TOTAL (warm, balanced)** | **~800-1800ms** | **~500-1300ms** | **~250-600ms** | **~220-550ms** |
| **TOTAL (cache hit)** | N/A | **<10ms** | <10ms | <10ms |
| **TOTAL (reported 6-7s)** | **6000-7000ms** | **~1000-2000ms** | **~400-800ms** | **~250-600ms** |

**Note on the 6-7s gap:** The codebase deep dive estimated ~1.3s for typical balanced mode, but actual is 6-7s. The difference is likely caused by:
1. Cohere API P99 tail latency (up to 5s for embedding alone)
2. Pinecone cold start latency (300-500ms to 2-20s for cold namespaces)
3. New CohereClient per request (no connection reuse amplifies TLS overhead)
4. Network latency between regions

Phase 1 optimizations (especially embedding cache + client singletons) will eliminate the P99 tail latency and connection overhead, which likely accounts for most of the gap between estimated and actual.

## Implementation Order

```
Week 1: Phase 1 Quick Wins
├── Day 1: 1.4 Remove console.log (5 min) + 1.1 CohereClient singletons (2-4 hours)
├── Day 2: 1.2 Redis embedding cache (4-6 hours)
├── Day 3: 1.3 Parallelize entity/actor with embedding (2-4 hours)
├── Day 4: 1.5 Full result cache (4-6 hours)
└── Day 5: Testing, benchmarking Phase 1 results

Week 2-3: Phase 2 Pipeline Optimization
├── 2.3 Reduce rerank document size (2-4 hours) — easy, do first
├── 2.4 Conditional reranking skip (4-6 hours)
├── 2.2 Parallel enrichment / JOIN (1-2 days)
└── 2.1 RRF reranking provider (2-3 days)

Week 4+: Phase 3 (based on Phase 1-2 results)
├── 3.1 Streaming SSE (3-5 days)
├── 3.2 Denormalize enrichment data (3-5 days, includes re-indexing)
├── 3.3 Semantic caching (3-5 days)
└── 3.4 Local embedding inference (5+ days, if model compatible)
```

**Dependencies:**
- 1.1 (singletons) has no dependencies — do first
- 1.2 (embed cache) depends on nothing, but benefits from 1.1
- 1.3 (parallel restructure) is independent
- 1.5 (result cache) depends on nothing, but maximizes value after 1.1-1.3 reduce base latency
- 2.1 (RRF) is independent of all Phase 1
- 2.2 (enrichment) is independent
- 3.2 (denormalize) makes 2.2 unnecessary — skip 2.2 Option B if planning 3.2

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Redis cache adds latency on miss | +5-10ms | Low | Redis miss is <5ms; net positive even on miss due to singletons |
| Stale cached results | User sees old data | Medium | Short TTL (60-300s), invalidation on data changes |
| RRF quality regression | -3.86% NDCG@10 | Medium | Make RRF opt-in or configurable per workspace |
| Embedding cache key collisions | Wrong embeddings returned | Very Low | SHA-256 hash + model/dim in key makes collisions negligible |
| Pinecone cold starts persist | >1s even with optimizations | Medium | Implement keep-alive pings via Inngest cron job (ping each workspace's namespace every 5 min) |
| Re-indexing for metadata denormalization | Downtime during migration | Medium | Incremental: new observations get metadata, backfill existing in background |
| Local embedding model incompatibility | Can't use local inference | High | Only viable if switching embedding model entirely. Park unless strategic decision to migrate. |

## Open Questions

1. **What is the current Pinecone region?** If the app runs in a different region than Pinecone, network latency alone could add 50-200ms per call. Co-locating would help.

2. **What is the query repetition rate?** The ROI of embedding cache and result cache depends heavily on how many queries are repeated. Analytics/logging should be added to measure this before and after.

3. **Is RRF quality acceptable for balanced mode?** A/B testing or user feedback is needed to determine if the 3.86% NDCG@10 reduction is acceptable. If not, RRF should be a separate mode.

4. **Should we switch embedding models?** Moving to a model with local inference capability (e.g., `nomic-embed-text`, Voyage AI) would unlock Phase 3.4 but requires full re-indexing. This is a strategic decision.

5. **Pinecone cold start frequency?** Need telemetry on how often namespaces go cold. If frequent, a keep-alive cron job (simple Inngest function) would be a high-value quick win.

6. **Enrichment data in Pinecone metadata — size limits?** Need to verify that adding entities, references, and metadata to Pinecone vectors stays within the 40KB metadata limit. For most observations this should be fine, but edge cases with many entities might need truncation.

7. **Cache invalidation strategy?** When new documents are indexed into a workspace, should we invalidate all search caches for that workspace? Or use time-based TTL only? Recommend: invalidate on index update (tie into existing Inngest indexing workflows) + short TTL as safety net.

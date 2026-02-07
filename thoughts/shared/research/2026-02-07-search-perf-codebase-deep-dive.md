---
date: 2026-02-07
researcher: codebase-agent
topic: "v1/search API performance optimization"
tags: [research, codebase, search, performance]
status: complete
---

# Codebase Deep Dive: Search Performance Optimization

## Research Question
How can we optimize the v1/search pipeline that currently takes 6-7s in balanced mode?

## Summary

The v1/search API pipeline consists of 7 sequential stages: authentication, body parsing, workspace config lookup, embedding generation, 4-path parallel search, reranking, and result enrichment. The pipeline is fundamentally **waterfall-shaped** with three external API calls executed sequentially: Cohere embedding (~200-400ms), Pinecone vector search (~200-500ms), and Cohere reranking (~200-500ms for balanced mode).

The 4-path parallel search stage is well-optimized with `Promise.all` for vector/entity/cluster/actor paths, but the **embedding generation is sequential and blocks the entire parallel search**. The workspace config is cached in Redis (1h TTL), which is good, but there is **no embedding caching** at all - identical queries regenerate embeddings every time. The **enrichment stage makes 2 sequential DB queries** (observations then entities) that could be parallelized or eliminated.

The most impactful bottlenecks are: (1) the Cohere rerank API call in balanced mode adds 200-500ms, (2) embedding generation is uncached and sequential, (3) the enrichment phase does sequential DB queries for metadata that could be stored in Pinecone metadata, (4) the `normalizeVectorIds` step requires a DB query for legacy vectors, and (5) actor search makes up to 4 sequential DB queries.

## Pipeline Trace

### Stage 1: Authentication (`route.ts:42-44`)
- `withDualAuth()` - validates API key or Clerk session
- **API key path**: hashes key (SHA-256), DB lookup by hash, fire-and-forget lastUsedAt update
  - File: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:49-183`
  - `hashApiKey()` uses `crypto.subtle.digest("SHA-256")` - fast, <1ms
  - DB query: `orgApiKeys` table lookup by hash + isActive
  - Non-blocking: `lastUsedAt` update (fire-and-forget)
- **Session path**: Clerk `auth()`, then `validateWorkspaceAccess()` which does DB lookup + dynamic import of clerk-cache
  - File: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:50-183`
  - Dynamic import: `await import("@repo/console-clerk-cache")` on session path
- **Estimated latency**: 10-50ms (API key) / 50-200ms (session)

### Stage 2: Body Parsing (`route.ts:62-96`)
- `request.json()` + Zod schema validation (`V1SearchRequestSchema`)
- **Estimated latency**: <5ms

### Stage 3: Search Logic Entry (`search.ts:28-192`)
- `searchLogic()` orchestrates the pipeline
- File: `apps/console/src/lib/v1/search.ts:28-192`

### Stage 4: Four-Path Parallel Search (`four-path-search.ts:362-524`)

#### Step 4a: Workspace Config Lookup (`four-path-search.ts:369`)
- `getCachedWorkspaceConfig(workspaceId)`
- File: `packages/console-workspace-cache/src/config.ts:27-67`
- **Redis cache** with 1h TTL - cache hit returns immediately
- **Cache miss**: 3 parallel DB queries (workspace settings, cluster count, actor count)
- **Estimated latency**: 5-20ms (cache hit) / 100-300ms (cache miss)

#### Step 4b: Embedding Generation (`four-path-search.ts:378-394`)
- `createEmbeddingProviderForWorkspace()` creates a new `CohereEmbedding` instance every call
  - File: `packages/console-embed/src/utils.ts:150-160`
  - Instantiates new `CohereClient` each time (no connection pooling/reuse)
- `embedding.embed([query])` - single query text to Cohere API
  - File: `vendor/embed/src/provider/cohere.ts:102-139`
  - Model: `embed-english-v3.0`, dimension: 1024, inputType: `search_query`
  - Single API call to Cohere's embed endpoint
- **No caching of query embeddings** - same query regenerates embedding every time
- **Estimated latency**: 200-400ms (external API call to Cohere)

#### Step 4c: 4-Path Parallel Retrieval (`four-path-search.ts:400-457`)
All 4 paths execute in `Promise.all`:

**Path 1: Vector Search (Pinecone)** (`four-path-search.ts:402-420`)
- `pineconeClient.query<VectorMetadata>(indexName, {...}, namespaceName)`
  - File: `packages/console-pinecone/src/client.ts:125-131` -> `vendor/pinecone/src/client.ts:218-244`
  - topK: `limit * 2` (over-fetches for reranking, e.g., 20 for limit=10)
  - `includeMetadata: true`
  - Filter: `{ layer: { $eq: "observations" } }` + optional source/type/actor/date filters
  - Uses workspace-specific index and namespace
- **Estimated latency**: 200-500ms (network + Pinecone query)

**Path 2: Entity Search** (`four-path-search.ts:423-432`)
- `searchByEntities(query, workspaceId, topK)`
  - File: `apps/console/src/lib/neural/entity-search.ts:71-153`
  - Step 1: Regex pattern extraction from query (local, <1ms)
  - Step 2: If entities found, DB query for `workspaceNeuralEntities` by key match
  - Step 3: DB query for `workspaceNeuralObservations` by internal IDs
  - **2 sequential DB queries** if entities are found
  - Returns early with `[]` if no entity patterns in query (most common case)
- **Estimated latency**: 0ms (no entities) / 50-150ms (with entity matches)

**Path 3: Cluster Search** (`four-path-search.ts:435-444`)
- Only executes if `hasClusters === true` (from workspace config)
- `searchClusters(workspaceId, indexName, namespaceName, queryVector, 3)`
  - File: `apps/console/src/lib/neural/cluster-search.ts:19-94`
  - Step 1: Pinecone query with `filter: { layer: { $eq: "clusters" } }`, topK=3
  - Step 2: DB query for `workspaceObservationClusters` by embedding IDs
  - **2 sequential operations**: Pinecone query -> DB enrichment
- **Estimated latency**: 0ms (skipped) / 150-400ms (Pinecone + DB)

**Path 4: Actor Search** (`four-path-search.ts:447-456`)
- Only executes if `hasActors === true`
- `searchActorProfiles(workspaceId, query, 5)`
  - File: `apps/console/src/lib/neural/actor-search.ts:50-195`
  - Step 1: DB query for workspace's `clerkOrgId` (`orgWorkspaces`)
  - Step 2: Extract @mentions from query
  - Step 3: If mentions, DB query for `orgActorIdentities`, then DB query for `workspaceActorProfiles`
  - Step 4: DB query for `workspaceActorProfiles` by displayName ILIKE
  - Step 5: DB query for `orgActorIdentities` to get avatar URLs
  - **Up to 5 sequential DB queries** in worst case (mention + name search)
- **Estimated latency**: 0ms (skipped) / 100-400ms (multiple DB queries)

#### Step 4d: Vector ID Normalization (`four-path-search.ts:472-478`)
- `normalizeVectorIds(workspaceId, vectorMatches, requestId)`
  - File: `four-path-search.ts:82-210`
  - Separates Phase 3 vectors (have `observationId` in metadata) from legacy vectors
  - Phase 3 vectors: direct ID extraction from metadata (O(n), no DB)
  - Legacy vectors: **DB query** to resolve vector IDs to observation IDs
  - Queries `workspaceNeuralObservations` with 4x `inArray()` conditions (title/content/summary/legacy embedding IDs)
- **Estimated latency**: 0ms (all Phase 3) / 50-200ms (legacy vectors requiring DB lookup)

#### Step 4e: Merge Results (`four-path-search.ts:488-492`)
- `mergeSearchResults()` - in-memory Map merge + score boosting
- **Estimated latency**: <1ms

### Stage 5: Reranking (`search.ts:48-67`)
- `createRerankProvider(mode)` creates provider instance
  - File: `packages/console-rerank/src/factory.ts:35-48`

**Fast mode**: `PassthroughRerankProvider`
  - File: `packages/console-rerank/src/providers/passthrough.ts:24-55`
  - No external call, just sorts by existing score
  - **Estimated latency**: <1ms

**Balanced mode**: `CohereRerankProvider`
  - File: `packages/console-rerank/src/providers/cohere.ts:52-201`
  - Creates new `CohereClient` instance each time
  - Model: `rerank-v3.5`
  - Sends all candidates with `topN: candidates.length` (gets all scores)
  - Documents formatted as `"${title}: ${content}"`
  - **External API call to Cohere rerank endpoint**
  - Threshold filtering at 0.4, with `minResults` fallback guarantee
  - **Estimated latency**: 200-500ms (external API call)

**Thorough mode**: `LLMRerankProvider`
  - File: `packages/console-rerank/src/providers/llm.ts:97-290`
  - Uses Claude Haiku 4.5 via Vercel AI Gateway (`generateObject`)
  - Bypassed if candidates <= 5
  - Structured output with relevance scoring prompt
  - Combined score: 0.6 * LLM relevance + 0.4 * vector score
  - **Estimated latency**: 500-2000ms (LLM API call)

### Stage 6: Enrichment (`search.ts:87-91`)
- `enrichSearchResults(paginatedResults, candidates, workspaceId)`
  - File: `four-path-search.ts:553-657`
  - **Query 1**: `workspaceNeuralObservations` by `externalId` (paginated result IDs)
    - Fetches: title, source, observationType, occurredAt, metadata, sourceReferences
    - Skips `content` column (uses candidate snippet from Pinecone)
  - **Query 2**: `workspaceNeuralEntities` by internal observation IDs (sequential, after Query 1)
    - Gets entity keys and categories
  - **2 sequential DB queries** - Query 2 depends on Query 1's internal IDs
- **Estimated latency**: 50-200ms (2 sequential DB queries)

### Stage 7: Response Building (`search.ts:95-161`)
- In-memory mapping, context extraction from search results
- `recordSystemActivity()` is fire-and-forget (non-blocking Inngest call)
  - File: `api/console/src/lib/activity.ts:313+`
- **Estimated latency**: <1ms

## Detailed Findings

### Embedding Generation
- **Provider**: Cohere `embed-english-v3.0`
- **Dimension**: 1024
- **Input type**: `search_query` for queries, `search_document` for indexing
- **Implementation**: `vendor/embed/src/provider/cohere.ts:102-139`
- **Critical issue**: A new `CohereClient` is instantiated for every search request via `createEmbeddingProviderForWorkspace()` (`packages/console-embed/src/utils.ts:150-160`). This means no HTTP connection reuse.
- **No caching**: Identical queries generate fresh embeddings every time. There is zero embedding cache anywhere in the codebase.
- **Single text**: Only 1 query string is embedded per search (no batching concern for queries)

### Vector Search (Pinecone)
- **Client**: `@pinecone-database/pinecone` SDK wrapped in `vendor/pinecone/src/client.ts`
- **Singleton**: `consolePineconeClient` is a module-level singleton (`packages/console-pinecone/src/client.ts:160`)
- **Index/Namespace**: Workspace-specific, from `CachedWorkspaceConfig`
- **topK**: `limit * 2` (double requested limit for reranking headroom)
- **Metadata included**: Yes, `includeMetadata: true`
- **Filter**: `layer: "observations"` + optional source/type/actor/date filters
- **Metric**: Cosine similarity (from `PINECONE_CONFIG`)

### Reranking
- **Fast**: Passthrough, 0ms overhead
- **Balanced**: Cohere `rerank-v3.5` API, ~200-500ms. New `CohereClient` per call.
- **Thorough**: Claude Haiku 4.5 via AI Gateway, ~500-2000ms. Uses `generateObject` structured output.
- **Key detail**: Balanced mode creates documents as `"${title}: ${content}"` strings, requests all scores (`topN: candidates.length`), then filters client-side at threshold 0.4.

### Database Queries
All DB queries go through Drizzle ORM to PlanetScale. During a typical balanced search:

1. **Auth**: 1 query (`orgApiKeys` by hash) - sequential
2. **Workspace config** (on cache miss): 3 parallel queries (workspace, cluster count, actor count)
3. **Entity search**: 0-2 sequential queries (if entities found in query)
4. **Cluster search**: 1 Pinecone query + 1 DB query (sequential, if clusters exist)
5. **Actor search**: 1-5 sequential DB queries (if actors exist)
6. **Normalize vector IDs**: 0-1 DB query (only for legacy vectors)
7. **Enrichment**: 2 sequential queries (observations, then entities)

**Total worst case**: ~12 DB queries, many sequential.
**Best case** (API key, cached config, no entities/actors/clusters, all Phase 3 vectors): 1 auth + 0 config + 0 entity + 0 normalize + 2 enrich = 3 DB queries.

### Context Enrichment
- `includeContext: true` (default) extracts cluster and actor data from the **already-fetched** 4-path search results
- File: `search.ts:112-124`
- **No additional queries** - just slices from existing results
- Clusters: top 2 with topic, summary, keywords
- Actors: top 3 with displayName, expertiseDomains

### Highlights Generation
- `includeHighlights: true` (default) is **trivially computed**
- File: `search.ts:106-108`
- Simply wraps the existing title and snippet: `{ title: r.title, snippet: r.snippet }`
- **No additional processing** - no actual highlight generation (no term matching, no bolding)
- **Estimated latency**: 0ms

## Parallelism Analysis

### Currently Parallel
- 4-path search (vector, entity, cluster, actor) via `Promise.all` - **good**
- Workspace config DB queries (on cache miss) via `Promise.all` - **good**
- `recordSystemActivity()` is fire-and-forget - **good**
- API key `lastUsedAt` update is non-blocking - **good**

### Currently Sequential (Could Be Parallelized)
1. **Embedding generation blocks parallel search**: Embedding must complete before any of the 4 paths can start. Entity search and actor search don't need the embedding vector.
2. **Enrichment queries are sequential**: Observation query, then entity query. The entity query depends on internal IDs from observations, but could be restructured.
3. **normalizeVectorIds is sequential after parallel search**: Runs after all 4 paths complete, but only needs vector results.
4. **Actor search internally sequential**: workspace lookup -> mention search -> profile lookup -> name search -> avatar lookup. Several of these could be parallelized.
5. **Cluster search internally sequential**: Pinecone query -> DB enrichment.

### Optimization Opportunities
1. **Start entity search and actor search in parallel with embedding generation** - they don't need the query vector
2. **Overlap normalizeVectorIds with reranking** - normalization could start as soon as vector results arrive, rather than waiting for all 4 paths
3. **Parallelize enrichment queries** - use a JOIN or pre-fetch entities alongside observations
4. **Move enrichment data to Pinecone metadata** - if observation metadata (source, type, occurredAt, entities) were stored in Pinecone, enrichment DB queries could be eliminated entirely

## Caching Analysis

### Currently Cached
- **Workspace config**: Redis with 1h TTL (`packages/console-workspace-cache/src/config.ts`)
  - Cache key: workspace-specific
  - Contains: indexName, namespaceName, embeddingModel, embeddingDim, hasClusters, hasActors
- **Clerk user org memberships**: Referenced in session auth path (`@repo/console-clerk-cache`)

### Not Cached (Should Be)
1. **Query embeddings**: Identical queries to Cohere generate fresh embeddings every time. A Redis cache keyed on `hash(query + model + inputType)` could save 200-400ms for repeat queries.
2. **Full search results**: No response-level caching. Popular/recent queries could be cached at the response level with short TTL (30-60s).
3. **Cohere rerank responses**: No caching of rerank results. Same query+candidates could be cached.
4. **Entity search results**: No caching of entity pattern matches or DB lookups.
5. **Pinecone client instances**: `CohereClient` for embedding and reranking are recreated per request - no connection pooling.

### Caching Not Needed
- `recordSystemActivity` - fire-and-forget, unique per request
- Body parsing - fast, <5ms

## N+1 and Hot Path Issues

### N+1 Patterns
1. **Actor search avatar lookup** (`actor-search.ts:147-163`): Fetches actor profiles, then makes a separate query for avatar URLs from identity table. Could be a JOIN.
2. **Actor search mention resolution** (`actor-search.ts:73-129`): Finds identities, then makes separate query for profiles. Could be a JOIN.

### Hot Path Issues
1. **New CohereClient per request**: Both embedding and reranking create new `CohereClient()` instances each call. This prevents HTTP keep-alive/connection reuse.
   - Embedding: `packages/console-embed/src/utils.ts:154` -> `vendor/embed/src/provider/cohere.ts:88`
   - Reranking: `packages/console-rerank/src/providers/cohere.ts:64`
2. **Dynamic import in session auth**: `await import("@repo/console-clerk-cache")` in `with-dual-auth.ts:222`. Dynamic imports add overhead on first call.
3. **Console.log in auth** (`with-dual-auth.ts:56`): `console.log(request.headers)` logs all headers on every request. Should be removed or converted to debug log.
4. **Over-fetching topK**: Vector search uses `topK = limit * 2` (e.g., 20 for limit=10). After reranking, only `limit` results are used. The extra results require more normalization and enrichment work.

## Bottleneck Summary (Ranked)

### Tier 1: Major Bottlenecks (200-500ms each)
1. **Cohere Embedding API call** (~200-400ms) - uncached, sequential, blocks all parallel search paths
2. **Cohere Rerank API call in balanced mode** (~200-500ms) - sequential, after search completes
3. **Pinecone vector search** (~200-500ms) - unavoidable external call, but blocked by embedding

### Tier 2: Significant Bottlenecks (50-200ms each)
4. **Enrichment DB queries** (~50-200ms) - 2 sequential queries that could be eliminated or parallelized
5. **normalizeVectorIds for legacy vectors** (~50-200ms) - DB query for vector ID -> observation ID mapping
6. **Actor search multi-query waterfall** (~100-400ms) - up to 5 sequential DB queries
7. **Authentication DB query** (~10-50ms) - API key hash lookup

### Tier 3: Minor Issues (<50ms each)
8. **New CohereClient instances per request** - prevents HTTP connection reuse
9. **console.log(request.headers)** in auth - unnecessary I/O
10. **Dynamic import of clerk-cache** - first-call overhead

### Estimated Total Latency (Balanced Mode, Typical Case)
```
Auth:          ~30ms
Parse:         ~3ms
Config:        ~15ms (cache hit)
Embedding:     ~300ms  ← SEQUENTIAL
4-Path Search: ~400ms  ← PARALLEL (bounded by slowest: Pinecone ~400ms)
Normalize:     ~50ms   ← SEQUENTIAL (if Phase 3 vectors, ~0ms)
Reranking:     ~350ms  ← SEQUENTIAL (Cohere API)
Enrichment:    ~120ms  ← SEQUENTIAL (2 DB queries)
Response:      ~1ms
─────────────────────
ESTIMATED:     ~1,270ms (best case, all cached/Phase 3)
ACTUAL:        ~6,000-7,000ms (suggests cold paths, network latency, or larger datasets)
```

The gap between estimated (~1.3s) and actual (~6-7s) suggests:
- Pinecone queries may be much slower with larger indexes
- Cold start / connection establishment overhead
- PlanetScale latency may be higher than estimated (especially for multi-query actor search)
- Network latency between regions (app server, Pinecone, Cohere, PlanetScale)

## Code References

| Component | File | Key Lines |
|-----------|------|-----------|
| Route handler | `apps/console/src/app/(api)/v1/search/route.ts` | 34-149 |
| Search logic | `apps/console/src/lib/v1/search.ts` | 28-192 |
| 4-path search | `apps/console/src/lib/neural/four-path-search.ts` | 362-524 |
| Vector ID normalize | `apps/console/src/lib/neural/four-path-search.ts` | 82-210 |
| Result enrichment | `apps/console/src/lib/neural/four-path-search.ts` | 553-657 |
| Entity search | `apps/console/src/lib/neural/entity-search.ts` | 71-153 |
| Cluster search | `apps/console/src/lib/neural/cluster-search.ts` | 19-94 |
| Actor search | `apps/console/src/lib/neural/actor-search.ts` | 50-195 |
| Workspace cache | `packages/console-workspace-cache/src/config.ts` | 27-67 |
| Embedding provider | `packages/console-embed/src/utils.ts` | 150-160 |
| Cohere embedding | `vendor/embed/src/provider/cohere.ts` | 77-139 |
| Rerank factory | `packages/console-rerank/src/factory.ts` | 35-48 |
| Cohere rerank | `packages/console-rerank/src/providers/cohere.ts` | 52-201 |
| LLM rerank | `packages/console-rerank/src/providers/llm.ts` | 97-290 |
| Passthrough rerank | `packages/console-rerank/src/providers/passthrough.ts` | 24-55 |
| Pinecone client | `packages/console-pinecone/src/client.ts` | 19-161 |
| Vendor Pinecone | `vendor/pinecone/src/client.ts` | 218-244 |
| API key auth | `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts` | 49-183 |
| Dual auth | `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts` | 50-183 |
| Activity recording | `api/console/src/lib/activity.ts` | 313+ |
| Embedding config | `packages/console-config/src/private-config.ts` | 145-193 |

---
date: 2025-12-15T08:51:36Z
researcher: Claude
git_commit: b6cc18daffa893e5b11b97699fd7dab459f0878b
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Performance analysis of v1 API routes and optimal architecture design"
tags: [research, performance, v1-api, search, findsimilar, contents, pinecone, planetscale, optimization]
status: complete
last_updated: 2025-12-15
last_updated_by: Claude
last_updated_note: "Added pre-production checklist with critical items vs post-launch nice-to-haves"
---

# Research: v1 Route Performance & Optimal Architecture

**Date**: 2025-12-15T08:51:36Z
**Researcher**: Claude
**Git Commit**: b6cc18daffa893e5b11b97699fd7dab459f0878b
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Analyze the performance characteristics of each route in `apps/console/src/app/(api)/v1/` and determine the most performant architecture. Consider optimizations from the neural memory e2e design document, specifically reducing database queries by leveraging Pinecone metadata.

---

## Executive Summary

### Current Performance Profile

| Route | DB Queries | External API Calls | Latency (p95) | Parallelism |
|-------|------------|-------------------|---------------|-------------|
| `/v1/search` | 4-12 | 2-6 | 250-1200ms | 4-path parallel |
| `/v1/findsimilar` | 4-7 | 2-3 | 260-1350ms | Sequential |
| `/v1/contents` | 2-3 | 0-1 | 100-600ms | 2-path parallel |

### Key Bottlenecks

1. **Network Latency**: Development from AU→US adds ~220ms RTT per external call
2. **Pinecone**: Vector searches (50-100ms actual, inflated by network)
3. **Clerk API**: Session auth requires org membership lookup (~50-80ms)
4. **Sequential DB Queries**: Enrichment runs after search instead of being eliminated

### Optimization Potential

| Optimization | Impact | Effort |
|--------------|--------|--------|
| Store enrichment in Pinecone metadata | -15-40ms | Medium |
| Cache auth (session) | -50-80ms | Low |
| Cache embeddings | -150-200ms | Low |
| Skip empty paths (clusters/actors) | -50-100ms | Low |
| Full result caching | ~10ms total | Medium |

**Expected Production Latency (with optimizations)**: 50-150ms for cached paths, 200-300ms for cold paths

---

## Part 1: Route-by-Route Analysis

### 1.1 `/v1/search` Route

**File**: `apps/console/src/app/(api)/v1/search/route.ts`

#### Request Flow

```
POST /v1/search
  │
  ├─→ 1. Auth (50-200ms)
  │   ├─ API Key: Hash + DB lookup
  │   └─ Session: Clerk API + DB lookup
  │
  ├─→ 2. Validation (1-5ms)
  │   └─ Zod schema parse
  │
  ├─→ 3. 4-Path Parallel Search (50-200ms in-region)
  │   ├─→ Vector (Pinecone) ─────┐
  │   ├─→ Entity (PlanetScale) ──┼─→ Promise.all
  │   ├─→ Cluster (Pinecone+PS) ─┤
  │   └─→ Actor (PlanetScale) ───┘
  │
  ├─→ 4. Normalization (10-100ms)
  │   └─ Vector ID → Observation ID mapping
  │
  ├─→ 5. Rerank (0-500ms)
  │   ├─ fast: 0ms (passthrough)
  │   ├─ balanced: 100-200ms (Cohere)
  │   └─ thorough: 200-500ms (Claude Haiku)
  │
  └─→ 6. Enrichment (15-40ms)
      └─ 2 sequential DB queries
```

#### Database Query Count: 4-12 queries

**Unconditional (minimum 4):**
1. Workspace config lookup (`four-path-search.ts:358`)
2. Observations enrichment (`four-path-search.ts:557`)
3. Entities enrichment (`four-path-search.ts:579`)
4. Auth query (API key or workspace lookup)

**Conditional (up to 8 more):**
- Entity search: 2 queries if patterns matched
- Cluster search: 1 query for metadata enrichment
- Actor search: 1-3 queries depending on mentions
- Vector normalization: 1 query for legacy vectors

#### External API Calls: 2-6 calls

| Call | When | Latency |
|------|------|---------|
| Embedding (Voyage AI) | Always | 100-300ms |
| Pinecone (vector) | Always | 50-150ms |
| Pinecone (cluster) | Always | 30-80ms |
| Clerk API | Session auth only | 50-80ms |
| Cohere rerank | Balanced mode | 100-200ms |
| Claude Haiku | Thorough mode | 200-500ms |

#### Performance Characteristics

**Parallelism**: Excellent - 4 search paths run concurrently
- `four-path-search.ts:396-449` uses `Promise.all()`
- Total latency = MAX(vector, entity, cluster, actor)
- Reported as `maxParallel` in response metrics

**Bottleneck**: Embedding generation (sequential, before parallel)
- Must complete before parallel search can start
- ~100-300ms overhead on every request

**No Caching**: Every request generates fresh embedding, queries Pinecone, enriches from DB

---

### 1.2 `/v1/findsimilar` Route

**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

#### Request Flow

```
POST /v1/findsimilar
  │
  ├─→ 1. Auth (50-200ms)
  │
  ├─→ 2. Source Resolution (20-100ms)
  │   ├─ URL → sourceId lookup (optional)
  │   └─ Content fetch from DB
  │
  ├─→ 3. Workspace Config (10-50ms)
  │
  ├─→ 4. Embedding Generation (100-500ms)
  │   └─ Cohere embed-english-v3.0
  │
  ├─→ 5. Pinecone Query (50-300ms)
  │   └─ topK = limit * 3 (over-fetch)
  │
  ├─→ 6. Normalization (10-100ms)
  │   └─ Multi-view deduplication
  │
  └─→ 7. Enrichment (20-100ms)
      └─ Batch DB query
```

#### Database Query Count: 4-7 queries

**Flow:**
1. Auth: 1 query (API key or workspace lookup)
2. URL resolution: 1-2 queries (observations + documents fallback)
3. Source content: 1 query
4. Workspace config: 1 query
5. Vector normalization: 0-1 queries (Phase 3 uses metadata)
6. Enrichment: 1 query

#### External API Calls: 2-3 calls

| Call | When | Latency |
|------|------|---------|
| Clerk API | Session auth only | 50-80ms |
| Embedding (Cohere) | Always | 100-500ms |
| Pinecone query | Always | 50-300ms |

#### Performance Characteristics

**Parallelism**: NONE - All operations are sequential
- Major optimization opportunity
- Workspace config could run in parallel with source resolution

**Over-fetching Strategy**: topK = limit × 3
- Accounts for multi-view deduplication
- Same observation may have 3 vectors (title, content, summary)

**No Caching**: Source embeddings regenerated on every request

---

### 1.3 `/v1/contents` Route

**File**: `apps/console/src/app/(api)/v1/contents/route.ts`

#### Request Flow

```
POST /v1/contents
  │
  ├─→ 1. Auth (50-200ms)
  │
  ├─→ 2. ID Separation (1ms)
  │   ├─ doc_* → Documents
  │   └─ Other → Observations
  │
  └─→ 3. Parallel Fetch (20-100ms)
      ├─→ Observations ──┐
      │   └─ resolveObservationsById()
      └─→ Documents ─────┴─→ Promise.all
```

#### Database Query Count: 2-3 queries

1. Auth: 1 query
2. Observations resolution: 1 query (batch `inArray`)
3. Documents fetch: 1 query (batch `inArray`)

#### External API Calls: 0-1 calls

| Call | When | Latency |
|------|------|---------|
| Clerk API | Session auth only | 50-80ms |

#### Performance Characteristics

**Parallelism**: Good - Observations and documents fetched concurrently
- `route.ts:89-119` uses `Promise.all()`

**Batch Efficiency**: Excellent
- Uses `inArray()` for batch lookups
- Handles up to 50 IDs per request
- N+1 problem avoided

**Key Difference from Search**: Returns FULL content, not snippets
- `route.ts:131`: `content: obs.content`
- Designed for hydrating search results

---

## Part 2: Comparison with Neural Memory E2E Design

### 2.1 Design Document Recommendations

From `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`:

#### Recommendation 1: Store Enrichment Data in Pinecone Metadata

**Current State**: After Pinecone returns results, we query PlanetScale for:
- Observation metadata (title, URL, timestamps)
- Entities linked to observations
- Cluster information

**E2E Design Recommendation**:
```typescript
// When indexing, include enrichment fields in Pinecone metadata:
const metadata: VectorMetadata = {
  observationId: observation.externalId,
  title: observation.title,
  snippet: observation.content.slice(0, 200),
  layer: "observations",
  // ADD THESE to eliminate enrichment queries:
  url: observation.metadata?.url ?? "",
  source: observation.source,
  observationType: observation.observationType,
  occurredAt: observation.occurredAt.toISOString(),
  actorName: observation.actorName ?? "",
};
```

**Impact**: Eliminates 2 database queries (observations + entities) for fast mode

#### Recommendation 2: Phase 3 Vector ID Optimization

**Already Implemented**: `normalizeVectorIds()` in `four-path-search.ts:78-113`
- New vectors include `metadata.observationId`
- Direct mapping without database lookup
- Only legacy vectors require DB fallback

**Metrics**: `phase3Direct` vs `phase2Lookup` counts logged

#### Recommendation 3: 2-Key Retrieval (Vector + LLM Gating)

**Current Implementation**: Mode-based reranking
- `fast`: Passthrough (vector scores only)
- `balanced`: Cohere semantic rerank
- `thorough`: LLM relevance filtering (Claude Haiku)

**Alignment**: Current implementation follows 2-key pattern:
- Key 1: Vector search (high recall)
- Key 2: Reranking (high precision)

---

### 2.2 Gap Analysis

| E2E Design Feature | Current State | Gap |
|-------------------|---------------|-----|
| Enrichment in metadata | Partial (title, snippet) | Missing: URL, source, type, timestamp |
| Phase 3 ID optimization | Implemented | ✓ Complete |
| 2-key retrieval | Implemented via modes | ✓ Complete |
| Entity store lookup | Implemented | ✓ Complete |
| Cluster context | Implemented | ✓ Complete |
| Actor profiles | Implemented | ✓ Complete |
| Caching | Not implemented | Major gap |
| Workspace config caching | Not implemented | Gap |
| Auth caching | Not implemented | Gap |

---

## Part 3: Optimal Architecture Design

### 3.1 Recommended Architecture Changes

#### Change 1: Expand Pinecone Metadata (High Impact)

**Current metadata schema:**
```typescript
interface VectorMetadata {
  observationId: string;
  title: string;
  snippet: string;
  layer: "observations" | "clusters" | "profiles";
  source?: string;
  observationType?: string;
}
```

**Proposed metadata schema:**
```typescript
interface VectorMetadata {
  observationId: string;
  title: string;
  snippet: string;
  layer: "observations" | "clusters" | "profiles";
  // ADD for enrichment elimination:
  source: string;
  sourceId: string;
  observationType: string;
  occurredAt: string;  // ISO timestamp
  actorName: string;
  url: string;         // Pre-computed source URL
}
```

**Impact**:
- Eliminates `enrichSearchResults()` for fast mode
- Saves 2 DB queries (15-40ms)
- Pinecone metadata limit: 40KB per vector (sufficient)

#### Change 2: Implement Caching Layer

**Layer 1: Auth Cache (Upstash Redis)**
```typescript
// Cache: `auth:${userId}:${workspaceId}` → "ok"
// TTL: 5 minutes
// Impact: -50-80ms per request
```

**Layer 2: Embedding Cache (Upstash Redis)**
```typescript
// Cache: `emb:${workspaceId}:${queryHash}` → float[]
// TTL: 24 hours (embeddings are deterministic)
// Impact: -100-300ms for repeat queries
```

**Layer 3: Workspace Config Cache (In-memory LRU)**
```typescript
// Cache: `ws:${workspaceId}` → { indexName, namespaceName, embeddingModel }
// TTL: 1 hour
// Impact: -10-50ms per request
```

**Layer 4: Full Result Cache (Upstash Redis)**
```typescript
// Cache: `search:${workspaceId}:${queryHash}:${mode}` → V1SearchResponse
// TTL: 5 minutes (configurable)
// Impact: ~10ms total for cache hits
```

#### Change 3: Conditional Path Execution

**Current**: All 4 paths always execute
**Proposed**: Skip paths with no data

```typescript
const workspaceCaps = await getCachedWorkspaceCaps(workspaceId);

const searches = await Promise.all([
  vectorSearch(),  // Always
  entitySearch(),  // Always (fast anyway)
  workspaceCaps.hasClusters ? clusterSearch() : EMPTY_RESULT,
  workspaceCaps.hasActors ? actorSearch() : EMPTY_RESULT,
]);
```

**Impact**: -50-100ms when workspace lacks clusters/actors

#### Change 4: Parallelize findsimilar Operations

**Current**: Sequential operations
**Proposed**: Parallel where possible

```typescript
// Run workspace config and source resolution in parallel
const [workspace, sourceContent] = await Promise.all([
  getWorkspaceConfig(workspaceId),  // Currently sequential
  fetchSourceContent(workspaceId, id, url),  // Currently sequential
]);
```

**Impact**: -10-50ms per request

---

### 3.2 Projected Latencies with Optimizations

#### v1/search

| Scenario | Current | Optimized |
|----------|---------|-----------|
| Cold path (no cache) | 300-400ms | 200-300ms |
| Auth cached | 300-400ms | 220-320ms |
| Auth + embedding cached | - | 100-150ms |
| Full result cached | - | ~10ms |

#### v1/findsimilar

| Scenario | Current | Optimized |
|----------|---------|-----------|
| Cold path | 400-700ms | 300-500ms |
| With parallel ops | - | 250-400ms |
| Source embedding cached | - | 100-200ms |

#### v1/contents

| Scenario | Current | Optimized |
|----------|---------|-----------|
| Cold path | 100-600ms | 50-150ms |
| Auth cached | - | 20-100ms |

---

## Part 4: Implementation Priorities

### Pre-Production: CRITICAL (Do Now)

These are **blocking for production launch**:

#### 1. Regional Deployment (Automatic)
**Impact**: 4000ms → 300-400ms | **Effort**: Config only

- Verify Vercel deployment region is US East (`iad1` or `cle1`)
- All services (Pinecone, PlanetScale, Clerk, OpenAI) are US-based
- This single change eliminates ~3s of network latency

#### 2. Auth Caching
**Impact**: -50-80ms per request, prevents Clerk rate limits | **Effort**: 2-4 hours

- Location: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:139`
- Cache key: `auth:${userId}:${workspaceId}`
- TTL: 5 minutes
- Storage: Upstash Redis

**Why critical**: Without this, every session-authenticated request makes a Clerk API call. Under production load:
- Risk of hitting Clerk rate limits
- Every request pays 50-80ms penalty
- Single point of failure if Clerk is slow

```typescript
// Implementation sketch for with-dual-auth.ts
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

async function validateWorkspaceAccess(workspaceId: string, userId: string) {
  const cacheKey = `auth:${userId}:${workspaceId}`;

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached === "ok") {
    return { success: true };
  }

  // ... existing Clerk API call ...

  // Cache success for 5 minutes
  await redis.set(cacheKey, "ok", { ex: 300 });
  return result;
}
```

#### 3. Embedding Caching
**Impact**: -100-300ms for repeat queries, reduces API costs | **Effort**: 2-4 hours

- Location: `apps/console/src/lib/neural/four-path-search.ts:384`
- Cache key: `emb:${workspaceId}:${SHA256(query.toLowerCase().trim())}`
- TTL: 24 hours (embeddings are deterministic)
- Storage: Upstash Redis

**Why critical**:
- Every search costs money (Voyage AI API call)
- Same query always produces identical embedding
- Common queries will repeat across users

```typescript
// Implementation sketch for four-path-search.ts
import { createHash } from "crypto";

function hashQuery(query: string): string {
  return createHash("sha256")
    .update(query.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

// Before embedding generation:
const embeddingCacheKey = `emb:${workspaceId}:${hashQuery(query)}`;
const cachedEmbedding = await redis.get<number[]>(embeddingCacheKey);

if (cachedEmbedding) {
  queryVector = cachedEmbedding;
} else {
  const { embeddings } = await embedding.embed([query]);
  queryVector = embeddings[0];
  // Cache for 24h
  await redis.set(embeddingCacheKey, queryVector, { ex: 86400 });
}
```

### Pre-Production Checklist

```
[ ] Verify Vercel deployment region is US East (iad1 or cle1)
[ ] Implement auth caching (Upstash Redis, 5min TTL)
[ ] Implement embedding caching (Upstash Redis, 24h TTL)
[ ] Load test to verify latency targets (<300ms p95)
```

**Expected production latency with these 3 items**: 100-300ms (p95)

---

### Post-Launch: Nice-to-Have

These optimizations can wait until after launch:

#### Tier 1: Quick Wins (1-2 days each)

1. **Skip empty paths** - Low effort, -50-100ms
   - Location: `four-path-search.ts:396`
   - Check workspace capabilities once, cache result
   - Only matters for workspaces without clusters/actors

2. **Workspace config caching** - Low effort, -10-50ms
   - Location: `four-path-search.ts:358`
   - In-memory LRU cache, 1 hour TTL

#### Tier 2: Medium Effort (3-5 days each)

3. **Expand Pinecone metadata** - Medium effort, -15-40ms
   - Location: Ingestion pipeline (`neural/observation.capture`)
   - Add: `url`, `occurredAt`, `actorName`
   - Update `enrichSearchResults()` to use metadata for fast mode

4. **Parallelize findsimilar** - Medium effort, -10-50ms
   - Location: `findsimilar/route.ts:263-288`
   - Run workspace config + source resolution in parallel

5. **Full result caching** - Medium effort, ~10ms
   - Location: `search/route.ts`
   - Requires cache invalidation strategy when observations change

#### Tier 3: Infrastructure

6. **Warm Pinecone connections** - Medium impact
   - Keep SDK connections warm between requests
   - Use Vercel `waitUntil` or background warming

---

## Code References

### Route Files
- `apps/console/src/app/(api)/v1/search/route.ts` - Main search endpoint
- `apps/console/src/app/(api)/v1/findsimilar/route.ts` - Similar content endpoint
- `apps/console/src/app/(api)/v1/contents/route.ts` - Content hydration endpoint

### Shared Utilities
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts` - Dual auth middleware
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts` - API key auth
- `apps/console/src/lib/neural/four-path-search.ts` - 4-path parallel search
- `apps/console/src/lib/neural/id-resolver.ts` - ID resolution utilities
- `apps/console/src/lib/neural/url-builder.ts` - URL construction

### Rerank Providers
- `packages/console-rerank/src/providers/passthrough.ts` - Fast mode
- `packages/console-rerank/src/providers/cohere.ts` - Balanced mode
- `packages/console-rerank/src/providers/llm.ts` - Thorough mode

---

## Historical Context (from thoughts/)

### Related Research
- `thoughts/shared/research/2025-12-14-v1-search-latency-analysis.md` - Network latency breakdown
- `thoughts/shared/research/2025-12-14-balanced-mode-zero-results.md` - Cohere threshold issue
- `thoughts/shared/research/2025-12-14-chunk-reconstruction-patterns.md` - Pinecone metadata patterns

### Related Plans
- `thoughts/shared/plans/2025-12-14-balanced-mode-threshold-latency-fix.md` - Threshold fix
- `thoughts/shared/plans/2025-12-14-neural-memory-week1-public-api-rerank.md` - Rerank improvements

---

## Conclusions

### Most Performant Architecture

1. **Hybrid metadata approach**: Store enrichment data in Pinecone metadata, skip DB enrichment for fast mode
2. **Multi-layer caching**: Auth → Embedding → Workspace config → Full results
3. **Conditional execution**: Skip empty search paths based on workspace capabilities
4. **Maximize parallelism**: Run all independent operations concurrently

### Expected Production Performance

| Percentile | Current (AU dev) | Optimized (US prod) |
|------------|------------------|---------------------|
| p50 | ~3000ms | 100-150ms |
| p95 | ~4500ms | 200-300ms |
| p99 | ~6000ms | 400-500ms |

The most significant improvement comes from:
1. **Regional deployment** (eliminates ~3s network overhead)
2. **Embedding caching** (eliminates ~200ms per repeat query)
3. **Auth caching** (eliminates ~80ms per request)

---

## Open Questions

1. Should balanced mode use a lower Cohere threshold (0.2 vs 0.4) to avoid zero results?
2. What cache invalidation strategy for full result caching when observations change?
3. Should findsimilar support mode-based reranking like search?
4. Is 40KB Pinecone metadata limit sufficient for all enrichment fields?

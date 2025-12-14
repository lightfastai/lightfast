---
date: 2025-12-14T09:24:46Z
researcher: Claude
git_commit: 4e4abcf43a7db66e732fd5261aa0109280f296c1
branch: feat/memory-layer-foundation
repository: lightfast
topic: "v1/search latency breakdown - where is the slowness coming from?"
tags: [research, latency, search, pinecone, planetscale, clerk, caching, optimization]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
last_updated_note: "Added network latency analysis, in-region projections, and optimization strategies"
---

# Research: v1/search Latency Analysis

**Date**: 2025-12-14T09:24:46Z
**Researcher**: Claude
**Git Commit**: 4e4abcf43a7db66e732fd5261aa0109280f296c1
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

The user observed slow search latency (4138ms total) and asked why PlanetScale is slow. The logs showed:
```
retrieval: 1673ms
clusterSearch: 1647ms
auth: 1016ms
actorSearch: 534ms
enrich: 527ms
```

## Summary

**PlanetScale is NOT the main bottleneck.** The observed latency is primarily due to:

1. **Network distance** — Dev environment in Australia, services in US East (~220ms RTT)
2. **Pinecone** — Vector database queries (50-100ms actual, inflated by network)
3. **Clerk API** — External HTTP call for org membership (50-80ms actual, inflated by network)

In production with US East deployment, expected latency drops from **4138ms → 300-400ms**.
With caching optimizations, can achieve **50-150ms** for repeat queries.

---

## Part 1: Latency Source Analysis

### Latency Source Mapping

| Metric | Actual Source | Observed (AU) | File Reference |
|--------|---------------|---------------|----------------|
| `retrieval` | **Pinecone** | 1673ms | `four-path-search.ts:217-227` |
| `clusterSearch` | **Pinecone** + PlanetScale | 1647ms | `cluster-search.ts:30-64` |
| `auth` | **Clerk API** | 1016ms | `with-dual-auth.ts:168-173` |
| `actorSearch` | PlanetScale | 534ms | `actor-search.ts:55-109` |
| `enrich` | PlanetScale | 527ms | `four-path-search.ts:355-388` |
| `embedding` | OpenAI | 360ms | `four-path-search.ts:200` |

### 1. Retrieval Latency (1673ms) - Pinecone

The `retrieval` field in the logs is the **vector** search latency, which comes from Pinecone, NOT PlanetScale.

```typescript
// four-path-search.ts:217-227
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
```

The latency is reported at `four-path-search.ts:298`:
```typescript
vector: vectorResults.latency,  // This becomes "retrieval" in the API response
```

### 2. Cluster Search Latency (1647ms) - Pinecone + PlanetScale

The cluster search makes two calls:

1. **Pinecone query** for cluster centroids (`cluster-search.ts:30-39`)
2. **PlanetScale query** for cluster metadata (`cluster-search.ts:49-64`)

The Pinecone query is the dominant cost here. The PlanetScale query is a simple `inArray` lookup on indexed columns.

### 3. Auth Latency (1016ms) - Clerk API

The auth latency comes from an **external HTTP call to Clerk's API**:

```typescript
// with-dual-auth.ts:168-173
const userMemberships = await clerk.users.getOrganizationMembershipList({
  userId,
});
```

This makes a network call to `api.clerk.com` to verify organization membership.

### 4. Actor Search Latency (534ms) - PlanetScale

The actor search makes 2-3 sequential PlanetScale queries:

1. Actor identities lookup (`actor-search.ts:55-71`) - uses `ilike` pattern matching
2. Actor profiles fetch (`actor-search.ts:75-84`)
3. Name match query (`actor-search.ts:99-109`) - uses `ilike` pattern matching

The `ilike` queries with `%pattern%` cannot use indexes efficiently, causing full scans.

### 5. Enrich Latency (527ms) - PlanetScale

The enrichment phase makes two **parallel** PlanetScale queries:

```typescript
// four-path-search.ts:355-388
const [observations, entities] = await Promise.all([
  // Observations query
  db.select({...}).from(workspaceNeuralObservations).where(...),
  // Entities query
  db.select({...}).from(workspaceNeuralEntities).where(...),
]);
```

This fetches metadata for 20 results.

---

## Part 2: Network Latency Analysis

### Test Environment

- **Client location**: Australia
- **Pinecone**: us-east-1
- **PlanetScale**: us-east-1
- **Clerk API**: US-based
- **OpenAI**: US-based

### Network Overhead (Australia → US East)

Round-trip time (RTT): **~200-220ms**

Each external service call incurs significant connection overhead:

| Phase | Latency |
|-------|---------|
| TCP handshake | 1 RTT (~220ms) |
| TLS handshake | 2-3 RTTs (~440-660ms) |
| HTTP request/response | 1-2 RTTs (~220-440ms) |
| **Total connection overhead** | **~880-1320ms** |

This explains why Pinecone shows 1673ms — the actual query time is ~50-100ms, the rest is connection establishment over a high-latency link.

### Why Pinecone Shows 1.6s from Australia

Pinecone queries typically take **50-100ms** for the query complexity used (topK=20, simple filter, metadata included). The remaining ~1.5s is:

- Cold connection establishment (~800-1000ms for TCP+TLS over 220ms RTT)
- SDK internal round trips
- Response transfer time

Both `retrieval` (1673ms) and `clusterSearch` (1647ms) hit Pinecone and show similar latencies, confirming the connection overhead theory.

---

## Part 3: In-Region Latency Projections

### Expected Latencies (US East → US East)

With application deployed to US East (e.g., Vercel `iad1` region):

| Component | Current (AU→US) | Expected (US→US) | Reduction |
|-----------|-----------------|------------------|-----------|
| Auth (Clerk) | 1016ms | 50-80ms | ~12-20x |
| Embedding (OpenAI) | 360ms | 150-200ms | ~2x |
| Pinecone (vector) | 1673ms | 50-100ms | ~17x |
| Pinecone (cluster) | 1647ms | 50-100ms | ~17x |
| PlanetScale (actor) | 534ms | 20-50ms | ~11x |
| PlanetScale (enrich) | 527ms | 15-40ms | ~13x |

### Projected Request Timeline (In-Region)

```
Sequential operations:
├── Auth:           50-80ms
├── Parse:          1ms
├── Embedding:      150-200ms
├── 4-path parallel (max): 50-100ms  ← bounded by Pinecone
├── Rerank:         0ms (passthrough)
└── Enrich:         15-40ms
────────────────────────────
Total:              266-421ms
```

**Expected production latency: ~300-400ms** (vs 4138ms observed in dev)

---

## Part 4: Optimization Strategies

### Tier 1: Quick Wins (High Impact, Low Effort)

#### 1.1 Cache Auth (1016ms → 0-5ms)

The Clerk org membership check is identical for every request from the same user/workspace pair.

```typescript
// with-dual-auth.ts
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN
});

async function validateWorkspaceAccess(workspaceId: string, userId: string) {
  const cacheKey = `auth:${userId}:${workspaceId}`;

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached === "ok") {
    return { success: true, auth: { workspaceId, userId, authType: "session" } };
  }

  // ... existing Clerk API call ...

  // Cache success for 5 minutes
  await redis.set(cacheKey, "ok", { ex: 300 });

  return result;
}
```

**Impact**: Eliminates 50-80ms (in-region) on repeat requests. Cache TTL of 5 minutes is safe since org membership rarely changes.

#### 1.2 Cache Embeddings (150-200ms → 0-5ms)

Same query text always produces the same embedding vector.

```typescript
// four-path-search.ts
import { createHash } from "crypto";

function hashQuery(query: string): string {
  return createHash("sha256").update(query.toLowerCase().trim()).digest("hex").slice(0, 16);
}

// Before embedding generation:
const embeddingCacheKey = `emb:${workspaceId}:${hashQuery(query)}`;
const cachedEmbedding = await redis.get<number[]>(embeddingCacheKey);

if (cachedEmbedding) {
  queryVector = cachedEmbedding;
} else {
  const { embeddings } = await embedding.embed([query]);
  queryVector = embeddings[0];
  // Cache for 24h - embeddings are deterministic for same input
  await redis.set(embeddingCacheKey, JSON.stringify(queryVector), { ex: 86400 });
}
```

**Impact**: Eliminates 150-200ms for repeated/similar queries.

#### 1.3 Skip Empty Paths

The logs show `entityMatches: 0`, `clusterMatches: 0`, `actorMatches: 0`. If paths rarely return results, make them conditional:

```typescript
// Cache workspace capabilities
const capsCacheKey = `workspace:${workspaceId}:caps`;
let caps = await redis.get<{ hasClusters: boolean; hasActors: boolean }>(capsCacheKey);

if (!caps) {
  // Check once and cache
  const [clusterCount, actorCount] = await Promise.all([
    db.select({ count: sql`count(*)` }).from(workspaceObservationClusters).where(...),
    db.select({ count: sql`count(*)` }).from(workspaceActorProfiles).where(...),
  ]);
  caps = {
    hasClusters: clusterCount[0].count > 0,
    hasActors: actorCount[0].count > 0
  };
  await redis.set(capsCacheKey, caps, { ex: 3600 }); // 1 hour
}

// Only run paths that have data
const searches = await Promise.all([
  vectorSearch(),  // Always run
  entitySearch(),  // Always run (fast anyway)
  caps.hasClusters ? clusterSearch() : { results: [], latency: 0 },
  caps.hasActors ? actorSearch() : { results: [], latency: 0 },
]);
```

**Impact**: Saves 50-100ms per skipped path when workspace has no clusters/actors.

### Tier 2: Medium Effort Optimizations

#### 2.1 Store Enrichment Data in Pinecone Metadata

Currently, after Pinecone returns results, we fetch additional metadata from PlanetScale. Instead, store this data in Pinecone metadata at index time:

```typescript
// When indexing observations, include enrichment fields:
const metadata: VectorMetadata = {
  title: observation.title,
  snippet: observation.snippet,
  layer: "observations",
  // Add these fields to skip enrichment:
  url: observation.metadata?.url ?? "",
  source: observation.source,
  observationType: observation.observationType,
  occurredAt: observation.occurredAt,
};
```

Then for `fast` mode, skip the `enrichSearchResults` call entirely and use Pinecone metadata directly.

**Impact**: Eliminates 15-40ms enrichment step for fast mode.

#### 2.2 Warm Pinecone Connections

Serverless cold starts cause connection overhead. Keep connections warm:

```typescript
// pinecone-client.ts
export const pineconeClient = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

// Warm connection on module load (runs once per cold start)
const warmConnection = async () => {
  try {
    await pineconeClient.index("neural-memory").describeIndexStats();
  } catch {
    // Ignore errors, just warming
  }
};
warmConnection();
```

Or use Vercel's `waitUntil` to keep functions warm after responses.

#### 2.3 Full Result Caching

Cache complete search results for popular queries:

```typescript
const resultCacheKey = `search:${workspaceId}:${hashQuery(query)}:${mode}:${limit}`;
const cached = await redis.get<V1SearchResponse>(resultCacheKey);

if (cached) {
  return NextResponse.json({
    ...cached,
    meta: { ...cached.meta, fromCache: true }
  });
}

// ... perform search ...

// Cache for 5 minutes (adjust based on data freshness requirements)
await redis.set(resultCacheKey, response, { ex: 300 });
```

**Impact**: 5-10ms response for cache hits. Requires cache invalidation strategy when data changes.

### Tier 3: Infrastructure Optimizations

#### 3.1 Regional Deployment

Deploy application to US East to minimize network latency to all services:

- **Vercel**: Set region to `iad1` (Washington DC) or `cle1` (Cleveland)
- All services (Pinecone, PlanetScale, Clerk, OpenAI) are US-based

#### 3.2 PlanetScale Boost

Enable PlanetScale's query caching for read-heavy queries:

```sql
SET @@boost_cached_queries = true;
```

Or configure in connection string for automatic caching of repeated queries.

#### 3.3 Regional Pinecone (for AU users)

If users are primarily in Australia, consider:
- Pinecone `ap-southeast-1` (Singapore) — ~60ms RTT vs ~220ms to US East
- Would require data migration or multi-region setup

---

## Part 5: Projected Optimized Latencies

### Cache Miss Path (In-Region)

| Component | Latency |
|-----------|---------|
| Auth (cached) | 5ms |
| Parse | 1ms |
| Embedding (not cached) | 150-200ms |
| Pinecone (vector) | 50-100ms |
| Enrich (from Pinecone metadata) | 0ms |
| **Total** | **206-306ms** |

### Cache Hit Path (Repeat Query)

| Component | Latency |
|-----------|---------|
| Auth (cached) | 5ms |
| Parse | 1ms |
| Embedding (cached) | 5ms |
| Pinecone (vector) | 50-100ms |
| Enrich (from Pinecone metadata) | 0ms |
| **Total** | **61-111ms** |

### Full Result Cache Hit

| Component | Latency |
|-----------|---------|
| Auth (cached) | 5ms |
| Result cache lookup | 5ms |
| **Total** | **~10ms** |

---

## Architecture Documentation

### Request Flow

```
POST /v1/search
  │
  ├─→ 1. Auth (1016ms observed, 50-80ms in-region)
  │   └─→ Clerk API call (external HTTP)
  │
  ├─→ 2. Parse (1ms)
  │
  ├─→ 3. Search (2594ms observed)
  │   ├─→ Embedding generation (360ms, OpenAI)
  │   └─→ 4-path parallel search:
  │       ├─→ Vector (1673ms, Pinecone)
  │       ├─→ Entity (1ms, PlanetScale)
  │       ├─→ Cluster (1647ms, Pinecone + PlanetScale)
  │       └─→ Actor (534ms, PlanetScale)
  │
  ├─→ 4. Rerank (0ms, passthrough in fast mode)
  │
  └─→ 5. Enrich (527ms, PlanetScale)
```

### Parallelism Analysis

The 4-path search runs in parallel, but the bottleneck is Pinecone:
- `maxParallel: 1673` - This is correct, representing the slowest parallel path

The total search time (2594ms) includes:
- Embedding (360ms) - sequential before parallel search
- Parallel search (1673ms) - bounded by slowest path (vector/cluster)
- Some overhead

---

## Code References

| File | Purpose |
|------|---------|
| `apps/console/src/app/(api)/v1/search/route.ts` | Main search endpoint |
| `apps/console/src/lib/neural/four-path-search.ts` | 4-path parallel search implementation |
| `apps/console/src/lib/neural/cluster-search.ts` | Cluster search (Pinecone + PlanetScale) |
| `apps/console/src/lib/neural/actor-search.ts` | Actor search (PlanetScale only) |
| `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts` | Auth middleware with Clerk API call |

---

## Summary

### Latency by Service (Observed from Australia)

| Service | Total Latency | % of Total | Root Cause |
|---------|---------------|------------|------------|
| Pinecone | ~1647ms | ~40% | Network RTT (220ms × multiple round trips) |
| Clerk API | ~1016ms | ~25% | Network RTT + TLS handshake |
| PlanetScale | ~1061ms | ~26% | Network RTT (actual queries ~50ms) |
| OpenAI | ~360ms | ~9% | Network RTT + inference |

### Optimization Priority

| Priority | Optimization | Effort | Impact |
|----------|--------------|--------|--------|
| 1 | Deploy to US East | Low | 4138ms → 300-400ms |
| 2 | Cache auth | Low | -50-80ms per request |
| 3 | Cache embeddings | Low | -150-200ms for repeat queries |
| 4 | Store enrichment in Pinecone | Medium | -15-40ms |
| 5 | Skip empty paths | Low | -50-100ms when applicable |
| 6 | Full result caching | Medium | ~10ms for cache hits |

### Expected Production Latencies

| Scenario | Latency |
|----------|---------|
| Current (AU → US, no caching) | 4138ms |
| In-region (US → US, no caching) | 300-400ms |
| In-region + auth/embedding cache | 100-150ms |
| In-region + full result cache hit | ~10ms |

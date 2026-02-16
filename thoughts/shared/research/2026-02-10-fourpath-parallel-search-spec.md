---
date: 2026-02-10T00:00:00Z
researcher: Claude
git_commit: 593bc567cf765058503dd8901ce5e276460dde82
branch: main
repository: lightfast-search-perf-improvements
topic: "fourPathParallelSearch Implementation Specification"
tags: [research, codebase, neural, search, vector-search, entity-search, cluster-search, actor-search]
status: complete
last_updated: 2026-02-10
last_updated_by: Claude
---

# fourPathParallelSearch: Formal Specification

**Implementation**: `apps/console/src/lib/neural/four-path-search.ts`
**Function**: `fourPathParallelSearch(params: FourPathSearchParams): Promise<FourPathSearchResult>`
**Lines**: 362-524

---

## Input Parameters

```typescript
FourPathSearchParams = {
  workspaceId: string,
  query: string,
  topK: number,
  filters?: {
    sourceTypes?: string[],
    observationTypes?: string[],
    actorNames?: string[],
    dateRange?: { start?: string, end?: string }
  },
  requestId?: string
}
```

---

## Path 1: Vector Similarity Search

### Input
- **Index**: Pinecone index `workspace.indexName`, namespace `workspace.namespaceName`
- **Query vector**: `q ∈ ℝ^d` where `d = embeddingDim` (768 for text-embedding-3-small, 3072 for text-embedding-3-large)
- **Parameters**: `topK = k`, metadata filter `{ layer: "observations", source?, observationType?, actorName?, occurredAt? }`
- **Embedding model**: Workspace-configured (text-embedding-3-small or text-embedding-3-large)

### Algorithm
**Approximate Nearest Neighbor (ANN)** via HNSW (Hierarchical Navigable Small World):
```
PineconeQuery(index, q, k, filter) → matches[]
  where matches[i] = (vectorId, score, metadata)
  score = cosine_similarity(q, v_i) ∈ [0, 1]
```

### Output
```typescript
{
  matches: Array<{
    id: string,              // Vector ID (obs_content_*, obs_title_*, obs_summary_*, or legacy)
    score: number ∈ [0, 1],  // Cosine similarity
    metadata?: {
      observationId?: string,    // Phase 3 optimization: direct lookup
      title?: string,
      snippet?: string,
      source?: string,
      observationType?: string,
      url?: string
    }
  }>,
  latency: number
}
```
**Cardinality**: `|matches| ≤ k`

### Complexity
- **Time**: `O(log n + kd)` where:
  - `n` = corpus size (# vectors in index)
  - `d` = embedding dimension
  - `k` = topK parameter
  - HNSW graph traversal: `O(log n)`, distance computations: `O(kd)`
- **Space**: `O(k)`

---

## Path 2: Entity Pattern Matching

### Input
- **Database**: `workspaceNeuralEntities` table, `workspaceNeuralObservations` table
- **Query**: Raw text string
- **Parameters**: `workspaceId`, `limit = k`
- **Patterns**:
  ```
  @mentions:     /@([a-zA-Z0-9_-]{1,39})\b/g
  Issues/PRs:    /(#\d{1,6})/g
  Linear/Jira:   /\b([A-Z]{2,10}-\d{1,6})\b/g
  API endpoints: /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s"'<>]{1,100})/gi
  ```

### Algorithm
**Regex Pattern Extraction + Exact Key Lookup**:
```
EntitySearch(query, workspaceId, k):
  1. entities ← ExtractPatterns(query)  // Regex matching
  2. keys ← [e.key for e in entities]
  3. matches ← SELECT * FROM workspaceNeuralEntities
              WHERE workspaceId = w AND key IN keys
              ORDER BY occurrenceCount DESC LIMIT k
  4. obsIds ← [m.sourceObservationId for m in matches]
  5. observations ← SELECT * FROM workspaceNeuralObservations
                    WHERE id IN obsIds
  6. RETURN JoinAndFormat(matches, observations)
```

### Output
```typescript
{
  results: Array<{
    entityId: string,             // Entity BIGINT → string
    entityKey: string,            // Extracted key (@username, #123, etc)
    entityCategory: EntityCategory,  // "engineer" | "project" | "endpoint"
    observationId: string,        // Observation nanoid (externalId)
    observationTitle: string,
    observationSnippet: string,   // content.substring(0, 200)
    occurrenceCount: number,      // Entity popularity
    confidence: number ∈ [0, 1]   // Default 0.8
  }>,
  latency: number
}
```
**Cardinality**: `|results| ≤ k`, typically `|results| ≪ k` (entity matches are sparse)

### Complexity
- **Time**:
  - Pattern extraction: `O(|query| × p)` where `p` = # patterns = 4
  - Entity lookup: `O(log n_e)` where `n_e` = # entities in workspace
  - Observation join: `O(m log n_o)` where `m` = # matched entities, `n_o` = # observations
  - **Total**: `O(|query| × p + log n_e + m log n_o)`
- **Space**: `O(m)` where `m` = # matched entities

---

## Path 3: Cluster Context Search

### Input
- **Index**: Pinecone index `workspace.indexName`, namespace `workspace.namespaceName`
- **Query vector**: `q ∈ ℝ^d` (same as Path 1)
- **Parameters**: `topK = 3` (fixed)
- **Filter**: `{ layer: "clusters" }`
- **Execution**: Conditional on `workspace.hasClusters === true`

### Algorithm
**Centroid-Based Retrieval**:
```
ClusterSearch(workspaceId, index, namespace, q, k=3):
  1. centroids ← PineconeQuery(index, q, k, {layer: "clusters"})
  2. embeddingIds ← [c.id for c in centroids]
  3. clusters ← SELECT * FROM workspaceObservationClusters
                WHERE workspaceId = w AND topicEmbeddingId IN embeddingIds
  4. RETURN JoinScoresWithMetadata(centroids, clusters)
```

### Output
```typescript
{
  results: Array<{
    clusterId: number,           // BIGINT internal ID
    topicLabel: string,          // Cluster label
    summary: string | null,      // Cluster summary
    keywords: string[],          // Topic keywords
    score: number ∈ [0, 1],      // Cosine similarity to query
    observationCount: number     // # observations in cluster
  }>,
  latency: number
}
```
**Cardinality**: `|results| ≤ 3`

### Complexity
- **Time**: `O(log n_c + 3d)` where:
  - `n_c` = # clusters (typically `n_c ≪ n`)
  - `d` = embedding dimension
  - HNSW traversal: `O(log n_c)`, distance computations: `O(3d)`
- **Space**: `O(1)` (fixed k=3)

---

## Path 4: Actor Profile Search

### Input
- **Databases**: `orgActorIdentities` (org-level), `workspaceActorProfiles` (workspace-level)
- **Query**: Raw text string
- **Parameters**: `workspaceId`, `topK = 5` (fixed)
- **Patterns**:
  ```
  @mentions:     /@([a-zA-Z0-9_-]{1,39})\b/g
  Quoted names:  /"([^"]+)"/g
  ```

### Algorithm
**Dual-Level Fuzzy Lookup**:
```
ActorSearch(workspaceId, query, k=5):
  1. mentions ← ExtractActorMentions(query)  // @mentions + quoted names
  2. queryLower ← query.toLowerCase()

  // Org-level mention search
  3. identities ← SELECT * FROM orgActorIdentities
                  WHERE clerkOrgId = org AND sourceUsername ILIKE mentions
                  LIMIT k
  4. actorIds ← [i.canonicalActorId for i in identities]
  5. profiles ← SELECT * FROM workspaceActorProfiles
                WHERE workspaceId = w AND actorId IN actorIds
  6. mentionMatches ← JoinAndScore(identities, profiles, score=0.95)

  // Workspace-level name search
  7. nameProfiles ← SELECT * FROM workspaceActorProfiles
                    WHERE workspaceId = w AND displayName ILIKE queryLower
                    ORDER BY observationCount DESC LIMIT k
  8. nameMatches ← EnrichWithAvatars(nameProfiles, score=0.75)

  9. allResults ← MERGE(mentionMatches, nameMatches)  // Deduplicate by actorId
  10. SORT BY (score DESC, observationCount DESC)
  11. RETURN allResults[0:k]
```

### Output
```typescript
{
  results: Array<{
    actorId: string,                 // Canonical actor ID
    displayName: string,             // Actor display name
    avatarUrl: string | null,        // From orgActorIdentities
    expertiseDomains: string[],      // Not yet implemented (empty)
    observationCount: number,        // Activity metric
    lastActiveAt: string | null,     // Workspace-specific activity
    matchType: "mention" | "name",   // Match source
    score: 0.95 | 0.75               // Fixed scores by match type
  }>,
  latency: number
}
```
**Cardinality**: `|results| ≤ 5`

### Complexity
- **Time**:
  - Pattern extraction: `O(|query| × 2)` (2 patterns)
  - Identity lookup (mention path): `O(log n_i)` where `n_i` = # identities in org
  - Profile join: `O(m log n_p)` where `m` = # matched identities, `n_p` = # profiles in workspace
  - Name search: `O(log n_p)`
  - Avatar enrichment: `O(m' log n_i)` where `m'` = # name matches
  - **Total**: `O(|query| + log n_i + m log n_p + log n_p + m' log n_i)`
- **Space**: `O(m + m')` where `m, m' ≤ 5`

---

## Parallel Execution

All 4 paths execute concurrently:
```typescript
Promise.all([
  VectorSearch(),   // Always executes
  EntitySearch(),   // Always executes
  ClusterSearch(),  // Conditional: hasClusters === true
  ActorSearch()     // Conditional: hasActors === true
])
```

**Total Latency**: `max(T_vector, T_entity, T_cluster, T_actor) + T_normalize + T_merge`

---

## Post-Processing: Vector ID Normalization

### Input
Vector search results with IDs like `obs_content_xyz`, `obs_title_xyz`, `obs_summary_xyz`

### Algorithm
**Two-Phase Lookup with Multi-View Aggregation**:
```
NormalizeVectorIds(workspaceId, vectorMatches):
  // Phase 3 path (fast): Direct metadata lookup
  1. withObsId ← [m for m in vectorMatches if m.metadata?.observationId exists]
  2. withoutObsId ← [m for m in vectorMatches if m.metadata?.observationId missing]

  3. obsGroups ← Map<observationId, {matches: ViewMatch[], metadata}>

  // Direct grouping for Phase 3 vectors
  4. FOR EACH match IN withObsId:
       obsId ← match.metadata.observationId
       view ← GetViewFromVectorId(match.id)  // Extract prefix
       obsGroups[obsId].matches.append({view, score: match.score, vectorId: match.id})

  // Phase 2 path (fallback): Database lookup for legacy vectors
  5. IF withoutObsId.length > 0:
       vectorIds ← [m.id for m in withoutObsId]
       observations ← SELECT id, externalId, embeddingTitleId, embeddingContentId,
                             embeddingSummaryId, embeddingVectorId
                      FROM workspaceNeuralObservations
                      WHERE workspaceId = w AND (
                        embeddingTitleId IN vectorIds OR
                        embeddingContentId IN vectorIds OR
                        embeddingSummaryId IN vectorIds OR
                        embeddingVectorId IN vectorIds
                      )
       vectorToObs ← BuildReverseMap(observations)  // vectorId → {obsId, view}
       FOR EACH match IN withoutObsId:
         obs ← vectorToObs[match.id]
         obsGroups[obs.id].matches.append({view: obs.view, score: match.score})

  // Aggregate multi-view matches
  6. results ← []
  7. FOR EACH (obsId, group) IN obsGroups:
       maxScore ← MAX([m.score for m in group.matches])
       results.append({
         observationId: obsId,
         score: maxScore,  // MAX aggregation
         matchedViews: group.matches,
         metadata: group.metadata
       })

  8. SORT results BY score DESC
  9. RETURN results
```

### Output
```typescript
Array<{
  observationId: string,     // Observation nanoid (externalId)
  score: number ∈ [0, 1],    // MAX across all matching views
  matchedViews: Array<{
    view: "title" | "content" | "summary" | "legacy",
    score: number,
    vectorId: string
  }>,
  metadata?: VectorMetadata
}>
```

### Complexity
- **Phase 3 path (metadata-based)**: `O(m)` where `m` = # matches with observationId
- **Phase 2 path (DB lookup)**: `O(m' log n_o)` where `m'` = # matches without observationId, `n_o` = # observations
- **Grouping**: `O(m + m')`
- **Aggregation**: `O(g)` where `g` = # unique observations (typically `g ≤ m + m'`)
- **Total**: `O(m + m' log n_o + g)`

---

## Result Merging & Scoring

### Algorithm
**Map-Based Deduplication with Score Boosting**:
```
MergeSearchResults(normalizedVectorResults, entityResults, k):
  1. resultMap ← Map<observationId, FilterCandidate>

  // Add vector results
  2. FOR EACH result IN normalizedVectorResults:
       resultMap[result.observationId] ← {
         id: result.observationId,
         title: result.metadata?.title ?? "",
         snippet: result.metadata?.snippet ?? "",
         score: result.score
       }

  // Merge entity results with cross-confirmation boosting
  3. FOR EACH entity IN entityResults:
       IF entity.observationId IN resultMap:
         // Entity confirmation: boost score by +0.2 (capped at 1.0)
         resultMap[entity.observationId].score ← min(1.0, existing.score + 0.2)
         // Prefer entity-extracted title/snippet
         IF entity.observationTitle: update title
         IF entity.observationSnippet: update snippet
       ELSE:
         // New entity-only result
         resultMap[entity.observationId] ← {
           id: entity.observationId,
           title: entity.observationTitle,
           snippet: entity.observationSnippet,
           score: 0.85 × entity.confidence  // confidence ∈ [0, 1], default 0.8
         }

  4. candidates ← VALUES(resultMap)
  5. SORT candidates BY score DESC
  6. RETURN candidates[0:k]
```

### Scoring Rules

| Match Type | Base Score | Boost | Final Score Range |
|-----------|-----------|-------|-------------------|
| Vector only | `cos_sim(q, v)` | — | `[0, 1]` |
| Entity only | `0.85 × confidence` | — | `[0, 0.85]` (typical: 0.68) |
| Vector + Entity | `cos_sim(q, v)` | `+0.2` | `[0, 1]` (capped) |

**Cross-Path Confirmation Rationale**: Entity match confirms semantic relevance detected by vector search, warranting score boost.

### Output
```typescript
FilterCandidate[] = Array<{
  id: string,           // Observation nanoid
  title: string,
  snippet: string,
  score: number ∈ [0, 1]
}>
```
**Cardinality**: `|candidates| ≤ k` after merge and top-k selection

### Complexity
- **Map construction**: `O(v + e)` where `v` = # vector results, `e` = # entity results
- **Sorting**: `O(u log u)` where `u` = # unique observations (typically `u ≤ v + e`)
- **Total**: `O(v + e + u log u)`

---

## Complete Output Schema

```typescript
FourPathSearchResult = {
  candidates: FilterCandidate[],  // Merged vector + entity results
  clusters: Array<{
    topicLabel: string | null,
    summary: string | null,
    keywords: string[],
    score: number ∈ [0, 1]
  }>,
  actors: Array<{
    displayName: string,
    expertiseDomains: string[],  // Empty (not implemented)
    score: 0.95 | 0.75
  }>,
  latency: {
    embedding: number,     // Query embedding generation time
    vector: number,        // Path 1 execution time
    entity: number,        // Path 2 execution time
    cluster: number,       // Path 3 execution time (0 if skipped)
    actor: number,         // Path 4 execution time (0 if skipped)
    normalize: number,     // Vector ID normalization time
    total: number          // End-to-end wall clock time
  },
  total: number,          // # candidates before dedup (vector + entity)
  paths: {
    vector: boolean,      // Path 1 success
    entity: boolean,      // Path 2 success
    cluster: boolean,     // Path 3 executed (results.length > 0)
    actor: boolean        // Path 4 executed (results.length > 0)
  }
}
```

---

## Overall Complexity Summary

### Time Complexity
**Per-Path** (parallel execution, total time = max of paths):
- **Path 1 (Vector)**: `O(log n + kd + m log n_o + g)` where:
  - `O(log n + kd)` = Pinecone ANN search
  - `O(m log n_o + g)` = Vector ID normalization
- **Path 2 (Entity)**: `O(|q| × p + log n_e + m log n_o)`
- **Path 3 (Cluster)**: `O(log n_c + 3d)` (or `O(1)` if skipped)
- **Path 4 (Actor)**: `O(|q| + log n_i + m log n_p)`

**Merge**: `O(v + e + u log u)` where `v, e, u ≤ k`

**Dominated Term**: `O(log n + kd)` (vector search typically dominates)

### Space Complexity
- **Path 1**: `O(k)` (top-k results)
- **Path 2**: `O(m)` where `m ≪ k`
- **Path 3**: `O(1)` (fixed k=3)
- **Path 4**: `O(1)` (fixed k=5)
- **Merge**: `O(k)`
- **Total**: `O(k)` (dominated by vector search results)

---

## Implementation Notes

1. **Graceful Degradation**: Each path fails independently; total failure of any path does not abort the search
2. **Conditional Execution**: Paths 3 and 4 skipped if workspace not configured (hasClusters/hasActors flags)
3. **Phase 3 Optimization**: Vector ID normalization prefers metadata-based lookup (no DB query) over legacy DB lookup
4. **Cross-Path Validation**: Entity confirmation boosts vector search scores (+0.2)
5. **Observability**: Latency breakdown tracked for all stages (embedding, search, normalize, merge)
6. **Error Handling**: Try-catch on each path returns empty results with success=false status

---

## File References

- **Main Implementation**: [`apps/console/src/lib/neural/four-path-search.ts`](apps/console/src/lib/neural/four-path-search.ts)
- **Path 2 (Entity)**: [`apps/console/src/lib/neural/entity-search.ts`](apps/console/src/lib/neural/entity-search.ts)
- **Path 3 (Cluster)**: [`apps/console/src/lib/neural/cluster-search.ts`](apps/console/src/lib/neural/cluster-search.ts)
- **Path 4 (Actor)**: [`apps/console/src/lib/neural/actor-search.ts`](apps/console/src/lib/neural/actor-search.ts)
- **API Consumer**: [`apps/console/src/lib/v1/search.ts`](apps/console/src/lib/v1/search.ts)
- **Pinecone Client**: [`vendor/pinecone/src/client.ts`](vendor/pinecone/src/client.ts)

---

## Related Research

- `thoughts/shared/plans/2026-02-09-nextjs-optimization.md` - Next.js optimization plan
- `thoughts/shared/research/2026-02-09-nextjs-15-5-optimization.md` - Next.js 15.5 optimization research

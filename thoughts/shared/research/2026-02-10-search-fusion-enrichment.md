---
date: 2026-02-10T04:52:40+0000
researcher: Claude Sonnet 4.5
git_commit: 593bc567cf765058503dd8901ce5e276460dde82
branch: main
repository: lightfast-search-perf-improvements
topic: "Search Result Fusion and Enrichment Logic"
tags: [research, codebase, search, fusion, scoring, enrichment]
status: complete
last_updated: 2026-02-10
last_updated_by: Claude Sonnet 4.5
---

# Research: Search Result Fusion and Enrichment Logic

**Date**: 2026-02-10T04:52:40+0000
**Researcher**: Claude Sonnet 4.5
**Git Commit**: 593bc567cf765058503dd8901ce5e276460dde82
**Branch**: main
**Repository**: lightfast-search-perf-improvements

## Research Question
Find the enrichSearchResults function and the candidate merging/scoring logic used after fourPathParallelSearch returns. Output ONLY:
1. The fusion formula: how scores from different paths combine into a final score
2. Any normalization applied to per-path scores
3. What enrichment fetches from the database (which tables, which columns)
4. The SQL query pattern used for enrichment (batch? individual? joins?)
5. Complexity of fusion: O(?) and enrichment: O(?)

## Findings

### 1. Fusion Formula

**Vector multi-view aggregation** ([four-path-search.ts:196](https://github.com/lightfastai/lightfast-search-perf-improvements/blob/593bc567cf765058503dd8901ce5e276460dde82/apps/console/src/lib/neural/four-path-search.ts#L196)):
```
score_vector(obs_i) = MAX(score_title_i, score_content_i, score_summary_i, score_legacy_i)
```

**Entity confirmation boost** ([four-path-search.ts:334-335](https://github.com/lightfastai/lightfast-search-perf-improvements/blob/593bc567cf765058503dd8901ce5e276460dde82/apps/console/src/lib/neural/four-path-search.ts#L334-L335)):
```
score_final(obs_i) = MIN(1.0, score_vector_i + 0.2)  ∀ obs_i ∈ (Vector ∩ Entity)
```

**Entity-only score** ([four-path-search.ts:345](https://github.com/lightfastai/lightfast-search-perf-improvements/blob/593bc567cf765058503dd8901ce5e276460dde82/apps/console/src/lib/neural/four-path-search.ts#L345)):
```
score_final(obs_i) = 0.85 × confidence_i  ∀ obs_i ∈ (Entity \ Vector)
```

**Complete fusion function** ([four-path-search.ts:313-354](https://github.com/lightfastai/lightfast-search-perf-improvements/blob/593bc567cf765058503dd8901ce5e276460dde82/apps/console/src/lib/neural/four-path-search.ts#L313-L354)):
```
f_fusion(V, E) → R  where:
  V = {(obs_i, score_i) | i ∈ [1..n_v]}  (vector results)
  E = {(obs_j, conf_j)  | j ∈ [1..n_e]}  (entity results)

  R = SORT_DESC(M)  where M: obs_id → score_final

  M = {obs → score | obs ∈ V ∪ E, score = f_score(obs)}

  f_score(obs) = {
    MIN(1.0, score_vector + 0.2)     if obs ∈ V ∩ E
    score_vector                      if obs ∈ V \ E
    0.85 × confidence_entity          if obs ∈ E \ V
  }
```

### 2. Normalization

**No normalization applied**. Operations:
```
{MAX, MIN, +, ×}  ⊄  {z-score, min-max, softmax}
```

Score operations are **composition of elementary functions**:
- `MAX`: multi-view aggregation
- `MIN(1.0, ·)`: capping
- `+ 0.2`: fixed boost
- `× 0.85`: scaling factor

### 3. Database Enrichment Schema

**Table 1: WorkspaceNeuralObservations** ([four-path-search.ts:569-586](https://github.com/lightfastai/lightfast-search-perf-improvements/blob/593bc567cf765058503dd8901ce5e276460dde82/apps/console/src/lib/neural/four-path-search.ts#L569-L586)):
```
Observations(
  id              : BIGINT,
  externalId      : VARCHAR,
  title           : TEXT,
  source          : VARCHAR,
  observationType : VARCHAR,
  occurredAt      : TIMESTAMP,
  metadata        : JSONB,
  sourceReferences: JSONB
)
```

**Table 2: WorkspaceNeuralEntities** ([four-path-search.ts:592-606](https://github.com/lightfastai/lightfast-search-perf-improvements/blob/593bc567cf765058503dd8901ce5e276460dde82/apps/console/src/lib/neural/four-path-search.ts#L592-L606)):
```
Entities(
  sourceObservationId : BIGINT,
  key                 : VARCHAR,
  category            : VARCHAR
)
```

### 4. SQL Query Pattern

**Batch queries with IN clause**:

```sql
Q₁ = SELECT * FROM Observations WHERE externalId IN (id₁, id₂, ..., idₙ)
Q₂ = SELECT * FROM Entities WHERE sourceObservationId IN (oid₁, oid₂, ..., oidₙ)
```

Pattern: `BATCH(N) × 2` queries, **not** `INDIVIDUAL(N) × 2` or `JOIN(...)`.

### 5. Complexity

**Fusion** ([four-path-search.ts:313-354](https://github.com/lightfastai/lightfast-search-perf-improvements/blob/593bc567cf765058503dd8901ce5e276460dde82/apps/console/src/lib/neural/four-path-search.ts#L313-L354)):
```
T_fusion(V, E, K) = O(V + E + D log D)  where D = |V ∪ E| ≤ V + E

Space: S_fusion(V, E) = O(D)
```

**Enrichment** ([four-path-search.ts:553-657](https://github.com/lightfastai/lightfast-search-perf-improvements/blob/593bc567cf765058503dd8901ce5e276460dde82/apps/console/src/lib/neural/four-path-search.ts#L553-L657)):
```
T_enrich(N, C, E_avg) = O(C + N × E_avg)  where:
  N     = |results|
  C     = |candidates|
  E_avg = avg entities per observation

Space: S_enrich(N, C, E_avg) = O(C + N × E_avg)

Queries: Q_enrich = 2
```

## Code References

- `apps/console/src/lib/neural/four-path-search.ts:82` - normalizeVectorIds (MAX aggregation)
- `apps/console/src/lib/neural/four-path-search.ts:196` - Multi-view score calculation
- `apps/console/src/lib/neural/four-path-search.ts:313-354` - mergeSearchResults (fusion logic)
- `apps/console/src/lib/neural/four-path-search.ts:334-335` - Entity boost formula
- `apps/console/src/lib/neural/four-path-search.ts:345` - Entity-only score formula
- `apps/console/src/lib/neural/four-path-search.ts:362` - fourPathParallelSearch orchestration
- `apps/console/src/lib/neural/four-path-search.ts:553-657` - enrichSearchResults (database hydration)
- `apps/console/src/lib/neural/four-path-search.ts:569-586` - Observations batch query
- `apps/console/src/lib/neural/four-path-search.ts:592-606` - Entities batch query
- `apps/console/src/lib/v1/search.ts:38` - Call to fourPathParallelSearch
- `apps/console/src/lib/v1/search.ts:87` - Call to enrichSearchResults

---
date: 2026-02-07T10:56:15Z
researcher: claude
git_commit: 96ddaa6d76f062182ba1ce2e096a7a539cc2bdc9
branch: feat/memory-connector-backfill
repository: lightfast
topic: "Investigation: /v1/search API returning 0 results after graph-pipeline-hardening merge"
tags: [research, codebase, search, pinecone, inngest, observation-capture, graph-pipeline, debugging]
status: complete
last_updated: 2026-02-07
last_updated_by: claude
---

# Research: /v1/search API Returning 0 Results

**Date**: 2026-02-07T10:56:15Z
**Researcher**: claude
**Git Commit**: 96ddaa6d
**Branch**: feat/memory-connector-backfill
**Repository**: lightfast

## Research Question

The `/v1/search` API is returning 0 results. This may be related to the recent graph-pipeline-hardening merge (PR #362, commit `6c703cbc`). Deep investigate the full search pipeline to identify the root cause.

## Summary

The investigation traced the complete `/v1/search` pipeline from route handler → `searchLogic` → `fourPathParallelSearch` → Pinecone query → `normalizeVectorIds` → reranking → enrichment. The code on `origin/main` (which is the deployed version) includes PR #361 (`search-perf-phase1-quick-wins`) which **reverted** all graph-pipeline-hardening changes and also removed the `ingestionSource` column from the observation capture pipeline.

**Key finding**: The deployed code (`origin/main`) reverted the step reordering from the graph-pipeline-hardening PR, so Inngest memoization issues from that PR are NOT the cause. The root cause must be elsewhere.

### Most Likely Root Causes (in order of probability)

1. **`console.log(request.headers)` in `withDualAuth`** — A debug `console.log(request.headers)` statement exists at `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:56` on `origin/main`. While this shouldn't cause 0 results, it indicates the auth middleware may have been recently modified and could have subtle issues.

2. **Workspace config cache stale/mismatched** — `getCachedWorkspaceConfig()` caches workspace settings in Redis for 1 hour. If workspace settings (index name, namespace) were changed or the workspace was recreated, stale cache could point to a wrong/empty Pinecone namespace.

3. **Pinecone namespace empty or vectors not indexed** — If observations were ingested with test data (reset-demo) or workspace was recreated, the Pinecone namespace may be empty or contain vectors under a different namespace format.

4. **Reranker filtering all candidates** — In "balanced" mode, Cohere reranker has a default threshold of 0.4. If Cohere API returns low relevance scores, candidates could be filtered out. However, "balanced" mode has a `minResults` fallback of at least 3, so this is unlikely for that mode. "Thorough" mode has NO such fallback.

5. **Entity/vector normalization dropping results** — `normalizeVectorIds` maps Pinecone vector IDs to database observation IDs. If Phase 3 metadata (`observationId`) points to observations that were deleted/recreated, all results get silently dropped.

## Detailed Findings

### 1. Deployed Code State (`origin/main`)

`origin/main` is at commit `89841689` (Merge PR #361), which is **ahead** of the local branch. The deployed code:

- **Reverted** graph-pipeline-hardening step reordering (Pinecone upsert is BACK to Step 6, DB insert is Step 7)
- **Removed** orphaned vector detection from `normalizeVectorIds`
- **Removed** embedding dimension validation
- **Removed** `ingestionSource` column from schema and insert
- **Removed** `NotFoundError` class
- **Added** relationship detection step (`detect-relationships`) at Step 7.5
- **Has** `console.log(request.headers)` at `with-dual-auth.ts:56`

### 2. Search Pipeline Flow (on `origin/main`)

```
POST /v1/search
  → withDualAuth() [with-dual-auth.ts:55]
    → console.log(request.headers)  ← DEBUG STATEMENT PRESENT
    → API key auth OR Clerk session auth
  → V1SearchRequestSchema.safeParse() [search route.ts:73]
  → searchLogic() [search.ts:28]
    → fourPathParallelSearch() [four-path-search.ts:397]
      → getCachedWorkspaceConfig(workspaceId) [config.ts:27]
        → Redis (1hr TTL) → DB fallback
        → Returns: { indexName, namespaceName, embeddingModel, embeddingDim, hasClusters, hasActors }
      → createEmbeddingProviderForWorkspace().embed([query]) [Cohere API]
      → Promise.all([
          pineconeClient.query(indexName, { vector, topK, filter: { layer: "observations" } }, namespaceName),
          searchByEntities(query, workspaceId, topK),
          searchClusters(...) OR EMPTY,
          searchActorProfiles(...) OR EMPTY,
        ])
      → normalizeVectorIds(workspaceId, vectorMatches)
        → Phase 3 path: metadata.observationId → direct mapping (NO DB verification on origin/main)
        → Phase 2 path: vector ID → DB lookup by embeddingTitleId/ContentId/SummaryId/VectorId columns
      → mergeSearchResults(normalizedVector, entityResults, topK)
    → reranker.rerank(query, candidates, { topK, threshold, minResults })
    → enrichSearchResults(results, candidates, workspaceId)
      → DB: workspaceNeuralObservations by externalId
      → DB: workspaceNeuralEntities by internal observation IDs
```

### 3. Observation Capture Pipeline (on `origin/main`)

```
Webhook → inngest.send("apps-console/neural/observation.capture")
  → Step 0: Create job record
  → Step 1: Check duplicate (by workspaceId + sourceId)
  → Step 2: Evaluate significance (LLM gate)
  → Step 3: Fetch workspace context (settings, cluster count, actor count)
  → Step 4: PARALLEL [Classification + Embedding + Entity Extraction]
  → Step 5: Cluster assignment + Actor resolution
  → Step 6: Upsert multi-view vectors to Pinecone (title, content, summary)
    → metadata includes: layer="observations", observationId=externalId (nanoid)
    → namespace from workspace.settings.embedding.namespaceName
  → Step 7: Store observation + entities (transactional DB insert)
    → externalId = pre-generated nanoid (same as in Pinecone metadata)
  → Step 7.5: Detect and create relationships
  → Step 8: Emit completion event
```

### 4. Pinecone Client Architecture

Both `consolePineconeClient` and `pineconeClient` are the **same singleton** instance:
- `packages/console-pinecone/src/index.ts:27`: `export { consolePineconeClient as pineconeClient }`
- `packages/console-pinecone/src/client.ts:160`: `export const consolePineconeClient = new ConsolePineconeClient()`

The namespace is always from `workspace.settings.embedding.namespaceName`, format: `{clerkOrgId}:ws_{workspaceId}`.

### 5. Reranker Behavior by Mode

| Mode | Provider | Default Threshold | minResults | Can Return 0? |
|------|----------|------------------|------------|---------------|
| fast | Passthrough | 0 | None | Only if 0 input candidates |
| balanced | Cohere | 0.4 | max(3, ceil(limit/2)) | No (fallback guarantees min 3) |
| thorough | LLM | 0.4 (explicit) | None | Yes, if all scores < 0.4 |

### 6. Points Where Results Can Become 0

1. **Pinecone returns 0 matches** → Empty namespace, wrong filter, wrong index
2. **normalizeVectorIds returns 0** → All vector IDs unresolvable (no DB match for legacy, no observationId for Phase 3)
3. **mergeSearchResults returns 0** → Both vector and entity paths empty
4. **Reranker filters everything** → All scores below threshold (only thorough mode)
5. **enrichSearchResults maps to empty** → Observation IDs not found in DB
6. **Auth fails** → Returns error response, not 0 results (different symptom)

### 7. `console.log(request.headers)` Debug Statement

At `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:56` on `origin/main`:

```typescript
export async function withDualAuth(
  request: NextRequest,
  requestId?: string,
): Promise<DualAuthResult> {
  const authHeader = request.headers.get("authorization");
  console.log(request.headers);  // ← DEBUG STATEMENT - logs full headers to stdout
  if (authHeader?.startsWith("Bearer ")) {
```

This doesn't break functionality but creates noise in logs and indicates recent debugging.

## Code References

- `apps/console/src/app/(api)/v1/search/route.ts:34-149` — Search route handler
- `apps/console/src/lib/v1/search.ts:28-192` — `searchLogic` function
- `apps/console/src/lib/neural/four-path-search.ts:397-559` — `fourPathParallelSearch`
- `apps/console/src/lib/neural/four-path-search.ts:82-245` — `normalizeVectorIds`
- `apps/console/src/lib/neural/four-path-search.ts:348-389` — `mergeSearchResults`
- `apps/console/src/lib/neural/four-path-search.ts:588-692` — `enrichSearchResults`
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:55-56` — Auth middleware with console.log
- `packages/console-workspace-cache/src/config.ts:27-67` — `getCachedWorkspaceConfig`
- `packages/console-pinecone/src/client.ts:125-131` — Pinecone query method
- `vendor/pinecone/src/client.ts:218-244` — Vendor Pinecone query (namespace selection at line 224)
- `api/console/src/inngest/workflow/neural/observation-capture.ts:852-920` — Pinecone upsert step (origin/main)
- `api/console/src/inngest/workflow/neural/observation-capture.ts:922-998` — DB store step (origin/main)
- `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-285` — Relationship detection
- `packages/console-rerank/src/providers/cohere.ts:122-162` — Cohere reranker threshold + fallback logic

## Architecture Documentation

### Merge History (Relevant Commits)

```
origin/main timeline:
  6a8611ef  Merge #353 feat/search-answer-workspace-rework
  ↓
  d2a58a10  feat: strict relationship detection (#352)
  ↓
  c22d281b  fix: enable env validation on Vercel
  ↓
  96ddaa6d  Merge #362 fix/graph-pipeline-hardening
  ↓
  dae465a0  chore: update MCP config
  ↓
  323fe18c  chore(db): add migration snapshot 0027
  ↓
  89841689  Merge #361 feat/search-perf-phase1-quick-wins  ← CURRENT origin/main
```

PR #361 was merged AFTER PR #362, and it **reverted** the graph-pipeline-hardening changes (step reordering, orphan detection, ingestionSource, NotFoundError).

### Data Flow: Write vs Read Namespace Consistency

Both write (observation-capture) and read (four-path-search) derive namespace from the same source:
- Write: `workspace.settings.embedding.namespaceName` (fetched from DB in Step 3)
- Read: `getCachedWorkspaceConfig(workspaceId).namespaceName` (Redis cache → DB fallback)

Potential mismatch: If workspace was recreated with a new ID, the namespace changes but Redis cache (1hr TTL) still has the old namespace.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-07-v1-findsimilar-api-flow-analysis.md` — Detailed analysis of the findsimilar route following the same patterns as search
- `thoughts/shared/plans/2026-02-07-graph-pipeline-hardening.md` — Plan for the graph-pipeline-hardening changes (now reverted on origin/main)

## Debugging Checklist

To diagnose the exact cause, check:

1. **Inngest dashboard** — Are `neural/observation.capture` functions completing successfully? Check for failures/retries.
2. **Pinecone console** — Does the namespace have vectors? Query directly with `layer: "observations"` filter.
3. **Redis cache** — Check the workspace config cache key for stale data.
4. **Vercel logs** — Look for `"4-path parallel search complete"` log with `vectorMatches: 0` to confirm Pinecone returns nothing.
5. **Search mode** — If using "thorough" mode, try "fast" or "balanced" to rule out reranker filtering.

## Open Questions

1. Which environment is affected (production, preview, development)?
2. Was the workspace recently recreated or demo data reset?
3. What search mode is being used (fast/balanced/thorough)?
4. Are observations visible in the database (`workspaceNeuralObservations` table)?
5. Does Pinecone dashboard show vectors in the expected namespace?
6. Has the Inngest observation capture function been running successfully since the latest deploy?

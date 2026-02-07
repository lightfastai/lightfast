---
date: 2026-02-07
researcher: architect-agent
topic: "Graph Pipeline Architecture Design"
tags: [research, architecture, graph, pipeline, design]
status: complete
based_on:
  - 2026-02-07-graph-pipeline-codebase-deep-dive.md
  - 2026-02-07-graph-pipeline-external-research.md
  - 2026-02-05-accelerator-demo-relationship-graph-analysis.md
---

# Architecture Design: Graph Pipeline

## Executive Summary

The Lightfast graph pipeline is architecturally sound but has several specific failure modes causing "Observation not found" errors during chat interactions. The pipeline — webhook → transformer → Inngest capture → embedding → Pinecone upsert → relationship detection → graph API — is well-structured with proper separation of concerns and a 13-step observation capture workflow.

**The core problem is not architectural but operational**: the pipeline has a critical ordering vulnerability where Pinecone vectors can exist without corresponding DB records, leading to search results that reference non-existent observations. Additionally, the graph API returns 500 errors instead of 404s, making it impossible for the AI agent to handle missing observations gracefully.

The relationship graph infrastructure (schema, detection, BFS traversal, related API) has already been implemented per the Feb 5 research recommendations. The remaining work is: (1) fixing the immediate error paths, (2) hardening the pipeline against race conditions and partial failures, and (3) adding entity-based graph traversal for richer agent interactions.

**External research validation**: Industry patterns (Microsoft GraphRAG, Pinecone's recommended architecture, Graphiti knowledge graphs) confirm Lightfast's approach is pragmatically correct. The RDBMS-edges-with-Pinecone-vectors pattern is appropriate at current scale (<100K observations). The Pinecone metadata-driven ontology pattern aligns exactly with Lightfast's `sourceReferences` typed references. The critical write-ordering fix is confirmed by the saga pattern from event-driven architecture research. New insights include: (1) dimension validation at ingestion time, (2) graph-augmented search as a 5th path, and (3) temporal edge invalidation from Graphiti.

---

## Current Architecture Assessment

### Strengths

1. **Well-structured capture pipeline**: The 13-step Inngest workflow (`observation-capture.ts:336-1185`) has clear separation of concerns with idempotency (`sourceId`), concurrency limits (10/workspace), and 3 retries. Each step is individually retriable.

2. **Multi-view embedding strategy**: Three embeddings per observation (title, content, summary) at 1024 dimensions via Cohere `embed-english-v3.0` provides excellent retrieval flexibility. The four-path search (vector + entity + cluster + actor) is a sophisticated retrieval system.

3. **Pre-generated externalId pattern**: The Phase 3 optimization where `externalId` (nanoid) is generated at workflow start and stored in both Pinecone metadata and DB is an elegant solution to the ID normalization problem. It eliminates expensive DB lookups during search.

4. **Relationship graph is already implemented**: The `workspace-observation-relationships.ts` schema, `relationship-detection.ts` logic, `graph.ts` BFS traversal, and `related.ts` direct lookup are all in place. This is a significant achievement from the Feb 5 plan.

5. **Proper indexing**: Both the observations table (9 indexes) and relationships table (5 indexes including bidirectional traversal) have appropriate coverage for the query patterns used.

6. **Cascading deletes**: Relationship foreign keys have `ON DELETE CASCADE`, ensuring graph integrity when observations are removed.

7. **Confidence scoring**: Relationship detection assigns confidence scores (1.0 for explicit, 0.8-0.9 for inferred) and tracks detection methods, enabling future quality-based filtering.

8. **Metadata-driven ontology** (validated by external research): Pinecone recommends using metadata inherent in the dataset rather than LLM-inferred relationships for graph construction. Lightfast's `sourceReferences` with typed references (`commit`, `branch`, `pr`, `issue`) is exactly this pattern — structured, deterministic relationship detection that avoids hallucinated edges.

9. **HybridRAG pattern alignment**: The four-path search (vector + entity + cluster + actor) implements a form of HybridRAG that academic research shows consistently outperforms pure vector or pure graph retrieval. Lightfast is ahead of most RAG implementations here.

10. **Appropriate technology choices** (validated by external research): The RDBMS-edges-with-Pinecone pattern avoids Neo4j infrastructure overhead while providing sufficient graph capabilities for depth-limited BFS at current scale (<100K observations). External research confirms this is pragmatically optimal.

### Weaknesses

1. **Pinecone-before-DB ordering vulnerability**: Vectors are upserted to Pinecone (Step 7) BEFORE the DB record is created (Step 8). If the DB insert fails, orphaned Pinecone vectors exist with valid `observationId` metadata pointing to non-existent records. Search returns these IDs, graph lookup fails with "Observation not found".

2. **500 vs 404 error codes**: `graph.ts:77` and `related.ts:66` throw generic `Error` caught as 500 Internal Server Error. The agent can't distinguish "observation doesn't exist" from "server crashed" and can't retry intelligently.

3. **No entity-based graph entry point**: The Feb 5 research proposed `GET /v1/graph/entity/{key}` to find observations by commit SHA, issue ID, etc. This is unimplemented. The agent must know a specific observation ID to traverse the graph, which limits discovery.

4. **One-directional relationship detection**: Relationships are only created when the NEWER observation arrives (`relationship-detection.ts:45`). If Observation A is captured before Observation B exists, then when B arrives it creates A↔B edges. But if A arrives AFTER B, then A creates edges to B but B's original capture never retroactively creates edges to A. In practice this means edge creation depends on ingestion ordering.

5. **Deprecated workflow confirmed NOT registered**: `entity-extraction.ts` listens on `observation.captured` events and is marked `@deprecated`. Confirmed via `api/console/src/inngest/workflow/neural/index.ts` that it is NOT exported — only `observationCapture`, `profileUpdate`, `clusterSummaryCheck`, and `llmEntityExtractionWorkflow` are registered. This is NOT a current issue.

6. **No graph query in search results**: Four-path search returns observation data but not their relationships. The agent must make separate `workspaceGraph` or `workspaceRelated` calls to discover connections, adding latency and tool calls.

7. **Missing `linkingKeyType` in graph response**: The graph API returns `linkingKey` and `type` but not `linkingKeyType`, making it harder for the agent to explain WHY two observations are connected.

8. **No dimension validation at ingestion** (from external research): Embedding dimensions are not validated before Pinecone upsert. The recent dimension mismatch (1536 vs 1024, fixed in PR #362) would have been caught at ingestion time with a simple validation check. Pinecone rejects mismatched dimensions, but the error surfaces as a cryptic API error, not a user-friendly message.

9. **No graph-augmented search path** (from external research): The four-path search does NOT include graph traversal. After vector search returns results, graph relationships are only discovered via separate `workspaceGraph` tool calls. This means the initial search cannot discover observations that are semantically distant but structurally related (e.g., a Sentry error and the fixing PR, connected via commit SHA).

10. **No temporal edge invalidation** (from external research): When a PR is reverted or an issue is reopened, the "fixes" relationship remains active. Graphiti's temporal invalidation pattern (`invalidatedAt` timestamp) would preserve history while reflecting current state.

### Failure Points

| Location | Error | Trigger | Severity |
|----------|-------|---------|----------|
| `graph.ts:77` | "Observation not found" | Invalid/stale externalId passed to graph API | **High** |
| `related.ts:66` | "Observation not found" | Same as above | **High** |
| `entity-extraction.ts:67` | NonRetriableError("Observation not found") | Deprecated workflow — CONFIRMED NOT REGISTERED | **None** |
| `llm-entity-extraction-workflow.ts:127` | Skipped (observation_not_found) | Observation deleted between capture and LLM extraction | **Low** |
| Pinecone upsert | Dimension mismatch | Legacy 1536d vectors in index that now expects 1024d | **Resolved** |

---

## Root Cause Analysis: "Observation Not Found"

### The Error Path

```
User chat → Agent calls workspaceSearch
  → four-path-search queries Pinecone
  → Pinecone returns vectors with observationId in metadata
  → normalizeVectorIds reads observationId from metadata (Phase 3 path)
  → Returns observation IDs to agent

Agent calls workspaceGraph(id)
  → graphLogic queries DB: externalId = id AND workspaceId = auth.workspaceId
  → No record found → throws Error("Observation not found: ${id}")
  → Route handler catches as 500 INTERNAL_ERROR
  → Agent receives unhelpful error, cannot recover
```

### Identified Causes (Ranked by Likelihood)

**1. Pinecone Vector Orphans (HIGH probability)**
- **Code path**: `observation-capture.ts` Step 7 (Pinecone upsert at line 852) succeeds, but Step 8 (DB insert at line 922) fails
- **Why it happens**: The `externalId` nanoid is pre-generated at line 397 and embedded in Pinecone metadata at line 867. If the subsequent DB transaction fails (constraint violation, timeout, etc.), the Pinecone vector exists with a valid-looking `observationId` but no corresponding DB record
- **Why retries don't help**: Inngest retries the entire workflow, but Pinecone upserts are idempotent. The retry re-inserts the same vector (no-op) then tries the DB insert again. If the DB error is persistent (e.g., unique constraint on sourceId from a race), the vector stays orphaned
- **Evidence**: The capture workflow has `idempotency: "event.data.sourceEvent.sourceId"` which prevents duplicate function invocations, but two different Inngest events could have the same sourceId if duplicate webhooks arrive before the first completes

**2. Workspace Mismatch (MEDIUM probability)**
- **Code path**: `graph.ts:60-64` queries with both `workspaceId` and `externalId`
- **Why it happens**: The Pinecone namespace separates workspaces, but if the agent's auth context has a different workspaceId than the observation (e.g., user switched workspaces mid-session), the query returns null
- **Why it's hard to detect**: The error message only shows `observationId`, not `workspaceId`, making debugging difficult

**3. Ingestion Queue Delay (MEDIUM probability)**
- **Code path**: Test data trigger → Inngest queue → observation capture with 10 concurrency limit
- **Why it happens**: When sandbox data is loaded (50+ events), Inngest queues them with 10 concurrent per workspace. If the user immediately asks about the graph, some observations may not have been captured yet. However, these wouldn't appear in search results either (they're not in Pinecone yet), so the agent shouldn't have stale IDs... unless the agent is using IDs from a previous search or conversation memory
- **Refinement**: The agent uses Redis-backed memory (`AnswerRedisMemory`). If the agent remembers observation IDs from a previous conversation turn, and those observations were subsequently deleted or the workspace was reset, the IDs would be stale

**4. Agent ID Confusion (LOW probability)**
- **Code path**: Agent tool schema defines `id` as "The observation ID to traverse from"
- **Why it happens**: The agent could confuse Pinecone vector IDs (`obs_content_pr_acme_platform_478`) with observation externalIds (nanoids like `abc123def456`). The formats are very different, but LLM hallucination is possible
- **Mitigation already exists**: The tool schema uses Zod validation, but the type is just `z.string()` with no format validation

### Timing Analysis

```
Webhook arrival (t=0)
  ↓ ~50ms
Inngest event queued (t=50ms)
  ↓ ~100ms-2s (queue + start timeout)
Observation capture starts (t=150ms-2s)
  ↓ ~500ms (Steps 1-4: dedup, config, significance)
Parallel processing starts (t=~700ms)
  ↓ ~2-5s (classification + embedding + entity extraction + actor resolution)
Cluster assignment (t=~3-6s)
  ↓ ~200ms
Pinecone upsert (t=~3.5-6.5s) ← VECTOR EXISTS IN PINECONE
  ↓ ~100-500ms
DB insert (t=~3.6-7s)           ← DB RECORD EXISTS
  ↓ ~200ms
Relationship detection (t=~4-7.5s)  ← EDGES EXIST
  ↓ ~100ms
Events emitted (t=~4.2-7.7s)

WINDOW OF VULNERABILITY: Between Pinecone upsert and DB insert (~100-500ms)
- During this window, search could return the observation but graph lookup would fail
- With concurrent users, this window is real but narrow
```

---

## Gap Analysis

### Current State vs Best Practices

| Capability | Current State | Best Practice | Gap |
|-----------|---------------|---------------|-----|
| **Atomic write** | Pinecone + DB writes are separate, non-transactional | Write DB first, then Pinecone (or use outbox pattern) | **Critical**: Reorder writes so DB is authoritative |
| **Error codes** | Generic 500 for all errors | Typed errors (404 for not found, 409 for conflict) | **High**: Return proper HTTP status codes |
| **Graph entry** | Only by observation ID | By entity key, by time range, by source | **Medium**: Add entity-based graph entry |
| **Relationship backfill** | One-directional (newer creates edges) | Bidirectional reconciliation job | **Medium**: Periodic backfill for missed relationships |
| **Observability** | Structured logging + job records | Distributed tracing across Inngest steps | **Low**: Already well-instrumented via Inngest |
| **Retry semantics** | 3 retries with idempotency key | Dead letter queue with manual review | **Low**: Inngest's failure handler already captures |
| **Vector consistency** | Single dimension (1024) enforced | Dimension validation at upsert time | **Low**: Resolved — consistent 1024d |
| **Agent error handling** | Agent receives opaque 500 errors | Structured tool errors with suggested actions | **Medium**: Improve tool error messages |

### What's Missing

1. **Transactional write ordering**: DB should be written BEFORE Pinecone, not after. The DB record is the source of truth; Pinecone is a derived index. A missing Pinecone vector is recoverable (re-embed and upsert); a missing DB record with an orphaned Pinecone vector causes hard failures. External research on the saga pattern confirms this: "If Step 2 fails → compensate Step 1" is harder than reordering to eliminate the need for compensation.

2. **Orphaned vector cleanup**: No mechanism to detect and remove Pinecone vectors whose corresponding DB records don't exist. A periodic reconciliation job is needed. Pinecone's 2025 bulk-delete-by-metadata feature makes this operationally simpler.

3. **Entity-based graph API**: `GET /v1/graph/entity/{key}?type=commit` to find all observations connected to a commit SHA, issue ID, etc. The agent currently must know a specific observation ID.

4. **Relationship enrichment in search**: Search results should optionally include direct relationships, saving the agent from making separate `workspaceGraph` calls.

5. **Graph staleness indicator**: When the graph is queried immediately after sandbox data load, there's no way to tell the user "data is still being ingested." A pipeline health status endpoint could help.

6. **Dimension validation at boundary** (from external research): A simple `if (embedding.length !== EMBEDDING_MODEL_DEFAULTS.dimension)` check before Pinecone upsert would catch configuration errors at ingestion time. This is a defensive validation pattern recommended across the industry.

7. **Graph-augmented search** (from external research): Microsoft GraphRAG's local search and HybridRAG both use graph expansion from vector search entry points. Adding 1-hop graph expansion from top-K vector results would discover structurally-related observations that are semantically distant — the core value proposition of the relationship graph.

8. **Temporal edge invalidation** (from Graphiti): Events can make relationships obsolete (PR reverted, issue reopened). Currently, edges are permanent. Adding an `invalidatedAt` timestamp column to the relationships table (nullable, null = active) would preserve history while reflecting current state.

---

## Proposed Design

### P0: Fix Errors (Immediate — 1-2 days)

#### P0.1: Reorder Pinecone and DB writes

**Problem**: Pinecone upsert (Step 7) happens before DB insert (Step 8), creating orphaned vectors on DB failure.

**Fix**: Swap the order in `observation-capture.ts`. Insert to DB first (making the observation authoritative), then upsert to Pinecone. If Pinecone fails, the observation exists in DB but isn't searchable — a much safer failure mode that can be retried.

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Change**: Move "store-observation" step (currently line 922) BEFORE "upsert-multi-view-vectors" step (currently line 852).

```typescript
// CURRENT ORDER (dangerous):
// Step 6: upsert-multi-view-vectors (Pinecone)   ← can create orphans
// Step 7: store-observation (DB)                   ← if this fails, orphaned vector
// Step 7.5: detect-relationships

// PROPOSED ORDER (safe):
// Step 6: store-observation (DB)                   ← source of truth first
// Step 7: upsert-multi-view-vectors (Pinecone)   ← if this fails, retry safely
// Step 7.5: detect-relationships
```

**Risk**: If Pinecone upsert fails after DB insert, the observation exists but isn't searchable. This is acceptable because: (a) Inngest retries will attempt the Pinecone upsert again, (b) the observation won't appear in search results (no false positives), and (c) a background reconciliation job can detect and re-upsert missing vectors.

#### P0.2: Return proper HTTP status codes from graph API

**Problem**: `graph.ts:77` and `related.ts:66` throw generic `Error` caught as 500.

**Fix**: Create a typed `NotFoundError` class and handle it in the route handler.

**Files**:
- `apps/console/src/lib/v1/graph.ts:77` — Throw `NotFoundError`
- `apps/console/src/lib/v1/related.ts:66` — Throw `NotFoundError`
- `apps/console/src/app/(api)/v1/graph/[id]/route.ts` — Catch `NotFoundError` → 404
- `apps/console/src/app/(api)/v1/related/[id]/route.ts` — Catch `NotFoundError` → 404

```typescript
// New error class (in a shared location like packages/console-types/src/errors.ts)
export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

// In graph.ts:77
if (!rootObs) {
  throw new NotFoundError("Observation", input.observationId);
}

// In route handler
if (error instanceof NotFoundError) {
  return NextResponse.json(
    { error: "NOT_FOUND", message: error.message },
    { status: 404 }
  );
}
```

#### P0.3: Improve agent tool error messages

**Problem**: The agent receives `{ error: "INTERNAL_ERROR", message: "Observation not found: abc123" }` with no guidance on what to do.

**Fix**: Update the tool error handling to provide actionable context.

**File**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`

```typescript
workspaceGraph: {
  handler: async (input) => {
    try {
      return await graphLogic(auth, {
        observationId: input.id,
        depth: input.depth ?? 1,
        requestId: randomUUID(),
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return {
          error: "not_found",
          message: `Observation ${input.id} was not found. It may have been deleted or not yet ingested. Try searching for the topic instead using workspaceSearch.`,
          suggestedAction: "workspaceSearch",
        };
      }
      throw error;
    }
  },
},
```

#### P0.4: Add workspaceId to error messages for debugging

**Problem**: "Observation not found: abc123" doesn't include workspace context.

**Fix**: Log workspaceId alongside the error in `graph.ts` and `related.ts`.

**Files**: `apps/console/src/lib/v1/graph.ts`, `apps/console/src/lib/v1/related.ts`

```typescript
if (!rootObs) {
  log.warn("Graph query - observation not found", {
    observationId: input.observationId,
    workspaceId: auth.workspaceId,
    requestId: input.requestId,
  });
  throw new NotFoundError("Observation", input.observationId);
}
```

#### P0.5: Add embedding dimension validation (from external research)

**Problem**: Embedding dimension mismatches are caught by Pinecone at upsert time with cryptic errors. The recent 1536 vs 1024 bug (PR #362) was discovered late.

**Fix**: Validate embedding dimensions before Pinecone upsert in `observation-capture.ts`.

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts` (in the generate-multi-view-embeddings step)

```typescript
// After embedding generation, before Pinecone upsert
const expectedDim = workspace.settings.embedding.embeddingDim;
for (const [view, embedding] of [
  ["title", embeddingResult.title.vector],
  ["content", embeddingResult.content.vector],
  ["summary", embeddingResult.summary.vector],
]) {
  if (embedding.length !== expectedDim) {
    throw new NonRetriableError(
      `Embedding dimension mismatch for ${view}: got ${embedding.length}, expected ${expectedDim}`
    );
  }
}
```

**Why P0**: This is a cheap defensive check that prevents a class of hard-to-debug errors. ~5 lines of code.

### P1: Improve Reliability (Medium-term — 3-5 days)

#### P1.1: Orphaned vector reconciliation job

**Problem**: If the DB write reorder (P0.1) isn't foolproof, or legacy orphaned vectors exist, search can still return non-existent observations.

**Fix**: Create a periodic Inngest scheduled function that:
1. Queries Pinecone for all vectors in a workspace namespace
2. Checks each `observationId` from metadata against the DB
3. Deletes Pinecone vectors whose observations don't exist

**File**: New file `api/console/src/inngest/workflow/neural/vector-reconciliation.ts`

```typescript
// Scheduled: Every 6 hours per workspace
// - List Pinecone vectors (paginated)
// - Batch-check observationId existence in DB
// - Delete orphaned vectors
// - Log reconciliation metrics
```

#### P1.2: Validate observation existence in normalizeVectorIds

**Problem**: `normalizeVectorIds` in `four-path-search.ts:82-210` trusts Pinecone metadata observationId without verifying the DB record exists.

**Fix**: Add a lightweight existence check for Phase 3 (metadata-based) IDs before returning them as search results.

**File**: `apps/console/src/lib/neural/four-path-search.ts`

```typescript
// After collecting observation IDs from Pinecone metadata (Phase 3 path)
// Batch-verify existence in DB
const existingIds = await db
  .select({ externalId: workspaceNeuralObservations.externalId })
  .from(workspaceNeuralObservations)
  .where(
    and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      inArray(workspaceNeuralObservations.externalId, metadataObsIds)
    )
  );

const existingSet = new Set(existingIds.map(r => r.externalId));
// Filter out non-existent observations
```

**Trade-off**: Adds ~5-10ms DB query to search path. Eliminates the entire class of "Observation not found" errors.

#### P1.3: Relationship backfill for ordering-dependent edges

**Problem**: Relationship detection only runs when the newer observation arrives. If observations are ingested out of order, some edges are missed.

**Fix**: After all observations in a batch are captured (e.g., sandbox data), run a relationship reconciliation step.

**Approach**: Add a scheduled Inngest function that:
1. Queries observations without any relationships (neither source nor target)
2. Re-runs relationship detection for each
3. Creates missing edges

**File**: New file or extension of `api/console/src/inngest/workflow/neural/relationship-detection.ts`

#### P1.4: ~~Deregister deprecated entity extraction workflow~~ — RESOLVED

**Status**: CONFIRMED NOT AN ISSUE. Checked `api/console/src/inngest/workflow/neural/index.ts` — only 4 workflows are exported: `observationCapture`, `profileUpdate`, `clusterSummaryCheck`, `llmEntityExtractionWorkflow`. The deprecated `entityExtraction` is NOT registered with Inngest. No action needed.

#### P1.5: Add `linkingKeyType` to graph API response

**Problem**: Graph response has `linkingKey` but not `linkingKeyType`, making it harder for the agent to explain relationships.

**Fix**: Include `linkingKeyType` in the edge objects returned by `graphLogic`.

**File**: `apps/console/src/lib/v1/graph.ts:143-155`

```typescript
edges.push({
  source: sourceNode.externalId,
  target: targetNode.externalId,
  type: rel.relationshipType,
  linkingKey: rel.linkingKey,
  linkingKeyType: rel.linkingKeyType,  // ADD THIS
  confidence: rel.confidence,
});
```

### P2: Improve Architecture (Longer-term — 1-2 weeks)

#### P2.1: Entity-based graph entry point

**Problem**: The agent can only traverse the graph starting from a known observation ID.

**Fix**: Add `GET /v1/graph/entity/{key}?type=commit` endpoint.

**Files**:
- New: `apps/console/src/lib/v1/graph-entity.ts`
- New: `apps/console/src/app/(api)/v1/graph/entity/[key]/route.ts`
- Update: `packages/console-ai/src/` — Add new agent tool `workspaceGraphByEntity`

**Implementation**:
```typescript
export async function graphEntityLogic(
  auth: V1AuthContext,
  input: { entityKey: string; entityType?: string; depth?: number; requestId: string }
): Promise<GraphLogicOutput> {
  // 1. Find observations that reference this entity
  //    - Search sourceReferences JSONB: @> [{"type": entityType, "id": entityKey}]
  //    - Search title/sourceId ILIKE
  // 2. Pick the observation with most relationships as root
  // 3. Run BFS from that root
  // 4. Return graph
}
```

#### P2.2: Relationship-enriched search results

**Problem**: Search returns observations without relationship context. Agent must make separate graph calls.

**Fix**: Optionally include direct relationships in search results.

**File**: `apps/console/src/lib/v1/search.ts` and `apps/console/src/lib/neural/four-path-search.ts`

```typescript
// In enrichSearchResults, add optional relationship fetching
if (options.includeRelationships) {
  const relationships = await db
    .select()
    .from(workspaceObservationRelationships)
    .where(
      and(
        eq(workspaceObservationRelationships.workspaceId, workspaceId),
        or(
          inArray(workspaceObservationRelationships.sourceObservationId, internalObsIds),
          inArray(workspaceObservationRelationships.targetObservationId, internalObsIds)
        )
      )
    );
  // Attach to each result
}
```

#### P2.3: Pipeline health status endpoint

**Problem**: No way to know if observation ingestion is still in progress after sandbox data load.

**Fix**: Add `GET /v1/pipeline/status` that returns:
- Number of pending observation capture jobs
- Last observation captured timestamp
- Relationship count
- Whether ingestion is "caught up"

**File**: New route in `apps/console/src/app/(api)/v1/pipeline/status/route.ts`

#### P2.4: Graph-augmented search (5th path) — from external research

**Problem**: Four-path search doesn't include graph traversal. Structurally-related observations (e.g., Sentry error ↔ fixing PR) are only discovered through separate graph tool calls.

**Fix**: Add a 5th search path that does 1-hop graph expansion from top vector results.

**File**: `apps/console/src/lib/neural/four-path-search.ts`

**Implementation**:
```typescript
// After vector results are normalized (step 4), before merge (step 5):
// 1. Take top 5 vector results
// 2. Query workspaceObservationRelationships for their direct neighbors
// 3. Fetch neighbor observation metadata
// 4. Add to merged results with lower base score (0.6 * neighbor_relationship_confidence)
// 5. This enables discovering structurally-related observations
```

**Trade-off**: Adds ~20-50ms (one relationship query + one observation fetch). Significantly improves multi-hop question answers. This is the core GraphRAG local search pattern.

**External validation**: Microsoft GraphRAG's local search and HybridRAG research both demonstrate that graph expansion from vector entry points improves answer quality by 20-70% on multi-hop questions.

#### P2.5: Temporal edge invalidation — from Graphiti pattern

**Problem**: When a PR is reverted or an issue is reopened, the "fixes" edge remains active in the relationship graph.

**Fix**: Add optional `invalidatedAt` timestamp column to `workspaceObservationRelationships`.

**File**: `db/console/src/schema/tables/workspace-observation-relationships.ts`

**Schema change**:
```typescript
// Add to workspaceObservationRelationships columns:
invalidatedAt: timestamp("invalidated_at", {
  mode: "string",
  withTimezone: true,
}),
// null = edge is active
// set = edge was superseded/invalidated at this time
```

**Query change**: Default graph queries add `WHERE invalidated_at IS NULL`. Historical queries can include all edges.

**Detection**: When a "revert" commit observation arrives (detected by commit message patterns like "Revert ..." or `revert_commit` sourceType), find the original commit's relationships and set `invalidatedAt`.

**Note**: This requires a DB migration (new nullable column). Low risk since it's nullable and defaults to null.

#### P2.6: Agent memory observation ID validation (renamed from P2.4)

**Problem**: Agent may use stale observation IDs from Redis memory across conversation turns.

**Fix**: Before the agent uses a cached observation ID, validate it still exists. This could be a pre-check in the tool handler.

**File**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`

---

### File/Package Structure

All changes fit within existing packages. No new packages are needed.

| Change | Package | File |
|--------|---------|------|
| Write ordering swap | `@api/console` | `api/console/src/inngest/workflow/neural/observation-capture.ts` |
| NotFoundError class | `@repo/console-types` | `packages/console-types/src/errors.ts` (new) |
| Graph API 404 | `apps/console` | `apps/console/src/lib/v1/graph.ts`, `apps/console/src/app/(api)/v1/graph/[id]/route.ts` |
| Related API 404 | `apps/console` | `apps/console/src/lib/v1/related.ts`, `apps/console/src/app/(api)/v1/related/[id]/route.ts` |
| Agent tool errors | `apps/console` | `apps/console/src/app/(api)/v1/answer/[...v]/route.ts` |
| Vector reconciliation | `@api/console` | `api/console/src/inngest/workflow/neural/vector-reconciliation.ts` (new) |
| Existence validation | `apps/console` | `apps/console/src/lib/neural/four-path-search.ts` |
| Entity graph API | `apps/console` | `apps/console/src/lib/v1/graph-entity.ts` (new), route (new) |
| Dimension validation | `@api/console` | `api/console/src/inngest/workflow/neural/observation-capture.ts` |
| Graph-augmented search | `apps/console` | `apps/console/src/lib/neural/four-path-search.ts` |
| Temporal invalidation | `@db/console` | `db/console/src/schema/tables/workspace-observation-relationships.ts` |
| Deregister deprecated | `@api/console` | `api/console/src/inngest/workflow/neural/index.ts` |

### Data Flow

**Current flow (problematic)**:
```
Webhook → Transformer → Inngest → Capture Workflow
  → Pinecone upsert (vector exists) → DB insert (record exists)
  → Relationship detection → Events
```

**Proposed flow (safe)**:
```
Webhook → Transformer → Inngest → Capture Workflow
  → DB insert (record exists, source of truth)
  → Pinecone upsert (vector exists, derived index)
  → Relationship detection → Events
```

**Search flow (improved)**:
```
User query → 4-path search → Pinecone query
  → normalizeVectorIds (with existence check) → merge results
  → Rerank → Enrich (with optional relationships)
  → Return to agent
```

**Graph flow (improved)**:
```
Agent calls workspaceGraph(id)
  → graphLogic: DB lookup by externalId + workspaceId
  → If not found: return 404 with helpful message
  → If found: BFS traversal with linkingKeyType in edges
  → Return graph to agent
```

### DB Schema Changes

**P0 and P1: No schema migrations needed.** All P0/P1 changes work with existing schemas.

**P2.5 (temporal edge invalidation): One migration required.** Add nullable `invalidated_at` column to `lightfast_workspace_observation_relationships`. This is a non-breaking addition:
- Column is nullable (defaults to NULL = active edge)
- No existing data is affected
- Existing queries continue working (NULL passes any filter)
- Generate via: `cd db/console && pnpm db:generate` (never write manual SQL)

```typescript
// In workspace-observation-relationships.ts, add to columns:
invalidatedAt: timestamp("invalidated_at", {
  mode: "string",
  withTimezone: true,
}),
```

### Pinecone Strategy

**Current state**: Consistent 1024-dimension vectors using Cohere `embed-english-v3.0`. Single shared index (`lightfast-v1`) with workspace-level namespace isolation.

**Long-term approach**:

1. **Dimension is stable**: 1024d via Cohere is well-chosen. No migration needed.

2. **Orphan cleanup**: Implement periodic reconciliation (P1.1) to detect and remove vectors whose observations don't exist in DB. This is the primary Pinecone-related fix.

3. **Metadata consistency**: The `observationId` field in Pinecone metadata is the critical link to DB records. Any future embedding model change must preserve this field.

4. **Namespace management**: Current hierarchical namespace (`org_{clerkOrgId}:ws_{workspaceId}`) is sound. Supports up to 25K namespaces per Pinecone Standard plan.

5. **Vector deletion on observation delete**: Currently handled by cascading DB deletes for relationships, but Pinecone vectors are NOT automatically deleted when an observation is deleted from DB. The vector reconciliation job (P1.1) would catch these, but ideally, observation deletion should also delete the corresponding Pinecone vectors. Pinecone's 2025 bulk-delete-by-metadata feature could simplify this.

6. **Future model migration** (from external research): Pinecone index dimensions are immutable. If Lightfast ever switches embedding models (e.g., to a matryoshka model for flexible dimensions), the recommended pattern is blue-green deployment: create new index → dual-write → backfill → shadow test → cutover → decommission old. Cohere v3.0's fixed 1024d is stable for now but this migration path should be documented.

7. **Metadata schema optimization** (from external research): Pinecone's 2025 metadata schema declaration at index creation allows pre-indexing specific fields for faster filtering. For Lightfast's next index creation (or existing index reconfiguration), declaring `layer`, `source`, `view`, and `observationType` as schema fields would improve filter performance.

---

## Security Considerations

1. **Workspace isolation**: Both graph and related APIs enforce `workspaceId` in all queries. No cross-workspace data leakage is possible through the current query patterns.

2. **Dual auth**: The V1 API supports both API key and session auth via `withDualAuth`. This is appropriate for the graph endpoints.

3. **Depth limiting**: BFS traversal is hard-capped at depth 3 (`graph.ts:88`), preventing expensive deep traversals.

4. **Entity query injection**: The entity-based graph API (P2.1) must sanitize the entity key parameter to prevent SQL injection via the JSONB containment query. The current pattern uses parameterized queries (`${JSON.stringify([...])}::jsonb`), which is safe.

5. **Rate limiting**: The graph/related endpoints should have rate limits to prevent abuse. Current Inngest concurrency (10/workspace) limits the capture pipeline but not the query API.

---

## Error Handling

### Current Error Handling Gaps

| Scenario | Current Behavior | Proposed Behavior |
|----------|------------------|-------------------|
| Observation not found | 500 INTERNAL_ERROR | 404 NOT_FOUND with guidance |
| Pinecone query fails | Logs error, returns empty results | Same (already graceful) |
| DB insert fails after Pinecone upsert | Orphaned vector, silent failure | DB first → no orphaned vector |
| Relationship detection fails | Logs error, returns 0 | Same (already graceful) |
| Agent uses stale ID | 500 error, agent confused | 404 with "try workspaceSearch" suggestion |

### Proposed Error Strategy

1. **Typed errors**: `NotFoundError`, `WorkspaceMismatchError`, `PipelineNotReadyError`
2. **Agent-friendly messages**: Include `suggestedAction` field in tool error responses
3. **Observability**: All error paths log `requestId`, `workspaceId`, and `observationId` for correlation
4. **Graceful degradation**: If relationship detection fails, observation capture still succeeds (already implemented)

---

## Integration with Existing Systems

### Inngest Workflow Integration

All P0 and P1 changes integrate directly into existing Inngest workflows:

- **P0.1 (write reorder)**: Swap two existing steps in `observation-capture.ts`. No new workflows needed.
- **P1.1 (vector reconciliation)**: New scheduled Inngest function, registered alongside existing neural workflows.
- **P1.3 (relationship backfill)**: Extension of existing `relationship-detection.ts` logic, triggered as scheduled Inngest function.

### tRPC Router Changes

No tRPC changes needed. The graph/related APIs are in the V1 REST layer (`apps/console/src/app/(api)/v1/`), not the tRPC router.

The entity-based graph API (P2.1) follows the same V1 REST pattern.

### Agent SDK Integration

New agent tools (P2.1: `workspaceGraphByEntity`) follow the existing pattern:
1. Define Zod schema in `packages/console-ai/src/`
2. Register tool in `packages/console-ai-types/src/`
3. Wire handler in `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`

---

## Migration Path

### Phase 1: P0 Fixes (Zero downtime)

1. **Deploy P0.2 first** (error codes): This is purely additive — adds `NotFoundError` class and updates route handlers. No data changes.
2. **Deploy P0.3** (agent error messages): Updates tool handlers. No data changes.
3. **Deploy P0.4** (logging): Adds context to logs. No data changes.
4. **Deploy P0.1 last** (write reorder): Swap step ordering. Test thoroughly in development first. The change is safe because:
   - DB writes are idempotent (upsert with unique constraints)
   - Pinecone writes are idempotent (same vector ID overwrites)
   - No new data format or schema changes

### Phase 2: P1 Improvements (Zero downtime)

1. **Deploy P1.4** (deregister deprecated): Remove export, no runtime impact.
2. **Deploy P1.5** (linkingKeyType): Additive field in API response, backwards compatible.
3. **Deploy P1.2** (existence validation): Adds DB query to search path. Monitor latency.
4. **Deploy P1.1** (reconciliation job): New scheduled function. Run once manually first to clean up existing orphans.
5. **Deploy P1.3** (relationship backfill): New scheduled function. Run once after deployment to create missing edges.

### Phase 3: P2 Architecture (Zero downtime)

1. **Deploy P2.1** (entity graph API): New endpoint, no impact on existing APIs.
2. **Deploy P2.2** (relationship-enriched search): Behind `includeRelationships` query param, opt-in.
3. **Deploy P2.3** (pipeline status): New endpoint, informational only.
4. **Deploy P2.4** (graph-augmented search): Adds 5th search path. Monitor latency impact.
5. **Deploy P2.5** (temporal edge invalidation): Requires DB migration (nullable column addition). Run `pnpm db:generate && pnpm db:migrate` from `db/console/`. Zero-downtime since column is nullable.
6. **Deploy P2.6** (agent memory validation): Enhancement to answer route handler.

### Rollback Plan

All changes are individually reversible:
- **P0.1**: Swap steps back to original order
- **P0.2-P0.4**: Revert error handling (no data impact)
- **P0.5**: Remove dimension validation check
- **P1.1-P1.3**: Disable scheduled functions in Inngest dashboard
- **P2.1-P2.4, P2.6**: Remove new endpoints/search paths (no existing functionality affected)
- **P2.5**: The `invalidatedAt` column is nullable and unused by existing code. Column can remain harmlessly in DB even if code is reverted. No data loss risk.

Only P2.5 requires a database migration. All other changes are purely code-level and instantly reversible.

---

## What NOT to Do (Validated by External Research)

The external research explicitly confirms these are **not recommended** at current scale:

1. **Full GraphRAG with community detection** (Microsoft pattern): Indexing cost is 5-10x, not justified for <10K observations. Becomes valuable at >10K observations when users ask dataset-wide questions ("what are the main deployment themes this quarter?").

2. **Neo4j or dedicated graph database**: Additional infrastructure complexity not needed when RDBMS edge table with BIGINT joins provides sufficient BFS performance. Neo4j would be justified only at >100K observations with deep traversal requirements (depth >3).

3. **Dedicated streaming platform** (Kafka/Redpanda): Inngest provides sufficient async event processing for the current ingestion volume. A streaming platform would be justified only for >1000 events/minute sustained throughput.

4. **Multi-model vector database migration** (Weaviate/Qdrant): Pinecone is working well with 1024d Cohere vectors. Migration risk outweighs any marginal benefit. Reconsider only if Pinecone pricing or feature gaps become blocking.

5. **LLM-based relationship detection**: The current regex + structured reference approach is deterministic and fast. LLM-based relationship inference introduces hallucination risk and latency. Only consider for detecting implicit relationships in unstructured prose.

---

## Open Questions

1. ~~**Is the deprecated `entity-extraction.ts` actually registered with Inngest?**~~ **RESOLVED**: Confirmed it is NOT exported from `index.ts`. Not registered with Inngest. No action needed.

2. **What's the actual frequency of "Observation not found" errors in production?** Need to check logs/metrics to understand if this is a demo-only issue or affects production workspaces too.

3. **Should search results include relationship counts?** Adding "this observation has 5 relationships" to search results could help the agent decide when to call `workspaceGraph`.

4. **Is the 10-concurrency Inngest limit causing queue buildup for sandbox data?** With 50+ events, the queue could be significant. Increasing to 20 for sandbox data loads might reduce the ingestion time window.

5. **Should we implement vector deletion on observation delete?** Currently, deleting a DB observation doesn't clean up its Pinecone vectors. The reconciliation job (P1.1) would catch these eventually, but immediate cleanup is cleaner.

6. **What's the real-world latency impact of the existence check (P1.2)?** The batch DB query should be fast with the `externalId` unique index, but it needs benchmarking with real data volumes.

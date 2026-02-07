---
date: 2026-02-07
researcher: codebase-agent
topic: "Graph Pipeline End-to-End Analysis"
tags: [research, codebase, graph, neural, pipeline, observations, relationships, pinecone]
status: complete
---

# Codebase Deep Dive: Graph Pipeline End-to-End

## Research Question

When chatting with the AI agent and asking it to "show the relationship graph" for an incident, we get repeated "Observation not found" errors. The graph query seems to fail at the API level — possibly wrong arguments, race conditions, or missing data. We need to trace the entire graph mechanism pipeline end-to-end to identify root causes.

## Summary

The Lightfast graph pipeline is a **well-architected 8-step workflow** that transforms webhook events into observations, creates embeddings in Pinecone, detects relationships between observations, and exposes a BFS-based graph traversal API. The pipeline flows: **Webhook → Transformer → Inngest Event → Observation Capture Workflow → DB + Pinecone → Relationship Detection → Graph API**.

The **"Observation not found" error** originates from two specific code paths (`apps/console/src/lib/v1/graph.ts:77` and `apps/console/src/lib/v1/related.ts:66`) that look up observations by `externalId` (nanoid). The most likely causes are: (1) The AI agent receiving an observation ID from Pinecone metadata that doesn't match any DB record due to the recent BIGINT migration, (2) The agent passing a Pinecone vector ID instead of a database externalId, or (3) A race condition where the graph API is called before the observation capture workflow completes (the workflow is async via Inngest with up to 5m timeout).

The **Pinecone dimension issue** (1536 vs 1024) has been resolved — the codebase now consistently uses 1024 dimensions (Cohere `embed-english-v3.0`), configured as a single source of truth in `packages/console-validation/src/constants/embedding.ts:38`. However, any legacy vectors stored at 1536 dimensions would cause query failures since Pinecone enforces dimension consistency per index.

## Detailed Findings

### 1. Observation Capture Pipeline

**Entry Point**: Webhook route handlers in `apps/console/src/app/`

The pipeline starts when a webhook arrives from GitHub, Vercel, Linear, or Sentry. Each webhook route handler:

1. Verifies the webhook signature
2. Looks up the workspace associated with the webhook source
3. Transforms the raw payload into a `SourceEvent` using source-specific transformers
4. Emits an Inngest event `apps-console/neural/observation.capture`

**GitHub webhook handler**: `apps/console/src/app/(github)/api/github/webhooks/route.ts:210,268,326,383,440`
- Handles push, pull_request, issues, release, discussion events
- Each fires `inngest.send({ name: "apps-console/neural/observation.capture", ... })`

**Vercel webhook handler**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:74`

**Test data trigger**: `packages/console-test-data/src/trigger/trigger.ts:57` (for sandbox/demo data)

#### Observation Capture Workflow (The Core)

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts:336-1185`

**Function ID**: `apps-console/neural.observation.capture`

**Configuration**:
- Retries: 3
- Idempotency key: `event.data.sourceEvent.sourceId` (prevents duplicate processing)
- Concurrency: 10 per workspace
- Timeouts: start=1m, finish=5m

**Step-by-step flow**:

1. **resolve-clerk-org-id** (line 401): Resolves clerkOrgId from event data or DB fallback
2. **create-job** (line 417): Creates a job tracking record
3. **check-duplicate** (line 441): Queries DB for existing observation with same sourceId — returns early if duplicate
4. **check-event-allowed** (line 496): Verifies event type is enabled in workspace integration config
5. **evaluate-significance** (line 582): Rule-based scoring (0-100) using event weights + content signals. Threshold=40 — below this, event is silently dropped
6. **fetch-context** (line 635): Loads workspace configuration including embedding settings
7. **PARALLEL processing** (line 711):
   - **classify-observation**: LLM classification via Claude Haiku (with regex fallback)
   - **generate-multi-view-embeddings**: Creates 3 embeddings per observation (title, content, summary) using Cohere `embed-english-v3.0` at 1024 dimensions
   - **extract-entities**: Regex-based entity extraction from text and structured references
   - **resolve-actor**: Actor resolution (GitHub ID matching, email matching)
8. **assign-cluster** (line 815): Groups observation into topic cluster based on embedding similarity, entity overlap, actor overlap, temporal proximity
9. **upsert-multi-view-vectors** (line 852): Upserts 3 vectors to Pinecone with metadata including `observationId: externalId` (the nanoid)
10. **store-observation** (line 922): Transactional insert of observation + entities into PostgreSQL
    - **CRITICAL**: The `externalId` (nanoid) is pre-generated at workflow start (line 397) and stored both in Pinecone metadata AND the DB record
    - Internal BIGINT `id` is auto-generated by PostgreSQL
11. **detect-relationships** (line 1004): Creates relationship edges (see section 2)
12. **reconcile-vercel-actors** (line 1023): For GitHub push events, reconciles Vercel observations with numeric actor IDs
13. **emit-events** (line 1053): Fires completion events for downstream systems (profile updates, cluster summaries, LLM entity extraction)

**Key IDs**:
- `externalId` (nanoid, 21 chars): Used in API responses, Pinecone metadata (`observationId` field), and all public-facing interfaces
- `id` (BIGINT): Internal DB primary key, used for joins and foreign keys in relationships table
- `sourceId`: Source-specific identifier (e.g., `pr:lightfastai/lightfast#123`), used for idempotency
- Pinecone vector IDs: `obs_title_{sourceId}`, `obs_content_{sourceId}`, `obs_summary_{sourceId}`

### 2. Relationship Detection

**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-285`

**Triggered by**: Step 7.5 of observation capture (line 1004-1013 in observation-capture.ts)

**Detection methods**:

1. **Commit SHA matching** (line 70-103): JSONB containment query `sourceReferences::jsonb @> '[{"type":"commit","id":"..."}]'::jsonb`
   - Between GitHub push + Vercel deployment = `deploys`
   - Between Sentry resolved + commit = `resolves`
   - Default cross-source = `same_commit`
   - Confidence: 1.0

2. **Branch name matching** (line 106-124): Same JSONB containment for `type: "branch"`
   - Type: `same_branch`
   - Confidence: 0.9

3. **Issue ID matching** (line 127-177):
   - "Fixes #123" / "Closes #123" from PR body → `fixes` (confidence 1.0)
   - Other issue mentions → `references` (confidence 0.8)
   - Searches both JSONB references AND title/sourceId ILIKE

4. **PR ID matching** (line 179-198): Linear → GitHub PR via attachments
   - Type: `tracked_in`
   - Confidence: 1.0

5. **Sentry → Linear triggers** (line 200-245): When Linear has `linked` Sentry issue references
   - Type: `triggers`
   - Confidence: 0.8

**Deduplication** (line 478-493): Keeps highest confidence for same target + relationship type.

**Insertion** (line 253-284): Batch insert with `onConflictDoNothing()` to handle race conditions.

**Important**: Relationships use **internal BIGINT IDs** (`observationId: number`) for both `sourceObservationId` and `targetObservationId`. This is correct since both sides are stored in the same `workspaceNeuralObservations` table.

### 3. Graph Traversal API

#### Route Handler

**File**: `apps/console/src/app/(api)/v1/graph/[id]/route.ts:24-81`

**Endpoint**: `GET /v1/graph/{observationId}?depth=2&types=fixes,deploys`

**Auth**: `withDualAuth` — supports both API key and session auth

**Parameters**:
- `id` (path): Observation externalId (nanoid)
- `depth` (query): Max traversal depth, capped at 3
- `types` (query): Comma-separated relationship types to filter

#### Graph Logic (BFS)

**File**: `apps/console/src/lib/v1/graph.ts:51-201`

**Algorithm**: Breadth-first traversal

1. **Root lookup** (line 60-78): Finds observation by `externalId` + `workspaceId`
   - **ERROR SOURCE**: `throw new Error('Observation not found: ${input.observationId}')` at line 77

2. **BFS loop** (line 89-159): For each depth level:
   - Queries `workspaceObservationRelationships` for frontier node IDs (both source and target)
   - Filters by allowed relationship types if specified
   - Fetches new node details from `workspaceNeuralObservations`
   - Records edges (only if both source AND target nodes exist in nodeMap)

3. **Response formatting** (line 162-201): Maps internal IDs to externalIds, extracts URL from metadata

**Key observations**:
- Graph uses **internal BIGINT IDs** for traversal (efficient joins)
- Edge mapping to external IDs happens at response formatting (line 147-148: `sourceNode.externalId`, `targetNode.externalId`)
- Edges are ONLY included if both nodes are found (line 146: `if (sourceNode && targetNode)`)
- Max depth hard-capped at 3 (line 88)

#### Related Events Logic

**File**: `apps/console/src/lib/v1/related.ts:43-178`

Simpler version — finds direct (depth=1) relationships for an observation. Same `Observation not found` error at line 66. Groups results by source (github, vercel, sentry, linear).

### 4. "Observation Not Found" Error Analysis

#### Error Locations

1. `apps/console/src/lib/v1/graph.ts:77` — `throw new Error('Observation not found: ${input.observationId}')`
2. `apps/console/src/lib/v1/related.ts:66` — Same error message
3. `api/console/src/inngest/workflow/neural/entity-extraction.ts:67` — `throw new NonRetriableError('Observation not found: ${observationId}')` (deprecated workflow, but still registered)

#### Root Cause Analysis

The error occurs when `graphLogic()` or `relatedLogic()` queries:
```typescript
db.query.workspaceNeuralObservations.findFirst({
  where: and(
    eq(workspaceNeuralObservations.workspaceId, auth.workspaceId),
    eq(workspaceNeuralObservations.externalId, input.observationId)
  ),
})
```

This fails when `input.observationId` does not match any `externalId` in the database for that workspace.

#### How the Agent Gets Observation IDs

The AI agent (`apps/console/src/app/(api)/v1/answer/[...v]/route.ts`) has 5 tools:

1. **workspaceSearch** → Returns `V1SearchResult[]` where each result has `id` (the externalId nanoid)
2. **workspaceContents** → Expects `ids: string[]` (externalIds)
3. **workspaceFindSimilar** → Returns similar results with `id` (externalId)
4. **workspaceGraph** → Takes `id` (externalId), calls `graphLogic` with `observationId: input.id`
5. **workspaceRelated** → Takes `id` (externalId), calls `relatedLogic` with `observationId: input.id`

The flow that causes "Observation not found":
1. Agent calls `workspaceSearch` → gets results with valid externalIds
2. Agent calls `workspaceGraph` with one of those IDs → **should work**

**Possible failure scenarios**:

**Scenario A: ID from Pinecone doesn't exist in DB**
- During search, `normalizeVectorIds()` in `four-path-search.ts:82-210` resolves Pinecone vector IDs to observation externalIds
- For Phase 3 vectors (new): `observationId` is read directly from Pinecone metadata (line 96-97, 112)
- For legacy vectors: Falls back to DB lookup by vector ID columns
- If Pinecone has stale metadata (observation was deleted or workspace changed), the ID would not exist

**Scenario B: Race condition in async pipeline**
- Observation capture is async via Inngest with up to 5m timeout
- If test data trigger fires multiple events rapidly, the graph API could be called before all related observations are stored
- However, this would only cause "missing edges" not "root observation not found" — unless the root observation itself hasn't been stored yet

**Scenario C: Backfill/migration data inconsistency**
- The BIGINT migration changed the ID system. If any observations were created before the migration and their externalIds weren't properly populated, lookups would fail
- The `backfill-orchestrator.ts` fires observation capture events which go through the same pipeline

**Scenario D (MOST LIKELY): The agent receives IDs from search results that are valid at search time but the observation is from a different workspace or was deleted**
- The graph logic checks BOTH workspaceId AND externalId
- If the agent's auth context has a different workspaceId than the observation, the lookup fails
- The error message doesn't include workspaceId, making debugging harder

**Scenario E: Test data not fully ingested**
- When running sandbox test data, the trigger sends all events via Inngest
- If the user asks about the graph before all Inngest functions complete, some observations won't exist yet
- Inngest concurrency limit is 10 per workspace — with many events, there's a queue

### 5. DB Schema

#### workspaceNeuralObservations

**File**: `db/console/src/schema/tables/workspace-neural-observations.ts:48-256`
**Table**: `lightfast_workspace_neural_observations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT (auto-identity) | Internal PK |
| `externalId` | VARCHAR(21) UNIQUE | nanoid for API/Pinecone |
| `workspaceId` | VARCHAR(191) FK→orgWorkspaces | Workspace ownership |
| `clusterId` | BIGINT | Cluster FK |
| `occurredAt` | TIMESTAMPTZ | When event occurred |
| `capturedAt` | TIMESTAMPTZ | When observation created |
| `actor` | JSONB | Actor info (name, email, avatar) |
| `actorId` | BIGINT | FK to actor profiles |
| `observationType` | VARCHAR(100) | Event type |
| `title` | TEXT | Short title |
| `content` | TEXT | Full body |
| `topics` | JSONB | String array of topics |
| `significanceScore` | REAL | 0-100 significance |
| `source` | VARCHAR(50) | github/vercel/linear/sentry |
| `sourceType` | VARCHAR(100) | Specific event type |
| `sourceId` | VARCHAR(255) | Dedup key |
| `sourceReferences` | JSONB | ObservationReference[] |
| `metadata` | JSONB | Source-specific metadata |
| `embeddingVectorId` | VARCHAR(191) | Legacy vector ID |
| `embeddingTitleId` | VARCHAR(191) | Title view vector ID |
| `embeddingContentId` | VARCHAR(191) | Content view vector ID |
| `embeddingSummaryId` | VARCHAR(191) | Summary view vector ID |
| `ingestionSource` | VARCHAR(20) | webhook/backfill/manual/api |
| `createdAt` | TIMESTAMPTZ | Record creation time |

**Indexes** (line 210-255):
- `obs_external_id_idx` (unique) on `externalId`
- `obs_workspace_occurred_idx` on `(workspaceId, occurredAt)`
- `obs_cluster_idx` on `clusterId`
- `obs_source_idx` on `(workspaceId, source, sourceType)`
- `obs_source_id_idx` on `(workspaceId, sourceId)`
- `obs_type_idx` on `(workspaceId, observationType)`
- `obs_embedding_title_idx` on `(workspaceId, embeddingTitleId)`
- `obs_embedding_content_idx` on `(workspaceId, embeddingContentId)`
- `obs_embedding_summary_idx` on `(workspaceId, embeddingSummaryId)`

#### workspaceObservationRelationships

**File**: `db/console/src/schema/tables/workspace-observation-relationships.ts:55-164`
**Table**: `lightfast_workspace_observation_relationships`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT (auto-identity) | Internal PK |
| `externalId` | VARCHAR(21) UNIQUE | nanoid for API |
| `workspaceId` | VARCHAR(191) FK→orgWorkspaces | Workspace |
| `sourceObservationId` | BIGINT FK→observations.id | Edge start (CASCADE delete) |
| `targetObservationId` | BIGINT FK→observations.id | Edge end (CASCADE delete) |
| `relationshipType` | VARCHAR(50) | fixes/resolves/triggers/deploys/references/same_commit/same_branch/tracked_in |
| `linkingKey` | VARCHAR(500) | Shared reference (SHA, issue ID) |
| `linkingKeyType` | VARCHAR(50) | commit/issue/branch/pr |
| `confidence` | REAL default 1.0 | Detection confidence |
| `metadata` | JSONB | Detection method, context |
| `createdAt` | TIMESTAMPTZ | Creation time |

**Indexes** (line 132-163):
- `ws_obs_rel_external_id_idx` (unique) on `externalId`
- `ws_obs_rel_source_idx` on `(workspaceId, sourceObservationId)` — forward traversal
- `ws_obs_rel_target_idx` on `(workspaceId, targetObservationId)` — reverse traversal
- `ws_obs_rel_linking_key_idx` on `(workspaceId, linkingKey)`
- `ws_obs_rel_unique_edge_idx` (unique) on `(workspaceId, sourceObservationId, targetObservationId, relationshipType)`

**Foreign keys**: Both `sourceObservationId` and `targetObservationId` have `ON DELETE CASCADE`, so deleting an observation automatically removes its edges.

### 6. Pinecone Integration

#### Configuration

**Single source of truth**: `packages/console-validation/src/constants/embedding.ts`
- Index name: `lightfast-v1`
- Dimension: **1024** (Cohere `embed-english-v3.0`)
- Metric: cosine
- Cloud: AWS
- Region: us-east-1

**Namespace strategy**: Hierarchical — `org_{clerkOrgId}:ws_{workspaceId}`
- Each workspace gets its own namespace within the shared index
- Supports up to 25,000 namespaces per index (Pinecone Standard plan)

#### Vector Storage

**Per observation**: 3 vectors stored (multi-view embeddings)
- `obs_title_{sourceId}` — title-only embedding
- `obs_content_{sourceId}` — content-only embedding
- `obs_summary_{sourceId}` — title + truncated content

**Metadata per vector** (`ObservationVectorMetadata` at observation-capture.ts:63-79):
- `layer`: "observations" (used for filtering)
- `view`: "title" | "content" | "summary"
- `observationType`, `source`, `sourceType`, `sourceId`
- `title`, `snippet`, `occurredAt`, `actorName`
- **`observationId`**: The pre-generated nanoid (externalId) — **this is the Phase 3 optimization** that eliminates DB lookups during search

#### Dimension Mismatch Analysis

The codebase now consistently uses 1024 dimensions:
- `EMBEDDING_MODEL_DEFAULTS.dimension = 1024` (constants/embedding.ts:38)
- `EMBEDDING_CONFIG.cohere.dimension = 1024` (private-config.ts:182)
- `embeddingDim` in workspace settings defaults to 1024

**Risk**: If the Pinecone index was originally created with 1536 dimensions (OpenAI default) and later switched to Cohere (1024), ALL existing vectors would be incompatible. The fix in PR #362 likely addressed this by:
1. Ensuring new workspaces get 1024-dimension indexes
2. Validating embedding dimensions match index dimensions before upsert

There is no runtime dimension validation visible in the `consolePineconeClient.upsertVectors()` path — Pinecone itself rejects dimension mismatches, but the error would surface as a cryptic API error, not a user-friendly message.

#### Query Path

**Four-path search** (`apps/console/src/lib/neural/four-path-search.ts:362-524`):
1. Generate query embedding via Cohere (same 1024 dim)
2. Query Pinecone with `filter: { layer: "observations" }` + optional source/type/actor filters
3. Normalize vector IDs to observation externalIds:
   - Phase 3 path: Read `observationId` from Pinecone metadata (no DB query needed)
   - Legacy path: DB lookup by vector ID columns (embeddingTitleId, etc.)
4. Merge with entity search results
5. Apply reranking (Cohere + optional LLM)

### 7. Entity Extraction

#### Rule-based (Inline in Observation Capture)

**File**: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:129-210`

Runs as Step 5b during observation capture (parallel with embedding + classification).

**Patterns extracted**:
- API endpoints (`GET /v1/graph/...`) → category: `endpoint`
- GitHub issues (`#123`) → category: `project`
- Linear/Jira IDs (`ENG-123`) → category: `project`
- @mentions (`@username`) → category: `engineer`
- Environment variables (`DATABASE_URL`) → category: `config`
- File paths (`src/lib/...`) → category: `definition`
- Git commit hashes → category: `reference`
- Branch references → category: `reference`

Also extracts from structured `sourceReferences` at confidence 0.98 (line 170-210).

Max 50 entities per observation. Deduplication by `category:key`.

#### LLM-based (Fire-and-forget)

**File**: `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts:68-139`

Triggered AFTER observation capture for observations with body > 200 chars.
Uses GPT-5.1-instant (via AI Gateway) to extract semantic entities regex can't catch:
- Service names, engineer names from prose
- Technical definitions, config values

**Important**: This is fire-and-forget — entities from LLM extraction are added AFTER the observation is stored. This means initial search results may not include all entities.

#### Deprecated Standalone Workflow

**File**: `api/console/src/inngest/workflow/neural/entity-extraction.ts`

Marked `@deprecated` — entity extraction was moved inline. This file contains the "Observation not found" error at line 67 which is a `NonRetriableError`. If this workflow is still registered with Inngest (even though the comment says it isn't), it could fire on `observation.captured` events and fail if the observation externalId lookup fails.

### 8. Chat/Agent Streaming Layer

**File**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`

**Architecture**: Uses `@lightfastai/ai-sdk` agent framework with:
- Model: `anthropic/claude-sonnet-4-5-20250929` via AI Gateway
- Memory: Redis-backed ephemeral memory (`AnswerRedisMemory`)
- Max steps: 8 (via `stopWhen: stepCountIs(8)`)
- Streaming: Smooth stream with 10ms delay

**Tool registration** (line 35-41):
```typescript
const answerTools = {
  workspaceSearch: workspaceSearchTool(),
  workspaceContents: workspaceContentsTool(),
  workspaceFindSimilar: workspaceFindSimilarTool(),
  workspaceGraph: workspaceGraphTool(),
  workspaceRelated: workspaceRelatedTool(),
};
```

**Tool handler wiring** (line 147-161):
```typescript
workspaceGraph: {
  handler: async (input) =>
    graphLogic(
      { workspaceId: authData.workspaceId, userId: authData.userId, authType: "session" },
      { observationId: input.id, depth: input.depth ?? 1, requestId: randomUUID() },
    ),
},
```

**Key**: The agent tool `workspaceGraph` takes `input.id` and passes it as `observationId` to `graphLogic`. The `input.id` is described in the Zod schema (`workspace-graph.ts:11`) as "The observation ID to traverse from".

**System prompt** (`apps/console/src/ai/prompts/system-prompt.ts`) instructs the agent:
- "Use workspaceGraph and workspaceRelated to trace cross-source connections"
- "When answering, cite the specific observations you found (include their IDs and URLs)"
- "Use workspaceSearch first for broad questions, then workspaceContents to get full details"

**Error handling**: Graph/related errors bubble up as tool execution errors. The route handler catches at line 66-81 and returns `{ error: "INTERNAL_ERROR", message: error.message }` with status 500. This means "Observation not found" becomes a 500 error rather than a 404.

### 9. Existing Research

**File**: `thoughts/shared/research/2026-02-05-accelerator-demo-relationship-graph-analysis.md`

Key findings from prior research (Feb 5, 2026):
- Identified that relationship graph needed to be **explicit** not implicit
- Proposed `observation_relationships` table (now implemented)
- Documented 8 relationship types (all now in code)
- Identified missing Sentry `statusDetails.inCommit` and Linear `attachments` fields
- Decision: Build true graph first, timeline becomes a projection

## Code References

### Core Pipeline
- `api/console/src/inngest/workflow/neural/observation-capture.ts:336-1185` — Main observation capture workflow
- `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-285` — Relationship detection and creation
- `api/console/src/inngest/workflow/neural/scoring.ts:78-118` — Significance scoring (threshold=40)
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:129-210` — Regex entity extraction
- `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts:68-139` — LLM entity extraction
- `api/console/src/inngest/workflow/neural/cluster-assignment.ts:48-50` — Cluster assignment logic
- `api/console/src/inngest/workflow/neural/classification.ts` — LLM observation classification

### Graph/Related API
- `apps/console/src/app/(api)/v1/graph/[id]/route.ts:24-81` — Graph route handler
- `apps/console/src/lib/v1/graph.ts:51-201` — Graph BFS logic (**ERROR at line 77**)
- `apps/console/src/lib/v1/related.ts:43-178` — Related events logic (**ERROR at line 66**)
- `packages/console-types/src/api/v1/graph.ts` — Zod schemas for graph/related responses

### Agent/Chat Layer
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:43-217` — Answer API with tool handlers
- `packages/console-ai/src/workspace-graph.ts:30-50` — Graph tool definition
- `packages/console-ai/src/workspace-related.ts:23-43` — Related tool definition
- `packages/console-ai-types/src/index.ts:34-38` — GraphToolInput type
- `apps/console/src/ai/prompts/system-prompt.ts` — System prompt with tool instructions

### Search Pipeline
- `apps/console/src/lib/neural/four-path-search.ts:362-524` — 4-path parallel search
- `apps/console/src/lib/neural/four-path-search.ts:82-210` — Vector ID normalization
- `apps/console/src/lib/v1/search.ts:28-192` — Search logic with reranking

### Database Schema
- `db/console/src/schema/tables/workspace-neural-observations.ts:48-256` — Observations table
- `db/console/src/schema/tables/workspace-observation-relationships.ts:55-164` — Relationships table

### Pinecone Integration
- `packages/console-pinecone/src/client.ts:19-161` — Console Pinecone client wrapper
- `packages/console-validation/src/constants/embedding.ts` — Embedding config defaults (1024 dim)
- `packages/console-config/src/private-config.ts:43-133` — Pinecone infrastructure config

### Webhook Handlers (Entry Points)
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` — GitHub webhooks
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` — Vercel webhooks
- `packages/console-test-data/src/trigger/trigger.ts:57` — Test data trigger

## Integration Points

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     COMPLETE DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  GitHub/Vercel/Linear/Sentry Webhooks                                   │
│         ↓                                                                │
│  Webhook Route Handler (verify + transform)                              │
│         ↓                                                                │
│  inngest.send("neural/observation.capture")                             │
│         ↓                                                                │
│  ┌─── Observation Capture Workflow ────────────────────────────────┐    │
│  │  1. Check duplicate (sourceId)                                   │    │
│  │  2. Check event allowed (integration config)                     │    │
│  │  3. Score significance (≥40 passes)                              │    │
│  │  4. Fetch workspace config                                       │    │
│  │  5. PARALLEL:                                                    │    │
│  │     ├─ LLM Classification (Haiku)                                │    │
│  │     ├─ Multi-view Embedding (Cohere 1024d)                       │    │
│  │     ├─ Entity Extraction (regex)                                 │    │
│  │     └─ Actor Resolution                                          │    │
│  │  6. Cluster Assignment                                           │    │
│  │  7. Pinecone Upsert (3 vectors per obs)                          │    │
│  │  8. DB Insert (observation + entities, transactional)            │    │
│  │  9. Relationship Detection (commit/branch/issue/PR matching)     │    │
│  │  10. Emit completion events                                      │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│         ↓                                                                │
│  Downstream Inngest Workflows:                                          │
│  ├─ Profile Update                                                      │
│  ├─ Cluster Summary Check                                               │
│  └─ LLM Entity Extraction (for body > 200 chars)                       │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════     │
│                                                                          │
│  User Chat → Answer Agent (Claude Sonnet 4.5)                           │
│         ↓                                                                │
│  Tool: workspaceSearch → four-path search → Pinecone + DB              │
│         ↓                                                                │
│  Returns observation IDs (externalId / nanoid)                          │
│         ↓                                                                │
│  Tool: workspaceGraph(id) → graphLogic(observationId=id)               │
│         ↓                                                                │
│  DB lookup by externalId + workspaceId                                  │
│         ↓                                                                │
│  BFS traversal via workspaceObservationRelationships                    │
│         ↓                                                                │
│  Return nodes + edges (externalIds)                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Gaps Identified

### 1. Error Response Code Mismatch
The graph API returns "Observation not found" as a **500 Internal Server Error** instead of **404 Not Found**. The `graphLogic` function throws a generic `Error` which is caught by the route handler and wrapped in `{ error: "INTERNAL_ERROR" }`. This makes it harder for the agent to understand and retry correctly.

**Fix needed**: Return 404 with `{ error: "NOT_FOUND", message: "..." }` instead of 500.

### 2. No Observation Existence Validation in Agent Tools
The agent tools (`workspaceGraph`, `workspaceRelated`) don't validate that the observation ID exists before making the API call. If the agent hallucinates an ID or uses a stale one, the error is unhelpful.

### 3. Missing Relationship Types in Graph Response
The graph response doesn't include `linkingKeyType` — only `linkingKey` and `type`. This makes it harder for the agent to understand WHY two observations are connected (e.g., "connected via commit SHA abc123" vs just "same_commit").

### 4. No Graph API for Entity-based Traversal
The prior research (Feb 5) proposed `GET /v1/graph/entity/{key}` to find all observations connected to a specific entity (commit SHA, issue ID). This doesn't exist yet. The agent can only traverse from a known observation ID.

### 5. Deprecated Entity Extraction Still Fires
`entity-extraction.ts` is marked `@deprecated` but still listens on `apps-console/neural/observation.captured` events. If still registered with Inngest, it would fire AFTER observation capture and could fail with "Observation not found" if the externalId lookup has timing issues.

### 6. Legacy Pinecone Vectors Missing observationId
Old vectors stored before the Phase 3 optimization don't have `observationId` in their metadata. The `normalizeVectorIds` function handles this with a DB fallback, but it's slower and could fail if the observation was deleted.

## Race Condition Analysis

### Race 1: Graph Query Before Observation Capture Completes
**Severity**: Medium
**Scenario**: User triggers sandbox data → immediately asks agent to show relationships → agent searches and finds some observations (those already processed) → tries graph on an ID that's still in the Inngest queue
**Why it happens**: Inngest observation capture takes up to 5 minutes with 10 concurrency per workspace. With 50+ events, there's a significant queue.
**Mitigation**: The search would only return observations that exist in both Pinecone AND the DB, so if the observation is in the search results, it should be in the DB. However, its RELATIONSHIPS might not be created yet if the target observation hasn't been processed.

### Race 2: Relationship Detection Ordering
**Severity**: Low
**Scenario**: Observation A references commit SHA X. Observation B (from different source) also references commit SHA X. If A is processed before B, relationship detection for A finds no matches. When B is processed, it creates the A↔B relationship. But A's relationships are never retroactively updated.
**Mitigation**: This is by design — relationships are created when the NEWER observation arrives and matches against existing ones. For the demo scenario (sandbox data), ingestion order matters.

### Race 3: Pinecone Eventual Consistency
**Severity**: Low
**Scenario**: Vector is upserted to Pinecone (Step 6 in capture), then the search API queries Pinecone before the vector is queryable (eventual consistency window).
**Mitigation**: Pinecone serverless has near-real-time indexing. Typical delay is <1 second.

### Race 4: LLM Entity Extraction vs Immediate Search
**Severity**: Low
**Scenario**: LLM entity extraction fires AFTER observation capture completes. If a user searches immediately, entity-based search results may be incomplete.
**Mitigation**: Rule-based entities are stored inline during capture. LLM entities are supplementary.

### Race 5 (CRITICAL): Observation Capture Fails Silently
**Severity**: High
**Scenario**: Observation capture workflow fails at any step (embedding error, DB error, etc.) but the `onFailure` handler only logs and marks the job as failed. The observation may be partially stored (in Pinecone but not DB, or vice versa).
**Specific risk**: If Pinecone upsert succeeds (Step 6) but DB insert fails (Step 7), the vector exists with a valid `observationId` in metadata, but no DB record exists. Search returns the ID, graph lookup fails with "Observation not found".
**Mitigation**: Inngest retries (3 attempts) help, but a persistent failure leaves orphaned Pinecone vectors.

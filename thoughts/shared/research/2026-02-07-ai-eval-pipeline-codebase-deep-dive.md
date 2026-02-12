---
date: 2026-02-07
researcher: codebase-agent
topic: "AI evaluation pipeline — codebase analysis"
tags: [research, codebase, ai-pipeline, evaluation, search, answer]
status: complete
---

# Codebase Deep Dive: AI Evaluation Pipeline

## Research Question
How should Lightfast design an AI evaluation pipeline that enables iterative, measurable improvement of its AI systems — from dataset creation through eval execution to production deployment confidence?

## Summary

Lightfast has a sophisticated, production-grade AI pipeline with **four public API routes** (`/v1/search`, `/v1/contents`, `/v1/similar`, `/v1/answer`), a **four-path parallel retrieval system** (vector + entity + cluster + actor), a **three-tier reranking system** (passthrough/Cohere/LLM), and a **multi-step answer agent** powered by Claude Sonnet 4.5 via the custom `@lightfastai/ai-sdk`. The ingestion pipeline processes webhook events through Inngest workflows with significance scoring, LLM classification (Claude Haiku), multi-view embeddings (Cohere embed-english-v3.0), entity extraction, cluster assignment, and relationship detection.

**For evaluation, the codebase has a planned-but-not-yet-implemented `packages/console-eval/` package** with a detailed implementation plan (in `thoughts/shared/plans/2026-02-05-search-api-evaluation-pipeline.md`). The plan defines Braintrust integration, retrieval metrics (MRR, NDCG@K, Recall@K, Precision@K), end-to-end evaluation against the real API, and ground truth mapping from sourceIds to externalIds. However, **no evaluation code has been written yet** — the plan exists only as a specification.

Existing infrastructure that supports evaluation includes: (1) **Braintrust middleware** already integrated in neural workflows for AI tracing, (2) **structured activity logging** recording every search query with latency, result count, and mode, (3) **operations metrics** tracking observation capture, entity extraction, and cluster assignment, and (4) **test data injection** via `@repo/console-test-data` with CLI tools and dataset files. The primary gaps are: no golden dataset, no automated eval runner, no answer quality evaluation, no A/B testing framework, and no feedback collection from users.

## Detailed Findings

### 1. API Endpoints (Search, Answer, Contents, Similar)

#### `/v1/search` — Semantic Search
- **Route**: `apps/console/src/app/(api)/v1/search/route.ts:34` (POST handler)
- **Logic**: `apps/console/src/lib/v1/search.ts:28` (`searchLogic()`)
- **Auth**: Dual auth via `withDualAuth()` — API key (Bearer token + X-Workspace-ID header) or Clerk session
- **Request schema**: `packages/console-types/src/api/v1/search.ts:42` (`V1SearchRequestSchema`)
  - `query` (string, required)
  - `limit` (1-100, default 10)
  - `offset` (default 0)
  - `mode` ("fast" | "balanced" | "thorough", default "balanced")
  - `filters` (sourceTypes, observationTypes, actorNames, dateRange)
  - `includeContext` (boolean, default true)
  - `includeHighlights` (boolean, default true)
- **Response**: Results with score, source, type, entities, references, highlights; context (clusters, actors); meta (total, took, mode, paths); latency breakdown (total, auth, parse, search, embedding, retrieval, entitySearch, clusterSearch, actorSearch, rerank, enrich, maxParallel)
- **Pipeline**: 4-path parallel search → rerank → paginate → enrich → build response

#### `/v1/answer` — AI-Generated Answers with Citations
- **Route**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:43` (POST + GET)
- **Model**: `anthropic/claude-sonnet-4-5-20250929` via `@ai-sdk/gateway`
- **Agent**: Created via `@lightfastai/ai-sdk/agent` `createAgent()` with 5 tools:
  - `workspaceSearch` — calls `searchLogic()` directly
  - `workspaceContents` — calls `contentsLogic()` directly
  - `workspaceFindSimilar` — calls `findsimilarLogic()` directly
  - `workspaceGraph` — calls `graphLogic()` directly
  - `workspaceRelated` — calls `relatedLogic()` directly
- **Memory**: `AnswerRedisMemory` (Upstash Redis, 1-hour TTL, ephemeral sessions)
- **System prompt**: `apps/console/src/ai/prompts/system-prompt.ts:1` — instructs agent to use tools, cite observations, format with markdown
- **Stop condition**: `stepCountIs(8)` — maximum 8 tool call steps
- **Streaming**: `smoothStream({ delayInMs: 10 })` for smooth UI rendering
- **Session management**: URL path encodes agentId + sessionId (`/v1/answer/{agentId}/{sessionId}`)

#### `/v1/contents` — Full Document Fetch
- **Route**: `apps/console/src/app/(api)/v1/contents/route.ts`
- **Logic**: `apps/console/src/lib/v1/contents.ts`
- **Input**: Array of observation IDs
- **Returns**: Full document metadata (path, title, description, committedAt)

#### `/v1/findsimilar` — Semantic Similarity
- **Route**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`
- **Logic**: `apps/console/src/lib/v1/findsimilar.ts:274`
- **Input**: Source ID (or URL), limit, threshold, filters
- **Pipeline**: Fetch source content → generate embedding → Pinecone query → normalize vector IDs → filter → enrich
- **Features**: Same-source filtering, cluster affinity detection, entity overlap

#### `/v1/graph/{id}` — Relationship Graph Traversal
- **Route**: `apps/console/src/app/(api)/v1/graph/[id]/route.ts`
- **Logic**: `apps/console/src/lib/v1/graph.ts`
- **Traversal**: 1-3 hops through observation relationships

#### `/v1/related/{id}` — Related Events
- **Route**: `apps/console/src/app/(api)/v1/related/[id]/route.ts`
- **Logic**: `apps/console/src/lib/v1/related.ts`
- **Returns**: Directly linked observations

### 2. Retrieval Pipeline

#### Four-Path Parallel Search
- **Implementation**: `apps/console/src/lib/neural/four-path-search.ts:362` (`fourPathParallelSearch()`)
- **Architecture**: All 4 paths execute in parallel via `Promise.all()`:

**Path 1 — Vector Similarity (always executed)**
- Generates query embedding via `createEmbeddingProviderForWorkspace()` (Cohere embed-english-v3.0, 1024 dim)
- Queries Pinecone with metadata filters (`layer: "observations"`, optional source/type/actor/date)
- Returns scored matches with metadata

**Path 2 — Entity Search (always executed)**
- `apps/console/src/lib/neural/entity-search.ts` (`searchByEntities()`)
- Pattern-matching against extracted entities in database
- Returns observation IDs with confidence scores

**Path 3 — Cluster Context (conditional)**
- `apps/console/src/lib/neural/cluster-search.ts` (`searchClusters()`)
- Searches cluster centroids in Pinecone for topic context
- Skipped if `workspace.hasClusters === false`

**Path 4 — Actor Profiles (conditional)**
- `apps/console/src/lib/neural/actor-search.ts` (`searchActorProfiles()`)
- Text matching against actor display names and expertise domains
- Skipped if `workspace.hasActors === false`

#### Vector ID Normalization
- **Implementation**: `four-path-search.ts:82` (`normalizeVectorIds()`)
- **Problem**: Pinecone stores view-specific vector IDs (`obs_title_...`, `obs_content_...`, `obs_summary_...`) but API returns nanoid observation IDs
- **Phase 3 optimization**: New observations store `observationId` in Pinecone metadata for direct lookup
- **Phase 2 fallback**: Legacy observations require database lookup to map vector IDs → observation IDs
- **Multi-view aggregation**: Takes MAX score across all matching views per observation

#### Result Merging
- `mergeSearchResults()` at `four-path-search.ts:313`
- Vector results + entity results → deduplicated candidates
- Entity confirmation boosts vector score by +0.2
- Entity-only matches get 0.85 × confidence as base score

### 3. Reranking System

#### Package: `@repo/console-rerank`
- **Types**: `packages/console-rerank/src/types.ts`
- **Factory**: `packages/console-rerank/src/factory.ts:35` (`createRerankProvider()`)
- **Three modes**:

**Fast (Passthrough)**: `packages/console-rerank/src/providers/passthrough.ts`
- No reranking — returns vector scores as-is
- ~0ms latency

**Balanced (Cohere)**: `packages/console-rerank/src/providers/cohere.ts:52`
- Model: `rerank-v3.5`
- Threshold: 0.4 default
- Concatenates `title: content` for scoring
- Score = Cohere relevance score (replaces vector score)
- Minimum results guarantee (fallback if threshold filters too aggressively)
- ~100-200ms latency

**Thorough (LLM)**: `packages/console-rerank/src/providers/llm.ts:97`
- Model: `anthropic/claude-haiku-4.5` via `@ai-sdk/gateway`
- Uses `generateObject()` with structured schema for relevance scoring
- Weighted combination: `0.6 × LLM_relevance + 0.4 × vector_score`
- Bypass for ≤5 candidates
- Temperature: 0.1 for consistency
- ~600ms latency

#### Usage in Search Logic
- `apps/console/src/lib/v1/search.ts:49`: `createRerankProvider(input.mode)`
- Over-fetches by 2x for reranking (`topK: input.limit * 2`)
- Balanced mode guarantees minimum results: `Math.max(3, Math.ceil(input.limit / 2))`

### 4. Answer Generation

#### Agent Architecture
- **SDK**: `core/ai-sdk/src/core/primitives/agent.ts` — custom agent framework
- **Pattern**: Creates agent per request with runtime context injection
- **Tools are handler-injected**: Tool definitions in `@repo/console-ai`, handlers wired in route
- **Memory**: Ephemeral Redis (1-hour TTL) — no persistent conversation history
- **Model**: Claude Sonnet 4.5 (via Vercel AI Gateway)
- **Max steps**: 8 tool calls per conversation turn

#### Tool Handlers
Each tool in the answer agent calls the V1 logic functions directly:
- `workspaceSearch` → `searchLogic()` (4-path search + rerank)
- `workspaceContents` → `contentsLogic()` (full document fetch)
- `workspaceFindSimilar` → `findsimilarLogic()` (vector similarity)
- `workspaceGraph` → `graphLogic()` (relationship traversal)
- `workspaceRelated` → `relatedLogic()` (direct links)

#### System Prompt
- Location: `apps/console/src/ai/prompts/system-prompt.ts`
- Currently hardcoded workspace context (Lightfast project description)
- Instructions: use tools, cite observations with IDs and URLs, use markdown
- **No evaluation hooks** in the prompt or response pipeline

### 5. Memory System (Chunks, Observations, Summaries, Profiles)

#### Observations — Core Memory Unit
- **Schema**: `db/console/src/schema/tables/workspace-neural-observations.ts:48`
- **Fields**: id (BIGINT auto-gen), externalId (nanoid), workspaceId, clusterId, occurredAt, actor (JSONB), observationType, title, content, topics (JSONB string[]), significanceScore (real), source, sourceType, sourceId, sourceReferences (JSONB), metadata (JSONB), embeddingVectorId (legacy), embeddingTitleId, embeddingContentId, embeddingSummaryId
- **Indexes**: externalId (unique), workspace+occurredAt, cluster, source+type, sourceId (dedup), type, embedding lookups

#### Entities — Extracted Structured Data
- **Schema**: `db/console/src/schema/tables/workspace-neural-entities.ts:26`
- **Fields**: id (BIGINT), externalId, workspaceId, category (EntityCategory enum), key (canonical like "@sarah", "#123"), value, aliases (JSONB), sourceObservationId (FK), evidenceSnippet, confidence, occurrenceCount
- **Deduplication**: Unique on (workspaceId, category, key) with occurrence counting

#### Clusters — Topic Groups
- **Schema**: `db/console/src/schema/tables/workspace-observation-clusters.ts:19`
- **Fields**: id (BIGINT), externalId, workspaceId, topicLabel, topicEmbeddingId (Pinecone centroid), keywords, primaryEntities, primaryActors, status (open/closed), summary (LLM-generated), observationCount, first/lastObservationAt
- **Assignment**: `api/console/src/inngest/workflow/neural/cluster-assignment.ts`

#### Actor Profiles — Contributor Tracking
- **Schema**: `db/console/src/schema/tables/workspace-actor-profiles.ts:61`
- **Fields**: id (BIGINT), externalId, workspaceId, actorId (`github:12345678`), displayName, email, observationCount, lastActiveAt, profileConfidence
- **Identity mapping**: Separate `orgActorIdentities` table for org-level identity (username, avatar, Clerk linking)

#### Relationships — Graph Edges
- **Schema**: `db/console/src/schema/tables/workspace-observation-relationships.ts:55`
- **Types**: fixes, resolves, triggers, deploys, references, same_commit, same_branch, tracked_in
- **Detection**: `api/console/src/inngest/workflow/neural/relationship-detection.ts`
- **Linking keys**: commit SHAs, issue IDs, branch names

#### Knowledge Documents (Legacy/Docs Ingestion)
- **Schema**: `db/console/src/schema/tables/workspace-knowledge-documents.ts`
- **Used by**: Contents API, find-similar

### 6. Embedding Pipeline & Models

#### Embedding Model
- **Provider**: Cohere
- **Model**: `embed-english-v3.0`
- **Dimension**: 1024
- **Config**: `packages/console-config/src/private-config.ts:145` (EMBEDDING_CONFIG)
- **Batch size**: 96 (Cohere API limit)

#### Multi-View Embedding
- Generated during observation capture (`observation-capture.ts:712-754`)
- **Three views per observation**:
  1. **Title** (`obs_title_...`): `sourceEvent.title`
  2. **Content** (`obs_content_...`): `sourceEvent.body`
  3. **Summary** (`obs_summary_...`): `title + body[:1000]`
- All 3 embeddings generated in single batch call
- Each view stored as separate Pinecone vector with view-specific metadata
- Query-time: uses `inputType: "search_query"` for asymmetric retrieval

#### Workspace-Bound Model Locking
- `packages/console-embed/src/utils.ts:150` (`createEmbeddingProviderForWorkspace()`)
- Enforces consistent model across indexing and retrieval
- Prevents accidental model switching that would corrupt search

#### Vector Storage
- **Pinecone** with shared index architecture (single `lightfast-v1` index)
- Namespaced per workspace: `org_{clerkOrgId}:ws_{workspaceId}`
- Metadata filter: `layer: "observations"` + source/type/actor/date
- Environment isolation via separate Pinecone projects (different API keys)

### 7. Inngest Workflows

#### Observation Capture Pipeline
- **Function**: `api/console/src/inngest/workflow/neural/observation-capture.ts:336`
- **Event**: `apps-console/neural/observation.capture`
- **Concurrency**: 10 per workspace
- **Steps**:
  1. Resolve clerkOrgId
  2. Create job record
  3. Check duplicate (idempotent by sourceId)
  4. Check event allowed (source config)
  5. Evaluate significance (gate: score < 40 → skip)
  6. Fetch workspace context
  7. PARALLEL: Classification (Claude Haiku) + Multi-view embeddings + Entity extraction + Actor resolution
  8. Assign to cluster
  9. Upsert 3 vectors to Pinecone
  10. Store observation + entities (transactional)
  11. Detect relationships
  12. Reconcile cross-source actors (GitHub → Vercel)
  13. Emit downstream events (profile update, cluster summary, LLM entity extraction)
  14. Complete job with metrics

#### Downstream Workflows
- **Profile Update**: `api/console/src/inngest/workflow/neural/profile-update.ts` — updates actor profile stats
- **Cluster Summary**: `api/console/src/inngest/workflow/neural/cluster-summary.ts` — LLM-generated cluster summaries
- **LLM Entity Extraction**: `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts` — deeper entity extraction for rich content (>200 chars)

#### Activity Recording
- **Function**: `api/console/src/inngest/workflow/infrastructure/record-activity.ts`
- **Event**: `apps-console/activity.record`
- Batch inserts to `workspaceUserActivities` table

#### Processing Workflows
- `processing/process-documents.ts` — document ingestion pipeline
- `processing/files-batch-processor.ts` — batch file processing
- `processing/delete-documents.ts` — document cleanup
- `sources/github-sync-orchestrator.ts` — GitHub repository sync
- `providers/github/push-handler.ts` — GitHub push webhook processing

### 8. Existing Quality/Eval Code

#### What EXISTS

**Braintrust Integration** (tracing/observability, NOT evaluation)
- `core/ai-sdk/src/core/v2/braintrust-env.ts` — environment config for Braintrust
- `api/console/src/inngest/workflow/neural/ai-helpers.ts:16` — `createTracedModel()` wraps AI models with `BraintrustMiddleware` for tracing
- `buildNeuralTelemetry()` — adds workflow context to AI calls
- Used in: classification step of observation capture

**Significance Scoring** (quality gate, NOT evaluation)
- `api/console/src/inngest/workflow/neural/scoring.ts:78` (`scoreSignificance()`)
- Rule-based scoring (0-100) with content signals
- Threshold: 40 (configurable per TODO)
- Factors: event type weight, keyword patterns, reference density, content substance

**Classification** (LLM quality, NOT evaluation)
- `api/console/src/inngest/workflow/neural/classification.ts`
- Claude Haiku classification with regex fallback
- Confidence tracked but not evaluated

#### What is PLANNED but NOT implemented
- `packages/console-eval/` — detailed plan in `thoughts/shared/plans/2026-02-05-search-api-evaluation-pipeline.md`
- Retrieval metrics: MRR, NDCG@K, Recall@K, Precision@K
- End-to-end evaluation runner
- Braintrust scorers
- Ground truth builder
- Test workspace setup CLI
- **None of this code has been created yet** — only the plan document exists

#### What DOES NOT EXIST
- No golden dataset
- No answer quality evaluation (faithfulness, citation accuracy, hallucination detection)
- No A/B testing framework
- No regression testing for AI components
- No per-workspace quality calibration (mentioned in SPEC but not implemented)
- No feedback loop from user interactions
- No automated eval CI/CD
- No component-level evals (embedding quality, classification accuracy, entity extraction precision)

### 9. Data Logging & Feedback

#### Activity Logging (Search Queries)
- **Location**: `apps/console/src/lib/v1/search.ts:164` — `recordSystemActivity()` fires after every search
- **Recorded data**: query (first 200 chars), limit, offset, mode, hasFilters, resultCount, totalMatches, latencyMs, authType, apiKeyId
- **Storage**: `workspaceUserActivities` table (via Inngest batch insert)
- **Tier**: Fire-and-forget (~1% data loss acceptable)
- Similar logging for: `findsimilar`, `contents`, `graph`, `related`

#### Operations Metrics (System Health)
- **Schema**: `db/console/src/schema/tables/workspace-operations-metrics.ts:46`
- **Metric types**: job_duration, documents_indexed, errors, observation_captured, observation_filtered, observation_below_threshold, observation_duplicate, entities_extracted, cluster_assigned, cluster_affinity, profile_updated, actor_resolution
- **Tags**: source, sourceType, observationType, significanceScore, durationMs, etc.
- **Usage**: `recordJobMetric()` called throughout observation capture workflow

#### What's NOT Logged
- No click-through data (which results users click)
- No thumbs up/down feedback on answers
- No answer quality signals (was the answer helpful?)
- No query reformulation tracking (did user rephrase?)
- No search result ranking changes (before vs after rerank)
- No embedding similarity scores for analysis
- No latency percentile tracking (p50, p95, p99)

### 10. Configuration & Versioning

#### Model Configuration
- **Embedding**: `@repo/console-config/private-config.ts:145` — hardcoded Cohere embed-english-v3.0, 1024 dim
- **Rerank**: `@repo/console-config/private-config.ts:211` — Cohere rerank-v3.5, LLM claude-haiku-4.5
- **Classification**: `@repo/console-config/neural.ts:42` — claude-3-5-haiku-latest
- **Answer agent**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:32` — `anthropic/claude-sonnet-4-5-20250929`
- **LLM entity extraction**: `@repo/console-config/neural.ts:16` — config for extraction parameters

#### Workspace-Level Configuration
- **Schema**: `orgWorkspaces.settings` (version: 1)
  - `embedding.indexName`
  - `embedding.namespaceName`
  - `embedding.embeddingModel`
  - `embedding.embeddingDim`
- **Cache**: `@repo/console-workspace-cache` — caches indexName, namespaceName, embeddingModel, embeddingDim, hasClusters, hasActors

#### What's NOT Configurable
- No per-workspace rerank mode selection
- No per-workspace significance threshold
- No feature flags for AI components
- No model version pinning per workspace
- No A/B test assignment
- No retrieval weight configuration (vector vs entity vs cluster vs actor)

## Code References

### Core Pipeline Files
- `apps/console/src/app/(api)/v1/search/route.ts` — Search API route handler
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts` — Answer agent API route
- `apps/console/src/lib/v1/search.ts` — Search logic (4-path + rerank + enrich)
- `apps/console/src/lib/neural/four-path-search.ts` — Four-path parallel retrieval
- `packages/console-rerank/src/` — Reranking providers (passthrough, Cohere, LLM)
- `packages/console-embed/src/utils.ts` — Embedding provider factory
- `packages/console-ai/src/` — Answer agent tool definitions
- `packages/console-ai-types/src/index.ts` — Tool type definitions
- `core/ai-sdk/src/core/primitives/agent.ts` — Agent framework

### Ingestion Pipeline Files
- `api/console/src/inngest/workflow/neural/observation-capture.ts` — Main write path
- `api/console/src/inngest/workflow/neural/scoring.ts` — Significance scoring
- `api/console/src/inngest/workflow/neural/classification.ts` — LLM classification
- `api/console/src/inngest/workflow/neural/entity-extraction.ts` — Regex entity extraction
- `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts` — LLM entity extraction
- `api/console/src/inngest/workflow/neural/cluster-assignment.ts` — Cluster assignment
- `api/console/src/inngest/workflow/neural/actor-resolution.ts` — Actor ID resolution
- `api/console/src/inngest/workflow/neural/relationship-detection.ts` — Graph edge creation
- `api/console/src/inngest/workflow/neural/ai-helpers.ts` — Braintrust tracing integration

### Database Schema Files
- `db/console/src/schema/tables/workspace-neural-observations.ts` — Observations
- `db/console/src/schema/tables/workspace-neural-entities.ts` — Entities
- `db/console/src/schema/tables/workspace-observation-clusters.ts` — Clusters
- `db/console/src/schema/tables/workspace-actor-profiles.ts` — Actor profiles
- `db/console/src/schema/tables/workspace-observation-relationships.ts` — Relationships
- `db/console/src/schema/tables/workspace-user-activities.ts` — Activity log
- `db/console/src/schema/tables/workspace-operations-metrics.ts` — Ops metrics

### Configuration Files
- `packages/console-config/src/private-config.ts` — Infrastructure defaults
- `packages/console-config/src/neural.ts` — Neural memory config
- `packages/console-workspace-cache/src/types.ts` — Cached workspace config

### Existing Eval Planning
- `thoughts/shared/plans/2026-02-05-search-api-evaluation-pipeline.md` — Detailed plan (NOT implemented)
- `thoughts/shared/research/2026-02-05-search-api-evaluation-pipeline-golden-dataset-design.md` — Dataset design research

## Integration Points

### How Components Connect

```
Webhook (GitHub/Vercel/Linear/Sentry)
    │
    ▼
Inngest Event: apps-console/neural/observation.capture
    │
    ├── Significance Gate (scoring.ts) ──── [below 40] → Skip
    │
    ├── Classification (Claude Haiku via ai-helpers.ts + Braintrust tracing)
    ├── Multi-View Embeddings (Cohere via console-embed)
    ├── Entity Extraction (regex + LLM)
    ├── Actor Resolution (GitHub ID mapping)
    │
    ▼
Storage: PlanetScale (observations, entities) + Pinecone (3 vectors per obs)
    │
    ▼
POST /v1/search (route.ts → searchLogic → fourPathParallelSearch)
    │
    ├── Path 1: Pinecone vector query (embedding → query)
    ├── Path 2: Entity pattern matching (DB)
    ├── Path 3: Cluster centroid search (Pinecone, conditional)
    ├── Path 4: Actor profile search (DB, conditional)
    │
    ▼
Merge & Deduplicate (normalizeVectorIds → mergeSearchResults)
    │
    ▼
Rerank (console-rerank: fast/balanced/thorough)
    │
    ▼
Enrich (DB: observation metadata + entities)
    │
    ▼
Response (V1SearchResponse with latency breakdown)
    │
    ▼
Activity Log (fire-and-forget via Inngest)
```

```
POST /v1/answer (route.ts → createAgent → fetchRequestHandler)
    │
    ▼
Claude Sonnet 4.5 (via Vercel AI Gateway)
    │
    ├── Tool: workspaceSearch → searchLogic() [full 4-path pipeline]
    ├── Tool: workspaceContents → contentsLogic()
    ├── Tool: workspaceFindSimilar → findsimilarLogic()
    ├── Tool: workspaceGraph → graphLogic()
    ├── Tool: workspaceRelated → relatedLogic()
    │
    ▼
Streaming Response (smoothStream, max 8 steps)
    │
    ▼
Redis Session Memory (1-hour TTL)
```

## Gaps Identified

### Critical Gaps (Blocking Evaluation Pipeline)

1. **No Golden Dataset**: The planned `comprehensive.json` (35 webhooks) exists in test-data but no ground truth queries/expected results have been built
2. **No Eval Package**: `packages/console-eval/` does not exist — only the plan document
3. **No Answer Evaluation**: Zero infrastructure for measuring answer quality (faithfulness, citation accuracy, hallucination rate)
4. **No Feedback Collection**: No UI or API for users to rate search results or answers

### Important Gaps (Limiting Iterative Improvement)

5. **No Component-Level Evals**: Cannot measure individual component quality (embedding relevance, entity extraction precision, classification accuracy, rerank lift)
6. **No A/B Testing**: No framework for comparing configurations (rerank modes, model versions, retrieval weights)
7. **No Regression Testing**: No automated checks that changes don't degrade quality
8. **No Per-Workspace Calibration**: SPEC mentions "per-workspace calibration: weights, thresholds, decay factors" but nothing implemented
9. **No Query Analysis Logging**: Don't capture which views (title/content/summary) contributed to results, rerank score deltas, or search path effectiveness

### Infrastructure Gaps

10. **No Eval CI/CD**: No GitHub Actions or automated pipeline for running evals on PRs
11. **No Metric Dashboards**: Operations metrics exist in DB but no visualization
12. **No Latency Monitoring**: Latency breakdown returned in API but not tracked over time
13. **No Model Version Tracking**: Model IDs are hardcoded strings, no versioning strategy
14. **Braintrust Underutilized**: Only used for tracing neural workflows, not for evaluation experiments

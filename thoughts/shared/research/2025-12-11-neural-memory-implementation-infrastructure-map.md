---
date: 2025-12-11T20:26:16+08:00
researcher: Claude Code
git_commit: 8e390130
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Implementation Infrastructure Map"
tags: [research, neural-memory, implementation, infrastructure, observations, retrieval]
status: complete
last_updated: 2025-12-11
last_updated_by: Claude Code
---

# Research: Neural Memory Implementation Infrastructure Map

**Date**: 2025-12-11T20:26:16+08:00
**Researcher**: Claude Code
**Git Commit**: 8e390130
**Branch**: feat/memory-layer-foundation

## Research Question

Document everything needed for a 5-day neural memory implementation, mapping existing infrastructure against the E2E design spec at `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`.

## Summary

The neural memory infrastructure is **partially implemented**. The observation capture pipeline is fully functional with 7 working steps (idempotency, filtering, embedding, Pinecone upsert, database storage). However, key components from the E2E design are **not yet implemented**: significance scoring, classification, actor resolution, entity extraction, cluster assignment, and 2-key retrieval (LLM gating).

### Implementation Status Overview

| Component | Status | Details |
|-----------|--------|---------|
| Observation Pipeline | ✅ Complete | 7 steps, all functional |
| Embedding Generation | ✅ Complete | Cohere embed-english-v3.0, 1024 dims |
| Webhook Transformers | ✅ Complete | GitHub (5 events) + Vercel (deployment) |
| Database Schema | ✅ Complete | Observations + Clusters tables |
| Pinecone Integration | ✅ Complete | Hybrid namespace, layer metadata |
| Vector Search | ✅ Complete | Basic search endpoint |
| Significance Scoring | ❌ Not Implemented | Field exists, no logic |
| Classification | ⚠️ Partial | Simple keyword extraction only |
| Actor Resolution | ❌ Not Implemented | Passthrough only |
| Entity System | ❌ Not Implemented | Schema-only in docs |
| Cluster Assignment | ❌ Not Implemented | Schema exists, no workflow |
| Actor Profiles | ❌ Not Implemented | Planned tables not created |
| LLM Gating (2-Key) | ❌ Not Implemented | No retrieval governor |
| Temporal States | ❌ Not Implemented | No bi-temporal tables |

---

## Day 1: Observations In (Pipeline Completion)

### 1.1 Current Observation Pipeline

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts:152-407`

**All 7 steps are fully implemented:**

| Step | Function | Lines | Status |
|------|----------|-------|--------|
| 1 | Check Duplicate | 186-202 | ✅ Database + Inngest idempotency |
| 2 | Event Filtering | 213-260 | ✅ Integration config check |
| 3 | Fetch Workspace | 271-285 | ✅ Embedding config validation |
| 4 | Generate Embedding | 288-315 | ✅ Cohere API integration |
| 5 | Upsert Vector | 318-351 | ✅ Pinecone with metadata |
| 6 | Store Observation | 354-387 | ✅ Database insert |
| 7 | Emit Event | 390-398 | ✅ Completion event |

**Inngest Configuration** (lines 153-172):
- `retries: 3` - Standard retry strategy
- `concurrency: { limit: 10, key: "event.data.workspaceId" }` - Per-workspace throttling
- `idempotency: "event.data.sourceEvent.sourceId"` - Prevents duplicate processing

### 1.2 What's Missing for Day 1

#### Significance Scoring (NOT IMPLEMENTED)

**Current State**: Field exists in schema but not populated
- Schema: `db/console/src/schema/tables/workspace-neural-observations.ts:122-123`
- Type: `real` (float 0-100)
- Status: **Nullable, never set**

**Where to Implement**:
- Create new file: `api/console/src/inngest/workflow/neural/scoring.ts`
- Add step between embedding generation and Pinecone upsert
- Factors from E2E design: event type weight, content substance, actor activity, reference density, temporal uniqueness

#### Classification (PARTIALLY IMPLEMENTED)

**Current State**: Simple keyword extraction
- Location: `api/console/src/inngest/workflow/neural/observation-capture.ts:73-99`
- Function: `extractTopics(sourceEvent)` - extracts source, type, labels, common keywords
- Missing: Semantic classification via LLM (bug fix vs feature vs refactor)

**Where to Implement**:
- Enhance `extractTopics()` or create separate `classifyObservation()` function
- Use Claude Haiku for fast classification
- Add semantic tags beyond keywords

#### Actor Resolution (NOT IMPLEMENTED)

**Current State**: Passthrough from source event
- Location: `observation-capture.ts:363` - `actor: sourceEvent.actor || null`
- No cross-source identity resolution
- No workspace user profile linking

**Where to Implement**:
- Create new file: `api/console/src/inngest/workflow/neural/actor-resolution.ts`
- Three-tier resolution: OAuth connection (1.0) → Email matching (0.85) → Heuristic (0.60)
- Requires actor profile tables (see Day 4)

### 1.3 Embedding Infrastructure

**File**: `packages/console-embed/src/utils.ts`

**Configuration** (`packages/console-config/src/private-config.ts:137-191`):
- Model: `embed-english-v3.0` (Cohere)
- Dimension: 1024
- Batch size: 96 texts
- Input types: `search_document` (indexing) vs `search_query` (retrieval)

**Current Implementation**:
- Single embedding per observation (title + body combined)
- No multi-view embeddings (title, content, summary separate)

**For Multi-View Embeddings**:
- Modify vector ID scheme: `obs_{sourceId}:{viewType}`
- Generate 3 embeddings per observation
- Store with `viewType` in metadata

### 1.4 Transformer Patterns

**Files**: `packages/console-webhooks/src/transformers/`

#### GitHub Transformer (`github.ts`)
| Event | Function | Lines | SourceType Pattern |
|-------|----------|-------|-------------------|
| Push | `transformGitHubPush` | 17-79 | `push` |
| Pull Request | `transformGitHubPullRequest` | 84-198 | `pull_request_{action}` |
| Issues | `transformGitHubIssue` | 203-272 | `issue_{action}` |
| Release | `transformGitHubRelease` | 277-329 | `release_{action}` |
| Discussion | `transformGitHubDiscussion` | 334-388 | `discussion_{action}` |

**Reference Extraction** (`extractLinkedIssues`, lines 394-409):
- Pattern: `/(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi`
- Returns `{ id, url?, label }` with relationship type

#### Vercel Transformer (`vercel.ts`)
| Event | Function | Lines |
|-------|----------|-------|
| Deployment | `transformVercelDeployment` | 14-133 |

**Events**: `deployment.created`, `deployment.succeeded`, `deployment.ready`, `deployment.canceled`, `deployment.error`

### 1.5 Database Schema

**File**: `db/console/src/schema/tables/workspace-neural-observations.ts:46-197`

**Key Fields**:
| Field | Type | Status |
|-------|------|--------|
| `id` | varchar(191) | ✅ nanoid PK |
| `workspaceId` | varchar(191) | ✅ FK with cascade |
| `clusterId` | varchar(191) | ⚠️ Always null (no clustering) |
| `occurredAt` | timestamp | ✅ Event timestamp |
| `actor` | jsonb | ✅ SourceActor passthrough |
| `observationType` | varchar(100) | ✅ Derived from sourceType |
| `title` | text | ✅ From SourceEvent |
| `content` | text | ✅ From SourceEvent |
| `topics` | jsonb | ⚠️ Simple keywords only |
| `significanceScore` | real | ❌ Never set |
| `source` | varchar(50) | ✅ "github" / "vercel" |
| `sourceReferences` | jsonb | ✅ Array of References |
| `embeddingVectorId` | varchar(191) | ✅ Pinecone ID |

**Indexes** (lines 168-196):
- `obs_workspace_occurred_idx` - Timeline queries
- `obs_cluster_idx` - Cluster lookups
- `obs_source_idx` - Source filtering
- `obs_source_id_idx` - Deduplication
- `obs_type_idx` - Type filtering

---

## Day 2: Basic Retrieval (Observations Out)

### 2.1 Search Infrastructure

**File**: `api/console/src/router/org/search.ts:42-185`

**Current Implementation**:
1. API key authentication via `apiKeyProcedure`
2. Workspace lookup for index/namespace config
3. Query embedding generation (Cohere, `search_query` type)
4. Pinecone vector search with namespace
5. Result mapping from metadata (no Postgres hydration)

**Query Pattern** (lines 118-136):
```typescript
const queryResult = await pineconeClient.query(indexName, {
  vector: queryEmbedding,
  topK: input.topK,
  includeMetadata: true,
}, namespaceName);
```

**Missing Features**:
- No metadata filters applied (schema accepts filters but not used)
- No LLM relevance filtering (Key 2)
- No entity lookup integration
- No cluster context retrieval

### 2.2 Pinecone Namespace Strategy

**Hybrid Approach** (from `observation-capture.ts:103-109`):
- Format: `{clerkOrgId}:ws_{workspaceId}`
- Single namespace per workspace (not per layer)
- Layer as metadata field: `layer: "observations"` | `"knowledge"`

**Metadata Structure** (lines 34-48):
```typescript
interface ObservationVectorMetadata {
  layer: string;           // "observations"
  observationType: string; // "push", "pull_request_merged"
  source: string;          // "github", "vercel"
  sourceType: string;      // Raw event type
  sourceId: string;        // Deduplication key
  title: string;           // ≤120 chars
  snippet: string;         // First 500 chars of body
  occurredAt: string;      // ISO timestamp
  actorName: string;       // Actor display name
}
```

### 2.3 What's Missing for Day 2

#### LLM Relevance Filtering (Key 2)

**Not Implemented** - Need to add after vector search:
1. Fetch top 50 candidates from Pinecone
2. Batch candidates for LLM evaluation
3. Use Claude Haiku for fast relevance scoring (0.0-1.0)
4. Filter below threshold (0.6)
5. Combine scores: 60% LLM relevance + 40% vector similarity

#### Entity Store Integration

**Not Implemented** - Need parallel retrieval path:
1. Extract entity references from query
2. Exact-match lookup in entity store
3. Merge with vector results

#### Cluster Context Retrieval

**Not Implemented** - Need parallel retrieval path:
1. Find clusters matching query embedding
2. Include cluster summaries in context

---

## Day 3: Entity System

### 3.1 Current State: NOT IMPLEMENTED

**Entity tables do not exist**. Schema is documented in `docs/architecture/plans/neural-memory/phase-01-foundation.md:207-239` but not created.

**Planned Table**: `workspace_neural_entities`
```sql
-- From E2E design spec (not implemented)
CREATE TABLE workspace_neural_entities (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  category VARCHAR(50) NOT NULL,  -- 'engineer', 'project', 'endpoint', 'config'
  key VARCHAR(500) NOT NULL,       -- "sarah-johnson", "POST /api/users"
  value TEXT NOT NULL,
  aliases JSONB,                   -- ["@sarah", "sarah.johnson@acme.com"]
  source_observation_id VARCHAR(191),
  confidence FLOAT DEFAULT 0.8,
  CONSTRAINT uq_entity_key UNIQUE (workspace_id, category, key)
);
```

### 3.2 Entity Extraction Patterns

**What Exists**: Simple keyword extraction in `extractTopics()`

**What's Needed**:
1. **Rule-based extraction** (high confidence, fast):
   - API endpoints: `/(GET|POST|PUT|PATCH|DELETE)\s+\/[^\s"']+/g`
   - Environment variables: `/\b[A-Z][A-Z0-9_]{2,}(?:_[A-Z0-9]+)*\b/g`
   - @mentions: `/@([a-zA-Z0-9_-]+)/g`
   - Issue/PR references: `/(#\d+|[A-Z]+-\d+)/g`

2. **LLM-based extraction** (complex entities):
   - Use Claude Haiku with structured output
   - Extract engineers, projects, decisions, definitions

### 3.3 Drizzle Query Patterns (For Entity Lookup)

**Exact Match** (`api/console/src/router/org/contents.ts:60-65`):
```typescript
const documents = await db
  .select()
  .from(table)
  .where(and(
    inArray(table.id, input.ids),
    eq(table.workspaceId, ctx.auth.workspaceId)
  ));
```

**Text Search** (not currently used, would need):
```typescript
import { ilike } from "drizzle-orm";

const results = await db
  .select()
  .from(workspaceNeuralEntities)
  .where(and(
    eq(workspaceNeuralEntities.workspaceId, workspaceId),
    or(
      ilike(workspaceNeuralEntities.key, `%${query}%`),
      ilike(workspaceNeuralEntities.value, `%${query}%`)
    )
  ));
```

**Array Containment** (for aliases):
```typescript
const results = await db
  .select()
  .from(workspaceNeuralEntities)
  .where(sql`${workspaceNeuralEntities.aliases} && ${queryEntities}::text[]`);
```

---

## Day 4: Clusters + Profiles

### 4.1 Cluster Schema

**File**: `db/console/src/schema/tables/workspace-observation-clusters.ts:17-138`

**Status**: Schema exists, **no workflow implementation**

**Key Fields**:
| Field | Type | Status |
|-------|------|--------|
| `topicLabel` | varchar(255) | ❌ Never populated |
| `topicEmbeddingId` | varchar(191) | ❌ No centroid calculation |
| `keywords` | jsonb | ❌ Never populated |
| `primaryEntities` | jsonb | ❌ Never populated |
| `primaryActors` | jsonb | ❌ Never populated |
| `summary` | text | ❌ No LLM generation |
| `observationCount` | integer | ❌ No updates |

**What's Needed**:
1. Cluster assignment algorithm (embedding similarity + entity overlap)
2. Cluster metrics update on observation capture
3. Summary generation workflow (Claude Sonnet when threshold reached)

### 4.2 Actor Profiles

**Current State**: Actors stored inline as JSONB in observations

**Planned Tables** (NOT CREATED):
- `workspace_actor_profiles` - Unified profiles with expertise domains
- `workspace_actor_identities` - Cross-platform identity mapping

**What Exists** (`workspace-neural-observations.ts:28-33`):
```typescript
interface ObservationActor {
  id: string;        // Source-specific ID
  name: string;      // Display name
  email?: string;    // For identity resolution
  avatarUrl?: string;
}
```

### 4.3 Inngest Fire-and-Forget Patterns

**Pattern** (from `observation-capture.ts:390-398`):
```typescript
await step.sendEvent("emit-captured", {
  name: "apps-console/neural/observation.captured",
  data: {
    workspaceId,
    observationId: observation.id,
    sourceId: sourceEvent.sourceId,
    observationType: observation.observationType,
  },
});
```

**For Profile Updates**:
```typescript
// Add after observation storage
await step.sendEvent("profile-update", {
  name: "neural/profile.update",
  data: { workspaceId, actorId: actor.id, observationId: observation.id },
});
```

**For Cluster Summary**:
```typescript
await step.sendEvent("cluster-summary-check", {
  name: "neural/cluster.check-summary",
  data: { workspaceId, clusterId: clusterAssignment.clusterId },
});
```

### 4.4 LLM Call Patterns

**Structured Output** (`packages/cms-workflows/src/workflows/blog.ts:176-180`):
```typescript
const { object } = await generateObject({
  model: anthropic("claude-3-5-sonnet-latest"),
  schema: aeoPlanSchema, // Zod schema
  prompt,
});
```

**Simple Text** (`api/chat/src/inngest/workflow/generate-chat-title.ts:88-101`):
```typescript
const { text } = await generateText({
  model: gateway("openai/gpt-5-nano"),
  system: `You are a title generator...`,
  prompt: `Generate a title for: ${context}`,
  temperature: 0.5,
});
```

**Model Selection**:
- **Sonnet**: Complex tasks (summaries, classifications)
- **Haiku**: Fast tasks (relevance filtering, entity extraction)
- **GPT-5 Nano**: Cheap tasks (title generation)

---

## Day 5: 2-Key Retrieval + Temporal

### 5.1 LLM Gating Patterns

**Not Implemented** - From E2E design:
```typescript
async function llmRelevanceFilter(
  query: string,
  candidates: VectorSearchResult[],
  options: { maxCandidates: number; minConfidence: number }
): Promise<ScoredObservation[]> {
  if (candidates.length <= 5) {
    return candidates.map(c => ({ ...c, relevanceScore: c.vectorScore }));
  }

  const response = await llm.generate({
    model: 'claude-3-5-haiku-20241022',
    messages: [{
      role: 'system',
      content: `Rate each candidate's relevance from 0.0 to 1.0...`
    }, {
      role: 'user',
      content: `Query: "${query}"\n\nCandidates: ${JSON.stringify(candidates)}`
    }],
  });

  // Parse ratings and filter
  return filtered.sort((a, b) => b.finalScore - a.finalScore);
}
```

### 5.2 Temporal Patterns

**Current State**: Event-time tracking only

**What Exists**:
- `occurredAt` field on observations (event timestamp)
- `createdAt` / `updatedAt` audit fields
- Time-range queries with `gte()` / `lte()`

**What's Missing**:
- No `valid_from` / `valid_to` fields
- No bi-temporal tables
- No point-in-time query helpers
- No state versioning

**Temporal Query Pattern** (from `router/org/activities.ts`):
```typescript
const activities = await db.query.workspaceUserActivities.findMany({
  where: and(
    eq(workspaceUserActivities.workspaceId, workspaceId),
    gte(workspaceUserActivities.timestamp, startDate),
    lte(workspaceUserActivities.timestamp, endDate),
  ),
  orderBy: [desc(workspaceUserActivities.timestamp)],
  limit: input.limit,
});
```

### 5.3 Fusion/Scoring

**Current State**: Raw Pinecone similarity scores only

**What's Needed**:
1. Combine vector score (40%) + LLM relevance (60%)
2. Boost for entity matches
3. Boost for actor matches
4. Recency weighting

---

## Cross-Cutting Research

### Inngest Workflow Patterns

**Concurrency** (`observation-capture.ts:163-166`):
```typescript
concurrency: { limit: 10, key: "event.data.workspaceId" }
```

**Retries**: `retries: 3` (standard), `retries: 2` (deletions)

**Step Functions**:
- `step.run()` - Computation with memoization
- `step.sendEvent()` - Fire-and-forget events
- `step.waitForEvent()` - Coordination with children

**Error Handling**:
- `NonRetriableError` - Validation failures, missing config
- Standard `Error` - Transient failures (API, network)
- `onFailure` hook - Cleanup after all retries exhausted

### tRPC Router Patterns

**Auth Boundaries**:
- `userRouter` - No org required (`userScopedProcedure`)
- `orgRouter` - Active org required (`orgScopedProcedure`)
- `m2mRouter` - Internal services (`inngestM2MProcedure`)

**Workspace Resolution**:
```typescript
const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
  clerkOrgSlug: input.clerkOrgSlug,
  workspaceName: input.workspaceName,
  userId: ctx.auth.userId,
});
```

### Testing Patterns

**Current State**: **NO TESTS** for Inngest workflows

**Available Framework**: Vitest (used in `core/lightfast/`)

**What's Needed**:
- Add `vitest.config.ts` to `api/console/`
- Create test utilities for Inngest step mocking
- Add test files for observation-capture workflow

---

## Implementation Recommendations

### Day 1 Priority Tasks

1. **Create scoring.ts** - Implement significance evaluation
2. **Enhance extractTopics** - Add LLM classification
3. **Create actor-resolution.ts** - Three-tier resolution

### Day 2 Priority Tasks

1. **Add metadata filters to search** - Apply `labels` filter to Pinecone
2. **Implement LLM gating** - Post-filter vector results
3. **Add latency tracking** - Separate vector vs LLM times

### Day 3 Priority Tasks

1. **Create entity schema migration** - `workspace_neural_entities` table
2. **Implement rule-based extraction** - Regex patterns
3. **Add entity lookup to search** - Parallel retrieval path

### Day 4 Priority Tasks

1. **Create actor tables migration** - Profiles + identities
2. **Implement cluster assignment** - Embedding similarity algorithm
3. **Add profile update workflow** - Fire-and-forget pattern

### Day 5 Priority Tasks

1. **Implement retrieval governor** - Combine all retrieval paths
2. **Add fusion scoring** - Weight and combine scores
3. **Polish edge cases** - Error handling, timeouts

---

## Code References

### Core Pipeline
- `api/console/src/inngest/workflow/neural/observation-capture.ts:152-407` - Main workflow
- `packages/console-webhooks/src/transformers/github.ts:17-418` - GitHub transformers
- `packages/console-webhooks/src/transformers/vercel.ts:14-137` - Vercel transformer

### Database Schema
- `db/console/src/schema/tables/workspace-neural-observations.ts:46-197` - Observations table
- `db/console/src/schema/tables/workspace-observation-clusters.ts:17-138` - Clusters table

### Search Infrastructure
- `api/console/src/router/org/search.ts:42-185` - Search endpoint
- `packages/console-pinecone/src/client.ts:68-131` - Pinecone client

### Embedding
- `packages/console-embed/src/utils.ts:89-194` - Embedding utilities
- `vendor/embed/src/provider/cohere.ts:77-163` - Cohere provider

### Inngest
- `api/console/src/inngest/client/client.ts:19-654` - Event schemas
- `api/console/src/inngest/workflow/` - All workflows

### LLM Patterns
- `packages/cms-workflows/src/workflows/blog.ts:176-269` - generateObject example
- `api/chat/src/inngest/workflow/generate-chat-title.ts:88-101` - generateText example

---

## Related Research

- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Full architecture spec
- `thoughts/shared/research/2025-12-11-github-vercel-neural-observations-research.md` - Transformer research
- `thoughts/shared/plans/2025-12-11-neural-memory-implementation-research-prompt.md` - Research prompt

---

## Open Questions

1. **Entity Deduplication**: How to handle entity updates vs new entities?
2. **Cluster Lifecycle**: When to close clusters? What triggers archival?
3. **Actor Confidence Thresholds**: What's the minimum confidence for identity linking?
4. **LLM Cost Budget**: How many candidates can we afford to filter per query?
5. **Testing Strategy**: How to test Inngest workflows without running full stack?

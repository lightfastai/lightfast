---
date: 2025-12-11T20:17:45+1100
researcher: Claude Code
git_commit: 6eb6cc74883fc5f16afd68741c3fd948e4a110e3
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Implementation Infrastructure Map"
tags: [research, neural-memory, implementation, infrastructure, observations, embeddings, retrieval]
status: complete
last_updated: 2025-12-11
last_updated_by: Claude Code
---

# Research: Neural Memory Implementation Infrastructure Map

**Date**: 2025-12-11T20:17:45+1100
**Researcher**: Claude Code
**Git Commit**: 6eb6cc74
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Map all existing infrastructure needed for the 5-day neural memory implementation. Document what exists, what's missing, integration points, and patterns to follow.

## Summary

The codebase has a **fully functional observation capture pipeline** (Day 1) with embedding generation, Pinecone storage, and webhook transformers for GitHub and Vercel. Search infrastructure (Day 2) exists for knowledge documents and can be extended for observations. Entity extraction (Day 3) has one implemented pattern with detailed specs for more. Cluster and profile schemas exist (Day 4) but are unpopulated. No LLM gating or temporal state tracking exists yet (Day 5).

---

## Day 1: Observations In (Pipeline Completion)

### 1.1 Current Observation Pipeline

**Location**: `api/console/src/inngest/workflow/neural/observation-capture.ts:114-311`

**Status**: Fully implemented and functional

**Pipeline Steps**:
| Step | Name | Lines | Status |
|------|------|-------|--------|
| 1 | check-duplicate | 148-172 | Implemented |
| 2 | fetch-context | 174-189 | Implemented |
| 3 | generate-embedding | 191-219 | Implemented |
| 4 | upsert-vector | 221-255 | Implemented |
| 5 | store-observation | 257-291 | Implemented |
| 6 | emit-completion | 293-302 | Implemented |

**What Needs Implementation (per E2E design)**:
- Significance evaluation → `significanceScore` field is nullable, not populated
- Classification beyond topic extraction → basic topics extracted, no LLM classification
- Actor profile resolution → actor stored inline, no profile linking
- Cluster assignment → `clusterId` remains null
- Entity extraction → not implemented in pipeline

**Integration Points**:
- Webhook entry: `apps/console/src/app/(github)/api/github/webhooks/route.ts:163-367`
- Webhook entry: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:24-69`
- Event schema: `api/console/src/inngest/client/client.ts:584-631`

### 1.2 Embedding Infrastructure

**Location**: `packages/console-embed/`

**Key Functions**:
| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `createEmbeddingProvider` | utils.ts | 89-98 | Factory with global defaults |
| `createEmbeddingProviderForWorkspace` | utils.ts | 150-160 | Workspace-bound provider |
| `embedTextsInBatches` | utils.ts | 175-194 | Batch processing (96 limit) |

**Configuration** (`packages/console-config/src/private-config.ts:137-191`):
- Model: `embed-english-v3.0`
- Dimension: 1024
- Batch size: 96 (Cohere limit)
- Provider: Cohere

**Multi-View Embedding Integration Points**:
```
Current: Single embedding per observation
  - observation-capture.ts:192-219 (generates ONE embedding)
  - observation-capture.ts:221-255 (upserts ONE vector)

To Add Multi-View:
  - Generate 3 embeddings: title, content, summary
  - Upsert 3 vectors with viewType metadata
  - Store 3 vector IDs in database as JSONB
```

**Files to Modify for Multi-View**:
1. `observation-capture.ts:192-219` → Generate 3 embeddings
2. `observation-capture.ts:221-255` → Upsert 3 vectors
3. `workspace-neural-observations.ts:152-157` → Change to `embeddingVectorIds: jsonb`

### 1.3 Transformer Patterns

**Location**: `packages/console-webhooks/src/transformers/`

**SourceEvent Interface** (`packages/console-types/src/neural/source-event.ts:5-26`):
```typescript
interface SourceEvent {
  source: "github" | "vercel" | "linear" | "sentry";
  sourceType: string;
  sourceId: string;
  title: string;              // ≤120 chars for embedding
  body: string;               // Full content for embedding
  actor?: SourceActor;
  occurredAt: string;
  references: SourceReference[];
  metadata: Record<string, unknown>;  // Structured fields (NOT for embedding)
}
```

**Implemented Transformers**:
| Source | Function | Lines | Events Handled |
|--------|----------|-------|----------------|
| GitHub | `transformGitHubPush` | github.ts:17-79 | push |
| GitHub | `transformGitHubPullRequest` | github.ts:84-198 | PR opened/closed/merged |
| GitHub | `transformGitHubIssue` | github.ts:203-272 | issue opened/closed |
| GitHub | `transformGitHubRelease` | github.ts:277-329 | release published |
| GitHub | `transformGitHubDiscussion` | github.ts:334-388 | discussion created/answered |
| Vercel | `transformVercelDeployment` | vercel.ts:14-133 | deployment.* events |

**Pattern to Follow** (github.ts:47-77):
- `body`: Semantic content only (for embedding)
- `metadata`: Structured fields (repo, branch, counts)
- `references`: Entity relationships (commits, PRs, issues)

### 1.4 Database Schema

**Observations Table** (`db/console/src/schema/tables/workspace-neural-observations.ts:46-197`)

**Existing Fields**:
| Field | Type | Status |
|-------|------|--------|
| id | varchar(191) | Implemented |
| workspaceId | varchar(191), FK | Implemented |
| clusterId | varchar(191) | Exists, always null |
| occurredAt | timestamp | Implemented |
| capturedAt | timestamp | Implemented |
| actor | jsonb | Implemented (inline, not linked) |
| observationType | varchar(100) | Implemented |
| title | text | Implemented |
| content | text | Implemented |
| topics | jsonb | Implemented (basic extraction) |
| significanceScore | real | Exists, not populated |
| source | varchar(50) | Implemented |
| sourceType | varchar(100) | Implemented |
| sourceId | varchar(255) | Implemented |
| sourceReferences | jsonb | Implemented |
| metadata | jsonb | Implemented |
| embeddingVectorId | varchar(191) | Implemented (single ID) |

**Indexes** (lines 168-196):
- `workspaceOccurredIdx`: (workspaceId, occurredAt)
- `clusterIdx`: (clusterId)
- `sourceIdx`: (workspaceId, source, sourceType)
- `sourceIdIdx`: (workspaceId, sourceId) - for deduplication
- `typeIdx`: (workspaceId, observationType)

---

## Day 2: Basic Retrieval (Observations Out)

### 2.1 Search Infrastructure

**Location**: `api/console/src/router/org/search.ts:42-185`

**Current Flow**:
1. Fetch workspace config (indexName, namespaceName) → lines 60-76
2. Generate query embedding with `inputType: "search_query"` → lines 89-116
3. Query Pinecone → lines 118-136
4. Map results to response → lines 138-156

**What Exists**:
- Vector search via Pinecone ✓
- Workspace namespace isolation ✓
- Metadata extraction ✓
- Basic response format ✓

**What's Missing**:
- Layer filtering (observations vs documents)
- LLM relevance gating (Key 2)
- Re-ranking (TODO at line 154)
- Observation-specific endpoint

**Pattern to Reuse** (search.ts:118-136):
```typescript
const response = await pineconeClient.query<VectorMetadata>(
  workspace.indexName!,
  embedding.embeddings[0]!,
  {
    topK: input.limit,
    includeMetadata: true,
  },
  workspace.namespaceName!
);
```

**For Observations, Add Filter**:
```typescript
filter: {
  layer: { $eq: "observations" }
}
```

### 2.2 Pinecone Namespace Strategy

**Current Pattern** (`observation-capture.ts:104-107`):
```typescript
function buildWorkspaceNamespace(clerkOrgId: string, workspaceId: string) {
  const sanitized = `${clerkOrgId}:ws_${workspaceId}`.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return sanitized.slice(0, 50);
}
```

**Format**: `{clerkOrgId}:ws_{workspaceId}` (single namespace per workspace)

**Layer Metadata** (observation-capture.ts:228-238):
```typescript
const metadata: ObservationVectorMetadata = {
  layer: "observations",  // Distinguishes from "knowledge" documents
  observationType,
  source,
  sourceType,
  sourceId,
  title,
  snippet,
  occurredAt,
  actorName,
};
```

**Hybrid Approach Benefits**:
- Single query searches all layers within workspace
- 3× reduction in namespace count
- Simpler cross-layer retrieval
- Filter by `metadata.layer` instead of separate namespaces

### 2.3 Hydration Pattern

**Location**: `api/console/src/router/org/contents.ts:50-95`

**Current Pattern** (for documents):
1. Accept document IDs from search results
2. Query `workspaceKnowledgeDocuments` by IDs
3. Return full metadata

**For Observations**:
- Same pattern: query `workspaceNeuralObservations` by IDs
- Return actor, content, references, cluster info

---

## Day 3: Entity System

### 3.1 Entity Schema

**Status**: Table does NOT exist yet

**E2E Design Schema** (from e2e-design.md:1238-1262):
```sql
CREATE TABLE workspace_neural_entities (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  store_id VARCHAR(191) NOT NULL,

  category VARCHAR(50) NOT NULL,      -- 'engineer', 'project', 'endpoint', etc.
  key VARCHAR(500) NOT NULL,          -- "sarah-johnson", "POST /api/users"
  value TEXT NOT NULL,                -- Description
  aliases JSONB,                      -- Alternative names

  source_observation_id VARCHAR(191),
  evidence_snippet TEXT,
  confidence FLOAT DEFAULT 0.8,

  extracted_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,

  CONSTRAINT uq_entity_key UNIQUE (workspace_id, category, key)
);
```

### 3.2 Entity Extraction Patterns

**Existing Implementation** (`packages/console-webhooks/src/transformers/github.ts:394-409`):
```typescript
function extractLinkedIssues(body: string): SourceReference[] {
  const pattern = /(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
  const matches = [...body.matchAll(pattern)];
  return matches.map(match => ({
    type: 'issue' as const,
    id: match[2]!,
    label: match[1]!.toLowerCase(),
  }));
}
```

**Patterns to Implement** (from phase-06-embedding-storage.md):

| Pattern | Regex | Category |
|---------|-------|----------|
| API endpoints | `/(GET\|POST\|PUT\|PATCH\|DELETE)\s+(\/[^\s"'<>]+)/g` | endpoint |
| Env variables | `/\b([A-Z][A-Z0-9_]{2,}(?:_[A-Z0-9]+)+)\b/g` | config |
| @mentions | `/@([a-zA-Z0-9_-]+)/g` | engineer |
| Issue/PR refs | `/(#\d+\|[A-Z]{2,}-\d+)/g` | issue |

### 3.3 Exact-Match Query Patterns

**Drizzle Pattern for Text Search** (from search.ts):
```typescript
import { ilike, inArray, sql } from "drizzle-orm";

// Exact match on key
eq(workspaceNeuralEntities.key, searchTerm)

// Fuzzy match
ilike(workspaceNeuralEntities.key, `%${searchTerm}%`)

// Array containment (for aliases)
sql`${workspaceNeuralEntities.aliases} && ${aliasArray}::text[]`
```

---

## Day 4: Clusters + Profiles

### 4.1 Cluster Schema

**Location**: `db/console/src/schema/tables/workspace-observation-clusters.ts`

**Table**: `lightfast_workspace_observation_clusters`

**Existing Fields**:
| Field | Type | Purpose |
|-------|------|---------|
| id | varchar(191) | Primary key |
| workspaceId | varchar(191), FK | Workspace scope |
| topicLabel | varchar(255) | Human-readable topic |
| topicEmbeddingId | varchar(191) | Centroid embedding |
| keywords | jsonb | Fast retrieval hooks |
| primaryEntities | jsonb | Related entities |
| primaryActors | jsonb | Key contributors |
| status | varchar(50) | 'open' or 'closed' |
| summary | text | LLM-generated summary |
| summaryGeneratedAt | timestamp | When summary generated |
| observationCount | integer | Count of observations |
| firstObservationAt | timestamp | First observation time |
| lastObservationAt | timestamp | Last observation time |

**Indexes**:
- `workspaceStatusIdx`: (workspaceId, status)
- `lastObservationIdx`: (workspaceId, lastObservationAt)

### 4.2 Actor/Profile Infrastructure

**Status**: No separate tables exist

**Current State**:
- Actor stored inline in observations as JSONB (`actor` field)
- Actor interface: `{ id, name, email?, avatarUrl? }`
- No cross-observation profile aggregation
- No identity linking across sources

**Tables to Create** (from E2E design):
1. `workspace_actor_profiles` - Aggregated expertise, patterns
2. `workspace_actor_identities` - Cross-platform mapping

### 4.3 Inngest Fire-and-Forget Patterns

**Location**: `api/console/src/inngest/workflow/` (multiple files)

**Pattern: step.sendEvent** (sync-orchestrator.ts:192-198):
```typescript
await step.sendEvent("trigger-source-sync", {
  name: eventName,
  data: eventData,
});
// Returns immediately, does not wait for child workflow
```

**Pattern: Array of Events** (files-batch-processor.ts:213):
```typescript
await step.sendEvent("process-documents", documentsToProcess);
// Single call sends multiple events atomically
```

**For Profile Updates**:
```typescript
// After storing observation
await step.sendEvent("profile-update", {
  name: "apps-console/neural/profile.update",
  data: { workspaceId, actorId, observationId },
});
```

### 4.4 LLM Summary Generation

**Pattern from tRPC Research** (generate-chat-title.ts:88-101):
```typescript
const { text } = await generateText({
  model: gateway("openai/gpt-5-nano"),  // Cheapest model for simple tasks
  system: `You are a summary generator...`,
  prompt: `Summarize these observations:\n\n${observationTexts}`,
  temperature: 0.5,
});
```

**For Cluster Summaries** (E2E design lines 1050-1074):
- Model: Sonnet for quality summaries
- Input: Up to 50 observations
- Output: ~300 words covering topic, decisions, contributors, status

---

## Day 5: 2-Key Retrieval + Temporal

### 5.1 LLM Gating Patterns

**Status**: Not implemented

**Current Search** (search.ts):
- Returns Pinecone results directly
- No relevance filtering
- TODO comment at line 154: "Add rerank latency when reranking is implemented"

**E2E Design Pattern** (lines 629-696):
```typescript
async function llmRelevanceFilter(
  query: string,
  candidates: VectorSearchResult[],
  options: { maxCandidates: number; minConfidence: number }
): Promise<ScoredObservation[]> {
  // Skip if few candidates
  if (candidates.length <= 5) return candidates;

  // Batch candidates for efficiency
  const candidateSummaries = candidates.slice(0, maxCandidates).map(...);

  // LLM relevance check (fast model)
  const response = await llm.generate({
    model: 'claude-3-5-haiku-20241022',
    messages: [{
      role: 'system',
      content: `Rate each candidate's relevance 0.0-1.0...`
    }, {
      role: 'user',
      content: `Query: "${query}"\nCandidates: ${JSON.stringify(candidateSummaries)}`
    }],
  });

  // Filter by minConfidence
  return candidates.filter(c => c.relevance >= minConfidence);
}
```

### 5.2 Temporal State Patterns

**Status**: No bi-temporal tables exist

**E2E Design Schema** (lines 1325-1353):
```sql
CREATE TABLE workspace_temporal_states (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(191) NOT NULL,
  entity_name VARCHAR(255),

  state_type VARCHAR(50) NOT NULL,
  state_value VARCHAR(255) NOT NULL,
  state_metadata JSONB,

  valid_from TIMESTAMP NOT NULL,
  valid_to TIMESTAMP,
  is_current BOOLEAN DEFAULT TRUE,

  changed_by_actor_id VARCHAR(191),
  change_reason TEXT,
  related_observation_id VARCHAR(191)
);
```

**Point-in-Time Query Pattern**:
```typescript
const state = await db.select()
  .from(workspaceTemporalStates)
  .where(and(
    eq(entityId, entityId),
    lte(validFrom, pointInTime),
    or(isNull(validTo), gt(validTo, pointInTime))
  ));
```

### 5.3 Fusion/Scoring Patterns

**Status**: Not implemented

**Current**: Returns raw Pinecone similarity scores

**E2E Design Pattern** (lines 689-696):
```typescript
// Combined score: 60% LLM relevance, 40% vector similarity
const finalScore = (llmRelevance * 0.6) + (vectorScore * 0.4);
```

---

## Cross-Cutting Research

### Inngest Workflow Patterns

**Concurrency** (sync-orchestrator.ts:48-52):
```typescript
concurrency: {
  limit: 1,
  key: "event.data.sourceId",
}
```

**Retries**: Standard is `retries: 3` across all workflows

**Timeouts** (sync-orchestrator.ts:74-77):
```typescript
timeouts: {
  start: "2m",   // Max time before first step
  finish: "30m", // Max time for entire workflow
}
```

**Idempotency** (observation-capture.ts:122):
```typescript
idempotency: "event.data.sourceEvent.sourceId"
```

**Event Batching** (process-documents.ts:122-126):
```typescript
batchEvents: {
  maxSize: 25,
  timeout: "5s",
  key: "event.data.workspaceId",
}
```

**Error Handling**:
- `NonRetriableError` for validation failures
- `Promise.allSettled` for partial failure handling
- `onFailure` hook for cleanup after all retries exhausted

### tRPC Router Patterns

**Auth Boundaries**:
- `userRouter`: No org required (account, apiKeys, sources)
- `orgRouter`: Org membership required (workspace, search, jobs)
- `m2mRouter`: Internal services only (Inngest, webhooks)

**Org Membership Validation** (trpc.ts:373-398):
```typescript
export const orgScopedProcedure = sentrifiedProcedure
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "clerk-active") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx: { auth: ctx.auth as ClerkActiveAuth } });
  });
```

**Workspace Resolution** (trpc.ts:630-660):
```typescript
const { workspaceId } = await resolveWorkspaceByName({
  clerkOrgSlug: input.clerkOrgSlug,
  workspaceName: input.workspaceName,
  userId: ctx.auth.userId,
});
```

### Testing Patterns

**Status**: No unit tests for Inngest workflows

**Current Approach**:
- Integration testing via Inngest Dev Server (`pnpm dev:console`)
- Production monitoring via Inngest dashboard + Sentry
- Manual testing via tRPC API calls or webhook events

---

## Implementation Checklist

### Day 1: Observations In

| Task | Status | Location |
|------|--------|----------|
| Pipeline structure | Done | observation-capture.ts:114-311 |
| Embedding generation | Done | observation-capture.ts:191-219 |
| Pinecone upsert | Done | observation-capture.ts:221-255 |
| Database storage | Done | observation-capture.ts:257-291 |
| Significance scoring | **TODO** | Add step before embedding |
| Classification | **TODO** | Add LLM classification step |
| Actor resolution | **TODO** | Link to profile, not inline |
| Multi-view embeddings | **TODO** | Generate 3 embeddings |

### Day 2: Basic Retrieval

| Task | Status | Location |
|------|--------|----------|
| Vector search | Done | search.ts:118-136 |
| Namespace isolation | Done | buildWorkspaceNamespace |
| Metadata extraction | Done | search.ts:138-156 |
| Layer filtering | **TODO** | Add `layer: "observations"` filter |
| Observation endpoint | **TODO** | New router procedure |
| Hydration from Postgres | **TODO** | Query observations by IDs |

### Day 3: Entity System

| Task | Status | Location |
|------|--------|----------|
| Issue extraction | Done | github.ts:394-409 |
| Entity table | **TODO** | Create migration |
| Endpoint extraction | **TODO** | Add regex pattern |
| Env var extraction | **TODO** | Add regex pattern |
| @mention extraction | **TODO** | Add regex pattern |
| Entity search | **TODO** | Add router procedure |

### Day 4: Clusters + Profiles

| Task | Status | Location |
|------|--------|----------|
| Cluster schema | Done | workspace-observation-clusters.ts |
| Cluster assignment | **TODO** | Add to pipeline |
| Profile schema | **TODO** | Create migration |
| Identity schema | **TODO** | Create migration |
| Profile updates | **TODO** | Fire-and-forget workflow |
| Cluster summaries | **TODO** | LLM summary workflow |

### Day 5: 2-Key Retrieval + Temporal

| Task | Status | Location |
|------|--------|----------|
| LLM gating | **TODO** | Post-filter search results |
| Temporal schema | **TODO** | Create migration |
| Temporal queries | **TODO** | Point-in-time lookups |
| Fusion scoring | **TODO** | Combine LLM + vector scores |

---

## Code References

### Observation Pipeline
- `api/console/src/inngest/workflow/neural/observation-capture.ts:114-311` - Main workflow
- `apps/console/src/app/(github)/api/github/webhooks/route.ts:163-367` - GitHub entry
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:24-69` - Vercel entry

### Embedding Infrastructure
- `packages/console-embed/src/utils.ts:89-98` - Provider factory
- `packages/console-embed/src/utils.ts:150-160` - Workspace provider
- `packages/console-embed/src/utils.ts:175-194` - Batch processing

### Transformers
- `packages/console-webhooks/src/transformers/github.ts:17-388` - All GitHub transformers
- `packages/console-webhooks/src/transformers/vercel.ts:14-133` - Vercel transformer
- `packages/console-types/src/neural/source-event.ts:5-57` - SourceEvent types

### Database Schemas
- `db/console/src/schema/tables/workspace-neural-observations.ts:46-197` - Observations
- `db/console/src/schema/tables/workspace-observation-clusters.ts:19-142` - Clusters

### Search Infrastructure
- `api/console/src/router/org/search.ts:42-185` - Search procedure
- `packages/console-pinecone/src/client.ts:125-131` - Pinecone query wrapper

### Inngest Patterns
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts` - Orchestration patterns
- `api/console/src/inngest/workflow/processing/process-documents.ts` - Batching patterns

### tRPC Patterns
- `api/console/src/trpc.ts:373-398` - Org-scoped procedure
- `api/console/src/trpc.ts:630-660` - Workspace resolution

---

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2025-12-11-neural-memory-implementation-research-prompt.md` - Original research prompt
- `thoughts/shared/research/2025-12-11-github-vercel-neural-observations-research.md` - Transformer design research

## Related Documentation

- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Full architecture spec
- `docs/architecture/plans/neural-memory/phase-06-embedding-storage.md` - Entity extraction spec
- `docs/architecture/plans/neural-memory/README.md` - Phase roadmap

---

## Open Questions

1. **Multi-view embedding storage**: Should we store 3 separate vector IDs or use a JSONB object?
2. **Entity deduplication**: How to handle entities extracted from multiple observations?
3. **Profile update debouncing**: What's the optimal debounce window for profile recalculation?
4. **Cluster closure criteria**: When should clusters transition from 'open' to 'closed'?
5. **Temporal state triggers**: What events should create temporal state records?

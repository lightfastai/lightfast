---
date: 2025-12-12T15:30:00+08:00
researcher: Claude Code
git_commit: eba2db85802cdd1a84c53228ac8a2f4ee63b1e59
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Day 2: Retrieval Infrastructure Research"
tags: [research, neural-memory, retrieval, pinecone, llm-gating, day2]
status: complete
last_updated: 2025-12-12
last_updated_by: Claude Code
---

# Research: Neural Memory Day 2 Retrieval Infrastructure

**Date**: 2025-12-12T15:30:00+08:00
**Researcher**: Claude Code
**Git Commit**: eba2db85802cdd1a84c53228ac8a2f4ee63b1e59
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Document the existing infrastructure for implementing Day 2 neural memory features: metadata filters in Pinecone queries, LLM gating layer with Claude Haiku, and latency tracking for vector vs LLM times.

## Summary

The retrieval infrastructure is **ready for Day 2 enhancements**. The search endpoint exists with proper authentication, embedding generation, and Pinecone queries - but metadata filters are not currently passed. Pinecone supports MongoDB-style filter operators (`$eq`, `$in`, `$gt`, etc.) that can filter by source, type, date range, and actor. LLM integration patterns exist via `@repo/ai/ai` using `generateObject` with Zod schemas. Latency tracking patterns are established with separate timing for embedding and query operations.

### Implementation Readiness

| Component | Current State | Day 2 Requirement |
|-----------|--------------|-------------------|
| Search Endpoint | Functional, no filters | Add metadata filter passthrough |
| Pinecone Filters | Supported, unused | Build filter from input, pass to query |
| LLM Gating | Not implemented | Post-filter with Claude Haiku |
| Latency Tracking | Total + retrieval | Add LLM filtering time |
| Embedding | Working | No changes needed |

---

## Detailed Findings

### 1. Current Search Infrastructure

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:70-260`

The internal search endpoint uses Clerk session auth via `auth()` from `@clerk/nextjs/server`. This is the primary search endpoint for console UI usage.

**Current Flow**:
1. Clerk session validation (lines 82-89)
2. Request body parsing and validation (lines 92-114)
3. Workspace resolution via `resolveWorkspaceByName` (lines 124-140)
4. Workspace config lookup for index/namespace (lines 145-161)
5. Embedding generation with `search_query` input type (lines 171-182)
6. Pinecone vector search (lines 200-209)
7. Result mapping to SearchResponse (lines 219-235)

**Query Pattern** (lines 201-209):
```typescript
const results = await pineconeClient.query<VectorMetadata>(
  workspace.indexName,
  {
    vector: queryVector,
    topK,
    includeMetadata: true,
    // NOTE: No filter is currently passed here
  },
  workspace.namespaceName
);
```

**Input Schema** (lines 38-41):
```typescript
const SearchRequestSchema = z.object({
  query: z.string().min(1, "Query must not be empty"),
  topK: z.number().int().min(1).max(100).default(10),
});
```

**Gap**: No filter field exists in the schema yet. Need to add filters input and pass to Pinecone query.

**Note**: The tRPC endpoint at `api/console/src/router/org/search.ts` uses API key auth for external access. For Day 2, focus on the Next.js route handler for internal console usage.

---

### 2. Pinecone Query Filter Support

**Files**:
- `vendor/pinecone/src/types.ts:40-49` - QueryRequest interface
- `vendor/pinecone/src/client.ts:218-244` - Query implementation

**QueryRequest Interface**:
```typescript
export interface QueryRequest {
  vector: number[];           // Query embedding (required)
  topK: number;               // Number of results (required)
  includeMetadata?: boolean;  // Include metadata in response (default: true)
  filter?: Record<string, unknown>; // Metadata filter (optional)
}
```

**Filter Operators** (MongoDB-style, passed directly to Pinecone SDK):

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equals | `{ source: { $eq: "github" } }` |
| `$ne` | Not equals | `{ status: { $ne: "draft" } }` |
| `$in` | Value in array | `{ sourceType: { $in: ["push", "pull_request"] } }` |
| `$nin` | Value not in array | `{ layer: { $nin: ["archived"] } }` |
| `$gt` | Greater than | `{ significanceScore: { $gt: 50 } }` |
| `$gte` | Greater than or equal | `{ occurredAt: { $gte: "2025-01-01" } }` |
| `$lt` | Less than | `{ occurredAt: { $lt: "2025-12-31" } }` |
| `$lte` | Less than or equal | `{ significanceScore: { $lte: 100 } }` |

**Combined Filters** (implicit AND):
```typescript
const pineconeFilter = {
  layer: { $eq: "observations" },
  source: { $in: ["github", "vercel"] },
  occurredAt: { $gte: "2025-12-01" },
};
```

**Available Metadata Fields** (from Day 1 observation capture at `observation-capture.ts:326-336`):

| Field | Type | Description | Filterable |
|-------|------|-------------|------------|
| `layer` | string | Always "observations" | Yes |
| `observationType` | string | e.g., "push", "pull_request_merged" | Yes |
| `source` | string | "github" or "vercel" | Yes |
| `sourceType` | string | Raw event type | Yes |
| `sourceId` | string | Unique identifier | Yes |
| `title` | string | Observation title | No (too varied) |
| `snippet` | string | First 500 chars | No (too varied) |
| `occurredAt` | string | ISO timestamp | Yes |
| `actorName` | string | Actor display name | Yes |

---

### 3. Embedding Generation for Queries

**File**: `packages/console-embed/src/utils.ts:150-160`

**Input Types** (lines 60-66):
- `search_query`: Optimized for short user queries (intent-focused)
- `search_document`: Optimized for document indexing (content-focused)

**Current Usage in Search** (`search.ts:91-100`):
```typescript
const embedding = createEmbeddingProviderForWorkspace(
  {
    id: workspace.id,
    embeddingModel: workspace.embeddingModel,
    embeddingDim: workspace.embeddingDim,
  },
  {
    inputType: "search_query",  // Correct for retrieval
  },
);
const { embeddings } = await embedding.embed([input.query]);
```

**Configuration** (from `packages/console-config`):
- Model: `embed-english-v3.0` (Cohere)
- Dimension: 1024
- Batch size: 96 texts

**No changes needed** for Day 2 - embedding generation is correctly configured.

---

### 4. LLM Integration Patterns

**Package**: `packages/ai/` exported via `@repo/ai/ai`

**Pattern 1: Structured Output with Zod** (from `packages/cms-workflows/src/workflows/blog.ts:176-180`):
```typescript
import { anthropic, generateObject } from "@repo/ai/ai";
import { z } from "zod";

const relevanceSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    relevanceScore: z.number().min(0).max(1),
    reasoning: z.string().optional(),
  })),
});

const { object } = await generateObject({
  model: anthropic("claude-3-5-haiku-latest"),
  schema: relevanceSchema,
  prompt: `Rate each candidate's relevance to the query...`,
});
```

**Pattern 2: Simple Text** (from `api/chat/src/inngest/workflow/generate-chat-title.ts:88-101`):
```typescript
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";

const { text } = await generateText({
  model: gateway("openai/gpt-5-nano"),
  system: `You are a relevance scorer...`,
  prompt: `Query: "${query}"\n\nCandidates: ${candidatesJson}`,
  temperature: 0.3,
});
```

**Model Selection for Day 2**:
- **Claude Haiku** (`claude-3-5-haiku-latest`): Fast inference for relevance scoring
- Cost: ~$0.0001 per operation (from documentation)
- Latency: ~200-500ms expected

**Planned Usage** (from scoring.ts comments at lines 9-26):
```typescript
import { generateObject } from "@repo/ai/ai";
import { anthropic } from "@ai-sdk/anthropic";

const { object } = await generateObject({
  model: anthropic("claude-3-5-haiku-latest"),
  schema: relevanceScoreSchema,
  prompt: `Rate the relevance of these observations to the query...`,
});
```

---

### 5. tRPC Router Patterns

**File**: `api/console/src/trpc.ts`

**For API Key Endpoints** (like search):
- Use `apiKeyProcedure` (lines 530-576)
- Workspace ID from `X-Workspace-ID` header
- No Clerk session required

**For Org-Protected Endpoints**:
- Use `orgScopedProcedure` (lines 373-398)
- Requires active org membership
- Use `resolveWorkspaceByName` helper (lines 630-660)

**Input Schema Pattern**:
```typescript
// In packages/console-validation/src/schemas/
export const neuralSearchInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(100).default(10),
  filters: z.object({
    sourceTypes: z.array(z.string()).optional(),
    observationTypes: z.array(z.string()).optional(),
    actorIds: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    }).optional(),
  }).optional(),
});
```

**Adding New Procedure**:
1. Define input schema in `@repo/console-validation`
2. Create procedure with `apiKeyProcedure` or `orgScopedProcedure`
3. Add to router in `api/console/src/router/org/`
4. Compose in `root.ts` orgRouter

---

### 6. Latency/Metrics Patterns

**File**: `api/console/src/router/org/search.ts`

**Current Timing Pattern** (lines 46, 90, 102, 119, 129):
```typescript
const startTime = Date.now();           // Overall start
const requestId = randomUUID();

// Embedding timing
const embedStart = Date.now();
const { embeddings } = await embedding.embed([input.query]);
const embedLatency = Date.now() - embedStart;

// Query timing
const queryStart = Date.now();
const results = await pineconeClient.query(...);
const queryLatency = Date.now() - queryStart;

// Response with latency breakdown
const response: SearchResponse = {
  results: searchResults,
  requestId,
  latency: {
    total: Date.now() - startTime,
    retrieval: queryLatency,
    // TODO: Add rerank latency when reranking is implemented
  },
};
```

**Logging Pattern** (lines 49-56, 112-116, 131-136, 158-162):
```typescript
import { log } from "@vendor/observability/log";

log.info("Search query", { requestId, workspaceId, query, topK, filters });
log.info("Generated embedding", { requestId, embedLatency, dimension });
log.info("Pinecone query complete", { requestId, queryLatency, matchCount });
log.info("Search complete", { requestId, totalLatency, resultCount });
```

**Latency Schema** (from `packages/console-types/src/api/common.ts:12-21`):
```typescript
export const LatencySchema = z.object({
  total: z.number().nonnegative(),
  retrieval: z.number().nonnegative(),
  rerank: z.number().nonnegative().optional(),  // For LLM gating
});
```

**For Day 2**, add `llmFilter` timing:
```typescript
latency: {
  total: Date.now() - startTime,
  retrieval: queryLatency,
  llmFilter: llmFilterLatency,  // New field
}
```

---

## Architecture Documentation

### Current Search Data Flow (Internal Console)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ POST /[slug]/[workspaceName]/api/search → Clerk Auth → Workspace → Pinecone│
│      ↓                                                  ↓                  │
│  JSON body                                 resolveWorkspaceByName()        │
│  { query, topK }                           (slug + workspaceName + userId) │
│      ↓                                                  ↓                  │
│  auth() from Clerk                         Fetch workspace config          │
│  Extract userId                            (indexName, namespaceName)      │
│      ↓                                                  ↓                  │
│  Validate request                          createEmbeddingProviderForWorkspace
│  SearchRequestSchema                             (search_query)            │
│                                                        ↓                   │
│                                            pineconeClient.query()          │
│                                             (no filters currently)         │
│                                                        ↓                   │
│                                            Map results to SearchResponse   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proposed Day 2 Search Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ POST /[slug]/[workspaceName]/api/search → Clerk Auth → Filters → Pinecone  │
│      ↓                                                  ↓                  │
│  JSON body with filters                    Build metadata filter from input │
│  { query, topK, filters }                  buildPineconeFilter(filters)     │
│      ↓                                                  ↓                  │
│  Parse filters                             pineconeClient.query({          │
│  (sourceTypes, dateRange)                    vector, topK: topK * 2,       │
│                                              filter: metadataFilter,       │
│                                            })                              │
│                                                        ↓                   │
│                                    ┌─────────────────────────────┐         │
│                                    │ LLM Gating (if >5 results)  │         │
│                                    │ Claude Haiku relevance      │         │
│                                    │ scoring (0.0-1.0)           │         │
│                                    │ Filter below threshold      │         │
│                                    └─────────────────────────────┘         │
│                                                        ↓                   │
│                                    Combine scores:                         │
│                                    finalScore = 0.6*llm + 0.4*vector       │
│                                                        ↓                   │
│                                    Return top K with latency breakdown     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Building Pattern

```typescript
function buildPineconeFilter(filters?: SearchFilters): Record<string, unknown> {
  const pineconeFilter: Record<string, unknown> = {
    layer: { $eq: "observations" },  // Always filter to observations layer
  };

  if (filters?.sourceTypes?.length) {
    pineconeFilter.source = { $in: filters.sourceTypes };
  }

  if (filters?.observationTypes?.length) {
    pineconeFilter.observationType = { $in: filters.observationTypes };
  }

  if (filters?.actorNames?.length) {
    pineconeFilter.actorName = { $in: filters.actorNames };
  }

  if (filters?.dateRange?.start) {
    pineconeFilter.occurredAt = {
      ...pineconeFilter.occurredAt,
      $gte: filters.dateRange.start
    };
  }

  if (filters?.dateRange?.end) {
    pineconeFilter.occurredAt = {
      ...pineconeFilter.occurredAt,
      $lte: filters.dateRange.end
    };
  }

  return pineconeFilter;
}
```

### LLM Gating Pattern

```typescript
async function llmRelevanceFilter(
  query: string,
  candidates: VectorSearchResult[],
  options: { minConfidence: number }
): Promise<ScoredObservation[]> {
  // Skip LLM for small result sets
  if (candidates.length <= 5) {
    return candidates.map(c => ({
      ...c,
      relevanceScore: c.score,
      finalScore: c.score,
    }));
  }

  const llmStart = Date.now();

  const { object } = await generateObject({
    model: anthropic("claude-3-5-haiku-latest"),
    schema: z.object({
      scores: z.array(z.object({
        id: z.string(),
        relevance: z.number().min(0).max(1),
      })),
    }),
    prompt: `Rate each candidate's relevance to the query "${query}":

${candidates.map((c, i) => `${i + 1}. [${c.id}] ${c.metadata.title}: ${c.metadata.snippet}`).join('\n')}

Return a relevance score from 0.0 (irrelevant) to 1.0 (highly relevant) for each.`,
  });

  const llmLatency = Date.now() - llmStart;

  // Build score map
  const scoreMap = new Map(object.scores.map(s => [s.id, s.relevance]));

  // Filter and combine scores
  return candidates
    .map(c => ({
      ...c,
      relevanceScore: scoreMap.get(c.id) ?? 0.5,
      finalScore: 0.6 * (scoreMap.get(c.id) ?? 0.5) + 0.4 * c.score,
    }))
    .filter(c => c.relevanceScore >= options.minConfidence)
    .sort((a, b) => b.finalScore - a.finalScore);
}
```

---

## Code References

### Search Infrastructure
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:70-260` - Internal search endpoint (Clerk auth)
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx` - Console search UI page
- `api/console/src/router/org/search.ts:42-185` - External search endpoint (API key auth, lower priority)

### Pinecone Integration
- `vendor/pinecone/src/types.ts:40-49` - QueryRequest interface
- `vendor/pinecone/src/client.ts:218-244` - Query implementation
- `packages/console-pinecone/src/client.ts:125-131` - Console wrapper

### Embedding
- `packages/console-embed/src/utils.ts:150-160` - createEmbeddingProviderForWorkspace
- `packages/console-config/src/private-config.ts:137-191` - Embedding configuration

### LLM Patterns
- `packages/ai/src/ai/index.ts:1-4` - AI SDK exports
- `packages/cms-workflows/src/workflows/blog.ts:176-180` - generateObject example
- `api/chat/src/inngest/workflow/generate-chat-title.ts:88-101` - generateText example

### Latency/Logging
- `packages/console-types/src/api/common.ts:12-21` - LatencySchema
- `vendor/observability/src/log.ts:1-13` - Logger setup

### Day 1 Implementation
- `api/console/src/inngest/workflow/neural/observation-capture.ts:326-336` - Vector metadata
- `api/console/src/inngest/workflow/neural/scoring.ts:93-134` - Significance scoring
- `api/console/src/inngest/workflow/neural/classification.ts:160-185` - Classification

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2025-12-11-neural-memory-implementation-infrastructure-map.md` - Full infrastructure mapping
- `thoughts/shared/plans/2025-12-11-neural-memory-day1-observations-in.md` - Day 1 implementation plan
- `thoughts/shared/plans/2025-12-12-neural-memory-day2-research-prompt.md` - Day 2 research prompt

---

## Related Research

- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Full E2E architecture spec
- `docs/architecture/plans/neural-memory/phase-07-basic-retrieval.md` - Retrieval phase plan

---

## Implementation Checklist for Day 2

### Target File
`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

### Task 1: Metadata Filters
- [ ] Update `SearchRequestSchema` with filter fields (sourceTypes, observationTypes, dateRange)
- [ ] Create `buildPineconeFilter()` helper function in route file or separate lib
- [ ] Pass filter to `pineconeClient.query()` call at line 201-209
- [ ] Add tests for filter building

### Task 2: LLM Gating (Key 2)
- [ ] Create `apps/console/src/lib/neural/llm-filter.ts` for LLM filtering
- [ ] Define relevance score schema with Zod
- [ ] Implement `llmRelevanceFilter()` function using Claude Haiku
- [ ] Integrate into search route after vector query (after line 209)
- [ ] Add bypass for small result sets (<=5)

### Task 3: Latency Tracking
- [ ] Add `llmFilter` field to SearchResponse latency object (line 231-234)
- [ ] Track LLM filter timing separately
- [ ] Add structured logging for LLM latency
- [ ] Update response types (lines 53-60)

### Task 4: Testing
- [ ] Unit test filter building
- [ ] Mock LLM calls for integration tests
- [ ] Verify latency breakdown in responses

---

## Testing Guide

Use `/debug test search` to run these tests after implementation.

### Test 1: Filter by Source
```json
POST /api/search
{
  "query": "deployment",
  "topK": 10,
  "filters": { "sourceTypes": ["github"] }
}
```
**Expected**: Only observations with `source: "github"` returned.

### Test 2: Filter by Observation Type
```json
{
  "query": "merged PR",
  "topK": 10,
  "filters": { "observationTypes": ["pull_request_merged", "pull_request_closed"] }
}
```
**Expected**: Only PR-related observations returned.

### Test 3: Date Range Filter
```json
{
  "query": "recent activity",
  "topK": 10,
  "filters": { "dateRange": { "start": "2025-12-10" } }
}
```
**Expected**: Only observations with `occurredAt >= 2025-12-10`.

### Test 4: Combined Filters
```json
{
  "query": "fix bug",
  "topK": 20,
  "filters": {
    "sourceTypes": ["github"],
    "observationTypes": ["push", "pull_request_merged"],
    "dateRange": { "start": "2025-12-01", "end": "2025-12-31" }
  }
}
```
**Expected**: GitHub push/PR observations from December 2025.

### Test 5: LLM Gating Threshold
```json
{
  "query": "authentication security",
  "topK": 20
}
```
**Expected**:
- If >5 vector results, LLM gating triggers
- `latency.llmFilter` populated in response
- Low-relevance results filtered out
- Final results sorted by `finalScore` (60% LLM + 40% vector)

### Test 6: LLM Bypass (Small Results)
```json
{
  "query": "very specific unique query xyz123",
  "topK": 5
}
```
**Expected**: ≤5 results bypass LLM gating, `latency.llmFilter` is 0 or absent.

### Test 7: Latency Budget
**Target**: Total latency <500ms for typical queries.

| Component | Budget |
|-----------|--------|
| Embedding | <100ms |
| Pinecone query | <150ms |
| LLM filter | <250ms |

### Verification Checklist
- [ ] Filters reduce result count appropriately
- [ ] Empty filters return all observations
- [ ] Invalid filter values return 400 error
- [ ] LLM gating improves relevance (manual inspection)
- [ ] Latency breakdown accurate in response
- [ ] Structured logs capture all timing

---

## Open Questions

1. **LLM Cost Budget**: How many candidates should we fetch from Pinecone before LLM filtering? (Current proposal: topK * 2)
2. **Relevance Threshold**: What minimum confidence score should filter out candidates? (Proposed: 0.6)
3. **Score Weighting**: Is 60% LLM + 40% vector the right balance?
4. **Caching**: Should we cache LLM relevance scores for identical query/candidate pairs?
5. **Fallback**: What happens if LLM call fails? (Proposed: Fall back to vector-only scoring)

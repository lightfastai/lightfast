# Neural Memory Day 2: Retrieval Infrastructure Implementation Plan

## Overview

Implement Day 2 of the neural memory system: enhanced search with metadata filters, LLM-based relevance gating using GPT-5.1 Instant (or Claude Haiku 4.5), and comprehensive latency tracking. This builds on Day 1's observation capture infrastructure to enable intelligent retrieval.

## Current State Analysis

### Target File
`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

### What Exists
- **Search endpoint** (lines 70-260): Functional with Clerk auth, embedding generation, Pinecone queries
- **Pinecone client** (`vendor/pinecone/src/client.ts:218-244`): Supports `filter` parameter in QueryRequest
- **AI package** (`packages/ai/`): Exports `generateObject` from `ai` SDK and `anthropic` from `@ai-sdk/anthropic`
- **Latency tracking**: Basic `total` and `retrieval` timing (lines 231-234)

### What's Missing
- No `filters` field in `SearchRequestSchema` (line 38-41)
- No filter passthrough to Pinecone query (lines 201-209)
- No LLM relevance filtering
- No `llmFilter` latency tracking

### Day 1 Metadata Available for Filtering
From `observation-capture.ts:326-336`:
| Field | Type | Example Values |
|-------|------|---------------|
| `layer` | string | `"observations"` |
| `observationType` | string | `"push"`, `"pull_request_merged"` |
| `source` | string | `"github"`, `"vercel"` |
| `sourceType` | string | Raw event type |
| `actorName` | string | Actor display name |
| `occurredAt` | string | ISO timestamp |

## Desired End State

After implementation:
1. Search requests accept optional `filters` object with `sourceTypes`, `observationTypes`, `actorNames`, `dateRange`
2. Filters translate to Pinecone MongoDB-style queries
3. Results with >5 candidates pass through GPT-5.1 Instant for relevance scoring
4. Response includes latency breakdown: `{ total, retrieval, llmFilter }`
5. Final scores combine 60% LLM relevance + 40% vector similarity

### Verification
- `POST /api/search` with `filters` returns filtered results
- Large result sets trigger LLM gating (visible in `latency.llmFilter > 0`)
- Small result sets bypass LLM (visible in `latency.llmFilter === 0`)
- Latency totals match sum of components

## What We're NOT Doing

- Caching LLM relevance scores (future optimization)
- Reranking with Cohere (different feature)
- Multi-store/multi-workspace search
- Hybrid keyword + semantic search
- Advanced filter UI (faceted search, saved filters)

---

## Implementation Approach

Four phases, each independently testable:
1. **Metadata Filters** - Add filter schema, build Pinecone filter, pass to query
2. **LLM Gating** - Post-filter with GPT-5.1 Instant, combine scores
3. **Latency Tracking** - Add llmFilter timing, update types, structured logging
4. **Filter UI** - Add filter controls to WorkspaceSearch component for testing

---

## Phase 1: Metadata Filters

### Overview
Enable filtering by source, observation type, actor, and date range at the Pinecone query level.

### Changes Required

#### 1. Update SearchRequestSchema
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
**Location**: Lines 37-41

```typescript
// Add after line 34
const SearchFiltersSchema = z.object({
  sourceTypes: z.array(z.string()).optional(),
  observationTypes: z.array(z.string()).optional(),
  actorNames: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
}).optional();

// Update SearchRequestSchema (lines 38-41)
const SearchRequestSchema = z.object({
  query: z.string().min(1, "Query must not be empty"),
  topK: z.number().int().min(1).max(100).default(10),
  filters: SearchFiltersSchema,
});
```

#### 2. Add buildPineconeFilter helper
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
**Location**: After line 60 (after response types)

```typescript
type SearchFilters = z.infer<typeof SearchFiltersSchema>;

/**
 * Build Pinecone metadata filter from search filters
 * Uses MongoDB-style operators supported by Pinecone
 */
function buildPineconeFilter(filters?: SearchFilters): Record<string, unknown> | undefined {
  if (!filters) return undefined;

  const pineconeFilter: Record<string, unknown> = {
    // Always filter to observations layer
    layer: { $eq: "observations" },
  };

  if (filters.sourceTypes?.length) {
    pineconeFilter.source = { $in: filters.sourceTypes };
  }

  if (filters.observationTypes?.length) {
    pineconeFilter.observationType = { $in: filters.observationTypes };
  }

  if (filters.actorNames?.length) {
    pineconeFilter.actorName = { $in: filters.actorNames };
  }

  if (filters.dateRange?.start || filters.dateRange?.end) {
    const occurredAtFilter: Record<string, string> = {};
    if (filters.dateRange.start) {
      occurredAtFilter.$gte = filters.dateRange.start;
    }
    if (filters.dateRange.end) {
      occurredAtFilter.$lte = filters.dateRange.end;
    }
    pineconeFilter.occurredAt = occurredAtFilter;
  }

  return pineconeFilter;
}
```

#### 3. Update query parsing and logging
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
**Location**: Line 114

```typescript
// Change line 114 from:
const { query, topK } = parseResult.data;

// To:
const { query, topK, filters } = parseResult.data;
```

**Location**: Lines 116-121 (logging)

```typescript
// Update logging to include filters
log.info("Search request validated", {
  requestId,
  userId,
  query,
  topK,
  filters: filters ?? null,
});
```

#### 4. Pass filter to Pinecone query
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
**Location**: Lines 200-209

```typescript
// 6. Query Pinecone
const queryStart = Date.now();
const pineconeFilter = buildPineconeFilter(filters);
const results = await pineconeClient.query<VectorMetadata>(
  workspace.indexName,
  {
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter: pineconeFilter,
  },
  workspace.namespaceName
);
const queryLatency = Date.now() - queryStart;

log.info("Pinecone query complete", {
  requestId,
  queryLatency,
  matchCount: results.matches.length,
  filterApplied: !!pineconeFilter,
});
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles without errors: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`
- [ ] App builds: `pnpm build:console`

#### Manual Verification:
- [ ] Search with no filters returns all observations
- [ ] Search with `sourceTypes: ["github"]` returns only GitHub observations
- [ ] Search with `dateRange.start` filters to recent events
- [ ] Combined filters work (sourceTypes + observationTypes)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that filtering works correctly before proceeding to Phase 2.

---

## Phase 2: LLM Relevance Gating

### Overview
Add GPT-5.1 Instant as a post-retrieval relevance filter to improve result quality by filtering out semantically irrelevant matches. (Alternative: Claude Haiku 4.5)

### Changes Required

#### 1. Create LLM filter module
**File**: `apps/console/src/lib/neural/llm-filter.ts` (NEW FILE)

```typescript
/**
 * LLM-based relevance filtering for neural memory search
 *
 * Uses GPT-5.1 Instant for ultra-fast semantic relevance scoring.
 * Filters out low-relevance results and combines LLM + vector scores.
 */
import { generateObject } from "@repo/ai/ai";
import { openai } from "@ai-sdk/openai";
// import { anthropic } from "@ai-sdk/anthropic"; // Alternative: Claude Haiku 4.5
import { z } from "zod";
import { log } from "@vendor/observability/log";

/** Relevance score schema for LLM output */
const relevanceScoreSchema = z.object({
  scores: z.array(z.object({
    id: z.string().describe("The observation ID"),
    relevance: z.number().min(0).max(1).describe("Relevance score from 0.0 (irrelevant) to 1.0 (highly relevant)"),
  })),
});

/** Input candidate for LLM filtering */
export interface FilterCandidate {
  id: string;
  title: string;
  snippet: string;
  score: number; // Vector similarity score
}

/** Output with combined scores */
export interface ScoredResult extends FilterCandidate {
  relevanceScore: number;  // LLM relevance (0-1)
  finalScore: number;      // Combined score
}

/** LLM filter result */
export interface LLMFilterResult {
  results: ScoredResult[];
  latency: number;
  filtered: number;
  bypassed: boolean;
}

/** Default options for LLM filtering */
const DEFAULT_OPTIONS = {
  minConfidence: 0.4,        // Minimum LLM relevance to keep
  llmWeight: 0.6,            // Weight for LLM score in final
  vectorWeight: 0.4,         // Weight for vector score in final
  bypassThreshold: 5,        // Skip LLM if <= this many results
};

/**
 * Filter search results using GPT-5.1 Instant for relevance scoring
 *
 * @param query - The user's search query
 * @param candidates - Vector search results to filter
 * @param requestId - Request ID for logging
 * @param options - Filter configuration
 */
export async function llmRelevanceFilter(
  query: string,
  candidates: FilterCandidate[],
  requestId: string,
  options: Partial<typeof DEFAULT_OPTIONS> = {}
): Promise<LLMFilterResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Bypass LLM for small result sets
  if (candidates.length <= opts.bypassThreshold) {
    log.info("LLM filter bypassed - small result set", {
      requestId,
      candidateCount: candidates.length,
      threshold: opts.bypassThreshold,
    });

    return {
      results: candidates.map(c => ({
        ...c,
        relevanceScore: c.score, // Use vector score as fallback
        finalScore: c.score,
      })),
      latency: 0,
      filtered: 0,
      bypassed: true,
    };
  }

  const llmStart = Date.now();

  try {
    const { object } = await generateObject({
      model: openai("gpt-5.1-instant"), // Ultra-fast, adaptive reasoning
      // model: anthropic("claude-haiku-4-5-20251001"), // Alternative: Claude Haiku 4.5
      schema: relevanceScoreSchema,
      prompt: buildRelevancePrompt(query, candidates),
      temperature: 0.1, // Low temperature for consistent scoring
    });

    const llmLatency = Date.now() - llmStart;

    log.info("LLM relevance scoring complete", {
      requestId,
      llmLatency,
      candidateCount: candidates.length,
      scoresReturned: object.scores.length,
    });

    // Build score map
    const scoreMap = new Map(object.scores.map(s => [s.id, s.relevance]));

    // Combine scores and filter
    const originalCount = candidates.length;
    const results = candidates
      .map(c => {
        const relevanceScore = scoreMap.get(c.id) ?? 0.5;
        const finalScore = (opts.llmWeight * relevanceScore) + (opts.vectorWeight * c.score);
        return { ...c, relevanceScore, finalScore };
      })
      .filter(c => c.relevanceScore >= opts.minConfidence)
      .sort((a, b) => b.finalScore - a.finalScore);

    const filtered = originalCount - results.length;

    log.info("LLM filter complete", {
      requestId,
      originalCount,
      filteredOut: filtered,
      remainingCount: results.length,
    });

    return {
      results,
      latency: llmLatency,
      filtered,
      bypassed: false,
    };
  } catch (error) {
    const llmLatency = Date.now() - llmStart;

    log.error("LLM relevance filter failed, falling back to vector scores", {
      requestId,
      error,
      llmLatency,
    });

    // Fallback: return original results sorted by vector score
    return {
      results: candidates
        .map(c => ({ ...c, relevanceScore: c.score, finalScore: c.score }))
        .sort((a, b) => b.finalScore - a.finalScore),
      latency: llmLatency,
      filtered: 0,
      bypassed: true, // Mark as bypassed due to error
    };
  }
}

/**
 * Build the relevance scoring prompt for the LLM
 */
function buildRelevancePrompt(query: string, candidates: FilterCandidate[]): string {
  const candidateList = candidates
    .map((c, i) => `${i + 1}. [${c.id}] "${c.title}": ${c.snippet.slice(0, 200)}...`)
    .join("\n");

  return `You are evaluating search results for relevance to a user query.

User Query: "${query}"

Observations to score:
${candidateList}

For each observation, rate its relevance to the query on a scale from 0.0 to 1.0:
- 1.0: Directly answers or highly relevant to the query
- 0.7-0.9: Related and useful context
- 0.4-0.6: Tangentially related
- 0.1-0.3: Barely relevant
- 0.0: Completely irrelevant

Return a score for each observation by its ID.`;
}
```

#### 2. Update search route to use LLM filter
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

**Add import** (after line 34):
```typescript
import { llmRelevanceFilter, type FilterCandidate } from "@/lib/neural/llm-filter";
```

**Update SearchResponse interface** (lines 53-60):
```typescript
interface SearchResponse {
  results: SearchResult[];
  requestId: string;
  latency: {
    total: number;
    retrieval: number;
    llmFilter: number;
  };
}
```

**Add LLM filtering after Pinecone query** (after line 216):
```typescript
// 7. Apply LLM relevance filtering
const candidates: FilterCandidate[] = results.matches.map((match) => ({
  id: match.id,
  title: String(match.metadata?.title ?? ""),
  snippet: String(match.metadata?.snippet ?? ""),
  score: match.score,
}));

const filterResult = await llmRelevanceFilter(query, candidates, requestId);

log.info("LLM filter result", {
  requestId,
  inputCount: candidates.length,
  outputCount: filterResult.results.length,
  filteredOut: filterResult.filtered,
  llmLatency: filterResult.latency,
  bypassed: filterResult.bypassed,
});

// 8. Map results to response format (updated to use filtered results)
const searchResults: SearchResult[] = filterResult.results.map((result) => {
  const match = results.matches.find(m => m.id === result.id);
  return {
    id: result.id,
    title: result.title,
    url: String(match?.metadata?.url ?? ""),
    snippet: result.snippet,
    score: result.finalScore, // Use combined score
    metadata: {
      ...match?.metadata,
      relevanceScore: result.relevanceScore,
      vectorScore: result.score,
    },
  };
});
```

**Update latency response** (lines 228-235):
```typescript
const response: SearchResponse = {
  results: searchResults,
  requestId,
  latency: {
    total: Date.now() - startTime,
    retrieval: queryLatency,
    llmFilter: filterResult.latency,
  },
};
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`
- [ ] App builds: `pnpm build:console`

#### Manual Verification:
- [ ] Search with >5 results shows `latency.llmFilter > 0`
- [ ] Search with ≤5 results shows `latency.llmFilter === 0`
- [ ] Results include `relevanceScore` and `vectorScore` in metadata
- [ ] Results are sorted by `finalScore` (combined)
- [ ] Irrelevant results are filtered out (check result count decreases)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that LLM filtering improves result relevance before proceeding to Phase 3.

---

## Phase 3: Latency Tracking & Types

### Overview
Update shared types and add comprehensive structured logging for latency analysis.

### Changes Required

#### 1. Update LatencySchema
**File**: `packages/console-types/src/api/common.ts`

```typescript
/**
 * Latency breakdown for API responses
 */
export const LatencySchema = z.object({
  total: z.number().nonnegative(),
  retrieval: z.number().nonnegative(),
  llmFilter: z.number().nonnegative().optional(),
  rerank: z.number().nonnegative().optional(),
});

export type Latency = z.infer<typeof LatencySchema>;
```

#### 2. Add summary logging
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

**Update final log** (after line 237):
```typescript
log.info("Search complete", {
  requestId,
  latency: {
    total: response.latency.total,
    embed: embedLatency,
    retrieval: response.latency.retrieval,
    llmFilter: response.latency.llmFilter,
  },
  results: {
    vectorMatches: results.matches.length,
    afterLLMFilter: searchResults.length,
    filtered: filterResult.filtered,
  },
  filters: filters ?? null,
  llmBypassed: filterResult.bypassed,
});
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] All packages build: `pnpm build:console`

#### Manual Verification:
- [ ] Response latency object includes all fields
- [ ] Structured logs capture complete timing breakdown
- [ ] Latency components sum approximately to total

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4 for UI integration.

---

## Phase 4: Filter UI

### Overview
Add filter controls to the `WorkspaceSearch` component to enable testing filters through the UI instead of curl commands.

### Changes Required

#### 1. Update SearchResponse interface
**File**: `apps/console/src/components/workspace-search.tsx`
**Location**: Lines 30-37

```typescript
interface SearchResponse {
  results: SearchResult[];
  requestId: string;
  latency: {
    total: number;
    retrieval: number;
    llmFilter: number;
  };
}
```

#### 2. Add filter state and types
**File**: `apps/console/src/components/workspace-search.tsx`
**Location**: After line 28 (after SearchResponse interface)

```typescript
interface SearchFilters {
  sourceTypes: string[];
  observationTypes: string[];
}

const SOURCE_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
];

const OBSERVATION_TYPE_OPTIONS = [
  { value: "push", label: "Push" },
  { value: "pull_request_opened", label: "PR Opened" },
  { value: "pull_request_merged", label: "PR Merged" },
  { value: "pull_request_closed", label: "PR Closed" },
  { value: "issue_opened", label: "Issue Opened" },
  { value: "issue_closed", label: "Issue Closed" },
  { value: "deployment_succeeded", label: "Deploy Success" },
  { value: "deployment_error", label: "Deploy Error" },
];
```

#### 3. Add filter state to component
**File**: `apps/console/src/components/workspace-search.tsx`
**Location**: After line 58 (after error state)

```typescript
const [filters, setFilters] = useState<SearchFilters>({
  sourceTypes: [],
  observationTypes: [],
});
```

#### 4. Update fetch to include filters
**File**: `apps/console/src/components/workspace-search.tsx`
**Location**: Lines 105-108 (body of fetch)

```typescript
body: JSON.stringify({
  query: query.trim(),
  topK: 20, // Increase to allow LLM filtering
  filters: {
    sourceTypes: filters.sourceTypes.length > 0 ? filters.sourceTypes : undefined,
    observationTypes: filters.observationTypes.length > 0 ? filters.observationTypes : undefined,
  },
}),
```

#### 5. Add filter UI controls
**File**: `apps/console/src/components/workspace-search.tsx`
**Location**: After the search input div (after line 187, before error display)

```typescript
{/* Filter Controls */}
<div className="flex flex-wrap gap-4">
  {/* Source Type Filter */}
  <div className="flex flex-col gap-1">
    <span className="text-xs text-muted-foreground">Sources</span>
    <div className="flex flex-wrap gap-1">
      {SOURCE_TYPE_OPTIONS.map((option) => (
        <Badge
          key={option.value}
          variant={filters.sourceTypes.includes(option.value) ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => {
            setFilters(prev => ({
              ...prev,
              sourceTypes: prev.sourceTypes.includes(option.value)
                ? prev.sourceTypes.filter(s => s !== option.value)
                : [...prev.sourceTypes, option.value],
            }));
          }}
        >
          {option.label}
        </Badge>
      ))}
    </div>
  </div>

  {/* Observation Type Filter */}
  <div className="flex flex-col gap-1">
    <span className="text-xs text-muted-foreground">Event Types</span>
    <div className="flex flex-wrap gap-1">
      {OBSERVATION_TYPE_OPTIONS.map((option) => (
        <Badge
          key={option.value}
          variant={filters.observationTypes.includes(option.value) ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => {
            setFilters(prev => ({
              ...prev,
              observationTypes: prev.observationTypes.includes(option.value)
                ? prev.observationTypes.filter(s => s !== option.value)
                : [...prev.observationTypes, option.value],
            }));
          }}
        >
          {option.label}
        </Badge>
      ))}
    </div>
  </div>

  {/* Clear Filters */}
  {(filters.sourceTypes.length > 0 || filters.observationTypes.length > 0) && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setFilters({ sourceTypes: [], observationTypes: [] })}
      className="self-end"
    >
      Clear filters
    </Button>
  )}
</div>
```

#### 6. Update latency display
**File**: `apps/console/src/components/workspace-search.tsx`
**Location**: Lines 203-209 (results header)

```typescript
{/* Results Header */}
<div className="flex items-center justify-between">
  <p className="text-sm text-muted-foreground">
    {searchResults.results.length} result{searchResults.results.length !== 1 ? "s" : ""} found
    <span className="ml-2 text-xs">
      ({searchResults.latency.total}ms total, {searchResults.latency.retrieval}ms retrieval
      {searchResults.latency.llmFilter > 0 && `, ${searchResults.latency.llmFilter}ms LLM`})
    </span>
  </p>
</div>
```

#### 7. Show relevance scores in results
**File**: `apps/console/src/components/workspace-search.tsx`
**Location**: In `SearchResultCard` component, after the score badge (around line 310)

Add tooltip or secondary badge showing LLM vs vector scores:
```typescript
{/* Score breakdown if available */}
{result.metadata?.relevanceScore !== undefined && (
  <span className="text-xs text-muted-foreground ml-1">
    (LLM: {Math.round((result.metadata.relevanceScore as number) * 100)}%)
  </span>
)}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`
- [ ] App builds: `pnpm build:console`

#### Manual Verification:
- [ ] Filter badges appear below search input
- [ ] Clicking badges toggles filter selection (visual feedback)
- [ ] "Clear filters" button appears when filters active
- [ ] Search with filters returns filtered results
- [ ] Latency breakdown shows retrieval + LLM times
- [ ] Results show LLM relevance scores when available

**Implementation Note**: After completing this phase, all Day 2 features are testable through the UI.

---

## Testing Strategy

### Unit Tests
Add to `apps/console/src/lib/neural/__tests__/llm-filter.test.ts`:
- `buildPineconeFilter` produces correct MongoDB-style filters
- `llmRelevanceFilter` bypasses for small result sets
- `llmRelevanceFilter` handles LLM errors gracefully
- Score combination uses correct weights

### Integration Tests
- Search with filters returns expected subset
- LLM filter improves relevance (manual inspection)
- Latency breakdown is accurate

### Manual Testing Steps (via UI)

1. **Test 1: Filter by Source**
   - Navigate to workspace search page
   - Click "GitHub" badge in Sources filter
   - Search for "deployment"
   - **Expected**: Only observations with GitHub source appear

2. **Test 2: LLM Gating Triggers**
   - Clear all filters
   - Search for "authentication security" (broad query)
   - **Expected**:
     - Latency shows "XXms LLM" in results header
     - Results sorted by combined score (LLM + vector)
     - Results show "(LLM: XX%)" next to score

3. **Test 3: LLM Bypass (Small Results)**
   - Apply multiple restrictive filters (e.g., GitHub + PR Merged)
   - Search for specific unique term
   - **Expected**: Latency shows only "total" and "retrieval" (no LLM time)

4. **Test 4: Combined Filters**
   - Click "GitHub" in Sources
   - Click "Push" and "PR Merged" in Event Types
   - Search for "fix bug"
   - **Expected**: Only GitHub push/PR observations returned

5. **Test 5: Clear Filters**
   - With filters active, click "Clear filters" button
   - Re-run search
   - **Expected**: All observations returned (no filtering)

6. **Test 6: Filter Persistence**
   - Select filters
   - Run search
   - Modify query text
   - Run search again
   - **Expected**: Filters remain selected between searches

---

## Performance Considerations

### Latency Budget
| Component | Target | Notes |
|-----------|--------|-------|
| Embedding | <100ms | Cohere API |
| Pinecone query | <150ms | With filters |
| LLM filter | <300ms | GPT-5.1 Instant |
| **Total** | <500ms | P95 target |

### Cost Estimation
- GPT-5.1 Instant: ~$2.50/1M input tokens, ~$10/1M output tokens
- Per search with 20 candidates: ~500 input tokens, ~100 output tokens
- Estimated cost: ~$0.002 per search with LLM gating
- Alternative (Claude Haiku 4.5): ~$1/1M input, ~$5/1M output → ~$0.001 per search

---

## Open Questions (Resolved)

| Question | Decision | Reasoning |
|----------|----------|-----------|
| How many candidates to fetch before LLM filter? | `topK` (no multiplier) | Start simple, optimize later if needed |
| Minimum relevance threshold? | 0.4 | Conservative to avoid filtering valid results |
| Score weighting? | 60% LLM, 40% vector | Prioritize semantic relevance |
| LLM bypass threshold? | ≤5 results | Avoid LLM cost for small result sets |
| Fallback on LLM error? | Use vector scores | Graceful degradation |

---

## References

- Research document: `thoughts/shared/research/2025-12-12-neural-memory-day2-retrieval-infrastructure.md`
- Day 1 implementation: `api/console/src/inngest/workflow/neural/observation-capture.ts`
- Search route: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
- Search UI component: `apps/console/src/components/workspace-search.tsx`
- Search page: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx`
- Pinecone types: `vendor/pinecone/src/types.ts:40-49`
- AI package: `packages/ai/src/ai/index.ts`

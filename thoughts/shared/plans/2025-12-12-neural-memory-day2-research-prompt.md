# Day 2 Research Prompt: Basic Retrieval (Observations Out)

Use this prompt with `/research-codebase` to map the current search infrastructure before implementing Day 2 features.

---

Research the neural memory retrieval infrastructure for Day 2 implementation.

## Context
Day 1 (observation capture with scoring/classification) is complete. Day 2 focuses on "Observations Out" - making observations queryable with intelligent filtering.

## Research Areas

### 1. Current Search Infrastructure
- Map `api/console/src/router/org/search.ts` - the existing search endpoint
- How does it authenticate? What inputs does it accept?
- How does it interact with Pinecone?
- What's returned to the caller?

### 2. Pinecone Query Patterns
- How does `packages/console-pinecone/src/client.ts` execute queries?
- What metadata filters are supported but not used?
- What's the current namespace strategy?

### 3. Embedding Generation for Queries
- How does `packages/console-embed/` generate query embeddings?
- Difference between `search_document` vs `search_query` input types?

### 4. LLM Integration Patterns
- Find examples of Claude Haiku usage for fast inference
- Look at `packages/cms-workflows/` and `api/chat/` for generateObject/generateText patterns
- How is `@repo/ai` structured for LLM calls?

### 5. tRPC Router Patterns
- How do orgRouter procedures work?
- What's the pattern for adding new endpoints?
- How is workspace context passed through?

### 6. Latency/Metrics Patterns
- Are there existing patterns for tracking operation latency?
- How is logging structured for performance monitoring?

## Output Focus
Document the current state to inform implementation of:
1. Metadata filters in Pinecone queries (source, type, date range)
2. LLM gating layer (post-filter with Claude Haiku)
3. Latency tracking for vector vs LLM times

---

## Day 2 Implementation Goals

| Task | Description |
|------|-------------|
| Metadata Filters | Add filters for source, type, date range to Pinecone queries |
| LLM Gating (Key 2) | Post-filter vector results with Claude Haiku for relevance scoring |
| Latency Tracking | Separate vector search vs LLM filtering times |

## Key Files to Research
- `api/console/src/router/org/search.ts:42-185`
- `packages/console-pinecone/src/client.ts`
- `packages/console-embed/src/utils.ts`
- `packages/cms-workflows/src/workflows/blog.ts` (LLM patterns)
- `api/chat/src/inngest/workflow/generate-chat-title.ts` (LLM patterns)

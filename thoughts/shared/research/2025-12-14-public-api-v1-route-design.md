---
date: 2025-12-14T04:41:24Z
researcher: Claude
git_commit: faa95316a4b934d1f6edac35c7bcd23ffefe1087
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Public API v1 Route Design: search, contents, findsimilar, answer"
tags: [research, api, design, v1, search, contents, findsimilar, answer, exa-patterns]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Public API v1 Route Design

**Date**: 2025-12-14T04:41:24Z
**Researcher**: Claude
**Git Commit**: faa95316a4b934d1f6edac35c7bcd23ffefe1087
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

With the neural memory 4-path parallel retrieval with 2-key search designed for `/v1/search`, how should we design all four public API routes (`/v1/search`, `/v1/contents`, `/v1/findsimilar`, `/v1/answer`) using Exa's API as a reference pattern?

## Summary

This research defines the complete design for Lightfast's four public API endpoints, drawing from:
1. **Exa's proven API patterns** (search, contents, findSimilar, answer)
2. **Lightfast's 4-path parallel retrieval** (vector, entity, cluster, actor)
3. **Existing implementation patterns** (tRPC, API key auth, type schemas)

### Route Overview

| Endpoint | Purpose | Input | Output | Complexity |
|----------|---------|-------|--------|------------|
| `POST /v1/search` | Discover relevant content | Query string | Ranked results | Medium (4-path retrieval) |
| `POST /v1/contents` | Fetch full documents | Document IDs | Full content | Low (DB lookup) |
| `POST /v1/findsimilar` | Find related documents | Document ID | Similar documents | Medium (vector similarity) |
| `POST /v1/answer` | Generate answers | Query + context | LLM response + citations | High (search + LLM) |

---

## Design: POST /v1/search

### Purpose

**Discovery endpoint**: Find relevant documents, observations, and entities matching a query. Returns ranked results with scores and optional context enrichment.

### Key Design Decisions

1. **Use 4-path parallel retrieval** (already designed):
   - Path 1: Vector similarity (Pinecone)
   - Path 2: Entity exact-match (PlanetScale)
   - Path 3: Cluster context (Pinecone centroids)
   - Path 4: Actor profiles (PlanetScale)

2. **Optional LLM relevance filtering** (2-key search):
   - Bypassed for small result sets (≤5 results)
   - Weighted combination: `0.6 * llmScore + 0.4 * vectorScore`

3. **Response layers** (like Exa's `contents` option):
   - Default: Return snippets only (fast)
   - Optional: Include context enrichment (clusters, actors)
   - Optional: Include full text (use `/v1/contents` for batch)

### Request Schema

```typescript
// POST /v1/search
interface SearchRequest {
  // Required
  query: string;                    // Min 1 char

  // Pagination
  limit?: number;                   // Default: 10, max: 100
  offset?: number;                  // Default: 0

  // Result options
  includeHighlights?: boolean;      // Default: true - matched text snippets
  includeRationale?: boolean;       // Default: false - LLM ranking explanation
  includeContext?: boolean;         // Default: false - clusters + actors

  // Filtering
  filters?: {
    sources?: string[];             // ["github", "linear", "vercel"]
    types?: string[];               // ["issue", "pr", "deployment"]
    actors?: string[];              // Actor display names
    dateRange?: {
      start?: string;               // ISO 8601
      end?: string;                 // ISO 8601
    };
    labels?: string[];              // Document labels
  };

  // Search mode
  mode?: "fast" | "balanced" | "thorough";  // Default: "balanced"
  // fast = vector only, balanced = 4-path, thorough = 4-path + LLM filter
}
```

### Response Schema

```typescript
interface SearchResponse {
  // Results
  data: Array<{
    id: string;                     // Document/observation ID
    title: string;
    url: string;                    // Source URL
    snippet: string;                // Matched text (200 chars)
    score: number;                  // Final combined score (0-1)

    // Optional fields
    highlights?: string[];          // Matched phrases
    rationale?: string;             // LLM explanation

    // Metadata
    source: string;                 // "github" | "linear" | etc.
    type: string;                   // "issue" | "pr" | etc.
    occurredAt: string;             // ISO 8601

    // Entity connections (if found via entity path)
    entities?: Array<{
      key: string;                  // "@sarah", "#123"
      category: string;             // "engineer", "project"
    }>;
  }>;

  // Context enrichment (if includeContext: true)
  context?: {
    clusters: Array<{
      topic: string;
      summary: string;
      keywords: string[];
    }>;
    actors: Array<{
      displayName: string;
      expertise: string[];
      recentActivity: string;
    }>;
  };

  // Metadata
  meta: {
    total: number;                  // Total matches (estimate)
    limit: number;
    offset: number;
    took: number;                   // Total latency (ms)
    mode: string;                   // Actual mode used
    paths: {                        // Per-path metrics
      vector: { count: number; took: number };
      entity: { count: number; took: number };
      cluster: { count: number; took: number };
      actor: { count: number; took: number };
      llmFilter?: { filtered: number; took: number };
    };
  };

  requestId: string;
}
```

### Implementation Notes

```typescript
// Route: apps/console/src/app/(api)/v1/search/route.ts

export async function POST(request: NextRequest) {
  // 1. Auth via API key
  const auth = await withApiKeyAuth(request);

  // 2. Validate request
  const body = SearchRequestSchema.parse(await request.json());

  // 3. Execute search based on mode
  const results = body.mode === "fast"
    ? await vectorOnlySearch(...)
    : await fourPathParallelSearch(...);

  // 4. Optional LLM filtering (thorough mode)
  const filtered = body.mode === "thorough"
    ? await llmRelevanceFilter(results, body.query)
    : results;

  // 5. Return response
  return NextResponse.json({ data: filtered, meta: {...}, requestId });
}
```

### Differences from Exa

| Aspect | Exa | Lightfast |
|--------|-----|-----------|
| **Data source** | Web crawl | Workspace knowledge (GitHub, Linear, etc.) |
| **Entity search** | No | Yes (4-path retrieval) |
| **Actor context** | No | Yes (who worked on what) |
| **Cluster context** | No | Yes (topic groupings) |
| **Search modes** | neural/fast/deep | fast/balanced/thorough |
| **Content inline** | Yes (contents option) | No (use /v1/contents) |

---

## Design: POST /v1/contents

### Purpose

**Content retrieval endpoint**: Fetch full document content by IDs. Batch-optimized for retrieving multiple documents after search.

### Key Design Decisions

1. **ID-based retrieval** (not URL-based like Exa):
   - Lightfast IDs are stable references
   - URLs may change or be inaccessible

2. **Support both documents and observations**:
   - `doc_*` IDs → `workspaceKnowledgeDocuments`
   - `obs_*` IDs → `workspaceNeuralObservations`

3. **Include relationships**:
   - `references` → What this document links to
   - `referencedBy` → What links to this document

### Request Schema

```typescript
// POST /v1/contents
interface ContentsRequest {
  // Required
  ids: string[];                    // Min: 1, Max: 50

  // Options
  includeRelationships?: boolean;   // Default: false
  format?: "markdown" | "text" | "html";  // Default: "markdown"
  maxLength?: number;               // Truncate content (chars)
}
```

### Response Schema

```typescript
interface ContentsResponse {
  documents: Array<{
    id: string;
    path: string;                   // File path or source path
    title: string | null;
    description: string | null;
    content: string;                // Full content in requested format

    // Metadata
    source: string;                 // "github" | "linear" | etc.
    type: string;                   // "issue" | "pr" | "document"
    committedAt: string;            // ISO 8601

    // Extended metadata (from frontmatter/sourceMetadata)
    metadata: Record<string, unknown>;

    // Relationships (if includeRelationships: true)
    relationships?: {
      references: Array<{
        id: string;
        title: string;
        type: string;
      }>;
      referencedBy: Array<{
        id: string;
        title: string;
        type: string;
      }>;
    };
  }>;

  // Missing IDs (not found or no access)
  missing: string[];

  requestId: string;
}
```

### Implementation Notes

```typescript
// Route: apps/console/src/app/(api)/v1/contents/route.ts

export async function POST(request: NextRequest) {
  const auth = await withApiKeyAuth(request);
  const body = ContentsRequestSchema.parse(await request.json());

  // Separate document IDs from observation IDs
  const docIds = body.ids.filter(id => id.startsWith("doc_"));
  const obsIds = body.ids.filter(id => id.startsWith("obs_"));

  // Fetch in parallel
  const [documents, observations] = await Promise.all([
    fetchDocuments(auth.workspaceId, docIds),
    fetchObservations(auth.workspaceId, obsIds),
  ]);

  // Optional: fetch relationships
  if (body.includeRelationships) {
    await enrichWithRelationships(documents);
  }

  return NextResponse.json({
    documents: [...documents, ...observations],
    missing: findMissingIds(body.ids, documents, observations),
    requestId,
  });
}
```

### Differences from Exa

| Aspect | Exa | Lightfast |
|--------|-----|-----------|
| **Input** | URLs | Document IDs |
| **Live crawl** | Yes | No (pre-indexed) |
| **Highlights** | Yes (LLM-extracted) | No (use search highlights) |
| **Summaries** | Yes (LLM-generated) | No (use /v1/answer) |
| **Relationships** | No | Yes (references graph) |

---

## Design: POST /v1/findsimilar

### Purpose

**Similarity endpoint**: Given a document, find semantically similar content. Use cases:
- "Find related issues"
- "What else discusses this topic?"
- "Duplicate detection"

### Key Design Decisions

1. **Document-centric** (not query-centric):
   - Takes document ID as input
   - Uses document's embedding for similarity
   - Different from search (which embeds a query string)

2. **Multi-layer similarity**:
   - Vector similarity (primary)
   - Entity overlap (secondary boost)
   - Cluster membership (tertiary context)

3. **Exclude source document**:
   - Never return the input document in results

### Request Schema

```typescript
// POST /v1/findsimilar
interface FindSimilarRequest {
  // Required (one of)
  id?: string;                      // Document/observation ID
  url?: string;                     // Source URL (resolved to ID)

  // Pagination
  limit?: number;                   // Default: 10, max: 50

  // Similarity options
  threshold?: number;               // Min similarity score (0-1), default: 0.5
  sameSourceOnly?: boolean;         // Only from same source type, default: false
  excludeIds?: string[];            // IDs to exclude from results

  // Filtering
  filters?: {
    sources?: string[];
    types?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
  };

  // Include content preview
  includeSnippets?: boolean;        // Default: true
}
```

### Response Schema

```typescript
interface FindSimilarResponse {
  // Input document summary
  source: {
    id: string;
    title: string;
    type: string;
    cluster?: {
      topic: string;
      memberCount: number;
    };
  };

  // Similar documents
  similar: Array<{
    id: string;
    title: string;
    url: string;
    snippet?: string;

    // Similarity metrics
    score: number;                  // Overall similarity (0-1)
    vectorSimilarity: number;       // Embedding cosine similarity
    entityOverlap?: number;         // Shared entities ratio
    sameCluster: boolean;           // In same topic cluster

    // Metadata
    source: string;
    type: string;
    occurredAt: string;
  }>;

  meta: {
    total: number;
    took: number;
    inputEmbedding: {
      found: boolean;
      generated: boolean;           // True if had to generate new
    };
  };

  requestId: string;
}
```

### Implementation Algorithm

```typescript
// Route: apps/console/src/app/(api)/v1/findsimilar/route.ts

export async function POST(request: NextRequest) {
  const auth = await withApiKeyAuth(request);
  const body = FindSimilarRequestSchema.parse(await request.json());

  // 1. Resolve input document
  const sourceDoc = body.id
    ? await fetchDocument(body.id)
    : await resolveByUrl(body.url);

  // 2. Get or generate embedding
  const embedding = sourceDoc.embedding
    ?? await generateEmbedding(sourceDoc.content);

  // 3. Query Pinecone for similar vectors
  const vectorResults = await pinecone.query({
    vector: embedding,
    topK: body.limit * 2,  // Over-fetch for filtering
    filter: buildFilters(body.filters),
  });

  // 4. Exclude source document
  const filtered = vectorResults.filter(r => r.id !== sourceDoc.id);

  // 5. Optional: Boost by entity overlap
  if (sourceDoc.entities?.length > 0) {
    await boostByEntityOverlap(filtered, sourceDoc.entities);
  }

  // 6. Check cluster membership
  const enriched = await enrichWithClusterInfo(filtered, sourceDoc.clusterId);

  // 7. Apply threshold and limit
  const final = enriched
    .filter(r => r.score >= body.threshold)
    .slice(0, body.limit);

  return NextResponse.json({
    source: { id: sourceDoc.id, title: sourceDoc.title, ... },
    similar: final,
    meta: { ... },
    requestId,
  });
}
```

### Differences from Exa

| Aspect | Exa | Lightfast |
|--------|-----|-----------|
| **Input** | URL only | ID or URL |
| **Source** | Web pages | Workspace documents |
| **Entity boost** | No | Yes |
| **Cluster context** | No | Yes |
| **Content fetch** | Optional (contents param) | No (use /v1/contents) |

---

## Design: POST /v1/answer

### Purpose

**Answer generation endpoint**: Combines search with LLM synthesis to provide direct answers with citations. Use cases:
- "What caused the production outage last week?"
- "Summarize the authentication system architecture"
- "What are Sarah's recent contributions?"

### Key Design Decisions

1. **Search-then-synthesize** (like Exa):
   - First: Run /v1/search internally
   - Then: LLM generates answer from results
   - Finally: Return answer + citations

2. **Streaming support**:
   - SSE format for real-time responses
   - Chunked answer + final citations

3. **Citation linking**:
   - Every claim should cite a source
   - Citations link to document IDs

4. **Context modes**:
   - `concise`: Direct answer (1-2 sentences)
   - `detailed`: Comprehensive explanation
   - `summary`: Structured summary with sections

### Request Schema

```typescript
// POST /v1/answer
interface AnswerRequest {
  // Required
  query: string;                    // The question to answer

  // Answer options
  mode?: "concise" | "detailed" | "summary";  // Default: "detailed"
  stream?: boolean;                 // Default: false

  // Search options (passed to internal search)
  searchOptions?: {
    limit?: number;                 // Sources to consider (default: 10)
    filters?: {
      sources?: string[];
      types?: string[];
      dateRange?: { start?: string; end?: string };
    };
  };

  // Context injection
  context?: string;                 // Additional context to consider
  systemPrompt?: string;            // Custom system instructions

  // Conversation history (for follow-ups)
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}
```

### Response Schema (Non-Streaming)

```typescript
interface AnswerResponse {
  // The generated answer
  answer: string;

  // Supporting evidence
  citations: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string;                // Relevant excerpt
    relevance: number;              // How relevant to the answer (0-1)
  }>;

  // Confidence and quality
  confidence: number;               // Answer confidence (0-1)
  quality: {
    sourceCoverage: number;         // How well sources cover the query
    citationDensity: number;        // Claims per citation
    answerCompleteness: number;     // Query aspects addressed
  };

  // Metadata
  meta: {
    mode: string;
    searchResults: number;          // Sources considered
    tokensUsed: number;
    took: number;
    model: string;                  // LLM used
  };

  requestId: string;
}
```

### Response Schema (Streaming - SSE)

```typescript
// Event types for streaming
type AnswerStreamEvent =
  | { type: "start"; requestId: string }
  | { type: "chunk"; content: string }
  | { type: "citation"; citation: Citation }
  | { type: "done"; meta: AnswerMeta; confidence: number };

// SSE format:
// data: {"type":"start","requestId":"abc123"}
// data: {"type":"chunk","content":"Based on the"}
// data: {"type":"chunk","content":" GitHub issues,"}
// data: {"type":"citation","citation":{"id":"doc_x","title":"..."}}
// data: {"type":"chunk","content":" the outage was caused by..."}
// data: {"type":"done","meta":{...},"confidence":0.85}
```

### Implementation Algorithm

```typescript
// Route: apps/console/src/app/(api)/v1/answer/route.ts

export async function POST(request: NextRequest) {
  const auth = await withApiKeyAuth(request);
  const body = AnswerRequestSchema.parse(await request.json());

  // 1. Run internal search
  const searchResults = await internalSearch({
    query: body.query,
    limit: body.searchOptions?.limit ?? 10,
    filters: body.searchOptions?.filters,
    mode: "thorough",  // Always use LLM filtering for answers
  });

  // 2. Build context from results
  const context = buildAnswerContext(searchResults.data);

  // 3. Generate answer
  if (body.stream) {
    return streamAnswer(body, context, searchResults);
  } else {
    return generateFullAnswer(body, context, searchResults);
  }
}

async function generateFullAnswer(body, context, searchResults) {
  const { text, citations } = await generateObject({
    model: gateway("anthropic/claude-sonnet-4-20250514"),
    schema: AnswerWithCitationsSchema,
    prompt: buildAnswerPrompt(body, context),
    system: body.systemPrompt ?? DEFAULT_ANSWER_SYSTEM_PROMPT,
  });

  // Map citation indices to full citation objects
  const enrichedCitations = mapCitations(citations, searchResults.data);

  // Calculate confidence
  const confidence = calculateConfidence(text, enrichedCitations);

  return NextResponse.json({
    answer: text,
    citations: enrichedCitations,
    confidence,
    quality: calculateQuality(text, enrichedCitations, body.query),
    meta: { ... },
    requestId,
  });
}

async function streamAnswer(body, context, searchResults) {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Start event
  await writer.write(encoder.encode(
    `data: ${JSON.stringify({ type: "start", requestId })}\n\n`
  ));

  // Stream generation
  const { textStream } = await streamObject({
    model: gateway("anthropic/claude-sonnet-4-20250514"),
    schema: AnswerWithCitationsSchema,
    prompt: buildAnswerPrompt(body, context),
  });

  for await (const chunk of textStream) {
    if (chunk.type === "text-delta") {
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: "chunk", content: chunk.textDelta })}\n\n`
      ));
    } else if (chunk.type === "citation") {
      const citation = mapCitation(chunk.citationIndex, searchResults.data);
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: "citation", citation })}\n\n`
      ));
    }
  }

  // Done event
  await writer.write(encoder.encode(
    `data: ${JSON.stringify({ type: "done", meta: {...}, confidence })}\n\n`
  ));

  await writer.close();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### Answer Prompt Structure

```typescript
const DEFAULT_ANSWER_SYSTEM_PROMPT = `
You are a helpful assistant answering questions about a software team's work.
Your answers are based ONLY on the provided context documents.

Rules:
1. Cite sources using [1], [2], etc. format
2. If information is missing, say "Based on the available information..."
3. Be specific and reference actual events, people, and decisions
4. For mode "concise": 1-2 sentences max
5. For mode "detailed": Comprehensive but focused
6. For mode "summary": Use markdown headers and bullet points
`;

function buildAnswerPrompt(body, context) {
  return `
## Question
${body.query}

## Available Sources
${context.map((doc, i) => `
[${i + 1}] ${doc.title}
Source: ${doc.source} | Type: ${doc.type} | Date: ${doc.occurredAt}
---
${doc.content}
---
`).join('\n')}

## Instructions
Answer the question using ONLY the sources above.
Mode: ${body.mode}
${body.context ? `Additional context: ${body.context}` : ''}
`;
}
```

### Differences from Exa

| Aspect | Exa | Lightfast |
|--------|-----|-----------|
| **Sources** | Web search | Workspace knowledge |
| **Citation format** | Full results | ID + snippet |
| **Conversation** | No | Yes (history param) |
| **Custom prompts** | No | Yes (systemPrompt) |
| **Quality metrics** | No | Yes (confidence, coverage) |
| **Streaming** | Yes | Yes |

---

## Implementation Roadmap

### Phase 1: Core Routes (Week 1)

1. **Create route group**: `apps/console/src/app/(api)/v1/`
2. **Implement auth middleware**: `withApiKeyAuth()`
3. **Implement `/v1/search`**:
   - Reuse existing 4-path retrieval
   - Add mode selection (fast/balanced/thorough)
   - Add context enrichment option
4. **Enhance `/v1/contents`**:
   - Support observation IDs
   - Add relationship fetching

### Phase 2: Similarity & Answer (Week 2)

5. **Implement `/v1/findsimilar`**:
   - Document embedding lookup
   - Pinecone similarity query
   - Entity overlap boosting
6. **Implement `/v1/answer`**:
   - Search-then-synthesize flow
   - Non-streaming version first
   - Citation mapping

### Phase 3: Streaming & Polish (Week 3)

7. **Add streaming to `/v1/answer`**:
   - SSE implementation
   - Chunked citations
8. **Add rate limiting**:
   - Per-endpoint limits
   - Workspace quotas
9. **Documentation**:
   - Update MDX docs
   - SDK examples

---

## Type Schema Files to Create

### 1. packages/console-types/src/api/search.ts (Update)

```typescript
// Add mode and context options
export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  includeHighlights: z.boolean().default(true),
  includeRationale: z.boolean().default(false),
  includeContext: z.boolean().default(false),
  mode: z.enum(["fast", "balanced", "thorough"]).default("balanced"),
  filters: SearchFiltersSchema.optional(),
});
```

### 2. packages/console-types/src/api/findsimilar.ts (New)

```typescript
export const FindSimilarRequestSchema = z.object({
  id: z.string().optional(),
  url: z.string().url().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.5),
  sameSourceOnly: z.boolean().default(false),
  excludeIds: z.array(z.string()).optional(),
  filters: SearchFiltersSchema.optional(),
  includeSnippets: z.boolean().default(true),
}).refine(data => data.id || data.url, {
  message: "Either 'id' or 'url' is required",
});
```

### 3. packages/console-types/src/api/answer.ts (New)

```typescript
export const AnswerRequestSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(["concise", "detailed", "summary"]).default("detailed"),
  stream: z.boolean().default(false),
  searchOptions: z.object({
    limit: z.number().int().min(1).max(20).default(10),
    filters: SearchFiltersSchema.optional(),
  }).optional(),
  context: z.string().optional(),
  systemPrompt: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
});
```

---

## Code References

### Existing Implementation
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:1-495` - Internal 4-path search
- `api/console/src/router/org/search.ts:1-187` - tRPC search endpoint
- `api/console/src/router/org/contents.ts:1-135` - tRPC contents endpoint
- `api/console/src/trpc.ts:530-576` - API key procedure

### Neural Memory Components
- `apps/console/src/lib/neural/entity-search.ts:71-150` - Entity search
- `apps/console/src/lib/neural/cluster-search.ts:19-94` - Cluster search
- `apps/console/src/lib/neural/actor-search.ts:41-140` - Actor search
- `apps/console/src/lib/neural/llm-filter.ts:66-162` - LLM relevance filtering

### Type Definitions
- `packages/console-types/src/api/search.ts:1-64` - Search schemas
- `packages/console-types/src/api/contents.ts:1-53` - Contents schemas
- `packages/console-types/src/api/common.ts:1-33` - Common schemas

### Documentation
- `apps/docs/src/content/api/search.mdx` - Search API docs
- `apps/docs/src/content/api/contents.mdx` - Contents API docs
- `apps/docs/src/content/api/answer.mdx` - Answer API docs
- `apps/docs/src/content/api/similar.mdx` - Similar API docs

---

## Related Research

- `thoughts/shared/research/2025-12-14-neural-memory-api-search-mcp-integration.md` - API integration overview
- `thoughts/shared/research/2025-12-11-neural-memory-implementation-map.md` - Neural memory architecture
- `thoughts/shared/plans/2025-12-13-neural-memory-day5.md` - Implementation plan

---

## External References

- [Exa API Documentation](https://docs.exa.ai/reference/getting-started) - Reference API patterns
- [Exa Search Endpoint](https://docs.exa.ai/reference/search) - Search design patterns
- [Exa Contents Endpoint](https://docs.exa.ai/reference/get-contents) - Contents design patterns
- [Exa FindSimilar Endpoint](https://docs.exa.ai/reference/find-similar-links) - Similarity patterns
- [Exa Answer Endpoint](https://docs.exa.ai/reference/answer) - Answer generation patterns

---

## Open Questions

1. **Rate limiting strategy**: Should limits be per-endpoint or unified? Consider `/v1/answer` being more expensive than `/v1/search`.

2. **Caching**: Should we cache search results? If so, what invalidation strategy?

3. **Cost tracking**: Should we expose cost metrics like Exa (`costDollars`)? This would help users optimize usage.

4. **Batch operations**: Should `/v1/search` support batch queries for efficiency?

5. **Webhook integration**: Should `/v1/answer` support webhook callbacks for long-running queries instead of only streaming?

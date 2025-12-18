---
title: 'Search API, Hybrid Retrieval, Cross-Encoder Reranking'
slug: 0-3-lightfast-search-api-hybrid-retrieval
publishedAt: '2025-12-15'
excerpt: >-
  Public Search API with four-path hybrid retrieval combining vector similarity,
  entity matching, cluster context, and actor profiles. Three reranking modes
  (fast/balanced/thorough) let you tune quality vs latency.
tldr: >-
  Lightfast now offers a production-ready Search API at POST /v1/search with
  hybrid retrieval that goes beyond simple vector search. The four-path
  architecture combines semantic vectors with entity pattern matching, topic
  clusters, and contributor profiles for comprehensive results. Choose from fast
  mode (vector-only), balanced mode (Cohere rerank-v3.5), or thorough mode
  (Claude Haiku semantic scoring) to optimize for your latency and quality
  requirements.
improvements:
  - >-
    Entity search extracts @mentions, #issues, and API endpoints from queries
    for precise matching
  - Cluster search provides topic context from workspace knowledge clusters
  - Actor search surfaces relevant contributors based on expertise domains
infrastructure:
  - New @repo/console-rerank package with pluggable provider architecture
  - >-
    Latency breakdown tracking for all search paths (embedding, vector, entity,
    cluster, actor, rerank)
  - Dual authentication support (API key or session) for flexible integration
seo:
  metaDescription: >-
    Lightfast Search API with four-path hybrid retrieval and cross-encoder
    reranking. Vector search + entity matching with Cohere and LLM reranking
    modes.
  focusKeyword: semantic code search
  secondaryKeyword: hybrid retrieval
  faq:
    - question: What is hybrid retrieval in Lightfast Search?
      answer: >-
        Hybrid retrieval combines four search strategies: vector similarity for
        semantic matching, entity extraction for @mentions and #issues, cluster
        search for topic context, and actor search for contributor expertise.
        Results are merged and scored to provide comprehensive search results.
    - question: How do I choose a reranking mode?
      answer: >-
        Use 'fast' mode for lowest latency with vector scores only. Use
        'balanced' mode (default) for Cohere rerank-v3.5 cross-encoder reranking
        at ~130ms. Use 'thorough' mode for Claude Haiku semantic scoring when
        quality matters most.
    - question: What authentication does the Search API support?
      answer: >-
        The /v1/search endpoint supports both API key authentication via Bearer
        token and session-based authentication. Include your API key in the
        Authorization header and workspace ID in X-Workspace-ID.
_internal:
  status: published
  source_prs:
    - 'Manual input: Search API, Hybrid Retrieval, Cross-Encoder Reranking'
  generated: '2025-12-17T14:30:22Z'
  fact_checked_files:
    - 'apps/console/src/app/(api)/v1/search/route.ts:1-295'
    - apps/console/src/lib/neural/four-path-search.ts
    - apps/console/src/lib/neural/entity-search.ts
    - apps/console/src/lib/neural/cluster-search.ts
    - apps/console/src/lib/neural/actor-search.ts
    - 'packages/console-rerank/src/types.ts:1-158'
    - packages/console-rerank/src/factory.ts
    - packages/console-rerank/src/providers/cohere.ts
    - packages/console-rerank/src/providers/llm.ts
    - packages/console-rerank/src/providers/passthrough.ts
    - packages/console-types/src/api/v1/search.ts
  publishedAt: '2025-12-18T06:25:30.649Z'
---

**Public Search API with hybrid retrieval and cross-encoder reranking for semantic code search**

---

### Search API

Perform semantic code search across your workspace's neural memory through a production-ready REST API. The `/v1/search` endpoint accepts natural language queries and returns ranked results with full metadata, entity extraction, and contextual information.

**What's included:**
- POST `/v1/search` endpoint with Bearer token or session authentication
- Pagination via `limit` and `offset` parameters (1-100 results per page)
- Optional filters by source, type, and date range
- Response includes latency breakdown for performance monitoring
- Activity tracking for search analytics

**Example:**
```bash
curl -X POST https://lightfast.ai/v1/search \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Workspace-ID: $WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication flow for OAuth providers",
    "limit": 10,
    "mode": "balanced"
  }'
```

---

### Four-Path Hybrid Retrieval

Our approach to semantic code search combines four parallel retrieval strategies for comprehensive coverage. Unlike simple vector search, hybrid retrieval captures both semantic similarity and structured patterns.

**What's included:**
- **Vector Path**: Pinecone semantic search using query embeddings
- **Entity Path**: Pattern extraction for @mentions, #issues, API endpoints, and project references
- **Cluster Path**: Topic-based context from workspace knowledge clusters
- **Actor Path**: Contributor relevance based on expertise domains and activity

**Score fusion strategy:**
- Vector results form the base with semantic similarity scores
- Entity matches boost confirmed results by +0.2
- New entity-only matches receive 0.85 × confidence score
- Results merged and sorted by combined score

The entity search uses regex-based extraction rather than traditional BM25 keyword search, optimized for developer-centric patterns like `@engineer`, `#123`, and `/api/endpoint`.

---

### Cross-Encoder Reranking

Three reranking modes let you tune the quality/latency tradeoff. Pass the `mode` parameter to select your strategy.

**Modes:**

| Mode | Provider | Latency | Use Case |
|------|----------|---------|----------|
| `fast` | Passthrough | ~0ms | Real-time autocomplete, high-volume queries |
| `balanced` | Cohere rerank-v3.5 | ~130ms | Default for most search use cases |
| `thorough` | Claude Haiku 4.5 | ~300-500ms | When precision matters most |

**How it works:**
- Search over-fetches candidates (2× limit) for reranking
- Reranker scores each candidate against the query
- `balanced` mode uses Cohere's cross-encoder model via API
- `thorough` mode uses LLM semantic scoring with 60% LLM weight + 40% vector weight
- Results filtered by relevance threshold (0.4 for thorough mode)

**Example with mode selection:**
```typescript
const response = await fetch('/v1/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'X-Workspace-ID': workspaceId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'database migration patterns',
    limit: 10,
    mode: 'thorough', // Use LLM reranking
    includeContext: true
  })
});

const { data, context, latency } = await response.json();
// latency.rerank shows reranking time
// context.clusters shows relevant topics
// context.relevantActors shows domain experts
```

---

### Response Structure

The API returns structured results with optional context and detailed latency metrics.

**Example response:**
```json
{
  "data": [
    {
      "id": "obs_abc123",
      "title": "Implement OAuth2 PKCE flow",
      "url": "https://github.com/org/repo/pull/42",
      "snippet": "Added PKCE support for OAuth2...",
      "score": 0.89,
      "source": "github",
      "type": "pull_request",
      "entities": ["@auth-team", "#security"]
    }
  ],
  "context": {
    "clusters": [
      { "topic": "Authentication", "keywords": ["oauth", "jwt", "session"] }
    ],
    "relevantActors": [
      { "displayName": "Alice", "expertiseDomains": ["auth", "security"] }
    ]
  },
  "latency": {
    "total": 245,
    "embedding": 45,
    "retrieval": 82,
    "entitySearch": 12,
    "rerank": 98,
    "maxParallel": 82
  }
}
```

---

### Resources

- [Search API Reference](/docs/api-reference/search)
- [Authentication Guide](/docs/api-reference/authentication)
- [SDK Documentation](/docs/integrate/sdk)
- [Search Feature Guide](/docs/features/search)

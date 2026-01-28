---
date: 2025-01-22T00:00:00+08:00
researcher: Claude
git_commit: 3eb47a9ebe6ac7c82b8d0155e1eda87424bb4dc6
branch: main
repository: lightfast
topic: "Docs Search System Architecture and Mixedbread Upgrade Analysis"
tags: [research, codebase, apps-docs, search, mixedbread, embeddings, cohere]
status: complete
last_updated: 2025-01-22
last_updated_by: Claude
---

# Research: Docs Search System Architecture and Mixedbread Upgrade Analysis

**Date**: 2025-01-22
**Researcher**: Claude
**Git Commit**: 3eb47a9ebe6ac7c82b8d0155e1eda87424bb4dc6
**Branch**: main
**Repository**: lightfast

## Research Question

Understanding the current search system in apps/docs and evaluating a potential upgrade to mixedbread for the search system.

## Summary

The apps/docs search system uses a **custom implementation** that bypasses Fumadocs' built-in search. The current flow is:

1. **Client Component** (`apps/docs/src/components/search.tsx`) - Custom search dialog with debouncing, caching, and keyboard navigation
2. **API Route** (`apps/docs/src/app/(docs)/docs/api/search/route.ts`) - Edge function that proxies to Lightfast API
3. **Lightfast API** (`api/console/src/router/org/search.ts`) - tRPC procedure using **Cohere embeddings** + **Pinecone vector search**

Currently, the system uses:
- **Embeddings**: Cohere `embed-english-v3.0` (1024 dimensions)
- **Vector Search**: Pinecone serverless (cosine similarity)
- **Reranking**: Configured but not yet implemented in search route

**Mixedbread** offers an alternative with:
- Open-source models (Apache 2.0)
- Competitive MTEB scores (64.68 vs OpenAI's 64.58)
- Binary embedding support (32x storage savings)
- Dedicated reranking models with RLHF training

## Detailed Findings

### Current Search Architecture

#### 1. Client-Side Search Component

**File**: `apps/docs/src/components/search.tsx` (448 lines)

**Features**:
- Radix Dialog-based search UI
- 300ms debouncing before API calls
- In-memory cache with 60s TTL, max 50 entries
- Request cancellation for race condition handling
- Keyboard navigation (⌘K, Arrow keys, Enter, Escape)

**Data Flow**:
```
User Input → Debounce (300ms) → Cache Check → Fetch /docs/api/search → Display Results
```

#### 2. API Route (Edge Runtime)

**File**: `apps/docs/src/app/(docs)/docs/api/search/route.ts`

**Behavior**:
- POSTs to `${LIGHTFAST_API_URL}/v1/search` with Bearer token
- Falls back to mock results when `LIGHTFAST_API_KEY` not configured
- Transforms API response to client-expected format

**Request/Response**:
```typescript
// Request to Lightfast API
{
  query: string,
  limit: 10,
  workspace?: string
}

// Response from Lightfast API
{
  results: [{
    id, title, description, url, snippet, score, source, highlights
  }]
}
```

#### 3. Lightfast Search API Backend

**File**: `api/console/src/router/org/search.ts:42-185`

**Current Pipeline**:
1. API key authentication via `apiKeyProcedure`
2. Fetch workspace embedding config from database
3. Generate query embedding via Cohere
4. Query Pinecone index with cosine similarity
5. Return top-K results with metadata

**Embedding Configuration** (from workspace settings):
- Provider: `cohere`
- Model: `embed-english-v3.0`
- Dimension: 1024
- Index: `lightfast-v1`
- Namespace: `org_{clerkOrgId}:ws_{workspaceId}`

### Current Embedding Provider: Cohere

**Configuration File**: `packages/console-config/src/private-config.ts:145-201`

| Setting | Value |
|---------|-------|
| Provider | `cohere` |
| Model | `embed-english-v3.0` |
| Dimension | 1024 |
| Batch Size | 96 (API limit) |
| Input Types | `search_query`, `search_document` |

**Reranking Configuration** (not yet implemented in search route):
- Model: `rerank-v3.5`
- Threshold: 0.4
- Latency: ~130ms

### Mixedbread Alternative

**API Base URL**: `https://api.mixedbread.com/`

**Embedding Models**:
| Model | Context | Dims | MTEB | Notes |
|-------|---------|------|------|-------|
| `mxbai-embed-large-v1` | 512 tokens | 1024 | 64.68 | Flagship, outperforms OpenAI |
| `mxbai-embed-2d-large-v1` | 512 tokens | 1024 | 63.25 | Flexible dimension truncation |
| `mxbai-embed-xsmall-v1` | 4096 tokens | 384 | 42.80 | Long context, compact |

**Reranking Models**:
| Model | Context | BEIR@3 | Latency |
|-------|---------|--------|---------|
| `mxbai-rerank-large-v2` | 32K tokens | 57.49 | 0.89s |
| `mxbai-rerank-base-v2` | 32K tokens | 55.57 | Faster |
| `mxbai-rerank-large-v1` | 512 tokens | - | Fastest |

**Key Differentiators from Cohere**:
1. **Open Source**: Apache 2.0 license, can self-host
2. **Binary Embeddings**: 32x storage savings, 40x faster retrieval
3. **Matryoshka Learning**: Truncate dimensions (1024→256) with minimal loss
4. **Specialized Rerankers**: RLHF-trained for code, e-commerce, multilingual

### Configuration Points for Upgrade

#### 1. Workspace Settings Schema

**File**: `db/console/src/schema/tables/org-workspaces.ts:69-92`

```typescript
{
  version: 1,
  embedding: {
    indexName: "lightfast-v1",
    namespaceName: "{clerkOrgId}:ws_{workspaceId}",
    embeddingDim: 1024,
    embeddingModel: "embed-english-v3.0",  // ← Change to mixedbread model
    embeddingProvider: "cohere",            // ← Change to "mixedbread"
    pineconeMetric: "cosine",
    chunkMaxTokens: 512,
    chunkOverlap: 50
  }
}
```

#### 2. Embedding Provider Factory

**File**: `packages/console-embed/src/utils.ts:150-160`

Currently creates Cohere client; would need mixedbread integration.

#### 3. Private Config

**File**: `packages/console-config/src/private-config.ts:145-201`

Environment variable: `MIXEDBREAD_API_KEY` (new)

### Fumadocs Integration Note

**File**: `apps/docs/src/app/layout.tsx:18`

Fumadocs built-in search is explicitly disabled (`enabled: false`). The system uses Orama as a transitive dependency but doesn't utilize it—search is entirely handled by the custom implementation calling Lightfast API.

## Code References

- `apps/docs/src/components/search.tsx:56` - Main Search component
- `apps/docs/src/app/(docs)/docs/api/search/route.ts:47` - Search API route POST handler
- `api/console/src/router/org/search.ts:42` - tRPC search procedure
- `packages/console-embed/src/utils.ts:150` - Embedding provider factory
- `packages/console-config/src/private-config.ts:162` - Cohere embedding config
- `db/console/src/schema/tables/org-workspaces.ts:92` - Workspace settings schema

## Architecture Documentation

### Search Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  apps/docs                                                                  │
│  ┌──────────────────────┐    ┌─────────────────────────────────────────┐   │
│  │ search.tsx (Client)  │───▶│ /docs/api/search/route.ts (Edge)        │   │
│  │ - Debounce 300ms     │    │ - Bearer auth                           │   │
│  │ - Cache 60s TTL      │    │ - Mock fallback                         │   │
│  │ - Request cancel     │    └─────────────────┬───────────────────────┘   │
│  └──────────────────────┘                      │                            │
└────────────────────────────────────────────────┼────────────────────────────┘
                                                 │ POST /v1/search
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  api/console                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ router/org/search.ts                                                 │   │
│  │ ┌─────────────┐    ┌─────────────┐    ┌──────────────────────────┐  │   │
│  │ │ API Key Auth│───▶│ Cohere Embed│───▶│ Pinecone Query           │  │   │
│  │ │             │    │ (1024 dims) │    │ (cosine, topK, namespace)│  │   │
│  │ └─────────────┘    └─────────────┘    └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Embedding Provider Abstraction

```typescript
// packages/console-embed/src/utils.ts
createEmbeddingProviderForWorkspace(config) → EmbeddingClient
  - Reads workspace settings
  - Currently: Cohere client
  - Future: Could dispatch to mixedbread based on embeddingProvider field
```

## Historical Context (from thoughts/)

**Relevant Documents**:
- `thoughts/changelog/search-api-hybrid-retrieval-cross-encoder-20251217-143022.md` - Documents four-path hybrid retrieval architecture with cross-encoder reranking
- `thoughts/shared/research/2025-12-16-workspace-embedding-config-population.md` - Workspace embedding configuration population research
- `thoughts/blog/how-vector-search-works-20251221-161532.md` - Educational content on vector search mechanics

**Note**: No existing documents specifically about mixedbread integration were found.

## Open Questions

1. **Dimension Compatibility**: Current Pinecone index uses 1024 dimensions. Mixedbread's `mxbai-embed-large-v1` also uses 1024—direct swap possible?

2. **Migration Strategy**: How to handle existing embeddings in Pinecone? Options:
   - Dual-write during transition
   - Full re-index with new provider
   - Separate namespace for new embeddings

3. **Cost Comparison**: No pricing data retrieved—need to compare Cohere vs Mixedbread costs for production volume.

4. **Self-Hosting**: Mixedbread models are open-source. Worth considering self-hosting for cost/latency optimization?

5. **Binary Embeddings**: Mixedbread's 32x storage savings with binary embeddings could significantly reduce Pinecone costs. Does the ~4% accuracy loss matter for docs search?

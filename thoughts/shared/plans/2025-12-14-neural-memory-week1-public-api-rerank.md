---
date: 2025-12-14T05:21:17Z
researcher: Claude
git_commit: 5bc0bf4322d8d478b2ad6311f812804741137ec8
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Week 1: Public API Routes + Rerank Implementation"
tags: [plan, neural-memory, public-api, rerank, v1-routes, week1]
status: in_progress
last_updated: 2025-12-14
last_updated_by: Claude
---

# Plan: Neural Memory Week 1 - Public API Routes + Rerank

**Date**: 2025-12-14T05:21:17Z
**Researcher**: Claude
**Git Commit**: 5bc0bf4322d8d478b2ad6311f812804741137ec8
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Overview

This document outlines the Week 1 implementation plan for Neural Memory's P0 priority: **Public API Routes + Rerank**. The goal is to expose the existing 4-path neural memory retrieval system via public REST endpoints with production-quality ranking.

### Week 1 Goal

> External clients can search neural memory with API key authentication, using a mode-based reranking system (fast/balanced/thorough).

### Daily Breakdown

| Day | Focus | Deliverables |
|-----|-------|--------------|
| **Day 1** | Rerank Package | `packages/console-rerank/` with Cohere + LLM providers |
| **Day 2** | Search Route | `POST /v1/search` with mode parameter |
| **Day 3** | Contents + FindSimilar | `POST /v1/contents` + `POST /v1/findsimilar` |
| **Day 4** | Integration | API key middleware wrapper, workspace config, E2E testing |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Public API Routes                                  │
│  apps/console/src/app/(api)/v1/                                             │
│  ├── search/route.ts      POST /v1/search                                   │
│  ├── contents/route.ts    POST /v1/contents                                 │
│  └── findsimilar/route.ts POST /v1/findsimilar                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API Key Authentication                               │
│  apps/console/src/lib/api/with-api-key-auth.ts                              │
│  ├── Extracts Authorization: Bearer <token>                                  │
│  ├── Extracts X-Workspace-ID header                                         │
│  └── Validates via verifyApiKey() from api/console/src/trpc.ts:530-576      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          4-Path Parallel Retrieval                           │
│  apps/console/.../api/search/route.ts (existing internal route)             │
│  ├── Path 1: Vector similarity (Pinecone)                                   │
│  ├── Path 2: Entity search (PlanetScale)                                    │
│  ├── Path 3: Cluster context (Pinecone centroids)                           │
│  └── Path 4: Actor profiles (PlanetScale)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Rerank Layer (NEW)                                │
│  packages/console-rerank/                                                    │
│  ├── src/providers/cohere.ts     Cohere rerank-v3.5                         │
│  ├── src/providers/llm.ts        LLM-based (refactored from llm-filter.ts)  │
│  ├── src/factory.ts              Mode-based provider selection              │
│  └── src/types.ts                RerankProvider interface                   │
│                                                                              │
│  Mode Selection:                                                             │
│  ├── fast     → No rerank (vector scores only) ~50ms                        │
│  ├── balanced → Cohere rerank-v3.5 ~130ms                                   │
│  └── thorough → Cohere + LLM refinement ~600ms                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Day 1: Rerank Package

### Objective

Create `packages/console-rerank/` with a unified reranking abstraction supporting Cohere Rerank and LLM-based refinement.

### Key Files to Create

```
packages/console-rerank/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── src/
    ├── index.ts               # Main exports
    ├── types.ts               # RerankProvider interface
    ├── factory.ts             # createRerankProvider(mode)
    └── providers/
        ├── cohere.ts          # Cohere rerank-v3.5
        ├── llm.ts             # LLM-based (GPT-5.1 Instant)
        └── passthrough.ts     # No-op for "fast" mode
```

### Reference Files

| Purpose | File Path |
|---------|-----------|
| Package pattern | `packages/console-pinecone/` |
| Provider pattern | `vendor/embed/src/provider/cohere.ts` |
| LLM filter (refactor) | `apps/console/src/lib/neural/llm-filter.ts:66-162` |
| Cohere SDK pattern | `vendor/embed/src/provider/cohere.ts:1-80` |

### Type Definitions

```typescript
// packages/console-rerank/src/types.ts

export interface RerankCandidate {
  id: string;
  title: string;
  content: string;     // Full text or snippet
  score: number;       // Original vector score
}

export interface RerankResult {
  id: string;
  score: number;       // Reranked score (0-1)
  relevance: number;   // Provider-specific relevance
}

export interface RerankResponse {
  results: RerankResult[];
  latency: number;
  provider: string;    // "cohere" | "llm" | "passthrough"
}

export interface RerankProvider {
  readonly name: string;
  rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions
  ): Promise<RerankResponse>;
}

export interface RerankOptions {
  topK?: number;           // Max results to return
  threshold?: number;      // Min score threshold
  returnOriginalRanking?: boolean;
}

export type RerankMode = "fast" | "balanced" | "thorough";
```

### Factory Implementation

```typescript
// packages/console-rerank/src/factory.ts

import type { RerankMode, RerankProvider } from "./types";
import { CohereRerankProvider } from "./providers/cohere";
import { LLMRerankProvider } from "./providers/llm";
import { PassthroughRerankProvider } from "./providers/passthrough";

export function createRerankProvider(mode: RerankMode): RerankProvider {
  switch (mode) {
    case "fast":
      return new PassthroughRerankProvider();
    case "balanced":
      return new CohereRerankProvider();
    case "thorough":
      return new ChainedRerankProvider([
        new CohereRerankProvider(),
        new LLMRerankProvider(),
      ]);
    default:
      throw new Error(`Unknown rerank mode: ${mode}`);
  }
}
```

### Cohere Provider Implementation

```typescript
// packages/console-rerank/src/providers/cohere.ts

import { CohereClient } from "cohere-ai";
import type { RerankProvider, RerankCandidate, RerankResponse, RerankOptions } from "../types";

export class CohereRerankProvider implements RerankProvider {
  readonly name = "cohere";
  private client: CohereClient;
  private model: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.client = new CohereClient({
      token: config?.apiKey ?? process.env.COHERE_API_KEY,
    });
    this.model = config?.model ?? "rerank-v3.5";
  }

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions
  ): Promise<RerankResponse> {
    const start = Date.now();

    const response = await this.client.rerank({
      model: this.model,
      query,
      documents: candidates.map(c => ({
        text: `${c.title}\n\n${c.content}`,
      })),
      topN: options?.topK ?? candidates.length,
      returnDocuments: false,
    });

    const results = response.results.map(r => ({
      id: candidates[r.index].id,
      score: r.relevanceScore,
      relevance: r.relevanceScore,
    }));

    // Apply threshold if specified
    const filtered = options?.threshold
      ? results.filter(r => r.score >= options.threshold)
      : results;

    return {
      results: filtered,
      latency: Date.now() - start,
      provider: this.name,
    };
  }
}
```

### Research Prompt for Day 1

```markdown
/research-codebase

Research question: Document all existing patterns for creating rerank/reorder functionality in the codebase. Focus on:

1. **LLM Filter Implementation**: Analyze `apps/console/src/lib/neural/llm-filter.ts` in detail:
   - How it processes candidates
   - Prompt structure for relevance scoring
   - Score combination logic (0.6 * llm + 0.4 * vector)
   - Bypass threshold logic
   - Error handling and fallback

2. **Cohere SDK Usage**: Find all uses of cohere-ai package:
   - Initialization patterns
   - API key handling
   - Error handling patterns

3. **Package Creation Pattern**: Document the exact structure of:
   - `packages/console-pinecone/` - package.json, tsconfig, exports
   - `vendor/embed/` - provider pattern, factory functions

4. **Configuration Pattern**: How are provider settings stored:
   - Workspace-level config in `org_workspaces` table
   - Default values in `packages/console-config/src/private-config.ts`

Output: Technical map of all code locations and patterns needed to implement `packages/console-rerank/`.
```

---

## Day 2: /v1/search Route

### Objective

Implement `POST /v1/search` with mode-based reranking, building on the existing internal 4-path retrieval.

### Key Files to Create/Modify

```
apps/console/src/app/(api)/v1/
├── search/
│   └── route.ts              # POST /v1/search (NEW)
└── lib/
    └── with-api-key-auth.ts  # API key middleware (NEW)

packages/console-types/src/api/
├── search.ts                  # Update with mode param
└── v1/
    └── search.ts              # v1-specific schemas (NEW)
```

### Reference Files

| Purpose | File Path |
|---------|-----------|
| Internal search route | `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:1-495` |
| API key auth | `api/console/src/trpc.ts:530-576` |
| Search schemas | `packages/console-types/src/api/search.ts` |
| Design spec | `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md:44-201` |

### Route Implementation Outline

```typescript
// apps/console/src/app/(api)/v1/search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withApiKeyAuth } from "../lib/with-api-key-auth";
import { V1SearchRequestSchema, V1SearchResponseSchema } from "@repo/console-types/api/v1/search";
import { createRerankProvider } from "@repo/console-rerank";
import { fourPathParallelSearch } from "@/lib/neural/four-path-search";

export async function POST(request: NextRequest) {
  // 1. Authenticate via API key
  const authResult = await withApiKeyAuth(request);
  if (authResult.error) {
    return NextResponse.json(authResult.error, { status: authResult.status });
  }
  const { workspaceId, userId, apiKeyId } = authResult.auth;

  // 2. Parse and validate request
  const body = await request.json();
  const parsed = V1SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }
  const { query, limit, offset, mode, filters, includeContext, includeHighlights } = parsed.data;

  // 3. Execute 4-path parallel retrieval
  const searchResults = await fourPathParallelSearch({
    workspaceId,
    query,
    topK: limit * 2, // Over-fetch for reranking
    filters,
  });

  // 4. Apply reranking based on mode
  const reranker = createRerankProvider(mode);
  const reranked = await reranker.rerank(query, searchResults.candidates, {
    topK: limit,
    threshold: mode === "thorough" ? 0.4 : undefined,
  });

  // 5. Apply offset/limit pagination
  const paginated = reranked.results.slice(offset, offset + limit);

  // 6. Optional: Enrich with context
  const context = includeContext
    ? await fetchContextEnrichment(searchResults.clusters, searchResults.actors)
    : undefined;

  // 7. Build response
  return NextResponse.json({
    data: paginated.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      score: r.score,
      highlights: includeHighlights ? r.highlights : undefined,
      source: r.source,
      type: r.type,
      occurredAt: r.occurredAt,
      entities: r.entities,
    })),
    context,
    meta: {
      total: searchResults.total,
      limit,
      offset,
      took: searchResults.took + reranked.latency,
      mode,
      paths: searchResults.paths,
    },
    requestId: generateRequestId(),
  });
}
```

### Research Prompt for Day 2

```markdown
/research-codebase

Research question: Document the exact implementation of the internal search route to understand how to extract reusable components for the public API. Focus on:

1. **Internal Search Route**: Analyze `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`:
   - Request parsing and validation
   - 4-path parallel retrieval execution (lines 320-380)
   - Result merging logic (lines 375-379)
   - LLM filter integration (line 382)
   - Response building (lines 394-435)
   - Error handling patterns

2. **Auth Extraction**: How to adapt API key verification from tRPC to Next.js route handlers:
   - `api/console/src/trpc.ts:530-576` - apiKeyProcedure
   - Headers required: Authorization, X-Workspace-ID
   - verifyApiKey() function location and signature

3. **Neural Search Utilities**: Document the utility functions that can be reused:
   - `apps/console/src/lib/neural/entity-search.ts:71-150`
   - `apps/console/src/lib/neural/cluster-search.ts:19-94`
   - `apps/console/src/lib/neural/actor-search.ts:41-140`

4. **Search Schemas**: Current type definitions to extend:
   - `packages/console-types/src/api/search.ts:1-64`

Output: Implementation map for creating `/v1/search` route with rerank integration.
```

---

## Day 3: /v1/contents + /v1/findsimilar

### Objective

Implement the content retrieval and similarity search endpoints.

### Key Files to Create

```
apps/console/src/app/(api)/v1/
├── contents/
│   └── route.ts              # POST /v1/contents
└── findsimilar/
    └── route.ts              # POST /v1/findsimilar

packages/console-types/src/api/v1/
├── contents.ts               # Contents schemas
└── findsimilar.ts            # FindSimilar schemas
```

### Reference Files

| Purpose | File Path |
|---------|-----------|
| tRPC contents | `api/console/src/router/org/contents.ts:1-135` |
| Design spec | `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md:204-323` |
| Pinecone query | `packages/console-pinecone/src/client.ts` |
| Entity search | `apps/console/src/lib/neural/entity-search.ts` |

### /v1/contents Implementation Outline

```typescript
// apps/console/src/app/(api)/v1/contents/route.ts

export async function POST(request: NextRequest) {
  const authResult = await withApiKeyAuth(request);
  if (authResult.error) return authResult.errorResponse;

  const body = await request.json();
  const { ids, includeRelationships, format, maxLength } = ContentsRequestSchema.parse(body);

  // Separate by ID prefix
  const docIds = ids.filter(id => id.startsWith("doc_"));
  const obsIds = ids.filter(id => id.startsWith("obs_"));

  // Fetch in parallel
  const [documents, observations] = await Promise.all([
    docIds.length > 0 ? fetchDocuments(authResult.auth.workspaceId, docIds) : [],
    obsIds.length > 0 ? fetchObservations(authResult.auth.workspaceId, obsIds) : [],
  ]);

  // Optional: Fetch relationships
  const enriched = includeRelationships
    ? await enrichWithRelationships([...documents, ...observations])
    : [...documents, ...observations];

  // Format content
  const formatted = formatContent(enriched, format, maxLength);

  // Find missing IDs
  const foundIds = new Set(formatted.map(d => d.id));
  const missing = ids.filter(id => !foundIds.has(id));

  return NextResponse.json({
    documents: formatted,
    missing,
    requestId: generateRequestId(),
  });
}
```

### /v1/findsimilar Implementation Outline

```typescript
// apps/console/src/app/(api)/v1/findsimilar/route.ts

export async function POST(request: NextRequest) {
  const authResult = await withApiKeyAuth(request);
  if (authResult.error) return authResult.errorResponse;

  const body = await request.json();
  const { id, url, limit, threshold, filters, includeSnippets } = FindSimilarRequestSchema.parse(body);

  // 1. Resolve source document
  const sourceDoc = id
    ? await fetchDocument(authResult.auth.workspaceId, id)
    : await resolveByUrl(authResult.auth.workspaceId, url);

  if (!sourceDoc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // 2. Get or generate embedding
  const embedding = sourceDoc.embedding ?? await generateEmbedding(sourceDoc.content);

  // 3. Query Pinecone for similar vectors
  const pineconeResults = await pineconeClient.query({
    indexName: `workspace-${authResult.auth.workspaceId}`,
    vector: embedding,
    topK: limit * 2, // Over-fetch for filtering
    filter: buildPineconeFilters(filters),
  });

  // 4. Exclude source document
  const filtered = pineconeResults.matches.filter(m => m.id !== sourceDoc.id);

  // 5. Apply threshold
  const thresholded = filtered.filter(m => m.score >= threshold);

  // 6. Limit results
  const limited = thresholded.slice(0, limit);

  // 7. Enrich with metadata and snippets
  const enriched = await enrichSimilarResults(limited, includeSnippets);

  return NextResponse.json({
    source: {
      id: sourceDoc.id,
      title: sourceDoc.title,
      type: sourceDoc.type,
      cluster: sourceDoc.cluster,
    },
    similar: enriched,
    meta: {
      total: thresholded.length,
      took: Date.now() - startTime,
      inputEmbedding: {
        found: !!sourceDoc.embedding,
        generated: !sourceDoc.embedding,
      },
    },
    requestId: generateRequestId(),
  });
}
```

### Research Prompt for Day 3

```markdown
/research-codebase

Research question: Document the existing content retrieval and similarity search patterns needed for /v1/contents and /v1/findsimilar. Focus on:

1. **Content Retrieval**: Analyze existing tRPC contents implementation:
   - `api/console/src/router/org/contents.ts:1-135` - Current implementation
   - Database queries for workspaceKnowledgeDocuments
   - Database queries for workspaceNeuralObservations
   - How content is formatted (markdown, text, html)

2. **Similarity Search**: Document Pinecone query patterns:
   - `packages/console-pinecone/src/client.ts` - Query interface
   - `vendor/pinecone/src/client.ts` - Raw client
   - How embeddings are stored and retrieved
   - Filter syntax for Pinecone metadata

3. **Embedding Generation**: How to generate embeddings on-demand:
   - `packages/console-embed/src/utils.ts` - createEmbeddingProvider
   - `vendor/embed/src/provider/cohere.ts` - Cohere embedding

4. **Relationship Queries**: How to find document relationships:
   - `sourceReferences` field in observations
   - Entity connections between documents

Output: Implementation map for /v1/contents and /v1/findsimilar routes.
```

---

## Day 4: Integration & Testing

### Objective

Create the API key middleware wrapper, add workspace rerank configuration, and perform end-to-end testing.

### Key Files to Create/Modify

```
apps/console/src/app/(api)/v1/lib/
└── with-api-key-auth.ts      # API key middleware wrapper

db/console/src/schema/tables/
└── org-workspaces.ts         # Add rerankProvider, rerankModel, rerankThreshold

packages/console-validation/src/schemas/
└── rerank.ts                 # Rerank validation schemas (NEW)

packages/console-config/src/
└── private-config.ts         # Add RERANK_CONFIG defaults
```

### API Key Middleware Implementation

```typescript
// apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@db/console";
import { userApiKeys } from "@db/console/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { hashApiKey } from "@repo/console-api-key/crypto";

export interface ApiKeyAuth {
  workspaceId: string;
  userId: string;
  apiKeyId: string;
}

export interface AuthResult {
  auth?: ApiKeyAuth;
  error?: { error: string; message: string };
  status?: number;
}

export async function withApiKeyAuth(request: NextRequest): Promise<AuthResult & { errorResponse?: NextResponse }> {
  // 1. Extract Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    const error = { error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" };
    return { error, status: 401, errorResponse: NextResponse.json(error, { status: 401 }) };
  }

  const token = authHeader.slice(7);

  // 2. Extract X-Workspace-ID header
  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    const error = { error: "BAD_REQUEST", message: "Missing X-Workspace-ID header" };
    return { error, status: 400, errorResponse: NextResponse.json(error, { status: 400 }) };
  }

  // 3. Hash and verify API key
  const keyHash = await hashApiKey(token);
  const apiKey = await db.query.userApiKeys.findFirst({
    where: and(
      eq(userApiKeys.keyHash, keyHash),
      eq(userApiKeys.isActive, true),
      // Not expired
      or(
        isNull(userApiKeys.expiresAt),
        gt(userApiKeys.expiresAt, new Date())
      )
    ),
  });

  if (!apiKey) {
    const error = { error: "UNAUTHORIZED", message: "Invalid or expired API key" };
    return { error, status: 401, errorResponse: NextResponse.json(error, { status: 401 }) };
  }

  // 4. Update lastUsedAt (non-blocking)
  db.update(userApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiKeys.id, apiKey.id))
    .then(() => {})
    .catch(() => {});

  return {
    auth: {
      workspaceId,
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
    },
  };
}
```

### Workspace Configuration

```typescript
// Add to db/console/src/schema/tables/org-workspaces.ts

// Add columns (requires migration)
rerankProvider: varchar("rerank_provider", { length: 50 }).default("cohere"),
rerankModel: varchar("rerank_model", { length: 100 }).default("rerank-v3.5"),
rerankThreshold: real("rerank_threshold").default(0.4),
rerankMode: varchar("rerank_mode", { length: 20 }).default("balanced"),
```

```typescript
// Add to packages/console-config/src/private-config.ts

export const RERANK_CONFIG = {
  cohere: {
    model: "rerank-v3.5",
    threshold: 0.4,
  },
  llm: {
    model: "gpt-5.1-instant",
    weight: 0.6,
    vectorWeight: 0.4,
    bypassThreshold: 5,
  },
  defaults: {
    provider: "cohere" as const,
    mode: "balanced" as const,
  },
} as const;
```

### Testing Checklist

- [ ] API key authentication works with valid key
- [ ] API key authentication fails with invalid key
- [ ] API key authentication fails with expired key
- [ ] X-Workspace-ID header is required
- [ ] /v1/search returns results with mode=fast
- [ ] /v1/search returns reranked results with mode=balanced
- [ ] /v1/search returns LLM-refined results with mode=thorough
- [ ] /v1/contents fetches documents by ID
- [ ] /v1/contents fetches observations by ID
- [ ] /v1/contents handles missing IDs gracefully
- [ ] /v1/findsimilar finds similar documents
- [ ] /v1/findsimilar excludes source document
- [ ] Workspace rerank config is applied

### Research Prompt for Day 4

```markdown
/research-codebase

Research question: Document all integration points and testing patterns needed to finalize the public API routes. Focus on:

1. **API Key Verification**: Complete analysis of existing verification:
   - `api/console/src/trpc.ts:790-850` - verifyApiKey() implementation
   - `packages/console-api-key/src/crypto.ts` - hashApiKey() function
   - Database schema for userApiKeys table

2. **Workspace Configuration**: How provider settings are stored:
   - `db/console/src/schema/tables/org-workspaces.ts` - Current columns
   - Migration pattern from `db/console/src/migrations/`
   - How to add rerankProvider, rerankModel, rerankThreshold

3. **Testing Patterns**: Existing test infrastructure:
   - `packages/console-test-data/` - Test data utilities
   - E2E testing patterns in the codebase
   - How to test API routes

4. **Error Handling**: Standard error response patterns:
   - tRPC error codes and messages
   - NextResponse error patterns
   - Logging patterns

Output: Final integration checklist for Week 1 public API implementation.
```

---

## Success Criteria

### Week 1 Complete When:

1. **Package Created**: `packages/console-rerank/` is functional with Cohere + LLM providers
2. **Routes Working**: `/v1/search`, `/v1/contents`, `/v1/findsimilar` accept requests
3. **Auth Implemented**: API key authentication via `withApiKeyAuth()` middleware
4. **Modes Working**: Search mode parameter controls rerank behavior (fast/balanced/thorough)
5. **Config Stored**: Workspace-level rerank settings in database
6. **Latency Targets**:
   - `fast` mode: < 100ms
   - `balanced` mode: < 200ms
   - `thorough` mode: < 800ms

### Metrics to Track

- API key verification latency
- Rerank provider latency by mode
- Total search latency by mode
- Error rates by endpoint

---

## Code References

### Existing Implementation

| Component | File Path | Lines |
|-----------|-----------|-------|
| Internal search route | `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts` | 1-495 |
| API key procedure | `api/console/src/trpc.ts` | 530-576 |
| API key verification | `api/console/src/trpc.ts` | 790-850 |
| LLM filter | `apps/console/src/lib/neural/llm-filter.ts` | 66-162 |
| Entity search | `apps/console/src/lib/neural/entity-search.ts` | 71-150 |
| Cluster search | `apps/console/src/lib/neural/cluster-search.ts` | 19-94 |
| Actor search | `apps/console/src/lib/neural/actor-search.ts` | 41-140 |
| tRPC search router | `api/console/src/router/org/search.ts` | 1-186 |
| tRPC contents router | `api/console/src/router/org/contents.ts` | 1-134 |

### Package Patterns

| Component | File Path |
|-----------|-----------|
| Console package pattern | `packages/console-pinecone/` |
| Vendor provider pattern | `vendor/embed/src/provider/cohere.ts` |
| Private config | `packages/console-config/src/private-config.ts` |
| Workspace schema | `db/console/src/schema/tables/org-workspaces.ts` |
| API key crypto | `packages/console-api-key/src/crypto.ts` |

### Type Definitions

| Component | File Path |
|-----------|-----------|
| Search schemas | `packages/console-types/src/api/search.ts` |
| Contents schemas | `packages/console-types/src/api/contents.ts` |
| Common schemas | `packages/console-types/src/api/common.ts` |
| Store schemas | `packages/console-validation/src/schemas/store.ts` |

---

## Related Documents

- `thoughts/shared/research/2025-12-14-neural-memory-production-priority-analysis.md` - Production roadmap
- `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md` - Complete API design
- `thoughts/shared/research/2025-12-14-neural-memory-api-search-mcp-integration.md` - Integration architecture

---

## Open Questions for Implementation

1. **Cohere API Key**: Where should the Cohere API key be stored? Environment variable or workspace config?

2. **Rate Limiting**: Should rate limiting be implemented in Week 1 or deferred?

3. **Caching**: Should Cohere rerank results be cached for identical query+candidates?

4. **Fallback**: If Cohere fails, should we fallback to LLM-only or passthrough?

5. **Workspace Config UI**: Should workspace rerank settings be exposed in settings page in Week 1?

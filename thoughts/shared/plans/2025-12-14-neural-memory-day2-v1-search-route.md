# Day 2 Implementation Plan: POST /v1/search Route

## Overview

Implement the public `POST /v1/search` route with API key authentication and mode-based reranking. This route exposes the existing 4-path neural memory retrieval system via a REST endpoint for external clients.

## Current State Analysis

### Existing Components (Ready to Use)

| Component | Status | Location |
|-----------|--------|----------|
| **Internal search route** | Complete | `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts` (494 lines) |
| **Rerank package** | Complete | `packages/console-rerank/` with Cohere, LLM, Passthrough providers |
| **API key verification** | Complete | `api/console/src/trpc.ts:790-845` (verifyApiKey function) |
| **hashApiKey utility** | Complete | `packages/console-api-key/src/crypto.ts:65-71` |
| **Search type schemas** | Partial | `packages/console-types/src/api/search.ts` (missing mode, v1 fields) |

### What's Missing

1. **V1 route handler**: `apps/console/src/app/(api)/v1/search/route.ts`
2. **API key middleware wrapper**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`
3. **V1 search schemas**: Extended schemas with `mode` parameter and v1-specific response fields
4. **Reusable 4-path search function**: Extract from internal route for reuse

### Key Discoveries

- The internal search route at `apps/console/...api/search/route.ts:324-359` implements 4-path parallel retrieval
- API key auth uses `Authorization: Bearer <token>` + `X-Workspace-ID` headers
- The rerank package factory at `packages/console-rerank/src/factory.ts:35-48` already supports fast/balanced/thorough modes
- Internal route uses Clerk session auth (`auth()` from `@clerk/nextjs/server`) - v1 needs API key auth

## Desired End State

After this plan is complete:

1. External clients can call `POST /v1/search` with an API key
2. The `mode` parameter controls reranking behavior (fast/balanced/thorough)
3. Response includes search results, context, and latency metrics
4. API key authentication is extracted into a reusable middleware

### Verification

```bash
# Test with API key (replace with actual values)
curl -X POST https://console.lightfast.ai/v1/search \
  -H "Authorization: Bearer console_sk_xxx" \
  -H "X-Workspace-ID: ws_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication patterns", "limit": 10, "mode": "balanced"}'

# Expected: 200 OK with search results
# Expected latency: fast < 100ms, balanced < 200ms, thorough < 800ms
```

## What We're NOT Doing

- Rate limiting (deferred to Day 4 or Week 2)
- Caching of rerank results (deferred)
- Workspace-level rerank config UI (deferred)
- `/v1/contents` and `/v1/findsimilar` routes (Day 3)
- Answer generation via `/v1/answer` (future)

## Implementation Approach

Extract the 4-path search logic from the internal route into a reusable function, create a standalone API key auth middleware for Next.js route handlers, then build the v1/search route that combines both with the rerank package.

---

## Phase 1: API Key Authentication Middleware

### Overview

Create a standalone API key authentication middleware for Next.js route handlers, adapting the pattern from tRPC's `apiKeyProcedure`.

### Changes Required

#### 1. Create with-api-key-auth.ts

**File**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`
**Action**: Create new file

```typescript
/**
 * API Key Authentication Middleware for v1 Routes
 *
 * Adapts the tRPC apiKeyProcedure pattern for Next.js route handlers.
 * Extracts and verifies API keys from request headers.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@db/console/client";
import { userApiKeys } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { hashApiKey } from "@repo/console-api-key";
import { log } from "@vendor/observability/log";

export interface ApiKeyAuthContext {
  workspaceId: string;
  userId: string;
  apiKeyId: string;
}

export interface AuthSuccess {
  success: true;
  auth: ApiKeyAuthContext;
}

export interface AuthError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  status: number;
}

export type AuthResult = AuthSuccess | AuthError;

/**
 * Verify API key and extract workspace context
 *
 * Required headers:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * @returns AuthResult with either auth context or error details
 *
 * @example
 * ```typescript
 * const result = await withApiKeyAuth(request);
 * if (!result.success) {
 *   return NextResponse.json(result.error, { status: result.status });
 * }
 * const { workspaceId, userId, apiKeyId } = result.auth;
 * ```
 */
export async function withApiKeyAuth(
  request: NextRequest,
  requestId?: string
): Promise<AuthResult> {
  // 1. Extract Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    log.warn("Missing or invalid Authorization header", { requestId });
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "API key required. Provide 'Authorization: Bearer <api-key>' header.",
      },
      status: 401,
    };
  }

  const apiKey = authHeader.slice(7); // Remove "Bearer " prefix

  // 2. Extract X-Workspace-ID header
  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    log.warn("Missing X-Workspace-ID header", { requestId });
    return {
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Workspace ID required. Provide 'X-Workspace-ID: <workspace-id>' header.",
      },
      status: 400,
    };
  }

  // 3. Hash and verify API key
  try {
    const keyHash = await hashApiKey(apiKey);

    const [foundKey] = await db
      .select({
        id: userApiKeys.id,
        userId: userApiKeys.userId,
        isActive: userApiKeys.isActive,
        expiresAt: userApiKeys.expiresAt,
      })
      .from(userApiKeys)
      .where(and(eq(userApiKeys.keyHash, keyHash), eq(userApiKeys.isActive, true)))
      .limit(1);

    if (!foundKey) {
      log.warn("Invalid API key", { requestId, workspaceId });
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        },
        status: 401,
      };
    }

    // 4. Check expiration
    if (foundKey.expiresAt && new Date(foundKey.expiresAt) < new Date()) {
      log.warn("Expired API key", { requestId, apiKeyId: foundKey.id });
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "API key expired",
        },
        status: 401,
      };
    }

    // 5. Update last used timestamp (non-blocking)
    void db
      .update(userApiKeys)
      .set({ lastUsedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(userApiKeys.id, foundKey.id))
      .catch((error) => {
        log.error("Failed to update API key lastUsedAt", {
          error,
          apiKeyId: foundKey.id,
        });
      });

    log.info("API key verified", {
      requestId,
      apiKeyId: foundKey.id,
      userId: foundKey.userId,
      workspaceId,
    });

    return {
      success: true,
      auth: {
        workspaceId,
        userId: foundKey.userId,
        apiKeyId: foundKey.id,
      },
    };
  } catch (error) {
    log.error("API key verification failed", { requestId, error });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Authentication failed",
      },
      status: 500,
    };
  }
}

/**
 * Helper to create error response from AuthError
 */
export function createAuthErrorResponse(result: AuthError, requestId: string): NextResponse {
  return NextResponse.json(
    {
      error: result.error.code,
      message: result.error.message,
      requestId,
    },
    { status: result.status }
  );
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/console typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/console lint`
- [x] File exists at correct path

#### Manual Verification
- [ ] Can be imported and used in route handlers
- [ ] Returns correct error structure for missing headers
- [ ] Successfully verifies valid API key

---

## Phase 2: V1 Search Schemas

### Overview

Extend the existing search schemas with v1-specific fields including the `mode` parameter and enhanced response structure.

### Changes Required

#### 1. Create V1 Search Schemas

**File**: `packages/console-types/src/api/v1/search.ts`
**Action**: Create new file

```typescript
/**
 * /v1/search API schemas
 *
 * Extended search schemas for the public v1 API with mode-based reranking.
 */

import { z } from "zod";

/**
 * Rerank mode for search quality
 * - fast: No reranking, vector scores only (~50ms)
 * - balanced: Cohere rerank (~130ms)
 * - thorough: LLM-based scoring (~600ms)
 */
export const RerankModeSchema = z.enum(["fast", "balanced", "thorough"]);
export type RerankMode = z.infer<typeof RerankModeSchema>;

/**
 * Search filters for scoping results
 */
export const V1SearchFiltersSchema = z.object({
  /** Source types to include (e.g., ["github", "linear"]) */
  sourceTypes: z.array(z.string()).optional(),
  /** Observation types to include (e.g., ["commit", "issue"]) */
  observationTypes: z.array(z.string()).optional(),
  /** Actor names to filter by (e.g., ["@sarah", "@mike"]) */
  actorNames: z.array(z.string()).optional(),
  /** Date range filter */
  dateRange: z
    .object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    })
    .optional(),
});

export type V1SearchFilters = z.infer<typeof V1SearchFiltersSchema>;

/**
 * V1 Search request schema
 */
export const V1SearchRequestSchema = z.object({
  /** Search query text */
  query: z.string().min(1, "Query must not be empty"),
  /** Number of results to return (1-100, default 10) */
  limit: z.number().int().min(1).max(100).default(10),
  /** Result offset for pagination (default 0) */
  offset: z.number().int().min(0).default(0),
  /** Rerank mode for result quality (default: balanced) */
  mode: RerankModeSchema.default("balanced"),
  /** Optional filters for scoping results */
  filters: V1SearchFiltersSchema.optional(),
  /** Include cluster and actor context (default: true) */
  includeContext: z.boolean().default(true),
  /** Include highlighted snippets (default: true) */
  includeHighlights: z.boolean().default(true),
});

export type V1SearchRequest = z.infer<typeof V1SearchRequestSchema>;

/**
 * Individual search result
 */
export const V1SearchResultSchema = z.object({
  /** Observation ID */
  id: z.string(),
  /** Document/observation title */
  title: z.string(),
  /** URL to the source document */
  url: z.string(),
  /** Content snippet */
  snippet: z.string(),
  /** Combined relevance score (0-1) */
  score: z.number(),
  /** Source type (e.g., "github", "linear") */
  source: z.string(),
  /** Observation type (e.g., "commit", "issue") */
  type: z.string(),
  /** When the observation occurred */
  occurredAt: z.string().datetime().optional(),
  /** Extracted entities */
  entities: z
    .array(
      z.object({
        key: z.string(),
        category: z.string(),
      })
    )
    .optional(),
  /** Highlighted snippet (if includeHighlights) */
  highlights: z
    .object({
      title: z.string().optional(),
      snippet: z.string().optional(),
    })
    .optional(),
});

export type V1SearchResult = z.infer<typeof V1SearchResultSchema>;

/**
 * Search context with clusters and actors
 */
export const V1SearchContextSchema = z.object({
  /** Related topic clusters */
  clusters: z
    .array(
      z.object({
        topic: z.string().nullable(),
        summary: z.string().nullable(),
        keywords: z.array(z.string()),
      })
    )
    .optional(),
  /** Relevant actors/contributors */
  relevantActors: z
    .array(
      z.object({
        displayName: z.string(),
        expertiseDomains: z.array(z.string()),
      })
    )
    .optional(),
});

export type V1SearchContext = z.infer<typeof V1SearchContextSchema>;

/**
 * Latency breakdown
 */
export const V1SearchLatencySchema = z.object({
  /** Total request latency */
  total: z.number().nonnegative(),
  /** Embedding generation */
  embedding: z.number().nonnegative().optional(),
  /** Vector retrieval */
  retrieval: z.number().nonnegative(),
  /** Entity search */
  entitySearch: z.number().nonnegative().optional(),
  /** Cluster search */
  clusterSearch: z.number().nonnegative().optional(),
  /** Actor search */
  actorSearch: z.number().nonnegative().optional(),
  /** Reranking latency */
  rerank: z.number().nonnegative(),
});

export type V1SearchLatency = z.infer<typeof V1SearchLatencySchema>;

/**
 * Response metadata
 */
export const V1SearchMetaSchema = z.object({
  /** Total matching results (before pagination) */
  total: z.number().nonnegative(),
  /** Results returned in this page */
  limit: z.number(),
  /** Current offset */
  offset: z.number(),
  /** Total request time in ms */
  took: z.number().nonnegative(),
  /** Rerank mode used */
  mode: RerankModeSchema,
  /** Search paths executed */
  paths: z.object({
    vector: z.boolean(),
    entity: z.boolean(),
    cluster: z.boolean(),
    actor: z.boolean(),
  }),
});

export type V1SearchMeta = z.infer<typeof V1SearchMetaSchema>;

/**
 * V1 Search response schema
 */
export const V1SearchResponseSchema = z.object({
  /** Search results */
  data: z.array(V1SearchResultSchema),
  /** Optional context (clusters, actors) */
  context: V1SearchContextSchema.optional(),
  /** Response metadata */
  meta: V1SearchMetaSchema,
  /** Latency breakdown */
  latency: V1SearchLatencySchema,
  /** Request ID for debugging */
  requestId: z.string(),
});

export type V1SearchResponse = z.infer<typeof V1SearchResponseSchema>;
```

#### 2. Update console-types Index

**File**: `packages/console-types/src/api/index.ts`
**Action**: Add v1 exports

```typescript
// Add to existing exports
export * from "./v1/search";
```

#### 3. Create v1 Directory Index

**File**: `packages/console-types/src/api/v1/index.ts`
**Action**: Create new file

```typescript
/**
 * V1 Public API schemas
 */

export * from "./search";
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @repo/console-types typecheck`
- [x] Package builds: `pnpm --filter @repo/console-types build`

#### Manual Verification
- [ ] Schemas can be imported from `@repo/console-types/api/v1/search`
- [ ] Zod validation works correctly for request/response

---

## Phase 3: Four-Path Search Utility

### Overview

Extract the 4-path parallel retrieval logic from the internal search route into a reusable utility function that can be shared between internal and public routes.

### Changes Required

#### 1. Create four-path-search.ts

**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Action**: Create new file

```typescript
/**
 * Four-Path Parallel Search
 *
 * Executes parallel retrieval across:
 * 1. Vector similarity (Pinecone)
 * 2. Entity search (pattern matching)
 * 3. Cluster context (topic centroids)
 * 4. Actor profiles (contributor relevance)
 *
 * Extracted from internal search route for reuse in public API.
 */

import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import type { VectorMetadata } from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import type { FilterCandidate } from "./llm-filter";
import { searchByEntities } from "./entity-search";
import { searchClusters } from "./cluster-search";
import { searchActorProfiles } from "./actor-search";
import type { EntitySearchResult } from "@repo/console-types";

export interface FourPathSearchParams {
  workspaceId: string;
  query: string;
  topK: number;
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
  };
  requestId?: string;
}

export interface FourPathSearchResult {
  /** Merged candidates ready for reranking */
  candidates: FilterCandidate[];
  /** Cluster context results */
  clusters: {
    topicLabel: string | null;
    summary: string | null;
    keywords: string[];
    score: number;
  }[];
  /** Actor profile results */
  actors: {
    displayName: string;
    expertiseDomains: string[];
    score: number;
  }[];
  /** Latency breakdown */
  latency: {
    embedding: number;
    vector: number;
    entity: number;
    cluster: number;
    actor: number;
    total: number;
  };
  /** Total candidates before dedup */
  total: number;
  /** Search paths status */
  paths: {
    vector: boolean;
    entity: boolean;
    cluster: boolean;
    actor: boolean;
  };
}

/**
 * Build Pinecone metadata filter from search filters
 */
function buildPineconeFilter(
  filters?: FourPathSearchParams["filters"]
): Record<string, unknown> | undefined {
  if (!filters) {
    return { layer: { $eq: "observations" } };
  }

  const pineconeFilter: Record<string, unknown> = {
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

/**
 * Merge vector search results with entity-matched results
 */
function mergeSearchResults(
  vectorMatches: { id: string; score: number; metadata?: VectorMetadata }[],
  entityResults: EntitySearchResult[],
  limit: number
): FilterCandidate[] {
  const resultMap = new Map<string, FilterCandidate>();

  // Add vector results
  for (const match of vectorMatches) {
    resultMap.set(match.id, {
      id: match.id,
      title: String(match.metadata?.title ?? ""),
      snippet: String(match.metadata?.snippet ?? ""),
      score: match.score,
    });
  }

  // Add/boost entity results
  for (const entity of entityResults) {
    const existing = resultMap.get(entity.observationId);
    if (existing) {
      // Boost existing result - entity match confirms relevance
      existing.score = Math.min(1.0, existing.score + 0.2);
    } else {
      // Add new result from entity match
      resultMap.set(entity.observationId, {
        id: entity.observationId,
        title: entity.observationTitle,
        snippet: entity.observationSnippet,
        score: 0.85 * entity.confidence,
      });
    }
  }

  // Sort by score and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Execute 4-path parallel search
 *
 * @param params - Search parameters
 * @returns Combined results from all paths with latency metrics
 */
export async function fourPathParallelSearch(
  params: FourPathSearchParams
): Promise<FourPathSearchResult> {
  const { workspaceId, query, topK, filters, requestId } = params;
  const startTime = Date.now();

  // 1. Look up workspace configuration
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  if (!workspace.indexName || !workspace.namespaceName) {
    throw new Error(`Workspace not configured for search: ${workspaceId}`);
  }

  const indexName = workspace.indexName;
  const namespaceName = workspace.namespaceName;

  // 2. Generate query embedding
  const embedStart = Date.now();
  const embedding = createEmbeddingProviderForWorkspace(
    {
      id: workspace.id,
      embeddingModel: workspace.embeddingModel,
      embeddingDim: workspace.embeddingDim,
    },
    { inputType: "search_query" }
  );

  const { embeddings } = await embedding.embed([query]);
  const embedLatency = Date.now() - embedStart;

  const queryVector = embeddings[0];
  if (!queryVector) {
    throw new Error("Failed to generate query embedding");
  }

  // 3. Execute 4-path parallel retrieval
  const pineconeFilter = buildPineconeFilter(filters);
  const parallelStart = Date.now();

  const [vectorResults, entityResults, clusterResults, actorResults] = await Promise.all([
    // Path 1: Vector similarity search
    (async () => {
      const start = Date.now();
      try {
        const results = await pineconeClient.query<VectorMetadata>(
          indexName,
          {
            vector: queryVector,
            topK,
            includeMetadata: true,
            filter: pineconeFilter,
          },
          namespaceName
        );
        return { results, latency: Date.now() - start, success: true };
      } catch (error) {
        log.error("Vector search failed", { requestId, error });
        return { results: { matches: [] }, latency: Date.now() - start, success: false };
      }
    })(),

    // Path 2: Entity search
    (async () => {
      const start = Date.now();
      try {
        const results = await searchByEntities(query, workspaceId, topK);
        return { results, latency: Date.now() - start, success: true };
      } catch (error) {
        log.error("Entity search failed", { requestId, error });
        return { results: [], latency: Date.now() - start, success: false };
      }
    })(),

    // Path 3: Cluster context search
    (async () => {
      try {
        return await searchClusters(workspaceId, indexName, namespaceName, queryVector, 3);
      } catch (error) {
        log.error("Cluster search failed", { requestId, error });
        return { results: [], latency: 0 };
      }
    })(),

    // Path 4: Actor profile search
    (async () => {
      try {
        return await searchActorProfiles(workspaceId, query, 5);
      } catch (error) {
        log.error("Actor search failed", { requestId, error });
        return { results: [], latency: 0 };
      }
    })(),
  ]);

  log.info("4-path parallel search complete", {
    requestId,
    totalLatency: Date.now() - parallelStart,
    vectorMatches: vectorResults.results.matches.length,
    entityMatches: entityResults.results.length,
    clusterMatches: clusterResults.results.length,
    actorMatches: actorResults.results.length,
  });

  // 4. Merge vector and entity results
  const mergedCandidates = mergeSearchResults(
    vectorResults.results.matches,
    entityResults.results,
    topK
  );

  return {
    candidates: mergedCandidates,
    clusters: clusterResults.results.map((c) => ({
      topicLabel: c.topicLabel,
      summary: c.summary,
      keywords: c.keywords,
      score: c.score,
    })),
    actors: actorResults.results.map((a) => ({
      displayName: a.displayName,
      expertiseDomains: a.expertiseDomains,
      score: a.score,
    })),
    latency: {
      embedding: embedLatency,
      vector: vectorResults.latency,
      entity: entityResults.latency,
      cluster: clusterResults.latency,
      actor: actorResults.latency,
      total: Date.now() - startTime,
    },
    total: vectorResults.results.matches.length + entityResults.results.length,
    paths: {
      vector: vectorResults.success,
      entity: entityResults.success,
      cluster: clusterResults.results.length > 0,
      actor: actorResults.results.length > 0,
    },
  };
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] No lint errors: `pnpm --filter @lightfast/console lint`

#### Manual Verification
- [ ] Function can be imported and called from both internal and v1 routes
- [ ] Returns correctly structured results with latency metrics

---

## Phase 4: V1 Search Route Handler

### Overview

Create the main `POST /v1/search` route that combines API key auth, 4-path search, and mode-based reranking.

### Changes Required

#### 1. Create Route Handler

**File**: `apps/console/src/app/(api)/v1/search/route.ts`
**Action**: Create new file

```typescript
/**
 * POST /v1/search - Public Search API
 *
 * Semantic search through a workspace's neural memory using API key authentication.
 * Supports mode-based reranking for quality/latency tradeoffs.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - query: string (required) - Search query
 * - limit: number (1-100, default 10) - Results per page
 * - offset: number (default 0) - Pagination offset
 * - mode: "fast" | "balanced" | "thorough" (default: balanced)
 * - filters: object (optional) - Source/type/date filters
 * - includeContext: boolean (default true) - Include cluster/actor context
 * - includeHighlights: boolean (default true) - Include highlighted snippets
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { log } from "@vendor/observability/log";
import { createRerankProvider, type RerankCandidate } from "@repo/console-rerank";
import {
  V1SearchRequestSchema,
  type V1SearchResponse,
  type V1SearchResult,
} from "@repo/console-types/api/v1/search";

import { withApiKeyAuth, createAuthErrorResponse } from "../lib/with-api-key-auth";
import { fourPathParallelSearch } from "~/lib/neural/four-path-search";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/search request", { requestId });

  try {
    // 1. Authenticate via API key
    const authResult = await withApiKeyAuth(request, requestId);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, apiKeyId } = authResult.auth;

    log.info("v1/search authenticated", { requestId, workspaceId, userId, apiKeyId });

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    const parseResult = V1SearchRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const {
      query,
      limit,
      offset,
      mode,
      filters,
      includeContext,
      includeHighlights,
    } = parseResult.data;

    log.info("v1/search validated", {
      requestId,
      query,
      limit,
      offset,
      mode,
      filters: filters ?? null,
    });

    // 3. Execute 4-path parallel search
    const searchResult = await fourPathParallelSearch({
      workspaceId,
      query,
      topK: limit * 2, // Over-fetch for reranking
      filters,
      requestId,
    });

    // 4. Apply reranking based on mode
    const rerankStart = Date.now();
    const reranker = createRerankProvider(mode);

    // Convert candidates to rerank format
    const rerankCandidates: RerankCandidate[] = searchResult.candidates.map((c) => ({
      id: c.id,
      title: c.title,
      content: c.snippet,
      score: c.score,
    }));

    const rerankResponse = await reranker.rerank(query, rerankCandidates, {
      topK: limit + offset, // Get enough for pagination
      threshold: mode === "thorough" ? 0.4 : undefined,
    });

    const rerankLatency = Date.now() - rerankStart;

    log.info("v1/search reranked", {
      requestId,
      mode,
      provider: rerankResponse.provider,
      inputCount: rerankCandidates.length,
      outputCount: rerankResponse.results.length,
      rerankLatency,
    });

    // 5. Apply pagination
    const paginatedResults = rerankResponse.results.slice(offset, offset + limit);

    // 6. Build response results
    const results: V1SearchResult[] = paginatedResults.map((r) => {
      const original = searchResult.candidates.find((c) => c.id === r.id);
      return {
        id: r.id,
        title: original?.title ?? "",
        url: "", // TODO: Fetch from observations table
        snippet: original?.snippet ?? "",
        score: r.score,
        source: "unknown", // TODO: Fetch from observations table
        type: "unknown", // TODO: Fetch from observations table
        occurredAt: undefined,
        entities: undefined,
        highlights: includeHighlights
          ? {
              title: original?.title,
              snippet: original?.snippet,
            }
          : undefined,
      };
    });

    // 7. Build context (if requested)
    const context = includeContext
      ? {
          clusters: searchResult.clusters.slice(0, 2).map((c) => ({
            topic: c.topicLabel,
            summary: c.summary,
            keywords: c.keywords,
          })),
          relevantActors: searchResult.actors.slice(0, 3).map((a) => ({
            displayName: a.displayName,
            expertiseDomains: a.expertiseDomains,
          })),
        }
      : undefined;

    // 8. Build response
    const response: V1SearchResponse = {
      data: results,
      context,
      meta: {
        total: searchResult.total,
        limit,
        offset,
        took: Date.now() - startTime,
        mode,
        paths: searchResult.paths,
      },
      latency: {
        total: Date.now() - startTime,
        embedding: searchResult.latency.embedding,
        retrieval: searchResult.latency.vector,
        entitySearch: searchResult.latency.entity,
        clusterSearch: searchResult.latency.cluster,
        actorSearch: searchResult.latency.actor,
        rerank: rerankLatency,
      },
      requestId,
    };

    log.info("v1/search complete", {
      requestId,
      resultCount: results.length,
      latency: response.latency,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/search error", { requestId, error });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Search failed",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: "METHOD_NOT_ALLOWED", message: "Use POST method" },
    { status: 405 }
  );
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification
- [ ] Route responds to POST at `/v1/search`
- [ ] Returns 401 for missing API key
- [ ] Returns 400 for missing X-Workspace-ID
- [ ] Returns 400 for invalid JSON
- [ ] Returns 400 for validation errors
- [ ] Returns 200 with results for valid request
- [ ] Mode parameter affects reranking behavior

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the endpoint is working correctly before proceeding.

---

## Phase 5: Result Enrichment

### Overview

Enhance the search results with full metadata from the observations table (URL, source, type, occurredAt, entities).

### Changes Required

#### 1. Add enrichment function to four-path-search.ts

**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Action**: Add function

```typescript
import { workspaceNeuralObservations, workspaceNeuralEntities } from "@db/console/schema";
import { inArray } from "drizzle-orm";

export interface EnrichedResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  source: string;
  type: string;
  occurredAt: string | null;
  entities: { key: string; category: string }[];
}

/**
 * Enrich reranked results with full metadata from database
 */
export async function enrichSearchResults(
  results: { id: string; score: number }[],
  candidates: FilterCandidate[],
  workspaceId: string
): Promise<EnrichedResult[]> {
  if (results.length === 0) {
    return [];
  }

  const resultIds = results.map((r) => r.id);

  // Fetch observations
  const observations = await db
    .select({
      id: workspaceNeuralObservations.id,
      title: workspaceNeuralObservations.title,
      url: workspaceNeuralObservations.url,
      snippet: workspaceNeuralObservations.snippet,
      source: workspaceNeuralObservations.source,
      observationType: workspaceNeuralObservations.observationType,
      occurredAt: workspaceNeuralObservations.occurredAt,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        inArray(workspaceNeuralObservations.id, resultIds)
      )
    );

  // Fetch entities for these observations
  const entities = await db
    .select({
      observationId: workspaceNeuralEntities.sourceObservationId,
      key: workspaceNeuralEntities.key,
      category: workspaceNeuralEntities.category,
    })
    .from(workspaceNeuralEntities)
    .where(
      and(
        eq(workspaceNeuralEntities.workspaceId, workspaceId),
        inArray(workspaceNeuralEntities.sourceObservationId, resultIds)
      )
    );

  // Group entities by observation
  const entityMap = new Map<string, { key: string; category: string }[]>();
  for (const entity of entities) {
    if (entity.observationId) {
      const existing = entityMap.get(entity.observationId) ?? [];
      existing.push({ key: entity.key, category: entity.category });
      entityMap.set(entity.observationId, existing);
    }
  }

  // Build observation map
  const observationMap = new Map(observations.map((o) => [o.id, o]));

  // Map results with enrichment
  return results.map((r) => {
    const obs = observationMap.get(r.id);
    const candidate = candidates.find((c) => c.id === r.id);

    return {
      id: r.id,
      title: obs?.title ?? candidate?.title ?? "",
      url: obs?.url ?? "",
      snippet: obs?.snippet ?? candidate?.snippet ?? "",
      score: r.score,
      source: obs?.source ?? "unknown",
      type: obs?.observationType ?? "unknown",
      occurredAt: obs?.occurredAt?.toISOString() ?? null,
      entities: entityMap.get(r.id) ?? [],
    };
  });
}
```

#### 2. Update v1/search route to use enrichment

**File**: `apps/console/src/app/(api)/v1/search/route.ts`
**Action**: Update to call enrichSearchResults

```typescript
// Add import
import { fourPathParallelSearch, enrichSearchResults } from "~/lib/neural/four-path-search";

// Replace step 6 with:
// 6. Enrich results with full metadata
const enrichedResults = await enrichSearchResults(
  paginatedResults,
  searchResult.candidates,
  workspaceId
);

// 7. Build response results
const results: V1SearchResult[] = enrichedResults.map((r) => ({
  id: r.id,
  title: r.title,
  url: r.url,
  snippet: r.snippet,
  score: r.score,
  source: r.source,
  type: r.type,
  occurredAt: r.occurredAt ?? undefined,
  entities: r.entities,
  highlights: includeHighlights
    ? { title: r.title, snippet: r.snippet }
    : undefined,
}));
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification
- [ ] Search results include correct URL
- [ ] Search results include correct source type
- [ ] Search results include correct observation type
- [ ] Search results include occurredAt timestamp
- [ ] Search results include extracted entities

---

## Testing Strategy

### Unit Tests

None required for Day 2 (deferred to Day 4 integration testing).

### Integration Tests

None required for Day 2 (deferred to Day 4).

### Manual Testing Steps

1. Start development server: `pnpm dev:console`

2. Create API key via console UI or tRPC:
   ```bash
   # Get a valid API key and workspace ID from the console
   ```

3. Test authentication errors:
   ```bash
   # Missing auth header
   curl -X POST http://localhost:4107/v1/search \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}'
   # Expected: 401 Unauthorized

   # Missing workspace header
   curl -X POST http://localhost:4107/v1/search \
     -H "Authorization: Bearer console_sk_xxx" \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}'
   # Expected: 400 Bad Request
   ```

4. Test validation errors:
   ```bash
   # Empty query
   curl -X POST http://localhost:4107/v1/search \
     -H "Authorization: Bearer console_sk_xxx" \
     -H "X-Workspace-ID: ws_xxx" \
     -H "Content-Type: application/json" \
     -d '{"query": ""}'
   # Expected: 400 Validation Error
   ```

5. Test successful search with each mode:
   ```bash
   # Fast mode
   curl -X POST http://localhost:4107/v1/search \
     -H "Authorization: Bearer console_sk_xxx" \
     -H "X-Workspace-ID: ws_xxx" \
     -H "Content-Type: application/json" \
     -d '{"query": "authentication", "mode": "fast"}'
   # Expected: 200 OK, latency.rerank < 10ms

   # Balanced mode (default)
   curl -X POST http://localhost:4107/v1/search \
     -H "Authorization: Bearer console_sk_xxx" \
     -H "X-Workspace-ID: ws_xxx" \
     -H "Content-Type: application/json" \
     -d '{"query": "authentication"}'
   # Expected: 200 OK, latency.rerank < 200ms

   # Thorough mode
   curl -X POST http://localhost:4107/v1/search \
     -H "Authorization: Bearer console_sk_xxx" \
     -H "X-Workspace-ID: ws_xxx" \
     -H "Content-Type: application/json" \
     -d '{"query": "authentication", "mode": "thorough"}'
   # Expected: 200 OK, results may be filtered by threshold
   ```

6. Test pagination:
   ```bash
   curl -X POST http://localhost:4107/v1/search \
     -H "Authorization: Bearer console_sk_xxx" \
     -H "X-Workspace-ID: ws_xxx" \
     -H "Content-Type: application/json" \
     -d '{"query": "authentication", "limit": 5, "offset": 5}'
   # Expected: 200 OK, meta.limit=5, meta.offset=5
   ```

7. Test filters:
   ```bash
   curl -X POST http://localhost:4107/v1/search \
     -H "Authorization: Bearer console_sk_xxx" \
     -H "X-Workspace-ID: ws_xxx" \
     -H "Content-Type: application/json" \
     -d '{"query": "authentication", "filters": {"sourceTypes": ["github"]}}'
   # Expected: 200 OK, results filtered to GitHub sources
   ```

## Performance Considerations

- **Latency targets**:
  - `fast` mode: < 100ms total
  - `balanced` mode: < 200ms total
  - `thorough` mode: < 800ms total

- **Over-fetching**: Request `limit * 2` candidates from 4-path search to give reranker more options

- **Parallel execution**: 4-path search runs all paths concurrently via `Promise.all()`

- **Non-blocking updates**: API key `lastUsedAt` update is fire-and-forget

## Migration Notes

No database migrations required for Day 2.

## References

- Day 1 plan: `thoughts/shared/plans/2025-12-14-neural-memory-week1-public-api-rerank.md`
- Day 2 research: `thoughts/shared/research/2025-12-14-neural-memory-week1-day2-search-route.md`
- Internal search route: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
- Rerank package: `packages/console-rerank/`
- API key auth: `api/console/src/trpc.ts:530-576`

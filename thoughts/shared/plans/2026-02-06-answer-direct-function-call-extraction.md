# Answer API Direct Function Call Extraction Implementation Plan

## Overview

Extract the core business logic from the v1 API route handlers into standalone functions so that answer tools can call them directly instead of via HTTP `fetch()`. This eliminates the Clerk middleware auth header stripping issue while improving performance and simplifying the codebase.

## Current State Analysis

### The Problem
- Answer tools (`search`, `graph`, `contents`, `findsimilar`, `related`) make HTTP `fetch()` calls to internal v1 endpoints
- Clerk middleware intercepts these server-to-server requests and strips the `Authorization` header, setting `x-clerk-auth-status: signed-out`
- This causes v1 endpoints to fail auth validation despite valid Clerk JWTs being passed
- Root cause: Clerk middleware doesn't have the dev browser token context for server-to-server calls

### Current Architecture
**Tool → HTTP Fetch → Clerk Middleware → Route Handler**

```
answer tool (search.ts)
  ↓
fetch("/v1/search", {
  headers: { Authorization: Bearer <jwt>, X-Workspace-ID, X-User-ID }
})
  ↓
Clerk middleware (rewrites headers)
  ↓
withDualAuth() validation
  ↓
core business logic (fourPathParallelSearch, etc.)
  ↓
NextResponse.json()
```

### Key Discovery: Logic Has Zero HTTP Dependencies
All 5 v1 route handlers have completely HTTP-agnostic core logic:
- **Search** (`/v1/search/route.ts:115-270`): Uses `fourPathParallelSearch()`, reranking, enrichment
- **Graph** (`/v1/graph/[id]/route.ts:76-158`): Pure BFS traversal with database queries
- **Contents** (`/v1/contents/route.ts:90-155`): ID resolution and content fetching
- **FindSimilar** (`/v1/findsimilar/route.ts:265-415`): Vector query + normalization + enrichment
- **Related** (`/v1/related/[id]/route.ts:66-152`): Relationship lookup + formatting

Each route handler only uses HTTP objects for:
1. Parsing JSON body (`await request.json()`)
2. Parsing URL params (`new URL(request.url).searchParams`)
3. Returning response (`NextResponse.json()`)

All of these are easily replaceable with function parameters and return values.

### Tool Implementation Details
- **Tools located**: `apps/console/src/ai/tools/*.ts`
- **Tool factory pattern**: Each tool is a factory function returning a `createTool()` instance
- **Runtime context**: Injected per-request via `RuntimeContext<AnswerRuntimeContext>`
- **Context includes**: `workspaceId`, `userId`, `authToken` (Clerk JWT)
- **Current pattern**: Extract context → fetch() → parse response → return data

## Desired End State

### New Architecture
**Tool → Direct Function Call → Core Logic → Return Data**

```
answer tool (search.ts)
  ↓
await searchLogic({
  workspaceId,
  userId,
  query,
  limit,
  mode,
  filters,
  ...
})
  ↓
(no HTTP, no Clerk)
  ↓
core business logic (fourPathParallelSearch, etc.)
  ↓
return { data, meta, latency, requestId }
```

### Benefits
1. **Eliminates auth header stripping** — Direct function calls bypass Clerk middleware entirely
2. **Better performance** — No HTTP overhead, no network roundtrip, no Clerk processing
3. **Simpler code** — Tools no longer need `fetch()`, URL construction, header management
4. **Type safety** — Direct imports provide full TypeScript type checking (no JSON serialization/deserialization)
5. **Unified code path** — Tools and routes both call the same extracted functions

### End State Verification
- [ ] All 5 tools successfully execute direct function calls
- [ ] Answer API returns correct results without 401 errors
- [ ] Type checking passes: `pnpm typecheck`
- [ ] No console/app integration tests fail
- [ ] Performance metrics show improvement in answer latency
- [ ] Feature works in dev, preview, and production environments

## What We're NOT Doing

1. **Changing v1 route handlers fundamentally** — They remain public API routes, can still be called via HTTP (by external clients via API keys)
2. **Removing authentication** — v1 routes still validate via `withDualAuth()`; extracted functions will receive validated context
3. **Changing tool input/output schemas** — Zod schemas remain unchanged, tools still accept same inputs
4. **Altering answer feature behavior** — System prompts, agent behavior, tool descriptions unchanged
5. **Refactoring neural search logic** — `fourPathParallelSearch()`, reranking, embeddings untouched
6. **Changing database schema** — All queries and models unchanged
7. **Removing v1 API documentation** — Route docstrings and comments remain for external API consumers

## Implementation Approach

### Phase 1: Extract Core Functions

Create a new module structure:
```
apps/console/src/lib/v1/
├── index.ts                 (exports)
├── search.ts               (searchLogic function)
├── graph.ts                (graphLogic function)
├── contents.ts             (contentsLogic function)
├── findsimilar.ts          (findsimilarLogic function)
└── related.ts              (relatedLogic function)
```

Each function will:
- Accept a `context: AuthContext` (workspaceId, userId, authType, apiKeyId)
- Accept parsed and validated input (query params, body params)
- Return the raw response data (before JSON serialization)
- Have no dependency on `NextRequest` or `NextResponse`

### Phase 2: Rewire Tools

Update tools to:
- Import extracted functions directly: `import { searchLogic } from "~/lib/v1"`
- Remove `createBaseUrl()` calls
- Remove `fetch()` calls
- Remove header construction
- Call: `const result = await searchLogic({ workspaceId, userId, query, ... })`
- Return result directly

Update `AnswerRuntimeContext` if needed (likely no change needed, just won't use `authToken`).

### Phase 3: Simplify Route Handlers

Route handlers become thin wrappers:
1. Parse/validate request (body, params)
2. Call `withDualAuth()` to get auth context
3. Call extracted function with auth context + parsed input
4. Return `NextResponse.json(result)`

Route handlers maintain all logging, error handling, activity recording, and timing.

## Phase 1: Extract Core Functions

### Overview
Create `apps/console/src/lib/v1/` module with 5 extracted functions. Each mirrors the business logic from its corresponding route handler, taking structured inputs and returning structured outputs.

### Changes Required

#### 1. Create `apps/console/src/lib/v1/index.ts`
**File**: `apps/console/src/lib/v1/index.ts` (NEW)

```typescript
export { searchLogic, type SearchLogicInput, type SearchLogicOutput } from "./search";
export { graphLogic, type GraphLogicInput, type GraphLogicOutput } from "./graph";
export { contentsLogic, type ContentsLogicInput, type ContentsLogicOutput } from "./contents";
export { findsimilarLogic, type FindSimilarLogicInput, type FindSimilarLogicOutput } from "./findsimilar";
export { relatedLogic, type RelatedLogicInput, type RelatedLogicOutput } from "./related";

/** Auth context available to all v1 logic functions */
export interface V1AuthContext {
  workspaceId: string;
  userId: string;
  authType: "api-key" | "session";
  apiKeyId?: string;
}
```

#### 2. Create `apps/console/src/lib/v1/search.ts`
**File**: `apps/console/src/lib/v1/search.ts` (NEW)

Extract logic from `/v1/search/route.ts:114-239` (the search execution, reranking, enrichment, response building).

```typescript
import { log } from "@vendor/observability/log";
import { createRerankProvider } from "@repo/console-rerank";
import type { RerankCandidate } from "@repo/console-rerank";
import type { V1SearchResponse, V1SearchResult } from "@repo/console-types";
import { recordSystemActivity } from "@api/console/lib/activity";

import {
  fourPathParallelSearch,
  enrichSearchResults,
} from "./four-path-search";
import type { V1AuthContext } from "./index";

export interface SearchLogicInput {
  query: string;
  limit: number;
  offset: number;
  mode: "fast" | "balanced" | "thorough";
  filters?: { sourceTypes?: string[]; observationTypes?: string[]; actorNames?: string[] };
  includeContext: boolean;
  includeHighlights: boolean;
  requestId: string;
}

export interface SearchLogicOutput extends V1SearchResponse {}

export async function searchLogic(
  auth: V1AuthContext,
  input: SearchLogicInput,
): Promise<SearchLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/search logic executing", { requestId: input.requestId });

  // Copy logic from route.ts:115-239
  // Execute 4-path parallel search
  const searchStart = Date.now();
  const searchResult = await fourPathParallelSearch({
    workspaceId: auth.workspaceId,
    query: input.query,
    topK: input.limit * 2,
    filters: input.filters,
    requestId: input.requestId,
  });
  const searchLatency = Date.now() - searchStart;

  // Apply reranking based on mode
  const rerankStart = Date.now();
  const reranker = createRerankProvider(input.mode);

  const rerankCandidates: RerankCandidate[] = searchResult.candidates.map(
    (c) => ({
      id: c.id,
      title: c.title,
      content: c.snippet,
      score: c.score,
    }),
  );

  const rerankResponse = await reranker.rerank(input.query, rerankCandidates, {
    topK: input.limit + input.offset,
    threshold: input.mode === "thorough" ? 0.4 : undefined,
    minResults:
      input.mode === "balanced" ? Math.max(3, Math.ceil(input.limit / 2)) : undefined,
  });

  const rerankLatency = Date.now() - rerankStart;

  // Apply pagination
  const paginatedResults = rerankResponse.results.slice(
    input.offset,
    input.offset + input.limit,
  );

  // Enrich results with full metadata from database
  const enrichStart = Date.now();
  const enrichedResults = await enrichSearchResults(
    paginatedResults,
    searchResult.candidates,
    auth.workspaceId,
  );
  const enrichLatency = Date.now() - enrichStart;

  // Build response results
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
    references: r.references.length > 0 ? r.references : undefined,
    highlights: input.includeHighlights
      ? { title: r.title, snippet: r.snippet }
      : undefined,
  }));

  // Build context (if requested)
  const context = input.includeContext
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

  // Calculate maxParallel
  const maxParallel = Math.max(
    searchResult.latency.vector,
    searchResult.latency.entity,
    searchResult.latency.cluster,
    searchResult.latency.actor,
  );

  // Build response
  const response: V1SearchResponse = {
    data: results,
    context,
    meta: {
      total: searchResult.total,
      limit: input.limit,
      offset: input.offset,
      took: Date.now() - startTime,
      mode: input.mode,
      paths: searchResult.paths,
    },
    latency: {
      total: Date.now() - startTime,
      auth: 0, // Not applicable for direct function call
      parse: 0, // Not applicable
      search: searchLatency,
      embedding: searchResult.latency.embedding,
      retrieval: searchResult.latency.vector,
      entitySearch: searchResult.latency.entity,
      clusterSearch: searchResult.latency.cluster,
      actorSearch: searchResult.latency.actor,
      rerank: rerankLatency,
      enrich: enrichLatency,
      maxParallel,
    },
    requestId: input.requestId,
  };

  // Track search query (fire-and-forget, non-blocking)
  recordSystemActivity({
    workspaceId: auth.workspaceId,
    actorType: auth.authType === "api-key" ? "api" : "user",
    actorUserId: auth.userId,
    category: "search",
    action: "search.query",
    entityType: "search_query",
    entityId: input.requestId,
    metadata: {
      query: input.query.substring(0, 200),
      limit: input.limit,
      offset: input.offset,
      mode: input.mode,
      hasFilters: input.filters !== undefined,
      resultCount: results.length,
      totalMatches: searchResult.total,
      latencyMs: response.latency.total,
      authType: auth.authType,
      apiKeyId: auth.apiKeyId,
    },
  });

  log.debug("v1/search logic complete", {
    requestId: input.requestId,
    resultCount: results.length,
  });

  return response;
}
```

#### 3. Create `apps/console/src/lib/v1/graph.ts`
**File**: `apps/console/src/lib/v1/graph.ts` (NEW)

Extract logic from `/v1/graph/[id]/route.ts:76-201` (BFS traversal and response building).

```typescript
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import type { V1AuthContext } from "./index";

export interface GraphLogicInput {
  observationId: string;
  depth: number;
  allowedTypes?: string[] | null;
  requestId: string;
}

export interface GraphLogicOutput {
  data: {
    root: {
      id: string;
      title: string;
      source: string;
      type: string;
    };
    nodes: Array<{
      id: string;
      title: string;
      source: string;
      type: string;
      occurredAt: string | null;
      url: string | null;
      isRoot: boolean;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
      linkingKey: string | null;
      confidence: number;
    }>;
  };
  meta: {
    depth: number;
    nodeCount: number;
    edgeCount: number;
    took: number;
  };
  requestId: string;
}

export async function graphLogic(
  auth: V1AuthContext,
  input: GraphLogicInput,
): Promise<GraphLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/graph logic executing", { requestId: input.requestId, observationId: input.observationId });

  // Step 1: Get the root observation
  const rootObs = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, auth.workspaceId),
      eq(workspaceNeuralObservations.externalId, input.observationId)
    ),
    columns: {
      id: true,
      externalId: true,
      title: true,
      source: true,
      observationType: true,
      occurredAt: true,
      metadata: true,
    },
  });

  if (!rootObs) {
    throw new Error(`Observation not found: ${input.observationId}`);
  }

  // Step 2: BFS traversal to find connected observations
  const visited = new Set<number>([rootObs.id]);
  const edges: GraphLogicOutput["data"]["edges"] = [];
  const nodeMap = new Map<number, typeof rootObs>();
  nodeMap.set(rootObs.id, rootObs);

  let frontier = [rootObs.id];
  const depth = Math.min(input.depth, 3);

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    // Find all relationships involving frontier nodes
    const relationships = await db
      .select()
      .from(workspaceObservationRelationships)
      .where(
        and(
          eq(workspaceObservationRelationships.workspaceId, auth.workspaceId),
          or(
            inArray(workspaceObservationRelationships.sourceObservationId, frontier),
            inArray(workspaceObservationRelationships.targetObservationId, frontier)
          )
        )
      );

    // Filter by allowed types if specified
    const filteredRels = input.allowedTypes
      ? relationships.filter((r) => input.allowedTypes!.includes(r.relationshipType))
      : relationships;

    // Collect new node IDs
    const newNodeIds = new Set<number>();
    for (const rel of filteredRels) {
      if (!visited.has(rel.sourceObservationId)) {
        newNodeIds.add(rel.sourceObservationId);
      }
      if (!visited.has(rel.targetObservationId)) {
        newNodeIds.add(rel.targetObservationId);
      }
    }

    // Fetch new nodes
    if (newNodeIds.size > 0) {
      const newNodes = await db
        .select({
          id: workspaceNeuralObservations.id,
          externalId: workspaceNeuralObservations.externalId,
          title: workspaceNeuralObservations.title,
          source: workspaceNeuralObservations.source,
          observationType: workspaceNeuralObservations.observationType,
          occurredAt: workspaceNeuralObservations.occurredAt,
          metadata: workspaceNeuralObservations.metadata,
        })
        .from(workspaceNeuralObservations)
        .where(inArray(workspaceNeuralObservations.id, Array.from(newNodeIds)));

      for (const node of newNodes) {
        nodeMap.set(node.id, node);
        visited.add(node.id);
      }
    }

    // Record edges
    for (const rel of filteredRels) {
      const sourceNode = nodeMap.get(rel.sourceObservationId);
      const targetNode = nodeMap.get(rel.targetObservationId);
      if (sourceNode && targetNode) {
        edges.push({
          source: sourceNode.externalId,
          target: targetNode.externalId,
          type: rel.relationshipType,
          linkingKey: rel.linkingKey,
          confidence: rel.confidence,
        });
      }
    }

    // Update frontier
    frontier = Array.from(newNodeIds);
  }

  // Step 3: Format response
  const nodes = Array.from(nodeMap.values()).map((node) => {
    const metadata = node.metadata as Record<string, unknown> | undefined;
    const metadataUrl = metadata?.url;
    return {
      id: node.externalId,
      title: node.title,
      source: node.source,
      type: node.observationType,
      occurredAt: node.occurredAt,
      url: typeof metadataUrl === "string" ? metadataUrl : null,
      isRoot: node.id === rootObs.id,
    };
  });

  log.debug("v1/graph logic complete", {
    requestId: input.requestId,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  });

  return {
    data: {
      root: {
        id: rootObs.externalId,
        title: rootObs.title,
        source: rootObs.source,
        type: rootObs.observationType,
      },
      nodes,
      edges,
    },
    meta: {
      depth,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      took: Date.now() - startTime,
    },
    requestId: input.requestId,
  };
}
```

#### 4. Create `apps/console/src/lib/v1/contents.ts`
**File**: `apps/console/src/lib/v1/contents.ts` (NEW)

Extract logic from `/v1/contents/route.ts:90-155` (ID resolution and content fetching).

```typescript
import { db } from "@db/console/client";
import { workspaceKnowledgeDocuments } from "@db/console/schema";
import { and, eq, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import type { V1ContentsResponse, V1ContentItem } from "@repo/console-types";
import { recordSystemActivity } from "@api/console/lib/activity";

import { buildSourceUrl } from "./url-builder";
import { resolveObservationsById } from "./id-resolver";
import type { ResolvedObservation } from "./id-resolver";
import type { V1AuthContext } from "./index";

export interface ContentsLogicInput {
  ids: string[];
  requestId: string;
}

export interface ContentsLogicOutput extends V1ContentsResponse {}

export async function contentsLogic(
  auth: V1AuthContext,
  input: ContentsLogicInput,
): Promise<ContentsLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/contents logic executing", { requestId: input.requestId, idCount: input.ids.length });

  // Separate IDs by type
  const docIds = input.ids.filter((id) => id.startsWith("doc_"));
  const obsIds = input.ids.filter((id) => !id.startsWith("doc_"));

  // Fetch in parallel
  const [observationMap, documents] = await Promise.all([
    obsIds.length > 0
      ? resolveObservationsById(auth.workspaceId, obsIds, {
          id: true,
          title: true,
          content: true,
          source: true,
          sourceId: true,
          observationType: true,
          occurredAt: true,
          metadata: true,
        })
      : Promise.resolve(new Map<string, ResolvedObservation>()),

    docIds.length > 0
      ? db
          .select({
            id: workspaceKnowledgeDocuments.id,
            sourceType: workspaceKnowledgeDocuments.sourceType,
            sourceId: workspaceKnowledgeDocuments.sourceId,
            sourceMetadata: workspaceKnowledgeDocuments.sourceMetadata,
          })
          .from(workspaceKnowledgeDocuments)
          .where(
            and(
              eq(workspaceKnowledgeDocuments.workspaceId, auth.workspaceId),
              inArray(workspaceKnowledgeDocuments.id, docIds)
            )
          )
      : Promise.resolve([]),
  ]);

  // Map to response format
  const items: V1ContentItem[] = [
    // Observations
    ...Array.from(observationMap.entries()).map(([reqId, obs]) => {
      const metadata = obs.metadata ?? {};
      return {
        id: reqId,
        title: obs.title,
        url: buildSourceUrl(obs.source, obs.sourceId, metadata),
        snippet: obs.content.slice(0, 200),
        content: obs.content,
        source: obs.source,
        type: obs.observationType,
        occurredAt: obs.occurredAt,
        metadata,
      } satisfies V1ContentItem;
    }),

    // Documents
    ...documents.map((doc) => {
      const metadata = doc.sourceMetadata as Record<string, unknown>;
      const frontmatter = (metadata.frontmatter ?? {}) as Record<string, unknown>;
      return {
        id: doc.id,
        title: typeof frontmatter.title === "string" ? frontmatter.title : doc.sourceId,
        url: buildSourceUrl(doc.sourceType, doc.sourceId, metadata),
        snippet: typeof frontmatter.description === "string" ? frontmatter.description : "",
        source: doc.sourceType,
        type: "file",
        metadata: frontmatter,
      };
    }),
  ];

  // Track missing IDs
  const foundRequestIds = new Set([
    ...observationMap.keys(),
    ...documents.map((d) => d.id),
  ]);
  const missing = input.ids.filter((id) => !foundRequestIds.has(id));

  if (missing.length > 0) {
    log.warn("v1/contents missing IDs", { requestId: input.requestId, missing });
  }

  // Track contents fetch (fire-and-forget)
  recordSystemActivity({
    workspaceId: auth.workspaceId,
    actorType: auth.authType === "api-key" ? "api" : "user",
    actorUserId: auth.userId,
    category: "search",
    action: "search.contents",
    entityType: "contents_fetch",
    entityId: input.requestId,
    metadata: {
      requestedCount: input.ids.length,
      foundCount: items.length,
      missingCount: missing.length,
      latencyMs: Date.now() - startTime,
      authType: auth.authType,
      apiKeyId: auth.apiKeyId,
    },
  });

  log.debug("v1/contents logic complete", {
    requestId: input.requestId,
    itemCount: items.length,
    missingCount: missing.length,
  });

  return {
    items,
    missing,
    requestId: input.requestId,
  };
}
```

#### 5. Create `apps/console/src/lib/v1/findsimilar.ts`
**File**: `apps/console/src/lib/v1/findsimilar.ts` (NEW)

Extract logic from `/v1/findsimilar/route.ts:265-415` (vector search and enrichment).

Note: This is the longest extraction. The route file is ~575 lines, but most of it is helper functions and setup. The core logic for a direct function call version needs careful extraction.

```typescript
import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProvider } from "@repo/console-embed";
import { getCachedWorkspaceConfig } from "@repo/console-workspace-cache";
import type { V1FindSimilarResponse, V1FindSimilarResult } from "@repo/console-types";
import { recordSystemActivity } from "@api/console/lib/activity";

import { resolveByUrl } from "./url-resolver";
import { buildSourceUrl } from "./url-builder";
import {
  resolveObservationById,
  resolveObservationsById,
} from "./id-resolver";
import type { V1AuthContext } from "./index";

interface SourceContent {
  id: string;
  internalId?: number;
  title: string;
  content: string;
  type: string;
  source: string;
  clusterId: number | null;
}

interface NormalizedMatch {
  observationId: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface FindSimilarLogicInput {
  id?: string;
  url?: string;
  limit: number;
  threshold: number;
  sameSourceOnly?: boolean;
  excludeIds?: string[];
  filters?: { sourceTypes?: string[]; observationTypes?: string[] };
  requestId: string;
}

export interface FindSimilarLogicOutput extends V1FindSimilarResponse {}

// Helper function: normalize vector IDs to observation IDs
async function normalizeAndDeduplicate(
  workspaceId: string,
  matches: { id: string; score: number; metadata?: Record<string, unknown> }[],
  requestId: string
): Promise<NormalizedMatch[]> {
  if (matches.length === 0) return [];

  const withObsId: typeof matches = [];
  const withoutObsId: typeof matches = [];

  for (const match of matches) {
    if (typeof match.metadata?.observationId === "string") {
      withObsId.push(match);
    } else {
      withoutObsId.push(match);
    }
  }

  const obsGroups = new Map<string, { score: number; metadata: Record<string, unknown> }>();

  for (const match of withObsId) {
    const metadata = match.metadata ?? {};
    const obsId = metadata.observationId as string;
    const existing = obsGroups.get(obsId);
    if (existing) {
      if (match.score > existing.score) {
        existing.score = match.score;
        existing.metadata = metadata;
      }
    } else {
      obsGroups.set(obsId, { score: match.score, metadata });
    }
  }

  if (withoutObsId.length > 0) {
    const vectorIds = withoutObsId.map((m) => m.id);

    const observations = await db
      .select({
        id: workspaceNeuralObservations.id,
        externalId: workspaceNeuralObservations.externalId,
        embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
        embeddingContentId: workspaceNeuralObservations.embeddingContentId,
        embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
        embeddingVectorId: workspaceNeuralObservations.embeddingVectorId,
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          or(
            inArray(workspaceNeuralObservations.embeddingTitleId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingContentId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingSummaryId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingVectorId, vectorIds)
          )
        )
      );

    const vectorToObs = new Map<string, string>();
    for (const obs of observations) {
      if (obs.embeddingTitleId) vectorToObs.set(obs.embeddingTitleId, obs.externalId);
      if (obs.embeddingContentId) vectorToObs.set(obs.embeddingContentId, obs.externalId);
      if (obs.embeddingSummaryId) vectorToObs.set(obs.embeddingSummaryId, obs.externalId);
      if (obs.embeddingVectorId) vectorToObs.set(obs.embeddingVectorId, obs.externalId);
    }

    for (const match of withoutObsId) {
      const obsId = vectorToObs.get(match.id);
      if (!obsId) {
        log.warn("Vector ID not found in database", { vectorId: match.id, requestId });
        continue;
      }

      const existing = obsGroups.get(obsId);
      if (existing) {
        if (match.score > existing.score) {
          existing.score = match.score;
          existing.metadata = match.metadata ?? {};
        }
      } else {
        obsGroups.set(obsId, { score: match.score, metadata: match.metadata ?? {} });
      }
    }
  }

  const results: NormalizedMatch[] = [];
  for (const [obsId, data] of obsGroups) {
    results.push({
      observationId: obsId,
      score: data.score,
      metadata: data.metadata,
    });
  }

  results.sort((a, b) => b.score - a.score);

  return results;
}

// Helper function: fetch source content
async function fetchSourceContent(
  workspaceId: string,
  contentId: string
): Promise<SourceContent | null> {
  if (contentId.startsWith("doc_")) {
    const doc = await db.query.workspaceKnowledgeDocuments.findFirst({
      columns: {
        id: true,
        sourceId: true,
        sourceType: true,
        sourceMetadata: true,
      },
      where: and(
        eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
        eq(workspaceKnowledgeDocuments.id, contentId)
      ),
    });

    if (doc) {
      const metadata = doc.sourceMetadata as Record<string, unknown>;
      const frontmatter = (metadata.frontmatter ?? {}) as Record<string, unknown>;
      return {
        id: doc.id,
        title: typeof frontmatter.title === "string" ? frontmatter.title : doc.sourceId,
        content: typeof frontmatter.description === "string" ? frontmatter.description : "",
        type: "file",
        source: doc.sourceType,
        clusterId: null,
      };
    }
    return null;
  }

  const obs = await resolveObservationById(workspaceId, contentId, {
    id: true,
    externalId: true,
    title: true,
    content: true,
    observationType: true,
    source: true,
    clusterId: true,
  });

  if (obs) {
    return {
      id: obs.externalId,
      internalId: obs.id,
      title: obs.title,
      content: obs.content,
      type: obs.observationType,
      source: obs.source,
      clusterId: obs.clusterId,
    };
  }

  return null;
}

// Helper function: enrich results
async function enrichResults(
  workspaceId: string,
  resultIds: string[],
  sourceClusterId: number | null
): Promise<
  Map<
    string,
    {
      title: string;
      url: string;
      source: string;
      type: string;
      occurredAt?: string;
      sameCluster: boolean;
      entityOverlap?: number;
    }
  >
> {
  const result = new Map<
    string,
    {
      title: string;
      url: string;
      source: string;
      type: string;
      occurredAt?: string;
      sameCluster: boolean;
      entityOverlap?: number;
    }
  >();

  if (resultIds.length === 0) return result;

  const obsIds = resultIds.filter((id) => !id.startsWith("doc_"));
  if (obsIds.length === 0) return result;

  const observationMap = await resolveObservationsById(workspaceId, obsIds, {
    id: true,
    externalId: true,
    title: true,
    source: true,
    sourceId: true,
    observationType: true,
    occurredAt: true,
    clusterId: true,
    metadata: true,
  });

  for (const [requestId, obs] of observationMap) {
    const metadata = obs.metadata ?? {};
    result.set(requestId, {
      title: obs.title,
      url: buildSourceUrl(obs.source, obs.sourceId, metadata),
      source: obs.source,
      type: obs.observationType,
      occurredAt: obs.occurredAt,
      sameCluster: sourceClusterId !== null && obs.clusterId === sourceClusterId,
    });
  }

  return result;
}

export async function findsimilarLogic(
  auth: V1AuthContext,
  input: FindSimilarLogicInput,
): Promise<FindSimilarLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/findsimilar logic executing", { requestId: input.requestId });

  // Resolve source content
  let sourceId = input.id;
  if (!sourceId && input.url) {
    const resolved = await resolveByUrl(auth.workspaceId, input.url);
    if (!resolved) {
      throw new Error(`URL not found in workspace: ${input.url}`);
    }
    sourceId = resolved.id;
  }

  if (!sourceId) {
    throw new Error("Either id or url must be provided");
  }

  // Fetch source content
  const sourceContent = await fetchSourceContent(auth.workspaceId, sourceId);
  if (!sourceContent) {
    throw new Error(`Content not found: ${sourceId}`);
  }

  // Get workspace config and generate embedding in parallel
  const [workspace, embedResult] = await Promise.all([
    getCachedWorkspaceConfig(auth.workspaceId),
    (async () => {
      const provider = createEmbeddingProvider({ inputType: "search_document" });
      return provider.embed([sourceContent.content]);
    })(),
  ]);

  if (!workspace) {
    throw new Error("Workspace not configured for search");
  }

  const embedding = embedResult.embeddings[0];
  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  // Build Pinecone filter
  const pineconeFilter: Record<string, unknown> = {
    layer: { $eq: "observations" },
  };

  if (input.sameSourceOnly) {
    pineconeFilter.source = { $eq: sourceContent.source };
  }

  if (input.filters?.sourceTypes?.length) {
    pineconeFilter.source = { $in: input.filters.sourceTypes };
  }

  if (input.filters?.observationTypes?.length) {
    pineconeFilter.observationType = { $in: input.filters.observationTypes };
  }

  // Query Pinecone
  const pineconeResults = await consolePineconeClient.query(
    workspace.indexName,
    {
      vector: embedding,
      topK: input.limit * 3,
      filter: pineconeFilter,
      includeMetadata: true,
    },
    workspace.namespaceName
  );

  // Normalize vector IDs to observation IDs
  const normalizedResults = await normalizeAndDeduplicate(
    auth.workspaceId,
    pineconeResults.matches as { id: string; score: number; metadata?: Record<string, unknown> }[],
    input.requestId
  );

  // Filter by observation ID and apply threshold
  const exclusions = new Set([sourceContent.id, ...(input.excludeIds ?? [])]);
  const filtered = normalizedResults
    .filter((m) => !exclusions.has(m.observationId) && m.score >= input.threshold)
    .slice(0, input.limit);

  // Enrich results
  const resultIds = filtered.map((m) => m.observationId);
  const enrichedData = await enrichResults(auth.workspaceId, resultIds, sourceContent.clusterId);

  // Build response
  const similar: V1FindSimilarResult[] = filtered.map((match) => {
    const data = enrichedData.get(match.observationId);
    const metadata = match.metadata;

    return {
      id: match.observationId,
      title: typeof metadata.title === "string" ? metadata.title : (data?.title ?? ""),
      url: data?.url ?? (typeof metadata.url === "string" ? metadata.url : ""),
      snippet: typeof metadata.snippet === "string" ? metadata.snippet : undefined,
      score: match.score,
      vectorSimilarity: match.score,
      entityOverlap: data?.entityOverlap,
      sameCluster: data?.sameCluster ?? false,
      source: typeof metadata.source === "string" ? metadata.source : (data?.source ?? ""),
      type:
        typeof metadata.observationType === "string"
          ? metadata.observationType
          : (data?.type ?? ""),
      occurredAt: data?.occurredAt,
    };
  });

  // Track activity
  recordSystemActivity({
    workspaceId: auth.workspaceId,
    actorType: auth.authType === "api-key" ? "api" : "user",
    actorUserId: auth.userId,
    category: "search",
    action: "search.findsimilar",
    entityType: "findsimilar_query",
    entityId: input.requestId,
    metadata: {
      sourceId: sourceContent.id,
      sourceType: sourceContent.type,
      inputMethod: input.id ? "id" : "url",
      limit: input.limit,
      threshold: input.threshold,
      similarCount: similar.length,
      latencyMs: Date.now() - startTime,
      authType: auth.authType,
      apiKeyId: auth.apiKeyId,
    },
  });

  log.debug("v1/findsimilar logic complete", {
    requestId: input.requestId,
    sourceId: sourceContent.id,
    similarCount: similar.length,
  });

  return {
    source: {
      id: sourceContent.id,
      title: sourceContent.title,
      type: sourceContent.type,
      cluster: undefined,
    },
    similar,
    meta: {
      total: filtered.length,
      took: Date.now() - startTime,
      inputEmbedding: {
        found: false,
        generated: true,
      },
    },
    requestId: input.requestId,
  };
}
```

#### 6. Create `apps/console/src/lib/v1/related.ts`
**File**: `apps/console/src/lib/v1/related.ts` (NEW)

Extract logic from `/v1/related/[id]/route.ts:66-152` (relationship lookup and formatting).

```typescript
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { and, eq, or, inArray, desc } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import type { V1AuthContext } from "./index";

export interface RelatedLogicInput {
  observationId: string;
  requestId: string;
}

interface RelatedItem {
  id: string;
  title: string;
  source: string;
  type: string;
  occurredAt: string | null;
  url: string | null;
  relationshipType: string;
  direction: "outgoing" | "incoming";
}

export interface RelatedLogicOutput {
  data: {
    source: {
      id: string;
      title: string;
      source: string;
    };
    related: RelatedItem[];
    bySource: Record<string, RelatedItem[]>;
  };
  meta: {
    total: number;
    took: number;
  };
  requestId: string;
}

export async function relatedLogic(
  auth: V1AuthContext,
  input: RelatedLogicInput,
): Promise<RelatedLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/related logic executing", { requestId: input.requestId, observationId: input.observationId });

  // Step 1: Get the source observation
  const sourceObs = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, auth.workspaceId),
      eq(workspaceNeuralObservations.externalId, input.observationId)
    ),
    columns: {
      id: true,
      externalId: true,
      title: true,
      source: true,
    },
  });

  if (!sourceObs) {
    throw new Error(`Observation not found: ${input.observationId}`);
  }

  // Step 2: Find direct relationships
  const relationships = await db
    .select()
    .from(workspaceObservationRelationships)
    .where(
      and(
        eq(workspaceObservationRelationships.workspaceId, auth.workspaceId),
        or(
          eq(workspaceObservationRelationships.sourceObservationId, sourceObs.id),
          eq(workspaceObservationRelationships.targetObservationId, sourceObs.id)
        )
      )
    );

  // Step 3: Collect related observation IDs
  const relatedIds = new Set<number>();
  const relMap = new Map<number, { type: string; direction: "outgoing" | "incoming" }>();

  for (const rel of relationships) {
    if (rel.sourceObservationId === sourceObs.id) {
      relatedIds.add(rel.targetObservationId);
      relMap.set(rel.targetObservationId, {
        type: rel.relationshipType,
        direction: "outgoing",
      });
    } else {
      relatedIds.add(rel.sourceObservationId);
      relMap.set(rel.sourceObservationId, {
        type: rel.relationshipType,
        direction: "incoming",
      });
    }
  }

  // Step 4: Fetch related observations
  const relatedObs = relatedIds.size > 0
    ? await db
        .select({
          id: workspaceNeuralObservations.id,
          externalId: workspaceNeuralObservations.externalId,
          title: workspaceNeuralObservations.title,
          source: workspaceNeuralObservations.source,
          observationType: workspaceNeuralObservations.observationType,
          occurredAt: workspaceNeuralObservations.occurredAt,
          metadata: workspaceNeuralObservations.metadata,
        })
        .from(workspaceNeuralObservations)
        .where(
          and(
            eq(workspaceNeuralObservations.workspaceId, auth.workspaceId),
            inArray(workspaceNeuralObservations.id, Array.from(relatedIds))
          )
        )
        .orderBy(desc(workspaceNeuralObservations.occurredAt))
    : [];

  // Step 5: Format response
  const related: RelatedItem[] = relatedObs.map((obs) => {
    const relInfo = relMap.get(obs.id);
    const metadata = obs.metadata as Record<string, unknown> | undefined;
    const metadataUrl = metadata?.url;
    return {
      id: obs.externalId,
      title: obs.title,
      source: obs.source,
      type: obs.observationType,
      occurredAt: obs.occurredAt,
      url: typeof metadataUrl === "string" ? metadataUrl : null,
      relationshipType: relInfo?.type ?? "references",
      direction: relInfo?.direction ?? "outgoing",
    };
  });

  // Group by source
  const bySource: Record<string, RelatedItem[]> = {
    github: related.filter((r) => r.source === "github"),
    vercel: related.filter((r) => r.source === "vercel"),
    sentry: related.filter((r) => r.source === "sentry"),
    linear: related.filter((r) => r.source === "linear"),
  };

  // Remove empty arrays
  for (const key of Object.keys(bySource)) {
    if (bySource[key]?.length === 0) {
      delete bySource[key];
    }
  }

  log.debug("v1/related logic complete", {
    requestId: input.requestId,
    total: related.length,
  });

  return {
    data: {
      source: {
        id: sourceObs.externalId,
        title: sourceObs.title,
        source: sourceObs.source,
      },
      related,
      bySource,
    },
    meta: {
      total: related.length,
      took: Date.now() - startTime,
    },
    requestId: input.requestId,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Files created: `apps/console/src/lib/v1/{index,search,graph,contents,findsimilar,related}.ts`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] No linting errors: `pnpm lint`
- [ ] All functions properly typed and exported from `index.ts`
- [ ] No `NextRequest` or `NextResponse` imports in v1 logic files

#### Manual Verification:
- [ ] Read through each extracted function to verify logic is identical to route handler
- [ ] Confirm all imports are available (neural helpers, packages, db)
- [ ] Verify no HTTP-specific logic leaked into extracted functions

---

## Phase 2: Rewire Answer Tools

### Overview
Update the 5 answer tools to call the extracted functions directly instead of using `fetch()`. This removes the Clerk middleware interference.

### Changes Required

#### 1. Update `apps/console/src/ai/tools/search.ts`
**File**: `apps/console/src/ai/tools/search.ts`

Replace the fetch-based implementation with direct function call:

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { searchLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceSearchTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Search through workspace neural memory for relevant documents and observations. Use this to find commits, PRs, issues, deployments, and other development events. Returns ranked results with scores, snippets, source types, and extracted entities.",
    inputSchema: z.object({
      query: z.string().describe("The search query text"),
      mode: z
        .enum(["fast", "balanced", "thorough"])
        .default("balanced")
        .describe("Search quality mode"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
        .describe("Max results"),
      filters: z
        .object({
          sourceTypes: z
            .array(z.string())
            .optional()
            .describe("Filter by source: github, linear, vercel, sentry"),
          observationTypes: z
            .array(z.string())
            .optional()
            .describe(
              "Filter by type: commit, pull_request, issue, deployment",
            ),
          actorNames: z
            .array(z.string())
            .optional()
            .describe("Filter by actor name"),
        })
        .optional(),
    }),
    execute: async (input, context) => {
      const runtimeContext =
        context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId, userId } = runtimeContext;

      const result = await searchLogic(
        {
          workspaceId,
          userId,
          authType: "session",
        },
        {
          query: input.query,
          mode: input.mode,
          limit: input.limit,
          offset: 0,
          filters: input.filters,
          includeContext: true,
          includeHighlights: true,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
```

#### 2. Update `apps/console/src/ai/tools/graph.ts`
**File**: `apps/console/src/ai/tools/graph.ts`

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { graphLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceGraphTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Traverse the relationship graph between events. Use this to answer questions like 'which PR fixed which issue' or 'which deploy included which commits'. Returns connected nodes and their relationships across sources.",
    inputSchema: z.object({
      id: z.string().describe("The observation ID to traverse from"),
      depth: z
        .number()
        .int()
        .min(1)
        .max(3)
        .default(1)
        .describe("Relationship depth to traverse"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Max relationships to return"),
    }),
    execute: async (input, context) => {
      const runtimeContext = context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId } = runtimeContext;

      const result = await graphLogic(
        {
          workspaceId,
          userId: runtimeContext.userId,
          authType: "session",
        },
        {
          observationId: input.id,
          depth: input.depth,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
```

#### 3. Update `apps/console/src/ai/tools/contents.ts`
**File**: `apps/console/src/ai/tools/contents.ts`

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { contentsLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceContentsTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Fetch full content for specific observations by ID. Use this to get the complete details of a document after finding it via search or related queries.",
    inputSchema: z.object({
      ids: z
        .array(z.string())
        .describe("Array of observation IDs to fetch content for"),
    }),
    execute: async (input, context) => {
      const runtimeContext = context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId, userId } = runtimeContext;

      const result = await contentsLogic(
        {
          workspaceId,
          userId,
          authType: "session",
        },
        {
          ids: input.ids,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
```

#### 4. Update `apps/console/src/ai/tools/find-similar.ts`
**File**: `apps/console/src/ai/tools/find-similar.ts`

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { findsimilarLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceFindSimilarTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Find semantically similar content to a given document. Use this to discover related observations, expand search results, or find alternatives to a specific document.",
    inputSchema: z.object({
      id: z.string().describe("The observation ID to find similar items for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Max similar items to return"),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .default(0.5)
        .describe("Similarity threshold (0-1)"),
    }),
    execute: async (input, context) => {
      const runtimeContext = context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId, userId } = runtimeContext;

      const result = await findsimilarLogic(
        {
          workspaceId,
          userId,
          authType: "session",
        },
        {
          id: input.id,
          limit: input.limit,
          threshold: input.threshold,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
```

#### 5. Update `apps/console/src/ai/tools/related.ts`
**File**: `apps/console/src/ai/tools/related.ts`

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { relatedLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceRelatedTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Get directly related events for a specific observation. Use this to find what happened around a particular event or to understand context. Returns related observations grouped by relationship type and source.",
    inputSchema: z.object({
      id: z
        .string()
        .describe("The observation ID to find related events for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Max related items to return"),
    }),
    execute: async (input, context) => {
      const runtimeContext = context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId, userId } = runtimeContext;

      const result = await relatedLogic(
        {
          workspaceId,
          userId,
          authType: "session",
        },
        {
          observationId: input.id,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] All tools import from `~/lib/v1`: `pnpm grep "from \"~/lib/v1\"" apps/console/src/ai/tools/`
- [ ] No `fetch()` calls in tools: `pnpm grep -L "fetch" apps/console/src/ai/tools/*.ts`
- [ ] No `createBaseUrl()` imports: `pnpm grep -L "createBaseUrl" apps/console/src/ai/tools/*.ts`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Each tool file has 1 import from `~/lib/v1`
- [ ] Each tool's `execute()` creates the correct auth context with `workspaceId`, `userId`, `authType`
- [ ] Each tool calls the corresponding extracted function (`searchLogic`, `graphLogic`, etc.)
- [ ] Tool input/output is identical to before (Zod schemas unchanged)

---

## Phase 3: Simplify Route Handlers

### Overview
Route handlers become thin wrappers around the extracted functions. They handle:
1. Parsing request (body, URL params)
2. Validating via `withDualAuth()`
3. Calling extracted function
4. Logging and activity recording
5. Returning response

The extracted logic is reused by both tools and routes.

### Changes Required

#### 1. Update `apps/console/src/app/(api)/v1/search/route.ts`
**File**: `apps/console/src/app/(api)/v1/search/route.ts`

Replace POST handler to use extracted logic:

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
import { V1SearchRequestSchema } from "@repo/console-types";

import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../lib/with-dual-auth";
import { searchLogic } from "~/lib/v1";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/search request", { requestId });

  try {
    // 1. Authenticate via API key or session
    const authStart = Date.now();
    const authResult = await withDualAuth(request, requestId);
    const authLatency = Date.now() - authStart;

    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, authType } = authResult.auth;

    log.info("v1/search authenticated", {
      requestId,
      workspaceId,
      userId,
      authType,
      apiKeyId: authResult.auth.apiKeyId,
      authLatency,
    });

    // 2. Parse and validate request body
    const parseStart = Date.now();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 },
      );
    }

    const parseResult = V1SearchRequestSchema.safeParse(body);
    const parseLatency = Date.now() - parseStart;

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 },
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

    // 3. Call extracted logic
    const response = await searchLogic(
      { workspaceId, userId, authType, apiKeyId: authResult.auth.apiKeyId },
      {
        query,
        limit,
        offset,
        mode,
        filters,
        includeContext,
        includeHighlights,
        requestId,
      }
    );

    // Update latency metrics to include auth and parse time
    response.latency.auth = authLatency;
    response.latency.parse = parseLatency;
    response.latency.total = Date.now() - startTime;

    log.info("v1/search complete", {
      requestId,
      resultCount: response.data.length,
      latency: response.latency,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/search error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Search failed",
        requestId,
      },
      { status: 500 },
    );
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: "METHOD_NOT_ALLOWED", message: "Use POST method" },
    { status: 405 },
  );
}
```

#### 2. Update `apps/console/src/app/(api)/v1/graph/[id]/route.ts`
**File**: `apps/console/src/app/(api)/v1/graph/[id]/route.ts`

```typescript
/**
 * Graph API
 *
 * GET /v1/graph/{observationId}?depth=2&types=fixes,deploys
 *
 * Traverses the relationship graph from a starting observation.
 * Returns connected observations with relationship edges.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { log } from "@vendor/observability/log";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../../lib/with-dual-auth";
import { graphLogic } from "~/lib/v1";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id: observationId } = await params;

  log.info("v1/graph request", { requestId, observationId });

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const depth = Math.min(parseInt(searchParams.get("depth") ?? "2", 10), 3);
    const typesParam = searchParams.get("types");
    const allowedTypes = typesParam ? typesParam.split(",") : null;

    // Authenticate
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    // Call extracted logic
    const result = await graphLogic(
      { workspaceId, userId: authResult.auth.userId, authType: authResult.auth.authType },
      {
        observationId,
        depth,
        allowedTypes,
        requestId,
      }
    );

    log.info("v1/graph complete", {
      requestId,
      nodeCount: result.data.nodes.length,
      edgeCount: result.data.edges.length,
      depth,
      took: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error("v1/graph error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Graph traversal failed",
        requestId,
      },
      { status: 500 }
    );
  }
}
```

#### 3. Update `apps/console/src/app/(api)/v1/contents/route.ts`
**File**: `apps/console/src/app/(api)/v1/contents/route.ts`

```typescript
/**
 * POST /v1/contents - Fetch Content by IDs
 *
 * Fetch full content for documents and observations.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - ids: string[] (required) - Content IDs (doc_* or obs_*)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { log } from "@vendor/observability/log";
import { V1ContentsRequestSchema } from "@repo/console-types";

import { withDualAuth, createDualAuthErrorResponse } from "../lib/with-dual-auth";
import { contentsLogic } from "~/lib/v1";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/contents request", { requestId });

  try {
    // 1. Authenticate via API key or session
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, authType } = authResult.auth;

    log.info("v1/contents authenticated", {
      requestId,
      workspaceId,
      userId,
      authType,
      apiKeyId: authResult.auth.apiKeyId,
    });

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

    const parseResult = V1ContentsRequestSchema.safeParse(body);
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

    const { ids } = parseResult.data;

    log.info("v1/contents validated", { requestId, idCount: ids.length });

    // 3. Call extracted logic
    const response = await contentsLogic(
      { workspaceId, userId, authType, apiKeyId: authResult.auth.apiKeyId },
      { ids, requestId }
    );

    log.info("v1/contents complete", {
      requestId,
      itemCount: response.items.length,
      missingCount: response.missing.length,
      latency: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/contents error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch contents",
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

#### 4. Update `apps/console/src/app/(api)/v1/findsimilar/route.ts`
**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

Significant simplification - replace most of the file with thin wrapper:

```typescript
/**
 * POST /v1/findsimilar - Find Similar Content
 *
 * Find content similar to a given document or observation.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - id: string (optional) - Content ID to find similar items for
 * - url: string (optional) - URL to find similar items for
 * - limit: number (1-50, default 10)
 * - threshold: number (0-1, default 0.5)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { log } from "@vendor/observability/log";
import { V1FindSimilarRequestSchema } from "@repo/console-types";

import { withDualAuth, createDualAuthErrorResponse } from "../lib/with-dual-auth";
import { findsimilarLogic } from "~/lib/v1";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/findsimilar request", { requestId });

  try {
    // 1. Authenticate via API key or session
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, authType } = authResult.auth;

    log.info("v1/findsimilar authenticated", {
      requestId,
      workspaceId,
      userId,
      authType,
      apiKeyId: authResult.auth.apiKeyId,
    });

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

    const parseResult = V1FindSimilarRequestSchema.safeParse(body);
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

    const { id, url, limit, threshold, sameSourceOnly, excludeIds, filters } = parseResult.data;

    // 3. Call extracted logic
    const response = await findsimilarLogic(
      { workspaceId, userId, authType, apiKeyId: authResult.auth.apiKeyId },
      {
        id,
        url,
        limit,
        threshold,
        sameSourceOnly,
        excludeIds,
        filters,
        requestId,
      }
    );

    log.info("v1/findsimilar complete", {
      requestId,
      sourceId: response.source.id,
      similarCount: response.similar.length,
      latency: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/findsimilar error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to find similar content",
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

#### 5. Update `apps/console/src/app/(api)/v1/related/[id]/route.ts`
**File**: `apps/console/src/app/(api)/v1/related/[id]/route.ts`

```typescript
/**
 * Related Events API
 *
 * GET /v1/related/{observationId}
 *
 * Returns observations directly connected to the given observation
 * via the relationship graph. Simpler than full graph traversal.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { log } from "@vendor/observability/log";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../../lib/with-dual-auth";
import { relatedLogic } from "~/lib/v1";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id: observationId } = await params;

  log.info("v1/related request", { requestId, observationId });

  try {
    // Authenticate
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    // Call extracted logic
    const result = await relatedLogic(
      { workspaceId, userId: authResult.auth.userId, authType: authResult.auth.authType },
      {
        observationId,
        requestId,
      }
    );

    log.info("v1/related complete", {
      requestId,
      total: result.data.related.length,
      took: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error("v1/related error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Related lookup failed",
        requestId,
      },
      { status: 500 }
    );
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] All route handlers import from `~/lib/v1`: `pnpm grep "from \"~/lib/v1\"" apps/console/src/app/\(api\)/v1/*/route.ts`
- [ ] All route handlers use extracted functions
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] No linter issues with async/await in routes
- [ ] Answer API integration tests pass: `pnpm --filter apps/console test`

#### Manual Verification:
- [ ] Each route handler calls the correct extracted function
- [ ] Each route handler passes correct auth context
- [ ] Response structure matches original (for backward compatibility with external API)
- [ ] Logging is equivalent to original route handlers
- [ ] Error handling is equivalent to original

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the answer API feature works correctly when tested via UI before proceeding.

---

## Testing Strategy

### Unit Tests
- [ ] Each extracted function in isolation with mocked database
- [ ] Tool input/output validation
- [ ] Auth context handling

### Integration Tests
- [ ] Answer API full flow: tool execution → result return
- [ ] Multiple tools in sequence (search → contents → graph)
- [ ] Error handling (missing observations, invalid IDs, empty results)
- [ ] All 5 tools work correctly

### Manual Testing Steps
1. Start dev server: `pnpm dev:app`
2. Open console UI at `http://localhost:3024`
3. Create a test query that uses multiple tools:
   - Search for an observation
   - Fetch its full contents
   - Traverse its relationship graph
   - Find similar items
   - Get related events
4. Verify all results are correct and latency is reasonable
5. Check browser console for any errors
6. Test in preview deployment (Vercel) if available

### Performance Verification
- [ ] Answer latency reduced (no HTTP roundtrips)
- [ ] Tool execution latency improved (direct function calls)
- [ ] No increased database load (same queries as before)

## Migration Notes

### No Breaking Changes
- v1 routes remain public API endpoints (can still be called via HTTP by external API key users)
- Tool input/output schemas unchanged
- System prompts unchanged
- Agent behavior unchanged

### Backward Compatibility
- External API consumers using `/v1/search` with API keys continue to work
- Route handlers call extracted functions (same logic)
- Response formats identical

### Rollback Plan
If issues arise:
1. Revert `apps/console/src/ai/tools/*.ts` to use `fetch()` again
2. Keep extracted functions in place (they can remain unused)
3. No database or schema changes needed
4. No configuration changes needed

## References

- Clerk middleware analysis: `thoughts/shared/research/2026-02-06-web-analysis-clerk-middleware-auth-header-stripping.md`
- Answer API architecture: Analyzed in planning phase
- V1 route implementations: `/v1/{search,graph,contents,findsimilar,related}`
- Tool implementations: `apps/console/src/ai/tools/*.ts`

---

**Created**: 2026-02-06
**Status**: Ready for implementation
**Priority**: High - Unblocks answer feature
**Estimated Effort**: 4-6 hours (extraction + testing)

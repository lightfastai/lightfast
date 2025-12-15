---
date: 2025-12-14T06:02:48Z
researcher: Claude
git_commit: 5bc0bf4322d8d478b2ad6311f812804741137ec8
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Week 1 Day 2: /v1/search Route Implementation Research"
tags: [research, neural-memory, public-api, search, v1-routes, day2, week1]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Neural Memory Week 1 Day 2 - /v1/search Route Implementation

**Date**: 2025-12-14T06:02:48Z
**Researcher**: Claude
**Git Commit**: 5bc0bf4322d8d478b2ad6311f812804741137ec8
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Document the existing implementation patterns needed to create the public `/v1/search` route with mode-based reranking, including:
1. Internal search route structure and 4-path parallel retrieval
2. API key authentication extraction from tRPC to Next.js route handlers
3. Neural search utility functions
4. Search type definitions and schemas

## Summary

This research documents all components required for Day 2 of the Neural Memory Week 1 plan. The internal search route at `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts` provides a complete reference implementation with 4-path parallel retrieval, LLM filtering, and comprehensive latency tracking. The API key authentication in tRPC (`api/console/src/trpc.ts:530-576`) uses header-based Bearer token extraction with SHA-256 hashing and can be adapted for Next.js route handlers. The neural search utilities provide modular entity, cluster, and actor search implementations. The type system is well-defined in `packages/console-types/` with Zod schemas and TypeScript types.

---

## Detailed Findings

### 1. Internal Search Route Implementation

**Location**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

#### Entry Points
- `POST` handler at line 186 - main search endpoint
- `GET` handler at line 489 - returns 405 Method Not Allowed

#### Request Processing Flow

**Authentication (lines 198-205)**
- Uses Clerk session auth via `auth()` from `@clerk/nextjs/server`
- Returns 401 with `requestId` if `userId` is null

**Request Schema (lines 59-63)**
```typescript
{
  query: string (min 1 char),
  topK: number (1-100, default 10),
  filters?: {
    sourceTypes?: string[],
    observationTypes?: string[],
    actorNames?: string[],
    dateRange?: { start?: datetime, end?: datetime }
  }
}
```

**Workspace Resolution (lines 240-257)**
- Calls `resolveWorkspaceByName()` from `packages/console-auth-middleware/src/workspace.ts:172`
- Verifies org access via Clerk API
- Checks user is org member
- Queries workspace by `clerkOrgId` and `name`

#### 4-Path Parallel Retrieval (lines 324-359)

All paths execute concurrently via `Promise.all()`:

| Path | Function | Purpose | Latency |
|------|----------|---------|---------|
| Vector | Pinecone query | Semantic similarity search | ~50ms |
| Entity | `searchByEntities()` | Pattern-based entity matching | ~30ms |
| Cluster | `searchClusters()` | Topic cluster context | ~40ms |
| Actor | `searchActorProfiles()` | Contributor relevance | ~25ms |

**Query Embedding Generation (lines 292-318)**
- Creates embedding provider using workspace config
- Uses `workspace.embeddingModel` and `workspace.embeddingDim`
- Sets `inputType: "search_query"` for query-optimized embeddings

**Pinecone Filter Construction (lines 98-132)**
```typescript
function buildPineconeFilter(filters?: SearchFilters) {
  // Always filter to observations layer
  filter.layer = { $eq: "observations" };

  // Add optional filters with MongoDB-style operators
  if (filters?.sourceTypes) filter.source = { $in: [...] };
  if (filters?.observationTypes) filter.observationType = { $in: [...] };
  // ... etc
}
```

#### Result Merging Logic (lines 138-176)

**Merge Function** at line 375:
1. Creates `Map<string, FilterCandidate>` for deduplication
2. Adds vector results with their Pinecone scores
3. For entity matches:
   - If already exists: boosts score by 0.2 (max 1.0)
   - If new: adds with base score `0.85 * entity.confidence`
4. Sorts by score descending
5. Slices to `topK` limit

#### LLM Filter Integration (line 382)

**Location**: `apps/console/src/lib/neural/llm-filter.ts:66-162`

**Bypass Logic (lines 74-92)**
- Skips LLM if `candidates.length <= 5`
- Returns candidates with `relevanceScore = vectorScore`

**LLM Scoring (lines 94-126)**
```typescript
// Model: anthropic/claude-haiku-4.5
// Schema: array of { id, relevance } objects
// Temperature: 0.1

// Score combination:
relevanceScore = scoreMap.get(id) ?? 0.5
finalScore = 0.6 * relevanceScore + 0.4 * vectorScore
```

**Fallback on Error (lines 143-161)**
- Falls back to vector scores only
- Sets `bypassed: true`

#### Response Structure (lines 423-435)

```typescript
{
  results: SearchResult[],
  requestId: string,
  context?: {
    clusters: { topic, summary, keywords }[],
    relevantActors: { displayName, expertiseDomains }[]
  },
  latency: {
    total: number,
    retrieval: number,
    entitySearch: number,
    clusterSearch: number,
    actorSearch: number,
    llmFilter: number
  }
}
```

---

### 2. API Key Authentication

#### tRPC apiKeyProcedure (lines 530-576)

**Header Extraction**
```typescript
// Authorization header (line 534-543)
const authHeader = ctx.headers.get("authorization");
if (!authHeader?.startsWith("Bearer ")) {
  throw new TRPCError({ code: "UNAUTHORIZED", message: "API key required..." });
}
const apiKey = authHeader.slice(7);

// X-Workspace-ID header (line 545-553)
const workspaceId = ctx.headers.get("x-workspace-id");
if (!workspaceId) {
  throw new TRPCError({ code: "BAD_REQUEST", message: "Workspace ID required..." });
}
```

**Context Injection (lines 565-575)**
```typescript
return next({
  ctx: {
    ...ctx,
    auth: {
      type: "apiKey" as const,
      workspaceId,
      userId,
      apiKeyId,
    },
  },
});
```

#### verifyApiKey Function (lines 790-845)

**Key Hashing (line 799)**
```typescript
const keyHash = await hashApiKey(key);
```

**Database Query (lines 802-811)**
```typescript
const [apiKey] = await db
  .select({ id, userId, isActive, expiresAt })
  .from(userApiKeys)
  .where(and(
    eq(userApiKeys.keyHash, keyHash),
    eq(userApiKeys.isActive, true)
  ))
  .limit(1);
```

**Expiration Check (lines 820-826)**
```typescript
if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
  throw new TRPCError({ code: "UNAUTHORIZED", message: "API key expired" });
}
```

**Last Used Update (lines 828-838)**
- Non-blocking update using `void` keyword
- Does not throw on failure

#### hashApiKey Function

**Location**: `packages/console-api-key/src/crypto.ts:65-71`

```typescript
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
```

#### API Key Format

**Location**: `packages/console-api-key/src/crypto.ts:14-25`

- Default prefix: `console_sk_`
- Alternative prefix: `lf_`
- Secret length: 32 characters
- Full format: `<prefix><32-char-nanoid>`

---

### 3. Neural Search Utilities

#### Entity Search

**Location**: `apps/console/src/lib/neural/entity-search.ts`

**Function**: `searchByEntities(query, workspaceId, limit = 10)`

**Entity Extraction Patterns (lines 10-39)**
| Pattern | Category | Example |
|---------|----------|---------|
| `@username` | engineer | `@sarah` |
| `#123` | project | `#456` |
| `ABC-123` | project | `ENG-789` |
| `GET /path` | endpoint | `POST /api/users` |

**Process Flow**
1. Extract entity patterns from query using regex
2. Query `workspaceNeuralEntities` for matching keys
3. Fetch linked observations via `sourceObservationId`
4. Build results with title, snippet (200 chars), confidence

**Return Type**: `EntitySearchResult[]`

#### Cluster Search

**Location**: `apps/console/src/lib/neural/cluster-search.ts`

**Function**: `searchClusters(workspaceId, indexName, namespace, queryEmbedding, topK = 3)`

**Process Flow**
1. Query Pinecone with `filter: { layer: { $eq: "clusters" } }`
2. Extract cluster embedding IDs from matches
3. Query `workspaceObservationClusters` for metadata
4. Merge Pinecone scores with DB metadata
5. Sort by score descending

**Return Type**: `{ results: ClusterSearchResult[]; latency: number }`

#### Actor Search

**Location**: `apps/console/src/lib/neural/actor-search.ts`

**Function**: `searchActorProfiles(workspaceId, query, topK = 5)`

**Matching Strategies**
| Match Type | Score | Description |
|------------|-------|-------------|
| `mention` | 0.95 | `@username` pattern match |
| `name` | 0.75 | Display name fuzzy match |

**Process Flow**
1. Extract @mentions and quoted names from query
2. Search `workspaceActorIdentities` by username (ILIKE)
3. Search `workspaceActorProfiles` by display name
4. Combine and sort by score, then observation count

**Return Type**: `{ results: ActorSearchResult[]; latency: number }`

---

### 4. Type Definitions and Schemas

#### Search Request/Response (`packages/console-types/src/api/search.ts`)

**SearchRequestSchema (lines 13-27)**
```typescript
{
  query: z.string().min(1),
  topK: z.number().int().min(1).max(100).default(10),
  filters: z.object({
    labels: z.array(z.string()).optional(),
  }).optional(),
  includeHighlights: z.boolean().default(true),
}
```

**SearchResultSchema (lines 34-47)**
```typescript
{
  id: z.string(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  score: z.number(),
  metadata: z.record(z.unknown()),
}
```

#### Common Types (`packages/console-types/src/api/common.ts`)

**LatencySchema (lines 15-20)**
```typescript
{
  total: z.number().nonnegative(),
  retrieval: z.number().nonnegative(),
  llmFilter: z.number().optional(),
  rerank: z.number().optional(),
}
```

**PaginationSchema (lines 27-30)**
```typescript
{
  limit: z.number().int().min(1).max(100).default(10),
  cursor: z.string().optional(),
}
```

#### Rerank Types (`packages/console-rerank/src/types.ts`)

**RerankCandidate (lines 12-32)**
```typescript
{
  id: string;
  title: string;
  content: string;
  score: number;  // Original vector score 0-1
}
```

**RerankResult (lines 37-57)**
```typescript
{
  id: string;
  score: number;        // Final reranked score
  relevance: number;    // Provider-specific score
  originalScore: number; // Preserved vector score
}
```

**RerankMode (line 144)**
```typescript
type RerankMode = "fast" | "balanced" | "thorough";
```

---

## Code References

### Internal Search Route
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:186` - POST handler
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:324-359` - 4-path parallel retrieval
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:375` - Result merging

### API Key Authentication
- `api/console/src/trpc.ts:530-576` - apiKeyProcedure middleware
- `api/console/src/trpc.ts:790-845` - verifyApiKey function
- `packages/console-api-key/src/crypto.ts:65-71` - hashApiKey function
- `db/console/src/schema/tables/user-api-keys.ts:27-115` - Database schema

### Neural Search Utilities
- `apps/console/src/lib/neural/entity-search.ts:71-150` - searchByEntities
- `apps/console/src/lib/neural/cluster-search.ts:19-94` - searchClusters
- `apps/console/src/lib/neural/actor-search.ts:41-140` - searchActorProfiles
- `apps/console/src/lib/neural/llm-filter.ts:66-162` - llmRelevanceFilter

### Type Definitions
- `packages/console-types/src/api/search.ts:13-63` - Search schemas
- `packages/console-types/src/api/common.ts:10-32` - Common types
- `packages/console-rerank/src/types.ts:12-144` - Rerank types

---

## Implementation Map for /v1/search

### Files to Create

```
apps/console/src/app/(api)/v1/
├── search/
│   └── route.ts              # POST /v1/search
└── lib/
    └── with-api-key-auth.ts  # API key middleware wrapper
```

### Reusable Components

| Component | Source | Usage |
|-----------|--------|-------|
| Query embedding | `route.ts:292-318` | Generate embedding for query |
| Pinecone filter builder | `route.ts:98-132` | Construct metadata filters |
| Result merger | `route.ts:138-176` | Combine multi-path results |
| Latency tracking | `route.ts:190, 322, 361-372` | Performance metrics |

### API Key Middleware Pattern

Extract from tRPC to standalone middleware:

```typescript
// apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts
export async function withApiKeyAuth(request: NextRequest): Promise<AuthResult> {
  // 1. Extract Authorization: Bearer <token>
  // 2. Extract X-Workspace-ID header
  // 3. Hash and verify via verifyApiKey()
  // 4. Return { workspaceId, userId, apiKeyId } or error
}
```

### Integration with Rerank Package

```typescript
// In /v1/search route handler
import { createRerankProvider } from "@repo/console-rerank";

// After 4-path retrieval
const reranker = createRerankProvider(mode); // "fast" | "balanced" | "thorough"
const reranked = await reranker.rerank(query, candidates, { topK: limit });
```

---

## Key Patterns

### Parallel Execution
- `Promise.all()` for independent operations
- Each path wrapped in async IIFE with latency tracking
- Graceful degradation - failures don't block other paths

### Score Combination
- Entity confirmation boosts vector score by 0.2
- LLM filter: `0.6 * llmScore + 0.4 * vectorScore`
- Minimum threshold filtering at 0.4

### Error Handling
- JSON parse errors → 400
- Validation errors → 400 with field details
- Workspace access errors → 403/404
- LLM failures → fallback to vector scores

### Observability
- Request ID for distributed tracing
- Latency tracking at every stage
- Structured logging via `@vendor/observability/log`

---

## Related Documents

- `thoughts/shared/plans/2025-12-14-neural-memory-week1-public-api-rerank.md` - Week 1 implementation plan
- `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md` - Complete API design
- `thoughts/shared/research/2025-12-14-neural-memory-week1-day1-rerank-package.md` - Day 1 rerank package research

---

## Open Questions

1. **Rate Limiting**: Should the `/v1/search` route include rate limiting in initial implementation?
2. **Caching**: Should identical query+filters combinations be cached?
3. **Mode Default**: Should `balanced` be the default mode, or should it require explicit specification?
4. **Filter Extensions**: Should v1 API support all internal filters (sourceTypes, actorNames, dateRange) immediately?

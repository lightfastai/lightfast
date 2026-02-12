---
date: 2026-02-07T12:00:00+08:00
researcher: claude
git_commit: 96ddaa6d76f062182ba1ce2e096a7a539cc2bdc9
branch: feat/memory-connector-backfill
repository: lightfast-product-demo
topic: "V1 FindSimilar API Route Setup and Full Code Flow Trace"
tags: [research, codebase, findsimilar, v1-api, vector-search, dual-auth, pinecone, cohere]
status: complete
last_updated: 2026-02-07
last_updated_by: claude
---

# Research: V1 FindSimilar API Route Setup and Full Code Flow Trace

**Date**: 2026-02-07T12:00:00+08:00
**Researcher**: claude
**Git Commit**: 96ddaa6d76f062182ba1ce2e096a7a539cc2bdc9
**Branch**: feat/memory-connector-backfill
**Repository**: lightfast-product-demo

## Research Question
Check whether `/v1/findsimilar` is correctly setup in `apps/console/src/app/(api)/v1/findsimilar/` and trace the flow of code back to the API level.

## Summary

The `/v1/findsimilar` endpoint is a fully wired Next.js App Router route at `apps/console/src/app/(api)/v1/findsimilar/route.ts`. It follows the same architectural pattern as all other v1 endpoints (search, contents, graph, related, answer): a thin route handler that delegates to extracted business logic in `apps/console/src/lib/v1/findsimilar.ts`. The route authenticates via dual auth (API key or Clerk session), validates the request body against `V1FindSimilarRequestSchema` from `@repo/console-types`, then calls `findsimilarLogic()` which orchestrates embedding generation (Cohere), vector search (Pinecone), deduplication, and metadata enrichment from the database.

## Detailed Findings

### 1. Route Handler (`apps/console/src/app/(api)/v1/findsimilar/route.ts`)

The route exports two handlers:

**POST** (line 27-114): The main handler with this flow:
1. Generates a `requestId` via `randomUUID()` (line 29)
2. Authenticates via `withDualAuth(request, requestId)` (line 35)
3. Parses JSON body (line 53)
4. Validates against `V1FindSimilarRequestSchema.safeParse(body)` (line 61)
5. Destructures validated data: `{ id, url, limit, threshold, sameSourceOnly, excludeIds, filters }` (line 74)
6. Calls `findsimilarLogic(authContext, inputParams)` (lines 77-89)
7. Returns JSON response (line 98)

**GET** (line 119-124): Returns 405 Method Not Allowed.

### 2. Dual Authentication (`apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`)

The `withDualAuth` function supports three authentication paths in priority order:

**Path A: API Key** (lines 57-78)
- Detects bearer tokens starting with `sk-lf-`
- Delegates to `withApiKeyAuth()` in `with-api-key-auth.ts`
- API key is SHA-256 hashed and looked up in `orgApiKeys` table
- Validates key is active and not expired
- Updates `lastUsedAt` timestamp (non-blocking)
- Returns `workspaceId` from the key's workspace binding

**Path B: Bearer Token (Non-API-Key)** (lines 78-128)
- For bearer tokens not starting with `sk-lf-` (Clerk JWTs)
- Requires `X-Workspace-ID` and `X-User-ID` headers
- Validates workspace exists in `orgWorkspaces` table
- Returns session auth context

**Path C: Clerk Session** (lines 131-183)
- No Authorization header present
- Calls Clerk's `auth()` to verify session
- Requires `X-Workspace-ID` header
- Validates workspace access via `validateWorkspaceAccess()`
- Checks user's org membership via `getCachedUserOrgMemberships()` (Redis-cached, 5-min TTL)

**Auth Result Shape:**
```typescript
// Success
{ success: true, auth: { workspaceId, userId, authType: "api-key" | "session", apiKeyId? } }
// Error
{ success: false, error: { code, message }, status: number }
```

### 3. Request Validation (`@repo/console-types` - `packages/console-types/src/api/v1/findsimilar.ts`)

**V1FindSimilarRequestSchema** (lines 13-58):

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `id` | string? | — | Optional |
| `url` | string? | — | Must be valid URL |
| `limit` | number | 10 | Integer, 1-50 |
| `threshold` | number | 0.5 | Float, 0-1 |
| `sameSourceOnly` | boolean | false | — |
| `excludeIds` | string[]? | — | Optional |
| `filters` | V1SearchFiltersSchema? | — | Reuses search filters (sourceTypes, observationTypes, actorNames, dateRange) |

**Cross-field validation** (line 56-58): `.refine()` ensures at least one of `id` or `url` is provided.

### 4. Business Logic (`apps/console/src/lib/v1/findsimilar.ts`)

The `findsimilarLogic` function (line 274) orchestrates six phases:

**Phase 1: Source Content Resolution** (lines 283-300)
- If URL provided → `resolveByUrl()` in `apps/console/src/lib/neural/url-resolver.ts:104`
  - Parses GitHub URLs (PR, issue, commit, release, discussion)
  - Builds source ID candidates with all action states
  - Queries `workspaceNeuralObservations` by `sourceId`
- Fetches content via `fetchSourceContent()` (line 152):
  - **Documents** (ID starts with `doc_`): queries `workspaceKnowledgeDocuments`
  - **Observations**: calls `resolveObservationById()` in `apps/console/src/lib/neural/id-resolver.ts:62`
    - Tries `externalId` lookup, falls back to vector ID columns

**Phase 2: Embedding Generation & Workspace Config** (lines 303-318)
- Runs in parallel (`Promise.all`):
  - **Workspace config**: `getCachedWorkspaceConfig()` from `@repo/console-workspace-cache` (Redis cached, 1-hour TTL)
    - Returns `indexName`, `namespaceName`, `embeddingModel`, `embeddingDim`
  - **Embedding**: Creates Cohere embedding provider via `@repo/console-embed`
    - Input type: `"search_document"`
    - Embeds source content text

**Phase 3: Pinecone Vector Search** (lines 320-347)
- Constructs metadata filters:
  - Base: `{ layer: { $eq: "observations" } }`
  - Optional: `source`, `observationType` filters
- Queries via `consolePineconeClient.query()` from `@repo/console-pinecone`
  - `topK`: `limit * 3` (over-fetches for deduplication)
  - `includeMetadata: true`

**Phase 4: Normalization & Deduplication** (lines 350-360)
- `normalizeAndDeduplicate()` (line 51):
  - Groups matches by `observationId` from metadata
  - For matches without metadata, queries `workspaceNeuralObservations` by vector IDs
  - Keeps highest score per observation (title, content, summary vectors deduplicated)
- Filters out source ID and `excludeIds`
- Applies threshold filter
- Slices to `limit`

**Phase 5: Result Enrichment** (lines 363-387)
- `enrichResults()` (line 211):
  - Batch-resolves observation metadata via `resolveObservationsById()` in `id-resolver.ts:164`
  - Builds URLs via `buildSourceUrl()` in `apps/console/src/lib/neural/url-builder.ts:17`
  - Checks `sameCluster` by comparing cluster IDs

**Phase 6: Activity Recording & Response** (lines 390-434)
- Fires `apps-console/activity.record` Inngest event (fire-and-forget)
- Returns `V1FindSimilarResponse` with `source`, `similar[]`, `meta`, `requestId`

### 5. V1 API Route Architecture

The findsimilar endpoint follows the same pattern as all v1 routes:

| Route | Route Handler | Business Logic |
|-------|--------------|----------------|
| `/v1/contents` | `(api)/v1/contents/route.ts` | `lib/v1/contents.ts` |
| `/v1/findsimilar` | `(api)/v1/findsimilar/route.ts` | `lib/v1/findsimilar.ts` |
| `/v1/search` | `(api)/v1/search/route.ts` | `lib/v1/search.ts` |
| `/v1/graph/[id]` | `(api)/v1/graph/[id]/route.ts` | `lib/v1/graph.ts` |
| `/v1/related/[id]` | `(api)/v1/related/[id]/route.ts` | `lib/v1/related.ts` |
| `/v1/answer/[...v]` | `(api)/v1/answer/[...v]/route.ts` | — |

Shared auth utilities live in `apps/console/src/app/(api)/v1/lib/`:
- `with-dual-auth.ts` - Dual auth (API key + session)
- `with-api-key-auth.ts` - API key validation
- `index.ts` - Barrel export

Business logic barrel: `apps/console/src/lib/v1/index.ts`

### 6. External Services

| Service | Package | Usage |
|---------|---------|-------|
| **Pinecone** | `@repo/console-pinecone` → `@vendor/pinecone` | Vector similarity search |
| **Cohere** | `@repo/console-embed` → `@vendor/embed` | Embedding generation |
| **Redis (Upstash)** | `@vendor/upstash` | Workspace config cache (1h TTL), org membership cache (5m TTL) |
| **PlanetScale** | `@db/console/client` via `@vendor/db` | Observation/document lookups, API key validation |
| **Clerk** | `@vendor/clerk/server` | Session auth, org membership API |
| **Inngest** | `@repo/console-inngest` | Activity event recording |

### 7. Database Tables Accessed

| Table | File | Usage |
|-------|------|-------|
| `workspaceNeuralObservations` | `db/console/src/schema/tables/workspace-neural-observations.ts:48` | Source resolution, vector ID lookups, batch enrichment |
| `workspaceKnowledgeDocuments` | `db/console/src/schema/tables/workspace-knowledge-documents.ts:25` | Document content fetch |
| `orgApiKeys` | `db/console/src/schema/tables/org-api-keys.ts:29` | API key hash verification |
| `orgWorkspaces` | `db/console/src/schema/tables/org-workspaces.ts:35` | Workspace validation, settings fetch |
| `workspaceObservationClusters` | — | Cluster count for workspace config |
| `workspaceActorProfiles` | — | Actor count for workspace config |

## Code References

- `apps/console/src/app/(api)/v1/findsimilar/route.ts:27-114` - Route handler (POST)
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:50-183` - Dual auth function
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:49-183` - API key auth
- `packages/console-types/src/api/v1/findsimilar.ts:13-58` - Request schema
- `packages/console-types/src/api/v1/findsimilar.ts:118-139` - Response schema
- `apps/console/src/lib/v1/findsimilar.ts:274` - `findsimilarLogic` entry point
- `apps/console/src/lib/v1/findsimilar.ts:152` - `fetchSourceContent`
- `apps/console/src/lib/v1/findsimilar.ts:51` - `normalizeAndDeduplicate`
- `apps/console/src/lib/v1/findsimilar.ts:211` - `enrichResults`
- `apps/console/src/lib/neural/url-resolver.ts:104` - `resolveByUrl`
- `apps/console/src/lib/neural/id-resolver.ts:62` - `resolveObservationById`
- `apps/console/src/lib/neural/id-resolver.ts:164` - `resolveObservationsById`
- `apps/console/src/lib/neural/url-builder.ts:17` - `buildSourceUrl`
- `packages/console-workspace-cache/src/config.ts:27` - `getCachedWorkspaceConfig`
- `packages/console-embed/src/utils.ts:89` - `createEmbeddingProvider`
- `packages/console-pinecone/src/client.ts:125` - `consolePineconeClient.query`
- `packages/console-clerk-cache/src/membership.ts:25-60` - Cached org memberships
- `packages/console-api-key/src/crypto.ts:108-114` - API key hashing

## Architecture Documentation

### Request → Response Data Flow

```
Client POST /v1/findsimilar
  │
  ├─ withDualAuth() ─── API Key Path ─── hashApiKey() → orgApiKeys lookup
  │                  └── Session Path ─── Clerk auth() → org membership check (Redis cached)
  │
  ├─ V1FindSimilarRequestSchema.safeParse(body)
  │
  └─ findsimilarLogic()
       │
       ├─ Phase 1: Resolve source ─── resolveByUrl() (if URL) → fetchSourceContent()
       │                                                           ├─ doc_ → workspaceKnowledgeDocuments
       │                                                           └─ obs  → resolveObservationById()
       │
       ├─ Phase 2 (parallel):
       │    ├─ getCachedWorkspaceConfig() ─── Redis → DB fallback
       │    └─ createEmbeddingProvider().embed() ─── Cohere API
       │
       ├─ Phase 3: consolePineconeClient.query() ─── topK: limit*3, metadata filters
       │
       ├─ Phase 4: normalizeAndDeduplicate() ─── group by observationId, keep max score
       │            → filter by threshold → slice to limit
       │
       ├─ Phase 5: enrichResults() ─── resolveObservationsById() → buildSourceUrl()
       │
       └─ Phase 6: recordSystemActivity() (fire-and-forget) → return response
```

### Performance Design Patterns

- **Parallel execution**: Embedding generation + workspace config fetch run simultaneously via `Promise.all`
- **Over-fetching**: Queries `limit * 3` from Pinecone to account for deduplication losses
- **Redis caching**: Workspace config (1h TTL), org memberships (5m TTL)
- **Batch queries**: Observation enrichment uses batch lookups (not N+1)
- **Fire-and-forget**: Activity recording doesn't block the response
- **Vector deduplication**: Multiple vector representations (title, content, summary) of the same observation are consolidated to a single result with the highest score

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2025-12-21-api-reference-sidebar-structure.md` - API reference structure including findSimilar endpoint
- `thoughts/shared/research/2025-12-16-api-key-implementation-audit.md` - API key implementation audit
- `thoughts/changelog/typescript-sdk-mcp-server-20251217-154500.md` - TypeScript SDK with `lightfast_find_similar` tool
- `thoughts/blog/how-vector-search-works-20251221-161532.md` - Technical blog on vector search fundamentals
- `thoughts/shared/research/2026-02-05-accelerator-demo-search-scenarios.md` - Demo search scenarios

## Related Research

- `thoughts/shared/research/2025-01-22-docs-search-system-mixedbread-upgrade.md` - Search system architecture
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md` - Ingestion pipeline architecture

## Open Questions

None identified - the endpoint is fully wired and follows the established v1 API pattern.

---
date: 2026-02-07T10:35:24Z
researcher: claude
git_commit: 96ddaa6d76f062182ba1ce2e096a7a539cc2bdc9
branch: feat/memory-connector-backfill
repository: lightfast
topic: "v1/findsimilar API route setup and full code flow analysis"
tags: [research, codebase, findsimilar, v1-api, pinecone, vector-search, dual-auth, console-types]
status: complete
last_updated: 2026-02-07
last_updated_by: claude
---

# Research: v1/findsimilar API Route Setup and Full Code Flow Analysis

**Date**: 2026-02-07T10:35:24Z
**Researcher**: claude
**Git Commit**: 96ddaa6d76f062182ba1ce2e096a7a539cc2bdc9
**Branch**: feat/memory-connector-backfill
**Repository**: lightfast

## Research Question
Check whether the `/v1/findsimilar` route is correctly set up and trace the full flow of code from the route handler back to the API/business logic level.

## Summary

The `/v1/findsimilar` endpoint is a fully wired POST route that:
1. Authenticates via dual-auth (API key or Clerk session)
2. Validates input against a Zod schema with cross-field refinement
3. Delegates to a standalone `findsimilarLogic` function that resolves source content, generates embeddings via Cohere, queries Pinecone for similar vectors, deduplicates multi-view results, enriches with database metadata, and fires an async activity event
4. Returns structured JSON with source info, similar results, and performance metadata

The route follows the same structural pattern as all other v1 routes (`search`, `contents`, `graph`, `related`): route handler → dual-auth → schema validation → extracted business logic.

## Detailed Findings

### 1. Route Handler Layer

**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

The Next.js App Router route exports `POST` and `GET` handlers. The GET handler returns 405 Method Not Allowed.

The POST handler follows this sequence:
1. **Request ID** — Generates `randomUUID()` for request tracking (line 29)
2. **Authentication** — Calls `withDualAuth(request, requestId)` (line 35)
3. **Body parsing** — `request.json()` with try/catch for INVALID_JSON (lines 51-59)
4. **Validation** — `V1FindSimilarRequestSchema.safeParse(body)` with VALIDATION_ERROR on failure (lines 61-72)
5. **Business logic** — `findsimilarLogic(auth, input)` (lines 77-89)
6. **Response** — `NextResponse.json(response)` (line 98)
7. **Error handling** — Catches all errors, returns INTERNAL_ERROR 500 (lines 99-113)

**Imports**:
- `withDualAuth`, `createDualAuthErrorResponse` from `../lib/with-dual-auth`
- `V1FindSimilarRequestSchema` from `@repo/console-types`
- `findsimilarLogic` from `~/lib/v1`

### 2. Authentication Layer (`withDualAuth`)

**File**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

Supports three authentication paths in priority order:

| Path | Trigger | Validation | Auth Type |
|------|---------|-----------|-----------|
| API Key | `Authorization: Bearer sk-lf-...` | SHA-256 hash lookup in `orgApiKeys`, active check, expiry check | `"api-key"` |
| Bearer Token | `Authorization: Bearer <non-sk-lf>` | Requires `X-Workspace-ID` + `X-User-ID` headers, workspace existence check | `"session"` |
| Session | No Authorization header | Clerk `auth()`, `X-Workspace-ID` header, org membership verification | `"session"` |

**Success result shape**:
```typescript
{ success: true, auth: { workspaceId, userId, authType, apiKeyId? } }
```

**API Key auth** (`with-api-key-auth.ts:49-183`):
- Hashes key with SHA-256 via Web Crypto API
- Queries `lightfast_workspace_api_keys` by `keyHash` + `isActive`
- Checks `expiresAt` timestamp
- Updates `lastUsedAt` and `lastUsedFromIp` non-blocking
- Returns workspace binding from key record (not from header)

**Session auth** (`with-dual-auth.ts:131-182`):
- Calls Clerk `auth()` for userId
- Validates workspace via `validateWorkspaceAccess()` which checks org membership using `getCachedUserOrgMemberships` (Redis cached, 300s TTL)

**Error codes**: UNAUTHORIZED (401), BAD_REQUEST (400), NOT_FOUND (404), FORBIDDEN (403), INTERNAL_ERROR (500)

### 3. Request Schema Layer

**File**: `packages/console-types/src/api/v1/findsimilar.ts`

`V1FindSimilarRequestSchema` (lines 13-58) defines:

| Field | Type | Constraints | Default |
|-------|------|-------------|---------|
| `id` | `string` | optional | — |
| `url` | `string.url()` | optional | — |
| `limit` | `number.int()` | min 1, max 50 | 10 |
| `threshold` | `number` | min 0, max 1 | 0.5 |
| `sameSourceOnly` | `boolean` | — | false |
| `excludeIds` | `string[]` | optional | — |
| `filters` | `V1SearchFiltersSchema` | optional | — |

**Cross-field refinement** (line 56-58): `.refine((data) => Boolean(data.id) || Boolean(data.url))` — at least one of `id` or `url` required.

**`V1SearchFiltersSchema`** (from `./search.ts:21-35`):
- `sourceTypes`: `string[]` optional — e.g. `["github", "linear"]`
- `observationTypes`: `string[]` optional — e.g. `["commit", "issue"]`
- `actorNames`: `string[]` optional
- `dateRange`: `{ start?, end? }` — ISO datetime strings

**Response schemas** also defined in same file:
- `V1FindSimilarResultSchema` (lines 65-88): id, title, url, snippet?, score, vectorSimilarity, entityOverlap?, sameCluster, source, type, occurredAt?
- `V1FindSimilarSourceSchema` (lines 95-111): id, title, type, cluster?
- `V1FindSimilarResponseSchema` (lines 118-139): source, similar[], meta { total, took, inputEmbedding }, requestId

### 4. Business Logic Layer (`findsimilarLogic`)

**File**: `apps/console/src/lib/v1/findsimilar.ts` (lines 274-435)
**Barrel export**: `apps/console/src/lib/v1/index.ts:4`

#### Phase 1: Source Resolution (lines 282-300)

- **URL path**: If `url` provided, calls `resolveByUrl()` which parses GitHub URLs (PR, issue, commit, release, discussion patterns), builds sourceId candidates with state variations, queries `workspaceNeuralObservations` by indexed `sourceId`
- **ID path**: If `id` starts with `doc_`, queries `workspaceKnowledgeDocuments`; otherwise calls `resolveObservationById()` which tries `externalId` (nanoid) first, then falls back to vector ID columns (`embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId`, `embeddingVectorId`)

#### Phase 2: Embedding Generation (lines 303-318)

Parallel `Promise.all()`:
1. **Workspace config** via `getCachedWorkspaceConfig()` — Redis cache (1h TTL) → DB fallback. Returns `indexName`, `namespaceName`, `embeddingModel`, `embeddingDim`
2. **Cohere embedding** via `createEmbeddingProvider()` — model from `EMBEDDING_CONFIG.cohere.model`, input type "search_document", dimension from `EMBEDDING_CONFIG.cohere.dimension`

#### Phase 3: Pinecone Query (lines 320-347)

- Filter: `{ layer: { $eq: "observations" } }` + optional `source`, `observationType` filters
- Query: `consolePineconeClient.query()` with `topK: limit * 3` (over-fetch for deduplication)
- Returns matches with vector IDs, scores, and metadata

#### Phase 4: Normalization & Deduplication (lines 350-360)

`normalizeAndDeduplicate()` (lines 61-148):
- Separates matches by presence of `metadata.observationId`
- Groups by observation ID, keeps highest score per observation
- For matches without observationId, batch-queries `workspaceNeuralObservations` by vector ID columns
- Sorts by score descending

Post-normalization: filters by `excludeIds`, threshold, then slices to `limit`

#### Phase 5: Enrichment (lines 363-387)

`enrichResults()`:
- Batch-resolves observation IDs via `resolveObservationsById()`
- Builds URL via `buildSourceUrl()` (GitHub, Vercel, Linear URL patterns)
- Adds title, url, source, type, occurredAt, sameCluster

#### Phase 6: Activity Tracking (lines 390-409)

Fire-and-forget `recordSystemActivity()` → sends Inngest event `"apps-console/activity.record"` with metadata (sourceId, inputMethod, limit, threshold, similarCount, latencyMs, authType)

#### Phase 7: Response Construction (lines 417-434)

```typescript
{
  source: { id, title, type, cluster: undefined },
  similar: [...enrichedResults],
  meta: { total, took, inputEmbedding: { found: false, generated: true } },
  requestId
}
```

### 5. V1 API Route Architecture

All v1 routes follow the identical pattern:

```
apps/console/src/app/(api)/v1/
├── lib/                        # Shared auth middleware
│   ├── with-api-key-auth.ts
│   └── with-dual-auth.ts
├── answer/[...v]/route.ts      # Catch-all answer
├── contents/route.ts           # Contents lookup
├── findsimilar/route.ts        # Similarity search ← this route
├── graph/[id]/route.ts         # Graph by ID
├── related/[id]/route.ts       # Related by ID
└── search/route.ts             # Full-text + vector search

apps/console/src/lib/v1/        # Extracted business logic
├── index.ts                    # Barrel: searchLogic, graphLogic, contentsLogic, findsimilarLogic, relatedLogic
├── contents.ts
├── findsimilar.ts
├── graph.ts
├── related.ts
└── search.ts
```

Each route follows: `route handler → withDualAuth → schema.safeParse → *Logic() → NextResponse.json()`

### 6. External Dependencies

| Dependency | Purpose | Location |
|------------|---------|----------|
| **Pinecone** | Vector similarity query | `consolePineconeClient.query()` via `@vendor/pinecone` |
| **Cohere** | Embedding generation | `createEmbeddingProvider()` via `EMBEDDING_CONFIG` |
| **Redis** | Workspace config cache (1h), membership cache (5min) | `@vendor/upstash` |
| **PlanetScale** | Observation/document lookup, API key verification | `@vendor/db` via Drizzle |
| **Clerk** | Session auth, org membership | `@vendor/clerk` |
| **Inngest** | Async activity tracking | Fire-and-forget event |

### 7. Database Reads in findsimilarLogic

1. `workspaceNeuralObservations` — URL resolution by `sourceId` (indexed)
2. `workspaceKnowledgeDocuments` — Document lookup by `id` (for `doc_` prefix IDs)
3. `workspaceNeuralObservations` — Observation lookup by `externalId` or vector ID columns
4. `orgWorkspaces.settings` — Workspace config (cached in Redis)
5. `workspaceObservationClusters` — Cluster count (cached)
6. `workspaceActorProfiles` — Actor count (cached)
7. `workspaceNeuralObservations` — Batch vector-ID-to-observation-ID mapping
8. `workspaceNeuralObservations` — Batch enrichment by `externalId`

No writes are performed; activity recording is async via Inngest.

## Code References

- `apps/console/src/app/(api)/v1/findsimilar/route.ts` — Route handler (POST + GET)
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:50` — `withDualAuth` function
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:49` — `withApiKeyAuth` function
- `packages/console-types/src/api/v1/findsimilar.ts:13-58` — Request schema
- `packages/console-types/src/api/v1/findsimilar.ts:65-139` — Response schemas
- `packages/console-types/src/api/v1/search.ts:21-35` — V1SearchFiltersSchema
- `apps/console/src/lib/v1/findsimilar.ts:274-435` — `findsimilarLogic` main function
- `apps/console/src/lib/v1/findsimilar.ts:61-148` — `normalizeAndDeduplicate` helper
- `apps/console/src/lib/v1/index.ts` — Barrel export with V1AuthContext type

## Architecture Documentation

### Request Flow Diagram

```
Client Request (POST /v1/findsimilar)
    │
    ▼
Route Handler (route.ts)
    ├── withDualAuth() ──► API Key hash lookup OR Clerk session + org membership
    ├── V1FindSimilarRequestSchema.safeParse() ──► Zod validation with id|url refinement
    │
    ▼
findsimilarLogic (findsimilar.ts:274)
    ├── resolveByUrl() or fetchSourceContent() ──► DB: observations/documents
    ├── Promise.all([
    │       getCachedWorkspaceConfig() ──► Redis → DB fallback
    │       createEmbeddingProvider().embed() ──► Cohere API
    │   ])
    ├── consolePineconeClient.query() ──► Pinecone (topK: limit*3)
    ├── normalizeAndDeduplicate() ──► DB: vector-ID-to-obs-ID mapping
    ├── enrichResults() ──► DB: batch observation enrichment
    ├── recordSystemActivity() ──► Inngest (fire-and-forget)
    │
    ▼
NextResponse.json({ source, similar[], meta, requestId })
```

### Key Patterns
- **Parallel I/O**: Workspace config + embedding generation run concurrently via `Promise.all`
- **Over-fetching**: `topK: limit * 3` compensates for multi-view deduplication (title, content, summary, vector embeddings per observation)
- **Dual ID systems**: Supports both nanoid `externalId` and legacy vector ID formats (`obs_title_*`, etc.)
- **Redis caching**: Workspace config cached 1h, membership cached 5min
- **Fire-and-forget tracking**: Activity recording does not block response

## Historical Context (from thoughts/)

Extensive historical documentation exists across 30 documents:
- `thoughts/shared/research/2026-02-07-graph-pipeline-codebase-deep-dive.md` — Documents findsimilar patterns alongside other v1 endpoints
- `thoughts/shared/research/2025-12-14-neural-memory-production-priority-analysis.md` — Analyzes public API routes including search endpoints
- `thoughts/shared/research/2025-12-21-api-reference-sidebar-structure.md` — API documentation structure including findsimilar.mdx
- `thoughts/shared/research/2025-12-16-api-key-implementation-audit.md` — API key implementation for v1 REST endpoints
- `thoughts/changelog/search-api-hybrid-retrieval-cross-encoder-20251217-143022.md` — Search API hybrid retrieval architecture
- `thoughts/blog/how-vector-search-works-20251221-161532.md` — Comprehensive guide on vector search mechanics

## Related Research

- `thoughts/shared/research/2026-02-07-graph-pipeline-architecture-design.md`
- `thoughts/shared/research/2026-02-07-ai-eval-pipeline-codebase-deep-dive.md`
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md`
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md`

## Open Questions

- The `cluster` field in the source response is always `undefined` (line ~420) — not populated in current implementation
- `entityOverlap` in results comes from enriched data but its calculation source is unclear from this analysis alone
- The `answer/[...v]/route.ts` catch-all route follows a different pattern from the other v1 routes

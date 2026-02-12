---
date: 2026-02-07T10:44:55Z
researcher: claude
git_commit: 96ddaa6d76f062182ba1ce2e096a7a539cc2bdc9
branch: feat/memory-connector-backfill
repository: lightfast-product-demo
topic: "v1/contents vs v1/findsimilar route setup and full API flow analysis"
tags: [research, codebase, findsimilar, contents, v1-api, pinecone, cohere, vector-search, dual-auth]
status: complete
last_updated: 2026-02-07
last_updated_by: claude
---

# Research: v1/contents vs v1/findsimilar Route Setup and Full API Flow Analysis

**Date**: 2026-02-07T10:44:55Z
**Researcher**: claude
**Git Commit**: 96ddaa6d76f062182ba1ce2e096a7a539cc2bdc9
**Branch**: feat/memory-connector-backfill
**Repository**: lightfast-product-demo

## Research Question
Check whether findSimilar is correctly set up in `apps/console/src/app/(api)/v1/contents/` and trace the flow of code back to the API level.

## Summary

**FindSimilar does NOT live at `/v1/contents/`.** These are two separate v1 API endpoints:

| Endpoint | Route Path | Business Logic | Purpose |
|----------|-----------|----------------|---------|
| `/v1/contents` | `(api)/v1/contents/route.ts` | `lib/v1/contents.ts` | Fetch full content by IDs (`doc_*` or `obs_*`) |
| `/v1/findsimilar` | `(api)/v1/findsimilar/route.ts` | `lib/v1/findsimilar.ts` | Find semantically similar content via vector search |

Both endpoints are fully wired and follow the same structural pattern: route handler -> dual-auth -> Zod schema validation -> extracted business logic -> JSON response. The findsimilar endpoint is correctly set up at its own route directory.

## Detailed Findings

### 1. Route Directory Structure

```
apps/console/src/app/(api)/v1/
├── lib/                           # Shared auth middleware
│   ├── with-api-key-auth.ts       # API key hash verification
│   └── with-dual-auth.ts          # Dual auth (API key + session)
├── answer/[...v]/route.ts         # Streaming answer (catch-all)
├── contents/route.ts              # ← Fetch content by IDs (NOT findSimilar)
├── findsimilar/route.ts           # ← Similarity search (findSimilar lives HERE)
├── graph/[id]/route.ts            # Graph by ID
├── related/[id]/route.ts          # Related by ID
└── search/route.ts                # Full-text + vector search
```

### 2. `/v1/contents/route.ts` — What It Actually Does

**File**: `apps/console/src/app/(api)/v1/contents/route.ts`

This is a content-by-IDs fetcher, not findSimilar. It accepts an array of IDs and returns full content for each:

- **Schema**: `V1ContentsRequestSchema` — requires `{ ids: string[] }`
- **Logic**: `contentsLogic()` from `~/lib/v1`
- **Response**: `{ items: [...], missing: [...] }`

```typescript
// Line 71 — destructures only `ids` from validated body
const { ids } = parseResult.data;

// Lines 76-79 — calls contentsLogic, not findsimilarLogic
const response = await contentsLogic(
  { workspaceId, userId, authType, apiKeyId: authResult.auth.apiKeyId },
  { ids, requestId }
);
```

### 3. `/v1/findsimilar/route.ts` — The Actual FindSimilar Route

**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

POST handler flow (lines 27-114):
1. Generate `requestId` via `randomUUID()` (line 29)
2. Authenticate via `withDualAuth(request, requestId)` (line 35)
3. Parse JSON body (line 53)
4. Validate against `V1FindSimilarRequestSchema.safeParse(body)` (line 61)
5. Destructure: `{ id, url, limit, threshold, sameSourceOnly, excludeIds, filters }` (line 74)
6. Call `findsimilarLogic(authContext, inputParams)` (lines 77-89)
7. Return `NextResponse.json(response)` (line 98)

GET handler returns 405.

### 4. FindSimilar Request Schema

**File**: `packages/console-types/src/api/v1/findsimilar.ts` (lines 13-58)

| Field | Type | Default | Constraints |
|-------|------|---------|-------------|
| `id` | string? | — | Optional |
| `url` | string? | — | Must be valid URL |
| `limit` | number | 10 | Integer, 1-50 |
| `threshold` | number | 0.5 | Float, 0-1 |
| `sameSourceOnly` | boolean | false | — |
| `excludeIds` | string[]? | — | Optional |
| `filters` | V1SearchFiltersSchema? | — | sourceTypes, observationTypes, actorNames, dateRange |

**Cross-field refinement** (line 56-58): At least one of `id` or `url` required.

### 5. Business Logic Flow (`findsimilarLogic`)

**File**: `apps/console/src/lib/v1/findsimilar.ts` (lines 274-435)
**Barrel export**: `apps/console/src/lib/v1/index.ts:4`

#### Phase 1: Source Resolution (lines 283-300)
- **URL path**: `resolveByUrl()` parses GitHub URLs (PR, issue, commit, release, discussion), builds sourceId candidates with state variations, queries `workspaceNeuralObservations` by indexed `sourceId`
- **ID path**: `fetchSourceContent()` — if `doc_` prefix queries `workspaceKnowledgeDocuments`, otherwise calls `resolveObservationById()` which tries `externalId` first, falls back to vector ID columns

#### Phase 2: Parallel Config + Embedding (lines 303-318)
```typescript
const [workspace, embedResult] = await Promise.all([
  getCachedWorkspaceConfig(auth.workspaceId),  // Redis cache (1h TTL) → DB
  (async () => {
    const provider = createEmbeddingProvider({ inputType: "search_document" });
    return provider.embed([sourceContent.content]);
  })(),
]);
```

#### Phase 3: Pinecone Query (lines 320-347)
- Base filter: `{ layer: { $eq: "observations" } }`
- Optional: `source`, `observationType` filters from request
- `topK: input.limit * 3` (over-fetches for deduplication)
- Queries `consolePineconeClient.query(workspace.indexName, request, workspace.namespaceName)`

#### Phase 4: Normalize & Deduplicate (lines 350-360)
- `normalizeAndDeduplicate()` (lines 51-149):
  - Separates matches by presence of `metadata.observationId`
  - Groups by observation ID, keeps highest score per observation
  - For matches without metadata, batch-queries vector ID columns
- Post-normalization: filters by `excludeIds`, threshold, slices to `limit`

#### Phase 5: Enrichment (lines 363-387)
- `enrichResults()` (lines 211-272):
  - Batch-resolves observations via `resolveObservationsById()`
  - Builds URL via `buildSourceUrl()` (GitHub, Vercel, Linear patterns)
  - Checks `sameCluster` by comparing cluster IDs

#### Phase 6: Activity Tracking + Response (lines 390-434)
- Fire-and-forget `recordSystemActivity()` → Inngest event
- Returns `{ source, similar[], meta: { total, took, inputEmbedding }, requestId }`

### 6. Complete Call Graph

```
findsimilarLogic (lib/v1/findsimilar.ts:274)
├─ resolveByUrl (lib/neural/url-resolver.ts:104)
│  ├─ parseGitHubUrl (url-resolver.ts:49)
│  ├─ buildSourceIdCandidates (url-resolver.ts:68)
│  └─ db.query.workspaceNeuralObservations.findFirst
│
├─ fetchSourceContent (findsimilar.ts:152)
│  ├─ db.query.workspaceKnowledgeDocuments.findFirst
│  └─ resolveObservationById (lib/neural/id-resolver.ts:62)
│
├─ getCachedWorkspaceConfig (console-workspace-cache/src/config.ts:27)
│  ├─ redis.get → cache hit
│  └─ fetchWorkspaceConfigFromDB → db.orgWorkspaces + cluster count + actor count
│
├─ createEmbeddingProvider (console-embed/src/utils.ts:89)
│  └─ createCohereEmbedding (Cohere API)
│
├─ consolePineconeClient.query (console-pinecone/src/client.ts:125)
│
├─ normalizeAndDeduplicate (findsimilar.ts:51)
│  └─ db.select workspaceNeuralObservations [vector ID mapping]
│
├─ enrichResults (findsimilar.ts:211)
│  ├─ resolveObservationsById (lib/neural/id-resolver.ts:164)
│  └─ buildSourceUrl (lib/neural/url-builder.ts:17)
│
└─ recordSystemActivity → Inngest event (fire-and-forget)
```

### 7. External Dependencies

| Service | Package | Usage |
|---------|---------|-------|
| Pinecone | `@repo/console-pinecone` → `@vendor/pinecone` | Vector similarity query |
| Cohere | `@repo/console-embed` → `@vendor/embed` | Embedding generation |
| Redis (Upstash) | `@vendor/upstash` | Workspace config cache (1h), org membership cache (5m) |
| PlanetScale | `@db/console/client` via `@vendor/db` | Observation/document lookups, API key verification |
| Clerk | `@vendor/clerk/server` | Session auth, org membership API |
| Inngest | `@repo/console-inngest` | Activity event recording |

### 8. Database Tables Accessed

| Table | Usage in findsimilarLogic |
|-------|--------------------------|
| `workspaceNeuralObservations` | URL resolution by sourceId, ID resolution by externalId/vectorIds, batch enrichment |
| `workspaceKnowledgeDocuments` | Document content fetch (for `doc_` prefix IDs) |
| `orgApiKeys` | API key hash verification (in withDualAuth) |
| `orgWorkspaces` | Workspace settings fetch (cached) |
| `workspaceObservationClusters` | Cluster count for capability detection (cached) |
| `workspaceActorProfiles` | Actor count for capability detection (cached) |

## Code References

- `apps/console/src/app/(api)/v1/contents/route.ts` — Contents route (NOT findSimilar)
- `apps/console/src/app/(api)/v1/findsimilar/route.ts:27-114` — FindSimilar route handler
- `apps/console/src/lib/v1/findsimilar.ts:274-435` — `findsimilarLogic` main function
- `apps/console/src/lib/v1/findsimilar.ts:51-149` — `normalizeAndDeduplicate` helper
- `apps/console/src/lib/v1/findsimilar.ts:152-208` — `fetchSourceContent` helper
- `apps/console/src/lib/v1/findsimilar.ts:211-272` — `enrichResults` helper
- `apps/console/src/lib/v1/index.ts` — Barrel export (searchLogic, graphLogic, contentsLogic, findsimilarLogic, relatedLogic)
- `packages/console-types/src/api/v1/findsimilar.ts:13-58` — Request schema
- `packages/console-types/src/api/v1/findsimilar.ts:118-139` — Response schema
- `apps/console/src/lib/neural/url-resolver.ts:104` — `resolveByUrl`
- `apps/console/src/lib/neural/id-resolver.ts:62` — `resolveObservationById`
- `apps/console/src/lib/neural/id-resolver.ts:164` — `resolveObservationsById`
- `apps/console/src/lib/neural/url-builder.ts:17` — `buildSourceUrl`
- `packages/console-workspace-cache/src/config.ts:27` — `getCachedWorkspaceConfig`
- `packages/console-embed/src/utils.ts:89` — `createEmbeddingProvider`
- `packages/console-pinecone/src/client.ts:125` — `consolePineconeClient.query`

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

### Key Implementation Patterns

- **Parallel I/O**: Workspace config + embedding generation run concurrently via `Promise.all`
- **Over-fetching**: `topK: limit * 3` compensates for multi-view deduplication
- **Vector deduplication**: Multiple embeddings per observation (title, content, summary, vector) consolidated to single result with highest score
- **Dual ID systems**: Supports both nanoid `externalId` and legacy vector ID formats
- **Redis caching**: Workspace config (1h TTL), org membership (5m TTL)
- **Fire-and-forget tracking**: Activity recording does not block response
- **Batch queries**: Observation enrichment uses batch lookups (not N+1)

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-07-v1-findsimilar-api-flow-analysis.md` — Previous research on the same findSimilar flow
- `thoughts/shared/research/2026-02-07-v1-findsimilar-api-flow.md` — Earlier research document on the same topic
- `thoughts/shared/research/2026-02-07-graph-pipeline-codebase-deep-dive.md` — Documents findsimilar alongside other v1 endpoints

## Related Research

- `thoughts/shared/research/2026-02-07-v1-findsimilar-api-flow-analysis.md`
- `thoughts/shared/research/2026-02-07-v1-findsimilar-api-flow.md`

## Open Questions

- The `cluster` field in the source response is always `undefined` (line ~422) — not populated in current implementation
- `entityOverlap` in results is declared in the enrichment map type but no calculation populates it — comes through as `undefined`

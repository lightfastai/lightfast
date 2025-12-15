---
date: 2025-12-14T16:30:00+11:00
researcher: Claude
git_commit: a5055f90e3bc1b7d2e6e458287078c59dda3b319
branch: feat/memory-layer-foundation
repository: lightfast
topic: "API Documentation v1 Rework Analysis"
tags: [research, api, documentation, v1, rework]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: API Documentation v1 Rework Analysis

**Date**: 2025-12-14T16:30:00+11:00
**Researcher**: Claude
**Git Commit**: a5055f90e3bc1b7d2e6e458287078c59dda3b319
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Compare the current API documentation in `apps/docs/src/content/api/` against the v1 implementation in `apps/console/src/app/(api)/v1/` and `packages/console-types/src/api/v1/`. Identify which files should be deleted, what's missing, and what needs complete content rework.

## Summary

The current API documentation is **significantly outdated** and doesn't reflect the actual v1 implementation. The documentation describes a conceptual API design with 4 routes, while the actual v1 implementation has **3 routes** with completely different schemas, authentication patterns, and response structures.

### Key Findings

| Category | Count |
|----------|-------|
| Files to DELETE | 1 |
| Files to RENAME | 1 |
| Files to REWRITE | 5 |
| Files to UPDATE | 2 |
| Missing files | 0 |

## Detailed Findings

### V1 Implementation (Source of Truth)

**Implemented Routes:**
1. `POST /v1/search` - Semantic search with mode-based reranking
2. `POST /v1/contents` - Fetch content by IDs
3. `POST /v1/findsimilar` - Find similar content

**V1 Type Schemas:**
- `packages/console-types/src/api/v1/search.ts:42-204`
- `packages/console-types/src/api/v1/contents.ts:12-60`
- `packages/console-types/src/api/v1/findsimilar.ts:13-115`

**Authentication:**
- Dual auth via `withDualAuth()` supporting:
  - API key: `Authorization: Bearer <api-key>` + `X-Workspace-ID: <workspace-id>`
  - Session: Clerk session + `X-Workspace-ID: <workspace-id>`

### Current Documentation (To Be Reworked)

| File | Status | Reason |
|------|--------|--------|
| `answer.mdx` | **DELETE** | Route not implemented in v1 |
| `similar.mdx` | **RENAME** → `findsimilar.mdx` | Route is `/v1/findsimilar`, not `/v1/similar` |
| `overview.mdx` | **REWRITE** | Shows 4 routes, should be 3; different schema structure |
| `search.mdx` | **REWRITE** | Completely different schema |
| `contents.mdx` | **REWRITE** | Different response structure |
| `authentication.mdx` | **REWRITE** | New dual auth + X-Workspace-ID pattern |
| `meta.json` | **UPDATE** | Remove answer, rename similar |
| `errors.mdx` | **UPDATE** | Align error codes with v1 implementation |
| `sdks.mdx` | **UPDATE** | Align with v1 SDK patterns (if SDK exists) |

---

## File-by-File Analysis

### 1. `answer.mdx` - DELETE

**Reason:** The `/v1/answer` route is **not implemented** in v1. There are:
- No types in `packages/console-types/src/api/v1/`
- No route in `apps/console/src/app/(api)/v1/`
- No references to answer endpoint in v1 implementation

**Action:** Delete this file entirely.

---

### 2. `similar.mdx` - RENAME & REWRITE

**Reason:** Route path mismatch and schema differences.

| Current Docs | Actual v1 |
|--------------|-----------|
| `/v1/similar` | `/v1/findsimilar` |
| `id: string` (required) | `id?: string` (optional, can use URL) |
| Response: `data[]` | Response: `source` + `similar[]` |
| No cluster info | Includes `sameCluster`, `vectorSimilarity`, `entityOverlap` |

**V1 Request Schema:**
```typescript
{
  id?: string              // Content ID (optional)
  url?: string             // URL alternative to ID (optional)
  limit: number            // 1-50, default 10
  threshold: number        // 0-1, default 0.5
  sameSourceOnly: boolean  // Filter to same source
  excludeIds?: string[]    // IDs to exclude
  filters?: V1SearchFilters // Source/type/date filters
}
```

**V1 Response Schema:**
```typescript
{
  source: {
    id: string
    title: string
    type: string
    cluster?: { topic: string | null; memberCount: number }
  }
  similar: Array<{
    id: string
    title: string
    url: string
    snippet?: string
    score: number
    vectorSimilarity: number
    entityOverlap?: number
    sameCluster: boolean
    source: string
    type: string
    occurredAt?: string
  }>
  meta: {
    total: number
    took: number
    inputEmbedding: { found: boolean; generated: boolean }
  }
  requestId: string
}
```

---

### 3. `search.mdx` - REWRITE

**Reason:** Schema is completely different.

| Current Docs | Actual v1 |
|--------------|-----------|
| No mode parameter | `mode: "fast" | "balanced" | "thorough"` |
| `includeRationale?: boolean` | No rationale parameter |
| Filters: type, source, owner, dates | Filters: sourceTypes, observationTypes, actorNames, dateRange |
| Response: `data[]` with rationale | Response: `data[]` + `context` + `latency` breakdown |

**V1 Request Schema:**
```typescript
{
  query: string                    // Search query (required)
  limit: number                    // 1-100, default 10
  offset: number                   // default 0
  mode: "fast" | "balanced" | "thorough"  // Rerank mode (default: balanced)
  filters?: {
    sourceTypes?: string[]         // e.g., ["github", "linear"]
    observationTypes?: string[]    // e.g., ["commit", "issue"]
    actorNames?: string[]          // e.g., ["@sarah"]
    dateRange?: { start?: string; end?: string }
  }
  includeContext?: boolean         // Include clusters/actors (default: true)
  includeHighlights?: boolean      // Include highlights (default: true)
}
```

**V1 Response Schema:**
```typescript
{
  data: Array<{
    id: string
    title: string
    url: string
    snippet: string
    score: number
    source: string
    type: string
    occurredAt?: string
    entities?: Array<{ key: string; category: string }>
    highlights?: { title?: string; snippet?: string }
  }>
  context?: {
    clusters?: Array<{ topic: string | null; summary: string | null; keywords: string[] }>
    relevantActors?: Array<{ displayName: string; expertiseDomains: string[] }>
  }
  meta: {
    total: number
    limit: number
    offset: number
    took: number
    mode: "fast" | "balanced" | "thorough"
    paths: { vector: boolean; entity: boolean; cluster: boolean; actor: boolean }
  }
  latency: {
    total: number
    auth?: number
    parse?: number
    search?: number
    embedding?: number
    retrieval: number
    entitySearch?: number
    clusterSearch?: number
    actorSearch?: number
    rerank: number
    enrich?: number
    maxParallel?: number
  }
  requestId: string
}
```

---

### 4. `contents.mdx` - REWRITE

**Reason:** Different response structure and field names.

| Current Docs | Actual v1 |
|--------------|-----------|
| Response: `data[]` | Response: `items[]` + `missing[]` |
| `includeRelationships?: boolean` | No relationships parameter |
| Complex relationship graph | Simple metadata only |
| `meta: { total, retrieved }` | Just `items` and `missing` arrays |

**V1 Request Schema:**
```typescript
{
  ids: string[]  // 1-50 IDs (doc_* or obs_*)
}
```

**V1 Response Schema:**
```typescript
{
  items: Array<{
    id: string
    title: string | null
    url: string
    snippet: string
    content?: string      // Full content (observations only)
    source: string
    type: string
    occurredAt?: string
    metadata?: Record<string, unknown>
  }>
  missing: string[]       // IDs not found
  requestId: string
}
```

---

### 5. `authentication.mdx` - REWRITE

**Reason:** New dual authentication pattern.

| Current Docs | Actual v1 |
|--------------|-----------|
| Just Bearer token | Bearer token + X-Workspace-ID |
| No session auth | Supports Clerk session auth |
| Key prefixes: lf_sk_, lf_pk_, lf_rk_ | Actual implementation unknown |

**V1 Authentication Pattern:**
```
# API Key Authentication
Authorization: Bearer <api-key>
X-Workspace-ID: <workspace-id>

# Session Authentication (Console UI)
Cookie: __session=<clerk-session>
X-Workspace-ID: <workspace-id>
```

**Error Responses:**
- 401 UNAUTHORIZED: No authentication provided
- 400 BAD_REQUEST: Missing X-Workspace-ID
- 403 FORBIDDEN: User not member of workspace org
- 404 NOT_FOUND: Workspace not found

---

### 6. `overview.mdx` - REWRITE

**Changes needed:**
1. Update from 4 routes to 3 routes (remove Answer)
2. Update route paths (similar → findsimilar)
3. Update response structure descriptions
4. Add mode-based search explanation
5. Add latency breakdown documentation
6. Update authentication section for dual auth
7. Remove MCP integration section (not part of v1 public API)

---

### 7. `meta.json` - UPDATE

**Current:**
```json
{
  "pages": ["overview", "authentication", "search", "contents", "similar", "answer", "errors", "sdks"]
}
```

**Should be:**
```json
{
  "pages": ["overview", "authentication", "search", "contents", "findsimilar", "errors", "sdks"]
}
```

---

### 8. `errors.mdx` - UPDATE

**V1 Error Codes:**
- `INVALID_JSON` (400) - Invalid JSON body
- `VALIDATION_ERROR` (400) - Schema validation failed
- `UNAUTHORIZED` (401) - No authentication
- `BAD_REQUEST` (400) - Missing X-Workspace-ID
- `FORBIDDEN` (403) - Access denied
- `NOT_FOUND` (404) - Resource not found
- `CONFIG_ERROR` (500) - Workspace not configured
- `INTERNAL_ERROR` (500) - Server error
- `METHOD_NOT_ALLOWED` (405) - Wrong HTTP method

---

## Code References

### V1 Types
- `packages/console-types/src/api/v1/index.ts:1-8` - Exports
- `packages/console-types/src/api/v1/search.ts:1-205` - Search schemas
- `packages/console-types/src/api/v1/contents.ts:1-61` - Contents schemas
- `packages/console-types/src/api/v1/findsimilar.ts:1-116` - FindSimilar schemas

### V1 Routes
- `apps/console/src/app/(api)/v1/search/route.ts:1-257` - Search implementation
- `apps/console/src/app/(api)/v1/contents/route.ts:1-208` - Contents implementation
- `apps/console/src/app/(api)/v1/findsimilar/route.ts:1-423` - FindSimilar implementation

### V1 Auth
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:1-233` - Dual auth middleware

### Current Docs
- `apps/docs/src/content/api/meta.json:1-16` - Page order
- `apps/docs/src/content/api/overview.mdx:1-329`
- `apps/docs/src/content/api/search.mdx:1-388`
- `apps/docs/src/content/api/contents.mdx:1-407`
- `apps/docs/src/content/api/similar.mdx:1-468`
- `apps/docs/src/content/api/answer.mdx:1-550` - DELETE THIS
- `apps/docs/src/content/api/authentication.mdx:1-322`
- `apps/docs/src/content/api/errors.mdx:1-474`
- `apps/docs/src/content/api/sdks.mdx:1-477`

---

## Action Plan

### Phase 1: Clean Up
1. Delete `answer.mdx`
2. Rename `similar.mdx` → `findsimilar.mdx`
3. Update `meta.json`

### Phase 2: Rewrite Core Docs
4. Rewrite `search.mdx` based on V1SearchRequestSchema/V1SearchResponseSchema
5. Rewrite `contents.mdx` based on V1ContentsRequestSchema/V1ContentsResponseSchema
6. Rewrite `findsimilar.mdx` based on V1FindSimilarRequestSchema/V1FindSimilarResponseSchema

### Phase 3: Update Supporting Docs
7. Rewrite `authentication.mdx` for dual auth pattern
8. Rewrite `overview.mdx` for 3-route API
9. Update `errors.mdx` with v1 error codes

### Phase 4: SDK Alignment
10. Review `sdks.mdx` for v1 patterns (may need significant updates or future work tag)

---

## Open Questions

1. **SDK Status:** Does `@lightfast/sdk` or `@lightfast/memory` actually exist? The current sdks.mdx references these packages but they may be aspirational.

2. **Rate Limiting:** The v1 implementation doesn't include rate limiting headers in responses. Should this be documented as "coming soon" or removed from docs?

3. **API Key Types:** Current docs mention `lf_sk_`, `lf_pk_`, `lf_rk_` prefixes. What's the actual implementation?

4. **Base URL:** Docs say `https://api.lightfast.ai/v1` but console routes suggest `https://lightfast.ai/v1/`. Which is correct?

5. **Streaming:** Search doesn't support streaming. Should this be mentioned?

# API Documentation v1 Rework Implementation Plan

## Overview

Rewrite the API documentation in `apps/docs/src/content/api/` to accurately reflect the actual v1 implementation in `apps/console/src/app/(api)/v1/`. The current documentation is significantly outdated and describes a conceptual API that doesn't match the implemented routes, schemas, or authentication patterns.

## Current State Analysis

### What Exists (Current Docs)
- **4 routes documented**: search, contents, similar, answer
- **Simple auth**: Bearer token only (`lf_sk_*`, `lf_pk_*`, `lf_rk_*` prefixes)
- **Base URL**: `https://api.lightfast.ai/v1`
- **Response format**: `data[]` array with `meta: { total, limit, offset }`

### What's Actually Implemented (V1 Routes)
- **3 routes**: `/v1/search`, `/v1/contents`, `/v1/findsimilar`
- **Dual auth**: API key + X-Workspace-ID OR Clerk session + X-Workspace-ID
- **Base URL**: `https://lightfast.ai/v1` (console routes)
- **Response format**: Varies by route (see schemas below)

### Key Discoveries:
- `packages/console-types/src/api/v1/search.ts:1-205` - V1SearchRequestSchema, V1SearchResponseSchema
- `packages/console-types/src/api/v1/contents.ts:1-61` - V1ContentsRequestSchema, V1ContentsResponseSchema
- `packages/console-types/src/api/v1/findsimilar.ts:1-116` - V1FindSimilarRequestSchema, V1FindSimilarResponseSchema
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:1-233` - DualAuth middleware

## Desired End State

After this plan is complete:
1. All API documentation accurately reflects the v1 implementation
2. No references to non-existent routes (answer) or wrong paths (similar → findsimilar)
3. Authentication documentation shows dual auth pattern with X-Workspace-ID
4. All request/response schemas match the Zod schemas in console-types
5. Error codes align with actual v1 error handling

### Verification:
- Each documented endpoint can be tested with `curl` commands from the docs
- Request/response examples compile against the Zod schemas
- Build passes: `pnpm --filter @lightfast/docs build`

## What We're NOT Doing

1. **SDK documentation updates** - The SDKs (`@lightfast/sdk`, `@lightfast/memory`) may not exist yet; mark as "Coming Soon"
2. **Rate limiting documentation** - Not implemented in v1 routes; document as "Coming Soon" or remove
3. **API key prefixes** - Current docs mention `lf_sk_*` etc. but actual implementation unclear; simplify to generic guidance
4. **Relationship graph** - Contents route doesn't support `includeRelationships`; remove this feature
5. **MCP integration section** - Not part of public v1 API; move to guides or remove

## Implementation Approach

**Strategy**: Phase-by-phase replacement, starting with cleanup (delete/rename), then core routes, then supporting docs. Each phase verifiable independently.

---

## Phase 1: Cleanup and Structure

### Overview
Remove non-existent routes, rename files to match v1 paths, and update navigation.

### Changes Required:

#### 1. Delete answer.mdx
**File**: `apps/docs/src/content/api/answer.mdx`
**Action**: Delete entirely - route not implemented

```bash
rm apps/docs/src/content/api/answer.mdx
```

#### 2. Rename similar.mdx to findsimilar.mdx
**File**: `apps/docs/src/content/api/similar.mdx` → `apps/docs/src/content/api/findsimilar.mdx`
**Action**: Rename file to match actual route path

```bash
mv apps/docs/src/content/api/similar.mdx apps/docs/src/content/api/findsimilar.mdx
```

#### 3. Update meta.json
**File**: `apps/docs/src/content/api/meta.json`
**Changes**: Remove answer, rename similar to findsimilar

```json
{
  "title": "API Reference",
  "description": "Complete API documentation for Lightfast - Three routes for team memory",
  "defaultOpen": true,
  "pages": [
    "overview",
    "authentication",
    "search",
    "contents",
    "findsimilar",
    "errors"
  ]
}
```

**Note**: Removing `sdks` from pages for now - can be added back when SDKs are ready.

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/docs build`
- [x] No broken links in docs navigation
- [x] File `answer.mdx` deleted
- [x] File `findsimilar.mdx` exists

#### Manual Verification:
- [ ] Docs site loads without errors at `/api`
- [ ] Navigation shows correct 6 pages (overview, authentication, search, contents, findsimilar, errors)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Rewrite Authentication Documentation

### Overview
Update authentication docs to reflect the dual auth pattern (API key + session) with X-Workspace-ID header requirement.

### Changes Required:

#### 1. Rewrite authentication.mdx
**File**: `apps/docs/src/content/api/authentication.mdx`
**Changes**: Complete rewrite with dual auth pattern

The new content should document:

**API Key Authentication:**
```
Authorization: Bearer <api-key>
X-Workspace-ID: <workspace-id>
```

**Session Authentication (Console UI):**
```
Cookie: __session=<clerk-session>
X-Workspace-ID: <workspace-id>
```

**Error Responses:**
- 401 UNAUTHORIZED: No authentication provided
- 400 BAD_REQUEST: Missing X-Workspace-ID
- 403 FORBIDDEN: User not member of workspace org
- 404 NOT_FOUND: Workspace not found

**Key Sections to Include:**
1. Overview of dual auth (API key for external clients, session for Console UI)
2. X-Workspace-ID requirement for both auth types
3. Obtaining API keys (dashboard location)
4. Security best practices (environment variables, never commit keys)
5. Error handling for auth failures

**Remove/Simplify:**
- Remove specific key prefixes (`lf_sk_*`, `lf_pk_*`, `lf_rk_*`) - document generically
- Remove OAuth integration section (not part of v1)
- Remove IP allowlisting (not implemented)
- Remove request signing (not implemented)

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/docs build`
- [x] No TypeScript errors in MDX

#### Manual Verification:
- [ ] Authentication page renders correctly
- [ ] curl examples are accurate and copyable
- [ ] Error codes match `with-dual-auth.ts` implementation

**Implementation Note**: After completing this phase, pause for manual verification before proceeding to Phase 3.

---

## Phase 3: Rewrite Search Documentation

### Overview
Rewrite search.mdx to match V1SearchRequestSchema and V1SearchResponseSchema.

### Changes Required:

#### 1. Rewrite search.mdx
**File**: `apps/docs/src/content/api/search.mdx`
**Changes**: Complete rewrite based on `packages/console-types/src/api/v1/search.ts`

**V1 Request Schema:**
```typescript
{
  query: string              // Search query (required)
  limit?: number             // 1-100, default 10
  offset?: number            // default 0
  mode?: "fast" | "balanced" | "thorough"  // Rerank mode, default: balanced
  filters?: {
    sourceTypes?: string[]   // e.g., ["github", "linear"]
    observationTypes?: string[] // e.g., ["commit", "issue"]
    actorNames?: string[]    // e.g., ["@sarah"]
    dateRange?: { start?: string; end?: string }
  }
  includeContext?: boolean   // Include clusters/actors, default: true
  includeHighlights?: boolean // Include highlights, default: true
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

**Key Sections to Include:**
1. Endpoint: `POST https://lightfast.ai/v1/search`
2. Authentication (reference auth page, include X-Workspace-ID)
3. Request body with all parameters
4. Response structure with all fields
5. Mode explanation (fast/balanced/thorough with latency expectations)
6. Filter examples (sourceTypes, observationTypes, actorNames, dateRange)
7. Latency breakdown explanation
8. Error handling

**Remove:**
- `includeRationale` parameter (doesn't exist in v1)
- `owner` filter (use `actorNames` instead)
- `createdAfter`/`createdBefore` (use `dateRange` instead)
- Response `rationale` field (doesn't exist)
- Response `createdAt`/`updatedAt` (use `occurredAt`)
- Response `metadata` object (use `entities` instead)

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/docs build`
- [x] Request schema matches V1SearchRequestSchema
- [x] Response schema matches V1SearchResponseSchema

#### Manual Verification:
- [ ] Search page renders correctly
- [ ] Example curl commands work against actual API
- [ ] Mode latency expectations are accurate

**Implementation Note**: After completing this phase, pause for manual verification before proceeding to Phase 4.

---

## Phase 4: Rewrite Contents Documentation

### Overview
Rewrite contents.mdx to match V1ContentsRequestSchema and V1ContentsResponseSchema.

### Changes Required:

#### 1. Rewrite contents.mdx
**File**: `apps/docs/src/content/api/contents.mdx`
**Changes**: Complete rewrite based on `packages/console-types/src/api/v1/contents.ts`

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

**Key Sections to Include:**
1. Endpoint: `POST https://lightfast.ai/v1/contents`
2. Authentication (reference auth page)
3. Simple request body (just `ids` array)
4. Response with `items` and `missing` arrays
5. Batch retrieval guidance (max 50 IDs)
6. Error handling for partial success

**Remove:**
- `includeRelationships` parameter (doesn't exist)
- Response `relationships` field (doesn't exist)
- Response `meta: { total, retrieved }` (doesn't exist - just items/missing)
- Graph depth / relationship traversal documentation

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/docs build`
- [x] Request schema matches V1ContentsRequestSchema
- [x] Response schema matches V1ContentsResponseSchema

#### Manual Verification:
- [ ] Contents page renders correctly
- [ ] Example curl commands work against actual API
- [ ] Missing IDs behavior documented accurately

**Implementation Note**: After completing this phase, pause for manual verification before proceeding to Phase 5.

---

## Phase 5: Rewrite FindSimilar Documentation

### Overview
Rewrite findsimilar.mdx (formerly similar.mdx) to match V1FindSimilarRequestSchema and V1FindSimilarResponseSchema.

### Changes Required:

#### 1. Rewrite findsimilar.mdx
**File**: `apps/docs/src/content/api/findsimilar.mdx`
**Changes**: Complete rewrite based on `packages/console-types/src/api/v1/findsimilar.ts`

**V1 Request Schema:**
```typescript
{
  id?: string              // Content ID (optional if url provided)
  url?: string             // URL alternative to ID (optional if id provided)
  limit?: number           // 1-50, default 10
  threshold?: number       // 0-1, default 0.5
  sameSourceOnly?: boolean // Filter to same source, default false
  excludeIds?: string[]    // IDs to exclude
  filters?: V1SearchFilters // Same filters as search
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

**Key Sections to Include:**
1. Endpoint: `POST https://lightfast.ai/v1/findsimilar`
2. Authentication (reference auth page)
3. Request: either `id` OR `url` required (not both, but one must be provided)
4. Response with `source` object and `similar` array
5. Similarity metrics: `vectorSimilarity`, `entityOverlap`, `sameCluster`
6. Threshold filtering explanation
7. Filter examples (same as search filters)

**Remove:**
- `includeRationale` parameter (doesn't exist)
- Response `rationale` field (doesn't exist)
- `offset` parameter (not supported)
- Old response structure (`data[]`, `meta.sourceId`)

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/docs build`
- [x] Request schema matches V1FindSimilarRequestSchema
- [x] Response schema matches V1FindSimilarResponseSchema

#### Manual Verification:
- [ ] FindSimilar page renders correctly
- [ ] Example curl commands work against actual API
- [ ] Similarity metrics documented accurately

**Implementation Note**: After completing this phase, pause for manual verification before proceeding to Phase 6.

---

## Phase 6: Rewrite Overview and Errors

### Overview
Update the API overview page for 3 routes and align error codes with v1 implementation.

### Changes Required:

#### 1. Rewrite overview.mdx
**File**: `apps/docs/src/content/api/overview.mdx`
**Changes**:
- Change "Four Routes" to "Three Routes"
- Remove Answer route card
- Update Similar card to FindSimilar with correct path `/v1/findsimilar`
- Update base URL to `https://lightfast.ai/v1`
- Add X-Workspace-ID to authentication examples
- Update filter examples to use v1 filter names
- Remove MCP integration section (move to guides or remove)
- Remove rate limiting headers section (not implemented)
- Update SDK section to mark as "Coming Soon" or remove
- Update error format to match v1

#### 2. Update errors.mdx
**File**: `apps/docs/src/content/api/errors.mdx`
**Changes**: Align with v1 error codes from with-dual-auth.ts

**V1 Error Codes:**
| Code | Status | Description |
|------|--------|-------------|
| `INVALID_JSON` | 400 | Invalid JSON body |
| `VALIDATION_ERROR` | 400 | Schema validation failed |
| `UNAUTHORIZED` | 401 | No authentication provided |
| `BAD_REQUEST` | 400 | Missing X-Workspace-ID |
| `FORBIDDEN` | 403 | Access denied to workspace |
| `NOT_FOUND` | 404 | Workspace or resource not found |
| `CONFIG_ERROR` | 500 | Workspace not configured |
| `INTERNAL_ERROR` | 500 | Server error |
| `METHOD_NOT_ALLOWED` | 405 | Wrong HTTP method |

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/docs build`
- [x] Overview shows 3 routes
- [x] Error codes match v1 implementation

#### Manual Verification:
- [ ] Overview page renders with correct route cards
- [ ] Error page shows accurate error codes and handling

**Implementation Note**: After completing this phase, run full verification.

---

## Testing Strategy

### Automated Tests:
- Build passes: `pnpm --filter @lightfast/docs build`
- No broken links: Check navigation and internal links
- TypeScript/MDX compilation: No errors in content files

### Manual Testing Steps:
1. Navigate to `/api` - verify 3 route cards displayed
2. Test each route page renders correctly
3. Copy curl examples and verify they're syntactically correct
4. Verify authentication section shows dual auth + X-Workspace-ID
5. Compare documented schemas to `packages/console-types/src/api/v1/` types

## Performance Considerations

None - this is documentation-only changes.

## Migration Notes

None - no data migration required.

## References

- Research document: `thoughts/shared/research/2025-12-14-api-docs-v1-rework-analysis.md`
- V1 Type schemas: `packages/console-types/src/api/v1/`
- V1 Route implementations: `apps/console/src/app/(api)/v1/`
- Dual auth middleware: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

## Open Questions (Resolved)

1. **Base URL**: Using `https://lightfast.ai/v1` based on console routes
2. **SDK Status**: Marking as "Coming Soon" in overview, removing sdks.mdx from navigation
3. **Rate Limiting**: Not implemented in v1 - removing from docs
4. **API Key Prefixes**: Documenting generically without specific prefixes

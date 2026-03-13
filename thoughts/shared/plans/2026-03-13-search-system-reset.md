---
date: 2026-03-13T00:00:00+00:00
author: claude
git_commit: a077752af0bd9bdf0d98a756c665e4c0523d8ce5
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Search system clean-slate reset + auth shared layer"
tags: [plan, search, auth, console-validation, console-ai, api-routes, refactor]
status: implemented
last_updated: 2026-03-13
---

# Plan: Search System Clean-Slate Reset + Auth Shared Layer

## Goal

Raze the current search system to a clean state, then rebuild with a flat versioning-free architecture. In parallel, move the auth utilities to a shared location so all routes (search and future ones) use the same code path.

**Keep:** endpoint names (`search`, `contents`, `findsimilar`, `related`), the `mode` field (`"fast" | "balanced" | "thorough"`), `EventBase` schema atom, the answer route.

**Delete:** v1 schemas, v2 schemas, internal tRPC schemas, all v1 route stubs, the `v1/lib/` auth location.

## Research References

- `thoughts/shared/research/2026-03-13-search-system-reset.md` — full current-state audit
- `thoughts/shared/research/2026-03-13-v2-route-implementation-research.md` — concrete DB/Pinecone patterns to use when rebuilding

---

## Phase 1 — Clean up `packages/console-validation`

**Goal:** One set of schemas, no version prefix, clean exports.

### 1a. Promote V2 schemas to canonical (remove `v2/` directory)

Move the V2 schemas up to be the canonical schemas (no version prefix):

```
packages/console-validation/src/schemas/api/
  common.ts       ← was v2/common.ts (EventBase, RerankMode, SearchFilters, SourceReference)
  search.ts       ← was v2/search.ts
  contents.ts     ← was v2/contents.ts
  findsimilar.ts  ← was v2/findsimilar.ts
  related.ts      ← was v2/related.ts
  index.ts        ← rewrite: export everything without V1/V2 prefixes
```

Rename all Zod schema exports to drop the `V2` prefix:
- `V2SearchRequestSchema` → `SearchRequestSchema`
- `V2SearchResponseSchema` → `SearchResponseSchema`
- `V2SearchResult` → `SearchResult`
- Same pattern for contents, findsimilar, related
- `EventBaseSchema`, `RerankModeSchema`, `SearchFiltersSchema`, `SourceReferenceSchema` — already have no version prefix in `v2/common.ts`, keep as-is

### 1b. Delete everything else in `schemas/api/`

Delete:
- `packages/console-validation/src/schemas/api/v1/` (entire directory — 5 files)
- `packages/console-validation/src/schemas/api/v2/` (entire directory — 6 files, after moving content)
- `packages/console-validation/src/schemas/api/search.ts` (internal tRPC schema)
- `packages/console-validation/src/schemas/api/contents.ts` (internal tRPC schema)
- `packages/console-validation/src/schemas/api/common.ts` (internal common — `LatencySchema`, `PaginationSchema`, `RequestIdSchema` — unused after deletion)

### 1c. Update `packages/console-validation/src/schemas/api/index.ts`

Rewrite to:
```ts
export * from "./common";   // EventBase, RerankMode, SearchFilters, SourceReference
export * from "./search";   // SearchRequest, SearchResponse, SearchResult
export * from "./contents"; // ContentsRequest, ContentsResponse, ContentsItem
export * from "./findsimilar"; // FindSimilarRequest, FindSimilarResponse
export * from "./related";  // RelatedRequest, RelatedResponse, RelatedNode, RelatedEdge
```

### 1d. Update `packages/console-validation/src/index.ts`

Remove the v1 and v2 re-exports, ensure only the canonical schemas are exported from the package root.

### Success criteria
- `tsc --noEmit` on `@repo/console-validation` passes
- No `V1` or `V2` prefixed exports anywhere in the package
- `EventBaseSchema`, `RerankModeSchema`, `SearchRequestSchema`, `ContentsRequestSchema`, `FindSimilarRequestSchema`, `RelatedRequestSchema` are importable from `@repo/console-validation`

---

## Phase 2 — Move auth to shared `(api)/lib/`

**Goal:** Single auth implementation usable by all route handlers, version-agnostic location.

### 2a. Move auth files

Move (not copy):
```
apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts
  → apps/console/src/app/(api)/lib/with-api-key-auth.ts

apps/console/src/app/(api)/v1/lib/with-dual-auth.ts
  → apps/console/src/app/(api)/lib/with-dual-auth.ts
```

The two files have a relative import between them — update that relative path after moving.

### 2b. Update answer route import

`apps/console/src/app/(api)/v1/answer/[...v]/route.ts` currently imports from `~/lib` (alias). Check the exact import path and update to point to the new `(api)/lib/` location:
```ts
// before
import { withDualAuth } from "../lib/with-dual-auth";
// after (relative from answer/[...v]/ to (api)/lib/)
import { withDualAuth } from "../../lib/with-dual-auth";
```

### 2c. Update middleware Clerk bypass

`apps/console/src/middleware.ts:71-75` — add search endpoint paths to the bypass matcher.

Current:
```ts
const isV1ApiRoute = createRouteMatcher(["/v1/(.*)", "/api/cli/(.*)", "/api/events/(.*)"]);
```

New (after routes are created in Phase 3):
```ts
const isApiRoute = createRouteMatcher([
  "/v1/(.*)",          // keep for answer route
  "/search(.*)",       // new search
  "/contents(.*)",     // new contents
  "/findsimilar(.*)",  // new findsimilar
  "/related(.*)",      // new related
  "/api/cli/(.*)",
  "/api/events/(.*)",
]);
```

Rename `isV1ApiRoute` → `isApiRoute` and update the usage at line 148-151.

### 2d. Delete old `v1/lib/` if empty

After moving, if `apps/console/src/app/(api)/v1/lib/` is empty, delete the directory. Keep `v1/` itself only while the answer route still lives there.

### Success criteria
- `with-dual-auth.ts` and `with-api-key-auth.ts` exist in `(api)/lib/`
- `answer/[...v]/route.ts` compiles and imports correctly
- No files left importing from `(api)/v1/lib/`

---

## Phase 3 — Delete v1 route stubs

**Goal:** Remove the 5 dead stub files.

Delete:
- `apps/console/src/app/(api)/v1/search/route.ts`
- `apps/console/src/app/(api)/v1/contents/route.ts`
- `apps/console/src/app/(api)/v1/findsimilar/route.ts`
- `apps/console/src/app/(api)/v1/graph/route.ts`
- `apps/console/src/app/(api)/v1/related/route.ts`

And their directories if they become empty:
- `v1/search/`, `v1/contents/`, `v1/findsimilar/`, `v1/graph/`, `v1/related/`

**Note:** Keep `v1/answer/` — this is a real, working route.

### Success criteria
- Five 501 stub files gone
- `v1/answer/[...v]/route.ts` still exists and compiles

---

## Phase 4 — Create new flat route handlers

**Goal:** Real route handlers at version-free paths using the canonical schemas.

### Route structure

```
apps/console/src/app/(api)/
  lib/
    with-dual-auth.ts    ← moved in Phase 2
    with-api-key-auth.ts ← moved in Phase 2
  search/
    route.ts
  contents/
    route.ts
  findsimilar/
    route.ts
  related/
    route.ts
```

### Route pattern

Each route follows this shape:
```ts
import { NextRequest, NextResponse } from "next/server";
import { withDualAuth, createDualAuthErrorResponse } from "../lib/with-dual-auth";
import { SearchRequestSchema } from "@repo/console-validation";
import { searchLogic } from "~/lib/search";  // Phase 5

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const authResult = await withDualAuth(request, requestId);
  if (!authResult.success) return createDualAuthErrorResponse(authResult, requestId);

  const body = await request.json();
  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", requestId }, { status: 400 });
  }

  const result = await searchLogic(authResult.data, parsed.data, requestId);
  return NextResponse.json(result);
}
```

### Implementation detail per route

Each route handler is thin — parse auth, parse input, call logic function, return JSON. No business logic in routes.

**`POST /search`** — input: `SearchRequestSchema`, output: `SearchResponseSchema`
**`POST /contents`** — input: `ContentsRequestSchema`, output: `ContentsResponseSchema`
**`POST /findsimilar`** — input: `FindSimilarRequestSchema`, output: `FindSimilarResponseSchema`
**`POST /related`** — input: `RelatedRequestSchema`, output: `RelatedResponseSchema`

### Success criteria
- All 4 routes exist
- All return typed responses from canonical schemas
- Auth via shared `withDualAuth`
- Build passes

---

## Phase 5 — Create logic layer in `apps/console/src/lib/`

**Goal:** Business logic functions for each endpoint, one file per endpoint.

### Structure

```
apps/console/src/lib/
  search.ts       → searchLogic(auth, input, requestId)
  contents.ts     → contentsLogic(auth, input, requestId)
  findsimilar.ts  → findSimilarLogic(auth, input, requestId)
  related.ts      → relatedLogic(auth, input, requestId)
```

**No `neural/` subdirectory** — helper logic (entity search, ID normalization, URL building) goes inline or as private functions in the same file. The deleted `lib/neural/` pattern is not recreated.

### Shared type

```ts
// apps/console/src/lib/types.ts
export interface AuthContext {
  workspaceId: string;
  userId: string;
  authType: "api-key" | "session";
  apiKeyId?: string;
}
```

### Implementation references

Refer to `thoughts/shared/research/2026-03-13-v2-route-implementation-research.md` for:
- Pinecone query pattern (namespace from `getCachedWorkspaceConfig`, filter `layer: observations`, topK `limit * 3`)
- Entity search (regex patterns, junction table lookup)
- Vector ID normalization (`metadata.observationId` for Phase 3 vectors, `workspaceInterpretations` fallback for legacy)
- Rerank flow (`createRerankProvider(mode).rerank(...)`)
- Related BFS algorithm
- URL building patterns per source type
- `doc_*` vs `obs_*` ID split for contents

### Success criteria
- All 4 logic files exist with typed function signatures
- Routes in Phase 4 wire to these functions
- tRPC search/contents routers updated to use same logic functions (or left as-is as internal path)

---

## Phase 6 — Update AI tool layer (`@repo/console-ai` + `@repo/console-ai-types`)

**Goal:** Update tool schemas and output types to use canonical schemas. Wire tool handlers in answer route.

### 6a. Update `@repo/console-ai` tool output schemas

Each tool's `outputSchema` currently references V1 schemas. Update to canonical:
- `workspace-search.ts`: `outputSchema: SearchResponseSchema` (from `@repo/console-validation`)
- `workspace-contents.ts`: `outputSchema: ContentsResponseSchema`
- `workspace-find-similar.ts`: `outputSchema: FindSimilarResponseSchema`
- `workspace-related.ts`: `outputSchema: RelatedResponseSchema`

Fix input schema gaps (currently misaligned with V2 schema):
- `workspaceSearch`: add `filters.dateRange`, change `limit` max to 100, add `offset`
- `workspaceRelated`: add `depth` (int 1-3), add `types` filter
- `workspaceFindSimilar`: add `url` (alternative to `id`), `sameSourceOnly`, `excludeIds`, `filters`
- Fix `mode` in tool-guidance.ts: `mode='hybrid'` is invalid, remove or use `mode='balanced'`

### 6b. Update `@repo/console-ai-types`

- Replace all V1 imports (`V1SearchResponse`, etc.) with canonical imports (`SearchResponse`, etc.)
- Update `SearchToolOutput`, `ContentsToolOutput`, `FindSimilarToolOutput`, `RelatedToolOutput`
- Update UI part types if affected

### 6c. Wire tool handlers in answer route

`apps/console/src/app/(api)/v1/answer/[...v]/route.ts` — replace the 4 `throw new Error("Not implemented")` handlers with calls to the logic functions from Phase 5:

```ts
createRuntimeContext: ({ workspaceId, userId }) => ({
  workspaceId,
  userId,
  authToken: token,
  tools: {
    workspaceSearch: { handler: (input) => searchLogic({ workspaceId, userId, authType: "session" }, input, randomUUID()) },
    workspaceContents: { handler: (input) => contentsLogic({ workspaceId, userId, authType: "session" }, input, randomUUID()) },
    workspaceFindSimilar: { handler: (input) => findSimilarLogic({ workspaceId, userId, authType: "session" }, input, randomUUID()) },
    workspaceRelated: { handler: (input) => relatedLogic({ workspaceId, userId, authType: "session" }, input, randomUUID()) },
  },
}),
```

### Success criteria
- `@repo/console-ai` tool schemas match canonical `@repo/console-validation` schemas
- `@repo/console-ai-types` has no V1 imports
- Answer agent tool calls succeed (no "Not implemented" errors)
- `answer-tool-call-renderer.tsx` renders results correctly

---

## Phase 7 — tRPC cleanup (optional / defer)

**Goal:** Remove the duplicated API key verification in tRPC.

The tRPC `apiKeyProcedure` (`api/console/src/trpc.ts:505-714`) duplicates the same SHA-256 hash lookup logic as `withApiKeyAuth`. Options:

**Option A (recommended):** Extract the DB lookup into a shared helper in `@repo/console-api-key` or a new `@repo/console-auth` internal package. Both `withApiKeyAuth` and `apiKeyProcedure` import from it.

**Option B:** Leave as-is. The tRPC path is internal (console UI), the HTTP path is external (SDK). Duplication is acceptable.

Decision: defer until Phase 6 is complete. Track as a known tech debt item.

---

## Execution Order

| Phase | Description | Depends on | Est. scope |
|---|---|---|---|
| 1 | Clean up `console-validation` schemas | — | Small |
| 2 | Move auth to `(api)/lib/`, update middleware | — | Small |
| 3 | Delete v1 route stubs | 2 | Trivial |
| 4 | Create new flat route handlers | 1, 2, 3 | Small |
| 5 | Create logic layer | 1 | Large |
| 6 | Update AI tool layer + wire handlers | 1, 5 | Medium |
| 7 | tRPC deduplication | 5 | Optional |

Phases 1 and 2 are independent and can be done in parallel. Phase 3 depends on 2 (auth moved before stubs deleted). Phase 4 depends on 1 and 2 being done. Phase 5 is the bulk of the work. Phase 6 requires Phase 5.

---

## Files to Delete (complete list)

```
# Schema layer
packages/console-validation/src/schemas/api/v1/search.ts
packages/console-validation/src/schemas/api/v1/contents.ts
packages/console-validation/src/schemas/api/v1/findsimilar.ts
packages/console-validation/src/schemas/api/v1/graph.ts
packages/console-validation/src/schemas/api/v1/common.ts
packages/console-validation/src/schemas/api/v1/index.ts
packages/console-validation/src/schemas/api/v2/            ← after promoting to canonical

packages/console-validation/src/schemas/api/search.ts      ← internal tRPC schema
packages/console-validation/src/schemas/api/contents.ts    ← internal tRPC schema
packages/console-validation/src/schemas/api/common.ts      ← internal common

# Route stubs
apps/console/src/app/(api)/v1/search/route.ts
apps/console/src/app/(api)/v1/contents/route.ts
apps/console/src/app/(api)/v1/findsimilar/route.ts
apps/console/src/app/(api)/v1/graph/route.ts
apps/console/src/app/(api)/v1/related/route.ts
```

## Files to Move

```
apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts
  → apps/console/src/app/(api)/lib/with-api-key-auth.ts

apps/console/src/app/(api)/v1/lib/with-dual-auth.ts
  → apps/console/src/app/(api)/lib/with-dual-auth.ts
```

## Files to Create

```
# Route handlers
apps/console/src/app/(api)/search/route.ts
apps/console/src/app/(api)/contents/route.ts
apps/console/src/app/(api)/findsimilar/route.ts
apps/console/src/app/(api)/related/route.ts

# Logic layer
apps/console/src/lib/search.ts
apps/console/src/lib/contents.ts
apps/console/src/lib/findsimilar.ts
apps/console/src/lib/related.ts
apps/console/src/lib/types.ts
```

## Files to Update

```
packages/console-validation/src/schemas/api/index.ts     ← rewrite exports
packages/console-validation/src/index.ts                 ← remove v1/v2 re-exports
apps/console/src/middleware.ts                           ← add new route patterns to bypass
apps/console/src/app/(api)/v1/answer/[...v]/route.ts    ← update auth import path, wire tools
packages/console-ai/src/workspace-search.ts             ← update output schema
packages/console-ai/src/workspace-contents.ts           ← update output schema
packages/console-ai/src/workspace-find-similar.ts       ← update output schema + input gaps
packages/console-ai/src/workspace-related.ts            ← update output schema + input gaps
packages/console-ai-types/src/index.ts                  ← replace V1 type imports
apps/console/src/ai/prompts/sections/tool-guidance.ts   ← fix mode='hybrid' bug
api/console/src/router/org/search.ts                    ← update to canonical schema
api/console/src/router/org/contents.ts                  ← update to canonical schema
```

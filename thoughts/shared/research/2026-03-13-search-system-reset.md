---
date: 2026-03-13T00:00:00+00:00
researcher: claude
git_commit: a077752af0bd9bdf0d98a756c665e4c0523d8ce5
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Search system full reset — current state audit before clean slate"
tags: [research, codebase, search, auth, v1, v2, console-validation, console-ai, api-routes]
status: complete
last_updated: 2026-03-13
---

# Research: Search System Full Reset — Current State Audit

**Date**: 2026-03-13
**Git Commit**: `a077752af0bd9bdf0d98a756c665e4c0523d8ce5`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

Map everything search-related across the repo so we can do a clean-slate reset:
- What exists, where it lives, what it's connected to
- The three generations of schemas and their consumers
- The authentication system and its duplication
- Better folder architecture for the new system

---

## Summary

The search system is currently in a **transitional half-deleted state**. All v1 HTTP route handlers are 501 stubs (deleted their logic). V2 schemas exist but have zero route handlers. The only working search is an internal tRPC procedure. The auth system has duplicated logic across two separate paths. Everything is ready to be razed and rebuilt cleanly.

**What to keep:** The `mode` field (`"fast" | "balanced" | "thorough"`), endpoint names (`search`, `contents`, `findsimilar`, `related`), and the `withDualAuth` pattern (moving it to a shared location).

**What to delete:** All three schema generations, all v1/v2 route stubs, the internal tRPC search/contents schemas, the `(api)/v1/lib/` location for auth utilities.

---

## Detailed Findings

### 1. Schema Generations (3 of them — all to be deleted)

#### Internal schemas (no version prefix)
- `packages/console-validation/src/schemas/api/search.ts` — `SearchRequestSchema` / `SearchResponseSchema`
  - Used ONLY by `api/console/src/router/org/search.ts` (tRPC)
  - Shape: `{ query, topK, filters.labels, includeHighlights }` → `{ results[], requestId, latency }`
  - `topK` instead of `limit`, `filters.labels` instead of `sourceTypes` — diverged from public API
- `packages/console-validation/src/schemas/api/contents.ts` — `ContentsRequestSchema` / `ContentsResponseSchema`
  - Used ONLY by `api/console/src/router/org/contents.ts` (tRPC)
- `packages/console-validation/src/schemas/api/common.ts` — `RequestIdSchema`, `LatencySchema`, `PaginationSchema`
  - Only used by the above two internal schemas

#### V1 public schemas (`packages/console-validation/src/schemas/api/v1/`)
- `search.ts` — `V1SearchRequestSchema` / `V1SearchResponseSchema` — the richest schema, includes `mode`, `meta.paths`, `context` (clusters/actors), full `latency` breakdown
- `graph.ts` — `V1GraphRequestSchema` / `GraphResponseSchema` / `V1RelatedRequestSchema` / `RelatedResponseSchema`
- `contents.ts`, `findsimilar.ts`
- **Consumers**: `@repo/console-ai` tool output schemas, `@repo/console-ai-types` tool output types
- **Route consumers**: zero — v1 routes are all 501 stubs

#### V2 public schemas (`packages/console-validation/src/schemas/api/v2/`)
- `common.ts` — `EventBaseSchema` (the atom: `id, title, source, type, url, occurredAt`), `RerankModeSchema`, `SearchFiltersSchema`, `SourceReferenceSchema`
- `search.ts`, `contents.ts`, `findsimilar.ts`, `related.ts`
- **Consumers**: zero — exported from `@repo/console-validation` root but no route handlers exist

#### Schema exports (`packages/console-validation/src/schemas/api/index.ts`)
```ts
// Internal (tRPC)
export { ContentsRequestSchema, ContentsResponseSchema } from "./contents";
export { SearchRequestSchema, SearchResponseSchema } from "./search";
// V1 public
export { V1SearchRequestSchema, V1SearchResponseSchema, ... } from "./v1";
// V2 public
export * from "./v2";
```

---

### 2. Route Handlers — Current State

| Route | Status | Auth | Logic |
|---|---|---|---|
| `POST /v1/search` | 501 stub → `/v2/search` | None | Deleted |
| `POST /v1/contents` | 501 stub → `/v2/contents` | None | Deleted |
| `POST /v1/findsimilar` | 501 stub → `/v2/findsimilar` | None | Deleted |
| `POST /v1/graph` | 501 stub → `/v2/related` | None | Deleted |
| `POST /v1/related` | 501 stub → `/v2/related` | None | Deleted |
| `POST/GET /v1/answer/[...v]` | Real, working | `withDualAuth` | Tools throw "Not implemented" |

The tRPC procedures are separate from the HTTP routes:
- `api/console/src/router/org/search.ts` — `apiKeyProcedure`, Pinecone-backed, uses internal schema
- `api/console/src/router/org/contents.ts` — `apiKeyProcedure`, DB-backed, `content` always `""`

No `/v2/*` route handlers exist anywhere.

---

### 3. Deleted Files (This Branch)

The following were deleted as part of `feat/backfill-depth-entitytypes-run-tracking`:

**`apps/console/src/lib/neural/`** (6 files):
- `four-path-search.ts` — parallel Pinecone + entity search orchestration
- `entity-search.ts` — regex entity detection + junction table lookup
- `id-resolver.ts` — vector ID normalization (Phase 3 via `metadata.observationId` OR legacy via `workspaceInterpretations`)
- `url-builder.ts` — source-specific URL construction
- `llm-filter.ts` — LLM-based result scoring
- `url-resolver.ts` — URL parsing to find matching events

**`apps/console/src/lib/v1/`** (6 files):
- `types.ts` — `V1AuthContext` interface
- `search.ts` — `searchLogic()` orchestrator
- `contents.ts` — `contentsLogic()` orchestrator (split doc_* vs obs_* IDs)
- `findsimilar.ts`, `related.ts`, `graph.ts` — logic functions

**`packages/console-ai/src/workspace-graph.ts`** — graph tool (graph endpoint merged into related)

**Zero broken references remain** — all call sites were updated in the same branch.

---

### 4. AI Tool Layer (`@repo/console-ai` + `@repo/console-ai-types`)

Four tool wrappers remain (workspace-graph deleted):
- `packages/console-ai/src/workspace-search.ts` — `workspaceSearchTool()`
- `packages/console-ai/src/workspace-contents.ts` — `workspaceContentsTool()`
- `packages/console-ai/src/workspace-find-similar.ts` — `workspaceFindSimilarTool()`
- `packages/console-ai/src/workspace-related.ts` — `workspaceRelatedTool()`

All four use **V1 output schemas** (`V1SearchResponseSchema`, `V1ContentsResponseSchema`, etc.) — these need to be updated to V2 schemas when V2 is built.

`packages/console-ai-types/src/index.ts` owns all type contracts:
- `AnswerAppRuntimeContext`: `{ workspaceId, userId, authToken?, tools?: AnswerToolRuntimeConfig }`
- `AnswerToolRuntimeConfig`: 4 optional `{ handler: Fn }` entries
- Tool input/output/UI part types — all currently reference V1 schemas

The answer route (`answer/[...v]/route.ts`) creates the agent but all 4 tool handlers currently throw `new Error("Not implemented")`.

Schema gaps between AI tool schemas and V2 schemas (known from thoughts docs):
- `workspaceSearch`: missing `filters.dateRange`, `offset`; `limit` max is 20 not 100
- `workspaceRelated`: missing `depth` (int 1-3), `types` filter
- `workspaceFindSimilar`: missing `url`, `sameSourceOnly`, `excludeIds`, `filters`
- `mode='hybrid'` in `tool-guidance.ts` is invalid (enum is `fast|balanced|thorough`)

---

### 5. Authentication System

#### Two separate implementations (duplication)

**Implementation A: `withDualAuth` + `withApiKeyAuth`** — used by Next.js HTTP route handlers
- Location: `apps/console/src/app/(api)/v1/lib/`
- `with-api-key-auth.ts`: extracts `Authorization: Bearer sk-lf-*`, hashes (SHA-256), queries `lightfast_workspace_api_keys`
- `with-dual-auth.ts`: wraps A + adds session path + validates workspace membership
  - Path A: `sk-lf-*` Bearer → `withApiKeyAuth` → reads `X-Workspace-ID`
  - Path B: other Bearer → trusts `X-Workspace-ID` + `X-User-ID` headers directly
  - Path C: no Authorization → Clerk `auth()` → `validateWorkspaceAccess` (DB + Redis cache)
- Returns: `DualAuthSuccess { workspaceId, userId, authType: "api-key" | "session", apiKeyId? }`

**Implementation B: `apiKeyProcedure` / `verifyApiKey`** — used by tRPC
- Location: `api/console/src/trpc.ts:505-714`
- Same logic: extract Bearer, hash, DB lookup, expiration check, last-used update
- Returns tRPC `ctx.auth = { type: "apiKey", orgId, userId, apiKeyId }`
- Does NOT handle `X-Workspace-ID` — individual procedures read it themselves

#### Clerk middleware bypass
- `apps/console/src/middleware.ts:71-75` — `isV1ApiRoute` matches `/v1/*`, `/api/cli/*`, `/api/events/*`
- V1 requests skip Clerk auth entirely; auth handled in route handlers
- **`/v2/*` is NOT in the bypass list** — must be added for V2 routes to work

#### Key package
- `packages/console-api-key/src/crypto.ts`: `generateOrgApiKey()`, `hashApiKey()` (SHA-256), `isValidApiKeyFormat()`
- Format: `sk-lf-` prefix + 43 nanoid chars = 49 chars total
- `packages/console-clerk-cache/`: Redis-cached org membership lookups (5 min TTL)

#### DB schema
- Table: `lightfast_workspace_api_keys` (`db/console/src/schema/tables/org-api-keys.ts`)
- Scoped by `clerkOrgId` (not `workspaceId` — org-level keys, workspace-level scoping in handlers)
- Hashed at rest, `keySuffix` (last 4) for display, `isActive` soft-delete

---

## Code References

- `packages/console-validation/src/schemas/api/index.ts` — top-level schema exports
- `packages/console-validation/src/schemas/api/search.ts` — internal tRPC schema (DELETE)
- `packages/console-validation/src/schemas/api/contents.ts` — internal tRPC schema (DELETE)
- `packages/console-validation/src/schemas/api/common.ts` — internal common types (DELETE)
- `packages/console-validation/src/schemas/api/v1/` — V1 public schemas (DELETE)
- `packages/console-validation/src/schemas/api/v2/` — V2 schemas (KEEP, rename as canonical)
- `apps/console/src/app/(api)/v1/search/route.ts:4-9` — 501 stub
- `apps/console/src/app/(api)/v1/contents/route.ts:4-9` — 501 stub
- `apps/console/src/app/(api)/v1/findsimilar/route.ts:4-9` — 501 stub
- `apps/console/src/app/(api)/v1/graph/route.ts:4-9` — 501 stub
- `apps/console/src/app/(api)/v1/related/route.ts:4-9` — 501 stub
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts` — real agent, tools throw "Not implemented"
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts` — auth, needs to move
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts` — auth, needs to move
- `apps/console/src/middleware.ts:71-75` — Clerk bypass, needs `/v2/*` added
- `api/console/src/trpc.ts:505-714` — duplicate `apiKeyProcedure` / `verifyApiKey`
- `api/console/src/router/org/search.ts` — only working search, internal schema, Pinecone
- `api/console/src/router/org/contents.ts` — working contents, `content` always `""`
- `packages/console-ai/src/workspace-search.ts` — AI tool, V1 output schema
- `packages/console-ai/src/workspace-contents.ts` — AI tool, V1 output schema
- `packages/console-ai/src/workspace-find-similar.ts` — AI tool, V1 output schema
- `packages/console-ai/src/workspace-related.ts` — AI tool, V1 output schema
- `packages/console-ai-types/src/index.ts` — all tool type contracts, V1 refs to update
- `packages/console-api-key/src/crypto.ts` — key generation/hashing/format
- `db/console/src/schema/tables/org-api-keys.ts` — `lightfast_workspace_api_keys` table

---

## Architecture Documentation

### What "reset" means concretely

**Delete from `packages/console-validation/src/schemas/api/`:**
- `search.ts` (internal)
- `contents.ts` (internal)
- `common.ts` (internal)
- `v1/` directory (entire)
- Update `index.ts` to only export from `v2/` (rename as canonical, drop the `V2` prefix)

**Delete from `apps/console/src/app/(api)/`:**
- `v1/search/route.ts`, `v1/contents/route.ts`, `v1/findsimilar/route.ts`, `v1/graph/route.ts`, `v1/related/route.ts` (stubs)
- `v1/lib/with-dual-auth.ts`, `v1/lib/with-api-key-auth.ts` (move, not delete)

**Keep:**
- `mode` field: `RerankModeSchema = z.enum(["fast", "balanced", "thorough"])` in `v2/common.ts`
- Endpoint names: `search`, `contents`, `findsimilar`, `related`
- `answer/[...v]` route (real, working)
- `@repo/console-ai` tool wrappers (update schemas)
- `@repo/console-ai-types` (update to V2 types)
- tRPC search/contents routers (update to new schemas)

### Proposed folder architecture

```
apps/console/src/app/(api)/
  lib/                          ← NEW shared location
    with-dual-auth.ts           ← MOVED from v1/lib/
    with-api-key-auth.ts        ← MOVED from v1/lib/
  search/
    route.ts                    ← NEW (versioning-free)
  contents/
    route.ts
  findsimilar/
    route.ts
  related/
    route.ts
  answer/
    [...v]/
      route.ts                  ← KEEP (already working)

packages/console-validation/src/schemas/api/
  search.ts                     ← RENAMED from v2/search.ts
  contents.ts                   ← RENAMED from v2/contents.ts
  findsimilar.ts                ← RENAMED from v2/findsimilar.ts
  related.ts                    ← RENAMED from v2/related.ts
  common.ts                     ← RENAMED from v2/common.ts (EventBase atom)
  index.ts                      ← cleaned up exports (no V1/V2 prefix)
```

### Auth flow (new)

Single `withAuth` in `apps/console/src/app/(api)/lib/`:
- Used by ALL route handlers: `search`, `contents`, `findsimilar`, `related`, `answer`
- Same 3 paths as current `withDualAuth`
- `apiKeyProcedure` in tRPC refactored to call shared utility from `@repo/console-api-key` (not duplicate the DB logic)
- Middleware: `apps/console/src/middleware.ts` updated to bypass Clerk for `/search/*`, `/contents/*`, `/findsimilar/*`, `/related/*`, `/answer/*` (or a pattern covering all of `(api)/`)

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-03-13-v2-route-implementation-research.md` — Highest-value reference: all concrete API signatures, DB column mappings, Pinecone patterns, recovered deleted implementation details
- `thoughts/shared/plans/2026-03-12-v2-api-schema-design.md` — V2 schema design decisions, `EventBase` rationale, no separate logic layer principle
- `thoughts/shared/plans/2026-03-12-pipeline-restructure-v2-remaining.md` — Phase ordering (schemas done, logic next, routes after, AI tools last)
- `thoughts/shared/research/2026-03-12-v1-type-schema-ownership.md` — Type ownership: API contract types in `@repo/console-validation` only, no app-level type defs

## Open Questions

1. **tRPC search/contents fate**: Delete and replace with HTTP routes? Or keep tRPC as internal API and add HTTP routes on top? The tRPC path is used by the console UI internally — this matters.
2. **`X-Workspace-ID` header vs path param**: Current auth requires workspace ID in a header. Should the new routes use a URL segment (e.g., `/search?workspaceId=...`) instead for SDK ergonomics?
3. **V1 schema package consumers**: Are there any external SDK consumers of `V1SearchRequestSchema`? If so, the SDK package needs updating too before deletion.
4. **Legacy vector scope**: Pre-Dec 15 2025 vectors need `workspaceInterpretations` fallback. Production volume is unknown — may need to retain this path even in a clean reset.

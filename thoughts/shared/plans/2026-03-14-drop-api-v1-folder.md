---
date: 2026-03-14T00:00:00+00:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Drop api/v1/ folder — migrate all consumers to canonical schemas"
tags: [plan, console-validation, sdk, mcp, openapi, migration]
status: ready
last_updated: 2026-03-14
---

# Drop `api/v1/` Implementation Plan

## Overview

`packages/console-validation/src/schemas/api/v1/` is a legacy folder containing public-API-shaped schemas. A newer set of canonical schemas already exists at `packages/console-validation/src/schemas/api/` that uses `EventBaseSchema` composition. This plan migrates every consumer to the canonical schemas and deletes the `v1/` folder entirely.

## Current State Analysis

Two schema layers coexist:

| Layer | Location | Shape | Used by |
|---|---|---|---|
| Canonical | `api/search.ts`, `api/contents.ts`, etc. | `EventBaseSchema.extend()` | tRPC routers |
| V1 | `api/v1/search.ts`, etc. | Flat standalone objects | SDK, MCP, OpenAPI, UI |

**6 consumer files hold V1 imports:**
- `packages/console-validation/src/index.ts` — main package entry, directly imports from `./schemas/api/v1/`
- `packages/console-openapi/src/registry.ts` — uses V1 Zod schemas at runtime for OpenAPI generation
- `core/lightfast/src/client.ts` — V1 response types as method return type annotations
- `core/lightfast/src/types.ts` — all SDK input/output types derived from V1 types
- `core/lightfast/src/index.ts` — re-exports V1 Zod schemas and types as the public SDK surface
- `core/mcp/src/server.ts` — uses V1 request schemas at runtime for MCP tool definitions

**4 UI components hold V1 imports:**
- `apps/console/src/components/workspace-search.tsx`
- `apps/console/src/components/search-results-list.tsx`
- `apps/console/src/components/search-results-panel.tsx`
- `apps/console/src/components/search-result-card.tsx`

### Key Structural Differences to Resolve

| Area | Canonical | V1 | Decision |
|---|---|---|---|
| `url` nullability | `z.string().nullable()` (via EventBase) | `z.string()` (non-nullable) | Keep canonical nullable |
| `occurredAt` | `z.string().datetime().nullable()` | `z.string().datetime().optional()` | Keep canonical nullable |
| Contents response envelope | `{ data: { items, missing }, meta: { total }, requestId }` | `{ items, missing, requestId }` (flat) | Update UI to use `response.data.items` |
| FindSimilar response envelope | `{ data: { source, similar }, meta: { total }, requestId }` | `{ source, similar, meta, requestId }` (flat) | Update UI to use `response.data.source` |
| `latency` on SearchResponse | absent | `V1SearchLatencySchema` | **Add to canonical** (API computes it) |
| `context` on SearchResponse | absent | `V1SearchContextSchema` | **Add to canonical** as optional |
| `took` in meta | absent | present on all response metas | **Add to canonical** response metas |
| `paths` in SearchMeta | absent | `{ vector, entity, cluster }` | **Add to canonical** |
| `includeContext` / `includeHighlights` | absent | on SearchRequest | **Drop** (backend ignores them) |
| `highlights` on SearchResult | absent | on V1SearchResult | **Drop** (backend never produces) |
| `linkingKey` on RelatedEdge | absent | `z.string().nullable()` | **Add to canonical** |
| `RelatedEventSchema` | absent | `{ id, title, source, type, occurredAt, url, relationshipType, direction }` | **Migrate** into canonical `related.ts` |
| `GraphResponseSchema` | canonical RelatedResponseSchema covers it | separate V1 schema | **Drop** — canonical RelatedResponseSchema is the target |
| `V1RelatedRequestSchema` (id-only) | absent | `{ id }` only | **Drop** — `RelatedRequestSchema` with `id`, `depth`, `types` is canonical |
| `SearchResultSchema.latestAction` / `totalEvents` | canonical-only fields | absent | Keep (entity-oriented extensions) |
| `FindSimilarResultSchema.similarity` | `similarity` | `vectorSimilarity` | Canonical name is `similarity` — SDK migrates |
| `FindSimilarResultSchema.sameCluster` | absent | present | **Drop** (no backend) |
| `FindSimilarSourceSchema.cluster` | absent | present | **Drop** (no backend) |
| `describe()` annotations | absent on request fields | present everywhere | **Add to canonical** for OpenAPI |

## Desired End State

- `packages/console-validation/src/schemas/api/v1/` folder is deleted
- `packages/console-validation/src/schemas/api/index.ts` exports only canonical schemas (no V1 re-exports)
- `packages/console-validation/src/index.ts` exports only canonical schemas (no V1 symbols)
- `core/lightfast` SDK uses canonical type names (`SearchResponse`, `ContentsResponse`, etc.)
- `core/mcp` uses canonical request schemas for MCP tool definitions
- `packages/console-openapi` generates OpenAPI spec from canonical schemas
- All UI components use canonical types
- `pnpm typecheck` passes across all packages

### Verification
```bash
pnpm typecheck
pnpm check
grep -r "v1/" packages/console-validation/src/  # should return nothing
grep -r "V1Search\|V1Contents\|V1FindSimilar\|V1Graph\|V1Related\|GraphResponseSchema" \
  core/ apps/console/src/ packages/console-openapi/src/  # should return nothing
```

## What We're NOT Doing

- Not changing the tRPC router implementations (`api/console/src/router/org/search.ts`, `contents.ts`)
- Not implementing the missing backends for findsimilar, graph, related
- Not renaming the URL paths (`/v1/search` stays `/v1/search` in OpenAPI)
- Not adding `highlights` back (dropped intentionally)
- Not adding `includeContext`/`includeHighlights` to canonical (dropped intentionally)
- Not changing how `latency` gets populated (backend currently doesn't — that's tracked separately)
- Not touching `apps/console/src/lib/search.ts` (already uses canonical types)

---

## Phase 1: Enrich Canonical Schemas

**File**: `packages/console-validation/src/schemas/api/search.ts`

Add `SearchLatencySchema`, `SearchContextSchema`, and enrich `SearchRequestSchema`, `SearchResponseSchema`.

```typescript
import { z } from "zod";
import {
  EventBaseSchema,
  RerankModeSchema,
  SearchFiltersSchema,
  SourceReferenceSchema,
} from "./common";

export const SearchRequestSchema = z.object({
  query: z
    .string()
    .min(1, "Query must not be empty")
    .describe("The search query text to find relevant documents"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of results to return (1-100, default: 10)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Result offset for pagination (default: 0)"),
  mode: RerankModeSchema.default("balanced").describe(
    "Search quality mode: 'fast' (speed), 'balanced' (default), 'thorough' (quality)"
  ),
  filters: SearchFiltersSchema.optional().describe(
    "Optional filters to scope results by source type, observation type, or date range"
  ),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResultSchema = EventBaseSchema.extend({
  snippet: z.string(),
  score: z.number(),
  latestAction: z.string().optional(),
  totalEvents: z.number().optional(),
  entities: z
    .array(z.object({ key: z.string(), category: z.string() }))
    .optional(),
  references: z.array(SourceReferenceSchema).optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchContextSchema = z.object({
  clusters: z
    .array(
      z.object({
        topic: z.string().nullable(),
        summary: z.string().nullable(),
        keywords: z.array(z.string()),
      })
    )
    .optional(),
});
export type SearchContext = z.infer<typeof SearchContextSchema>;

export const SearchLatencySchema = z.object({
  total: z.number().nonnegative(),
  auth: z.number().nonnegative().optional(),
  parse: z.number().nonnegative().optional(),
  search: z.number().nonnegative().optional(),
  embedding: z.number().nonnegative().optional(),
  retrieval: z.number().nonnegative(),
  entitySearch: z.number().nonnegative().optional(),
  clusterSearch: z.number().nonnegative().optional(),
  rerank: z.number().nonnegative(),
  enrich: z.number().nonnegative().optional(),
  maxParallel: z.number().nonnegative().optional(),
});
export type SearchLatency = z.infer<typeof SearchLatencySchema>;

export const SearchResponseSchema = z.object({
  data: z.array(SearchResultSchema),
  context: SearchContextSchema.optional(),
  meta: z.object({
    total: z.number().nonnegative(),
    limit: z.number(),
    offset: z.number(),
    took: z.number().nonnegative(),
    mode: RerankModeSchema,
    paths: z.object({
      vector: z.boolean(),
      entity: z.boolean(),
      cluster: z.boolean(),
    }),
  }),
  latency: SearchLatencySchema.optional(),
  requestId: z.string(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
```

**Note**: `tRPC search router` will need to add `took`, `paths` to its response (Phase 1 also touches `api/console/src/router/org/search.ts`).

---

**File**: `packages/console-validation/src/schemas/api/contents.ts`

Add `.describe()` to request schema. No envelope change needed (canonical nested form is correct).

```typescript
export const ContentsRequestSchema = z.object({
  ids: z
    .array(z.string())
    .min(1, "At least one ID required")
    .max(50, "Maximum 50 IDs per request")
    .describe("Array of document or observation IDs to fetch (1-50 IDs)"),
});
```

---

**File**: `packages/console-validation/src/schemas/api/findsimilar.ts`

Add `.describe()` to request fields, add `took` to response meta.

```typescript
export const FindSimilarRequestSchema = z
  .object({
    id: z.string().optional().describe("Document ID to find similar content for"),
    url: z.string().url().optional().describe("URL to find similar content for (alternative to id)"),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of similar items to return (1-50, default: 10)"),
    threshold: z.number().min(0).max(1).default(0.5).describe("Minimum similarity score 0-1 (default: 0.5)"),
    sameSourceOnly: z.boolean().default(false).describe("Only return results from the same source type (default: false)"),
    excludeIds: z.array(z.string()).optional().describe("Array of IDs to exclude from results"),
    filters: SearchFiltersSchema.optional().describe("Optional filters to scope results"),
  })
  .refine((data) => data.id || data.url, {
    message: "Either 'id' or 'url' must be provided",
  });

// FindSimilarResultSchema: keep canonical field name `similarity` (not `vectorSimilarity`)
// Drop `sameCluster` (no backend)

export const FindSimilarResponseSchema = z.object({
  data: z.object({
    source: FindSimilarSourceSchema,
    similar: z.array(FindSimilarResultSchema),
  }),
  meta: z.object({
    total: z.number(),
    took: z.number(),  // ADD
  }),
  requestId: z.string(),
});
```

---

**File**: `packages/console-validation/src/schemas/api/related.ts`

Add `linkingKey` to `RelatedEdgeSchema`, migrate `RelatedEventSchema`, add `.describe()` and `took` to meta.

```typescript
// Add to RelatedEdgeSchema:
export const RelatedEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string(),
  linkingKey: z.string().nullable(),  // ADD
  confidence: z.number(),
});

// Migrate RelatedEventSchema from v1/graph.ts:
export const RelatedEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  type: z.string(),
  occurredAt: z.string().nullable(),
  url: z.string().nullable(),
  relationshipType: z.string(),
  direction: z.enum(["outgoing", "incoming"]),
});
export type RelatedEvent = z.infer<typeof RelatedEventSchema>;

// Add took to RelatedResponseSchema.meta:
export const RelatedResponseSchema = z.object({
  data: z.object({
    root: EventBaseSchema,
    nodes: z.array(RelatedNodeSchema),
    edges: z.array(RelatedEdgeSchema),
  }),
  meta: z.object({
    depth: z.number(),
    nodeCount: z.number(),
    edgeCount: z.number(),
    took: z.number(),  // ADD
  }),
  requestId: z.string(),
});
```

---

**File**: `packages/console-validation/src/schemas/api/index.ts`

Remove all v1/ re-exports. Export all new canonical schemas.

```typescript
// Canonical API schemas (versioning-free) — single source of truth
export * from "./common";
export * from "./contents";
export * from "./findsimilar";
export * from "./related";
export * from "./search";
// NO v1/ exports
```

---

**File**: `api/console/src/router/org/search.ts`

Update response construction to include `took`, `paths`, and (stub) `latency`:

```typescript
const response: SearchResponse = {
  data: searchResults,
  meta: {
    total: searchResults.length,
    limit: input.limit,
    offset: input.offset,
    took: Date.now() - startTime,
    mode: input.mode,
    paths: { vector: true, entity: false, cluster: false },
  },
  requestId,
};
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck --filter @repo/console-validation` passes
- [x] `pnpm check --filter @repo/console-validation` passes

#### Manual Verification:
- [x] No type errors in canonical schema files

---

## Phase 2: Migrate `packages/console-openapi`

**File**: `packages/console-openapi/src/registry.ts`

Replace all V1 schema imports with canonical imports. Rename component schema keys.

```typescript
import {
  ContentsRequestSchema,
  ContentsResponseSchema,
  FindSimilarRequestSchema,
  FindSimilarResponseSchema,
  RelatedRequestSchema,
  RelatedResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema,
} from "@repo/console-validation/api";
import { createDocument } from "zod-openapi";

// components.schemas:
schemas: {
  SearchRequest: SearchRequestSchema,
  SearchResponse: SearchResponseSchema,
  ContentsRequest: ContentsRequestSchema,
  ContentsResponse: ContentsResponseSchema,
  FindSimilarRequest: FindSimilarRequestSchema,
  FindSimilarResponse: FindSimilarResponseSchema,
  GraphRequest: RelatedRequestSchema,      // /v1/graph uses RelatedRequestSchema
  GraphResponse: RelatedResponseSchema,    // /v1/graph uses RelatedResponseSchema
  RelatedRequest: RelatedRequestSchema,    // /v1/related also uses RelatedRequestSchema
  RelatedResponse: RelatedResponseSchema,  // /v1/related also uses RelatedResponseSchema
},
```

Replace all inline schema references (requestBody, responses) to use canonical schemas.

Then regenerate `openapi.json`:
```bash
pnpm --filter @repo/console-openapi build
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck --filter @repo/console-openapi` passes
- [x] `pnpm check --filter @repo/console-openapi` passes
- [x] `openapi.json` regenerated without V1 field names (no `V1SearchRequest`, `V1SearchResponse`, etc.)

---

## Phase 3: Migrate `core/lightfast` SDK

**File**: `core/lightfast/src/types.ts`

Replace all `V1*` imports with canonical equivalents. Update derived SDK input types.

```typescript
import type {
  ContentsRequest,
  ContentsResponse,
  FindSimilarRequest,
  FindSimilarResponse,
  FindSimilarResult,
  FindSimilarSource,
  RelatedRequest,
  RelatedResponse,
  RelatedEvent,
  SearchContext,
  SearchFilters,
  SearchLatency,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "@repo/console-validation";

// Re-export for SDK consumers (drop V1 prefixes):
export type {
  ContentsRequest, ContentsResponse,
  FindSimilarRequest, FindSimilarResponse, FindSimilarResult, FindSimilarSource,
  RelatedRequest, RelatedResponse, RelatedEvent,
  SearchContext, SearchFilters, SearchLatency,
  SearchRequest, SearchResponse, SearchResult,
};

// SDK Input types — same Omit/Partial/Pick pattern, updated field names:
// SearchInput: drop `includeContext`/`includeHighlights` (removed from canonical)
export type SearchInput = Omit<SearchRequest, "limit" | "offset" | "mode"> &
  Partial<Pick<SearchRequest, "limit" | "offset" | "mode">>;

export type ContentsInput = ContentsRequest;

export type FindSimilarInput = Omit<FindSimilarRequest, "limit" | "threshold" | "sameSourceOnly"> &
  Partial<Pick<FindSimilarRequest, "limit" | "threshold" | "sameSourceOnly">>;

export type GraphInput = Omit<RelatedRequest, "depth"> &
  Partial<Pick<RelatedRequest, "depth">>;

export type RelatedInput = RelatedRequest;
```

**File**: `core/lightfast/src/client.ts`

Update return types: `V1SearchResponse` → `SearchResponse`, etc. Remove the manual `includeContext: true` and `includeHighlights: true` defaults from the search call (those fields no longer exist on the request schema).

```typescript
import type {
  ContentsResponse,
  FindSimilarResponse,
  SearchResponse,
} from "@repo/console-validation";

// search() return type: Promise<SearchResponse>
// contents() return type: Promise<ContentsResponse>
// findSimilar() return type: Promise<FindSimilarResponse>
// graph() return type: Promise<RelatedResponse> (was: Promise<GraphResponse>)
// related() return type: Promise<RelatedResponse>

// Remove lines 94–95 in current client.ts:
//   includeContext: request.includeContext ?? true,   ← DELETE
//   includeHighlights: request.includeHighlights ?? true,  ← DELETE
```

**File**: `core/lightfast/src/index.ts`

Update schema imports: `V1SearchRequestSchema` → `SearchRequestSchema`, etc. Update all type re-exports.

```typescript
export {
  ContentsRequestSchema,
  FindSimilarRequestSchema,
  RelatedRequestSchema,    // replaces V1GraphRequestSchema + V1RelatedRequestSchema
  SearchRequestSchema,
} from "@repo/console-validation/api";

export type {
  ContentsInput, ContentsRequest, ContentsResponse,
  FindSimilarInput, FindSimilarRequest, FindSimilarResponse,
  FindSimilarResult, FindSimilarSource,
  GraphInput, RelatedInput, RelatedRequest, RelatedResponse, RelatedEvent,
  SearchContext, SearchFilters, SearchInput, SearchLatency,
  SearchRequest, SearchResponse, SearchResult,
} from "./types";
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck --filter @core/lightfast` passes
- [x] `pnpm check --filter @core/lightfast` passes

---

## Phase 4: Migrate `core/mcp`

**File**: `core/mcp/src/server.ts`

Replace V1 schema imports with canonical equivalents.

```typescript
import {
  ContentsRequestSchema,
  FindSimilarRequestSchema,
  RelatedRequestSchema,  // replaces V1GraphRequestSchema AND V1RelatedRequestSchema
  SearchRequestSchema,
} from "@repo/console-validation/api";

// Tool definitions use .shape on canonical schemas:
server.tool("search", ..., SearchRequestSchema.shape, ...)
server.tool("get-contents", ..., ContentsRequestSchema.shape, ...)
server.tool("find-similar", ..., FindSimilarRequestSchema.shape, ...)
server.tool("graph", ..., RelatedRequestSchema.shape, ...)   // was V1GraphRequestSchema
server.tool("find-related", ..., RelatedRequestSchema.shape, ...)  // was V1RelatedRequestSchema
```

**Note**: `V1GraphRequestSchema` and `V1RelatedRequestSchema` are both replaced by `RelatedRequestSchema`. The canonical schema has `id`, `depth` (default 1), `types`. This is a slightly different shape from `V1RelatedRequestSchema` (which only had `id`), but the canonical is more capable.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck --filter @core/mcp` passes
- [x] `pnpm check --filter @core/mcp` passes

---

## Phase 5: Migrate `apps/console` UI Components

**File**: `apps/console/src/components/workspace-search.tsx`

```typescript
// Replace:
import type { RerankMode, V1SearchResponse } from "@repo/console-validation";
// With:
import type { RerankMode, SearchResponse } from "@repo/console-validation";

// Replace V1SearchResponse → SearchResponse throughout
```

**File**: `apps/console/src/components/search-results-list.tsx`

```typescript
// Replace:
import type { V1SearchResponse } from "@repo/console-validation";
// With:
import type { SearchResponse } from "@repo/console-validation";

// Access changes:
// searchResults.latency.total → searchResults.latency?.total ?? 0
// searchResults.latency.retrieval → searchResults.latency?.retrieval ?? 0
// searchResults.latency.rerank → searchResults.latency?.rerank ?? 0
// (latency is now optional on SearchResponseSchema)
// searchResults.meta.mode → unchanged ✓
```

**File**: `apps/console/src/components/search-results-panel.tsx`

```typescript
// Replace V1SearchResponse → SearchResponse
```

**File**: `apps/console/src/components/search-result-card.tsx`

```typescript
// Replace:
import type { V1ContentsResponse, V1FindSimilarResponse, V1SearchResult } from "@repo/console-validation";
// With:
import type { ContentsResponse, FindSimilarResponse, SearchResult } from "@repo/console-validation";

// ContentsResponse envelope change (data is now nested):
// V1: (await res.json()) as V1ContentsResponse → data.items[0]
// New: (await res.json()) as ContentsResponse  → data.data.items[0]
// Also: item.content, item.metadata access is unchanged

// FindSimilarResponse envelope change:
// V1: similarData.similar → similarData.data.similar
// V1: similarData.source.cluster → similarData.data.source (no .cluster — dropped)
//     Remove the cluster topic/memberCount display block entirely (lines 285–296)
// V1: item.sameCluster → remove (field dropped)
// V1: item.url → type changes from string to string|null, update <a href> to handle null

// SearchResult field changes:
// result.url → type changes from string to string|null (handle null in the <a href> render)
// result.occurredAt → type changes from string|undefined to string|null (handle null)
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck --filter @lightfast/console` passes
- [x] `pnpm check --filter @lightfast/console` passes

#### Manual Verification:
- [ ] Search results list renders with latency values (or gracefully shows 0/nothing when not populated)
- [ ] "View source" link renders correctly when `url` is null (hidden/disabled)
- [ ] Contents panel loads correctly

---

## Phase 6: Drop `v1/` Folder and Clean Up

**Step 1**: Delete `packages/console-validation/src/schemas/api/v1/`

```bash
rm -rf packages/console-validation/src/schemas/api/v1/
```

**Step 2**: Update `packages/console-validation/src/schemas/api/index.ts`

Remove the v1/ re-exports (lines 8–12 in current file):
```typescript
// REMOVE these lines:
export { GraphResponseSchema, GraphNodeSchema, GraphEdgeSchema, ... } from "./v1/graph";
export { V1ContentsRequestSchema, ... } from "./v1/contents";
export { V1FindSimilarRequestSchema, ... } from "./v1/findsimilar";
export { V1SearchRequestSchema, ... } from "./v1/search";
```

**Step 3**: Update `packages/console-validation/src/index.ts`

Remove all V1 re-export blocks (lines ~117–164):
```typescript
// REMOVE the entire section:
// "V1 public API schemas — kept for backward compat (SDK, MCP, OpenAPI consumers)"
// export type { V1ContentItem, V1ContentsRequest, V1ContentsResponse } from "./schemas/api/v1/contents";
// export { V1ContentsRequestSchema, V1ContentsResponseSchema } from "./schemas/api/v1/contents";
// ... (all V1 blocks)
```

The canonical `export * from "./schemas/api"` (which was already in `index.ts`) will cover everything.

**Step 4**: Full typecheck

```bash
pnpm typecheck
pnpm check
```

**Step 5**: Verify deletion

```bash
grep -r "v1/" packages/console-validation/src/  # should return nothing
grep -r "V1Search\|V1Contents\|V1FindSimilar\|V1Graph\|V1Related" \
  core/ apps/console/src/ packages/console-openapi/src/ packages/console-validation/src/  # should return nothing
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes across all packages
- [x] `pnpm check` passes across all packages
- [x] `grep -r "from.*v1/" packages/console-validation/src/` returns nothing
- [x] `grep -r "V1Search\|V1Contents\|V1FindSimilar\|V1Graph\|V1Related" core/ apps/console/src/ packages/console-openapi/src/` returns nothing

---

## Testing Strategy

### Type Checking (primary signal)
Each phase ends with `pnpm typecheck --filter <package>`. The migration is purely a schema/type change, so type errors will surface any missed reference.

### Integration Check
After Phase 6, run the full check:
```bash
pnpm typecheck
pnpm check
grep -r "V1" packages/console-validation/src/schemas/api/  # should return nothing
```

---

## References

- Research: `thoughts/shared/research/2026-03-14-inngest-pipeline-search-architecture-audit.md` (related context)
- Canonical schemas: `packages/console-validation/src/schemas/api/`
- V1 schemas (to be deleted): `packages/console-validation/src/schemas/api/v1/`
- tRPC search router: `api/console/src/router/org/search.ts`
- tRPC contents router: `api/console/src/router/org/contents.ts`

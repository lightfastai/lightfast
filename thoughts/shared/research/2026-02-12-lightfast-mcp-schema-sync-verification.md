---
date: 2026-02-12T10:48:09Z
researcher: Claude (Sonnet 4.5)
git_commit: 2519b5ce1adc6052a426e85bf9b0276617950d79
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "Lightfast SDK and MCP Server Schema Synchronization Verification"
tags: [research, codebase, schema-sync, lightfast, mcp, console-types, validation]
status: complete
last_updated: 2026-02-12
last_updated_by: Claude (Sonnet 4.5)
---

# Research: Lightfast SDK and MCP Server Schema Synchronization Verification

**Date**: 2026-02-12T10:48:09Z
**Researcher**: Claude (Sonnet 4.5)
**Git Commit**: 2519b5ce1adc6052a426e85bf9b0276617950d79
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

Are `core/lightfast/` and `core/mcp/` properly synchronized with the schemas from `@repo/console-types`, and are there any misalignments that could cause issues?

## Summary

**Finding: ✅ PROPERLY SYNCHRONIZED**

The Lightfast SDK (`core/lightfast/`) and MCP server (`core/mcp/`) are **correctly synchronized** with schemas from `@repo/console-types`. The synchronization happens automatically through:

1. **TypeScript compilation** - Type definitions flow through the build pipeline
2. **Zod schema re-exports** - Runtime validation schemas are re-exported without modification
3. **Workspace protocol** - Monorepo dependencies ensure version alignment
4. **No schema duplication** - All schemas defined once in `@repo/console-types`

**Synchronization Flow**:
```
@repo/console-types (source of truth)
  ↓ devDependency + re-export
core/lightfast (SDK)
  ↓ workspace:* dependency + import
core/mcp (MCP server)
```

**Special Cases Identified**:
- ⚠️ **FindSimilar schema** requires unwrapping due to `.refine()` (intentional, properly handled)
- ℹ️ **SDK input types** transform V1 types to make defaults optional (intentional, improves DX)

**No misalignments detected.** All schemas flow from a single source of truth.

---

## Detailed Findings

### 1. Schema Source of Truth: @repo/console-types

#### Location: `packages/console-types/src/api/v1/`

All V1 API schemas are defined using Zod with co-located TypeScript types.

#### Schema Files

**Search Schemas** (`packages/console-types/src/api/v1/search.ts:1-247`):
- `V1SearchRequestSchema` (lines 42-81) - Query, limit, offset, mode, filters, context flags
- `V1SearchResponseSchema` (lines 233-246) - Results, context, meta, latency
- `V1SearchFiltersSchema` (lines 21-35) - Source/observation/actor filters, date range
- `V1SearchContextSchema` (lines 146-168) - Clusters, relevant actors
- `V1SearchLatencySchema` (lines 173-201) - Detailed latency breakdown
- `V1SearchMetaSchema` (lines 208-228) - Total, limit, offset, took, mode, paths
- `V1SearchResultSchema` (lines 104-141) - Individual search result structure
- `RerankModeSchema` (line 15) - Enum: "fast", "balanced", "thorough"

**Contents Schemas** (`packages/console-types/src/api/v1/contents.ts:1-62`):
- `V1ContentsRequestSchema` (lines 12-19) - Array of IDs (1-50)
- `V1ContentsResponseSchema` (lines 52-59) - Items, missing IDs, request ID
- `V1ContentItemSchema` (lines 26-45) - Individual content item structure

**FindSimilar Schemas** (`packages/console-types/src/api/v1/findsimilar.ts:1-142`):
- `V1FindSimilarRequestSchema` (lines 13-58) - **Has `.refine()` validation** (id OR url required)
- `V1FindSimilarResponseSchema` (lines 118-139) - Source, similar items, meta
- `V1FindSimilarResultSchema` (lines 65-88) - Individual similar result
- `V1FindSimilarSourceSchema` (lines 95-111) - Source document info

**Graph Schemas** (`packages/console-types/src/api/v1/graph.ts:1-119`):
- `V1GraphRequestSchema` (lines 12-16) - ID, depth (1-3), types filter
- `V1RelatedRequestSchema` (lines 23-25) - ID only
- `GraphResponseSchema` (lines 60-78) - Nodes, edges, meta
- `GraphNodeSchema` (lines 32-40) - Individual node structure
- `GraphEdgeSchema` (lines 47-53) - Edge/relationship structure
- `RelatedResponseSchema` (lines 101-116) - Related events grouped by source
- `RelatedEventSchema` (lines 85-94) - Individual related event

#### Validation Patterns

**Defaults** (applied server-side via `.default()`):
- `limit: .default(10)` - Search, contents, find similar
- `offset: .default(0)` - Search
- `mode: .default("balanced")` - Search
- `includeContext: .default(true)` - Search
- `includeHighlights: .default(true)` - Search
- `threshold: .default(0.5)` - Find similar
- `sameSourceOnly: .default(false)` - Find similar
- `depth: .default(2)` - Graph

**Constraints**:
- `limit: .min(1).max(100)` - Search
- `limit: .min(1).max(50)` - Find similar
- `ids: .min(1).max(50)` - Contents
- `depth: .min(1).max(3)` - Graph
- `threshold: .min(0).max(1)` - Find similar
- `query: .min(1)` - Search (non-empty)

**Cross-field validation**:
- FindSimilar: `.refine((data) => Boolean(data.id) || Boolean(data.url))` (line 56-58)

#### Package Exports (`packages/console-types/package.json:7-28`)

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    },
    "./api": "./src/api/index.ts",
    "./api/v1/search": "./src/api/v1/search.ts",
    "./api/v1/contents": "./src/api/v1/contents.ts",
    "./api/v1/findsimilar": "./src/api/v1/findsimilar.ts",
    "./api/v1/graph": "./src/api/v1/graph.ts"
  }
}
```

Multiple import paths available:
- `@repo/console-types` (main export)
- `@repo/console-types/api` (API subpath)
- `@repo/console-types/api/v1/search` (granular)

---

### 2. Lightfast SDK Schema Integration

#### Dependency Configuration (`core/lightfast/package.json:59-71`)

```json
{
  "dependencies": {
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@repo/console-types": "workspace:*"
  }
}
```

**Key aspects**:
- `@repo/console-types` is a **devDependency** (line 63)
- Uses `workspace:*` protocol for monorepo linking
- Types bundled at build time via tsup
- Consumers don't need `@repo/console-types` as a dependency

#### Type Re-Exports (`core/lightfast/src/types.ts:1-31`)

```typescript
// Re-export API types from console-types for SDK consumers
// These are used at compile time only (devDependency)
export type {
  // Search types
  V1SearchRequest,
  V1SearchResponse,
  V1SearchResult,
  V1SearchFilters,
  V1SearchContext,
  V1SearchLatency,
  V1SearchMeta,
  RerankMode,
  // Contents types
  V1ContentsRequest,
  V1ContentsResponse,
  V1ContentItem,
  // FindSimilar types
  V1FindSimilarRequest,
  V1FindSimilarResponse,
  V1FindSimilarResult,
  V1FindSimilarSource,
  // Graph types
  V1GraphRequest,
  GraphResponse,
  GraphNode,
  GraphEdge,
  // Related types
  V1RelatedRequest,
  RelatedResponse,
  RelatedEvent,
} from "@repo/console-types";
```

All V1 types re-exported without modification.

#### Zod Schema Re-Exports (`core/lightfast/src/index.ts:64-70`)

```typescript
// Zod Schemas (for runtime validation, used by MCP server)
export {
  V1SearchRequestSchema,
  V1ContentsRequestSchema,
  V1FindSimilarRequestSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
} from "@repo/console-types/api";
```

**Purpose**: Exported for downstream consumers (MCP server) that need runtime validation.

#### Type Transformations (`core/lightfast/src/types.ts:46-86`)

The SDK creates **input types** that make fields with server defaults optional:

**SearchInput** (lines 46-55):
```typescript
export type SearchInput = Omit<
  V1SearchRequest,
  "limit" | "offset" | "mode" | "includeContext" | "includeHighlights"
> &
  Partial<
    Pick<
      V1SearchRequest,
      "limit" | "offset" | "mode" | "includeContext" | "includeHighlights"
    >
  >;
```
- Removes: `limit`, `offset`, `mode`, `includeContext`, `includeHighlights`
- Re-adds as optional via `Partial<Pick<...>>`
- **Rationale**: Better DX since server applies defaults

**ContentsInput** (line 61):
```typescript
export type ContentsInput = V1ContentsRequest;
```
- Direct alias (no defaults to make optional)

**FindSimilarInput** (lines 67-73):
```typescript
export type FindSimilarInput = Omit<
  V1FindSimilarRequest,
  "limit" | "threshold" | "sameSourceOnly"
> &
  Partial<
    Pick<V1FindSimilarRequest, "limit" | "threshold" | "sameSourceOnly">
  >;
```
- Makes `limit`, `threshold`, `sameSourceOnly` optional

**GraphInput** (lines 79-80):
```typescript
export type GraphInput = Omit<V1GraphRequest, "depth"> &
  Partial<Pick<V1GraphRequest, "depth">>;
```
- Makes `depth` optional

**RelatedInput** (line 86):
```typescript
export type RelatedInput = V1RelatedRequest;
```
- Direct alias

#### Client Default Application (`core/lightfast/src/client.ts:85-167`)

The client applies defaults when constructing requests:

**Search** (lines 85-94):
```typescript
async search(request: SearchInput): Promise<V1SearchResponse> {
  return this.request<V1SearchResponse>("/v1/search", {
    query: request.query,
    limit: request.limit ?? 10,
    offset: request.offset ?? 0,
    mode: request.mode ?? "balanced",
    filters: request.filters,
    includeContext: request.includeContext ?? true,
    includeHighlights: request.includeHighlights ?? true,
  });
}
```

**FindSimilar** (lines 131-144):
```typescript
async findSimilar(request: FindSimilarInput): Promise<V1FindSimilarResponse> {
  if (!request.id && !request.url) {
    throw new ValidationError("Either 'id' or 'url' must be provided");
  }

  return this.request<V1FindSimilarResponse>("/v1/findsimilar", {
    id: request.id,
    url: request.url,
    limit: request.limit ?? 10,
    threshold: request.threshold ?? 0.5,
    sameSourceOnly: request.sameSourceOnly ?? false,
    excludeIds: request.excludeIds,
    filters: request.filters,
  });
}
```
- Client-side validation mirrors schema `.refine()` (line 132-134)

**Graph** (lines 162-167):
```typescript
async graph(request: GraphInput): Promise<GraphResponse> {
  return this.request<GraphResponse>("/v1/graph", {
    id: request.id,
    depth: request.depth ?? 2,
    types: request.types,
  });
}
```

#### Build Configuration (`core/lightfast/tsup.config.ts:4-27`)

```typescript
export default defineConfig({
  entry: {
    index: "./src/index.ts",
    client: "./src/client.ts",
    types: "./src/types.ts",
    errors: "./src/errors.ts",
    constants: "./src/constants.ts",
  },
  format: ["esm"],
  dts: true,              // Generate TypeScript declarations
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [],          // Bundle all imports
  target: "node18",
  bundle: true,          // Bundle types from console-types
});
```

**Result**: Types from `@repo/console-types` bundled into SDK distribution.

---

### 3. MCP Server Schema Consumption

#### Dependency Configuration (`core/mcp/package.json:50-54`)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "lightfast": "workspace:*",
    "zod": "^3.25.76"
  }
}
```

**Key aspects**:
- Depends on `lightfast` SDK (not `@repo/console-types` directly)
- Gets schemas transitively through SDK
- `workspace:*` ensures monorepo linking

#### Schema Imports (`core/mcp/src/server.ts:3-10`)

```typescript
import {
  Lightfast,
  V1SearchRequestSchema,
  V1ContentsRequestSchema,
  V1FindSimilarRequestSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
} from "lightfast";
```

All schemas imported from `lightfast` package (re-exported from `@repo/console-types/api`).

#### Tool Schema Registrations

**Pattern 1: Direct `.shape` Usage** (Most tools)

```typescript
server.tool(
  "lightfast_search",
  "Search through workspace neural memory...",
  V1SearchRequestSchema.shape,  // Extract object shape for MCP
  async (args) => {
    const results = await lightfast.search(args);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);
```

**Used by**:
- `lightfast_search` (line 35-45) - `V1SearchRequestSchema.shape`
- `lightfast_contents` (line 48-58) - `V1ContentsRequestSchema.shape`
- `lightfast_graph` (line 79-89) - `V1GraphRequestSchema.shape`
- `lightfast_related` (line 92-102) - `V1RelatedRequestSchema.shape`

**Pattern 2: Schema Unwrapping for `.refine()`** (FindSimilar only)

**Schema Unwrapping** (`core/mcp/src/server.ts:19-21`):
```typescript
// Extract the base object schema shape from FindSimilar (before .refine())
// This is needed because .refine() wraps the schema in ZodEffects
const V1FindSimilarBaseSchema = V1FindSimilarRequestSchema._def.schema;
```

**Tool Registration** (`core/mcp/src/server.ts:64-76`):
```typescript
server.tool(
  "lightfast_find_similar",
  "Find content semantically similar...",
  V1FindSimilarBaseSchema.shape,  // Use unwrapped base schema
  async (args) => {
    // Validate with full schema including refinement
    const validated = V1FindSimilarRequestSchema.parse(args);
    const results = await lightfast.findSimilar(validated);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);
```

**Why unwrapping is needed**:
- `.refine()` wraps schema in `ZodEffects` type
- MCP tools need `ZodObject` to extract `.shape`
- Unwrapping: `._def.schema` accesses base schema
- Manual validation: `.parse(args)` runs refinement check

#### Schema Usage Summary

| Tool | Schema | Pattern | Manual Validation | Line |
|------|--------|---------|-------------------|------|
| `lightfast_search` | `V1SearchRequestSchema.shape` | Direct | No | 35-45 |
| `lightfast_contents` | `V1ContentsRequestSchema.shape` | Direct | No | 48-58 |
| `lightfast_find_similar` | `V1FindSimilarBaseSchema.shape` | Unwrapped | Yes (line 70) | 64-76 |
| `lightfast_graph` | `V1GraphRequestSchema.shape` | Direct | No | 79-89 |
| `lightfast_related` | `V1RelatedRequestSchema.shape` | Direct | No | 92-102 |

---

## Synchronization Verification

### ✅ Type Synchronization

**Verification**: All V1 types in Lightfast SDK match console-types definitions

```
@repo/console-types defines:
  V1SearchRequest, V1SearchResponse, V1SearchResult, V1SearchFilters,
  V1SearchContext, V1SearchLatency, V1SearchMeta, RerankMode,
  V1ContentsRequest, V1ContentsResponse, V1ContentItem,
  V1FindSimilarRequest, V1FindSimilarResponse, V1FindSimilarResult, V1FindSimilarSource,
  V1GraphRequest, GraphResponse, GraphNode, GraphEdge,
  V1RelatedRequest, RelatedResponse, RelatedEvent

core/lightfast re-exports:
  ✓ All types above via `export type { ... } from "@repo/console-types"`
  ✓ No modifications to exported types
  ✓ Additional SDK input types (SearchInput, etc.) are transformations, not replacements
```

**Evidence**:
- `core/lightfast/src/types.ts:1-31` - Type re-export statement
- `core/lightfast/src/index.ts:26-61` - Public type exports

### ✅ Schema Synchronization

**Verification**: All request schemas in MCP server match console-types definitions

```
@repo/console-types defines:
  V1SearchRequestSchema (with defaults: limit=10, offset=0, mode="balanced", includeContext=true, includeHighlights=true)
  V1ContentsRequestSchema (ids array validation: min=1, max=50)
  V1FindSimilarRequestSchema (with .refine() for id OR url)
  V1GraphRequestSchema (with default: depth=2)
  V1RelatedRequestSchema (id only)

core/lightfast re-exports:
  ✓ All 5 request schemas via `export { ... } from "@repo/console-types/api"`
  ✓ No modifications

core/mcp imports:
  ✓ All 5 schemas via `import { ... } from "lightfast"`
  ✓ Uses .shape for MCP tool definitions
  ✓ Special handling for FindSimilar .refine() (intentional, properly implemented)
```

**Evidence**:
- `core/lightfast/src/index.ts:64-70` - Schema re-exports
- `core/mcp/src/server.ts:3-10` - Schema imports
- `core/mcp/src/server.ts:19-21` - FindSimilar unwrapping logic

### ✅ Validation Synchronization

**Verification**: All validation rules flow through correctly

**Search validation**:
- ✓ `query: .min(1)` - Enforced by schema
- ✓ `limit: .min(1).max(100).default(10)` - Enforced by schema
- ✓ `offset: .min(0).default(0)` - Enforced by schema
- ✓ `mode: enum + default("balanced")` - Enforced by schema

**Contents validation**:
- ✓ `ids: .min(1).max(50)` - Enforced by schema

**FindSimilar validation**:
- ✓ `limit: .min(1).max(50).default(10)` - Enforced by schema
- ✓ `threshold: .min(0).max(1).default(0.5)` - Enforced by schema
- ✓ `id OR url required` - Enforced by schema `.refine()` + client check
- ✓ MCP manually calls `.parse()` to run refinement

**Graph validation**:
- ✓ `depth: .min(1).max(3).default(2)` - Enforced by schema

### ✅ Default Value Synchronization

**Verification**: Defaults applied consistently

| Field | Schema Default | SDK Client Default | Match |
|-------|---------------|-------------------|-------|
| search.limit | 10 | 10 | ✓ |
| search.offset | 0 | 0 | ✓ |
| search.mode | "balanced" | "balanced" | ✓ |
| search.includeContext | true | true | ✓ |
| search.includeHighlights | true | true | ✓ |
| findSimilar.limit | 10 | 10 | ✓ |
| findSimilar.threshold | 0.5 | 0.5 | ✓ |
| findSimilar.sameSourceOnly | false | false | ✓ |
| graph.depth | 2 | 2 | ✓ |

**Evidence**:
- Schema defaults: `packages/console-types/src/api/v1/*.ts`
- Client defaults: `core/lightfast/src/client.ts:85-167`

### ✅ Build Pipeline Synchronization

**Verification**: Types flow through build pipeline correctly

```
1. pnpm build --filter @repo/console-types
   → Compiles Zod schemas to dist/

2. pnpm build --filter lightfast
   → tsup bundles types from @repo/console-types (devDependency)
   → Generates index.d.ts with bundled types
   → Schemas re-exported as JS exports

3. pnpm build --filter @lightfastai/mcp
   → TypeScript compiles with lightfast dependency
   → Imports schemas from lightfast dist/
   → Tool schemas use .shape property

4. Changesets publish
   → lightfast published with bundled types (no console-types dependency)
   → @lightfastai/mcp published with lightfast dependency
```

**Evidence**:
- `core/lightfast/tsup.config.ts:13,19` - `dts: true`, `bundle: true`
- `core/mcp/package.json:52` - `"lightfast": "workspace:*"`
- `.github/workflows/release.yml:50-75` - Build and publish workflow

---

## Code References

### Schema Definitions
- `packages/console-types/src/api/v1/search.ts:42-81` - V1SearchRequestSchema with defaults
- `packages/console-types/src/api/v1/search.ts:233-246` - V1SearchResponseSchema
- `packages/console-types/src/api/v1/contents.ts:12-19` - V1ContentsRequestSchema
- `packages/console-types/src/api/v1/contents.ts:52-59` - V1ContentsResponseSchema
- `packages/console-types/src/api/v1/findsimilar.ts:13-58` - V1FindSimilarRequestSchema with .refine()
- `packages/console-types/src/api/v1/findsimilar.ts:118-139` - V1FindSimilarResponseSchema
- `packages/console-types/src/api/v1/graph.ts:12-16` - V1GraphRequestSchema
- `packages/console-types/src/api/v1/graph.ts:23-25` - V1RelatedRequestSchema
- `packages/console-types/src/api/v1/graph.ts:60-80` - GraphResponseSchema
- `packages/console-types/src/api/v1/graph.ts:101-116` - RelatedResponseSchema

### Lightfast SDK Integration
- `core/lightfast/package.json:63` - @repo/console-types devDependency
- `core/lightfast/src/types.ts:1-31` - Type re-exports
- `core/lightfast/src/types.ts:46-86` - SDK input type transformations
- `core/lightfast/src/index.ts:64-70` - Zod schema re-exports
- `core/lightfast/src/client.ts:85-94` - search() with defaults
- `core/lightfast/src/client.ts:131-144` - findSimilar() with validation
- `core/lightfast/src/client.ts:162-167` - graph() with defaults
- `core/lightfast/tsup.config.ts:13,19` - Build config (dts, bundle)

### MCP Server Integration
- `core/mcp/package.json:52` - lightfast dependency
- `core/mcp/src/server.ts:3-10` - Schema imports
- `core/mcp/src/server.ts:19-21` - FindSimilar schema unwrapping
- `core/mcp/src/server.ts:35-45` - lightfast_search tool
- `core/mcp/src/server.ts:48-58` - lightfast_contents tool
- `core/mcp/src/server.ts:64-76` - lightfast_find_similar tool (with manual validation)
- `core/mcp/src/server.ts:79-89` - lightfast_graph tool
- `core/mcp/src/server.ts:92-102` - lightfast_related tool

---

## Special Cases

### 1. FindSimilar `.refine()` Handling

**Schema Definition** (`packages/console-types/src/api/v1/findsimilar.ts:56-58`):
```typescript
.refine((data) => Boolean(data.id) || Boolean(data.url), {
  message: "Either id or url must be provided",
});
```

**SDK Client Handling** (`core/lightfast/src/client.ts:132-134`):
```typescript
if (!request.id && !request.url) {
  throw new ValidationError("Either 'id' or 'url' must be provided");
}
```
- Client mirrors schema refinement for early validation

**MCP Server Handling** (`core/mcp/src/server.ts:19-21,70`):
```typescript
// Line 19-21: Unwrap base schema
const V1FindSimilarBaseSchema = V1FindSimilarRequestSchema._def.schema;

// Line 70: Manual validation with refinement
const validated = V1FindSimilarRequestSchema.parse(args);
```
- Uses base schema for `.shape` (MCP tool definition)
- Explicitly calls `.parse()` to run refinement validation

**Status**: ✅ Properly handled, no synchronization issue

### 2. SDK Input Type Transformations

**Pattern**: SDK creates developer-friendly input types

```typescript
// V1 Schema: All fields with defaults are required
V1SearchRequest {
  query: string;
  limit: number;        // Has default, but required in type
  offset: number;       // Has default, but required in type
  mode: RerankMode;     // Has default, but required in type
  // ...
}

// SDK Input: Makes default fields optional
SearchInput {
  query: string;
  limit?: number;       // Optional (SDK applies default)
  offset?: number;      // Optional (SDK applies default)
  mode?: RerankMode;    // Optional (SDK applies default)
  // ...
}
```

**Rationale**:
- Better developer experience
- Users don't need to specify fields with defaults
- SDK applies defaults before API call

**Status**: ✅ Intentional design, not a synchronization issue

---

## Architecture Patterns

### Single Source of Truth Pattern

```
@repo/console-types (defines once)
  ↓
All consumers import (never redefine)
  ├─ apps/console (API routes)
  ├─ packages/console-openapi (docs)
  ├─ packages/console-ai (AI tools)
  ├─ core/lightfast (SDK)
  └─ core/mcp (via lightfast)
```

**Benefits**:
- No schema duplication
- Single place to update
- Automatic propagation through build

### Workspace Protocol Pattern

```json
// core/lightfast/package.json
{
  "devDependencies": {
    "@repo/console-types": "workspace:*"
  }
}

// core/mcp/package.json
{
  "dependencies": {
    "lightfast": "workspace:*"
  }
}
```

**Benefits**:
- Monorepo automatic linking
- Always uses latest local version
- Changesets handles npm publish

### Type Bundling Pattern

**Lightfast SDK**:
- `@repo/console-types` as **devDependency**
- Types bundled via tsup (`dts: true`, `bundle: true`)
- Published package doesn't require console-types

**Benefits**:
- Consumers don't need internal packages
- Types compiled into SDK
- Clean dependency tree

### Schema Re-export Pattern

**Lightfast SDK**:
```typescript
// Types: Re-export for compile time
export type { V1SearchRequest, ... } from "@repo/console-types";

// Schemas: Re-export for runtime
export { V1SearchRequestSchema, ... } from "@repo/console-types/api";
```

**Benefits**:
- SDK consumers get types for compile time
- MCP server gets schemas for runtime validation
- Single import source (lightfast)

---

## Synchronization Guarantees

### Build-Time Guarantees

1. **TypeScript Compilation**: Type errors caught at compile time if schemas change
2. **Workspace Protocol**: Always uses latest local console-types version
3. **tsup Bundling**: Types bundled into SDK distribution
4. **Turbo Build**: Dependencies built in correct order

### Runtime Guarantees

1. **Zod Validation**: Schemas validate at runtime (API routes, MCP tools)
2. **Schema .shape**: MCP tools extract correct parameter definitions
3. **Refinement Validation**: `.refine()` rules run via `.parse()` calls
4. **Default Application**: Defaults applied consistently (schema + client)

### Release Guarantees

1. **Changesets Versioning**: SDK and MCP published together
2. **Version Verification**: CI checks for version drift (`.github/workflows/release.yml:77-96`)
3. **Dry-run Validation**: `changeset publish --dry-run` before actual publish

---

## Historical Context

### Related Research

- `thoughts/shared/research/2026-02-12-sdk-mcp-docs-schema-sync.md` - Original broader research on SDK, MCP, and documentation synchronization
- `thoughts/shared/plans/2026-02-12-fumadocs-v10-ecosystem-upgrade.md` - Fumadocs upgrade plan
- `thoughts/shared/plans/2026-02-12-full-schema-docs-sync.md` - Full schema documentation sync plan

### Key Decision

The monorepo uses a **single source of truth** pattern for schemas:
- All schemas defined in `@repo/console-types`
- Re-exported (not redefined) by consumers
- Build pipeline ensures synchronization

This was established when the V1 API was created and has remained consistent.

---

## Conclusion

**Finding: ✅ PROPERLY SYNCHRONIZED**

`core/lightfast/` and `core/mcp/` are correctly synchronized with schemas from `@repo/console-types`. All validation rules, defaults, and type definitions flow correctly through the build pipeline.

**Evidence of Synchronization**:
1. ✅ No schema duplication detected
2. ✅ All schemas imported from single source
3. ✅ Type transformations are intentional (SDK input types)
4. ✅ Special cases properly handled (FindSimilar `.refine()`)
5. ✅ Build pipeline ensures correct propagation
6. ✅ Release workflow verifies version alignment
7. ✅ Defaults match across schema and client
8. ✅ Validation rules consistent

**No misalignments found.** The architecture guarantees synchronization through:
- TypeScript compilation (compile-time errors)
- Workspace protocol (monorepo linking)
- Build ordering (Turborepo)
- Schema re-exports (runtime validation)

The only special case is FindSimilar's `.refine()` validation, which is intentionally unwrapped in the MCP server and manually validated via `.parse()`. This is the correct approach for working with `ZodEffects` in MCP tool definitions.

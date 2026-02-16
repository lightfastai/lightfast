---
date: 2026-02-12T10:15:20Z
researcher: Claude (Sonnet 4.5)
git_commit: beecbfe6946126bb325352b6cc7e9325be3551cf
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "SDK, MCP, and Documentation Schema Synchronization"
tags: [research, codebase, openapi, sdk, mcp, documentation, schema-sync, fumadocs]
status: complete
last_updated: 2026-02-12
last_updated_by: Claude (Sonnet 4.5)
---

# Research: SDK, MCP, and Documentation Schema Synchronization

**Date**: 2026-02-12T10:15:20Z
**Researcher**: Claude (Sonnet 4.5)
**Git Commit**: beecbfe6946126bb325352b6cc7e9325be3551cf
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

How to keep TypeScript SDK documentation (`apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx`) and MCP server documentation (`apps/docs/src/content/api/sdks-tools/mcp-server.mdx`) synchronized with OpenAPI schema changes? When a v1 API schema changes (e.g., V1SearchRequest), how do we propagate these changes to:
1. The auto-generated API endpoint pages
2. The manually written SDK documentation
3. The manually written MCP server documentation

The research also considers the GitHub workflow release process where TypeScript SDK and MCP server are deployed together.

## Summary

**Current State**: The codebase has **partial automation** for schema-to-docs synchronization:

- ✅ **API Endpoint Pages**: Fully automated via fumadocs-openapi virtual pages
- ❌ **SDK Documentation**: Manually maintained MDX files that can drift from actual types
- ❌ **MCP Server Documentation**: Manually maintained MDX files that can drift from tool schemas

**Source of Truth Hierarchy**:
```
@repo/console-types (Zod schemas)
  ↓
@repo/console-openapi (generates openapi.json)
  ↓
┌─────────────────┬─────────────────┬──────────────────────┐
│                 │                 │                      │
lightfast SDK     @lightfastai/mcp  fumadocs-openapi      Manual MDX files
(re-exports)      (uses schemas)    (virtual pages)       (OUT OF SYNC RISK)
```

**Key Finding**: When a schema changes in `@repo/console-types`, the OpenAPI spec and virtual endpoint pages update automatically via the prebuild hook. However, the SDK and MCP MDX documentation files remain static and require manual updates.

**Release Workflow**: The `.github/workflows/release.yml` ensures both packages (`lightfast` and `@lightfastai/mcp`) are published at the same version via changeset versioning and includes a verification step that checks for version drift (lines 77-96).

## Detailed Findings

### 1. Schema Definition Layer: @repo/console-types

**Location**: `packages/console-types/src/api/v1/`

All API schemas are **manually written** using Zod and serve as the single source of truth:

- `search.ts` (247 lines) - V1SearchRequestSchema, V1SearchResponseSchema, RerankMode
- `contents.ts` (62 lines) - V1ContentsRequestSchema, V1ContentsResponseSchema
- `findsimilar.ts` (142 lines) - V1FindSimilarRequestSchema, V1FindSimilarResponseSchema
- `graph.ts` (119 lines) - V1GraphRequestSchema, GraphResponseSchema, V1RelatedRequestSchema, RelatedResponseSchema

**Key Characteristics**:
- Uses Zod `.describe()` for inline documentation strings
- Defines `.default()` values for optional fields (e.g., `limit: z.number().default(10)`)
- Includes validation logic (e.g., `.refine()` for "id or url required" in FindSimilar)
- Private package (`"private": true` in package.json)

**Example** (packages/console-types/src/api/v1/search.ts:42-81):
```typescript
export const V1SearchRequestSchema = z.object({
  query: z.string().min(1).describe("The search query text to find relevant documents"),
  limit: z.number().int().min(1).max(100).default(10)
    .describe("Maximum number of results to return (1-100, default: 10)"),
  offset: z.number().int().min(0).default(0)
    .describe("Result offset for pagination (default: 0)"),
  mode: z.enum(["fast", "balanced", "thorough"]).default("balanced")
    .describe("Search quality mode: 'fast' (speed), 'balanced' (default), 'thorough' (quality)"),
  // ... more fields
});
```

### 2. OpenAPI Generation Layer: @repo/console-openapi

**Location**: `packages/console-openapi/`

**Architecture** (packages/console-openapi/src/registry.ts:1-245):
- Uses `@asteasolutions/zod-to-openapi` to convert Zod schemas to OpenAPI 3.1
- Imports schemas from `@repo/console-types/api`
- Registers schemas with `.register()` method
- Defines endpoint paths with full documentation metadata
- Exports `generateOpenAPIDocument()` function

**Generation Flow**:
1. `packages/console-openapi/scripts/generate.ts` - Calls `generateOpenAPIDocument()` and writes to `openapi.json`
2. Triggered via: `pnpm --filter @repo/console-openapi generate:openapi`
3. Output: `packages/console-openapi/openapi.json` (2,265 lines)

**Automatic Sync**: When schema changes in @repo/console-types:
- Rebuilding @repo/console-openapi automatically regenerates openapi.json with updated schemas
- All schema descriptions, validation rules, and defaults flow through to OpenAPI spec

### 3. Documentation Layer: apps/docs

**Build Pipeline** (apps/docs/package.json:8-11):
```json
{
  "prebuild": "tsx scripts/generate-api-docs.ts",
  "build:prod": "pnpm with-env next build --turbopack && pnpm search:sync:ci"
}
```

**Automatic API Endpoint Documentation**:

- **Script**: `apps/docs/scripts/generate-api-docs.ts` (prebuild hook)
  - Executes: `pnpm --filter @repo/console-openapi generate:openapi`
  - Ensures OpenAPI spec is regenerated before docs build

- **Virtual Pages**: `apps/docs/src/lib/source.ts:1-45`
  - Uses `fumadocs-openapi/server` to create virtual pages from openapi.json
  - Configuration: `openapiSource(openapi, { baseDir: "endpoints", groupBy: "tag", per: "operation" })`
  - Pages are generated at build time, not written to disk
  - Located at: `/docs/api-reference/endpoints/<endpoint-name>`

- **Page Rendering**: `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:18-136`
  - Detects OpenAPI virtual pages via `"getAPIPageProps" in page.data` check
  - Renders using `<APIPage>` component from fumadocs-openapi/ui
  - Includes interactive "Try It" playground

**Manual SDK/MCP Documentation** (OUT OF SYNC RISK):

- **TypeScript SDK**: `apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx` (216 lines)
  - Documents: Client configuration, search(), contents(), findSimilar(), error classes
  - Parameter tables are **manually written** (lines 26-30, 46-54, 98-100, etc.)
  - Example schemas are **manually maintained**

- **MCP Server**: `apps/docs/src/content/api/sdks-tools/mcp-server.mdx` (198 lines)
  - Documents: CLI options, tool parameters, response schemas
  - Parameter tables are **manually written** (lines 24-29, 49-54, 95-97, etc.)
  - Tool schemas and response examples are **manually maintained**

**Risk**: When a schema in @repo/console-types changes:
- ✅ OpenAPI spec updates automatically (via prebuild hook)
- ✅ Virtual API endpoint pages update automatically (rendered from OpenAPI)
- ❌ SDK MDX file does NOT update (requires manual edit)
- ❌ MCP MDX file does NOT update (requires manual edit)

### 4. TypeScript SDK Layer: core/lightfast

**Location**: `core/lightfast/`

**Type System** (core/lightfast/src/types.ts:1-108):
- Re-exports all V1 types from `@repo/console-types`
- Creates developer-friendly input types (SearchInput, ContentsInput, etc.)
- Makes fields with server-side defaults optional using `Omit` + `Partial`

**Example** (core/lightfast/src/types.ts:46-55):
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

**Client Implementation** (core/lightfast/src/client.ts:85-95):
- Applies defaults at call site: `limit ?? 10`, `offset ?? 0`, etc.
- Makes HTTP POST requests to `/v1/search`, `/v1/contents`, etc.
- Returns typed responses (V1SearchResponse, V1ContentsResponse, etc.)

**Schema Exports** (core/lightfast/src/index.ts:64-70):
- **Exports Zod schemas** for external consumers (notably MCP server)
- Schemas: V1SearchRequestSchema, V1ContentsRequestSchema, V1FindSimilarRequestSchema, etc.
- Reason: MCP server needs runtime validation via `.shape` property

**Dependency**: `@repo/console-types` (devDependency only, types inlined at compile time)

### 5. MCP Server Layer: @lightfastai/mcp

**Location**: `core/mcp/`

**Tool Registration** (core/mcp/src/server.ts:35-102):
- Registers 5 tools: `lightfast_search`, `lightfast_contents`, `lightfast_find_similar`, `lightfast_graph`, `lightfast_related`
- Uses Zod schemas imported from `lightfast` SDK (via re-export from @repo/console-types)
- Extracts parameter schemas via `.shape` property for MCP tool definition
- Special handling for `.refine()` wrapped schemas (FindSimilar uses `._def.schema` to unwrap)

**Example** (core/mcp/src/server.ts:35-45):
```typescript
server.tool({
  name: "lightfast_search",
  description: "Search through workspace memory for relevant documents and observations.",
  inputSchema: V1SearchRequestSchema.shape, // ← Direct schema usage
  handler: async (args) => {
    const response = await lightfast.search(args);
    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    };
  },
});
```

**Schema Dependency Chain**:
```
@repo/console-types (defines V1SearchRequestSchema)
  ↓
lightfast SDK (exports V1SearchRequestSchema)
  ↓
@lightfastai/mcp (imports and uses .shape for tool parameters)
```

**Automatic Sync**: When a schema changes:
- ✅ MCP tool parameters update automatically (at compile/runtime)
- ❌ MCP documentation MDX does NOT update

### 6. Release Workflow: .github/workflows/release.yml

**Location**: `.github/workflows/release.yml:1-102`

**Key Steps**:

1. **Build Packages** (line 50-52):
   ```yaml
   run: pnpm turbo build --filter lightfast --filter @lightfastai/mcp
   ```
   - Builds both packages together

2. **Run Tests** (line 54-57):
   ```yaml
   run: pnpm --filter lightfast test
   ```
   - Tests SDK only (MCP has no tests currently)

3. **Dry-run Validation** (line 59-63):
   ```yaml
   run: pnpm changeset publish --dry-run
   ```
   - Validates both packages before actual publish

4. **Publish with Changesets** (line 65-75):
   ```yaml
   uses: changesets/action@v1
   with:
     version: pnpm changeset version
     publish: pnpm changeset publish
   ```
   - Uses changesets for versioning and publishing
   - Both packages use the same version number (0.1.0-alpha.5)

5. **Version Verification** (line 77-96):
   ```yaml
   LIGHTFAST_VERSION=$(npm view lightfast version)
   MCP_VERSION=$(npm view @lightfastai/mcp version)
   if [ "$LIGHTFAST_VERSION" != "$MCP_VERSION" ]; then
     echo "❌ ERROR: Version drift detected!"
     exit 1
   fi
   ```
   - Fails CI if versions don't match after publish

**Workspace Protocol** (core/mcp/package.json:52):
```json
{
  "dependencies": {
    "lightfast": "workspace:*"
  }
}
```
- MCP depends on SDK via workspace protocol during development
- Changesets resolves to specific npm version during publish

### 7. Current Documentation Maintenance

**Manual MDX Files Requiring Sync**:

1. **TypeScript SDK** (`apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx`):
   - Lines 26-30: LightfastConfig table
   - Lines 46-54: SearchInput parameters
   - Lines 56-62: SearchFilters
   - Lines 65-84: V1SearchResponse interface
   - Lines 98-100: ContentsInput parameters
   - Lines 104-117: V1ContentsResponse interface
   - Lines 131-138: FindSimilarInput parameters
   - Lines 142-161: V1FindSimilarResponse interface
   - Lines 179-186: Error classes

2. **MCP Server** (`apps/docs/src/content/api/sdks-tools/mcp-server.mdx`):
   - Lines 24-29: CLI options
   - Lines 32-36: Environment variables
   - Lines 49-54: lightfast_search parameters
   - Lines 69-84: lightfast_search response
   - Lines 95-97: lightfast_contents parameters
   - Lines 110-121: lightfast_contents response
   - Lines 131-137: lightfast_find_similar parameters
   - Lines 152-168: lightfast_find_similar response
   - Lines 179-190: Error codes

**Documentation Content Strategy**:
- SDK docs focus on TypeScript usage with code examples
- MCP docs focus on MCP protocol (JSON format) with tool invocation examples
- Both reference the same underlying API schemas but present them differently

### 8. Schema Change Propagation Flow

**Current State** (when V1SearchRequest changes):

```
Developer edits @repo/console-types/src/api/v1/search.ts
  ↓
1. BUILD: pnpm turbo build --filter @repo/console-openapi
   → Regenerates openapi.json with new schema
  ↓
2. BUILD: pnpm turbo build --filter lightfast
   → TypeScript recompiles with updated types
   → SDK exports updated types
  ↓
3. BUILD: pnpm turbo build --filter @lightfastai/mcp
   → TypeScript recompiles using updated lightfast SDK
   → MCP tool parameters update
  ↓
4. DOCS BUILD: apps/docs prebuild hook
   → Regenerates openapi.json
   → fumadocs-openapi creates virtual pages with new schemas
  ↓
5. MANUAL: Update typescript-sdk.mdx ⚠️ MANUAL STEP
  ↓
6. MANUAL: Update mcp-server.mdx ⚠️ MANUAL STEP
```

**Automatic Updates**:
- ✅ OpenAPI spec (via registry and generation script)
- ✅ Virtual API endpoint pages (via fumadocs-openapi)
- ✅ SDK type definitions (via TypeScript compilation)
- ✅ MCP tool parameters (via Zod schema .shape)

**Manual Updates Required**:
- ❌ SDK documentation MDX (parameter tables, examples)
- ❌ MCP documentation MDX (parameter tables, examples)

### 9. Documentation Architecture Patterns

**Fumadocs Content Organization** (apps/docs/src/content/api/):

```
api/
├── meta.json (defines "pages": ["getting-started", "endpoints", "sdks-tools"])
├── getting-started/
│   └── *.mdx (authentication, overview)
├── endpoints/ (VIRTUAL PAGES from OpenAPI)
│   ├── meta.json (defines "pages": ["..."] wildcard)
│   └── [No MDX files - generated at runtime]
└── sdks-tools/
    ├── typescript-sdk.mdx ⚠️ MANUAL
    └── mcp-server.mdx ⚠️ MANUAL
```

**Source Loader Configuration** (apps/docs/src/lib/source.ts:21-36):
```typescript
export const apiSource = loader({
  baseUrl: "/docs/api-reference",
  source: multiple({
    mdx: toFumadocsSource(apiDocs, apiMeta),
    openapi: await openapiSource(openapi, {
      baseDir: "endpoints",
      groupBy: "tag",
      per: "operation",
    }),
  }),
});
```

**Key Pattern**: `multiple()` combiner allows mixing:
- Manual MDX pages (getting-started, sdks-tools)
- Auto-generated OpenAPI virtual pages (endpoints)

**Detection Logic** (apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:30-45):
```typescript
if ("getAPIPageProps" in page.data && typeof page.data.getAPIPageProps === "function") {
  // OpenAPI virtual page
  const props = page.data.getAPIPageProps();
  return <APIPage {...props} />;
} else {
  // Manual MDX page
  const MDX = pageData.body;
  return <MDX components={mdxComponents} />;
}
```

## Code References

### Schema Definitions
- `packages/console-types/src/api/v1/search.ts:42-81` - V1SearchRequestSchema definition
- `packages/console-types/src/api/v1/contents.ts:12-19` - V1ContentsRequestSchema definition
- `packages/console-types/src/api/v1/findsimilar.ts:13-58` - V1FindSimilarRequestSchema with .refine()
- `packages/console-types/src/api/v1/graph.ts:12-26` - V1GraphRequest and V1RelatedRequest schemas

### OpenAPI Generation
- `packages/console-openapi/src/registry.ts:1-245` - OpenAPI registry and generator
- `packages/console-openapi/scripts/generate.ts:1-14` - Generation script
- `apps/docs/scripts/generate-api-docs.ts:1-23` - Docs prebuild hook

### SDK Implementation
- `core/lightfast/src/types.ts:46-86` - SDK input type transformations
- `core/lightfast/src/client.ts:85-95` - search() method with defaults
- `core/lightfast/src/index.ts:64-70` - Zod schema exports

### MCP Server Implementation
- `core/mcp/src/server.ts:35-102` - Tool registration with schema.shape
- `core/mcp/package.json:52` - workspace:* dependency on SDK

### Documentation
- `apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx:1-216` - Manual SDK docs
- `apps/docs/src/content/api/sdks-tools/mcp-server.mdx:1-198` - Manual MCP docs
- `apps/docs/src/lib/source.ts:21-36` - Source loader with multiple()
- `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:30-45` - Page detection logic

### Release Workflow
- `.github/workflows/release.yml:50-96` - Build, publish, and version verification

## Architecture Documentation

### Schema Source of Truth Pattern

**Design Decision**: Use Zod schemas in @repo/console-types as single source of truth

**Benefits**:
- Runtime validation on server-side tRPC endpoints
- Type safety via `z.infer<typeof Schema>`
- OpenAPI generation via zod-to-openapi
- Shared schemas between internal (tRPC) and external (HTTP API) layers

**Trade-off**: Requires manual documentation updates when schemas change (no automated MDX generation from schemas)

### Type Transformation Pattern

**SDK Input Types**: Make server-side defaults optional for better DX

```typescript
// Server schema (has defaults)
const V1SearchRequestSchema = z.object({
  query: z.string(),
  limit: z.number().default(10),
  offset: z.number().default(0),
});

// SDK input type (defaults are optional)
type SearchInput = Omit<V1SearchRequest, "limit" | "offset"> &
  Partial<Pick<V1SearchRequest, "limit" | "offset">>;

// Usage
client.search({ query: "foo" }); // limit/offset optional
```

**Rationale**: Reduces boilerplate in client code while maintaining type safety

### Workspace Protocol Pattern

**MCP → SDK Dependency**: Uses `workspace:*` during development, resolves to npm version during publish

**Benefits**:
- Local development with automatic linking
- Changesets handles version resolution
- Ensures MCP always uses correct SDK version

**Trade-off**: Requires careful version management (mitigated by release workflow verification)

### Virtual Page Pattern

**Fumadocs OpenAPI Integration**: Generate documentation pages at build time without writing files

**Benefits**:
- No MDX file bloat for repetitive API endpoint docs
- Always in sync with OpenAPI spec
- Interactive "Try It" playground included
- Automatic update when schemas change

**Trade-off**: Cannot customize individual endpoint pages (use MDX overrides if needed)

### Mixed Content Pattern

**Hybrid Documentation**: Combine manual MDX with auto-generated virtual pages

```
API Reference
├── Getting Started (MDX) ← Manual guides
├── Endpoints (Virtual) ← Auto-generated from OpenAPI
└── SDKs & Tools (MDX) ← Manual integration guides
```

**Benefits**:
- Automation where appropriate (endpoint reference)
- Human touch where needed (guides, examples)
- Single navigation structure

**Trade-off**: Manual MDX must be kept in sync with schemas

## Historical Context (from thoughts/)

### Related Research Documents

- `thoughts/shared/plans/2026-02-12-fumadocs-v10-ecosystem-upgrade.md` - Fumadocs v10 upgrade plan (includes OpenAPI documentation overhaul)
- `thoughts/shared/plans/2026-02-12-api-docs-auto-generation.md` - API documentation auto-generation implementation plan
- `thoughts/shared/research/2026-02-12-openapi-docs-ui-customization.md` - OpenAPI documentation UI customization research
- `thoughts/shared/research/2026-02-12-api-docs-auto-generation-versioning.md` - API documentation auto-generation and versioning requirements
- `thoughts/shared/research/2026-02-09-lightfast-api-sdk-mcp-release-readiness.md` - Release readiness analysis (SDK and MCP)

**Key Historical Decision**: The recent fumadocs v10 upgrade (2026-02-12) introduced the virtual page pattern for API endpoints using fumadocs-openapi. Prior to this, API endpoint docs may have been manually maintained or generated differently.

## Open Questions

1. **MDX Generation from Schemas**: Should SDK and MCP documentation be fully or partially auto-generated from Zod schemas?
   - Considerations: Fumadocs doesn't have built-in schema-to-MDX for SDK docs (only OpenAPI endpoints)
   - Would require custom generation script to convert Zod schemas → MDX parameter tables

2. **Documentation Source Split**: Should SDK/MCP docs move to fumadocs-openapi style or remain as curated MDX guides?
   - Current MDX provides narrative structure, code examples, and developer guidance
   - Virtual pages excel at API reference but less suited for "getting started" style content

3. **Schema Change Detection**: How to detect when manual MDX docs are out of sync with schemas?
   - Potential solutions: Linting, CI checks, or automated diff reports
   - Would need to extract structured data from both schemas and MDX for comparison

4. **Version Documentation**: Should different alpha versions have separate documentation?
   - Current setup: Single docs site for "latest" (0.1.0-alpha.5)
   - Future consideration: Version selector for breaking changes between alpha releases

5. **MCP Schema Validation**: Should MCP tools validate against full schemas (including .refine()) or continue using base schemas?
   - Current: lightfast_find_similar uses base schema + manual validation (line 70)
   - Reason: `.shape` doesn't work with `.refine()` wrapped schemas (ZodEffects vs ZodObject)
   - Impact: Validation logic duplicated between Zod schema and MCP handler

## Related Research

- `thoughts/shared/research/2026-02-12-openapi-docs-ui-customization.md` - Interactive API playground configuration
- `thoughts/shared/research/2026-02-12-fumadocs-search-integration.md` - Mixedbread AI search integration for docs
- `thoughts/shared/research/2025-12-21-api-reference-sidebar-structure.md` - API documentation navigation structure
- `thoughts/shared/research/2025-12-24-docs-metadata-end-to-end-flow.md` - SEO and metadata flow for docs

---

## Conclusion

The codebase has **strong automation** for OpenAPI endpoint documentation but **manual maintenance required** for SDK and MCP documentation MDX files. Schema changes propagate automatically through the build pipeline to compiled code and virtual pages, but the human-written guides require manual updates.

**Synchronization Status**:
- ✅ **API Endpoints** → Virtual pages from OpenAPI (fully automated)
- ⚠️ **TypeScript SDK** → Manual MDX (manual updates needed)
- ⚠️ **MCP Server** → Manual MDX (manual updates needed)

**Key Insight**: The release workflow ensures SDK and MCP packages stay in sync at the code level (version verification), but documentation synchronization relies on developer discipline to update MDX files when schemas change.

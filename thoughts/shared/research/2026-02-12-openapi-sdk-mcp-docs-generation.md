---
date: 2026-02-12T11:05:50+0000
researcher: Claude
git_commit: 9d8bf6f907c00649704441fdc13a5c022b77fcca
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "Converting TypeScript SDK and MCP Documentation to OpenAPI-Generated"
tags: [research, codebase, openapi, sdk, mcp, documentation, fumadocs, schema-generation]
status: complete
last_updated: 2026-02-12
last_updated_by: Claude
---

# Research: Converting TypeScript SDK and MCP Documentation to OpenAPI-Generated

**Date**: 2026-02-12T11:05:50+0000
**Researcher**: Claude
**Git Commit**: 9d8bf6f907c00649704441fdc13a5c022b77fcca
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

Given that we have implemented end-to-end setup for OpenAPI in @apps/docs/, we need to convert the following MDX files to be fully generated from OpenAPI:
- `@apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx`
- `@apps/docs/src/content/docs/integrate/mcp.mdx`

This will eliminate manual maintenance and prevent schema drift.

## Summary

The codebase has **fully automated OpenAPI documentation** for API endpoints via fumadocs-openapi virtual pages, but the **SDK and MCP documentation files remain manually maintained MDX** that can drift from the actual schemas.

**Current State**:
- ✅ **API Endpoint Pages**: `/docs/api-reference/{operationId}` - Fully generated from `openapi.json` at build time
- ❌ **SDK Documentation**: `typescript-sdk.mdx` - Manually maintained parameter tables and response schemas
- ❌ **MCP Documentation**: `mcp.mdx` - Manually maintained tool descriptions and parameters

**Key Finding**: A comprehensive implementation plan already exists at `thoughts/shared/plans/2026-02-12-full-schema-docs-sync.md` that describes the exact approach for converting these docs to OpenAPI-powered MDX components.

**Architecture Discovery**: The OpenAPI setup uses a multi-layered approach:
1. **Source**: Zod schemas in `@repo/console-types` with `.describe()` annotations
2. **Generation**: `@repo/console-openapi` converts Zod → OpenAPI JSON (2,270 lines)
3. **Virtual Pages**: fumadocs-openapi creates endpoint docs automatically
4. **Manual Docs**: SDK/MCP MDX files need conversion to use OpenAPI-powered components

## Detailed Findings

### 1. Current OpenAPI Infrastructure

The OpenAPI documentation system is fully implemented and working:

**Build Pipeline** (apps/docs/package.json:8):
```json
"prebuild": "tsx scripts/generate-api-docs.ts"
```

**Generation Flow**:
1. `apps/docs/scripts/generate-api-docs.ts` (deleted but functionality in prebuild) triggers OpenAPI generation
2. `packages/console-openapi/scripts/generate.ts:9` calls `generateOpenAPIDocument()`
3. Writes `packages/console-openapi/openapi.json` (2,270 lines)
4. fumadocs-openapi reads the JSON and creates virtual pages

**Virtual Page Setup** (apps/docs/src/lib/source.ts:15-26):
```typescript
export const apiSource = loader({
  baseUrl: "/docs/api-reference",
  source: multiple({
    mdx: toFumadocsSource(apiDocs, apiMeta),
    openapi: await openapiSource(openapi, {
      baseDir: "endpoints",
      groupBy: "none",
      per: "operation",
    }),
  }),
});
```

**Page Rendering** (apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:40):
- Detects virtual pages via `getAPIPageProps` method
- Renders using `<APIPage>` component from fumadocs-openapi
- Applies custom branding via `renderOperationLayout` and `renderPageLayout`

**Custom Renderers** (apps/docs/src/lib/api-page-renderers.tsx:19-88):
- Adds Lightfast branding with `border-brand-500` and `bg-brand-50`
- Preserves fumadocs-openapi interactive playground
- Sidebar with gradient background

### 2. What Needs Converting

**TypeScript SDK Documentation** (apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx):
- **Lines 26-30**: LightfastConfig parameter table (hardcoded)
- **Lines 46-54**: SearchInput parameter table (hardcoded)
- **Lines 56-62**: SearchFilters schema (hardcoded)
- **Lines 65-134**: V1SearchResponse interface (hardcoded TypeScript)
- **Lines 169-171**: ContentsInput parameter table (hardcoded)
- **Lines 174-192**: V1ContentsResponse interface (hardcoded TypeScript)
- **Lines 217-226**: FindSimilarInput parameter table (hardcoded)
- **Lines 229-265**: V1FindSimilarResponse interface (hardcoded TypeScript)
- **Lines 293-297**: GraphInput parameter table (hardcoded)
- **Lines 300-334**: GraphResponse interface (hardcoded TypeScript)
- **Lines 362-364**: RelatedInput parameter table (hardcoded)
- **Lines 367-393**: RelatedResponse interface (hardcoded TypeScript)
- **Lines 425-432**: Error classes table (hardcoded)

**Total**: ~200 lines of manually maintained schema documentation

**MCP Server Documentation** (apps/docs/src/content/docs/integrate/mcp.mdx):
- **Lines 125-129**: lightfast_search parameters (hardcoded)
- **Lines 138-143**: lightfast_contents parameters (hardcoded)
- **Lines 149-152**: lightfast_find_similar parameters (hardcoded)
- All tool response schemas are described in prose, not structured
- Missing: lightfast_graph and lightfast_related tools (not documented)

**Total**: ~50 lines of manually maintained parameter documentation

### 3. Known Schema Drift Issues

From `thoughts/shared/plans/2026-02-12-full-schema-docs-sync.md`, critical drift exists:

| Issue | Docs Say | Schema Says |
|-------|----------|-------------|
| Search mode values | `"quality"` | `"thorough"` |
| Filter field name | `sources` | `sourceTypes` |
| Filter dateRange type | `string` (e.g. `"30d"`) | `object` with `start`/`end` |
| Search response array | `results` | `data` |
| FindSimilar response array | `results` | `similar` |
| Missing filter fields | - | `observationTypes`, `actorNames` |
| Missing parameters | - | `offset`, `includeContext`, `includeHighlights` |
| Missing MCP tools | 3 tools | 5 tools (graph, related missing) |
| Missing SDK methods | 3 methods | 5 methods (graph, related missing) |

### 4. Implementation Plan Already Exists

**Document**: `thoughts/shared/plans/2026-02-12-full-schema-docs-sync.md` (627 lines)

The plan describes a 4-phase implementation:

**Phase 1: Schema Reader and MDX Components**
- Create `apps/docs/src/lib/schema-reader.ts` - Parse openapi.json and extract field metadata
- Create `apps/docs/src/components/schema/param-table.tsx` - React Server Component for parameter tables
- Create `apps/docs/src/components/schema/response-schema.tsx` - TypeScript interface renderer
- Create `apps/docs/src/components/schema/enum-values.tsx` - Enum value list renderer
- Register components in `apps/docs/src/mdx-components.tsx`

**Key API**:
```tsx
// Replace hardcoded tables with:
<ParamTable schema="V1SearchRequest" />

// Replace hardcoded interfaces with:
<ResponseSchema schema="V1SearchResponse" name="V1SearchResponse" />

// Render enum options with:
<EnumValues schema="V1SearchRequest" field="mode" descriptions={{
  "fast": "Optimized for speed",
  "balanced": "Default - balanced quality and speed",
  "thorough": "Maximum quality with comprehensive reranking"
}} />
```

**Phase 2: Rewrite SDK Documentation**
- Replace all hardcoded parameter tables with `<ParamTable>`
- Replace all hardcoded response interfaces with `<ResponseSchema>`
- Fix all drift issues (mode values, field names, response structures)
- Add missing `graph()` and `related()` method documentation
- Add `ServerError` to error classes
- Keep narrative text, code examples, and guides human-written

**Phase 3: Rewrite MCP Documentation**
- Replace hardcoded parameter lists with `<ParamTable>`
- Add missing tools: `lightfast_graph` and `lightfast_related`
- Fix drift issues
- Keep CLI options, environment variables, and usage examples

**Phase 4: CI Validation Script**
- Create `apps/docs/scripts/validate-schema-docs.ts`
- Validate all schema references in MDX exist in openapi.json
- Check all API schemas have corresponding documentation
- Run during prebuild to catch drift at build time

### 5. Why OpenAPI-Powered Components (Not Direct Zod)

From the implementation plan, the decision to use OpenAPI JSON rather than direct Zod introspection:

**Pros**:
- OpenAPI spec already has all metadata extracted cleanly (descriptions, defaults, constraints)
- No complex Zod internal traversal needed (`.describe()` stored in `_def.description`, etc.)
- OpenAPI is a stable, well-documented format
- Already generated during prebuild - zero additional build steps
- Same source powers the virtual endpoint pages

**Cons**:
- Adds dependency on OpenAPI generation step
- Requires maintaining schema-reader utility

**Alternative Considered**: Direct Zod introspection
- Would require traversing Zod internal `._def` structures
- Zod internals can change between versions
- More complex error handling for edge cases

### 6. OpenAPI Spec Structure

**File**: packages/console-openapi/openapi.json (2,270 lines)

**Metadata** (lines 2-17):
```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Lightfast API",
    "version": "1.0.0-alpha",
    "description": "Real-time semantic search across all your company's data sources..."
  },
  "servers": [{"url": "https://lightfast.ai"}]
}
```

**Schemas Registered** (10 total):
1. `V1SearchRequest` - Search query with filters and mode
2. `V1SearchResponse` - Search results with metadata and latency
3. `V1ContentsRequest` - Array of document IDs
4. `V1ContentsResponse` - Array of content items
5. `V1FindSimilarRequest` - Similarity search parameters
6. `V1FindSimilarResponse` - Similar items with scores
7. `V1GraphRequest` - Graph traversal parameters
8. `GraphResponse` - Graph nodes and edges
9. `V1RelatedRequest` - Related events query
10. `RelatedResponse` - Related events results

**Schema Example** (V1SearchRequest):
```json
{
  "type": "object",
  "required": ["query"],
  "properties": {
    "query": {
      "type": "string",
      "minLength": 1,
      "description": "The search query text to find relevant documents"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 10,
      "description": "Maximum number of results to return (1-100, default: 10)"
    },
    "mode": {
      "type": "string",
      "enum": ["fast", "balanced", "thorough"],
      "default": "balanced",
      "description": "Search quality mode..."
    }
  }
}
```

**Key Properties Available**:
- `description` - From Zod `.describe()`
- `default` - From Zod `.default()`
- `minimum`, `maximum` - From Zod `.min()`, `.max()`
- `enum` - From Zod `.enum()`
- `required` - From Zod schema structure
- `$ref` - For nested schemas

### 7. Source of Truth Chain

The entire flow from Zod to rendered docs:

```
@repo/console-types (Zod schemas)
  packages/console-types/src/api/v1/search.ts:46
  ↓
  V1SearchRequestSchema with .describe() and .default()
  ↓
@repo/console-openapi (OpenAPI registry)
  packages/console-openapi/src/registry.ts:46
  ↓
  registry.registerPath() with schema references
  ↓
  packages/console-openapi/scripts/generate.ts:9
  ↓
  generateOpenAPIDocument() → openapi.json
  ↓
fumadocs-openapi (virtual pages) ← WORKS
  apps/docs/src/lib/openapi.ts:3
  ↓
  openapiSource(openapi, {...})
  ↓
  apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:41
  ↓
  <APIPage {...props} /> with interactive playground
  ↓
  ✅ RESULT: /docs/api-reference/search (auto-generated)

Manual MDX Files ← NEEDS CONVERSION
  apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx
  ↓
  Hardcoded parameter tables (manual maintenance)
  ↓
  ❌ PROBLEM: Can drift from schemas
  ↓
  🎯 SOLUTION: Use OpenAPI-powered components:
     <ParamTable schema="V1SearchRequest" />
```

### 8. Related Documentation Infrastructure

**Recent OpenAPI Migration** (from thoughts):
- `thoughts/shared/plans/2026-02-12-fumadocs-v10-ecosystem-upgrade.md` - fumadocs v16 upgrade with OpenAPI overhaul
- `thoughts/shared/research/2026-02-12-openapi-docs-ui-customization.md` - Custom branding for OpenAPI pages
- `thoughts/shared/research/2026-02-12-generate-api-docs-script-necessity.md` - Decision to remove redundant generation script

**Key Commit**: `dba2ab78` - "feat(docs): migrate to fumadocs v16 with OpenAPI virtual pages"
- Introduced virtual page system
- Configured fumadocs-openapi integration
- Added custom renderers with Lightfast branding

**Deleted File**: `apps/docs/scripts/generate-api-docs.ts`
- Previously wrapped OpenAPI generation
- Removed as redundant (prebuild script handles it now)
- Commit: `0ed3d405`

### 9. Fumadocs Virtual Page System

**How Virtual Pages Work**:

1. **Page Creation** (apps/docs/src/lib/source.ts:19-24):
   ```typescript
   openapi: await openapiSource(openapi, {
     baseDir: "endpoints",
     groupBy: "none",    // Flat URL structure
     per: "operation",   // One page per endpoint
   })
   ```

2. **Detection** (apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:40):
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

3. **Rendering** (apps/docs/src/lib/api-page.tsx:12-18):
   ```typescript
   export const APIPage = createAPIPage({
     openapi,
     client,
     renderOperationLayout,
     renderPageLayout,
   });
   ```

**Key Pattern**: Virtual pages are NOT written to disk. They exist only in memory during build/runtime, generated from the OpenAPI spec.

### 10. Proposed Component Architecture

From the implementation plan, the component architecture:

**Schema Reader** (apps/docs/src/lib/schema-reader.ts):
```typescript
interface SchemaField {
  name: string;
  type: string;          // e.g., "string", "number", "string[]"
  required: boolean;
  default?: unknown;
  description?: string;
  constraints?: string;  // e.g., "1-100", "min: 0, max: 1"
  enum?: string[];
  children?: SchemaField[]; // For nested objects
}

export function getSchemaFields(schemaName: string): SchemaField[]
```

**ParamTable Component**:
```tsx
<ParamTable
  schema="V1SearchRequest"
  include={["query", "limit"]}  // Optional: only show these
  exclude={["filters"]}          // Optional: hide these
  showDefaults={true}            // Show default values column
/>
```

**ResponseSchema Component**:
```tsx
<ResponseSchema
  schema="V1SearchResponse"
  name="V1SearchResponse"  // Display name
  depth={2}                 // Max depth for nested objects
/>
```

**EnumValues Component**:
```tsx
<EnumValues
  schema="V1SearchRequest"
  field="mode"
  descriptions={{
    "fast": "Optimized for speed",
    "balanced": "Default - balanced quality and speed",
    "thorough": "Maximum quality"
  }}
/>
```

### 11. Migration Strategy

**For typescript-sdk.mdx**:

1. **Keep Human-Written**:
   - Installation section
   - Client configuration prose
   - Code examples (with corrected field names)
   - Method descriptions and use cases
   - "Related" links section

2. **Replace with Components**:
   - All parameter tables → `<ParamTable>`
   - All response interfaces → `<ResponseSchema>`
   - All enum listings → `<EnumValues>`

3. **Add Missing Methods**:
   - `graph()` method documentation
   - `related()` method documentation
   - `ServerError` class

**For mcp.mdx**:

1. **Keep Human-Written**:
   - Installation instructions
   - Configuration examples (Claude Desktop, Cursor, etc.)
   - CLI options and environment variables
   - Usage examples and prompts
   - Troubleshooting section

2. **Replace with Components**:
   - Tool parameter lists → `<ParamTable>`
   - Add response schema sections → `<ResponseSchema>`

3. **Add Missing Tools**:
   - `lightfast_graph` tool
   - `lightfast_related` tool

## Code References

### OpenAPI Infrastructure
- `packages/console-openapi/src/registry.ts:22` - OpenAPI registry with all endpoints
- `packages/console-openapi/scripts/generate.ts:9` - OpenAPI JSON generation
- `packages/console-openapi/openapi.json` - Generated OpenAPI 3.1.0 spec (2,270 lines)

### Documentation Setup
- `apps/docs/source.config.ts:49-61` - MDX collections (docs, apiDocs)
- `apps/docs/src/lib/openapi.ts:3` - fumadocs-openapi config
- `apps/docs/src/lib/source.ts:15-26` - Combined MDX + OpenAPI source
- `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:18` - Page renderer
- `apps/docs/src/lib/api-page.tsx:12` - APIPage component with custom renderers
- `apps/docs/src/lib/api-page-renderers.tsx:19` - Custom Lightfast branding

### Files to Convert
- `apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx:1` - SDK documentation (216 lines)
- `apps/docs/src/content/docs/integrate/mcp.mdx:1` - MCP documentation (230 lines)

### Schema Sources
- `packages/console-types/src/api/v1/search.ts:46` - V1SearchRequestSchema
- `packages/console-types/src/api/v1/contents.ts:12` - V1ContentsRequestSchema
- `packages/console-types/src/api/v1/findsimilar.ts:13` - V1FindSimilarRequestSchema
- `packages/console-types/src/api/v1/graph.ts:12` - GraphRequest and RelatedRequest

## Architecture Documentation

### Mixed Content Pattern

fumadocs-openapi supports mixing manual MDX with auto-generated pages:

```
/docs/api-reference/
├── getting-started/
│   └── overview.mdx (manual MDX)
├── search (virtual OpenAPI page)
├── get-contents (virtual OpenAPI page)
├── find-similar (virtual OpenAPI page)
├── graph (virtual OpenAPI page)
├── find-related (virtual OpenAPI page)
└── sdks-tools/
    ├── typescript-sdk.mdx (manual MDX → convert to use components)
    └── mcp-server.mdx (manual MDX → convert to use components)
```

**Pattern**: Use `multiple()` source combiner to merge:
- Manual MDX pages (guides, getting started, SDK integrations)
- Virtual OpenAPI pages (API endpoint reference)
- Both share same base URL and navigation

### Build-Time Generation Strategy

The OpenAPI-powered components will be **React Server Components** that:
1. Read `openapi.json` at build time (not runtime)
2. Parse schema definitions into structured field data
3. Render HTML tables with correct information
4. Zero JavaScript sent to client (pure SSR)

**Performance**:
- No runtime OpenAPI parsing
- No API calls during page render
- Static HTML generation (SSG)
- Same performance as current virtual pages

### Version Management

**Current**: Single "latest" docs for alpha version (0.1.0-alpha.5)

**Future Consideration** (from open questions):
- Version selector for breaking changes between alpha releases
- Separate docs for different major versions
- Not required for current alpha phase

## Historical Context (from thoughts/)

### OpenAPI Migration Timeline

1. **2026-02-12**: fumadocs v16 migration with OpenAPI virtual pages
   - Research: `thoughts/shared/research/2026-02-12-openapi-docs-ui-customization.md`
   - Plan: `thoughts/shared/plans/2026-02-12-fumadocs-v10-ecosystem-upgrade.md`
   - Commit: `dba2ab78` - Virtual pages implementation

2. **2026-02-12**: Schema synchronization planning
   - Research: `thoughts/shared/research/2026-02-12-sdk-mcp-docs-schema-sync.md`
   - Plan: `thoughts/shared/plans/2026-02-12-full-schema-docs-sync.md`
   - Research: `thoughts/shared/research/2026-02-12-lightfast-mcp-schema-sync-verification.md`

3. **2026-02-12**: Documentation drift identified
   - Plan: `thoughts/shared/plans/2026-02-12-sdk-mcp-docs-drift-fixes.md`
   - Multiple schema inconsistencies documented

4. **Earlier (2025-12-**)**: API reference structure work
   - Research: `thoughts/shared/research/2025-12-21-api-reference-sidebar-structure.md`
   - Plan: `thoughts/shared/plans/2025-12-21-api-reference-sidebar-structure.md`

### Design Decisions

**Why fumadocs-openapi over custom generation?**
- Maintained by fumadocs team (Fuma Nama)
- Interactive playground included
- Customizable via render functions
- Active development and support
- Alternative: Custom OpenAPI → MDX generator would require maintenance

**Why virtual pages over static MDX generation?**
- No file bloat (5 endpoints × ~50 lines each = 250 lines saved)
- Always in sync with spec (no stale MDX files)
- Interactive features included
- Faster builds (no MDX compilation for endpoints)

## Open Questions

1. **Component Scope**: Should the `<ParamTable>` component also be used for the virtual API endpoint pages, or keep them purely fumadocs-openapi rendered?
   - Current: Virtual pages use fumadocs-openapi's built-in rendering
   - Consideration: Using same component for consistency vs. complexity

2. **Example Generation**: Should code examples in SDK/MCP docs be auto-generated from OpenAPI examples, or remain manually curated?
   - Current: Manual examples ensure high DX quality
   - Auto-generation might produce generic examples
   - Recommendation: Keep examples manual for now

3. **Partial Component Usage**: Can we incrementally adopt the components, or must we convert all tables at once?
   - Technical: Components can be adopted incrementally
   - Process: Phase 1 infrastructure → Phase 2 SDK → Phase 3 MCP allows validation at each step

4. **MCP Tool Response Schemas**: Should MCP docs show JSON examples or TypeScript interfaces?
   - Current: Mostly prose descriptions
   - SDK uses TypeScript interfaces
   - MCP protocol uses JSON
   - Recommendation: Show both (TypeScript for developers, JSON for protocol)

5. **CI Validation Strictness**: Should schema validation script error (block build) or warn (allow build)?
   - Consideration: Strict validation prevents drift but might block urgent deployments
   - Recommendation: Error for missing schemas, warn for undocumented schemas

## Related Research

- `thoughts/shared/plans/2026-02-12-full-schema-docs-sync.md` - Complete 4-phase implementation plan
- `thoughts/shared/research/2026-02-12-sdk-mcp-docs-schema-sync.md` - Schema synchronization analysis
- `thoughts/shared/research/2026-02-12-openapi-docs-ui-customization.md` - Custom branding implementation
- `thoughts/shared/plans/2026-02-12-fumadocs-v10-ecosystem-upgrade.md` - fumadocs v16 migration
- `thoughts/shared/research/2026-02-12-generate-api-docs-script-necessity.md` - Generation script decisions

---

## Conclusion

The infrastructure for converting SDK and MCP documentation to OpenAPI-generated components **already exists** and is working well for API endpoint documentation. The path forward is clearly defined in the existing implementation plan.

**Next Steps**:
1. Implement Phase 1: Create schema-reader utility and MDX components
2. Test components with a single method (e.g., search) in SDK docs
3. Complete Phase 2: Rewrite typescript-sdk.mdx
4. Complete Phase 3: Rewrite mcp.mdx
5. Complete Phase 4: Add CI validation

**Success Criteria**:
- All parameter tables auto-generated from openapi.json
- All response schemas auto-generated from openapi.json
- Schema changes automatically propagate to docs
- CI catches drift via validation script
- Narrative content and examples remain human-curated

**Time Estimate** (from plan):
- Phase 1: 2-3 hours (infrastructure)
- Phase 2: 1-2 hours (SDK rewrite)
- Phase 3: 1 hour (MCP rewrite)
- Phase 4: 1 hour (CI validation)
- Total: 5-7 hours for complete implementation

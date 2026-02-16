# SDK and MCP Documentation Drift Fixes

**Date**: 2026-02-12
**Status**: Complete
**Files Changed**: 2

## Summary

Completely rewrote `typescript-sdk.mdx` and `mcp-server.mdx` to fix critical drift from actual Zod schemas and add missing methods/tools. All parameters, types, and response schemas now match the source of truth in `@repo/console-types/api/v1/`.

## Critical Issues Fixed

### 1. Mode Values (BREAKING)
- **Before**: `"fast" | "balanced" | "quality"`
- **After**: `"fast" | "balanced" | "thorough"`
- **Impact**: `"quality"` was never a valid value - would fail validation

### 2. Filter Structure (BREAKING)
- **Before**:
  ```typescript
  filters: {
    sources: string[];  // Wrong field name
    dateRange: string;  // Wrong type (e.g., "30d")
  }
  ```
- **After**:
  ```typescript
  filters: {
    sourceTypes: string[];           // Correct field name
    observationTypes?: string[];     // Missing field
    actorNames?: string[];           // Missing field
    dateRange?: {                    // Correct structure
      start?: string;  // ISO datetime
      end?: string;    // ISO datetime
    };
  }
  ```

### 3. Response Array Names (BREAKING)
- **Search Before**: `results: V1SearchResult[]`
- **Search After**: `data: V1SearchResult[]`
- **FindSimilar Before**: `results: V1SimilarResult[]`
- **FindSimilar After**: `similar: V1SimilarResult[]`

### 4. Missing Response Fields
Added to all response interfaces:
- `requestId: string` (present in all responses)
- Full `meta` object with all fields (total, limit, offset, took, mode, paths)
- Separate `latency` object with detailed breakdown
- Optional `context` with clusters and relevantActors (search only)

### 5. Missing Request Parameters
**Search**: Added `offset`, `includeContext`, `includeHighlights`
**FindSimilar**: Added `filters` field (same structure as search)

### 6. Missing Result Fields
**SearchResult**: Added `occurredAt`, `entities`, `references`, `highlights`
**ContentItem**: Added `url`, `snippet`, `source`, `occurredAt`; fixed `title` (nullable), `content` (optional)
**SimilarResult**: Added `vectorSimilarity`, `entityOverlap`, `sameCluster`, `occurredAt`

### 7. Missing Methods/Tools
**SDK**: Added `graph()` and `related()` methods
**MCP**: Added `lightfast_graph` and `lightfast_related` tools

### 8. Missing Error Class
**SDK**: Added `ServerError` class (HTTP 500/502/503/504)

### 9. Type Exports
Updated type export list to include all new types:
- `GraphInput`, `GraphResponse`
- `RelatedInput`, `RelatedResponse`

## Files Changed

### 1. `apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx`
- **Before**: 216 lines
- **After**: 467 lines
- **Changes**:
  - Fixed all parameter tables to match Zod schemas exactly
  - Fixed all response interfaces to include all fields
  - Added `graph()` method documentation (lines 283-348)
  - Added `related()` method documentation (lines 350-406)
  - Added `ServerError` to error classes table (line 431)
  - Updated type exports list (lines 440-457)
  - Fixed code examples to use correct field names

### 2. `apps/docs/src/content/api/sdks-tools/mcp-server.mdx`
- **Before**: 198 lines
- **After**: 426 lines
- **Changes**:
  - Updated tool count from 3 to 5 (line 41)
  - Fixed all parameter tables to match Zod schemas exactly
  - Fixed all response schemas to include all fields
  - Added detailed filters object structure (lines 59-63)
  - Added `lightfast_graph` tool documentation (lines 268-330)
  - Added `lightfast_related` tool documentation (lines 332-396)
  - Fixed JSON examples to use correct field names

## Verification

- ✅ Docs build successfully: `pnpm --filter @lightfast/docs build`
- ✅ All parameter counts match schemas:
  - V1SearchRequest: 7 fields (query, limit, offset, mode, filters, includeContext, includeHighlights)
  - V1ContentsRequest: 1 field (ids)
  - V1FindSimilarRequest: 7 fields (id, url, limit, threshold, sameSourceOnly, excludeIds, filters)
  - V1GraphRequest: 3 fields (id, depth, types)
  - V1RelatedRequest: 1 field (id)
- ✅ All 5 SDK methods documented: search, contents, findSimilar, graph, related
- ✅ All 5 MCP tools documented: lightfast_search, lightfast_contents, lightfast_find_similar, lightfast_graph, lightfast_related
- ✅ Search sync completed successfully (mxbai)

## Source of Truth References

All fixes verified against:
- `packages/console-types/src/api/v1/search.ts` - Search schemas (lines 15, 21-81, 104-244)
- `packages/console-types/src/api/v1/contents.ts` - Contents schemas (lines 12-59)
- `packages/console-types/src/api/v1/findsimilar.ts` - FindSimilar schemas (lines 13-139)
- `packages/console-types/src/api/v1/graph.ts` - Graph/Related schemas (lines 12-118)

## Future Improvements

To prevent future drift:
1. Consider creating MDX components that read from `openapi.json` to auto-generate parameter tables
2. Add CI validation script to detect schema references that don't exist
3. Add pre-commit hook to warn when schema files change without docs update
4. Consider automated testing that compares docs examples against actual API responses

## Related Research

- `thoughts/shared/research/2026-02-12-sdk-mcp-docs-schema-sync.md` - Detailed drift analysis
- `thoughts/shared/plans/2026-02-12-full-schema-docs-sync.md` - Full automation plan (deferred)

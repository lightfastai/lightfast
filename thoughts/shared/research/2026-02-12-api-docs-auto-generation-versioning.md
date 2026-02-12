---
date: 2026-02-12T16:30:00+08:00
researcher: Claude
git_commit: d9d99c5dc20c97b0562cd61f6eefc9076f3b3479
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "API Documentation Auto-Generation, Versioning, and Alpha Status Requirements"
tags: [research, codebase, api-docs, auto-generation, versioning, alpha, endpoints, zod, fumadocs]
status: complete
last_updated: 2026-02-12
last_updated_by: Claude
---

# Research: API Documentation Auto-Generation, Versioning, and Alpha Status Requirements

**Date**: 2026-02-12T16:30:00+08:00
**Researcher**: Claude
**Git Commit**: d9d99c5dc20c97b0562cd61f6eefc9076f3b3479
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

How can API endpoint documentation be auto-generated from the well-defined `/v1/` route schemas? How does versioning work? What alpha-status disclaimers and requirements need to be added to the API docs?

## Summary

The Lightfast API has three well-defined endpoints (`/v1/search`, `/v1/contents`, `/v1/findsimilar`) with complete Zod schemas in `packages/console-types/src/api/v1/`. The current documentation in `apps/docs/src/content/api/endpoints/` is hand-written MDX that mirrors these schemas but is not auto-generated from them. There is a clear opportunity to auto-generate docs from the Zod schemas since all request/response types are fully defined with `.describe()` annotations. There are currently **zero** alpha/beta/versioning disclaimers anywhere in the API documentation.

## Detailed Findings

### 1. Source of Truth: Zod Schemas in `@repo/console-types`

All API types are defined as Zod schemas with full validation rules and `.describe()` annotations:

**Package:** `packages/console-types/src/api/v1/`

| File | Schemas Exported | Types Exported |
|------|-----------------|----------------|
| `search.ts` | `V1SearchRequestSchema`, `V1SearchResultSchema`, `V1SearchContextSchema`, `V1SearchLatencySchema`, `V1SearchMetaSchema`, `V1SearchResponseSchema`, `V1SearchFiltersSchema`, `RerankModeSchema` | 8 corresponding types |
| `contents.ts` | `V1ContentsRequestSchema`, `V1ContentItemSchema`, `V1ContentsResponseSchema` | 3 corresponding types |
| `findsimilar.ts` | `V1FindSimilarRequestSchema`, `V1FindSimilarResultSchema`, `V1FindSimilarSourceSchema`, `V1FindSimilarResponseSchema` | 4 corresponding types |
| `index.ts` | Re-exports all from above three files | |

**Key Observations:**
- All schemas use `.describe()` for human-readable field descriptions (`search.ts:47`, `search.ts:55`, `search.ts:62`, etc.)
- Validation rules encode API constraints: `limit` ranges, `offset` minimums, `threshold` 0-1 bounds
- Default values are embedded: `limit: 10`, `offset: 0`, `mode: "balanced"`, `threshold: 0.5`
- Shared types: `V1SearchFiltersSchema` is reused by both search and findsimilar (`findsimilar.ts:8`)
- All response schemas include `requestId: z.string()` for tracing

### 2. Current Documentation: Hand-Written MDX

**Location:** `apps/docs/src/content/api/endpoints/`

| File | Endpoint | Lines |
|------|----------|-------|
| `search.mdx` | `POST /v1/search` | 383 lines |
| `contents.mdx` | `POST /v1/contents` | 265 lines |
| `findsimilar.mdx` | `POST /v1/findsimilar` | 338 lines |

**Each MDX file follows the same structure:**
1. Frontmatter (title, description)
2. Endpoint URL
3. Authentication reference
4. Request Body (TypeScript type block)
5. Response (TypeScript type block)
6. Example Request (curl)
7. Example Response (JSON)
8. Filtering/usage sections
9. Error handling
10. Next Steps links

**Gap Analysis — MDX vs Zod Schemas:**
- The MDX TypeScript blocks are **manually written representations** of the Zod schemas
- No import or generation from the actual schema files
- Field descriptions in MDX comments (e.g., `// Search query (required)`) differ from Zod `.describe()` strings
- MDX includes additional context not in schemas: latency tables, use case examples, pagination patterns

### 3. Versioning Architecture

**Current State:**
- URL-based versioning: `/api/v1/` prefix on all endpoints
- Next.js file-system routing: `apps/console/src/app/(api)/v1/` directory
- No version negotiation headers (no `API-Version` or `Accept-Version`)
- No version discovery endpoint
- All Zod schema names prefixed with `V1` (e.g., `V1SearchRequestSchema`)
- TypeScript SDK types also prefixed with `V1` (`V1SearchResponse`, `V1ContentsResponse`)

**Versioning Strategy (directory-based):**
- Current: `(api)/v1/search/route.ts`, `(api)/v1/contents/route.ts`, `(api)/v1/findsimilar/route.ts`
- Future v2 would create: `(api)/v2/search/route.ts`, etc.
- Schemas would create: `packages/console-types/src/api/v2/search.ts`, etc.
- No middleware or gateway layer for version routing — direct Next.js file-based routing

**No Existing Disclaimers:**
- Zero mentions of "alpha", "beta", "experimental", "preview", or "deprecated" in any API doc
- No version lifecycle documentation
- No deprecation policy
- No breaking change notification system
- Frontmatter schema (`source.config.ts:27-55`) has no `version`, `status`, or `deprecated` fields

### 4. Documentation Rendering Pipeline

**Stack:** Fumadocs MDX → Next.js static generation

**Flow:**
1. `source.config.ts:64-69` — Defines `apiDocs` source from `src/content/api/`
2. `src/lib/source.ts:12-15` — Creates loader with `baseUrl: "/docs/api-reference"`
3. `src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx` — Dynamic route renders MDX
4. `mdx-components.tsx` — Custom components including `ApiEndpoint`, `ApiMethod`, `ApiReferenceCard`

**Navigation:** Controlled by `meta.json` files in each directory
- Root: `["getting-started", "endpoints", "sdks-tools"]`
- Endpoints: `["search", "contents", "findsimilar"]`

### 5. Authentication Pattern (Relevant for Docs)

All three endpoints use identical authentication via `withDualAuth()`:
- **API Key**: `Authorization: Bearer sk-lf-...` + optional `X-Workspace-ID`
- **Session**: Clerk cookies + required `X-Workspace-ID`
- API key format: `sk-lf-` prefix required
- Key bound to workspace at creation time
- Dual auth documented at `apps/docs/src/content/api/getting-started/authentication.mdx`

### 6. Auto-Generation Opportunities

**What Can Be Auto-Generated from Zod Schemas:**

| Component | Source | Feasibility |
|-----------|--------|-------------|
| Request body type signatures | `V1*RequestSchema` | Direct — Zod to TypeScript string |
| Response type signatures | `V1*ResponseSchema` | Direct — Zod to TypeScript string |
| Field descriptions | `.describe()` annotations | Direct extraction |
| Validation rules (min, max, default) | Schema constraints | Direct extraction |
| Required vs optional fields | `.optional()` presence | Direct extraction |
| Enum values | `z.enum()` arrays | Direct extraction |
| Default values | `.default()` calls | Direct extraction |

**What Cannot Be Auto-Generated:**
- Curl/fetch examples with realistic data
- Use case sections (pagination patterns, "More Like This", etc.)
- Latency tables and performance guidance
- Filtering explanation sections
- Error handling code examples
- Cross-endpoint workflow examples
- Conceptual explanations (search modes, similarity scores)

**Possible Approaches:**

1. **Zod-to-OpenAPI → Fumadocs OpenAPI Plugin**
   - `@asteasolutions/zod-to-openapi` converts Zod schemas to OpenAPI 3.x spec
   - `fumadocs-openapi` plugin renders OpenAPI specs as documentation pages
   - Fumadocs already supports `_openapi` field in frontmatter (`source.config.ts:32`)
   - This would auto-generate parameter tables, type signatures, and example structures

2. **Custom Build Script**
   - Script reads Zod schemas at build time
   - Generates MDX partials or JSON data files
   - MDX files import generated content alongside hand-written sections
   - More control over output format but requires custom tooling

3. **Hybrid: Generated Types + Hand-Written Prose**
   - Generate TypeScript type blocks and parameter tables from schemas
   - Keep hand-written sections for examples, use cases, and explanations
   - MDX components could render schema data at runtime

### 7. Related Thoughts Documents

- `thoughts/shared/research/2025-12-21-api-reference-sidebar-structure.md` — Original sidebar structure decision (implemented)
- `thoughts/shared/plans/2025-12-21-api-reference-sidebar-structure.md` — Implementation plan for current structure
- `thoughts/shared/research/2025-12-16-api-key-implementation-audit.md` — API key implementation details
- `thoughts/changelog/search-api-hybrid-retrieval-cross-encoder-20251217-143022.md` — Search API changelog

## Code References

### Zod Schema Source of Truth
- `packages/console-types/src/api/v1/index.ts:1-7` — Barrel export for all V1 schemas
- `packages/console-types/src/api/v1/search.ts:1-229` — Search request/response schemas with 8 types
- `packages/console-types/src/api/v1/contents.ts:1-62` — Contents request/response schemas with 3 types
- `packages/console-types/src/api/v1/findsimilar.ts:1-142` — FindSimilar request/response schemas with 4 types

### API Route Implementations
- `apps/console/src/app/(api)/v1/search/route.ts` — Search endpoint (POST handler + 10-step pipeline)
- `apps/console/src/app/(api)/v1/contents/route.ts` — Contents endpoint (POST handler + 7-step pipeline)
- `apps/console/src/app/(api)/v1/findsimilar/route.ts` — FindSimilar endpoint (POST handler + 13-step pipeline)
- `apps/console/src/app/(api)/v1/lib/` — Shared auth utilities (withDualAuth, withApiKeyAuth)

### Documentation Files
- `apps/docs/src/content/api/endpoints/search.mdx` — Hand-written search docs (383 lines)
- `apps/docs/src/content/api/endpoints/contents.mdx` — Hand-written contents docs (265 lines)
- `apps/docs/src/content/api/endpoints/findsimilar.mdx` — Hand-written findsimilar docs (338 lines)
- `apps/docs/src/content/api/getting-started/overview.mdx` — API overview (207 lines, no alpha disclaimer)
- `apps/docs/source.config.ts:32` — `_openapi` field already in frontmatter schema

### Navigation Structure
- `apps/docs/src/content/api/meta.json` — Root: `["getting-started", "endpoints", "sdks-tools"]`
- `apps/docs/src/content/api/endpoints/meta.json` — `["search", "contents", "findsimilar"]`

## Architecture Documentation

### Current Documentation Architecture
```
┌──────────────────────────────────────────────────────────────────────┐
│ Source of Truth                                                       │
│ packages/console-types/src/api/v1/*.ts (Zod schemas)                │
│     ↓ (manual copy)                                                  │
│ apps/docs/src/content/api/endpoints/*.mdx (hand-written MDX)        │
│     ↓ (fumadocs build)                                               │
│ Static HTML at /docs/api-reference/endpoints/*                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Proposed Auto-Generation Architecture
```
┌──────────────────────────────────────────────────────────────────────┐
│ Source of Truth                                                       │
│ packages/console-types/src/api/v1/*.ts (Zod schemas)                │
│     ↓ (zod-to-openapi)                                               │
│ Generated OpenAPI 3.x spec (JSON/YAML)                               │
│     ↓ (fumadocs-openapi or custom script)                            │
│ Auto-generated parameter tables + type blocks                        │
│     + (hand-written prose sections in MDX)                           │
│     ↓ (fumadocs build)                                               │
│ Static HTML at /docs/api-reference/endpoints/*                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Requirements Identified

### Alpha Status Requirements (for API Overview section)
1. **Alpha banner/callout** on overview page stating API is in alpha
2. **Version lifecycle disclaimer**: "This API is currently in alpha. Breaking changes may occur between releases."
3. **Stability indicators** per endpoint (alpha/beta/stable) — all currently alpha
4. **Changelog link** for tracking breaking changes
5. **Migration guidance policy** — commitment to document breaking changes
6. **Rate limiting documentation** — currently undocumented (no rate limits found in route code)
7. **SLA/uptime commitments** — none needed for alpha, but should state explicitly

### Versioning Documentation Requirements
1. **Version in URL** documentation: `https://lightfast.ai/api/v1/...`
2. **Version lifecycle** explanation (alpha → beta → stable)
3. **Deprecation policy**: How long old versions will be supported
4. **Breaking vs non-breaking change definitions**
5. **Version header** (future consideration): `API-Version` header for minor version pinning

### Auto-Generation Requirements
1. **Schema-to-docs pipeline**: Build step that generates docs from Zod schemas
2. **Validation**: Ensure MDX docs match actual Zod schemas (drift detection)
3. **Hybrid approach**: Auto-generate type signatures, keep hand-written examples
4. **CI integration**: Fail build if schemas change without doc updates

## Open Questions

1. Should Fumadocs OpenAPI plugin (`fumadocs-openapi`) be used, or a custom generation script?
2. Should an OpenAPI spec be published publicly (e.g., at `/api/openapi.json`)?
3. What is the timeline for moving from alpha to beta? (affects disclaimer language)
4. Should rate limiting be implemented before or documented as "coming soon"?
5. Should the TypeScript SDK types page also be auto-generated from the same schemas?
6. How should breaking changes be communicated — changelog page, email, dashboard notification?

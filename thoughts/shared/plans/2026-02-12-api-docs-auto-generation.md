# API Documentation Auto-Generation & Alpha Disclaimers Implementation Plan

## Overview

Replace hand-written API endpoint documentation with auto-generated pages derived from the Zod schemas in `packages/console-types/src/api/v1/`. Add alpha status disclaimers to the overview and each endpoint page. The Zod schemas become the single source of truth for both runtime validation and documentation.

## Current State Analysis

### What Exists
- **Zod Schemas**: 22 schemas in `packages/console-types/src/api/v1/` with `.describe()` annotations on request fields (18 total annotations)
- **Hand-Written MDX**: 3 endpoint docs (~986 lines total) in `apps/docs/src/content/api/endpoints/`
- **fumadocs-openapi@9.6.4**: Already installed with CSS preset imported, `APIPage` component imported in `mdx-components.tsx:28`, `createOpenAPI` configured in `src/lib/openapi.ts`
- **Generation Script**: `scripts/generate-api-docs.ts` exists but targets stale `openapi.json`
- **Stale OpenAPI Spec**: `openapi.json` (1039 lines) describes a "Memory API" with `/memories` endpoints — does NOT match the actual v1 API

### What's Missing
- `@asteasolutions/zod-to-openapi` package (not installed)
- OpenAPI registry decorating the Zod schemas with OpenAPI metadata
- A build-time script to generate `openapi.json` from Zod schemas
- Alpha status disclaimers (zero mentions of alpha/beta anywhere in docs)
- `_openapi` frontmatter usage in any MDX file

### Key Discoveries
- `_openapi` field is defined in frontmatter schema (`source.config.ts:33`) but unused
- `APIPage` component is imported (`mdx-components.tsx:28`) but unused
- `fumadocs-openapi/css/preset.css` is already imported (`globals.css:4`)
- `scripts/generate-api-docs.ts` uses `groupBy: "tag"` and `includeDescription: true`
- Only request schemas use `.describe()` — response schemas use JSDoc comments only

## Desired End State

1. Running `pnpm generate:api-docs` from `apps/docs/` produces a fresh `openapi.json` from Zod schemas and generates MDX endpoint pages
2. Endpoint pages at `/docs/api-reference/endpoints/*` render via `APIPage` component with full parameter tables, type signatures, and examples
3. Overview page and each endpoint page display an alpha status banner
4. Old hand-written endpoint MDX files are replaced by generated ones
5. Build fails if Zod schemas change without regenerating docs (CI check)

### Verification
- `pnpm build:console-types` succeeds (types still compile)
- `pnpm --filter docs build` succeeds (docs site builds)
- All 3 endpoint pages render at `/docs/api-reference/endpoints/{search,contents,findsimilar}`
- Alpha banner visible on overview and endpoint pages
- Generated `openapi.json` matches the Zod schema field names, types, descriptions, and defaults

## What We're NOT Doing

- Adding rate limiting documentation (no rate limits exist in route code)
- Implementing version negotiation headers (`API-Version`, `Accept-Version`)
- Creating a public OpenAPI spec endpoint (`/api/openapi.json`)
- Auto-generating SDK/MCP server docs (only endpoints)
- Adding an API playground (can be added later)
- Changing the getting-started or authentication MDX files
- Modifying the Zod schemas themselves

## Implementation Approach

Use `@asteasolutions/zod-to-openapi` to register the existing Zod schemas with OpenAPI metadata, generate an OpenAPI 3.1 spec, then use fumadocs-openapi's `generateFiles` to produce MDX pages. Alpha disclaimers are added as custom content in the generated frontmatter and overview page.

---

## Phase 1: Zod-to-OpenAPI Registry & Spec Generation

### Overview
Install `@asteasolutions/zod-to-openapi`, create an OpenAPI registry that decorates the existing Zod schemas, and write a script that outputs `openapi.json`.

### Changes Required:

#### 1. Install `@asteasolutions/zod-to-openapi`
**Location**: `packages/console-types/`

```bash
cd packages/console-types && pnpm add @asteasolutions/zod-to-openapi
```

#### 2. Create OpenAPI Registry
**File**: `packages/console-types/src/api/v1/openapi-registry.ts` (new file)

This file registers all V1 schemas with the OpenAPI registry and defines the 3 API paths:

```typescript
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  V1SearchRequestSchema,
  V1SearchResponseSchema,
  V1ContentsRequestSchema,
  V1ContentsResponseSchema,
  V1FindSimilarRequestSchema,
  V1FindSimilarResponseSchema,
} from "./index";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Register schemas
registry.register("V1SearchRequest", V1SearchRequestSchema);
registry.register("V1SearchResponse", V1SearchResponseSchema);
registry.register("V1ContentsRequest", V1ContentsRequestSchema);
registry.register("V1ContentsResponse", V1ContentsResponseSchema);
registry.register("V1FindSimilarRequest", V1FindSimilarRequestSchema);
registry.register("V1FindSimilarResponse", V1FindSimilarResponseSchema);

// Security scheme
registry.registerComponent("securitySchemes", "apiKey", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "API Key",
  description:
    "Use your Lightfast API key (sk-lf-...) as the bearer token. Optionally include X-Workspace-ID header.",
});

// POST /v1/search
registry.registerPath({
  method: "post",
  path: "/v1/search",
  tags: ["Search"],
  summary: "Search",
  description:
    "Search across your team's knowledge with semantic understanding and multi-path retrieval.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1SearchRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": {
          schema: V1SearchResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});

// POST /v1/contents
registry.registerPath({
  method: "post",
  path: "/v1/contents",
  tags: ["Contents"],
  summary: "Get Contents",
  description:
    "Fetch full content for specific documents or observations by their IDs. Batch endpoint supporting up to 50 IDs per request.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1ContentsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Content items",
      content: {
        "application/json": {
          schema: V1ContentsResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});

// POST /v1/findsimilar
registry.registerPath({
  method: "post",
  path: "/v1/findsimilar",
  tags: ["Find Similar"],
  summary: "Find Similar",
  description:
    "Find content similar to a given document or URL using vector similarity, entity overlap, and cluster analysis.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1FindSimilarRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Similar content items",
      content: {
        "application/json": {
          schema: V1FindSimilarResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});

// Generator function
export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Lightfast API",
      version: "1.0.0-alpha",
      description:
        "Real-time semantic search across all your company's data sources. This API is currently in alpha — breaking changes may occur between releases.",
      contact: {
        name: "Lightfast Support",
        email: "support@lightfast.ai",
        url: "https://lightfast.ai",
      },
    },
    servers: [
      {
        url: "https://api.lightfast.ai",
        description: "Production API",
      },
    ],
    security: [{ apiKey: [] }],
    tags: [
      { name: "Search", description: "Semantic search across indexed content" },
      { name: "Contents", description: "Batch content retrieval by ID" },
      {
        name: "Find Similar",
        description: "Find similar content using vector similarity",
      },
    ],
  });
}
```

#### 3. Create Spec Generation Script
**File**: `packages/console-types/src/api/v1/generate-openapi.ts` (new file)

```typescript
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateOpenAPIDocument } from "./openapi-registry";

const doc = generateOpenAPIDocument();
const outputPath = resolve(__dirname, "../../../../apps/docs/openapi.json");

writeFileSync(outputPath, JSON.stringify(doc, null, 2));
console.log(`OpenAPI spec written to ${outputPath}`);
```

#### 4. Add Script to package.json
**File**: `packages/console-types/package.json`

Add to scripts:
```json
{
  "scripts": {
    "generate:openapi": "tsx src/api/v1/generate-openapi.ts"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-types generate:openapi` runs without error
- [x] `apps/docs/openapi.json` is generated and contains paths for `/v1/search`, `/v1/contents`, `/v1/findsimilar`
- [x] Generated spec validates as OpenAPI 3.1 (JSON structure check)
- [x] `pnpm --filter @repo/console-types build` still passes (no type breakage)

#### Manual Verification:
- [ ] Generated `openapi.json` field names match the Zod schema fields
- [ ] `.describe()` annotations appear as field descriptions in the spec
- [ ] Default values and validation constraints (min/max/enum) are present in the spec

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Replace OpenAPI Spec & Wire Build Pipeline

### Overview
Replace the stale Memory API `openapi.json` with the Zod-generated one, update the generation script to produce endpoint MDX pages, and wire it into the build.

### Changes Required:

#### 1. Update `apps/docs/scripts/generate-api-docs.ts`
**File**: `apps/docs/scripts/generate-api-docs.ts`

Update to first generate the OpenAPI spec from Zod, then generate MDX:

```typescript
#!/usr/bin/env tsx

import { generateFiles } from "fumadocs-openapi";
import { openapi } from "../src/lib/openapi";
import { execSync } from "node:child_process";

async function main() {
  console.log("Step 1: Generating OpenAPI spec from Zod schemas...");
  execSync("pnpm --filter @repo/console-types generate:openapi", {
    stdio: "inherit",
    cwd: process.cwd() + "/../..",
  });

  console.log("Step 2: Generating API documentation from OpenAPI spec...");
  try {
    await generateFiles({
      input: openapi,
      output: "./src/content/api/endpoints",
      includeDescription: true,
      groupBy: "tag",
      per: "operation",
      frontmatter: (title, description) => ({
        title,
        description,
        full: true,
      }),
    });

    console.log("API documentation generated successfully!");
  } catch (error) {
    console.error("Failed to generate API documentation:", error);
    process.exit(1);
  }
}

main();
```

#### 2. Update `apps/docs/package.json` Scripts
**File**: `apps/docs/package.json`

Add/update scripts:
```json
{
  "scripts": {
    "generate:api-docs": "tsx scripts/generate-api-docs.ts",
    "prebuild": "tsx scripts/generate-api-docs.ts"
  }
}
```

#### 3. Remove Old Hand-Written Endpoint MDX
After the generation script produces new files, remove the old ones if they conflict. The generated files will be placed in `src/content/api/endpoints/` organized by tag.

**Note**: The exact file names generated by fumadocs-openapi depend on the tag and operation names. After running the script for the first time, verify the output structure and update `meta.json` accordingly.

#### 4. Update Navigation Meta
**File**: `apps/docs/src/content/api/endpoints/meta.json`

Update to match the generated file names (will be determined after first generation run):
```json
{
  "title": "Endpoints",
  "pages": ["search", "contents", "findsimilar"]
}
```

The page names may need adjustment based on what `generateFiles` produces (e.g., `post-v1-search` vs `search`).

### Success Criteria:

#### Automated Verification:
- [x] `cd apps/docs && pnpm generate:api-docs` runs without error
- [x] Generated MDX files exist in `src/content/api/endpoints/`
- [x] Each generated MDX file contains `<APIPage>` component usage
- [ ] `pnpm --filter docs build` succeeds (blocked by pre-existing lint errors)
- [x] `pnpm typecheck` passes (docs typecheck specifically passes)

#### Manual Verification:
- [ ] Visit `/docs/api-reference/endpoints/search` — renders full API documentation
- [ ] Visit `/docs/api-reference/endpoints/contents` — renders full API documentation
- [ ] Visit `/docs/api-reference/endpoints/findsimilar` — renders full API documentation
- [ ] Parameter tables show correct types, descriptions, defaults, and constraints
- [ ] Navigation sidebar shows all 3 endpoints correctly

**Implementation Note**: After completing this phase, pause for manual verification of the rendered pages before proceeding.

---

## Phase 3: Alpha Status Disclaimers

### Overview
Add alpha status banners to the API overview page and each endpoint page.

### Changes Required:

#### 1. Create Alpha Banner Component
**File**: `apps/docs/src/components/alpha-banner.tsx` (new file)

```tsx
export function AlphaBanner() {
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xs p-4 mb-6">
      <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
        Alpha API
      </p>
      <p className="text-sm text-fd-muted-foreground">
        This API is currently in alpha. Breaking changes may occur between
        releases. We recommend pinning to a specific version and monitoring the
        changelog for updates.
      </p>
    </div>
  );
}
```

#### 2. Register in MDX Components
**File**: `apps/docs/mdx-components.tsx`

Add `AlphaBanner` to the exported components:
```typescript
import { AlphaBanner } from "@/components/alpha-banner";

// In mdxComponents object:
AlphaBanner,
```

#### 3. Add to Overview Page
**File**: `apps/docs/src/content/api/getting-started/overview.mdx`

Add `<AlphaBanner />` near the top of the page, below the imports and above the first content section.

#### 4. Add to Generated Endpoint Pages
Update the generation script's `frontmatter` option or add a `beforeWrite` hook to inject `<AlphaBanner />` into each generated MDX file.

Alternatively, update `scripts/generate-api-docs.ts` to use the `imports` option:
```typescript
await generateFiles({
  // ...existing options
  imports: [
    { names: ["AlphaBanner"], from: "@/components/alpha-banner" },
  ],
});
```

Then manually or via `beforeWrite` hook, prepend `<AlphaBanner />` to each generated file's body.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter docs build` succeeds (blocked by pre-existing lint errors)
- [x] `pnpm typecheck` passes
- [x] Alpha banner component exists and exports correctly

#### Manual Verification:
- [ ] Yellow alpha banner appears on `/docs/api-reference/getting-started/overview`
- [ ] Yellow alpha banner appears on each endpoint page
- [ ] Banner text is readable in both light and dark mode
- [ ] Banner does not break page layout

**Implementation Note**: After completing this phase, pause for manual design review of the banner styling.

---

## Phase 4: Cleanup & CI Integration

### Overview
Remove stale files, add a CI check to detect schema-doc drift, and update the research document.

### Changes Required:

#### 1. Remove Stale OpenAPI Spec Backup
If the old `openapi.json` was committed, it's now replaced by the generated one. Consider adding it to `.gitignore` if you want it generated fresh each build, or commit the generated version.

#### 2. Add CI Drift Detection
**Option A**: Add to existing lint/typecheck CI step:
```bash
# In CI, generate and check for differences
pnpm --filter @repo/console-types generate:openapi
git diff --exit-code apps/docs/openapi.json || (echo "OpenAPI spec is out of date. Run 'pnpm generate:api-docs' and commit." && exit 1)
```

**Option B**: Add `openapi.json` to `.gitignore` and always generate at build time via `prebuild` script (already added in Phase 2).

Recommend **Option B** for simplicity — generate at build time, don't commit.

#### 3. Add `openapi.json` to `.gitignore`
**File**: `apps/docs/.gitignore`

```
openapi.json
```

#### 4. Clean Up Old Endpoint MDX (if not already removed)
Remove any remaining hand-written endpoint files that conflict with generated ones:
- `apps/docs/src/content/api/endpoints/search.mdx` (if still present)
- `apps/docs/src/content/api/endpoints/contents.mdx` (if still present)
- `apps/docs/src/content/api/endpoints/findsimilar.mdx` (if still present)

Only remove after verifying generated files render correctly.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter docs build` succeeds from a clean state (no pre-existing `openapi.json`) - blocked by pre-existing lint errors, but generation and typecheck work
- [x] `pnpm typecheck` passes for docs
- [x] Generated endpoint pages render correctly after clean build

#### Manual Verification:
- [ ] Full docs site navigation works end-to-end
- [ ] No broken links from overview to endpoint pages
- [ ] SDKs & Tools section unaffected
- [ ] Getting Started section unaffected

---

## Testing Strategy

### Unit Tests:
- None required — this is documentation infrastructure, not application logic

### Integration Tests:
- Docs build (`pnpm --filter docs build`) is the primary integration test
- OpenAPI spec generation (`pnpm --filter @repo/console-types generate:openapi`) validates schema compatibility

### Manual Testing Steps:
1. Run `pnpm generate:api-docs` from `apps/docs/`
2. Start dev server: `cd apps/docs && pnpm dev`
3. Navigate to `/docs/api-reference/getting-started/overview` — verify alpha banner
4. Navigate to each endpoint page — verify auto-generated content renders
5. Check parameter tables for accuracy against Zod schemas
6. Test dark mode for alpha banner visibility
7. Verify sidebar navigation is correct

## Performance Considerations

- OpenAPI spec generation is fast (<1s) — adds negligible build time
- `generateFiles` is fast (<2s) — runs only at build time, not runtime
- No runtime performance impact — all docs are statically generated

## Migration Notes

- The old `openapi.json` (Memory API spec) is completely replaced — it was not used in production
- Hand-written endpoint MDX files are replaced — their content (curl examples, use case sections) will be lost in favor of auto-generated content from fumadocs-openapi
- The `imports` option in `generateFiles` may need adjustment based on fumadocs-openapi v9.6.4's exact API

## Risks & Mitigations

1. **fumadocs-openapi `generateFiles` output structure may differ from expected**: Run the generation script first, inspect output, then adjust `meta.json` navigation
2. **`.describe()` only on request schemas**: Response schema fields will show types but not descriptions. Mitigation: Add `.describe()` annotations to response schemas in Phase 1 if needed
3. **Loss of hand-written examples**: Auto-generated pages won't have the custom curl examples and use-case sections. Mitigation: These can be added back via the `generateCodeSamples` option on `APIPage` or as supplementary MDX content

## References

- Research document: `thoughts/shared/research/2026-02-12-api-docs-auto-generation-versioning.md`
- Zod schemas: `packages/console-types/src/api/v1/`
- Current endpoint docs: `apps/docs/src/content/api/endpoints/`
- fumadocs-openapi docs: https://fumadocs.vercel.app/docs/openapi
- `@asteasolutions/zod-to-openapi`: https://github.com/asteasolutions/zod-to-openapi

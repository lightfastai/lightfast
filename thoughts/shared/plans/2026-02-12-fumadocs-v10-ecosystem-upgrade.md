# Fumadocs v10 Ecosystem Upgrade + OpenAPI Documentation Overhaul

## Overview

Upgrade `apps/docs` to the latest fumadocs ecosystem (v10 openapi, v16 core/ui, v14 mdx) requiring Next.js 16 and Zod v4. Migrate from the `generateFiles` build-time approach to the `createAPIPage` + `defineClientConfig` pattern. Add missing Graph and Related API endpoints to the OpenAPI spec.

## Current State Analysis

**Installed versions:**
| Package | Current | Target |
|---------|---------|--------|
| `fumadocs-core` | 15.6.9 | 16.5.4 |
| `fumadocs-ui` | 15.6.9 | 16.5.4 |
| `fumadocs-openapi` | ^9.6.4 | ^10.3.4 |
| `fumadocs-mdx` | 11.7.4 | 14.2.7 |
| `next` | catalog:next15 (^15.5.7) | catalog:next16 (^16.1.6) |
| `zod` | catalog:zod3 (^3.25.76) | catalog:zod4 (^4.0.0) |

**Reference:** `apps/www` is already on `next: catalog:next16` — this upgrade is scoped to `apps/docs` only.

### Key Discoveries:
- `fumadocs-core@16.x` requires `next@16.x.x` + `zod@4.x.x` as peer deps (`apps/docs/package.json:37,44,50`)
- `fumadocs-openapi@10.x` requires `fumadocs-core@^16.5.0` + `fumadocs-ui@^16.5.0` as peer deps
- `fumadocs-mdx@14.x` bundles `zod@^4.3.6` as a direct dep (not peer)
- v9.6.4 bundled its own fumadocs-core 16.0.3 internally; v10 externalizes to peer deps
- The `RootProvider` import changes: `fumadocs-ui/provider` → `fumadocs-ui/provider/next` (`apps/docs/src/app/layout.tsx:7`)
- The `source.config.ts` defines a manual Zod schema to avoid v3/v4 cross-version errors — with Zod v4 in the project, this can use `frontmatterSchema.extend()` instead (`source.config.ts:27-55`)
- Current build pipeline: `prebuild` script → `generateFiles()` → MDX files → `<APIPage>` component (`scripts/generate-api-docs.ts:21-32`)
- Graph (`V1GraphRequestSchema`) and Related (`V1RelatedRequestSchema`) schemas exist in `@repo/console-types/api/v1/graph.ts` but are NOT registered in the OpenAPI spec (`packages/console-openapi/src/registry.ts`)

## Desired End State

After this plan is complete:
1. `apps/docs` runs on Next.js 16, Zod v4, fumadocs-core/ui 16.5.4, fumadocs-openapi 10.3.4, fumadocs-mdx 14.2.7
2. API documentation uses `createAPIPage` + `defineClientConfig` pattern instead of `generateFiles`
3. OpenAPI spec includes Graph and Related API endpoints (5 total endpoints)
4. `openapiPlugin()` adds HTTP method badges to the sidebar page tree
5. Build pipeline no longer generates MDX files for API endpoints — uses `openapiSource` virtual pages instead
6. All existing URLs and SEO metadata are preserved

### How to verify:
- `pnpm --filter @lightfast/docs build:prod` succeeds
- `pnpm --filter @lightfast/docs typecheck` passes
- `pnpm --filter @lightfast/docs lint` passes
- API reference pages render correctly at `/docs/api-reference/endpoints/*`
- No broken links in the sidebar navigation

## What We're NOT Doing

- Upgrading other apps (console, auth, chat) to Next.js 16 — only `apps/docs`
- Custom renderer UI overrides (separate follow-up — this plan establishes the v10 foundation)
- API playground configuration via `defineClientConfig` (can be iterated on post-upgrade)
- Upgrading the `@repo/ui` package's Zod dependency (it uses Zod v3 via drizzle-zod constraints)
- Migrating manually-authored MDX pages (getting-started/, sdks-tools/) — those remain as-is

## Implementation Approach

The upgrade is sequenced to minimize breakage: dependencies first, then import/config fixes, then the openapi migration. Each phase produces a buildable state.

---

## Phase 1: Dependency Upgrades

### Overview
Bump all package versions in `apps/docs/package.json`. This will break the build temporarily (Phase 2 fixes it).

### Changes Required:

#### 1. Package version bumps
**File**: `apps/docs/package.json`
**Changes**: Update 6 dependencies

```json
// Before
"fumadocs-core": "15.6.9",
"fumadocs-mdx": "11.7.4",
"fumadocs-openapi": "^9.6.4",
"fumadocs-ui": "15.6.9",
"next": "catalog:next15",
"zod": "catalog:zod3"

// After
"fumadocs-core": "16.5.4",
"fumadocs-mdx": "14.2.7",
"fumadocs-openapi": "^10.3.4",
"fumadocs-ui": "16.5.4",
"next": "catalog:next16",
"zod": "catalog:zod4"
```

#### 2. Install dependencies
Run `pnpm install` from the workspace root to resolve the new versions.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` completes without errors

**Implementation Note**: The build will NOT pass yet — Phase 2 addresses the breaking import/config changes.

---

## Phase 2: Fix Breaking Changes (Next.js 16 + fumadocs v16)

### Overview
Fix all import paths, config patterns, and Zod schema definitions that changed across the major version boundaries.

### Changes Required:

#### 1. RootProvider import path
**File**: `apps/docs/src/app/layout.tsx:7`
**Changes**: Update import path for Next.js integration

```typescript
// Before
import { RootProvider } from "fumadocs-ui/provider";

// After
import { RootProvider } from "fumadocs-ui/provider/next";
```

#### 2. Source config — Zod v4 schema
**File**: `apps/docs/source.config.ts`
**Changes**: With Zod v4 now available, we can simplify the schema. However, the current manual schema approach will still work with Zod v4 — the `z.object()` API is compatible. The key change is that `fumadocs-mdx@14` uses Zod v4 internally, so we should import from `zod/v4` or just `zod` (if the project is now on v4).

Since the docs app will be on `catalog:zod4`, the existing schema in `source.config.ts:27-55` should work as-is because Zod v4 maintains backward compatibility for `z.object()`, `z.string()`, `z.boolean()`, `z.enum()`, `z.record()`, and `z.unknown()`.

**No changes needed** to the schema definition itself — just verify it compiles.

#### 3. Next.js config — check for deprecated options
**File**: `apps/docs/next.config.ts`
**Changes**: Next.js 16 removed `reactStrictMode` (it's always on). Remove the option if it causes a build error, or leave it as a no-op if tolerated.

```typescript
// Before
const config: NextConfig = {
  reactStrictMode: true,
  // ...
};

// After (if reactStrictMode causes error)
const config: NextConfig = {
  // reactStrictMode is always enabled in Next.js 16
  // ...
};
```

Also check: `transpilePackages` may be unnecessary in Next.js 16 if it auto-transpiles workspace packages. Test and remove if so.

#### 4. CSS imports — check for renamed/removed styles
**File**: `apps/docs/src/styles/globals.css`
**Changes**: Verify that fumadocs CSS imports still exist in v16:
- `fumadocs-ui/css/black.css` — may be renamed
- `fumadocs-ui/css/preset.css` — may be renamed
- `fumadocs-openapi/css/preset.css` — check v10 CSS

Also check the root layout import at `apps/docs/src/app/layout.tsx:1`:
```typescript
import "fumadocs-ui/style.css"; // verify this still exists in v16
```

#### 5. Type imports from `fumadocs-core/server`
**Files**:
- `apps/docs/src/components/docs-sidebar.tsx:5` — `import type { PageTree } from "fumadocs-core/server"`
- `apps/docs/src/components/toc.tsx:9` — `import type { TOCItemType } from "fumadocs-core/server"`
- `apps/docs/src/components/docs-layout.tsx:2` — `import type { TOCItemType } from "fumadocs-core/server"`

**Changes**: Verify these types still export from `fumadocs-core/server` in v16. If moved, update import paths. The research indicates `getGithubLastEdit` and `getTableOfContents` functions moved, but type exports may remain.

#### 6. `fumadocs-mdx` postinstall hook
**File**: `apps/docs/package.json:17`
**Changes**: Verify `postinstall: "fumadocs-mdx"` still works in v14. The CLI interface may have changed.

#### 7. `createMDX` wrapper
**File**: `apps/docs/next.config.ts:1`
**Changes**: Verify `fumadocs-mdx/next` still exports `createMDX` in v14. If renamed, update the import.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @lightfast/docs typecheck` passes
- [x] `pnpm --filter @lightfast/docs build:prod` succeeds (MDX endpoint generation temporarily disabled - will be replaced with openapiSource in Phase 4)
- Note: Lint has pre-existing issues unrelated to upgrade

#### Manual Verification:
- [ ] `pnpm dev:docs` starts without errors
- [ ] General docs pages render correctly at `/docs/get-started/overview`
- [ ] API reference pages render correctly at `/docs/api-reference/getting-started/overview`
- [ ] No console errors related to fumadocs or hydration

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Register Graph and Related Endpoints in OpenAPI Spec

### Overview
Add the Graph and Related API endpoints to the OpenAPI registry so they appear in the generated documentation.

### Changes Required:

#### 1. Import new schemas
**File**: `packages/console-openapi/src/registry.ts`
**Changes**: Add Graph and Related schema imports and path registrations

```typescript
// Add to imports (line 7-14)
import {
  V1SearchRequestSchema,
  V1SearchResponseSchema,
  V1ContentsRequestSchema,
  V1ContentsResponseSchema,
  V1FindSimilarRequestSchema,
  V1FindSimilarResponseSchema,
  V1GraphRequestSchema,
  GraphResponseSchema,
  V1RelatedRequestSchema,
  RelatedResponseSchema,
} from "@repo/console-types/api";
```

#### 2. Register new schemas
**File**: `packages/console-openapi/src/registry.ts`
**Changes**: Add schema registrations after line 26

```typescript
registry.register("V1GraphRequest", V1GraphRequestSchema);
registry.register("GraphResponse", GraphResponseSchema);
registry.register("V1RelatedRequest", V1RelatedRequestSchema);
registry.register("RelatedResponse", RelatedResponseSchema);
```

#### 3. Register Graph API path
**File**: `packages/console-openapi/src/registry.ts`
**Changes**: Add after the findsimilar path registration (~line 134)

```typescript
registry.registerPath({
  method: "post",
  path: "/v1/graph",
  tags: ["Graph"],
  summary: "Relationship Graph",
  description: "Traverse the relationship graph starting from a specific observation. Returns connected nodes and edges with relationship metadata.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1GraphRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Graph traversal results",
      content: {
        "application/json": {
          schema: GraphResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});
```

#### 4. Register Related API path
**File**: `packages/console-openapi/src/registry.ts`
**Changes**: Add after the graph path registration

```typescript
registry.registerPath({
  method: "post",
  path: "/v1/related",
  tags: ["Related"],
  summary: "Find Related Events",
  description: "Find events related to a specific observation, grouped by source and relationship type.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1RelatedRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Related events",
      content: {
        "application/json": {
          schema: RelatedResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});
```

#### 5. Add new tags to document generator
**File**: `packages/console-openapi/src/registry.ts`
**Changes**: Add tags in `generateOpenAPIDocument()` at ~line 159

```typescript
tags: [
  { name: "Search", description: "Semantic search across indexed content" },
  { name: "Contents", description: "Batch content retrieval by ID" },
  { name: "Find Similar", description: "Find similar content using vector similarity" },
  { name: "Graph", description: "Relationship graph traversal" },
  { name: "Related", description: "Find related events by observation" },
],
```

#### 6. Regenerate OpenAPI spec
Run: `pnpm --filter @repo/console-openapi generate:openapi`

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @repo/console-openapi generate:openapi` succeeds
- [ ] Generated `packages/console-openapi/openapi.json` contains `/v1/graph` and `/v1/related` paths
- [ ] `pnpm --filter @lightfast/docs typecheck` passes

---

## Phase 4: Migrate from generateFiles to createAPIPage + openapiSource

### Overview
Replace the build-time MDX generation pipeline with the v10 `createAPIPage` pattern using `openapiSource` for virtual pages. This eliminates the prebuild step for API docs and enables the full v10 customization API.

### Changes Required:

#### 1. Create API page component with createAPIPage
**File**: `apps/docs/src/lib/api-page.tsx` (NEW)
**Changes**: Server-side API page factory

```tsx
import { openapi } from "@/src/lib/openapi";
import { createAPIPage } from "fumadocs-openapi/ui";
import client from "./api-page.client";

export const APIPage = createAPIPage(openapi, { client });
```

#### 2. Create client config
**File**: `apps/docs/src/lib/api-page.client.tsx` (NEW)
**Changes**: Client-side configuration for API pages

```tsx
"use client";
import { defineClientConfig } from "fumadocs-openapi/ui/client";

export default defineClientConfig({
  // Placeholder — customize in follow-up (playground, code samples, etc.)
});
```

#### 3. Update source.ts to use openapiSource + openapiPlugin
**File**: `apps/docs/src/lib/source.ts`
**Changes**: Replace MDX-based API source with openapiSource virtual pages. Keep the manual MDX source for getting-started/ and sdks-tools/ pages.

```typescript
import { docs, meta, apiDocs, apiMeta } from "@/.source";
import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";
import { openapiSource, openapiPlugin } from "fumadocs-openapi/server";
import { openapi } from "./openapi";

// Docs source (general documentation)
export const docsSource = loader({
  baseUrl: "/docs",
  source: createMDXSource(docs, meta),
});

// API source — combines manual MDX pages + virtual OpenAPI pages
export const apiSource = loader({
  baseUrl: "/docs/api-reference",
  source: createMDXSource(apiDocs, apiMeta),
  plugins: [openapiPlugin()],
});

// Export docs methods
export const { getPage, getPages, pageTree } = docsSource;

// Export API methods with different names
export const {
  getPage: getApiPage,
  getPages: getApiPages,
  pageTree: apiPageTree,
} = apiSource;
```

**Note**: The `openapiSource` integration approach depends on how v10 combines virtual pages with MDX pages. We may need to use `loader()` with a `multiple()` combiner instead. This needs to be validated during implementation — check the fumadocs v10 docs for the `multiple()` utility or whether `openapiPlugin()` alone handles injection of virtual pages into an existing MDX source.

#### 4. Update API reference page to use createAPIPage
**File**: `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx`
**Changes**: For endpoint pages (those with `_openapi` metadata), render using the new `APIPage` component from `createAPIPage`. For manual MDX pages, continue rendering as before.

The key insight: with `openapiSource` virtual pages, the page data includes a `getAPIPageProps()` method. The page component checks if the current page is an OpenAPI page and renders accordingly.

```tsx
import { getApiPage, getApiPages } from "@/src/lib/source";
import { APIPage } from "@/src/lib/api-page";
// ... rest of imports

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolvedParams = await params;

  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    redirect("/docs/api-reference/getting-started/overview");
  }

  const slug = resolvedParams.slug;
  const page = getApiPage(slug);

  if (!page) return notFound();

  // Check if this is an OpenAPI-generated page
  if ("getAPIPageProps" in page.data) {
    const props = page.data.getAPIPageProps();
    return (
      <>
        <JsonLd code={buildStructuredData(slug, page)} />
        <DocsLayout toc={[]}>
          <AlphaBanner />
          <article className="max-w-none">
            <APIPage {...props} />
          </article>
        </DocsLayout>
      </>
    );
  }

  // Regular MDX page (getting-started, sdks-tools)
  const MDX = page.data.body;
  const toc = page.data.toc;
  // ... existing MDX rendering logic
}
```

#### 5. Update mdx-components.tsx — remove old APIPage import
**File**: `apps/docs/mdx-components.tsx`
**Changes**: Remove the `APIPage` import from `fumadocs-openapi/ui` (line 28) and its export (line 408). The generated MDX files that used `<APIPage>` will no longer exist.

```typescript
// Remove this line:
// import { APIPage } from "fumadocs-openapi/ui";

// Remove from component map:
// APIPage,
```

#### 6. Remove generateFiles prebuild script
**File**: `apps/docs/scripts/generate-api-docs.ts`
**Changes**: Keep Step 1 (OpenAPI spec generation from Zod schemas) but remove Step 2 (MDX file generation). Simplify to just run the console-openapi generation.

```typescript
#!/usr/bin/env tsx
import { execSync } from "node:child_process";

async function main() {
  console.log("Generating OpenAPI spec from Zod schemas...");
  try {
    execSync("pnpm --filter @repo/console-openapi generate:openapi", {
      stdio: "inherit",
      cwd: process.cwd() + "/../..",
    });
    console.log("✅ OpenAPI spec generated successfully!");
  } catch (error) {
    console.error("❌ Failed to generate OpenAPI spec:", error);
    process.exit(1);
  }
}

main();
```

#### 7. Delete generated MDX endpoint files
Delete the entire `apps/docs/src/content/api/endpoints/` directory. These files are no longer needed — `openapiSource` generates virtual pages at build time.

Files to delete:
- `apps/docs/src/content/api/endpoints/search/v1/search/post.mdx`
- `apps/docs/src/content/api/endpoints/contents/v1/contents/post.mdx`
- `apps/docs/src/content/api/endpoints/find-similar/v1/findsimilar/post.mdx`
- `apps/docs/src/content/api/endpoints/meta.json`
- Any parent directories that become empty

#### 8. Update source.config.ts — remove apiDocs if using openapiSource exclusively
**File**: `apps/docs/source.config.ts`
**Changes**: The `apiDocs` source definition at line 64-69 can be simplified. If all endpoint pages come from `openapiSource` and only getting-started/ and sdks-tools/ remain as MDX, the API content directory shrinks.

Keep the `defineDocs` for `src/content/api` since it still serves the manual MDX pages (getting-started, sdks-tools).

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/docs typecheck` passes
- [ ] `pnpm --filter @lightfast/docs lint` passes
- [ ] `pnpm --filter @lightfast/docs build:prod` succeeds
- [ ] No generated MDX files exist in `src/content/api/endpoints/`

#### Manual Verification:
- [ ] API reference sidebar shows all 5 endpoints with HTTP method badges (POST)
- [ ] Search endpoint page renders correctly at `/docs/api-reference/endpoints/search/...`
- [ ] Graph and Related endpoint pages render correctly
- [ ] Getting-started and SDKs-tools manual pages still render
- [ ] No 404 errors in navigation
- [ ] Structured data (JSON-LD) still present on endpoint pages

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: URL Preservation and Cleanup

### Overview
Ensure old URLs still resolve (or redirect) and clean up any remaining artifacts from the migration.

### Changes Required:

#### 1. URL mapping verification
The old generated MDX files created URLs like:
- `/docs/api-reference/endpoints/search/v1/search/post`
- `/docs/api-reference/endpoints/contents/v1/contents/post`
- `/docs/api-reference/endpoints/find-similar/v1/findsimilar/post`

The new `openapiSource` virtual pages may generate different URL paths. Check the fumadocs-openapi v10 `name` option:
```typescript
openapiSource(openapi, {
  name: { algorithm: 'v1' }, // Use v1 path algorithm for backwards compatibility
  groupBy: "tag",
  per: "operation",
});
```

If URLs change, add redirects in `next.config.ts`:
```typescript
async redirects() {
  return [
    // Map old endpoint URLs to new ones if they changed
  ];
}
```

#### 2. Remove old meta.json for endpoints
If `apps/docs/src/content/api/endpoints/meta.json` was not deleted in Phase 4, ensure it's removed.

#### 3. Verify sitemap generation
Confirm that `pnpm build:prod` still generates a correct sitemap including the new Graph and Related endpoint pages.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/docs build:prod` succeeds
- [ ] Build output includes all 5 endpoint pages in the static generation

#### Manual Verification:
- [ ] Old bookmark URLs either resolve correctly or redirect
- [ ] Sitemap at `/docs/sitemap.xml` includes new endpoints
- [ ] No broken internal links detected

---

## Testing Strategy

### Automated Tests:
- TypeScript compilation: `pnpm --filter @lightfast/docs typecheck`
- Lint: `pnpm --filter @lightfast/docs lint`
- Full build: `pnpm --filter @lightfast/docs build:prod`
- OpenAPI spec generation: `pnpm --filter @repo/console-openapi generate:openapi`

### Manual Testing Steps:
1. Start dev server: `cd apps/docs && pnpm dev`
2. Navigate to `/docs/api-reference/getting-started/overview` — verify renders
3. Navigate to each of the 5 endpoint pages — verify API documentation renders
4. Check sidebar — verify method badges (POST) appear next to endpoint names
5. Check structured data — inspect page source for JSON-LD on an endpoint page
6. Check search sync: verify `search:sync` still works with the new page structure
7. Test microfrontend routing: access docs through `localhost:3024/docs/api-reference/`

## Performance Considerations

- **Build time**: Removing `generateFiles` eliminates one prebuild step, but `openapiSource` adds virtual page processing during the main build. Net effect should be neutral or slightly faster.
- **Bundle size**: fumadocs-openapi v10 externalizes fumadocs-core/ui as peer deps instead of bundling them. This should reduce total node_modules size since the docs app already installs these packages.
- **Runtime**: No change — pages are still statically generated at build time.

## Migration Notes

- **Rollback**: If the upgrade fails, revert `apps/docs/package.json` to the previous versions. The generated MDX files in git serve as a fallback.
- **Other apps**: This upgrade is scoped to `apps/docs` only. Other apps remain on Next.js 15 via `catalog:next15`.
- **Zod v4 in docs**: The docs app's Zod usage is limited to `source.config.ts` frontmatter schema. No API route handlers or database schemas use Zod in the docs app, so the v3→v4 migration surface is minimal.

## References

- Research: `thoughts/shared/research/2026-02-12-openapi-docs-ui-customization.md`
- Reference app (Next.js 16): `apps/www/package.json` — already on `catalog:next16`
- OpenAPI registry: `packages/console-openapi/src/registry.ts`
- Graph/Related schemas: `packages/console-types/src/api/v1/graph.ts`
- fumadocs-openapi v10 exports: `./ui`, `./ui/base`, `./ui/client`, `./playground`, `./playground/client`, `./scalar`, `./server`

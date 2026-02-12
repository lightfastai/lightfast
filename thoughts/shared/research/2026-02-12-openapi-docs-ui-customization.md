---
date: 2026-02-12T10:00:00+11:00
researcher: claude
git_commit: 006554d28530f986750716e301407e3c0c68cfed
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "OpenAPI Documentation UI Customization - fumadocs-openapi Integration"
tags: [research, codebase, fumadocs-openapi, api-docs, openapi, ui-customization]
status: complete
last_updated: 2026-02-12
last_updated_by: claude
---

# Research: OpenAPI Documentation UI Customization

**Date**: 2026-02-12
**Git Commit**: `006554d2`
**Branch**: `feat/landing-page-grid-rework`

## Research Question

How is fumadocs-openapi currently integrated, and what's needed to move to the newer `createAPIPage` / `defineClientConfig` / `openapiSource` pattern with custom UI overrides?

## Summary

The docs app currently uses **fumadocs-openapi v9.6.4** with the **`generateFiles` approach** — a build-time script generates MDX files containing `<APIPage>` components. The `createAPIPage` and `defineClientConfig` APIs **do not exist in v9.6.4** — they are part of **v10.x**, which requires upgrading to `fumadocs-core@16.5+` and `fumadocs-ui@16.5+` (currently on `15.6.9`). The v9.6.4 `Renderer` interface provides 13 component slots for customization, but none are currently overridden.

## Detailed Findings

### 1. Current Architecture

**Version Matrix:**
| Package | Installed | Required for v10 |
|---------|-----------|-------------------|
| `fumadocs-openapi` | 9.6.4 | 10.3.4 (latest) |
| `fumadocs-core` | 15.6.9 | ^16.5.0 |
| `fumadocs-ui` | 15.6.9 | ^16.5.0 |

**Build Pipeline (current):**
```
Zod schemas → @repo/console-openapi/openapi.json → generateFiles() → MDX files → <APIPage>
```

Key files:
- `apps/docs/src/lib/openapi.ts:1-5` — `createOpenAPI()` with input pointing to `../../packages/console-openapi/openapi.json`
- `apps/docs/scripts/generate-api-docs.ts:21-32` — `generateFiles()` call: `groupBy: "tag"`, `per: "operation"`, output to `./src/content/api/endpoints`
- `apps/docs/package.json:11` — `"prebuild": "tsx scripts/generate-api-docs.ts"` runs before every build
- `apps/docs/mdx-components.tsx:28,408` — `APIPage` imported from `fumadocs-openapi/ui` and passed through unchanged
- `apps/docs/src/styles/globals.css:4` — `@import "fumadocs-openapi/css/preset.css"`

**Source Configuration (`apps/docs/source.config.ts:57-69`):**
- Two separate `defineDocs()` calls: one for general docs (`src/content/docs`), one for API docs (`src/content/api`)
- Both share the same `docsSchema` which includes `_openapi: z.record(z.unknown()).optional()` at line 33
- `rehypeCodeOptions: false` at line 75 — disables fumadocs' built-in Shiki for custom SSRCodeBlock

**Source Loader (`apps/docs/src/lib/source.ts:11-25`):**
- `apiSource = loader({ baseUrl: "/docs/api-reference", source: createMDXSource(apiDocs, apiMeta) })`
- Exports `getApiPage`, `getApiPages`, `apiPageTree`
- No `openapiPlugin()` in the loader — no method badges in page tree

**Generated MDX Files (3 endpoint files):**
- `src/content/api/endpoints/search/v1/search/post.mdx`
- `src/content/api/endpoints/contents/v1/contents/post.mdx`
- `src/content/api/endpoints/find-similar/v1/findsimilar/post.mdx`

Each contains frontmatter with `_openapi` metadata and a single `<APIPage>` component call:
```mdx
<APIPage document={"../../packages/console-openapi/openapi.json"} operations={[{"path":"/v1/search","method":"post"}]} webhooks={[]} hasHead={false} />
```

**Navigation Structure (`src/content/api/`):**
```
api/
├── meta.json
├── getting-started/  (overview, authentication, errors)
├── endpoints/        (generated MDX with APIPage)
└── sdks-tools/       (typescript-sdk, mcp-server)
```

### 2. Renderer Interface (v9.6.4 Customization)

The `Renderer` interface at `fumadocs-openapi/dist/render/renderer.d.ts` provides **13 overridable component slots**:

| Slot | Type | Purpose |
|------|------|---------|
| `Root` | `RootProps & HTMLAttributes<HTMLDivElement>` | Top-level container with render context |
| `API` | `{ children: ReactNode }` | API operation wrapper |
| `APIInfo` | `{ method, route, head, children }` | Method/route display with heading |
| `APIExample` | `{ children: ReactNode }` | Example section wrapper |
| `Responses` | `{ items: string[], children }` | Response tabs container |
| `Response` | `{ value: string, children }` | Individual response tab |
| `CodeExampleSelector` | `{ items: SamplesProps[] }` | Code sample language selector |
| `Requests` | `{ items: string[], children }` | Request body tabs |
| `Request` | `{ name, children }` | Individual request tab |
| `ResponseTypes` | `{ defaultValue?, children }` | Response type selector |
| `ResponseType` | `{ label, children }` | Individual response type |
| `ObjectCollapsible` | `{ name, children }` | Collapsible object schema |
| `Property` | `{ name, type, required?, deprecated?, children?, nested? }` | Schema property display |
| `APIPlayground` | `APIPlaygroundProps` | Interactive API playground |

**How to override (v9.6.4):** Pass `renderer` option to `createOpenAPI()`:
```typescript
createOpenAPI({
  input: [...],
  renderer: {
    Root: CustomRoot,
    APIInfo: CustomAPIInfo,
    Property: CustomProperty,
    // ... partial overrides
  }
});
```

Or pass `renderer` directly to `<APIPage>`:
```tsx
<APIPage {...props} renderer={{ Property: CustomProperty }} />
```

### 3. `createAPIPage` / `defineClientConfig` — v10.x Only

These APIs are documented on fumadocs.dev but **are NOT available in v9.6.4**:

```bash
# Grep confirms they don't exist in the installed version
$ grep -r "createAPIPage\|defineClientConfig" node_modules/fumadocs-openapi/dist/
# (no results)
```

**v10.x pattern (from fumadocs.dev docs):**
```tsx
// lib/api-page.tsx
import { openapi } from '@/lib/openapi';
import { createAPIPage } from 'fumadocs-openapi/ui';
import client from './api-page.client';

export const APIPage = createAPIPage(openapi, { client });

// lib/api-page.client.tsx
'use client';
import { defineClientConfig } from 'fumadocs-openapi/ui/client';

export default defineClientConfig({
  // client-side config
});
```

**v10.x new exports:**
- `fumadocs-openapi/ui/base` — new sub-export
- `fumadocs-openapi/ui/client` — expanded from single `CopyResponseTypeScript` to full client config
- `fumadocs-openapi/playground/client` — new sub-export

### 4. `openapiSource` — Available in v9.6.4

The `openapiSource` function **does exist in v9.6.4** at `fumadocs-openapi/server`:

```typescript
// source-api.d.ts
export declare function openapiSource(
  from: OpenAPIServer,
  options?: SchemaToPagesOptions & { baseDir?: string }
): Promise<Source<{ metaData: MetaData; pageData: OpenAPIPageData }>>;
```

This generates **virtual pages** at runtime instead of writing MDX files. Each page has `getAPIPageProps()` method.

**`openapiPlugin()` is also available** and can be added to `loader()`:
```typescript
export declare function openapiPlugin(): LoaderPlugin;
// Adds method badge to page tree items
```

### 5. Upgrade Path

**Option A: Stay on v9.6.4, use `openapiSource` + `renderer` overrides**
- Switch from `generateFiles` to `openapiSource` (already available)
- Use `renderer` option for UI customization
- Delete `scripts/generate-api-docs.ts`
- Restructure `source.ts` to use `openapiSource` instead of MDX-based source

**Option B: Upgrade to v10.x (requires fumadocs ecosystem upgrade)**
- Upgrade `fumadocs-core`: 15.6.9 → 16.5.0+
- Upgrade `fumadocs-ui`: 15.6.9 → 16.5.0+
- Upgrade `fumadocs-openapi`: 9.6.4 → 10.3.4
- Get access to `createAPIPage`, `defineClientConfig`, `ui/base` exports
- May require `fumadocs-mdx` upgrade too (currently 11.7.4)

### 6. Custom API Components (Non-fumadocs)

The docs app has hand-built components for the overview/landing pages:
- `src/components/api-endpoint.tsx` — colored method badge + path display
- `src/components/api-method.tsx` — HTTP method badge only
- `src/components/api-reference-card.tsx` — card grid linking to endpoint pages

These are used in manually authored MDX (e.g., `getting-started/overview.mdx`) and are separate from the fumadocs-openapi `APIPage` rendering.

### 7. console-openapi Package

**Location:** `packages/console-openapi/`

The package generates `openapi.json` from Zod schemas:
- `src/registry.ts:21-26` — Registers 6 schemas (request/response for search, contents, find-similar)
- `src/registry.ts:38-134` — Registers 3 API paths with full OpenAPI metadata
- `src/registry.ts:137-168` — `generateOpenAPIDocument()` function creates OpenAPI 3.1.0 doc
- `scripts/generate.ts` — CLI script that writes JSON to `openapi.json`
- Uses `@asteasolutions/zod-to-openapi` for Zod → OpenAPI conversion

## Code References

- `apps/docs/src/lib/openapi.ts:1-5` — OpenAPI server instance creation
- `apps/docs/scripts/generate-api-docs.ts:21-32` — MDX generation with `generateFiles()`
- `apps/docs/mdx-components.tsx:28,408` — APIPage import and export
- `apps/docs/source.config.ts:33` — `_openapi` schema field
- `apps/docs/source.config.ts:64-69` — API docs source definition
- `apps/docs/src/lib/source.ts:11-25` — API source loader (no openapiPlugin)
- `apps/docs/src/styles/globals.css:4` — CSS preset import
- `apps/docs/package.json:11` — prebuild hook for generation
- `packages/console-openapi/src/registry.ts:21-168` — OpenAPI schema registry
- `fumadocs-openapi/dist/render/renderer.d.ts:49-77` — Renderer interface (13 slots)
- `fumadocs-openapi/dist/server/source-api.d.ts:26-31` — openapiSource signature

## Architecture Documentation

```
┌─────────────────────────────────────────────────────────────────┐
│ Current Flow (v9.6.4 + generateFiles)                           │
│                                                                  │
│ Zod Schemas (@repo/console-types)                               │
│      ↓                                                          │
│ OpenAPI Registry (console-openapi/src/registry.ts)              │
│      ↓                                                          │
│ openapi.json (console-openapi/openapi.json)                     │
│      ↓                                                          │
│ generateFiles() (docs/scripts/generate-api-docs.ts)  [prebuild] │
│      ↓                                                          │
│ MDX Files (docs/src/content/api/endpoints/**/*.mdx)             │
│      ↓                                                          │
│ fumadocs-mdx → .source/index.ts → loader()                     │
│      ↓                                                          │
│ [[...slug]]/page.tsx → MDX → <APIPage> component                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Proposed Flow (v9.6.4 + openapiSource)                          │
│                                                                  │
│ openapi.json (same as above)                                    │
│      ↓                                                          │
│ openapiSource(openapi) → virtual pages with getAPIPageProps()   │
│      ↓                                                          │
│ loader() with openapiPlugin() → page tree with method badges    │
│      ↓                                                          │
│ [[...slug]]/page.tsx → page.data.getAPIPageProps() → <APIPage>  │
│      ↓                                                          │
│ renderer: { Property: Custom, APIInfo: Custom, ... }            │
└─────────────────────────────────────────────────────────────────┘
```

## Open Questions

1. **Version upgrade scope**: Upgrading to v10.x requires fumadocs-core 16.5+ and fumadocs-ui 16.5+ — what's the breaking change surface across the 15.x → 16.x gap?
2. **`openapiSource` with existing MDX content**: The API docs have manually authored pages (getting-started/, sdks-tools/) alongside generated endpoint pages. Using `openapiSource` only generates endpoint pages — the manual MDX would need to remain as a separate source combined via `multiple()`.
3. **CSS preset compatibility**: The `fumadocs-openapi/css/preset.css` import works with the current `fumadocs-ui/css/black.css` theme — would custom renderer components need to replicate these styles?
4. **`defineClientConfig` options**: The fumadocs.dev docs show `defineClientConfig({})` but don't specify what options are available. The v10 type definitions would need to be inspected after upgrade.
5. **Shiki conflict**: The docs app disables fumadocs' built-in Shiki (`rehypeCodeOptions: false`) for custom SSRCodeBlock. The `APIPage` component has its own Shiki-based code highlighting via `shikiOptions` — these may need coordination.

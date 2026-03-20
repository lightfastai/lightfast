# Collapse `apps/docs` into `apps/www` Implementation Plan

## Overview

Move the Lightfast documentation site from the standalone `apps/docs` fumadocs app into
`apps/www` (the marketing site) so `/docs` routes are served natively by www through the
Vercel Microfrontends mesh rather than through a proxy rewrite from `apps/app`.

End state: `apps/docs` is deleted. `apps/app/next.config.ts` no longer has `/docs` rewrite
rules. `apps/app/microfrontends.json` routes `/docs*` to `lightfast-www`. The `lightfast-docs`
Vercel project is decommissioned.

---

## Current State Analysis

```
lightfast.ai/docs/* → apps/app (proxy rewrite) → apps/docs (standalone, port 4105)
lightfast.ai/blog/* → apps/www (microfrontends mesh)
lightfast.ai/*      → apps/app (catch-all)
```

- `apps/docs` is a fully independent Vercel project (`lightfast-docs.vercel.app`)
- Docs routing in `apps/app/next.config.ts:146-167` is a plain Next.js `rewrites()` proxy
- `/docs` is **not** in `apps/app/microfrontends.json` — it falls through to `lightfast-app`
- `apps/www` has no `(docs)` route group, no `mdx-components.tsx`, and no fumadocs deps

---

## Desired End State

```
lightfast.ai/docs/* → apps/www (microfrontends mesh, (docs) route group)
lightfast.ai/blog/* → apps/www (microfrontends mesh, marketing route group)
lightfast.ai/*      → apps/app (catch-all)
```

Verification:
- `pnpm dev:www` → navigating to `/docs/get-started/overview` renders the docs page
- `pnpm dev:www` → marketing pages (`/`, `/blog`, `/pricing`) still render correctly
- No fumadocs CSS leaking onto marketing pages
- `pnpm build:www` completes without errors
- Search (`/api/search`) returns results
- `/docs/api-reference/*` renders OpenAPI virtual pages correctly

---

## What We're NOT Doing

- Changing the fumadocs version or upgading it
- Changing the custom sidebar/TOC architecture (stays `@repo/ui`-based)
- Changing the mixedbread search integration
- Changing MDX content frontmatter schema
- Changing any URL structure under `/docs`
- Migrating the docs to a different framework
- Migrating `apps/www` blog content — that already works

---

## Key Discoveries

- `apps/docs/src/lib/fonts.tsx` and `apps/www/src/lib/fonts.ts` define identical font files from the same `public/fonts/` path — **zero font migration needed**
- `apps/docs/.gitignore:39` already excludes `.source/` — need to add this to `apps/www/.gitignore`
- `apps/docs/source.config.ts:70` disables Shiki via `rehypeCodeOptions: false` — must carry this into www's `source.config.ts` to preserve `SSRCodeBlock` rendering
- `apps/docs/src/app/layout.tsx:27` sets `search.enabled: false` in `<RootProvider>` — must replicate in www's `(docs)` layout
- `apps/docs/src/lib/related-projects.ts` exports `consoleUrl` and `wwwUrl` from `NEXT_PUBLIC_VERCEL_ENV` — when in www, `wwwUrl` can be `"/"` (same app), but `consoleUrl` still needs the env-based URL
- `apps/www/src/styles/globals.css:2` imports `@repo/ui/globals.css` — fumadocs CSS must NOT be added here; only in `(docs)` layout
- Both apps use `@vendor/next/merge-config` config pipeline — need to use `mergeNextConfig` to compose `createMDX()` output correctly in www

---

## Phase 1: Foundation — Proof of Concept

### Overview

Add fumadocs build dependencies to www, set up the bare minimum wiring (`source.config.ts`,
`createMDX()` in `next.config.ts`, `(docs)` route group layout with scoped CSS), and render
a single test MDX page at `/docs/test` to validate the composition stack works.

**Goal**: Confirm `createMDX()` + `withMicrofrontends()` + Turbopack compose correctly without
breaking existing marketing pages.

### Changes Required

#### 1. `apps/www/package.json` — Add fumadocs dependencies

```json
// dependencies (add alongside existing):
"fumadocs-core": "16.6.10",
"fumadocs-ui": "16.6.10",
"fumadocs-mdx": "14.2.9",
"fumadocs-openapi": "^10.3.16",
"@mixedbread/sdk": "^0.46.0",
"@radix-ui/react-popover": "^1.1.14",
"github-slugger": "^2.0.0",
"remove-markdown": "^0.6.3",

// devDependencies (add alongside existing):
"@mixedbread/cli": "^2.3.0",
"@repo/app-openapi": "workspace:*",
"@types/mdx": "^2.0.13",
"tsx": "^4.21.0",

// scripts (add):
"postinstall": "fumadocs-mdx",
"prebuild": "pnpm --filter @repo/app-openapi generate:openapi && tsx scripts/validate-schema-docs.ts",
"search:sync": "mxbai store sync $MXBAI_STORE_ID \"./src/content/**/*.mdx\" --api-key $MXBAI_API_KEY",
"search:sync:ci": "mxbai store sync $MXBAI_STORE_ID \"./src/content/**/*.mdx\" --api-key $MXBAI_API_KEY -y"
```

Run: `pnpm install` from repo root.

#### 2. `apps/www/.gitignore` — Add `.source/`

```
# fumadocs generated
.source
```

#### 3. `apps/www/source.config.ts` — Minimal single-collection config (new file)

```ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const { docs, meta } = defineDocs({ dir: "src/content/docs" });

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: false, // preserve language-* classes for SSRCodeBlock
  },
});
```

#### 4. `apps/www/next.config.ts` — Wrap with `createMDX()`

```ts
// Add import at top:
import { createMDX } from "fumadocs-mdx/next";

// Add before export:
const withMDX = createMDX();

// Change final export from:
export default withMicrofrontends(mergedConfig, { debug: true });
// to:
export default withMicrofrontends(withMDX(mergedConfig), { debug: true });
```

Note: `withMDX` wraps the config object before `withMicrofrontends` wraps the final export.
They operate on orthogonal config keys. Turbopack is compatible (`fumadocs-mdx/next` ships
Turbopack loader support).

#### 5. `apps/www/src/app/(docs)/layout.tsx` — New route group layout with scoped CSS

```tsx
import "fumadocs-ui/style.css"; // MUST be first import in this file
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{ enabled: false }}
      theme={{ forcedTheme: "dark" }}
    >
      {children}
    </RootProvider>
  );
}
```

**CSS scoping rationale**: Next.js App Router's per-segment stylesheet management ensures
`fumadocs-ui/style.css` is only included in `<head>` when a `(docs)` route is active.
`fumadocs-ui/style.css` contains `body { display: flex; flex-direction: column }` which
would break marketing page layouts if imported globally. `forcedTheme: "dark"` prevents
`RootProvider`'s internal `next-themes` ThemeProvider from fighting with www's hardcoded
`dark` class on `<html>`.

#### 6. `apps/www/src/content/docs/test.mdx` — Minimal test page (new file)

```mdx
---
title: Test
description: Test docs page
keywords: [test]
author: lightfast
publishedAt: 2026-03-20
updatedAt: 2026-03-20
---

# Hello from docs in www

This page verifies fumadocs is wired into apps/www correctly.
```

Note: This must include all required frontmatter fields from the Zod schema in `source.config.ts`
(we'll copy the full schema in Phase 2 — for now the minimal set from the base `frontmatterSchema`
is sufficient: `title`, `description`). We'll expand the schema when we move real content.

#### 7. `apps/www/src/lib/docs/source.ts` — Minimal source loader (new file)

```ts
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { docs, meta } from "../../.source/index";

export const docsSource = loader({
  baseUrl: "/docs",
  source: toFumadocsSource(docs, meta),
});
```

#### 8. `apps/www/src/app/(docs)/docs/[[...slug]]/page.tsx` — Minimal test page renderer

```tsx
import { docsSource } from "@/lib/docs/source";
import { notFound } from "next/navigation";

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;
  return (
    <main style={{ padding: "2rem" }}>
      <h1>{page.data.title}</h1>
      <MDX />
    </main>
  );
}
```

This is a bare scaffold — full layout will replace it in Phase 2.

### Success Criteria

#### Automated Verification
- [x] `pnpm install` completes: `pnpm install`
- [x] `fumadocs-mdx` postinstall ran: `ls apps/www/.source/` should show generated files
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck`
- [x] No lint errors: `pnpm --filter @lightfast/www check`

#### Manual Verification
- [x] `pnpm dev:www` starts without errors
- [x] `/docs/test` renders the test page with correct title
- [x] `/` (home), `/blog`, `/pricing` still render correctly — no layout breakage
- [x] Browser DevTools: no fumadocs CSS rules affecting marketing page body styles

**Phase 1 complete.** ✓

#### Implementation Notes
- `source.ts` uses `fumadocs-mdx:collections/server` virtual module (same as docs app), not a relative `.source/index` import. Added `"fumadocs-mdx:collections/*": [".source/*"]` to `apps/www/tsconfig.json`.
- Phase 4 routing changes were pulled forward to enable proxy testing: `/docs` and `/docs/:path*` added to `lightfast-www` routing in `apps/app/microfrontends.json`, and the docs rewrite removed from `apps/app/next.config.ts`.

---

## Phase 2: Components and Content Migration

### Overview

Copy all docs components, content, MDX components, and lib utilities from `apps/docs` into
`apps/www`. Update `source.config.ts` to the full Zod schema with both content collections.
Replace the minimal page scaffolds with the real rendering logic.

### Changes Required

#### 1. Copy content

```bash
cp -r apps/docs/src/content/ apps/www/src/content/
```

Both content trees:
- `src/content/docs/` — 15 MDX files (get-started, features, connectors, integrate)
- `src/content/api/` — 5 MDX files (getting-started, sdks-tools)

#### 2. Copy components

```bash
cp -r apps/docs/src/components/ apps/www/src/components/docs/
```

All 14 component files:
- `alpha-banner.tsx`, `api-endpoint.tsx`, `api-method.tsx`, `api-reference-card.tsx`
- `docs-layout.tsx`, `docs-mobile-nav.tsx`, `docs-sidebar-scroll-area.tsx`, `docs-sidebar.tsx`
- `feature-list.tsx`, `next-steps.tsx`, `search.tsx`, `toc.tsx`, `validation-error.tsx`
- `schema/embedded-operation.tsx`

Update import paths within copied components: replace `@/components/` with `@/components/docs/`
where components reference each other.

#### 3. Copy lib utilities

```bash
cp apps/docs/src/lib/api-page-renderers.tsx apps/www/src/lib/docs/
cp apps/docs/src/lib/api-page.client.tsx apps/www/src/lib/docs/
cp apps/docs/src/lib/api-page.tsx apps/www/src/lib/docs/
cp apps/docs/src/lib/build-api-tree.ts apps/www/src/lib/docs/
cp apps/docs/src/lib/code-samples.ts apps/www/src/lib/docs/
cp apps/docs/src/lib/inline-api-page.tsx apps/www/src/lib/docs/
cp apps/docs/src/lib/openapi.ts apps/www/src/lib/docs/
cp apps/docs/src/lib/source.ts apps/www/src/lib/docs/  # overwrite Phase 1 scaffold
```

Do NOT copy `fonts.tsx` — www already has identical fonts in `src/lib/fonts.ts`.

#### 4. `apps/www/src/lib/docs/related-projects.ts` — New file (adapted from docs)

The original `related-projects.ts` reads `NEXT_PUBLIC_VERCEL_ENV` to construct full URLs.
When in www, `wwwUrl` is the same app, so:

```ts
import { env } from "~/env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;

export const wwwUrl = ""; // same origin — use relative paths

export const consoleUrl =
  vercelEnv === "production"
    ? "https://app.lightfast.ai"
    : vercelEnv === "preview"
      ? "https://app-staging.lightfast.ai"
      : "http://localhost:4107";
```

Update any imports of `related-projects.ts` in copied components to reference this new path.

#### 5. Copy hooks

```bash
cp apps/docs/src/hooks/use-docs-search.ts apps/www/src/hooks/
```

#### 6. `apps/www/mdx-components.tsx` — New file at www root (copied from docs)

Copy `apps/docs/mdx-components.tsx` to `apps/www/mdx-components.tsx`. Update all import paths:
- `~/components/` → `~/components/docs/` for docs-specific components
- `~/lib/` → `~/lib/docs/` for docs lib utilities
- Keep `@repo/ui` imports unchanged

#### 7. `apps/www/source.config.ts` — Full schema with both collections

```ts
import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

const docsSchema = frontmatterSchema.extend({
  keywords: z.array(z.string()),
  author: z.string(),
  publishedAt: z.string(),
  updatedAt: z.string(),
  canonical: z.string().optional(),
  ogImage: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  proficiencyLevel: z
    .enum(["beginner", "intermediate", "advanced"])
    .optional(),
});

export const { docs, meta } = defineDocs({
  dir: "src/content/docs",
  schema: { frontmatter: docsSchema },
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
  dir: "src/content/api",
  schema: { frontmatter: docsSchema },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: false,
  },
});
```

#### 8. `apps/www/src/lib/docs/source.ts` — Full dual-tree loader

Replace Phase 1 scaffold with:

```ts
import { loader } from "fumadocs-core/source";
import { toFumadocsSource, multiple } from "fumadocs-mdx/runtime/server";
import { docs, meta, apiDocs, apiMeta } from "../../.source/index";
import { openapi } from "./openapi";
import type { DocData } from "fumadocs-core/mdx-plugins";
import type { InferPageType } from "fumadocs-core/source";

export const docsSource = loader({
  baseUrl: "/docs",
  source: toFumadocsSource(docs, meta),
});

export const apiSource = loader({
  baseUrl: "/docs/api-reference",
  source: multiple({
    mdx: toFumadocsSource(apiDocs, apiMeta),
    openapi: await openapiSource(openapi, { groupBy: "none", per: "operation" }),
  }),
});

export type ApiPageType = InferPageType<typeof apiSource> & { data: DocData };

export const { getPage, getPages, pageTree } = docsSource;
export const { getPage: getApiPage, getPages: getApiPages, pageTree: apiPageTree } = apiSource;
```

#### 9. `apps/www/src/app/(docs)/docs/(general)/layout.tsx` — Docs shell layout

Copy from `apps/docs/src/app/(docs)/docs/(general)/layout.tsx`.
Update component imports to `@/components/docs/`.
Update lib imports to `@/lib/docs/`.
Remove any `signInUrl` reference that still reads from the old `related-projects.ts` — use
the new www version at `@/lib/docs/related-projects`.

#### 10. `apps/www/src/app/(docs)/docs/(general)/[[...slug]]/page.tsx` — Real renderer

Replace Phase 1 scaffold with full implementation copied from:
`apps/docs/src/app/(docs)/docs/(general)/[[...slug]]/page.tsx`
Update all import paths.

#### 11. `apps/www/src/app/(docs)/docs/(api)/layout.tsx` — API reference shell

Copy from `apps/docs/src/app/(docs)/docs/(api)/layout.tsx`.
Update import paths.

#### 12. `apps/www/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx`

Copy from `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx`.
Update import paths.

#### 13. Delete test content

Remove `apps/www/src/content/docs/test.mdx` (created in Phase 1).

#### 14. `apps/www/src/env.ts` — Add mixedbread env vars

Inspect current `apps/www/src/env.ts` and add:

```ts
// server
MXBAI_API_KEY: z.string().optional(),
MXBAI_STORE_ID: z.string().optional(),
```

#### 15. Copy scripts

```bash
cp apps/docs/scripts/validate-schema-docs.ts apps/www/scripts/
```

### Success Criteria

#### Automated Verification
- [x] `fumadocs-mdx` postinstall regenerates `.source/` with both collections: `ls apps/www/.source/`
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck` (only pre-existing typed-routes errors remain, none introduced by Phase 2)
- [x] No lint errors: `pnpm --filter @lightfast/www check` (no check script in www; lint passes)

#### Manual Verification
- [ ] `pnpm dev:www` starts without errors
- [ ] `/docs/get-started/overview` renders correctly with sidebar, TOC, content
- [ ] `/docs/api-reference/search` renders the OpenAPI reference page
- [ ] Code blocks render with syntax highlighting (SSRCodeBlock)
- [ ] Custom MDX components work: `AlphaBanner`, `ApiEndpoint`, `NextSteps`, etc.
- [ ] Docs sidebar navigation functions (expand/collapse folders)
- [ ] Mobile nav works on small viewport
- [ ] `/` and `/blog` still render correctly — no CSS leakage

**Pause here** for human confirmation before proceeding.

---

## Phase 3: Search Route Migration

### Overview

Copy the mixedbread search API route and verify it works in www's routing context.

### Changes Required

#### 1. `apps/www/src/app/(docs)/api/search/route.ts` — New file ✓ (done in Phase 2)

Copy from `apps/docs/src/app/(docs)/api/search/route.ts`.
Update import paths.
Route will be served at `/api/search` — same URL as before (the docs layout wires the search
hook to this path; `apps/docs` serves it from the same `/api/search` path under the proxy).

#### 2. Copy search hook (already done in Phase 2 step 5)

`apps/www/src/hooks/use-docs-search.ts` is already copied. Verify the `apiUrl` it calls
is `/api/search` (relative, no change needed).

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck` (only pre-existing typed-routes errors, none from Phase 3)

#### Manual Verification
- [ ] Cmd+K or search button opens the search overlay
- [ ] Typing a query returns results from the mixedbread vector store
- [ ] Clicking a result navigates to the correct docs page

**Pause here** for human confirmation.

---

## Phase 4: Routing Cutover

### Overview

Wire docs routes into the Vercel Microfrontends mesh, remove the proxy rewrite from `apps/app`,
and update the `apps/app/microfrontends.json`. After this phase, `/docs` traffic flows through
`lightfast-www` natively, identical to `/blog` routing.

### Changes Required

#### 1. `apps/app/microfrontends.json` — Add `/docs` to `lightfast-www` routing ✓ (done in Phase 1)

In the `"routing"` array for `lightfast-www` (the `"marketing"` group), add:

```json
"/docs",
"/docs/:path*"
```

Place these alongside the other `lightfast-www` routes. Exact position in the array does not
matter; the microfrontends runtime evaluates all entries.

#### 2. `apps/app/next.config.ts:146-167` — Remove `/docs` rewrite block ✓ (done in Phase 1)

Delete these lines entirely:

```ts
const docsUrl =
  vercelEnv === "production" || vercelEnv === "preview" || ...
    ? "https://lightfast-docs.vercel.app"
    : "http://localhost:4105";
return [
  { source: "/docs", destination: `${docsUrl}/docs` },
  { source: "/docs/:path*", destination: `${docsUrl}/docs/:path*` },
];
```

If these are the only entries in the `rewrites()` function, remove the entire `rewrites` key
from the config object. If other rewrites exist alongside them, remove only the docs entries.

#### 3. `apps/docs/next.config.ts:28` — `assetPrefix` is now moot

`assetPrefix: "/docs"` was required only because docs was a separate app proxied by `apps/app`.
This can be removed now, but it will be fully deleted in Phase 5 with the whole app.

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @lightfast/app typecheck`
- [x] No lint errors: `pnpm check` (root-level biome check — passes clean)

#### Manual Verification
- [ ] `pnpm dev:full` starts all services without error
- [ ] Navigating to `/docs/get-started/overview` on port 3024 (microfrontends dev port) renders docs
- [ ] Navigating to `/blog` on port 3024 still renders correctly
- [ ] Browser DevTools Network tab: docs pages served from www port (4101), not docs port (4105)
- [ ] No CORS or asset-loading errors in the console

**Pause here** for human confirmation before final cleanup.

---

## Phase 5: Cleanup — Delete `apps/docs`

### Overview

Remove the standalone docs app and its Vercel project.

### Changes Required

#### 1. Delete `apps/docs/` directory

```bash
rm -rf apps/docs
```

#### 2. `CLAUDE.md` — Remove docs port reference

Remove the `docs(4105)` box from the architecture diagram and the `pnpm dev:docs` command.

#### 3. `turbo.json` — Verify no docs-specific pipeline references

Run `grep -r "docs" turbo.json` to confirm there are no explicit docs task references.
(Research confirmed none exist — tasks are generic.)

#### 4. Root `package.json` — Remove `dev:docs` script

Remove `"dev:docs": "pnpm --filter @lightfast/docs dev"` (or equivalent script name).

#### 5. Vercel — Decommission `lightfast-docs` project

- In the Vercel dashboard, navigate to the `lightfast-docs` project
- Archive or delete the project
- Remove any env vars (MXBAI_API_KEY, MXBAI_STORE_ID) that were only in this project,
  after confirming they've been added to the `lightfast-www` project env vars

#### 6. Copy env vars to `lightfast-www` Vercel project

Before deleting, ensure these env vars exist in `lightfast-www`:
- `MXBAI_API_KEY`
- `MXBAI_STORE_ID`
- Any `NEXT_PUBLIC_VERCEL_*` vars used by docs components

### Success Criteria

#### Automated Verification
- [x] `apps/docs/` directory no longer exists: `ls apps/docs` returns error
- [x] `pnpm install` succeeds with docs removed from workspace: `pnpm install`
- [x] Full build succeeds: `pnpm build:www`
- [x] TypeScript compiles across workspace: `pnpm typecheck` (www passes clean; workspace-level failures are pre-existing cascade from @lightfastai/mcp)

#### Manual Verification
- [x] Production deploy: `/docs/get-started/overview` still resolves correctly
- [x] Production deploy: `/blog` still resolves correctly
- [ ] `lightfast-docs.vercel.app` is either redirected to `lightfast.ai/docs` or returns 404

---

## Testing Strategy

### Phase 1 PoC Test
- Start `pnpm dev:www`, navigate to `/docs/test`, confirm MDX renders
- Check `/` and `/blog` for CSS regression

### Phase 2 Full Render Test
- Smoke test every top-level docs section: get-started, features, connectors, integrate, api-reference
- Test all custom MDX components by finding pages that use them in `src/content/docs/`
- Code block syntax highlighting — find a page with a fenced code block and verify it renders

### Phase 4 Integration Test
- Full `pnpm dev:full` — both app and www running — test docs routes via the microfrontends port
- Confirm assets (JS chunks, CSS) are served correctly with no 404s

---

## Migration Notes

### CSS Isolation
The `(docs)` route group layout at `apps/www/src/app/(docs)/layout.tsx` is the single point
of fumadocs CSS injection. It must be the **only** file that imports `fumadocs-ui/style.css`.
Never import it from `apps/www/src/app/layout.tsx` or `apps/www/src/styles/globals.css`.

### Asset Prefix
`apps/docs/next.config.ts:28` sets `assetPrefix: "/docs"`. This must NOT be copied into
`apps/www/next.config.ts`. When docs is a native www route, assets resolve through the normal
www base URL.

### `.source/` Directory
After `pnpm install`, the `fumadocs-mdx` postinstall script generates `apps/www/.source/`.
This is a build artifact — ensure `apps/www/.gitignore` excludes it (done in Phase 1).

### `next-themes` + Hardcoded Dark
`apps/www/src/app/layout.tsx:148` applies `dark` class to `<html>` statically.
`RootProvider` in the `(docs)` layout uses `next-themes` ThemeProvider which modifies
`document.documentElement.classList` at runtime. Setting `theme={{ forcedTheme: "dark" }}`
on `RootProvider` ensures it doesn't fight with www's hardcoded dark class.

---

## References

- Research document: `thoughts/shared/research/2026-03-20-docs-into-www-collapse.md`
- Current docs routing: `apps/app/next.config.ts:146-167`
- Microfrontends config: `apps/app/microfrontends.json`
- Docs source: `apps/docs/src/lib/source.ts`
- Docs root layout: `apps/docs/src/app/layout.tsx`
- www root layout: `apps/www/src/app/layout.tsx`
- www globals CSS: `apps/www/src/styles/globals.css`

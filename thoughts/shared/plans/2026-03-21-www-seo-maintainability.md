# apps/www — SEO, AEO, and Maintainability Implementation Plan

## Overview

Comprehensive improvement of `apps/www` across four areas:
1. Fix production data bugs (incorrect prices, broken links, broken canonicals)
2. Migrate SEO infrastructure (sitemap, robots, manifest, llms.txt) from `apps/app` → `apps/www` and update microfrontends routing
3. Strengthen the SEO contract (required canonical, consolidated Organization JSON-LD, missing JSON-LD on key pages)
4. Developer maintainability (use-case page template, CTA centralization, footer/nav wiring)

## Source Research

`thoughts/shared/research/2026-03-21-www-maintainability-seo-audit.md`

## Current State Analysis

### Architecture
- `apps/app` (port 4107) is the default catch-all microfrontend. It currently owns `sitemap.ts`, `robots.ts`, `manifest.ts`, `llms.txt`, and `llms-full.txt`.
- `apps/www` (port 4101) handles all marketing + docs routes via `apps/app/microfrontends.json`.
- `apps/app/microfrontends.json` does NOT currently route `/sitemap.xml`, `/robots.txt`, `/manifest.json`, `/llms.txt`, `/llms-full.txt` to `lightfast-www`. These fall through to `lightfast-app`.
- `apps/www/src/app/layout.tsx:80` already references `/manifest.json` but it currently 404s on www in isolation because the manifest is served from `apps/app`.

### Key File Locations

| File | Location |
|---|---|
| `vendor/seo/metadata.ts` | `vendor/seo/metadata.ts` |
| Sitemap | `apps/app/src/app/sitemap.ts` |
| Robots | `apps/app/src/app/robots.ts` |
| Manifest | `apps/app/src/app/manifest.ts` |
| llms.txt | `apps/app/public/llms.txt` |
| llms-full.txt | `apps/app/public/llms-full.txt` |
| Microfrontends config | `apps/app/microfrontends.json` |
| Use-case pages | `apps/www/src/app/(app)/(marketing)/(content)/use-cases/*/page.tsx` (×4) |
| Nav config | `apps/www/src/config/nav.ts` |
| Footer | `apps/www/src/app/(app)/_components/app-footer.tsx` |
| FAQ section | `apps/www/src/app/(app)/_components/faq-section.tsx` |

### Confirmed Bugs

| Bug | File | Line |
|---|---|---|
| Team plan JSON-LD `price: "12"` vs UI `monthlyPrice: 20` | `pricing/page.tsx` | 286, 290 |
| `"PLACEHOLDER_VERIFICATION_CODE"` in Google verification | `layout.tsx` | 39 |
| Docs canonical produces `https://lightfast.ai/docs/docs` | `docs/[[...slug]]/page.tsx` | 189, 226, 277 |
| API-reference canonical produces `https://lightfast.ai/docs/docs/api-reference` | `api-reference/[[...slug]]/page.tsx` | 190, 231, 322 |
| Docs search routes `content/api/` → `/docs/api/` (should be `/docs/api-reference/`) | `docs/api/search/route.ts` | 71–74 |
| Broken link `/docs/integrate/github` (no such page) | `developer-platform-landing.tsx` | 76 |
| Blog topic/category page always renders empty (TODO never implemented) | `blog/(listing)/topic/[category]/page.tsx` | 165–166 |
| Pitch deck publicly indexable (no `robots: { index: false }`) | `pitch-deck/page.tsx` | 4–12 |
| `og.jpg` referenced but does not exist | `search/page.tsx` | 22 |
| `"Contact Sales"` invalid as `schema.org Offer.price` | `pricing/page.tsx` | 295 |
| `SoftwareSourceCode` wrong schema type for blog tech posts | `blog/[slug]/page.tsx` | 171 |

### Confirmed Maintainability Issues

- 4 use-case pages: 62/70 lines byte-for-byte identical, no shared template
- "Join Early Access" + `/early-access` hardcoded in **17 locations across 13 files**
- `AppFooter` ignores `src/config/nav.ts`; has its own hardcoded link arrays; Discord URL `#discord` in nav vs `https://discord.gg/YqPDfcar2C` in footer
- Two conflicting `Organization` JSON-LD entities emitted on homepage simultaneously (layout.tsx + landing page with different `sameAs`, `logo`, `@id`)
- `VERCEL_PROJECT_PRODUCTION_URL` read directly via `process.env` in `vendor/seo/metadata.ts:18`, bypasses `@t3-oss/env-nextjs` validation
- `keywords` in `source.config.ts:11` is `z.string()` not array; requires `split(",")` hack in page component
- FAQ data inline in `faq-section.tsx:12–58`, not separated from the renderer
- `llms.txt` description is stale ("memory layer for software teams")

## Desired End State

- Zero production data bugs (correct prices, valid canonicals, no placeholders)
- SEO infrastructure (`sitemap.xml`, `robots.txt`, `manifest.json`, `llms.txt`) served from `apps/www` and routed through microfrontends
- `canonical` is required in `createMetadata` — compile error if omitted
- `VERCEL_PROJECT_PRODUCTION_URL` validated in `apps/www/src/env.ts`
- Single canonical `Organization` JSON-LD entity with consistent `sameAs`
- Use-case pages reduced from 280 lines across 4 files to ~80 lines via shared template
- `PRIMARY_CTA` centralized in one config file
- `AppFooter` wired to `src/config/nav.ts`

## What We're NOT Doing

- Implementing real API for marketing search (`search-input.tsx`) — requires API design work
- Writing full content for stub connector pages (GitHub, Linear, Vercel, Sentry)
- Adding cURL code samples to API reference — separate task
- Implementing `integrate/index.mdx` content — content work, not code
- Running `pnpm check` or `pnpm typecheck` across the whole monorepo per phase (too slow); instead run per-package

---

## Phase 1: Fix Production Data Bugs

### Overview

Fix all incorrect/missing data that is live in production today. No architectural dependencies — these are isolated file edits.

### 1.1 Fix Pricing JSON-LD Price Mismatch

**File**: `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx`

Fix `softwareSchema` offers array to match UI prices:

```ts
// Line 286: change price: "12" → price: "20"
// Line 290: change "$12 per user/month" → "$20 per user/month"
```

Extract a single source of truth:
```ts
const TEAM_PRICE = 20; // single source for UI + JSON-LD

// pricingPlans (line 156): monthlyPrice: TEAM_PRICE
// softwareSchema offers[1] (line 286): price: String(TEAM_PRICE)
// softwareSchema offers[1].description (line 290): `$${TEAM_PRICE} per user/month`
```

Fix Business plan `Offer.price: "Contact Sales"` (invalid schema.org) at line 295:
```ts
// Change to:
{
  "@type": "Offer",
  name: "Business",
  price: undefined, // omit — no numeric price for contact-sales tier
  priceCurrency: "USD",
  description: "Contact us for enterprise pricing",
  availability: "https://schema.org/InStock",
}
```

### 1.2 Remove Google Verification Placeholder

**File**: `apps/www/src/app/layout.tsx:38–40`

Remove the `verification` block entirely until a real GSC token is available:
```ts
// Remove:
verification: {
  google: "PLACEHOLDER_VERIFICATION_CODE",
},
```

### 1.3 Fix Docs Canonical Double-Path

**File A**: `apps/www/src/app/(docs)/docs/(general)/[[...slug]]/page.tsx`

The root cause is `metadataBase: new URL("https://lightfast.ai/docs")` at line 189, combined with canonical strings that already include `/docs/`.

Fix: change `metadataBase` to `https://lightfast.ai` and remove the redundant `/docs` prefix from canonical strings:
```ts
// Line 189: change metadataBase
metadataBase: new URL("https://lightfast.ai"),

// Line 226: change root canonical
canonical: "https://lightfast.ai/docs",

// Line 232: change root OG url
url: "https://lightfast.ai/docs",

// Line 277: fix individual page canonical (pageUrl already starts with /docs/...)
canonical: `https://lightfast.ai${pageUrl}`,
```

**File B**: `apps/www/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx`

Same fix pattern:
```ts
// Lines 190, 282: change metadataBase
metadataBase: new URL("https://lightfast.ai"),

// Line 231: change root canonical
canonical: "https://lightfast.ai/docs/api-reference",

// Line 237: change root OG url
url: "https://lightfast.ai/docs/api-reference",

// Line 322: fix individual page canonical
canonical: `https://lightfast.ai${pageUrl}`,
```

### 1.4 Fix Docs Search URL Builder

**File**: `apps/www/src/app/(docs)/api/search/route.ts:71–74`

```ts
// Change:
return `/docs/api/${pathPart...}`;
// To:
return `/docs/api-reference/${pathPart...}`;
```

### 1.5 Fix Broken Internal Link

**File**: `apps/www/src/app/(docs)/docs/(general)/[[...slug]]/_components/developer-platform-landing.tsx:76`

```ts
// Change:
href: "/docs/integrate/github",
// To:
href: "/docs/connectors/github",
```

### 1.6 Noindex Pitch Deck

**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/page.tsx`

Add robots noindex to the existing metadata export:
```ts
export const metadata: Metadata = {
  // ...existing fields
  robots: { index: false, follow: false },
};
```

### 1.7 Fix Blog Topic Page

**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/topic/[category]/page.tsx`

The page always renders empty. Add `redirect("/blog")` to the page component body and **remove `generateStaticParams`**:

```ts
import { redirect } from "next/navigation";

// Remove generateStaticParams entirely — do NOT keep it alongside redirect()
// Keeping generateStaticParams + unconditional redirect() causes Next.js to
// propagate a dynamic rendering signal up through the (listing) layout group,
// breaking SSG for /blog, /blog/[slug], and /changelog.

export default async function CategoryPage({ params: _params }: Props) {
  redirect("/blog");
}
```

Keep `generateMetadata` — the per-category metadata is worth preserving for when category filtering is implemented. The page renders dynamically (SSR) which is fine for a redirect route. `generateStaticParams` can be re-added when real content is available.

> **SSG Regression Note**: The initial Phase 1 implementation kept `generateStaticParams` alongside the unconditional `redirect()`. This caused Next.js to attempt static pre-rendering of each category slug at build time, immediately throw a RedirectError, and propagate a dynamic server usage signal up the shared `(listing)` layout — losing SSG for all blog listing and changelog pages. Fix: remove `generateStaticParams`.

### 1.8 Fix search/page.tsx Nonexistent OG Image

**File**: `apps/www/src/app/(app)/(search)/search/page.tsx:22`

Remove the hardcoded `og.jpg` reference that 404s:
```ts
// Remove:
images: ["https://lightfast.ai/og.jpg"]
// Let Next.js fall back to root layout's OG image
```

### 1.9 Fix SoftwareSourceCode Schema on Blog Posts

**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx:171`

Change the wrong schema type for technology posts:
```ts
// Change:
"@type": "SoftwareSourceCode",
codeRepository: "https://github.com/lightfastai",
// To:
"@type": "TechArticle",
// Remove codeRepository — it's not applicable to articles
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [ ] `pnpm --filter @lightfast/www check` passes

#### Manual Verification
- [ ] `https://lightfast.ai/pricing` — rich results test (schema.org) shows `price: "20"`, no `"Contact Sales"` as numeric price
- [ ] `https://lightfast.ai/docs` — canonical in page source is `https://lightfast.ai/docs` (not `…/docs/docs`)
- [ ] `https://lightfast.ai/docs/api-reference` — canonical is `https://lightfast.ai/docs/api-reference`
- [ ] `https://lightfast.ai/docs` → click "Integrate → GitHub" guide card → navigates to `/docs/connectors/github` (not 404)
- [ ] `https://lightfast.ai/pitch-deck` → view source confirms `<meta name="robots" content="noindex">`
- [ ] `https://lightfast.ai/blog/topic/technology` → redirects to `/blog`
- [ ] Docs search for "authentication" → deep link routes to `/docs/api-reference/...` not `/docs/api/...`

---

## Phase 2: SEO Infrastructure Migration (apps/app → apps/www)

### Overview

Move `sitemap.ts`, `robots.ts`, `manifest.ts`, `llms.txt`, and `llms-full.txt` from `apps/app` to `apps/www`. Update `apps/app/microfrontends.json` to route these paths through `lightfast-www`. Delete source files from `apps/app` once confirmed.

This resolves `apps/www/layout.tsx:80`'s reference to `/manifest.json` that currently 404s on www in isolation.

### 2.1 Copy sitemap.ts to apps/www

**File to create**: `apps/www/src/app/sitemap.ts`

Copy the entire `apps/app/src/app/sitemap.ts` verbatim. The file uses `@vendor/cms` which is available in `apps/www`. No changes needed to content.

Verify `apps/www/package.json` includes `@vendor/cms` as a dependency (it should, since blog/changelog pages already use it).

### 2.2 Copy robots.ts to apps/www

**File to create**: `apps/www/src/app/robots.ts`

Copy from `apps/app/src/app/robots.ts`. Update the env import:

```ts
// Change:
import { env } from "~/env";
// To:
import { env } from "~/env";
// (same path — both apps use ~/env alias; verify apps/www/src/env.ts exports NEXT_PUBLIC_VERCEL_ENV)
```

`apps/www/src/env.ts:50` already validates `NEXT_PUBLIC_VERCEL_ENV` — no changes to env.ts needed for robots.

### 2.3 Copy manifest.ts to apps/www

**File to create**: `apps/www/src/app/manifest.ts`

Copy from `apps/app/src/app/manifest.ts` verbatim. The icon paths (`/favicon.ico`, etc.) are already routed through `lightfast-www` in `microfrontends.json`.

### 2.4 Update llms.txt Description

**File to create**: `apps/www/public/llms.txt`

Copy from `apps/app/public/llms.txt` with updated product description (the current copy still says "memory layer for software teams" — the product is now "the operating layer for agents and apps"):

```txt
# llms.txt for https://lightfast.ai

> Full page content in markdown format: https://lightfast.ai/llms-full.txt

## What is Lightfast?
Lightfast is the operating layer for AI agents and engineering teams. Agents and developers use
Lightfast to observe events, build semantic memory, and act across their entire tool stack —
giving AI systems persistent, source-cited knowledge of everything that happens across code,
deployments, incidents, and decisions.

## What Questions This Site Can Answer
[keep remaining sections as-is from apps/app/public/llms.txt, updating use cases section below]

## Use Cases
- Give AI agents persistent memory of your entire codebase and toolchain
- Search across code, PRs, issues, and discussions from GitHub
- Track feature specs and bugs from Linear
- Trace errors and incidents from Sentry through to the causal deploy and PR
- Build custom agent tools with the Lightfast API and MCP server
```

### 2.5 Copy llms-full.txt to apps/www

**File to copy**: `apps/www/public/llms-full.txt`

Copy `apps/app/public/llms-full.txt` verbatim to `apps/www/public/llms-full.txt`. Review and update stale product descriptions if any.

### 2.6 Update microfrontends.json

**File**: `apps/app/microfrontends.json`

Add these paths to the `lightfast-www` routing group:

```json
{
  "group": "marketing",
  "paths": [
    // ...existing paths...
    "/sitemap.xml",
    "/robots.txt",
    "/manifest.json",
    "/llms.txt",
    "/llms-full.txt"
  ]
}
```

### 2.7 Delete Source Files from apps/app

After confirming all five routes serve correctly from `apps/www`:

- Delete `apps/app/src/app/sitemap.ts`
- Delete `apps/app/src/app/robots.ts`
- Delete `apps/app/src/app/manifest.ts`
- Delete `apps/app/public/llms.txt`
- Delete `apps/app/public/llms-full.txt`

**Do not delete until manual verification in 2.8 passes.**

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [ ] `pnpm --filter @lightfast/app typecheck` passes after deletions
- [x] `pnpm --filter @lightfast/www check` passes

#### Manual Verification
- [ ] `http://localhost:3024/sitemap.xml` returns a valid XML sitemap (served by www via microfrontends)
- [ ] `http://localhost:3024/robots.txt` returns correct robots rules
- [ ] `http://localhost:3024/manifest.json` returns the manifest JSON
- [ ] `http://localhost:3024/llms.txt` returns the updated LLM guidance text
- [ ] `http://localhost:3024/llms-full.txt` returns the full content file
- [ ] Running `pnpm dev:www` alone (port 4101): `http://localhost:4101/sitemap.xml` returns sitemap (confirms www serves it independently)

**Implementation Note**: Pause after manual verification before deleting source files from `apps/app`.

---

## Phase 3: Strengthen SEO Contract

### Overview

Make `canonical` required in `createMetadata`, add `VERCEL_PROJECT_PRODUCTION_URL` to env validation, consolidate Organization JSON-LD, and enrich blog post metadata.

### 3.1 Add VERCEL_PROJECT_PRODUCTION_URL to apps/www env.ts

**File**: `apps/www/src/env.ts`

Add to `server` block:
```ts
VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
```

Add to `runtimeEnv`:
```ts
VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
```

Then update `vendor/seo/metadata.ts:18` to read from the validated env object instead of raw `process.env`. Since `vendor/seo/metadata.ts` is a shared vendor package, it reads from `process.env` directly. The right fix is to add a guard:

```ts
// vendor/seo/metadata.ts:17-19 — add fallback guard
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
if (!productionUrl && process.env.NODE_ENV === "production") {
  console.warn("[seo] VERCEL_PROJECT_PRODUCTION_URL is not set — metadataBase will be undefined");
}
```

The full env-schema validation belongs in the consuming app (`apps/www/src/env.ts`) so it's caught at build time.

### 3.2 Make canonical Required in MetadataGenerator

**File**: `vendor/seo/metadata.ts:4–8`

Change the type to require `canonical`:

```ts
type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  canonical: string;      // ADD: required — prevents duplicate content signals
  image?: string;
  keywords?: string[];    // ADD: typed as array (callers pass arrays, not CSV)
};
```

Update `createMetadata` function signature and body to accept and apply `canonical`:

```ts
export const createMetadata = ({
  title,
  description,
  canonical,
  image,
  keywords,
  ...properties
}: MetadataGenerator): Metadata => {
  const defaultMetadata: Metadata = {
    // ...existing defaults...
    robots: { index: true, follow: true },  // ADD: explicit default
    alternates: {
      canonical,  // ADD: always set canonical from required param
    },
    ...(keywords && { keywords }),  // ADD: pass through keywords array
  };
  // ...rest of function unchanged
};
```

**Impact**: All callers of `createMetadata` that don't pass `canonical` will get a TypeScript compile error. They all need to be updated. Current callers that already pass `canonical` (docs pages, some marketing pages) will continue to work.

### 3.3 Migrate Callers to Pass canonical

Pages that call `createMetadata` without `canonical` (need updating):
- `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx` — add `canonical: "https://lightfast.ai/pricing"`
- `apps/www/src/app/(app)/(marketing)/(content)/use-cases/agent-builders/page.tsx` — already passes `alternates.canonical` as spread; update to use new `canonical` param
- `apps/www/src/app/(app)/(marketing)/(content)/use-cases/engineering-leaders/page.tsx` — same
- `apps/www/src/app/(app)/(marketing)/(content)/use-cases/platform-engineers/page.tsx` — same
- `apps/www/src/app/(app)/(marketing)/(content)/use-cases/technical-founders/page.tsx` — same
- `apps/www/src/app/layout.tsx` — add `canonical: "https://lightfast.ai"`
- `apps/www/src/app/(app)/(search)/search/page.tsx` — add `canonical: "https://lightfast.ai/search"`

Pages that bypass `createMetadata` entirely (raw metadata objects) — migrate to use `createMetadata`:
- `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx` — add `canonical: "https://lightfast.ai"` and route through `createMetadata`
- `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx` — add `canonical: "https://lightfast.ai/blog"`
- `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx` — add `canonical: "https://lightfast.ai/changelog"`
- `apps/www/src/app/(app)/(marketing)/legal/[slug]/page.tsx` — add `canonical: \`https://lightfast.ai/legal/${slug}\``

### 3.4 Consolidate Organization JSON-LD

**File A**: `apps/www/src/app/layout.tsx:108–119`

Remove the `Organization` JSON-LD injection from the root layout entirely. The `WebSite` schema (lines 121–134) should remain — it's not duplicated:

```ts
// In the <head> section, keep only the WebSite JsonLd:
<JsonLd code={websiteSchema} />
// Remove: <JsonLd code={organizationSchema} />
```

**File B**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:117–133`

Update the canonical Organization entity to merge the missing fields from the removed layout version:

```ts
{
  "@type": "Organization",
  "@id": "https://lightfast.ai/#organization",  // keep @id
  name: "Lightfast",
  url: "https://lightfast.ai",
  logo: {                                        // keep ImageObject (correct type)
    "@type": "ImageObject",
    url: "https://lightfast.ai/android-chrome-512x512.png",
  },
  sameAs: [
    "https://x.com/lightfastai",               // use x.com (consistent with layout version)
    "https://twitter.com/lightfastai",          // keep twitter.com alias for compatibility
    "https://github.com/lightfastai",
    "https://www.linkedin.com/company/lightfastai",
    "https://discord.gg/YqPDfcar2C",           // ADD: from layout version (was missing)
  ],
  description: "...",  // keep existing
}
```

### 3.5 Enrich Blog Post Metadata

**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`

In `generateMetadata`, add missing fields:

```ts
// Add to the returned metadata object:
keywords: post.categories?.map((c) => c._title).filter(Boolean) ?? [],
robots: { index: true, follow: true },
category: post.categories?.[0]?._title ?? "Technology",
openGraph: {
  // ...existing openGraph fields...
  images: post.featuredImage?.url
    ? [{ url: post.featuredImage.url, width: 1200, height: 630 }]
    : undefined,
},
twitter: {
  // ...existing twitter fields...
  images: post.featuredImage?.url ? [post.featuredImage.url] : undefined,
},
```

Also fix the early-exit error paths (lines 47–49 and 51–53) that return bare `{}`:
```ts
// Add title fallback so error paths don't return empty metadata:
if (!post) {
  return { title: "Post Not Found | Lightfast" };
}
```

### 3.6 Standardize keywords as Array in source.config.ts

**File**: `apps/www/source.config.ts:11`

Change from `z.string().min(1)` to a union that accepts both existing CSV strings and native YAML arrays:

```ts
keywords: z.union([
  z.array(z.string().min(1)).min(1),
  z.string().min(1).transform((s) => s.split(",").map((k) => k.trim()).filter(Boolean)),
]),
```

Remove the `split(",").map()` in the page component that this unblocks (in `docs/[[...slug]]/page.tsx` around line 273–275).

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter @lightfast/www typecheck` passes — confirms all `createMetadata` callers now pass `canonical`
- [ ] `pnpm --filter @lightfast/www check` passes

#### Manual Verification
- [ ] Homepage source: only one `Organization` JSON-LD block (not two)
- [ ] `/pricing` source: canonical tag is `https://lightfast.ai/pricing`
- [ ] `/blog/[any-post]` source: contains `keywords`, `robots`, and OG image if post has featured image
- [ ] Docs keywords field in MDX frontmatter: both array format and CSV format parse correctly

---

## Phase 4: Missing JSON-LD on High-Intent Pages

### Overview

Add structured data to the 4 use-case pages (highest-intent pages with zero JSON-LD), the changelog listing, and add `keywords` to pages that still lack them.

### 4.1 Add JSON-LD to Use-Case Pages

Each of the 4 use-case pages should add a `Service` + `ItemList` schema. Since Phase 5 will create a `UseCasePageContent` shared component, add the JSON-LD in that component (or wait until Phase 5 and add it there). If implementing Phase 4 before Phase 5, add it inline to each page and extract to the template in Phase 5.

Pattern for each page:
```ts
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: `Lightfast for ${audienceName}`,
      provider: { "@id": "https://lightfast.ai/#organization" },
      description: pageDescription,
      url: `https://lightfast.ai/use-cases/${slug}`,
    },
    {
      "@type": "ItemList",
      name: `${audienceName} Use Cases`,
      numberOfItems: useCaseItems.length,
      itemListElement: useCaseItems.map((uc, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: uc.title,
        description: uc.description,
      })),
    },
  ],
};
```

Add `<JsonLd code={structuredData} />` in the page JSX.

Add `keywords` to each use-case page's `createMetadata` call:
```ts
keywords: ["AI agent platform", "operating layer", "engineering intelligence", audienceKeyword],
```

### 4.2 Add JSON-LD to Changelog Listing

**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx`

Add a `SoftwareApplication` + `ItemList` schema:
```ts
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://lightfast.ai/#app",
      name: "Lightfast",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
    },
    {
      "@type": "ItemList",
      name: "Lightfast Changelog",
      description: "Product updates and new features",
      url: "https://lightfast.ai/changelog",
      // entries from CMS props if available, otherwise static
    },
  ],
};
```

Add `keywords` to changelog `createMetadata`:
```ts
keywords: ["changelog", "product updates", "release notes", "Lightfast updates"],
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter @lightfast/www typecheck` passes
- [ ] `pnpm --filter @lightfast/www check` passes

#### Manual Verification
- [ ] `https://lightfast.ai/use-cases/agent-builders` — Google Rich Results Test shows `Service` and `ItemList` schemas
- [ ] `https://lightfast.ai/changelog` — page source contains `SoftwareApplication` JSON-LD

---

## Phase 5: Developer Maintainability

### Overview

Reduce code duplication (use-case pages, CTA references) and wire the footer to the nav config. These are refactors with no user-facing behavior changes.

### 5.1 Create UseCasePageContent Shared Component

**File to create**: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/_components/use-case-page.tsx`

```tsx
import type { UseCaseItem } from "~/app/(app)/_components/use-case-grid";
import { UseCaseGrid } from "~/app/(app)/_components/use-case-grid";
import { Button } from "@repo/ui/components/button";
import { MicrofrontendLink } from "~/components/microfrontend-link";
import { ArrowRight } from "lucide-react";
import { PRIMARY_CTA } from "~/config/cta";  // from Phase 5.3

interface UseCasePageProps {
  title: string;
  description: string;
  items: UseCaseItem[];
  structuredData: object;  // JSON-LD varies per page
}

export function UseCasePageContent({ title, description, items, structuredData }: UseCasePageProps) {
  return (
    // shared JSX extracted from the 4 identical page files
    // includes the CTA buttons, grid wrapper, and JSON-LD injection
  );
}
```

**File to create**: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/_lib/use-case-metadata.ts`

```ts
import { createMetadata } from "@vendor/seo/metadata";

export function buildUseCaseMetadata(
  slug: string,
  title: string,
  description: string,
  ogTitle: string,
  ogDescription: string,
  audienceKeyword: string,
) {
  return createMetadata({
    title,
    description,
    canonical: `https://lightfast.ai/use-cases/${slug}`,
    keywords: ["AI agent platform", "operating layer", "engineering intelligence", audienceKeyword],
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: `https://lightfast.ai/use-cases/${slug}`,
      type: "website",
    },
  });
}
```

Each page becomes ~15 lines:
```ts
// agent-builders/page.tsx
export const metadata = buildUseCaseMetadata(
  "agent-builders",
  "Lightfast for Agent Builders – Build on the Operating Layer",
  "Give your agents a single system...",
  "Lightfast for Agent Builders",
  "Give your agents a single system...",
  "AI agent builders",
);

export default function AgentBuildersPage() {
  return (
    <UseCasePageContent
      title="Agent Builders"
      description="Build AI systems that predict, prevent, and optimize..."
      items={agentBuildersUseCases}
      structuredData={buildUseCaseStructuredData("agent-builders", "Agent Builders", agentBuildersUseCases)}
    />
  );
}
```

### 5.2 Move FAQ Data to Separate File

**File to create**: `apps/www/src/content/faq.ts`

```ts
// Move the `faqs` array from faq-section.tsx:12–58 to here
export const faqs = [
  // ...all 9 FAQ items
];
```

Update `faq-section.tsx` to import from `~/content/faq`:
```ts
import { faqs } from "~/content/faq";
```

The `landing/page.tsx` import of `{ faqs }` from `faq-section.tsx` must also be updated to import from `~/content/faq`.

### 5.3 Centralize PRIMARY_CTA Config

**File to create**: `apps/www/src/config/cta.ts`

```ts
export const PRIMARY_CTA = {
  label: "Join Early Access",
  href: "/early-access",
} as const;
```

Update all 13 files that hardcode these values. The components that are already centralized (`waitlist-cta.tsx`) should import from here. The use-case pages will be handled by the `UseCasePageContent` template from Phase 5.1.

Priority call sites to update:
- `app-navbar.tsx` — replace hardcoded `href="/early-access"` + text
- `app-mobile-nav.tsx` — same
- `app-footer.tsx` — same
- `faq-section.tsx` — same (the CTA in the FAQ section)
- `waitlist-cta.tsx` — same (the centralized CTA component)
- `(landing)/page.tsx` — the hero CTA
- All 4 use-case pages — handled by `UseCasePageContent` template (Phase 5.1)

### 5.4 Wire AppFooter to nav.ts

**File**: `apps/www/src/app/(app)/_components/app-footer.tsx`

The footer currently has its own hardcoded link arrays. Update to:

1. Add a `FOOTER_NAV` export to `src/config/nav.ts` with footer-specific groupings (Product, Resources, Company)
2. Fix Discord URL in `nav.ts` from `"#discord"` to `"https://discord.gg/YqPDfcar2C"` (use the real URL consistently)
3. Import `FOOTER_NAV`, `SOCIAL_NAV` in `AppFooter` and replace hardcoded arrays

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter @lightfast/www typecheck` passes
- [ ] `pnpm --filter @lightfast/www check` passes

#### Manual Verification
- [ ] All 4 use-case pages render identically to before (no visual regressions)
- [ ] Footer renders all the same links as before, now sourced from nav.ts
- [ ] Discord link in footer works (navigates to real Discord invite)
- [ ] "Join Early Access" CTA still appears everywhere it should

---

## Testing Strategy

### Per-Phase Type Checking
Run after each phase:
```bash
pnpm --filter @lightfast/www typecheck
pnpm --filter @lightfast/www check
```

### Full Dev Server Test
After Phase 2 (SEO infrastructure migration):
```bash
pnpm dev:full  # port 3024
```
Then verify `/sitemap.xml`, `/robots.txt`, `/manifest.json`, `/llms.txt` all return correct responses.

### Rich Results Testing
After Phase 4 (JSON-LD additions):
- Use Google's Rich Results Test on `/pricing`, `/use-cases/agent-builders`, `/changelog`
- Verify no schema errors

---

## Migration Notes

- **Phase 2 deletion order**: Add files to `apps/www` and update `microfrontends.json` first. Verify manually. Then delete from `apps/app`. Never delete before confirming the routes serve correctly.
- **Phase 3 canonical requirement**: The TypeScript compile error is intentional — it forces all callers to add canonical. Work through all type errors systematically. There should be ~12 callers total.
- **Phase 5 refactoring**: The 4 use-case pages import different data arrays (`agentBuildersUseCases`, etc.). Keep those imports in each page file even after extracting the template.

---

## Phase 6: Generalized Page Discovery Engine

### Overview

Replace the hardcoded section classification, CMS-specific queries, and manual sitemap entries with a unified `discoverPages()` function. Both `sitemap.ts` and `llms.txt/route.ts` consume this single function. Adding a new `page.tsx` anywhere in the app requires zero changes to SEO files. New route groups automatically create new sections in llms.txt. New CMS collections require a single array entry.

Also:
- `site-identity.ts` — centralizes `BASE_URL`, `SITE_DESCRIPTION`, and `CONTACT_INFO` (currently hardcoded in 6+ locations)
- `cms-collections.ts` — simple registry for CMS dynamic pages (the only config point for dynamic routes)
- Dynamic `llms-full.txt` route handler replacing the static `public/` file

**Prerequisite**: Phase 2 (SEO infrastructure migration) must be complete — llms.txt route handler must exist in `apps/www`.

---

### 6.1 Create `(seo)/_lib/types.ts`

**File to create**: `apps/www/src/app/(seo)/_lib/types.ts`

```typescript
export interface DiscoveredPage {
  url: string;
  title: string;
  description: string;
  section: string;       // derived from URL path first segment
  priority: number;      // derived from URL depth
  lastModified?: Date;
  noIndex?: boolean;
}
```

---

### 6.2 Create `(seo)/_lib/site-identity.ts`

**File to create**: `apps/www/src/app/(seo)/_lib/site-identity.ts`

Centralizes what is currently hardcoded in `llms.txt/route.ts:19,191–253`, `sitemap.ts:97`, and other locations.

```typescript
import type { MetadataRoute } from "next";

export const BASE_URL = "https://lightfast.ai";
export const SITE_NAME = "Lightfast";
export const SITE_DESCRIPTION =
  "The operating layer for AI agents and engineering teams. Agents and developers use Lightfast to observe events, build semantic memory, and act across their entire tool stack — giving AI systems persistent, source-cited knowledge of everything that happens across code, deployments, incidents, and decisions.";

export const CONTACT_INFO = {
  email: "hello@lightfast.ai",
  founder: "Jeevan Pillay — jp@lightfast.ai — https://twitter.com/jeevanpillay",
  support: "support@lightfast.ai",
  twitter: "https://twitter.com/lightfastai",
  discord: "https://discord.gg/YqPDfcar2C",
  githubOrg: "https://github.com/lightfastai",
  githubSdk: "https://github.com/lightfastai/lightfast",
  npmSdk: "https://www.npmjs.com/package/lightfast",
  npmMcp: "https://www.npmjs.com/package/@lightfastai/mcp",
};

// Pages that cannot be auto-discovered from build output:
// route handlers (rss.xml etc.) and cross-app routes (sign-in/sign-up from apps/app).
export const STATIC_SITEMAP_ENTRIES: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/blog/rss.xml`, changeFrequency: "daily", priority: 0.6 },
  { url: `${BASE_URL}/blog/atom.xml`, changeFrequency: "daily", priority: 0.6 },
  { url: `${BASE_URL}/blog/feed.xml`, changeFrequency: "daily", priority: 0.6 },
  { url: `${BASE_URL}/changelog/rss.xml`, changeFrequency: "daily", priority: 0.6 },
  { url: `${BASE_URL}/changelog/atom.xml`, changeFrequency: "daily", priority: 0.6 },
  { url: `${BASE_URL}/changelog/feed.xml`, changeFrequency: "daily", priority: 0.6 },
  { url: `${BASE_URL}/sign-in`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${BASE_URL}/sign-up`, changeFrequency: "yearly", priority: 0.3 },
];
```

---

### 6.3 Create `(seo)/_lib/cms-collections.ts`

**File to create**: `apps/www/src/app/(seo)/_lib/cms-collections.ts`

This is the **only config point** for CMS-backed dynamic routes. Static pages need zero configuration — they're discovered automatically from the build output. Adding a new CMS collection = one object in this array.

```typescript
import { blog, changelog, legal } from "@vendor/cms";
import type { DiscoveredPage } from "./types";
import { BASE_URL } from "./site-identity";

export interface CmsItem {
  slug: string;
  title: string;
  description?: string;
  lastModified?: string;
  noIndex?: boolean;
}

export interface CmsCollection {
  fetch: () => Promise<CmsItem[]>;
  urlPrefix: string;  // e.g. "/blog/"
  section: string;    // e.g. "Blog" — used when page is not yet in build output
}

// To add a new CMS collection: add one entry here.
// Static pages need no entry — they are discovered automatically from build HTML.
export const CMS_COLLECTIONS: CmsCollection[] = [
  {
    fetch: async () => {
      const posts = await blog.getPosts();
      return posts
        .filter((p) => !!(p.slug ?? p._slug))
        .map((p) => ({
          slug: p.slug ?? p._slug ?? "",
          title: p._title ?? "",
          description: p.description ?? "",
          lastModified:
            p._sys?.lastModifiedAt ??
            p.publishedAt ??
            p._sys?.createdAt ??
            undefined,
        }));
    },
    urlPrefix: "/blog/",
    section: "Blog",
  },
  {
    fetch: async () => {
      const entries = await changelog.getEntries();
      return entries
        .filter((e) => !!e.slug)
        .map((e) => ({
          slug: e.slug ?? "",
          title: e._title ?? "",
          description: e.excerpt ?? e.tldr ?? "",
          lastModified:
            e._sys?.lastModifiedAt ??
            e.publishedAt ??
            e._sys?.createdAt ??
            undefined,
        }));
    },
    urlPrefix: "/changelog/",
    section: "Changelog",
  },
  {
    fetch: async () => {
      const pages = await legal.getPosts();
      return pages
        .filter((p) => !!p._slug)
        .map((p) => ({
          slug: p._slug ?? "",
          title: p._title ?? "",
          description: p.description ?? "",
          lastModified:
            p._sys?.lastModifiedAt ?? p._sys?.createdAt ?? undefined,
        }));
    },
    urlPrefix: "/legal/",
    section: "Legal",
  },
];
```

---

### 6.4 Create `(seo)/_lib/discover-pages.ts`

**File to create**: `apps/www/src/app/(seo)/_lib/discover-pages.ts`

The core engine. Key behaviors:
- Walks `.next/server/app/` HTML files (same approach as current llms.txt — proven to work)
- Extracts canonical URL, title, description, and robots `noindex` from each file
- **Derives section** from the canonical URL's first path segment, title-cased. Special case: `docs/api-reference` → `"API Reference"` (two-segment prefix check)
- **Derives priority** from URL depth: `depth 0` → 1.0, `depth 1` → 0.8, `depth 2` → 0.7, `depth 3+` → `max(0.5, 0.8 - depth * 0.1)`
- Queries `CMS_COLLECTIONS` for dynamic pages not yet in build output (build-order safety — same pattern as current code)
- Deduplicates by URL (CMS pages already in build output are skipped)
- Respects page-level `noIndex` from the robots meta tag

```typescript
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { BASE_URL } from "./site-identity";
import { CMS_COLLECTIONS } from "./cms-collections";
import type { DiscoveredPage } from "./types";

const NEXT_APP_DIR = join(process.cwd(), ".next", "server", "app");

const SKIP_FILE = [
  /_not-found/,
  /_global-error/,
  /opengraph-image/,
  /twitter-image/,
];

const SKIP_URL = [
  /\/search(\b|\/)/,
  /\/pitch-deck/,
  /\/llms/,
  /\/sitemap/,
  /\/robots/,
  /\/rss\.xml/,
  /\/atom\.xml/,
  /\/feed\.xml/,
  /\[/, // unresolved dynamic segments
];

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

function extractMeta(html: string): {
  title?: string;
  description?: string;
  canonical?: string;
  noIndex?: boolean;
} {
  const rawTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const title = rawTitle
    ? decodeHtmlEntities(rawTitle)
        .replace(/\s*\|\s*Lightfast\s*$/, "")
        .trim()
    : undefined;

  const rawDesc =
    html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+name="description"/i)?.[1];
  const description = rawDesc ? decodeHtmlEntities(rawDesc) : undefined;

  const canonical =
    html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ??
    html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)?.[1];

  // Respect page-level robots noindex (e.g. changelog entries with seo.noIndex)
  const robotsMeta =
    html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+name="robots"/i)?.[1];
  const noIndex = robotsMeta ? /noindex/i.test(robotsMeta) : false;

  return { title, description, canonical, noIndex };
}

export function deriveSection(url: string): string {
  const path = new URL(url).pathname;
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) return "Overview";

  const first = segments[0];

  // Two-segment prefix: docs/api-reference is its own section
  if (first === "docs" && segments[1] === "api-reference") return "API Reference";

  // Title-case hyphenated first segment: "use-cases" → "Use Cases"
  return first
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function derivePriority(url: string): number {
  const path = new URL(url).pathname;
  const depth = path.split("/").filter(Boolean).length;
  if (depth === 0) return 1.0;
  if (depth === 1) return 0.8;
  if (depth === 2) return 0.7;
  return Math.max(0.5, 0.8 - depth * 0.1);
}

async function* walkHtml(dir: string): AsyncGenerator<string> {
  if (!existsSync(dir)) return;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(full);
    else if (entry.name.endsWith(".html")) yield full;
  }
}

async function collectBuildPages(): Promise<DiscoveredPage[]> {
  const pages: DiscoveredPage[] = [];

  for await (const filePath of walkHtml(NEXT_APP_DIR)) {
    const rel = relative(NEXT_APP_DIR, filePath);
    if (SKIP_FILE.some((p) => p.test(rel))) continue;

    try {
      const html = await readFile(filePath, "utf8");
      const { title, description, canonical, noIndex } = extractMeta(html);
      if (!canonical || !title) continue;
      if (SKIP_URL.some((p) => p.test(canonical))) continue;
      if (noIndex) continue;

      pages.push({
        url: canonical,
        title,
        description: description ?? "",
        section: deriveSection(canonical),
        priority: derivePriority(canonical),
        noIndex: false,
      });
    } catch {
      // skip unreadable files
    }
  }

  return pages;
}

async function collectCmsPages(existingUrls: Set<string>): Promise<DiscoveredPage[]> {
  const pages: DiscoveredPage[] = [];

  await Promise.all(
    CMS_COLLECTIONS.map(async (collection) => {
      try {
        const items = await collection.fetch();
        for (const item of items) {
          if (!item.slug) continue;
          const url = `${BASE_URL}${collection.urlPrefix}${item.slug}`;
          if (existingUrls.has(url)) continue; // already captured from build output
          if (item.noIndex) continue;

          pages.push({
            url,
            title: item.title,
            description: item.description ?? "",
            section: collection.section,
            priority: derivePriority(url),
            lastModified: item.lastModified ? new Date(item.lastModified) : undefined,
            noIndex: false,
          });
        }
      } catch {
        // skip failed collections gracefully
      }
    })
  );

  return pages;
}

export async function discoverPages(): Promise<DiscoveredPage[]> {
  const buildPages = await collectBuildPages();
  const buildUrls = new Set(buildPages.map((p) => p.url));
  const cmsPages = await collectCmsPages(buildUrls);
  return [...buildPages, ...cmsPages];
}
```

---

### 6.5 Refactor `llms.txt/route.ts`

**File to update**: `apps/www/src/app/(seo)/llms.txt/route.ts`

Replace the entire file. The new version:
- Calls `discoverPages()` for all page data
- Groups by section, sorts sections **alphabetically** (user preference), sorts pages within sections by URL
- Sources all identity strings from `site-identity.ts`
- Removes `sectionOf()`, `collectStaticPages()`, `collectCmsPages()`, `decodeHtmlEntities()`, `extractMeta()`, `walkHtml()` — all moved to `discover-pages.ts`

```typescript
import { discoverPages } from "../_lib/discover-pages";
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  CONTACT_INFO,
  BASE_URL,
} from "../_lib/site-identity";

export const revalidate = false;

export async function GET() {
  const pages = await discoverPages();

  // Home is always first, sourced from site-identity
  const HOME = {
    url: BASE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    section: "Overview",
    priority: 1.0,
  };

  const allPages = [HOME, ...pages.filter((p) => p.url !== BASE_URL)];

  // Group by section
  const groups = new Map<string, typeof allPages>();
  for (const page of allPages) {
    const bucket = groups.get(page.section) ?? [];
    bucket.push(page);
    groups.set(page.section, bucket);
  }

  // Alphabetical section order (fully automatic — new route groups appear sorted)
  const sortedSections = [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );

  // Within each section, sort pages by URL (home URL sorts first)
  for (const [, items] of sortedSections) {
    items.sort((a, b) => {
      if (a.url === BASE_URL) return -1;
      if (b.url === BASE_URL) return 1;
      return a.url.localeCompare(b.url);
    });
  }

  const lines: string[] = [`# ${SITE_NAME}`, "", `> ${SITE_DESCRIPTION}`, ""];

  for (const [label, items] of sortedSections) {
    if (!items.length) continue;
    lines.push(`## ${label}`);
    lines.push("");
    for (const { url, title, description } of items) {
      lines.push(`- [${title}](${url})${description ? `: ${description}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Contact & Support");
  lines.push("");
  lines.push(`- Email: ${CONTACT_INFO.email}`);
  lines.push(`- Founder: ${CONTACT_INFO.founder}`);
  lines.push(`- Support: ${CONTACT_INFO.support}`);
  lines.push(`- Twitter: ${CONTACT_INFO.twitter}`);
  lines.push(`- Discord: ${CONTACT_INFO.discord}`);
  lines.push(`- GitHub (org): ${CONTACT_INFO.githubOrg}`);
  lines.push(`- GitHub (SDK + MCP): ${CONTACT_INFO.githubSdk}`);
  lines.push(`- npm (SDK): ${CONTACT_INFO.npmSdk}`);
  lines.push(`- npm (MCP server): ${CONTACT_INFO.npmMcp}`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
```

---

### 6.6 Create `llms-full.txt/route.ts`

**File to create**: `apps/www/src/app/(seo)/llms-full.txt/route.ts`

Dynamic route handler. For full body content:
- Changelog entries: `getEntries()` includes full `body.plainText` — no extra queries
- Legal pages: `getPosts()` includes full `body.plainText` — no extra queries
- Blog posts: `getPosts()` returns metadata only (no body). Uses `description` as the content summary. Full blog body requires `getPost(slug)` per-post — deferred as a future optimization, noted below.

```typescript
import { blog, changelog, legal } from "@vendor/cms";
import { discoverPages } from "../_lib/discover-pages";
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  BASE_URL,
} from "../_lib/site-identity";

export const revalidate = false;

export async function GET() {
  const [pages, changelogEntries, legalPages] = await Promise.all([
    discoverPages(),
    changelog.getEntries().catch(() => []),
    legal.getPosts().catch(() => []),
  ]);

  // Build URL → full body content map for CMS pages that include body in their meta query
  const bodyContent = new Map<string, string>();

  for (const entry of changelogEntries) {
    if (!entry.slug) continue;
    const url = `${BASE_URL}/changelog/${entry.slug}`;
    const body = entry.body?.plainText;
    if (body) bodyContent.set(url, body);
  }

  for (const page of legalPages) {
    if (!page._slug) continue;
    const url = `${BASE_URL}/legal/${page._slug}`;
    const body = page.body?.plainText;
    if (body) bodyContent.set(url, body);
  }

  // Note: blog posts use description only here.
  // Full blog body requires getPost(slug) per post — add to @vendor/cms as getPosts({ withBody: true })
  // when blog volume justifies it.

  const lines: string[] = [
    `# ${SITE_NAME} — Full Content`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `Source index: ${BASE_URL}/llms.txt`,
    "",
  ];

  for (const page of pages) {
    lines.push(`## ${page.title}`);
    lines.push(`URL: ${page.url}`);
    if (page.description) lines.push(`> ${page.description}`);
    lines.push("");

    const body = bodyContent.get(page.url);
    if (body) {
      lines.push(body);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
```

**Delete** `apps/www/public/llms-full.txt` (the static file created in Phase 2.5) — superseded by this route handler.

---

### 6.7 Refactor `sitemap.ts`

**File to update**: `apps/www/src/app/sitemap.ts`

The entire manual list of ~25 hardcoded entries is replaced by `discoverPages()`. Feed URLs and auth pages (not discoverable from build output) remain in `STATIC_SITEMAP_ENTRIES`.

Note on import path: `sitemap.ts` imports from `./(seo)/_lib/` — the parentheses in the directory name are valid for TypeScript/Node.js module resolution.

```typescript
import { discoverPages } from "./(seo)/_lib/discover-pages";
import { STATIC_SITEMAP_ENTRIES } from "./(seo)/_lib/site-identity";
import type { MetadataRoute } from "next";

function changeFrequency(
  priority: number
): MetadataRoute.Sitemap[number]["changeFrequency"] {
  if (priority >= 0.7) return "weekly";
  if (priority >= 0.5) return "monthly";
  return "yearly";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await discoverPages();

  const discovered: MetadataRoute.Sitemap = pages.map((p) => ({
    url: p.url,
    ...(p.lastModified && { lastModified: p.lastModified }),
    changeFrequency: changeFrequency(p.priority),
    priority: p.priority,
  }));

  return [...discovered, ...STATIC_SITEMAP_ENTRIES];
}
```

**What's lost vs. current sitemap**: Category-based blog post priority (`getCategoryPriority()` gave "comparisons" posts 0.95 vs 0.7 for standard depth-2 pages). Trade-off: zero maintenance vs. fine-grained priority. If category-based priority matters, it can be restored by fetching `post.categories` in `cms-collections.ts` and passing it through `DiscoveredPage.priority`.

---

### 6.8 Update `microfrontends.json`

**File**: `apps/app/microfrontends.json`

Add `/llms-full.txt` to the `lightfast-www` routing group (alongside `/llms.txt` added in Phase 2):

```json
"/llms-full.txt"
```

---

### Behavior Change Summary

| Before | After |
|---|---|
| `sectionOf()` hardcodes 5 section names with URL patterns | Section derived from URL first path segment (title-cased) |
| `collectCmsPages()` hardcodes 3 CMS queries | `cms-collections.ts` registry — one array entry per collection |
| `sitemap.ts` has ~25 hardcoded page entries | Auto-discovered from build output |
| llms.txt sections: Marketing → Use Cases → Docs → API Reference → Legal | Alphabetical: API Reference, Blog, Changelog, Docs, Legal, Overview, Use Cases |
| `llms-full.txt` is a static file in `public/` | Dynamic route handler, always current with CMS |
| `BASE_URL` hardcoded in `sitemap.ts:97`, `llms.txt:19`, etc. | Single export from `site-identity.ts` |
| `SITE_DESCRIPTION` hardcoded in `llms.txt:222–223` | Single export from `site-identity.ts` |
| Contact links hardcoded in `llms.txt:239–253` | `CONTACT_INFO` object in `site-identity.ts` |

### What Doesn't Change

- Section names for existing URL patterns remain the same: `/blog` → "Blog", `/docs` → "Docs", `/use-cases` → "Use Cases", `/legal` → "Legal"
- `"API Reference"` is preserved as a special case — `docs/api-reference` path prefix triggers it
- Contact section content is unchanged, just sourced from `CONTACT_INFO`
- Feed URLs and auth pages remain in `STATIC_SITEMAP_ENTRIES` (not auto-discoverable as route handlers / cross-app routes)
- `SKIP_FILE` and `SKIP_URL` patterns are unchanged — carried into `discover-pages.ts`

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter @lightfast/www typecheck` passes
- [ ] `pnpm --filter @lightfast/www check` passes

#### Manual Verification (requires `pnpm build:www` first)
- [ ] `GET /llms.txt` — sections appear alphabetically: API Reference, Blog, Changelog, Docs, Legal, Overview, Use Cases
- [ ] `GET /llms.txt` — pitch-deck does NOT appear (noIndex respected)
- [ ] `GET /llms.txt` — search does NOT appear (SKIP_URL filter)
- [ ] `GET /llms-full.txt` — changelog entries appear with full body text (not just description)
- [ ] `GET /llms-full.txt` — legal pages appear with full body text
- [ ] `GET /sitemap.xml` — all marketing pages, blog posts, changelog entries, legal pages present
- [ ] `GET /sitemap.xml` — feed URLs (rss.xml, atom.xml) and sign-in/sign-up present (from STATIC_SITEMAP_ENTRIES)
- [ ] Add a new `apps/www/src/app/(app)/(marketing)/integrations/page.tsx` with metadata → after `pnpm build:www`, it appears in `/sitemap.xml` and `/llms.txt` under "Integrations" with zero other code changes

---

### 6.9 `## Optional` Section in llms.txt

**File to update**: `apps/www/src/app/(seo)/llms.txt/route.ts`

The llms.txt spec defines `## Optional` as a first-class section. The reference CLI tool `llms_txt2ctx` **excludes it by default** — AI tools using it in tight token-budget mode will skip these pages automatically. This is the intended mechanism for differentiating `llms.txt` (core content) from `llms-full.txt` (complete).

**Routing rule**: pages with `priority < 0.5` OR in the `"Legal"` section are moved to `## Optional`. Everything else goes in the primary alphabetical sections.

Update the `GET` handler's grouping logic:

```typescript
// In the GET handler, after discoverPages():

const PRIMARY_SECTIONS = new Map<string, typeof allPages>();
const OPTIONAL_PAGES: typeof allPages = [];

for (const page of allPages) {
  const isOptional = page.priority < 0.5 || page.section === "Legal";
  if (isOptional) {
    OPTIONAL_PAGES.push(page);
  } else {
    const bucket = PRIMARY_SECTIONS.get(page.section) ?? [];
    bucket.push(page);
    PRIMARY_SECTIONS.set(page.section, bucket);
  }
}

// Render primary sections alphabetically (existing logic)
const sortedSections = [...PRIMARY_SECTIONS.entries()].sort(([a], [b]) =>
  a.localeCompare(b)
);

// ... existing render loop for primary sections ...

// Then append Optional
if (OPTIONAL_PAGES.length > 0) {
  OPTIONAL_PAGES.sort((a, b) => a.url.localeCompare(b.url));
  lines.push("## Optional");
  lines.push("");
  for (const { url, title, description } of OPTIONAL_PAGES) {
    lines.push(`- [${title}](${url})${description ? `: ${description}` : ""}`);
  }
  lines.push("");
}
```

**Effect**: Legal pages move to `## Optional`. Any future low-priority page (added as the site grows) is automatically routed there. AI tools get a lean primary index; those that need completeness use `--optional True` with `llms_txt2ctx` or read `llms-full.txt`.

---

### 6.10 Per-Page `.md` Endpoints

**Files to create**:
- `apps/www/src/app/(seo)/[...path]/route.ts` — catch-all handler serving Markdown for any `.md`-suffixed URL request

**Why**: When an AI follows a link from llms.txt (e.g. `/docs/quickstart`), it currently receives a full HTML page — nav, footer, scripts, and all. Cloudflare benchmarked this: **16,180 HTML tokens → 3,150 Markdown tokens (80% reduction)**. Mintlify, Stripe, FastHTML, and Geistdocs (Vercel's own doc template) all implement this pattern. The llms.txt spec explicitly proposes it as the "second proposal" alongside `/llms.txt` itself.

**How it works**: A catch-all route handler matches any URL ending in `.md`. It looks up the corresponding page, extracts clean content, and returns Markdown.

**Update `llms.txt/route.ts` to link to `.md` URLs**:

```typescript
// In the render loop, change:
lines.push(`- [${title}](${url})${description ? `: ${description}` : ""}`);

// To (append .md to every URL so AI tools get Markdown when they follow links):
lines.push(`- [${title}](${url}.md)${description ? `: ${description}` : ""}`);
```

**Create the catch-all `.md` handler**:

```typescript
// apps/www/src/app/(seo)/[...path]/route.ts
import { blog, changelog, legal } from "@vendor/cms";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BASE_URL } from "../_lib/site-identity";

const NEXT_APP_DIR = join(process.cwd(), ".next", "server", "app");

// Strip HTML tags, keeping text content (best-effort for static pages)
function htmlToMarkdown(html: string): string {
  // Extract <main> or <article> content if present
  const main =
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html;

  return main
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) =>
      `${"#".repeat(Number(level))} ${text.replace(/<[^>]+>/g, "").trim()}\n`
    )
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) =>
      `${text.replace(/<[^>]+>/g, "").trim()}\n\n`
    )
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, text) =>
      `- ${text.replace(/<[^>]+>/g, "").trim()}\n`
    )
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "```\n$1\n```")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getMarkdownForUrl(url: string): Promise<string | null> {
  const path = new URL(url).pathname;

  // CMS: blog post
  if (path.startsWith("/blog/") && path.split("/").length === 3) {
    const slug = path.split("/")[2];
    if (!slug) return null;
    try {
      const post = await blog.getPost(slug);
      if (!post) return null;
      const lines = [`# ${post._title ?? slug}`, ""];
      if (post.description) lines.push(`> ${post.description}`, "");
      if (post.body?.plainText) lines.push(post.body.plainText);
      return lines.join("\n");
    } catch {
      return null;
    }
  }

  // CMS: changelog entry
  if (path.startsWith("/changelog/") && path.split("/").length === 3) {
    const slug = path.split("/")[2];
    if (!slug) return null;
    try {
      const entry = await changelog.getEntryBySlug(slug);
      if (!entry) return null;
      const lines = [`# ${entry._title ?? slug}`, ""];
      if (entry.excerpt) lines.push(`> ${entry.excerpt}`, "");
      if (entry.body?.plainText) lines.push(entry.body.plainText);
      return lines.join("\n");
    } catch {
      return null;
    }
  }

  // CMS: legal page
  if (path.startsWith("/legal/") && path.split("/").length === 3) {
    const slug = path.split("/")[2];
    if (!slug) return null;
    try {
      const page = await legal.getPost(slug);
      if (!page) return null;
      const lines = [`# ${page._title ?? slug}`, ""];
      if (page.description) lines.push(`> ${page.description}`, "");
      if (page.body?.plainText) lines.push(page.body.plainText);
      return lines.join("\n");
    } catch {
      return null;
    }
  }

  // Static page: read from build output
  // Convert URL path to HTML file path: /docs/quickstart → docs/quickstart.html
  const segments = path.replace(/^\//, "").replace(/\/$/, "") || "index";
  const candidates = [
    join(NEXT_APP_DIR, `${segments}.html`),
    join(NEXT_APP_DIR, segments, "index.html"),
  ];

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      try {
        const html = await readFile(filePath, "utf8");
        return htmlToMarkdown(html);
      } catch {
        return null;
      }
    }
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // Only handle requests ending in .md
  const last = path[path.length - 1] ?? "";
  if (!last.endsWith(".md")) {
    return new Response("Not Found", { status: 404 });
  }

  // Reconstruct the canonical URL without the .md suffix
  const cleanPath = [
    ...path.slice(0, -1),
    last.slice(0, -3), // remove .md
  ]
    .filter(Boolean)
    .join("/");

  const url = `${BASE_URL}/${cleanPath}`;
  const markdown = await getMarkdownForUrl(url);

  if (!markdown) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "x-source-url": url,
    },
  });
}
```

**Note on routing**: The `(seo)/[...path]/route.ts` catch-all will only match requests that reach the `(seo)` route group. Since actual pages are served by their own route handlers, the catch-all in `(seo)` only fires for URLs that don't match a real page — which is exactly what `.md`-suffixed URLs are (no real page exists at `/docs/quickstart.md`). No conflict with existing routes.

---

### 6.11 `Accept: text/markdown` Content Negotiation in `middleware.ts`

**File to update**: `apps/www/src/middleware.ts`

**Why this is the highest-impact addition**: When any AI tool fetches a Lightfast page with `Accept: text/markdown` — which Claude Code does natively, and which Cursor, GPTBot, and others increasingly do — they currently receive full HTML. This addition intercepts those requests in middleware and redirects to the `.md` endpoint added in 6.10, returning clean Markdown with 80% fewer tokens.

This is **not user-agent sniffing** (which risks Google's cloaking policies). It is standards-compliant HTTP content negotiation via the `Accept` header — the same mechanism Cloudflare launched at infrastructure scale in February 2026, and what Fern, Mintlify, and `@markdown-for-agents/nextjs` implement.

**Note**: `apps/www` still uses `middleware.ts` (not yet renamed to `proxy.ts`). The content negotiation handler plugs into the existing NEMO middleware chain as an early `before` handler.

```typescript
// apps/www/src/middleware.ts — add markdownNegotiationMiddleware to the before chain

import { createNEMO } from "@rescale/nemo";
// ... existing imports ...

// =============================================================================
// Markdown Content Negotiation
// =============================================================================

/**
 * When a request includes `Accept: text/markdown`, redirect to the .md endpoint.
 *
 * This allows AI tools (Claude Code, Cursor, GPTBot, etc.) to receive clean
 * Markdown instead of HTML — reducing token consumption by ~80% per page.
 *
 * Uses Accept header negotiation (not user-agent sniffing) — safe from
 * Google's cloaking policies and forward-compatible with any future AI client.
 */
const markdownNegotiationMiddleware = (request: NextRequest): NextResponse | undefined => {
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/markdown")) return undefined; // pass through

  const { pathname } = request.nextUrl;

  // Skip: already a .md request, Next.js internals, static assets, API routes
  if (
    pathname.endsWith(".md") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf)$/.test(pathname)
  ) {
    return undefined;
  }

  // Rewrite to the .md catch-all handler (6.10)
  const mdUrl = request.nextUrl.clone();
  mdUrl.pathname = `${pathname.replace(/\/$/, "")}.md`;

  return NextResponse.rewrite(mdUrl, {
    headers: {
      "Vary": "Accept",
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
};

// =============================================================================
// NEMO Composition — add markdownNegotiationMiddleware as first before handler
// =============================================================================

const composedMiddleware = createNEMO(
  {},
  {
    before: [markdownNegotiationMiddleware, wwwMiddleware],
    //        ^^^ runs first — short-circuits to .md handler before anything else
  }
);
```

**Response headers set on Markdown responses**:
- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept` — tells CDN to cache HTML and Markdown separately for the same URL
- `x-source-url` — set by the `.md` handler (6.10) identifying the canonical HTML page

**What triggers this**: Any request where `Accept` includes `text/markdown`. This includes:
- Claude Code fetching a URL during a session
- Cursor's context window fetcher
- Any developer using `curl -H "Accept: text/markdown" https://lightfast.ai/docs/quickstart`
- Future AI tools that adopt the header convention (Cloudflare validated this as the right approach)

Human browsers send `Accept: text/html,application/xhtml+xml,...` — never `text/markdown` — so they are unaffected.

---

### Updated Success Criteria (Phases 6.9–6.11)

#### Automated Verification
- [ ] `pnpm --filter @lightfast/www typecheck` passes (including new catch-all handler and middleware update)
- [ ] `pnpm --filter @lightfast/www check` passes

#### Manual Verification
- [ ] `GET /llms.txt` — Legal pages appear under `## Optional`, not in the primary alphabetical sections
- [ ] `curl https://lightfast.ai/llms.txt | grep "## Optional"` — confirms section exists
- [ ] `GET /docs/get-started/quickstart.md` — returns clean Markdown (not HTML)
- [ ] `GET /blog/<any-slug>.md` — returns full blog post body as Markdown
- [ ] `GET /changelog/<any-slug>.md` — returns changelog entry body as Markdown
- [ ] `GET /legal/privacy.md` — returns legal page body as Markdown
- [ ] `GET /nonexistent.md` — returns 404
- [ ] `curl -H "Accept: text/markdown" https://lightfast.ai/docs/get-started/quickstart` — returns Markdown (same content as `/docs/get-started/quickstart.md`)
- [ ] `curl https://lightfast.ai/docs/get-started/quickstart` (no special header) — returns normal HTML page (unaffected)
- [ ] Response includes `Vary: Accept` header (confirms correct CDN caching behaviour)
- [ ] llms.txt links point to `.md` URLs: `- [Quickstart](https://lightfast.ai/docs/get-started/quickstart.md)`

---

## Update Log

### 2026-03-21 — Phase 1.7 SSG regression fix
- **Trigger**: `pnpm build:www` after Phase 1 implementation lost SSG for all blog listing and changelog pages
- **Root cause**: Phase 1.7 introduced `redirect("/blog")` in `topic/[category]/page.tsx` while `generateStaticParams` remained. During build, Next.js pre-renders each category slug, hits the unconditional redirect, and propagates a dynamic rendering signal up the shared `(listing)` layout group — affecting `/blog`, `/blog/[slug]`, and `/changelog`.
- **Fix**: Removed `generateStaticParams` from `topic/[category]/page.tsx`. Kept `generateMetadata` and the redirect. Page renders as dynamic SSR (acceptable for a redirect route). `generateStaticParams` can be restored when real category content is implemented.
- **Impact on remaining phases**: None — Phases 2–5 are unaffected.

## References

- Research doc: `thoughts/shared/research/2026-03-21-www-maintainability-seo-audit.md`
- Microfrontends config: `apps/app/microfrontends.json`
- Metadata utility: `vendor/seo/metadata.ts`
- Nav config: `apps/www/src/config/nav.ts`

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

The page always renders empty. Replace the broken TODO state with a redirect to `/blog` until CMS fetch is implemented:

```ts
// In the generateStaticParams or page function, add a redirect:
import { redirect } from "next/navigation";

// At top of page function (before any rendering):
// Option: redirect to blog listing until implemented
redirect("/blog");
```

Alternatively, keep the page but remove the "No posts yet" empty state — replace with a `notFound()` call when `posts.length === 0` to avoid serving empty content. Choose the redirect approach as it's safer for SEO (no empty pages indexed).

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
- [ ] `pnpm --filter @lightfast/www typecheck` passes
- [ ] `pnpm --filter @lightfast/app typecheck` passes after deletions
- [ ] `pnpm --filter @lightfast/www check` passes

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

## References

- Research doc: `thoughts/shared/research/2026-03-21-www-maintainability-seo-audit.md`
- Microfrontends config: `apps/app/microfrontends.json`
- Metadata utility: `vendor/seo/metadata.ts`
- Nav config: `apps/www/src/config/nav.ts`

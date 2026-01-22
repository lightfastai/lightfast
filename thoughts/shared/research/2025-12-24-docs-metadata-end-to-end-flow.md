---
date: 2025-12-24T01:04:19Z
researcher: claude-opus-4-5
git_commit: 2ad850c2c7ff22ae03abc0b5a14759fece6f00a7
branch: feat/docs-seo-frontmatter
repository: lightfast
topic: "End-to-End Metadata Flow for @apps/docs/src/content/docs/"
tags: [research, codebase, docs, fumadocs, metadata, seo, frontmatter, json-ld]
status: complete
last_updated: 2025-12-24
last_updated_by: claude-opus-4-5
---

# Research: End-to-End Metadata Flow for Docs Content

**Date**: 2025-12-24T01:04:19Z
**Researcher**: claude-opus-4-5
**Git Commit**: 2ad850c2c7ff22ae03abc0b5a14759fece6f00a7
**Branch**: feat/docs-seo-frontmatter
**Repository**: lightfast

## Research Question

Document the full end-to-end metadata flow for `@apps/docs/src/content/docs/` - from MDX frontmatter through to rendered SEO metadata and structured data.

## Summary

The docs metadata system uses a three-layer architecture:

1. **MDX Frontmatter** → Defines per-page metadata in YAML
2. **Fumadocs Pipeline** → Validates, transforms, and exposes frontmatter via `getPage()`
3. **Next.js Rendering** → Generates HTML metadata tags and JSON-LD structured data

The system currently supports 14 frontmatter fields including base fumadocs fields (title, description, icon, full), SEO meta fields (keywords, canonical), OpenGraph overrides (ogImage, ogTitle, ogDescription), indexing controls (noindex, nofollow), article metadata (author, publishedAt, updatedAt), and TechArticle-specific fields (proficiencyLevel).

## Detailed Findings

### Layer 1: MDX Frontmatter Schema

**Location**: `apps/docs/source.config.ts:27-55`

The Zod schema defines all available frontmatter fields:

```typescript
const docsSchema = z.object({
  // Base fumadocs fields (must match fumadocs-mdx expectations)
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  full: z.boolean().optional(),
  _openapi: z.record(z.unknown()).optional(),

  // SEO meta fields
  keywords: z.string().optional(),
  canonical: z.string().optional(),

  // OpenGraph overrides
  ogImage: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),

  // Indexing controls
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),

  // Article metadata for structured data
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),

  // TechArticle-specific fields
  proficiencyLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional(),
});
```

**Two Collections Defined** (`source.config.ts:57-69`):
- `docs` from `src/content/docs` directory
- `apiDocs` from `src/content/api` directory

Both use the same `docsSchema`.

### Layer 2: Fumadocs Build Pipeline

**Build Trigger**: `package.json:16` - postinstall hook runs `fumadocs-mdx`

**Generated Output**: `.source/index.ts`
- Contains namespace imports for all MDX files
- Exports `docs`, `meta`, `apiDocs`, `apiMeta` arrays
- Uses hash-based cache busting: `?collection=docs&hash=1766537823066`

**Runtime Loader** (`apps/docs/src/lib/source.ts:1-26`):
```typescript
import { docs, meta, apiDocs, apiMeta } from "@/.source";
import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";

export const docsSource = loader({
  baseUrl: "/docs",
  source: createMDXSource(docs, meta),
});

export const { getPage, getPages, pageTree } = docsSource;
```

**Data Flow**:
1. MDX frontmatter parsed during webpack compilation
2. Validated against `docsSchema` (build fails if invalid)
3. `_runtime.doc()` merges frontmatter onto page object
4. `getPage(slug)` returns `{data: {...frontmatter}, url, slugs, ...}`

### Layer 3: Page Rendering

**Page Component**: `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx`

#### Metadata Generation (`generateMetadata` at lines 203-363)

The function extracts frontmatter and generates Next.js Metadata:

```typescript
const frontmatter = page.data as unknown as ExtendedFrontmatter;

// Per-page keyword extraction
const pageKeywords = frontmatter.keywords
  ? frontmatter.keywords.split(",").map((k: string) => k.trim())
  : [];

// OpenGraph override support
const ogImage = frontmatter.ogImage
  ? `https://lightfast.ai${frontmatter.ogImage}`
  : siteConfig.ogImage;
const ogTitle = frontmatter.ogTitle ?? title;
const ogDescription = frontmatter.ogDescription ?? description;

// Indexing controls
const noindex = frontmatter.noindex ?? false;
const nofollow = frontmatter.nofollow ?? false;
```

**Generated Metadata Tags**:
- `<title>` - From frontmatter.title + " – Lightfast Docs"
- `<meta name="description">` - From frontmatter.description
- `<meta name="keywords">` - Per-page + default docs keywords merged
- `<link rel="canonical">` - From frontmatter.canonical or auto-generated
- `<meta name="robots">` - Respects noindex/nofollow flags
- OpenGraph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- Twitter Card tags
- Article date tags (`article:published_time`, `article:modified_time`)

#### JSON-LD Structured Data (Page component lines 83-165)

Four schema.org entities in `@graph` format:

**1. Organization** (lines 83-98)
```typescript
const organizationEntity: Organization = {
  "@type": "Organization",
  "@id": "https://lightfast.ai/#organization",
  name: "Lightfast",
  logo: { "@type": "ImageObject", url: "https://lightfast.ai/android-chrome-512x512.png" },
  sameAs: ["https://twitter.com/lightfastai", "https://github.com/lightfastai", ...]
};
```

**2. WebSite** (lines 100-109)
```typescript
const websiteEntity: WebSite = {
  "@type": "WebSite",
  "@id": "https://lightfast.ai/docs#website",
  name: "Lightfast Documentation",
  publisher: { "@id": "https://lightfast.ai/#organization" }
};
```

**3. BreadcrumbList** (lines 111-130)
```typescript
// Auto-generated from URL slugs
const breadcrumbItems = slug.map((segment, index) => ({
  "@type": "ListItem",
  position: index + 1,
  name: segment.split("-").map(word => capitalize(word)).join(" "),
  item: `https://lightfast.ai/docs/${slug.slice(0, index + 1).join("/")}`
}));
```

**4. TechArticle** (lines 132-155)
```typescript
const techArticleEntity: TechArticle = {
  "@type": "TechArticle",
  headline: frontmatter.title,
  description: frontmatter.description,
  proficiencyLevel: frontmatter.proficiencyLevel ?? "Beginner",
  author: frontmatter.author ? { "@type": "Person", name: frontmatter.author } : org,
  ...(frontmatter.publishedAt ? { datePublished: frontmatter.publishedAt } : {}),
  ...(frontmatter.updatedAt ? { dateModified: frontmatter.updatedAt } : {}),
};
```

**Rendering** (lines 167-169):
```tsx
<JsonLd code={structuredData} />
```

### Supporting Infrastructure

**Site Configuration** (`apps/docs/src/lib/site-config.ts`):
- `siteConfig.url`: "https://lightfast.ai/docs"
- `siteConfig.ogImage`: "https://lightfast.ai/og.jpg"
- `docsMetadata.keywords`: Default keyword array for all docs

**Metadata Utility** (`vendor/seo/metadata.ts`):
- `createMetadata()` function merges defaults with overrides
- Uses `lodash.merge` for deep merging
- Sets applicationName, author, publisher, twitter handle

**JSON-LD Component** (`vendor/seo/json-ld.tsx`):
- `<JsonLd>` renders `<script type="application/ld+json">`
- Escapes HTML entities for security
- Re-exports schema-dts types (Organization, TechArticle, etc.)

### Navigation Structure

**meta.json Files** define sidebar navigation:

`src/content/docs/meta.json`:
```json
{
  "title": "Documentation",
  "pages": ["get-started", "integrate", "features"]
}
```

`src/content/docs/get-started/meta.json`:
```json
{
  "title": "Getting Started",
  "pages": ["overview", "[Quickstart](/docs/get-started/quickstart)", "config"]
}
```

Supports both slug strings and markdown link format for display name overrides.

### Example MDX File

`src/content/docs/get-started/overview.mdx`:
```yaml
---
title: Overview
description: The memory layer for software teams - search everything your engineering org knows
keywords: memory layer, semantic search, team knowledge, engineering search, AI memory, knowledge base
ogTitle: Lightfast Overview - Memory Layer for Software Teams
ogDescription: Index code, docs, tickets, and conversations. Search by meaning. Get answers with sources.
author: Lightfast Team
publishedAt: "2024-12-01"
updatedAt: "2024-12-24"
proficiencyLevel: Beginner
---
```

## Code References

### Configuration
- `apps/docs/source.config.ts:27-55` - Zod schema definition
- `apps/docs/source.config.ts:57-69` - Collection definitions
- `apps/docs/source.config.ts:71-77` - MDX options (rehype disabled)
- `apps/docs/package.json:16` - postinstall hook

### Runtime
- `apps/docs/src/lib/source.ts:1-26` - Loader initialization
- `apps/docs/src/lib/site-config.ts:1-66` - Site configuration
- `vendor/seo/metadata.ts:1-72` - Metadata creation utility
- `vendor/seo/json-ld.tsx:1-81` - JSON-LD component

### Page Component
- `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx:23-43` - ExtendedFrontmatter interface
- `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx:45-195` - Page component
- `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx:203-363` - generateMetadata function

### Content
- `apps/docs/src/content/docs/meta.json` - Root navigation
- `apps/docs/src/content/docs/get-started/meta.json` - Get Started navigation
- `apps/docs/src/content/docs/integrate/meta.json` - Integrate navigation
- `apps/docs/src/content/docs/features/meta.json` - Features navigation

## Architecture Documentation

### Data Flow Diagram

```
MDX Frontmatter (YAML)
        │
        ▼
source.config.ts (Zod Schema Validation)
        │
        ▼
fumadocs-mdx postinstall → .source/index.ts
        │
        ▼
webpack MDX loader (build time)
        │
        ▼
createMDXSource + loader() → docsSource
        │
        ▼
getPage(slug) returns {data: frontmatter, url, slugs}
        │
        ├─────────────────────────┬────────────────────────┐
        ▼                         ▼                        ▼
generateMetadata()           Page Component          generateStaticParams()
        │                         │
        ▼                         ▼
Next.js Metadata API         JsonLd Component
        │                         │
        ▼                         ▼
<head> tags                  <script type="application/ld+json">
```

### Type Flow

```
docsSchema (Zod)
    │
    ▼
ExtendedFrontmatter (TypeScript interface, page.tsx:23-43)
    │
    ▼
page.data as ExtendedFrontmatter (runtime cast)
    │
    ├──► createMetadata() → Next.js Metadata type
    │
    └──► GraphContext → JsonLd component
```

## Historical Context (from thoughts/)

- `thoughts/shared/research/2025-12-24-web-analysis-fumadocs-seo-optimization.md` - Prior research on extending Fumadocs frontmatter for SEO
- `thoughts/shared/research/2025-12-24-web-analysis-aeo-geo-seo-best-practices.md` - AEO/GEO optimization research
- `thoughts/shared/research/2025-12-18-sitemap-lastmod-aeo-geo-optimization.md` - Sitemap optimization for search engines

## Related Research

- `thoughts/shared/research/2025-12-18-fumadocs-code-block-integration.md` - SSR code blocks in Fumadocs
- `thoughts/shared/research/2025-12-17-changelog-seo-output-structure.md` - Similar SEO patterns for changelog

## Open Questions

1. **API Reference Metadata** - Does `src/content/api/` need different schema fields?
2. **OG Image Generation** - Currently static; consider dynamic generation with `next/og`
3. **Versioned Docs** - If versions are added, how do canonical URLs change?
4. **i18n** - If internationalization is added, hreflang tag generation needed

---
date: 2024-12-24T10:30:00+11:00
researcher: claude-opus-4-5
topic: "Fumadocs SEO Optimization - Per-Page Metadata from MDX Frontmatter"
tags: [research, web-analysis, fumadocs, seo, next.js, metadata, frontmatter]
status: complete
created_at: 2025-12-24
confidence: high
sources_count: 8
---

# Web Research: Fumadocs SEO Optimization

**Date**: 2024-12-24T10:30:00+11:00
**Topic**: How to optimize SEO routing for Fumadocs by extracting per-page metadata from MDX frontmatter
**Confidence**: High - based on official Fumadocs and Next.js documentation

## Research Question

How to optimize SEO routing for Fumadocs, specifically introducing SEO metadata into MDX content files (like `overview.mdx`) and extracting it in the `[[...slug]]` page for per-page customization instead of using generic SEO for all docs pages.

## Executive Summary

Fumadocs supports **extending the frontmatter schema with custom SEO fields** using Zod in `source.config.ts`. The key insight is that Fumadocs' `source.getPage()` returns a page object where `page.data` contains all frontmatter fields - including any custom SEO fields you define. You can then use these in Next.js 15's `generateMetadata` function for per-page SEO customization.

The current implementation already extracts `title` and `description` from frontmatter but misses opportunities for:
- Per-page keywords
- Custom OG images per page
- Canonical URL overrides
- noindex/nofollow controls
- Author and date information for Article schema

## Key Metrics & Findings

### Fumadocs Frontmatter Extension

**Finding**: Fumadocs does NOT have built-in SEO fields beyond `title` and `description`. You must extend the schema yourself using Zod.

**Source**: [Fumadocs Collections Documentation](https://fumadocs.dev/docs/mdx/collections)

**Implementation Pattern**:
```typescript
// source.config.ts
import { frontmatterSchema, defineDocs } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const { docs, meta } = defineDocs({
  dir: "src/content/docs",
  docs: {
    schema: frontmatterSchema.extend({
      // SEO fields
      keywords: z.string().optional(),
      canonical: z.string().url().optional(),
      ogImage: z.string().optional(),
      ogTitle: z.string().optional(),
      ogDescription: z.string().optional(),
      noindex: z.boolean().default(false),
      nofollow: z.boolean().default(false),
      // Article schema fields
      author: z.string().optional(),
      publishedAt: z.string().or(z.date()).optional(),
      updatedAt: z.string().or(z.date()).optional(),
    }),
  },
});
```

### Current Implementation Gap

**Finding**: The current `generateMetadata` function uses the same `docsMetadata.keywords` for all pages instead of per-page keywords.

**Current Code** (`apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx:258`):
```typescript
keywords: [...docsMetadata.keywords], // Same for ALL pages
```

**Optimized Pattern**:
```typescript
// Extract per-page keywords, fallback to defaults
const pageKeywords = page.data.keywords
  ? page.data.keywords.split(',').map(k => k.trim())
  : [];
keywords: [...pageKeywords, ...docsMetadata.keywords],
```

### OG Image Per Page

**Finding**: Fumadocs CLI provides OG image generation preset, but you can also use custom images per page.

**Source**: [Fumadocs next/og Documentation](https://fumadocs.dev/docs/ui/next-seo)

**Options**:
1. **Static custom images** - Add `ogImage` field to frontmatter
2. **Dynamic generation** - Use `next/og` route handler per page
3. **Hybrid** - Dynamic with frontmatter override

### Structured Data Enhancement

**Finding**: The current implementation uses Article schema, but documentation pages benefit from TechArticle schema.

**Source**: [Schema.org TechArticle](https://schema.org/TechArticle)

```typescript
const techArticleEntity: TechArticle = {
  "@type": "TechArticle",
  "@id": `https://lightfast.ai/docs/${slug.join("/")}#article`,
  headline: title,
  description: description,
  // Add these for better SEO
  proficiencyLevel: "Beginner", // or from frontmatter
  dependencies: [], // Could link to prerequisite docs
  datePublished: page.data.publishedAt,
  dateModified: page.data.updatedAt,
  author: {
    "@id": "https://lightfast.ai/#organization"
  },
};
```

## Trade-off Analysis

### Scenario 1: Extend Frontmatter Schema (Recommended)

| Factor | Impact | Notes |
|--------|--------|-------|
| Implementation | Low | Single file change in `source.config.ts` |
| Type Safety | High | Zod provides runtime validation |
| Flexibility | High | Any MDX file can override SEO |
| Maintenance | Low | Schema is centralized |

### Scenario 2: Keep Generic SEO

| Factor | Impact | Notes |
|--------|--------|-------|
| Implementation | None | No changes needed |
| Type Safety | N/A | No additional types |
| Flexibility | Low | All pages have same metadata |
| Maintenance | Low | Single source of truth |

### Scenario 3: Separate SEO Config Files

| Factor | Impact | Notes |
|--------|--------|-------|
| Implementation | High | Separate JSON/YAML per page |
| Type Safety | Medium | Requires custom loader |
| Flexibility | High | Complete separation of concerns |
| Maintenance | High | Multiple files to manage |

## Recommendations

Based on research findings:

1. **Extend Fumadocs frontmatter schema** with SEO fields in `source.config.ts`
   - Minimal code change with maximum flexibility
   - Type-safe with Zod validation
   - Follows Fumadocs recommended patterns

2. **Update `generateMetadata` to use per-page fields**
   - Extract keywords, canonical, ogImage from `page.data`
   - Fallback to defaults when not specified
   - Add proper type inference for extended schema

3. **Add Article date fields for Google News/Discover**
   - `publishedAt` and `updatedAt` improve content freshness signals
   - Used in Article schema and OG metadata

## Implementation Plan

### Step 1: Extend Frontmatter Schema

```typescript
// source.config.ts
import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

const extendedFrontmatter = frontmatterSchema.extend({
  // SEO fields
  keywords: z.string().optional(),
  canonical: z.string().url().optional(),
  ogImage: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  // Article metadata
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const { docs, meta } = defineDocs({
  dir: "src/content/docs",
  docs: {
    schema: extendedFrontmatter,
  },
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
  dir: "src/content/api",
  docs: {
    schema: extendedFrontmatter,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: false,
  },
});
```

### Step 2: Update generateMetadata

```typescript
// apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;

  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    // ... existing root metadata
  }

  const slug = resolvedParams.slug;
  const page = getPage(slug);

  if (!page) {
    // ... existing 404 metadata
  }

  const pageUrl = `/docs/${slug.join("/")}`;
  const title = page.data.title ? `${page.data.title} – Lightfast Docs` : "Lightfast Docs";
  const description = page.data.description ?? siteConfig.description;

  // Extract per-page SEO fields with fallbacks
  const pageKeywords = page.data.keywords
    ? page.data.keywords.split(',').map((k: string) => k.trim())
    : [];
  const ogImage = page.data.ogImage || siteConfig.ogImage;
  const canonical = page.data.canonical || `${siteConfig.url}${pageUrl}`;
  const noindex = page.data.noindex ?? false;
  const nofollow = page.data.nofollow ?? false;

  return createMetadata({
    title: page.data.ogTitle || title,
    description: page.data.ogDescription || description,
    image: ogImage,
    metadataBase: new URL(siteConfig.url),
    keywords: [...pageKeywords, ...docsMetadata.keywords],
    authors: [...docsMetadata.authors],
    creator: docsMetadata.creator,
    publisher: docsMetadata.creator,
    robots: {
      index: !noindex,
      follow: !nofollow,
      googleBot: {
        index: !noindex,
        follow: !nofollow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title: page.data.ogTitle || title,
      description: page.data.ogDescription || description,
      url: `${siteConfig.url}${pageUrl}`,
      siteName: "Lightfast Documentation",
      type: "article",
      locale: "en_US",
      publishedTime: page.data.publishedAt,
      modifiedTime: page.data.updatedAt,
      authors: page.data.author ? [page.data.author] : undefined,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
          type: "image/jpeg",
        }
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.ogTitle || title,
      description: page.data.ogDescription || description,
      site: "@lightfastai",
      creator: "@lightfastai",
      images: [ogImage],
    },
    category: "Technology",
  });
}
```

### Step 3: Example MDX with SEO Fields

```yaml
---
title: Overview
description: The memory layer for software teams - search everything your engineering org knows
keywords: memory layer, semantic search, team knowledge, engineering search, AI memory
ogTitle: Lightfast Overview - Memory Layer for Software Teams
ogDescription: Index code, docs, tickets, and conversations. Search by meaning. Get answers with sources.
ogImage: /og/docs-overview.png
author: Lightfast Team
publishedAt: 2024-12-01
updatedAt: 2024-12-24
---

# The memory layer for software teams
...
```

## Open Questions

Areas that need further investigation:

1. **Dynamic OG Image Generation**: Should we generate OG images dynamically using `next/og` for pages without custom `ogImage`?
2. **Internationalization**: If i18n is added later, how do `hreflang` tags integrate with Fumadocs?
3. **Versioned Docs**: Do we need canonical URL handling for versioned documentation?

## Sources

### Official Documentation
- [Fumadocs Collections](https://fumadocs.dev/docs/mdx/collections) - Schema extension patterns
- [Fumadocs Open Graph](https://fumadocs.dev/docs/ui/next-seo) - OG image integration
- [Next.js generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - Metadata API reference
- [Next.js JSON-LD](https://nextjs.org/docs/app/guides/json-ld) - Structured data guide

### SEO Best Practices
- [Next.js SEO Guide](https://nextjs.org/learn/seo/metadata) - Official SEO learning
- [Schema.org TechArticle](https://schema.org/TechArticle) - Technical article schema

### Real-World Examples
- [Fumadocs Showcase](https://fumadocs.dev/showcase) - Production implementations

---

**Last Updated**: 2025-12-24
**Confidence Level**: High - Based on official Fumadocs and Next.js documentation
**Next Steps**: Implement schema extension in `source.config.ts` and update `generateMetadata` function

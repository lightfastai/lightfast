# Changelog AEO Optimization Implementation Plan

## Overview

Upgrade the changelog system with Answer Engine Optimization (AEO) enhancements based on TryProfound's December 2025 content optimization research. This includes adding new BaseHub CMS fields, updating the `@vendor/cms` package, and enhancing the changelog pages with improved SEO metadata, structured data, and AI-citation optimized content patterns.

## Current State Analysis

**Existing Changelog Schema:**
- `_title`, `_slug`, `slug`, `_sys.createdAt`
- `body` (rich text with plainText, json, readingTime)
- `improvements`, `infrastructure`, `fixes`, `patches` (plain text bullet lists)

**Missing for AEO Optimization:**
- No featured image support
- No explicit publishedAt date field
- No excerpt/description field
- No SEO metadata fields (metaTitle, metaDescription, keywords)
- No FAQ schema support
- No TL;DR summary field
- No canonical URL or noIndex controls

**Key Discoveries:**
- Blog implementation at `vendor/cms/index.ts:69-160` provides the pattern for SEO fields and FAQ support
- Blog page at `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx:118-137` shows FAQ schema generation
- Changelog mutations at `packages/cms-workflows/src/mutations/changelog.ts` need updating for new fields

## Desired End State

After implementation:
1. Changelog entries in BaseHub have full SEO control (metaTitle, metaDescription, keywords, FAQ)
2. Changelog pages render with complete JSON-LD structured data including FAQ schema
3. Each changelog entry has a TL;DR summary for AI-citation optimization
4. Featured images display on changelog entries and in feeds
5. RSS/Atom feeds include all enhanced metadata

**Verification:**
- Run Google Rich Results Test on `/changelog/[slug]` pages
- Validate JSON-LD with Schema.org validator
- Check OpenGraph preview with social card validators
- Confirm RSS feed includes new fields via feed validator

## What We're NOT Doing

- No author support for changelog entries (authorless by design)
- No social share components
- No category/tagging system
- No breadcrumbs (changelog is flat structure)
- No multi-language support
- No comparison tables in schema (editorial choice in body content)

## Implementation Approach

1. Add fields to BaseHub CMS (manual step)
2. Regenerate BaseHub types and update fragments
3. Update mutation package for new fields
4. Enhance changelog pages with SEO patterns from blog

---

## Phase 1: BaseHub Schema Updates (Manual)

### Overview
Add new fields to the changelog collection in BaseHub CMS dashboard.

### Fields to Add in BaseHub:

#### 1. Featured Image Block
- **Field Name**: `featuredImage`
- **Type**: Image
- **Required**: No

#### 2. Published At
- **Field Name**: `publishedAt`
- **Type**: Date
- **Required**: No (falls back to _sys.createdAt)

#### 3. Excerpt
- **Field Name**: `excerpt`
- **Type**: Text (plain text, max 300 chars recommended)
- **Required**: No

#### 4. TL;DR Summary
- **Field Name**: `tldr`
- **Type**: Text (plain text, 50-100 words)
- **Required**: No
- **Description**: Brief summary optimized for AI citation

#### 5. SEO Block
- **Field Name**: `seo`
- **Type**: Component/Block with nested fields:
  - `metaTitle` (Text, max 60 chars)
  - `metaDescription` (Text, max 160 chars)
  - `focusKeyword` (Text)
  - `secondaryKeywords` (Text, comma-separated)
  - `canonicalUrl` (URL, optional override)
  - `noIndex` (Boolean, default false)
  - `faq` (List of items):
    - `question` (Text)
    - `answer` (Text)

### Success Criteria:

#### Manual Verification:
- [ ] All fields added in BaseHub dashboard
- [ ] Test entry created with all new fields populated
- [ ] Fields visible in BaseHub content editor

**Implementation Note**: This phase requires manual BaseHub dashboard configuration. After completing field setup, run `pnpm --filter @vendor/cms generate` to regenerate types.

---

## Phase 2: CMS Package Updates

### Overview
Update `@vendor/cms` to expose new changelog fields via fragments and types.

### Changes Required:

#### 1. Update Changelog Fragment
**File**: `vendor/cms/index.ts`
**Location**: Around line 427 (changelogEntryFragment)

**Current Fragment:**
```typescript
const changelogEntryFragment = {
  _slug: true,
  _title: true,
  slug: true,
  _sys: { createdAt: true },
  body: {
    plainText: true,
    json: { content: true, toc: true },
    readingTime: true,
  },
  improvements: true,
  infrastructure: true,
  fixes: true,
  patches: true,
};
```

**Updated Fragment:**
```typescript
const changelogEntryFragment = {
  _slug: true,
  _title: true,
  slug: true,
  _sys: { createdAt: true },
  body: {
    plainText: true,
    json: { content: true, toc: true },
    readingTime: true,
  },
  improvements: true,
  infrastructure: true,
  fixes: true,
  patches: true,
  // New AEO fields
  featuredImage: imageFragment,
  publishedAt: true,
  excerpt: true,
  tldr: true,
  seo: {
    metaTitle: true,
    metaDescription: true,
    focusKeyword: true,
    secondaryKeywords: true,
    canonicalUrl: true,
    noIndex: true,
    faq: {
      items: {
        question: true,
        answer: true,
      },
    },
  },
};
```

#### 2. Update ChangelogEntry Type
**File**: `vendor/cms/index.ts`
**Location**: Around line 396-425

**Add to ChangelogEntry type:**
```typescript
export type ChangelogEntry = ChangelogEntryMeta & {
  body?: {
    plainText?: string | null;
    json?: { content?: any[]; toc?: any } | null;
    readingTime?: number | null;
  } | null;
  improvements?: string | null;
  infrastructure?: string | null;
  fixes?: string | null;
  patches?: string | null;
  // New AEO fields
  featuredImage?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    blurDataURL?: string | null;
  } | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  tldr?: string | null;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    focusKeyword?: string | null;
    secondaryKeywords?: string | null;
    canonicalUrl?: string | null;
    noIndex?: boolean | null;
    faq?: {
      items?: Array<{
        question?: string | null;
        answer?: string | null;
      }> | null;
    } | null;
  } | null;
};
```

### Success Criteria:

#### Automated Verification:
- [x] Types regenerate without errors: `pnpm --filter @vendor/cms generate`
- [x] Package builds successfully: `pnpm --filter @vendor/cms build`
- [x] Typecheck passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Query returns new fields when fetching a test changelog entry

---

## Phase 3: Mutation Package Updates

### Overview
Update `@repo/cms-workflows` changelog mutations to support new fields.

### Changes Required:

#### 1. Update ChangelogEntryInput Type
**File**: `packages/cms-workflows/src/mutations/changelog.ts`

**Updated Type:**
```typescript
export type ChangelogEntryInput = {
  title: string;
  slug: string;
  body: string;
  improvements?: string;
  infrastructure?: string;
  fixes?: string;
  patches?: string;
  // New AEO fields
  featuredImageId?: string; // BaseHub asset ID
  publishedAt?: string; // ISO date string
  excerpt?: string;
  tldr?: string;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    secondaryKeywords?: string;
    canonicalUrl?: string;
    noIndex?: boolean;
    faq?: Array<{
      question: string;
      answer: string;
    }>;
  };
};
```

#### 2. Update createChangelogEntry Mutation
**File**: `packages/cms-workflows/src/mutations/changelog.ts`

**Add to mutation value object:**
```typescript
value: {
  // ... existing fields ...
  // New AEO fields
  ...(data.featuredImageId && {
    featuredImage: { type: "image", value: data.featuredImageId },
  }),
  ...(data.publishedAt && {
    publishedAt: { type: "date", value: data.publishedAt },
  }),
  ...(data.excerpt && {
    excerpt: { type: "text", value: data.excerpt },
  }),
  ...(data.tldr && {
    tldr: { type: "text", value: data.tldr },
  }),
  ...(data.seo && {
    seo: {
      type: "component",
      value: {
        metaTitle: { type: "text", value: data.seo.metaTitle ?? null },
        metaDescription: { type: "text", value: data.seo.metaDescription ?? null },
        focusKeyword: { type: "text", value: data.seo.focusKeyword ?? null },
        secondaryKeywords: { type: "text", value: data.seo.secondaryKeywords ?? null },
        canonicalUrl: { type: "text", value: data.seo.canonicalUrl ?? null },
        noIndex: { type: "boolean", value: data.seo.noIndex ?? false },
        faq: data.seo.faq ? {
          type: "list",
          value: data.seo.faq.map(item => ({
            type: "component",
            value: {
              question: { type: "text", value: item.question },
              answer: { type: "text", value: item.answer },
            },
          })),
        } : null,
      },
    },
  }),
}
```

#### 3. Update updateChangelogEntry Mutation
**File**: `packages/cms-workflows/src/mutations/changelog.ts`

Apply same pattern for partial updates to new fields.

### Success Criteria:

#### Automated Verification:
- [x] Package builds successfully: `pnpm --filter @repo/cms-workflows build`
- [x] Typecheck passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Create test changelog entry with all new fields via mutation
- [ ] Verify fields appear correctly in BaseHub dashboard

---

## Phase 4: Changelog Page AEO Enhancements

### Overview
Update the changelog pages to use new SEO fields and implement AEO patterns from blog.

### Changes Required:

#### 1. Enhanced generateMetadata
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

**Replace generateMetadata function (lines 27-54):**
```typescript
export async function generateMetadata({
  params,
}: ChangelogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await changelog.getEntryBySlug(slug);

  if (!entry) return {};

  // Use SEO fields with fallbacks
  const title = entry.seo?.metaTitle || entry._title || "Changelog";
  const description = entry.seo?.metaDescription ||
    entry.excerpt ||
    entry.tldr ||
    entry.body?.plainText?.slice(0, 160) ||
    `${entry._title} - Lightfast changelog update`;

  const canonicalUrl = entry.seo?.canonicalUrl ||
    `https://lightfast.ai/changelog/${slug}`;
  const ogImage = entry.featuredImage?.url || "https://lightfast.ai/og.jpg";
  const publishedTime = entry.publishedAt || entry._sys?.createdAt;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      types: {
        "application/rss+xml": [
          { url: "https://lightfast.ai/changelog/rss.xml", title: "RSS 2.0" },
        ],
        "application/atom+xml": [
          { url: "https://lightfast.ai/changelog/atom.xml", title: "Atom" },
        ],
      },
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Lightfast",
      publishedTime: publishedTime ?? undefined,
      images: [
        {
          url: ogImage,
          width: entry.featuredImage?.width ?? 1200,
          height: entry.featuredImage?.height ?? 630,
          alt: entry.featuredImage?.alt ?? title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      creator: "@lightfastai",
    },
    ...(entry.seo?.noIndex ? { robots: { index: false } } : {}),
  } satisfies Metadata;
}
```

#### 2. Enhanced Structured Data with FAQ Schema
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

**Update structured data generation inside the component (around line 93):**
```typescript
// Generate base structured data
const baseStructuredData = {
  "@context": "https://schema.org" as const,
  "@type": "SoftwareApplication" as const,
  name: "Lightfast",
  applicationCategory: "DeveloperApplication",
  releaseNotes: `https://lightfast.ai/changelog/${slug}`,
  ...(publishedTime ? { datePublished: new Date(publishedTime).toISOString() } : {}),
  ...(entry.slug ? { softwareVersion: entry.slug } : {}),
  description: entry.seo?.metaDescription ||
    entry.excerpt ||
    entry.tldr ||
    entry.body?.plainText?.slice(0, 160) ||
    entry._title ||
    "Lightfast changelog entry",
  ...(entry.featuredImage?.url ? {
    image: {
      "@type": "ImageObject" as const,
      url: entry.featuredImage.url,
      ...(entry.featuredImage.width ? { width: entry.featuredImage.width } : {}),
      ...(entry.featuredImage.height ? { height: entry.featuredImage.height } : {}),
    },
  } : {}),
  offers: {
    "@type": "Offer" as const,
    price: "0",
    priceCurrency: "USD",
  },
};

// Generate FAQ schema if FAQ items exist
const faqSchema = entry.seo?.faq?.items && entry.seo.faq.items.length > 0 ? {
  "@type": "FAQPage" as const,
  mainEntity: entry.seo.faq.items
    .filter(item => item.question && item.answer)
    .map(item => ({
      "@type": "Question" as const,
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer" as const,
        text: item.answer,
      },
    })),
} : null;

// Combine schemas
const structuredData = faqSchema
  ? {
      "@context": "https://schema.org",
      "@graph": [baseStructuredData, faqSchema],
    }
  : baseStructuredData;
```

#### 3. Add TL;DR Block and Featured Image
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

**Add after the h1 title, before body content:**
```typescript
{/* TL;DR Summary for AEO */}
{entry.tldr && (
  <div className="bg-muted/50 border rounded-lg p-4 mt-6">
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
      TL;DR
    </h2>
    <p className="text-foreground/90 leading-relaxed">
      {entry.tldr}
    </p>
  </div>
)}

{/* Featured Image */}
{entry.featuredImage?.url && (
  <div className="relative aspect-video rounded-lg overflow-hidden mt-8">
    <Image
      src={entry.featuredImage.url}
      alt={entry.featuredImage.alt || entry._title || ""}
      width={entry.featuredImage.width || 1200}
      height={entry.featuredImage.height || 630}
      className="w-full h-full object-cover"
      priority
    />
  </div>
)}
```

#### 4. Update Changelog Listing Page
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx`

**Add excerpt display and featured image thumbnails to entry cards:**
```typescript
{/* After the title h2 */}
{item.excerpt && (
  <p className="text-foreground/70 mt-2 line-clamp-2">
    {item.excerpt}
  </p>
)}

{/* Optional: Featured image thumbnail */}
{item.featuredImage?.url && (
  <div className="relative aspect-video rounded-lg overflow-hidden mt-4 max-w-sm">
    <Image
      src={item.featuredImage.url}
      alt={item.featuredImage.alt || item._title || ""}
      width={400}
      height={225}
      className="w-full h-full object-cover"
    />
  </div>
)}
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build:www`
- [x] Typecheck passes: `pnpm --filter @lightfast/www typecheck`
- [ ] Lint passes: `pnpm lint` (pre-existing style issues unrelated to AEO changes)

#### Manual Verification:
- [ ] Changelog entry page shows TL;DR block when populated
- [ ] Featured image renders correctly
- [ ] View page source shows complete JSON-LD with FAQ schema
- [ ] Google Rich Results Test passes for test entry
- [ ] OpenGraph preview shows featured image

---

## Phase 5: Feed Enhancement

### Overview
Update RSS/Atom feeds to include new metadata fields.

### Changes Required:

#### 1. Update Feed Generator
**File**: `apps/www/src/lib/feeds/generate-changelog-feed.ts`

**Enhanced feed item mapping:**
```typescript
entries.slice(0, 50).forEach((entry) => {
  const publishedDate = entry.publishedAt
    ? new Date(entry.publishedAt)
    : entry._sys?.createdAt
      ? new Date(entry._sys.createdAt)
      : buildDate;

  feed.addItem({
    title: entry._title ?? "Untitled",
    id: `${baseUrl}/changelog/${entry.slug || entry._slug}`,
    link: `${baseUrl}/changelog/${entry.slug || entry._slug}`,
    description: entry.excerpt ||
      entry.tldr ||
      entry.body?.plainText?.slice(0, 300) ||
      "Changelog update",
    date: publishedDate,
    ...(entry.featuredImage?.url ? { image: entry.featuredImage.url } : {}),
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build:www`

#### Manual Verification:
- [ ] RSS feed at `/changelog/rss.xml` includes new description field
- [ ] Feed validator passes (https://validator.w3.org/feed/)

---

## Testing Strategy

### Automated Tests:
- Type compilation via `pnpm typecheck`
- Build verification via `pnpm build:www`
- Lint checks via `pnpm lint`

### Manual Testing Steps:
1. Create a test changelog entry in BaseHub with all new fields populated:
   - Title: "Test AEO Changelog Entry"
   - Slug: "test-aeo-entry"
   - TL;DR: "This release adds webhook-driven sync with sub-minute latency for repositories with 100k+ files."
   - Excerpt: "Major infrastructure upgrade enabling real-time repository synchronization."
   - Featured Image: Upload test image
   - SEO fields: metaTitle, metaDescription, focusKeyword
   - FAQ: 2-3 question/answer pairs

2. Visit `/changelog/test-aeo-entry` and verify:
   - TL;DR block renders at top
   - Featured image displays
   - Page title and description use SEO fields

3. View page source and validate:
   - JSON-LD contains SoftwareApplication schema
   - JSON-LD contains FAQPage schema in @graph
   - OpenGraph meta tags use SEO fields

4. Test with external validators:
   - Google Rich Results Test: https://search.google.com/test/rich-results
   - Schema.org Validator: https://validator.schema.org/
   - Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
   - Twitter Card Validator: https://cards-dev.twitter.com/validator

5. Check RSS feed at `/changelog/rss.xml`:
   - New entry appears with enhanced description
   - Validate with https://validator.w3.org/feed/

---

## Performance Considerations

- Featured images should use Next.js Image component for automatic optimization
- `blurDataURL` from BaseHub provides placeholder during image load
- RSS feed limited to 50 entries to prevent large payload
- Page revalidation set to 300s (5 minutes) for ISR balance

---

## Migration Notes

- Existing changelog entries will continue to work (all new fields optional)
- Gradual migration: new fields can be populated as entries are updated
- No database migration required (BaseHub handles schema)
- No breaking changes to existing pages or feeds

---

## References

- Research document: `thoughts/shared/research/2025-12-17-web-analysis-changelog-skill-profound-optimization.md`
- Blog SEO implementation: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`
- Blog CMS types: `vendor/cms/index.ts:113-160`
- Changelog mutations: `packages/cms-workflows/src/mutations/changelog.ts`
- FAQ schema pattern: Blog page lines 118-137

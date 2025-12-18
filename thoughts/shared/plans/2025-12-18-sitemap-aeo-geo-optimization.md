# Sitemap AEO/GEO Optimization Implementation Plan

## Overview

Optimize sitemap.xml for AI search engines (ChatGPT, Perplexity, Copilot) by implementing accurate `lastModified` dates and appropriate `changeFrequency` values based on research findings. AI platforms cite content that is 25.7% fresher than traditional search results, and ChatGPT shows 76.4% recency bias.

## Current State Analysis

### Console Sitemap (`apps/console/src/app/sitemap.ts`)

| Entry Type | Current lastModified | Current Frequency | Current Priority | Issues |
|------------|---------------------|-------------------|------------------|--------|
| Homepage | `new Date()` | monthly | 1.0 | False freshness signal |
| Core marketing | `new Date()` | weekly | 0.8-0.9 | False freshness signal |
| Feature pages | `new Date()` | monthly | 0.85 | False freshness signal |
| Use case pages | `new Date()` | monthly | 0.85 | False freshness signal |
| Documentation | `new Date()` | weekly | 0.7-0.8 | False freshness signal |
| Blog listing | `new Date()` | weekly | 0.8 | False freshness signal |
| Blog posts | `publishedAt` | weekly | 0.7-0.95 | Missing `lastModifiedAt` |
| Changelog listing | `new Date()` | weekly | 0.7 | False freshness signal |
| Changelog entries | `publishedAt`/`createdAt` | **monthly** | 0.6 | Missing `lastModifiedAt`, frequency too low |
| Search | `new Date()` | monthly | 0.6 | False freshness signal |
| Legal pages | `_sys.lastModifiedAt` | monthly | 0.5 | **Correct** |
| Auth pages | `new Date()` | yearly | 0.3 | OK - functional pages |

### CMS Fragments (`vendor/cms/index.ts`)

| Content Type | Fetches `_sys.lastModifiedAt`? | Status |
|--------------|-------------------------------|--------|
| Legal pages | Yes (line 277) | Correct |
| Changelog entries | No (only `createdAt`) | Needs update |
| Blog posts | No (`_sys` not fetched) | Needs update |

## Desired End State

After implementation:
1. **CMS content** (blog, changelog, legal): Uses `_sys.lastModifiedAt` for accurate freshness signals
2. **Listing pages** (blog listing, changelog listing): Derives `lastModified` from most recent entry
3. **Static pages**: Omits `lastModified` entirely (no false signals - per Google guidance, no date is better than inaccurate date)
4. Changelog entries use `weekly` frequency to signal time-sensitive content
5. Priority values reflect content importance for AI citations

### Key Principle

The research explicitly warns: **"Do not fake recency; inaccurate timestamps erode trust signals"** and **"Google detects and ignores manipulated lastmod values"**.

Our approach:
- **CMS content**: Accurate `lastModifiedAt` from CMS
- **Listing pages**: Derived from most recent entry (accurate - the listing DID change when new content was added)
- **Static pages**: Omit entirely rather than provide false signals

### Verification

1. Run sitemap generation: `curl https://lightfast.ai/sitemap.xml`
2. Verify CMS content has accurate modification dates
3. Verify listing pages derive dates from most recent entry
4. Verify static pages have no `lastModified` field
5. Verify changelog frequency is `weekly`

## What We're NOT Doing

- Fixed hardcoded dates for static pages (becomes stale, maintenance burden)
- Dynamic priority based on changelog recency (can be added later)
- Automated lastModified tracking for static pages via git (complex)
- Changes to the chat app sitemap (minimal content)
- Changes to docs sitemap (managed by Fumadocs)

## Implementation Approach

Two phases:
1. **Phase 1**: Update CMS fragments to fetch `lastModifiedAt` for changelog and blog entries
2. **Phase 2**: Update sitemap.ts with accurate dates, derived listing dates, and omit static page dates

---

## Phase 1: Update CMS Fragments for lastModifiedAt

### Overview
Add `_sys.lastModifiedAt` to changelog and blog post fragments so the sitemap can use accurate modification dates.

### Changes Required:

#### 1. Update Changelog Fragment
**File**: `vendor/cms/index.ts`
**Lines**: 371-378

**Current** (line 371-378):
```typescript
const changelogEntryMetaFragment = fragmentOnLoose("ChangelogPagesItem", {
  _slug: true,
  _title: true,
  slug: true,
  _sys: {
    createdAt: true,
  },
});
```

**New**:
```typescript
const changelogEntryMetaFragment = fragmentOnLoose("ChangelogPagesItem", {
  _slug: true,
  _title: true,
  slug: true,
  _sys: {
    createdAt: true,
    lastModifiedAt: true,
  },
});
```

#### 2. Update Changelog Type Definition
**File**: `vendor/cms/index.ts`
**Lines**: 415-420

**Current** (line 415-420):
```typescript
export type ChangelogEntryMeta = {
  _slug?: string | null;
  _title?: string | null;
  slug?: string | null;
  _sys?: { createdAt?: string | null } | null;
};
```

**New**:
```typescript
export type ChangelogEntryMeta = {
  _slug?: string | null;
  _title?: string | null;
  slug?: string | null;
  _sys?: {
    createdAt?: string | null;
    lastModifiedAt?: string | null;
  } | null;
};
```

#### 3. Update Blog Post Meta Fragment
**File**: `vendor/cms/index.ts`
**Lines**: 69-84

**Current** (line 69-84):
```typescript
const postMetaFragment = fragmentOnLoose("PostItem", {
  _slug: true,
  _title: true,
  slug: true,
  authors: {
    _title: true,
    avatar: imageFragment,
    xUrl: true,
  },
  categories: {
    _title: true,
  },
  publishedAt: true,
  description: true,
  featuredImage: imageFragment,
});
```

**New**:
```typescript
const postMetaFragment = fragmentOnLoose("PostItem", {
  _slug: true,
  _title: true,
  slug: true,
  _sys: {
    lastModifiedAt: true,
  },
  authors: {
    _title: true,
    avatar: imageFragment,
    xUrl: true,
  },
  categories: {
    _title: true,
  },
  publishedAt: true,
  description: true,
  featuredImage: imageFragment,
});
```

#### 4. Update PostMeta Type Definition
**File**: `vendor/cms/index.ts`
**Lines**: 113-138

**Current** (lines 113-138):
```typescript
export type PostMeta = {
  _slug?: string | null;
  _title?: string | null;
  slug?: string | null;
  authors?: Array<{
    _title?: string | null;
    avatar?: {
      url?: string | null;
      width?: number | null;
      height?: number | null;
      alt?: string | null;
      blurDataURL?: string | null;
    } | null;
    xUrl?: string | null;
  }>;
  categories?: Array<{ _title?: string | null }>;
  publishedAt?: string | null;
  description?: string | null;
  featuredImage?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    blurDataURL?: string | null;
  } | null;
};
```

**New**:
```typescript
export type PostMeta = {
  _slug?: string | null;
  _title?: string | null;
  slug?: string | null;
  _sys?: {
    lastModifiedAt?: string | null;
  } | null;
  authors?: Array<{
    _title?: string | null;
    avatar?: {
      url?: string | null;
      width?: number | null;
      height?: number | null;
      alt?: string | null;
      blurDataURL?: string | null;
    } | null;
    xUrl?: string | null;
  }>;
  categories?: Array<{ _title?: string | null }>;
  publishedAt?: string | null;
  description?: string | null;
  featuredImage?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    blurDataURL?: string | null;
  } | null;
};
```

### Success Criteria:

#### Automated Verification:
- [x] Build CMS package: `pnpm --filter @vendor/cms build`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [x] Verify CMS queries return `lastModifiedAt` field for changelog entries
- [x] Verify CMS queries return `lastModifiedAt` field for blog posts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Update Sitemap with Accurate Dates and Frequencies

### Overview
Update the sitemap to:
1. Use `lastModifiedAt` for CMS content (blog posts, changelog entries)
2. Derive `lastModified` for listing pages from most recent entry
3. Omit `lastModified` for static pages (honest approach - no false signals)
4. Update `changeFrequency` and `priority` values appropriately

### Changes Required:

#### 1. Add Helper Function for Getting Most Recent Date
**File**: `apps/console/src/app/sitemap.ts`
**Location**: After `getCategoryPriority` function (around line 32)

**New** (add after line 32):
```typescript
/**
 * Get the most recent lastModified date from CMS entries.
 * Used for listing pages to accurately reflect when the listing changed.
 *
 * @param entries - Array of CMS entries with optional date fields
 * @returns Most recent date or undefined if no dates available
 */
function getMostRecentDate(
  entries: Array<{
    _sys?: { lastModifiedAt?: string | null; createdAt?: string | null } | null;
    publishedAt?: string | null;
  }>,
): Date | undefined {
  if (entries.length === 0) return undefined;

  // Entries are already sorted by date (newest first) from CMS
  const mostRecent = entries[0];
  if (!mostRecent) return undefined;

  if (mostRecent._sys?.lastModifiedAt) {
    return new Date(mostRecent._sys.lastModifiedAt);
  }
  if (mostRecent.publishedAt) {
    return new Date(mostRecent.publishedAt);
  }
  if (mostRecent._sys?.createdAt) {
    return new Date(mostRecent._sys.createdAt);
  }
  return undefined;
}
```

#### 2. Update Static Pages - Remove lastModified
**File**: `apps/console/src/app/sitemap.ts`
**Lines**: 56-145

Per Google's guidance and the research: "If you can't provide accurate lastmod dates, it's better to omit them entirely."

**Homepage** (lines 57-63):
```typescript
// Homepage - highest priority
{
  url: base,
  changeFrequency: "weekly",
  priority: 1.0,
},
```

**Core marketing pages** (lines 64-76):
```typescript
// Core marketing pages
{
  url: `${base}/pricing`,
  changeFrequency: "weekly",
  priority: 0.9,
},
{
  url: `${base}/early-access`,
  changeFrequency: "monthly",
  priority: 0.8,
},
```

**Feature pages** (lines 77-101):
```typescript
// Feature pages
{
  url: `${base}/features/agents`,
  changeFrequency: "monthly",
  priority: 0.85,
},
{
  url: `${base}/features/connectors`,
  changeFrequency: "monthly",
  priority: 0.85,
},
{
  url: `${base}/features/memory`,
  changeFrequency: "monthly",
  priority: 0.85,
},
{
  url: `${base}/features/timeline`,
  changeFrequency: "monthly",
  priority: 0.85,
},
```

**Use case pages** (lines 102-120):
```typescript
// Use case pages
{
  url: `${base}/use-cases/technical-founders`,
  changeFrequency: "monthly",
  priority: 0.85,
},
{
  url: `${base}/use-cases/founding-engineers`,
  changeFrequency: "monthly",
  priority: 0.85,
},
{
  url: `${base}/use-cases/agent-builders`,
  changeFrequency: "monthly",
  priority: 0.85,
},
```

**Documentation pages** (lines 121-145):
```typescript
// Documentation
{
  url: `${base}/docs`,
  changeFrequency: "weekly",
  priority: 0.8,
},
{
  url: `${base}/docs/get-started/quickstart`,
  changeFrequency: "weekly",
  priority: 0.7,
},
{
  url: `${base}/docs/get-started/config`,
  changeFrequency: "weekly",
  priority: 0.7,
},
{
  url: `${base}/docs/api-reference`,
  changeFrequency: "weekly",
  priority: 0.7,
},
```

**Search page** (lines 186-191):
```typescript
// Search
{
  url: `${base}/search`,
  changeFrequency: "monthly",
  priority: 0.6,
},
```

**Auth pages** (lines 204-216):
```typescript
// Auth pages (lower priority as they're functional)
{
  url: `${base}/sign-in`,
  changeFrequency: "yearly",
  priority: 0.3,
},
{
  url: `${base}/sign-up`,
  changeFrequency: "yearly",
  priority: 0.3,
},
```

#### 3. Update Blog Listing Page - Derive from Most Recent Post
**File**: `apps/console/src/app/sitemap.ts`
**Lines**: 146-152

**Current** (lines 146-152):
```typescript
// Blog listing page
{
  url: `${base}/blog`,
  lastModified: new Date(),
  changeFrequency: "weekly",
  priority: 0.8,
},
```

**New**:
```typescript
// Blog listing page - uses most recent post's date (accurate: listing changes when new post added)
{
  url: `${base}/blog`,
  ...(getMostRecentDate(blogPosts) && { lastModified: getMostRecentDate(blogPosts) }),
  changeFrequency: "weekly",
  priority: 0.8,
},
```

#### 4. Update Blog Posts Section
**File**: `apps/console/src/app/sitemap.ts`
**Lines**: 154-165

**Current** (lines 154-165):
```typescript
// Individual blog posts from CMS
...blogPosts
  .filter((post) => !!post.slug || !!post._slug)
  .map((post) => {
    const slug = post.slug ?? post._slug ?? "";

    return {
      url: `${base}/blog/${slug}`,
      lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: getCategoryPriority(post.categories),
    };
  }),
```

**New**:
```typescript
// Individual blog posts from CMS
// Uses lastModifiedAt for accurate freshness signals (AEO/GEO optimization)
...blogPosts
  .filter((post) => !!post.slug || !!post._slug)
  .map((post) => {
    const slug = post.slug ?? post._slug ?? "";
    const lastModified = post._sys?.lastModifiedAt
      ? new Date(post._sys.lastModifiedAt)
      : post.publishedAt
        ? new Date(post.publishedAt)
        : undefined;

    return {
      url: `${base}/blog/${slug}`,
      ...(lastModified && { lastModified }),
      changeFrequency: "weekly" as const,
      priority: getCategoryPriority(post.categories),
    };
  }),
```

#### 5. Update Changelog Listing Page - Derive from Most Recent Entry
**File**: `apps/console/src/app/sitemap.ts`
**Lines**: 166-172

**Current** (lines 166-172):
```typescript
// Changelog listing
{
  url: `${base}/changelog`,
  lastModified: new Date(),
  changeFrequency: "weekly",
  priority: 0.7,
},
```

**New**:
```typescript
// Changelog listing - uses most recent entry's date (accurate: listing changes when new entry added)
{
  url: `${base}/changelog`,
  ...(getMostRecentDate(changelogEntries) && { lastModified: getMostRecentDate(changelogEntries) }),
  changeFrequency: "weekly",
  priority: 0.8,
},
```

**Changes**: Increased priority from 0.7 to 0.8 (changelog aggregates time-sensitive content valuable for AI citations).

#### 6. Update Changelog Entries Section
**File**: `apps/console/src/app/sitemap.ts`
**Lines**: 174-185

**Current** (lines 174-185):
```typescript
// Individual changelog entries from CMS
...changelogEntries
  .filter((entry) => !!entry.slug)
  .map((entry) => ({
    url: `${base}/changelog/${entry.slug}`,
    lastModified: entry.publishedAt
      ? new Date(entry.publishedAt)
      : entry._sys?.createdAt
        ? new Date(entry._sys.createdAt)
        : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  })),
```

**New**:
```typescript
// Individual changelog entries from CMS
// Uses lastModifiedAt for accurate freshness signals (AEO/GEO optimization)
// AI search engines show 76.4% recency bias - accurate timestamps improve citation probability
...changelogEntries
  .filter((entry) => !!entry.slug)
  .map((entry) => {
    const lastModified = entry._sys?.lastModifiedAt
      ? new Date(entry._sys.lastModifiedAt)
      : entry.publishedAt
        ? new Date(entry.publishedAt)
        : entry._sys?.createdAt
          ? new Date(entry._sys.createdAt)
          : undefined;

    return {
      url: `${base}/changelog/${entry.slug}`,
      ...(lastModified && { lastModified }),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  }),
```

**Changes**:
1. Prioritize `lastModifiedAt` over `publishedAt` (accurate modification signal)
2. Change frequency from `monthly` to `weekly` (signals time-sensitive content)
3. Increase priority from 0.6 to 0.7 (changelogs are high-value for AI citations)
4. Only include `lastModified` if we have an actual date (no `new Date()` fallback)

### Success Criteria:

#### Automated Verification:
- [x] Build console app: `pnpm build:console`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [x] Start dev server and verify sitemap at `http://localhost:4107/sitemap.xml`
- [x] Verify CMS content (blog posts, changelog entries) has `lastModified` dates from CMS
- [x] Verify listing pages have dates derived from most recent entry
- [x] Verify static pages have NO `lastModified` field
- [x] Verify changelog frequency is `weekly`

**Implementation Note**: After completing this phase and all automated verification passes, deploy to production and verify sitemap at `https://lightfast.ai/sitemap.xml`.

---

## Testing Strategy

### Unit Tests:
N/A - sitemap generation is a runtime concern tested via integration

### Integration Tests:
- Start dev server and fetch sitemap
- Parse XML and verify structure

### Manual Testing Steps:
1. Run `pnpm dev:console` and navigate to `http://localhost:4107/sitemap.xml`
2. Verify changelog entries show `lastModifiedAt` values from CMS
3. Verify changelog `changeFrequency` is `weekly`
4. Verify blog/changelog listing pages have dates matching most recent entry
5. Verify static pages (homepage, features, use cases, docs, search, auth) have NO `<lastmod>` element
6. Refresh sitemap multiple times - listing page dates should be stable (not changing)
7. Deploy to production and verify at `https://lightfast.ai/sitemap.xml`

## Performance Considerations

None - sitemap generation is already optimized with parallel CMS queries.

## Migration Notes

No migration needed. Changes are purely additive:
- CMS fragments get new field (`lastModifiedAt`)
- Sitemap uses new field with fallbacks to existing fields
- Static pages simply omit the `lastModified` field (valid per sitemap spec)

## Summary of Changes

| Item | Before | After | Rationale |
|------|--------|-------|-----------|
| Changelog lastModified | `publishedAt`/`createdAt` | `lastModifiedAt` | Accurate freshness signal |
| Changelog frequency | monthly | **weekly** | Signals time-sensitive content |
| Changelog priority | 0.6 | **0.7** | Higher value for AI citations |
| Blog lastModified | `publishedAt` | `lastModifiedAt` | Accurate freshness signal |
| Listing pages lastModified | `new Date()` | **Derived from most recent entry** | Accurate - listing changes when content added |
| Static pages lastModified | `new Date()` | **Omitted** | No false signals - per Google guidance |
| Changelog listing priority | 0.7 | **0.8** | Aggregates time-sensitive content |

## Trade-off Analysis

### Why Omit lastModified for Static Pages?

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| A. Fixed dates (`new Date("2025-12-18")`) | Provides a date | Becomes inaccurate when page updates; maintenance burden |
| B. `new Date()` (current) | Always "fresh" | Gaming approach that research warns against; erodes trust |
| C. Build-time timestamp | Consistent per deploy | Requires infrastructure; still not content-accurate |
| D. **Omit entirely** (chosen) | Honest; spec-compliant | No freshness hint |

**Decision**: Option D is best because:
1. Research explicitly warns: "inaccurate timestamps erode trust signals"
2. Google "detects and ignores manipulated lastmod values"
3. Sitemap spec allows omitting `lastmod`
4. Search engines use other signals (crawl behavior, content changes) for static pages
5. Our CMS content with accurate dates will stand out more credibly

### Why Derive Listing Page Dates from Most Recent Entry?

The listing page **does** effectively change when new content is added. Using the most recent entry's date is:
- **Accurate**: The page content changed when the entry was added
- **Not gaming**: This reflects real content changes
- **Valuable**: Signals to AI crawlers when to re-index the listing

## References

- Research document: `thoughts/shared/research/2025-12-18-sitemap-lastmod-aeo-geo-optimization.md`
- Current sitemap: `apps/console/src/app/sitemap.ts`
- CMS package: `vendor/cms/index.ts`
- Bing AI Search guidance: "The lastmod field in your sitemap remains a key signal"
- Profound research: "AI platforms cite content that's 25.7% fresher"
- Google guidance: "If you can't provide accurate lastmod dates, omit them"

---

**Last Updated**: 2025-12-18
**Confidence Level**: High
**Next Steps**: Implement Phase 1 (CMS fragment updates), then Phase 2 (sitemap updates)

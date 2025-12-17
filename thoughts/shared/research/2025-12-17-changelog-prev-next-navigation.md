---
date: 2025-12-17T10:30:00+08:00
researcher: Claude
git_commit: 66f50efae56fdcccb2d9ef6f005ae6e995f58b6a
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Changelog Previous/Next Navigation Implementation"
tags: [research, codebase, changelog, navigation, cms]
status: complete
last_updated: 2025-12-17
last_updated_by: Claude
---

# Research: Changelog Previous/Next Navigation Implementation

**Date**: 2025-12-17T10:30:00+08:00
**Researcher**: Claude
**Git Commit**: 66f50efae56fdcccb2d9ef6f005ae6e995f58b6a
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question
How to add a previous/next navigation system at the bottom of the changelog entry page (`apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`), similar to the reference image showing "← Previous post" and "Next post →" with post titles.

## Summary

The changelog entry page currently lacks navigation between adjacent entries. The `@vendor/cms` module provides all necessary data via `changelog.getEntries()` which returns entries ordered by creation date (newest first). The implementation would require fetching all entries to determine adjacent items, then rendering a two-card navigation component at the bottom of the article content.

## Detailed Findings

### Current Changelog Entry Page Structure

**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

The page uses a server component pattern with the `<Feed>` component from `@vendor/cms/components/feed`:

```
Line 72-196:
├── <Feed queries={[changelog.entryBySlugQuery(slug)]}>
│   ├── Response processing (lines 74-90)
│   ├── <JsonLd /> for structured data (line 124)
│   └── <div className="max-w-7xl mx-auto px-4">
│       └── Grid layout (grid-cols-12)
│           ├── Version badge + date (md:col-span-2)
│           └── <article> (md:col-span-8, lg:col-span-6)
│               ├── Title
│               ├── Body content
│               ├── Accordion sections (improvements, fixes, etc.)
│               └── Reading time (line 184-188)
│                   ← NEW NAVIGATION WOULD GO HERE
```

### Changelog CMS API

**File**: `vendor/cms/index.ts:427-508`

Available methods on `changelog` object:

| Method | Returns | Description |
|--------|---------|-------------|
| `getEntries()` | `Promise<ChangelogEntry[]>` | All entries, ordered by `_sys_createdAt__DESC` |
| `getEntryBySlug(slug)` | `Promise<ChangelogEntry \| null>` | Single entry by custom slug |
| `getLatestEntry()` | `Promise<ChangelogEntry \| null>` | Most recent entry |
| `entriesQuery` | GraphQL fragment | Query for all entries |
| `entryBySlugQuery(slug)` | GraphQL fragment | Query for single entry |

**No existing method for adjacent entries** - would need to:
1. Fetch all entries via `getEntries()`
2. Find current entry's index
3. Access `entries[index + 1]` (previous/older) and `entries[index - 1]` (next/newer)

### Entry Ordering

**Note**: Entries should be ordered by `publishedAt` (custom required field), not `_sys.createdAt`.

Current queries use `orderBy: "_sys_createdAt__DESC"` (line 475, 484) but this should be updated to use `publishedAt__DESC` for correct chronological ordering.

With proper ordering by `publishedAt`:
- Index 0 = newest entry (most recent publishedAt)
- Last index = oldest entry
- "Previous" post (older) = `entries[currentIndex + 1]`
- "Next" post (newer) = `entries[currentIndex - 1]`

### Data Available on Each Entry

**Type**: `ChangelogEntry` (line 422-457)

```typescript
{
  _title?: string | null;
  slug?: string | null;          // Used in URLs: /changelog/{slug}
  _slug?: string | null;         // System slug
  _sys?: { createdAt?: string | null };
  publishedAt?: string | null;   // Custom required field for ordering/display
  body?: {
    plainText?: string | null;
    json?: { content?: any[]; toc?: any };
    readingTime?: number | null;
  };
  improvements?: string | null;
  infrastructure?: string | null;
  fixes?: string | null;
  patches?: string | null;
  // AEO fields
  excerpt?: string | null;
  tldr?: string | null;
  featuredImage?: { url, width, height, alt, blurDataURL };
  seo?: { metaTitle, metaDescription, focusKeyword, ... };
}
```

### Existing Navigation Patterns

#### 1. Pagination Component
**File**: `packages/ui/src/components/ui/pagination.tsx:69-101`

```typescript
function PaginationPrevious({ className, ...props }) {
  return (
    <PaginationLink className={cn("gap-1 px-2.5 sm:pl-2.5", className)} {...props}>
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  )
}

function PaginationNext({ className, ...props }) {
  return (
    <PaginationLink className={cn("gap-1 px-2.5 sm:pr-2.5", className)} {...props}>
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  )
}
```

#### 2. Back to List Navigation (Changelog Layout)
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/layout.tsx:1-24`

```typescript
<Button variant="secondary" className="rounded-full" size="lg" asChild>
  <Link href="/changelog" prefetch className="gap-2">
    <ArrowLeft className="h-4 w-4" />
    See all changelog
  </Link>
</Button>
```

#### 3. Blog Breadcrumbs with Schema.org
**File**: `apps/www/src/components/blog-breadcrumbs.tsx:1-57`

Uses `JsonLd` for structured data with BreadcrumbList schema.

### Reference Design (from user's image)

The target design shows:
- Two-column layout (previous on left, next on right)
- Dark card backgrounds with rounded corners
- "← Previous post" label with arrow
- "Next post →" label with arrow
- Post title displayed below each label
- Subtle text styling (muted for labels, brighter for titles)

### Placement in Current Grid

The article content uses:
```typescript
<article className="md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4 space-y-8">
```

The navigation component should be placed after the reading time display (line 188) and before the closing `</article>` tag (line 189).

## Code References

- `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx:67-197` - Entry page component
- `vendor/cms/index.ts:427-508` - Changelog CMS module
- `vendor/cms/index.ts:403-413` - ChangelogEntry type definition
- `vendor/cms/index.ts:428-435` - entriesQuery with ordering
- `packages/ui/src/components/ui/pagination.tsx:69-101` - Previous/Next component pattern
- `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/layout.tsx:1-24` - Back navigation pattern

## Architecture Documentation

### Current Data Flow

1. `generateStaticParams()` calls `changelog.getEntries()` to pre-render all entry pages
2. Page fetches single entry via `<Feed queries={[changelog.entryBySlugQuery(slug)]}>`
3. Entry data rendered inside server action callback

### Required Changes for Adjacent Navigation

1. **Option A: Additional Query in Page**
   - Call `changelog.getEntries()` inside the page
   - Find current index, extract adjacent entries
   - Pass to navigation component

2. **Option B: Add CMS Helper**
   - Add `getAdjacentEntries(slug)` method to `@vendor/cms`
   - Returns `{ previous?: ChangelogEntry; next?: ChangelogEntry }`

### UI Component Structure

Based on reference image and existing patterns:

```typescript
// Potential component structure
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
  {previousEntry && (
    <Link href={`/changelog/${previousEntry.slug}`} className="group">
      <div className="rounded-lg bg-card p-6 hover:bg-accent/5">
        <span className="text-muted-foreground">← Previous post</span>
        <h3 className="font-medium mt-1">{previousEntry._title}</h3>
      </div>
    </Link>
  )}
  {nextEntry && (
    <Link href={`/changelog/${nextEntry.slug}`} className="group md:text-right">
      <div className="rounded-lg bg-card p-6 hover:bg-accent/5">
        <span className="text-muted-foreground">Next post →</span>
        <h3 className="font-medium mt-1">{nextEntry._title}</h3>
      </div>
    </Link>
  )}
</div>
```

## Open Questions

1. Should the navigation component be a shared component (for reuse in blog posts) or changelog-specific?
2. Should adjacent entries be fetched via a new CMS helper or inline in the page?
3. Should the component handle the edge cases where previous/next doesn't exist (first/last entries)?
4. Should the navigation include the version badge (slug) like the reference shows with post dates?

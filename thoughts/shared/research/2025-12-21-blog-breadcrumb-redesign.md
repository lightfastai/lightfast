---
date: 2025-12-21T10:00:00+08:00
researcher: Claude
git_commit: e58ab98a76bead49ef75321338e560026a846d7a
branch: main
repository: lightfast
topic: "Blog Breadcrumb Redesign - Remove from listing, add to post pages"
tags: [research, codebase, blog, breadcrumbs, navigation]
status: complete
last_updated: 2025-12-21
last_updated_by: Claude
---

# Research: Blog Breadcrumb Redesign

**Date**: 2025-12-21T10:00:00+08:00
**Researcher**: Claude
**Git Commit**: e58ab98a76bead49ef75321338e560026a846d7a
**Branch**: main
**Repository**: lightfast

## Research Question

Rework the blog section to:
1. Remove breadcrumbs completely from the blog listing page (all posts + category filter views)
2. Add breadcrumbs on individual blog post pages, positioned where the category navigation sidebar appears on the listing page

## Summary

The blog section uses a route group structure with two distinct layouts:
- **Listing pages** (`(listing)/`) - Uses sidebar with category navigation and has breadcrumbs at top
- **Post pages** (`[slug]/`) - Uses a centered content layout with breadcrumbs inside the article

To achieve the desired design:
1. Remove `<DynamicBreadcrumbs>` from the listing layout
2. Restructure the post page to use a sidebar-style breadcrumb matching the listing page's left column

## Detailed Findings

### Directory Structure

```
apps/www/src/app/(app)/(marketing)/(content)/blog/
├── layout.tsx                     # Shared wrapper (minimal)
├── (listing)/
│   ├── layout.tsx                 # Listing layout with sidebar
│   ├── page.tsx                   # All posts view
│   └── topic/[category]/page.tsx  # Category filtered view
├── [slug]/
│   └── page.tsx                   # Individual post page
├── atom.xml, feed.xml, rss.xml    # RSS feeds
```

### Blog Listing Layout

**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/layout.tsx:1-46`

Current structure:
```
┌─────────────────────────────────────────────────────────────┐
│ <DynamicBreadcrumbs />  (Home > Blog > [Category])          │  ← REMOVE THIS
├─────────────────────────────────────────────────────────────┤
│ <h1>News and Updates about Lightfast</h1>   [RSS Feed btn]  │
├────────────────┬────────────────────────────────────────────┤
│ <CategoryNav>  │  {children}                                │
│ w-48           │  (posts listing)                           │
│                │                                            │
│ - All Posts    │                                            │
│ - Product      │                                            │
│ - Research     │                                            │
│ - Company      │                                            │
│ - News         │                                            │
└────────────────┴────────────────────────────────────────────┘
```

Key components used:
- `<DynamicBreadcrumbs categories={allCategories} />` - Line 19
- `<CategoryNav categories={allCategories} />` - Line 39

### Blog Post Page

**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx:1-461`

Current structure:
```
┌─────────────────────────────────────────────────────────────┐
│ <article className="max-w-7xl mx-auto px-4 pb-32 pt-8">     │
│   <Breadcrumbs items={...} />  (Home > Blog > Category)     │
│   ┌─────────────────────────────────────────────────────────┤
│   │      md:col-span-8 md:col-start-3                       │
│   │      lg:col-span-6 lg:col-start-4                       │
│   │                                                         │
│   │   <h1>Post Title</h1>                                   │
│   │   <p>Description</p>                                    │
│   │   Author info, date, reading time                       │
│   │   Social sharing                                        │
│   │   Content body                                          │
│   └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
```

Breadcrumb generation (lines 241-254):
```typescript
const breadcrumbItems: BreadcrumbItem[] = [
  { name: "Home", href: "/" },
  { name: "Blog", href: "/blog" },
];

const primaryCategory = post.categories?.[0];
if (primaryCategory?._title) {
  breadcrumbItems.push({ name: primaryCategory._title });
}

breadcrumbItems.push({ name: post._title || "Post" });
```

### Component Files

| Component | Path | Purpose |
|-----------|------|---------|
| Breadcrumbs | `apps/www/src/components/blog-breadcrumbs.tsx` | Static breadcrumb renderer with JSON-LD schema |
| DynamicBreadcrumbs | `apps/www/src/components/blog-dynamic-breadcrumbs.tsx` | Client component that builds breadcrumbs from pathname |
| CategoryNav | `apps/www/src/components/blog-category-nav.tsx` | Sidebar navigation for category filtering |

### Desired New Structure

**Blog Listing Page** (matches Image 1):
```
┌─────────────────────────────────────────────────────────────┐
│ <h1>Blog</h1>                                               │
├────────────────┬────────────────────────────────────────────┤
│ <CategoryNav>  │  {children}                                │
│ w-48           │  (posts listing)                           │
│                │                                            │
│ - All Posts    │  ┌──────────────────────────────────────┐  │
│ - Product      │  │ Graphite is joining Cursor           │  │
│ - Research     │  │ Company · Dec 19, 2025               │  │
│ - Company      │  └──────────────────────────────────────┘  │
│ - News         │                                            │
└────────────────┴────────────────────────────────────────────┘
```
Changes: Remove `<DynamicBreadcrumbs>`, possibly change title to just "Blog"

**Blog Post Page** (matches Image 2):
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
├────────────────┬────────────────────────────────────────────┤
│ Blog / Company │  <h1>Graphite is joining Cursor</h1>       │
│ (breadcrumb)   │  Dec 19, 2025 by Cursor Team              │
│ w-48           │                                            │
│                │  <article content>                         │
│                │                                            │
└────────────────┴────────────────────────────────────────────┘
```
Changes: Move breadcrumb to sidebar position, simplify to "Blog / Category" format

## Code References

### Files to Modify

1. `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/layout.tsx:19`
   - Remove `<DynamicBreadcrumbs categories={allCategories} />` line
   - Update title from "News and Updates about Lightfast" to "Blog"

2. `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx:261-266`
   - Restructure grid layout to include left sidebar for breadcrumb
   - Change from `grid-cols-1 md:grid-cols-12` to a flexbox like listing layout
   - Position breadcrumb in left column matching CategoryNav width (w-48)

3. `apps/www/src/components/blog-breadcrumbs.tsx`
   - May need to create a simplified version for post pages showing "Blog / Category"
   - Or modify to support a "compact" variant

### Styling Details

**CategoryNav sidebar width**: `w-48` (192px) with `flex-shrink-0`
**Gap between sidebar and content**: `gap-12` (48px)
**Max content width in listing**: `max-w-3xl`

## Architecture Documentation

The blog uses Next.js 14+ route groups:
- `(listing)` group applies the sidebar layout to `/blog` and `/blog/topic/[category]`
- `[slug]` is outside the group, so it has its own layout
- Shared `layout.tsx` at the blog root is minimal wrapper

Categories are fetched from `@vendor/cms` (BaseHub CMS) and passed to components.

## Related Files

- `apps/www/src/components/blog-dynamic-breadcrumbs.tsx` - Can be removed if not needed
- `vendor/cms/index.ts` - Category API exports
- `apps/www/src/lib/fonts.ts` - exposureTrial font used in listing title

# Blog Breadcrumb Redesign Implementation Plan

## Overview

Rework the blog section navigation to:
1. Remove breadcrumbs completely from the blog listing page (all posts + category filter views)
2. Add breadcrumbs on individual blog post pages, positioned in a left sidebar matching the CategoryNav width from the listing page

This aligns the blog section design with modern patterns (e.g., Cursor's blog) where listing pages have minimal navigation and post pages use a sidebar breadcrumb for consistent visual hierarchy.

## Current State Analysis

### Listing Layout (`apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/layout.tsx`)
- **Line 19**: Renders `<DynamicBreadcrumbs categories={allCategories} />` at top of page
- **Line 21-35**: Header with title "News and Updates about Lightfast" and RSS link
- **Line 37**: Two-column flex layout with `gap-12`
- **Line 39**: `<CategoryNav>` in left column (w-48, fixed width)
- **Line 42**: Main content area as `flex-1 min-w-0 max-w-3xl`

### Post Page (`apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`)
- **Line 261**: Container with `max-w-7xl mx-auto px-4 pb-32 pt-8`
- **Line 263**: Breadcrumbs rendered at top with `mb-8`
- **Line 265-266**: 12-column grid, content spans `md:col-span-8 md:col-start-3` / `lg:col-span-6 lg:col-start-4`
- **Lines 241-254**: Breadcrumb items built manually (Home > Blog > Category > Post Title)

### Key Discoveries
- `DynamicBreadcrumbs` is a client component using `usePathname()` for path detection
- `CategoryNav` uses fixed `w-48` width (192px) with `flex-shrink-0`
- Post page uses grid-based centering, not the flex sidebar pattern
- Categories in PostMeta don't include slugs, so category breadcrumb on posts can't link to category pages

## Desired End State

### Blog Listing Page
```
┌─────────────────────────────────────────────────────────────────┐
│ <h1>News and Updates about Lightfast</h1>   [RSS Feed]         │
├────────────────┬────────────────────────────────────────────────┤
│ <CategoryNav>  │  {children}                                    │
│ w-48           │  (posts listing)                               │
│                │                                                │
│ - All Posts    │  ┌──────────────────────────────────────────┐  │
│ - Product      │  │ Post Title                               │  │
│ - Research     │  │ Company · Dec 19, 2025                   │  │
│ - Company      │  └──────────────────────────────────────────┘  │
│ - News         │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

### Blog Post Page
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
├────────────────┬────────────────────────────────────────────────┤
│ Blog / Company │  <h1>Post Title</h1>                           │
│ (breadcrumb)   │  Dec 19, 2025 by Author                       │
│ w-48           │                                                │
│                │  <article content>                             │
│                │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

### Verification
- Listing pages show no breadcrumbs
- Post pages have breadcrumb in left sidebar at same width as CategoryNav (desktop) or above content (mobile)
- JSON-LD structured data preserved on post pages

## What We're NOT Doing

- Not changing the CategoryNav component
- Not adding breadcrumb links to categories on post pages (no slug available)
- Not creating a shared layout between listing and post pages
- Not modifying RSS feeds or other blog functionality
- Not changing the main blog listing content area styling

## Implementation Approach

The implementation requires two independent changes:
1. Remove breadcrumbs and simplify title in listing layout
2. Restructure post page to use flex layout with sidebar breadcrumb

Both changes are isolated and can be done in a single phase.

## Phase 1: Blog Breadcrumb Redesign

### Overview
Remove breadcrumbs from listing layout and restructure post page layout to use sidebar breadcrumb.

### Changes Required:

#### 1. Update Blog Listing Layout
**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/layout.tsx`
**Changes**:
- Remove `DynamicBreadcrumbs` import and usage (line 4 and line 19)
- Keep title as "News and Updates about Lightfast"

```tsx
import { exposureTrial } from "~/lib/fonts";
import { categories as categoriesAPI } from "@vendor/cms";
import { CategoryNav } from "~/components/blog-category-nav";
import { RssIcon } from "lucide-react";
import Link from "next/link";

export default async function BlogListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch categories once in the layout
  const allCategories = await categoriesAPI.getCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-32 pt-8">
      <div className="flex items-start justify-between mb-16 max-w-5xl mr-2">
        <h1
          className={`text-5xl font-light leading-[1.2] tracking-[-0.7] text-foreground max-w-2xl ${exposureTrial.className}`}
        >
          News and Updates about Lightfast
        </h1>
        <Link
          href="/blog/feed.xml"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </Link>
      </div>

      <div className="flex gap-12">
        {/* Category Navigation - shared across all listing pages */}
        <CategoryNav categories={allCategories} />

        {/* Main Content */}
        <main className="flex-1 min-w-0 max-w-3xl">{children}</main>
      </div>
    </div>
  );
}
```

#### 2. Create Sidebar Breadcrumb Component
**File**: `apps/www/src/components/blog-sidebar-breadcrumb.tsx`
**Changes**: New component for post page sidebar breadcrumb. Includes JSON-LD structured data (rendered only once) and responsive nav display.

```tsx
import Link from "next/link";
import { JsonLd, type BreadcrumbList, type WithContext } from "@vendor/seo/json-ld";

interface SidebarBreadcrumbProps {
  categoryName?: string | null;
  postTitle: string;
  postSlug: string;
}

export function SidebarBreadcrumb({
  categoryName,
  postTitle,
  postSlug,
}: SidebarBreadcrumbProps) {
  // Generate structured data for breadcrumbs
  const structuredData: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://lightfast.ai/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://lightfast.ai/blog",
      },
      ...(categoryName
        ? [
            {
              "@type": "ListItem" as const,
              position: 3,
              name: categoryName,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: categoryName ? 4 : 3,
        name: postTitle,
        item: `https://lightfast.ai/blog/${postSlug}`,
      },
    ],
  };

  const breadcrumbNav = (
    <nav
      aria-label="Breadcrumb"
      className="text-sm text-muted-foreground"
    >
      <Link
        href="/blog"
        className="hover:text-foreground transition-colors"
      >
        Blog
      </Link>
      {categoryName && (
        <>
          <span className="mx-1">/</span>
          <span className="text-foreground">{categoryName}</span>
        </>
      )}
    </nav>
  );

  return (
    <>
      {/* JSON-LD structured data - rendered once */}
      <JsonLd code={structuredData} />

      {/* Mobile: above content */}
      <div className="md:hidden mb-8">
        {breadcrumbNav}
      </div>

      {/* Desktop: left sidebar */}
      <div className="hidden md:block md:col-span-2 lg:col-span-3">
        <div className="w-48">
          {breadcrumbNav}
        </div>
      </div>
    </>
  );
}
```

#### 3. Restructure Blog Post Page Layout
**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`
**Changes**:
- Keep 12-column grid layout with `lg:col-span-6`
- Replace old Breadcrumbs with SidebarBreadcrumb (handles both mobile and desktop)
- SidebarBreadcrumb renders as first grid item, content as second

**Before (line 261-266):**
```tsx
<article className="max-w-7xl mx-auto px-4 pb-32 pt-8">
  <Breadcrumbs items={breadcrumbItems} className="mb-8" />
  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
    <div className="md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4">
```

**After:**
```tsx
<article className="max-w-7xl mx-auto px-4 pb-32 pt-8">
  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
    <SidebarBreadcrumb
      categoryName={primaryCategory?._title}
      postTitle={post._title || "Post"}
      postSlug={slug}
    />
    <div className="md:col-span-8 lg:col-span-6">
```

**Full changes to post page:**

1. Update imports (remove old Breadcrumbs, add SidebarBreadcrumb):
```tsx
import { SidebarBreadcrumb } from "~/components/blog-sidebar-breadcrumb";
// Remove: import { Breadcrumbs, type BreadcrumbItem } from "~/components/blog-breadcrumbs";
```

2. Remove breadcrumb building code (lines 241-254) - the SidebarBreadcrumb component handles this internally

3. Replace layout structure (lines 256-266):
```tsx
return (
  <>
    {/* Structured data for SEO */}
    <JsonLd code={structuredData as any} />

    <article className="max-w-7xl mx-auto px-4 pb-32 pt-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <SidebarBreadcrumb
          categoryName={primaryCategory?._title}
          postTitle={post._title || "Post"}
          postSlug={slug}
        />
        <div className="md:col-span-8 lg:col-span-6">
          {/* Header */}
          <header className="space-y-6">
            {/* ... rest of content unchanged ... */}
          </header>
          {/* ... rest of content unchanged ... */}
        </div>
      </div>
    </article>
  </>
);
```

4. Keep closing div structure as-is (no changes needed)

**Note**: The `SidebarBreadcrumb` component handles responsive display internally:
- On mobile: renders above the grid with `mb-8` spacing
- On desktop: renders as grid item with `md:col-span-2 lg:col-span-3` and `w-48` inner width

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/www lint` (pre-existing errors in other files, none in changed files)
- [x] Build succeeds: `pnpm build:www`
- [x] DynamicBreadcrumbs import removed from listing layout

#### Manual Verification:
- [ ] Visit `/blog` - no breadcrumbs visible, title shows "News and Updates about Lightfast"
- [ ] Visit `/blog/topic/company` - no breadcrumbs visible
- [ ] Visit any blog post (desktop) - breadcrumb appears in left sidebar at same width as CategoryNav
- [ ] Visit any blog post (mobile) - breadcrumb appears above content
- [ ] View page source on blog post - JSON-LD breadcrumb schema present
- [ ] RSS feed link still works on listing page

---

## Cleanup (Optional)

After verifying the changes work correctly, consider removing the unused `DynamicBreadcrumbs` component:

**File to remove**: `apps/www/src/components/blog-dynamic-breadcrumbs.tsx`

This component is no longer used after removing it from the listing layout.

---

## Testing Strategy

### Unit Tests:
- No unit tests needed - these are presentational components

### Integration Tests:
- N/A - no API changes

### Manual Testing Steps:
1. Navigate to `/blog` - verify no breadcrumbs, title is "News and Updates about Lightfast"
2. Click on a category (e.g., "Company") - verify no breadcrumbs on category page
3. Click on a blog post (desktop) - verify breadcrumb appears in left sidebar showing "Blog / Company"
4. Resize browser to mobile width - verify breadcrumb moves above content
5. Inspect page source on blog post - verify JSON-LD structured data present
6. Click RSS feed link - verify it still works

## References

- Original research: `thoughts/shared/research/2025-12-21-blog-breadcrumb-redesign.md`
- Listing layout: `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/layout.tsx`
- Post page: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`
- CategoryNav pattern: `apps/www/src/components/blog-category-nav.tsx`

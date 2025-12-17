# Changelog Previous/Next Navigation Implementation Plan

## Overview

Add a previous/next navigation component at the bottom of changelog entry pages to enable users to navigate between adjacent changelog entries without returning to the changelog list.

## Current State Analysis

### Changelog Entry Page
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

The page uses a `<Feed>` component (BaseHub Pump wrapper) that fetches a single entry via `changelog.entryBySlugQuery(slug)`. The current structure:
- Lines 213-305: Grid layout with 12 columns
- Left column (md:col-span-2): Version badge and date
- Main column (md:col-span-8, lg:col-span-6): Article content
- Line 302: Reading time is the last element before closing `</article>` tag

### CMS Module
**File**: `vendor/cms/index.ts:471-551`

Available methods:
- `getEntries()`: Returns all entries ordered by `_sys_createdAt__DESC`
- `getEntryBySlug(slug)`: Returns single entry by custom slug
- `entriesQuery`: GraphQL query for all entries

**Key observation**: Current queries use `_sys_createdAt__DESC` ordering (line 475), but entries have a `publishedAt` field that should be preferred for chronological ordering.

### Existing Navigation Patterns
- `apps/www/src/components/changelog-preview.tsx:64-88`: Card hover pattern with `hover:border-muted-foreground/20 hover:bg-accent/5`
- `packages/ui/src/components/ui/pagination.tsx:69-101`: ChevronLeft/ChevronRight icons for direction
- `apps/www/src/components/platform-access-cards.tsx:50-68`: Two-column grid card layout

## Desired End State

After implementation:
1. Each changelog entry page displays previous/next navigation at the bottom of the article
2. Navigation uses consistent design patterns from the codebase (hover states, card styling)
3. "Previous" links to the older entry, "Next" links to the newer entry
4. Edge cases handled gracefully (first/last entries show only one link)
5. Navigation is performant and doesn't add unnecessary data fetching

### Verification
- Visual: Navigation appears below reading time on `/changelog/[any-slug]`
- Navigation shows correct adjacent entries based on publication order
- First entry shows only "Next post" (to newer)
- Last entry shows only "Previous post" (to older)
- TypeScript passes: `pnpm --filter @lightfast/www typecheck`

## What We're NOT Doing

- Not adding navigation to blog posts (could be done later as separate task)
- Not creating a shared component at this time (changelog-specific is simpler)
- Not changing the ordering from `_sys_createdAt` to `publishedAt` (separate improvement)
- Not adding structured data (BreadcrumbList) for navigation
- Not adding keyboard shortcuts for prev/next navigation

## Implementation Approach

**Strategy**: Add a CMS helper method for adjacent entries and inline the navigation component in the changelog page.

The Feed component pattern requires async data access within a server action. We'll:
1. Add `getAdjacentEntries(slug)` helper to the CMS module
2. Call it within the Feed's render callback
3. Render a simple navigation component inline

## Phase 1: Add CMS Helper Method

### Overview
Add `getAdjacentEntries(slug)` method to return previous and next entries relative to the current entry.

### Changes Required:

#### 1. Add Type Definition
**File**: `vendor/cms/index.ts`
**Location**: After line 469 (after `ChangelogEntriesQueryResponse`)

```typescript
export type ChangelogAdjacentEntries = {
  previous?: ChangelogEntryMeta | null;
  next?: ChangelogEntryMeta | null;
};
```

#### 2. Add Query with Meta Fragment Only
**File**: `vendor/cms/index.ts`
**Location**: After line 479 (after `entriesQuery`)

```typescript
  entriesMetaQuery: fragmentOnLoose("Query", {
    changelogPages: {
      __args: {
        orderBy: "_sys_createdAt__DESC",
      },
      items: changelogEntryMetaFragment,
    },
  }),
```

#### 3. Add getAdjacentEntries Method
**File**: `vendor/cms/index.ts`
**Location**: After line 551 (after `getEntryBySlug`)

```typescript
  getAdjacentEntries: async (
    currentSlug: string,
  ): Promise<ChangelogAdjacentEntries> => {
    try {
      const data: any = await basehub.query(changelog.entriesMetaQuery as any);
      const entries = (data.changelogPages?.items ?? []) as ChangelogEntryMeta[];

      // Find current entry index
      const currentIndex = entries.findIndex(
        (entry) => entry.slug === currentSlug,
      );

      if (currentIndex === -1) {
        return { previous: null, next: null };
      }

      // Entries are ordered newest first (DESC), so:
      // - previous (older) = index + 1
      // - next (newer) = index - 1
      return {
        previous: entries[currentIndex + 1] ?? null,
        next: entries[currentIndex - 1] ?? null,
      };
    } catch {
      return { previous: null, next: null };
    }
  },
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript passes: `pnpm --filter @vendor/cms typecheck`
- [x] Build passes: `pnpm --filter @vendor/cms build`

#### Manual Verification:
- [x] N/A - this phase has no UI changes

---

## Phase 2: Add Navigation Component to Changelog Page

### Overview
Add the previous/next navigation UI at the bottom of the changelog entry article.

### Changes Required:

#### 1. Add Imports
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`
**Location**: After line 4

```typescript
import {
  changelog,
  type ChangelogEntryQueryResponse,
  type ChangelogAdjacentEntries,
} from "@vendor/cms";
```

Also add Link and icons:
```typescript
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
```

#### 2. Fetch Adjacent Entries in Render Callback
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`
**Location**: After line 114 (after `if (!entry) notFound();`)

```typescript
        // Fetch adjacent entries for navigation
        const adjacentEntries = await changelog.getAdjacentEntries(slug);
```

#### 3. Add Navigation Component Before Closing Article Tag
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`
**Location**: After line 302 (after reading time div, before `</article>`)

```typescript
                {/* Previous/Next Navigation */}
                {(adjacentEntries.previous || adjacentEntries.next) && (
                  <nav
                    aria-label="Changelog navigation"
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 pt-8 border-t"
                  >
                    {adjacentEntries.previous ? (
                      <Link
                        href={`/changelog/${adjacentEntries.previous.slug}`}
                        className="group"
                      >
                        <div className="h-full rounded-lg border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <ChevronLeft className="h-4 w-4" />
                            Previous post
                          </span>
                          <span className="block mt-1 font-medium text-foreground line-clamp-2">
                            {adjacentEntries.previous._title}
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <div />
                    )}
                    {adjacentEntries.next ? (
                      <Link
                        href={`/changelog/${adjacentEntries.next.slug}`}
                        className="group md:text-right"
                      >
                        <div className="h-full rounded-lg border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                          <span className="flex items-center justify-end gap-1 text-sm text-muted-foreground md:justify-end">
                            Next post
                            <ChevronRight className="h-4 w-4" />
                          </span>
                          <span className="block mt-1 font-medium text-foreground line-clamp-2">
                            {adjacentEntries.next._title}
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <div />
                    )}
                  </nav>
                )}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript passes: `pnpm --filter @lightfast/www typecheck`
- [x] Build passes: `pnpm build:www`
- [x] Lint passes: `pnpm lint` (pre-existing lint errors in other files, changelog page is clean)

#### Manual Verification:
- [ ] Start dev server: `pnpm dev:www`
- [ ] Navigate to `/changelog/[slug]` for a middle entry
- [ ] Verify both Previous and Next cards appear
- [ ] Navigate to the oldest entry
- [ ] Verify only "Next post" appears (no previous)
- [ ] Navigate to the newest entry
- [ ] Verify only "Previous post" appears (no next)
- [ ] Test hover states on navigation cards
- [ ] Verify links navigate to correct entries

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:
- N/A - Server component rendering tested via build/typecheck

### Integration Tests:
- N/A - Manual testing sufficient for this UI feature

### Manual Testing Steps:
1. Navigate to `/changelog` to see the list
2. Click on any entry that's not first or last
3. Verify both prev/next links appear at bottom
4. Click Previous - verify it goes to the correct older entry
5. Click Next - verify it goes to the correct newer entry
6. Navigate to the oldest entry - verify only "Next post" shows
7. Navigate to the newest entry - verify only "Previous post" shows
8. Test hover states look correct (border appears, background changes)

## Performance Considerations

- The `entriesMetaQuery` fetches only metadata (slug, title, dates) instead of full entry content
- This reduces payload size significantly compared to fetching full entries
- The query is made server-side, so no client bundle impact
- Results could be cached at the ISR level (already set to 300s)

## Migration Notes

N/A - This is a new feature with no data migration required.

## References

- Research document: `thoughts/shared/research/2025-12-17-changelog-prev-next-navigation.md`
- Changelog entry page: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`
- CMS module: `vendor/cms/index.ts:471-551`
- Navigation patterns: `apps/www/src/components/changelog-preview.tsx:64-88`

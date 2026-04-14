# Blog Listing: Featured Latest Post Implementation Plan

## Overview

Rework the blog listing page so the most recent blog post is promoted to a "featured" block (changelog-style large title + `aspect-video` featured image), while all remaining posts keep the existing card-style list.

## Current State Analysis

- `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx:100-138` currently sorts all blog pages by `publishedAt` desc and renders each as a uniform card (`rounded-xs border bg-card p-4`) with title, description, category, and date.
- `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx:139-179` is the style we're copying for the featured slot — specifically:
  - Title: `<h2 className="pb-4 font-medium font-pp text-2xl">` wrapping a `Button variant="link"` → `NavLink`.
  - Featured image: `<div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">` with `next/image` using `fill` + `object-cover`.
- `BlogPostSchema` already declares `featuredImage: z.string().startsWith("/images/").optional()` at `apps/www/src/lib/content-schemas.ts:106`, so the data plumbing exists.
- The only current blog post (`apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx`) already sets `featuredImage: "/images/changelog/v010-featured.png"`, so the featured slot will render today.

### Key Discoveries

- Cards live inside a `space-y-2` wrapper (`page.tsx:99`). The featured block needs its own spacing and should sit *above* the card list, so the top-level layout needs a small restructure.
- The changelog title uses the `Button asChild variant="link"` pattern to get hoverable link styling while keeping typography; the blog card title uses a plain `h2` inside a `NavLink`. We'll reuse the changelog's Button-in-heading pattern for the featured slot since the user wants the same visual treatment.
- `NavLink` and `Button` are already imported patterns; `next/image` is not currently imported in the blog listing page and will need adding.

## Desired End State

Visiting `/blog`:

1. If there is at least one post **and** the newest post has a `featuredImage`: render that post as a featured block (title + image only, no description/date/category), then render the remaining posts in the existing card list below.
2. If there is at least one post but the newest post has **no** `featuredImage`: render all posts (including the newest) in the existing card list — no featured block shown.
3. If there are zero posts: render the existing "Coming soon" empty state unchanged.

Only the **title** in the featured block is a link to the post; the featured image is decorative and not clickable.

Verification: inspecting `/blog` locally shows the latest post's title at `font-pp text-2xl` and an `aspect-video` image directly beneath, followed by the existing card list for the rest.

## What We're NOT Doing

- Not changing `BlogPostSchema`, MDX frontmatter, or any content files.
- Not adding description, category, date, version label, or author to the featured block (explicitly scoped out by the user).
- Not making the featured image clickable.
- Not changing the card styling for non-featured posts.
- Not touching the blog listing layout (`layout.tsx`), category nav, JSON-LD, or metadata.
- Not adding a new shared component / extraction — the featured block is inlined in the page.

## Implementation Approach

Single-file change. Split `sortedPages` into `[latest, ...rest]`, conditionally render the featured block when `latest?.data.featuredImage` is truthy (otherwise fall through to rendering all posts as cards), and render the remainder (or everything, in the fallback) in the existing `space-y-2` card list.

## Phase 1: Featured post block in blog listing

### Overview

Modify `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx` to conditionally render a featured block above the card list.

### Changes Required

#### 1. Imports

**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx`
**Changes**: Add `Image` from `next/image` and `Button` from `@repo/ui/components/ui/button` (mirror the changelog page's imports).

```tsx
import { Button } from "@repo/ui/components/ui/button";
import Image from "next/image";
```

#### 2. Split latest vs rest

**File**: same
**Changes**: After `sortedPages` is computed, derive the featured candidate and the remainder. Only treat the newest post as featured when it has a `featuredImage`; otherwise the remainder is the full list.

```tsx
const [latest, ...restPages] = sortedPages;
const featured =
  latest && latest.data.featuredImage ? latest : null;
const listPages = featured ? restPages : sortedPages;
```

#### 3. Render the featured block

**File**: same
**Changes**: Inside the returned JSX, place the featured block above the existing `space-y-2` card list and render it only when `featured` is truthy. Title uses the changelog pattern (`Button asChild variant="link"` → `NavLink`); image is an un-linked `aspect-video` container.

```tsx
{featured && featured.data.featuredImage && (
  <article className="mb-12 space-y-3" key={featured.slugs[0]}>
    <h2 className="pb-4 font-medium font-pp text-2xl">
      <Button
        asChild
        className="h-auto p-0 font-medium font-pp text-2xl"
        variant="link"
      >
        <NavLink href={`/blog/${featured.slugs[0]}` as Route}>
          {featured.data.title}
        </NavLink>
      </Button>
    </h2>
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
      <Image
        alt={featured.data.title}
        className="h-full w-full object-cover"
        fill
        src={featured.data.featuredImage}
      />
    </div>
  </article>
)}
```

#### 4. Render the remainder list

**File**: same
**Changes**: The existing `space-y-2` card list keeps its current markup, but iterates over `listPages` instead of `sortedPages`. The empty-state branch still triggers on `sortedPages.length === 0` (not on `listPages.length`), so we don't show "Coming soon" when only the featured post exists.

```tsx
<div className="space-y-2">
  {sortedPages.length === 0 ? (
    // existing "Coming soon" block, unchanged
  ) : (
    listPages.map((page) => (
      // existing card markup, unchanged
    ))
  )}
</div>
```

Note: wrap the featured block and the `space-y-2` card list in a React fragment (or the existing top-level fragment that also holds `<JsonLd />`) so we don't introduce an extra wrapper div.

### Success Criteria

#### Automated Verification

- [x] Type check passes: `pnpm --filter @lightfast/www typecheck`
- [x] Lint passes: `npx ultracite@latest check <file>` (www has no `check` script; repo-wide `pnpm check` = ultracite)
- [x] Build succeeds: `pnpm --filter @lightfast/www build`

#### Manual Verification

- [ ] `/blog` shows the latest post (`Why We Built Lightfast`) as a featured block: `font-pp text-2xl` title + `aspect-video` image, no description/date beneath.
- [ ] Clicking the featured **title** navigates to `/blog/2026-03-26-why-we-built-lightfast`.
- [ ] Clicking the featured **image** does nothing (not a link).
- [ ] The featured post does **not** also appear in the card list below.
- [ ] Remaining posts (once added) render in the existing card style below the featured block.
- [ ] Temporarily removing `featuredImage` from the latest post's frontmatter causes the featured block to disappear and the post to render as a card instead — confirm via local dev only, then revert.
- [ ] Empty state ("Coming soon") still renders if all blog posts are removed.
- [ ] JSON-LD, metadata, and RSS links in `<head>` are unchanged (no regressions from the refactor).

**Implementation Note**: After automated checks pass, pause for the manual checklist above before closing the task.

## Testing Strategy

### Manual Testing Steps

1. `pnpm dev:www` (port 4101) → open `/blog`.
2. Confirm featured block visually matches the changelog's title + image size.
3. Click featured title → lands on the post page; back-navigate and click the featured image → should not navigate.
4. Edit `apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx`, remove `featuredImage`, reload `/blog` → the post should now appear as a card at the top of the list with no featured block. Revert the edit.
5. Spot-check non-blog pages (`/changelog`, blog post detail) for zero regressions since the change is scoped to one file.

## Performance Considerations

- One additional `next/image` render on `/blog`. Page remains `export const dynamic = "force-static"`, so this is prerendered — no runtime cost.

## Migration Notes

None. No schema or content changes. Rollback = revert the single file.

## References

- Target file: `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx`
- Style source: `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx:139-179`
- Blog schema (already has `featuredImage`): `apps/www/src/lib/content-schemas.ts:106`
- Current blog post with image: `apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx`

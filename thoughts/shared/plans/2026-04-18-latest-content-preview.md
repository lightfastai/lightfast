# Latest Content Preview Implementation Plan

## Overview

Replace the landing page's `ChangelogPreview` component with a new `LatestContentPreview` component that surfaces a unified, time-sorted feed of the most recent blog posts and changelog entries. The new layout features one large 16:9 hero on the left for the most recent entry, plus three 1:1 square cards on the right for entries 2–4.

## Current State Analysis

- `apps/www/src/app/(app)/_components/changelog-preview.tsx:5-72` is an async server component that pulls only `getChangelogPages()`, sorts by `publishedAt` desc, takes the first 4, and renders them as a 3-column grid of cards (version badge + date + title).
- It is consumed in exactly one place: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:13` (import) and `:335` (usage), wrapped in a `<section className="w-full bg-background py-24 md:py-32">` with the inner container `mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24`.
- Both content collections expose identical loaders in `apps/www/src/app/(app)/(content)/_lib/source.ts:90-106`: `getBlogPages()` (`baseUrl: "/blog"`) and `getChangelogPages()` (`baseUrl: "/changelog"`).
- `BlogPostSchema` and `ChangelogEntrySchema` both extend `ContentPageSchema` (`apps/www/src/lib/content-schemas.ts:43-78`), so they share `title`, `description`, `publishedAt`, and the optional `featuredImage` (must start with `/images/`). Blog adds `category`; changelog adds `version` + `type`.
- A combined-sort + featured-hero pattern already exists in `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx:69-141` (sort by `publishedAt` desc, take latest as featured if it has `featuredImage`, otherwise drop into list). This is the template to follow.
- `NavLink` (`apps/www/src/components/nav-link.tsx`) is the existing internal-link primitive used by `changelog-preview.tsx`. It accepts a typed `Route` (from `next`) for internal links — both `/blog/${slug}` and `/changelog/${slug}` are internal, so `NavLink` handles both.
- Lightfast logo for the fallback hero image is `Icons.logoShort` from `@repo/ui/components/icons` (used 10+ times across `apps/www`, e.g. `apps/www/src/app/(app)/_components/app-navbar.tsx:25`).
- Content directories currently contain 1 blog (`apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx`) and 1 changelog entry (`apps/www/src/content/changelog/2026-03-26-lightfast-engineering-intelligence-shipped.mdx`); both have `featuredImage`. The component must render correctly today (only 2 entries, hero + nothing in squares) and scale as more are added.

## Desired End State

A new server component, `LatestContentPreview`, lives at `apps/www/src/app/(app)/_components/latest-content-preview.tsx` and:

1. Loads both blog and changelog entries, merges them into a unified list with their type (`"blog" | "changelog"`), and sorts by `publishedAt` descending.
2. Renders the section header `"Featured"` (no subtitle) above a 2/3 + 1/3 split:
   - **Left (≈2/3 width)**: A 16:9 tile with the most recent entry's `featuredImage` (or a `bg-card` block centered with `Icons.logoShort` if missing). Below it: the type badge ("Blog" or "Changelog"), the formatted date, and the entry title (links to `/blog/<slug>` or `/changelog/<slug>`).
   - **Right (≈1/3 width)**: A vertical column of up to three 1:1 square cards for entries 2–4. Each square shows the cropped `featuredImage` (or the same logo fallback), with type badge + date + title underneath.
3. Returns `null` only when zero combined entries exist.
4. Replaces `ChangelogPreview` in `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx` (import + usage). The old `changelog-preview.tsx` file is deleted.

### Verification
- `pnpm --filter=@lightfastai/www typecheck` passes.
- `pnpm --filter=@lightfastai/www check` passes.
- Landing page renders with the new layout: featured hero on the left, three squares on the right (currently only one square will populate since there are 2 entries total).
- All four cards link to the correct `/blog/<slug>` or `/changelog/<slug>` route.
- Removing `featuredImage` from an entry (manual test) shows the logo-fallback block in its place.

## Key Discoveries

- `BlogPageType` and `ChangelogPageType` are not exported from `source.ts`; the items returned by `getBlogPages()` / `getChangelogPages()` are inferred. The merged-list helper should derive the per-item shape via `ReturnType<typeof getBlogPages>[number]` instead of inventing a new type.
- `featuredImage` is optional on both schemas (`apps/www/src/lib/content-schemas.ts:48`), so the fallback path is required, not theoretical.
- The blog listing page (`apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx:111-141`) already uses `next/image` with `fill` + `object-cover` inside an `aspect-video` wrapper — copy that pattern.
- `next.Route` typing: `apps/www/src/app/(app)/_components/changelog-preview.tsx:45` casts `as Route` — same pattern needed for blog href since the typed-routes generator treats dynamic paths as `string` until cast.
- Section heading typography in the existing component (`changelog-preview.tsx:22`): `font-medium font-pp text-3xl text-foreground tracking-tight`. We keep this exact style for "Featured" to preserve visual rhythm with adjacent FAQ section.

## What We're NOT Doing

- Not paginating, filtering, or building a "see more" CTA — that's the job of the dedicated `/blog` and `/changelog` index pages.
- Not adding any new fields to `BlogPostSchema` or `ChangelogEntrySchema` — `featuredImage` already exists on both.
- Not introducing a shared "latest content" loader/helper in `_lib/source.ts` — the merge is small and only used here; lifting it now would be premature abstraction. If a second consumer appears later, refactor then.
- Not changing the surrounding section wrapper in `page.tsx` (padding, max-width). Only the inner component swap.
- Not handling the "no entries" placeholder beyond returning `null` — same behavior as the current component.
- Not building blog vs changelog as separate visual styles beyond a small text label/badge.
- Not modifying the changelog or blog list pages, RSS feeds, or schemas.

## Implementation Approach

A single-phase swap: build the new component using existing patterns from the blog listing page, wire it into the landing page, and delete the old file. No migration, no compatibility shim — there is exactly one consumer.

## Phase 1: Build, wire up, and delete the old component

### Overview

Create `latest-content-preview.tsx`, replace the import/usage in `page.tsx`, delete `changelog-preview.tsx`.

### Changes Required

#### 1. New component: `LatestContentPreview`

**File**: `apps/www/src/app/(app)/_components/latest-content-preview.tsx` (new)

**Behavior**:
- Async server component.
- Calls `getBlogPages()` and `getChangelogPages()`, tags each item with `kind: "blog" | "changelog"`, merges into a single array.
- Sorts merged array by `new Date(item.data.publishedAt).getTime()` descending.
- `slice(0, 4)`. If empty, return `null`.
- Renders header `"Featured"` then a responsive 2-column layout (`grid grid-cols-1 gap-4 lg:grid-cols-3`):
  - **Featured hero** spans `lg:col-span-2`, contains an `aspect-video` (16:9) wrapper.
  - **Squares column** spans `lg:col-span-1` and renders up to 3 `aspect-square` cards stacked vertically (`flex flex-col gap-4`).
- Each card (hero + square) is wrapped in `<NavLink>` pointing to `/blog/${slug}` or `/changelog/${slug}` (cast `as Route`).
- Image rendering: `next/image` with `fill` + `object-cover` inside the aspect wrapper. Fallback: `<div class="flex h-full w-full items-center justify-center bg-card">` containing `<Icons.logoShort className="h-10 w-10 text-muted-foreground" />` (square cards: `h-6 w-6`).
- Type badge: `<span class="inline-flex h-6 items-center rounded-md border border-border/50 px-2 text-muted-foreground text-xs">Blog</span>` (or `Changelog`). Reuses the existing badge style from `changelog-preview.tsx:52`, but with `border-border/50` per memory.

**Imports**:
```ts
import type { Route } from "next";
import Image from "next/image";
import { Icons } from "@repo/ui/components/icons";
import { getBlogPages, getChangelogPages } from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";
```

**Date formatter**: same `toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })` pattern as the existing component.

**Component sketch**:
```tsx
type FeedItem =
  | { kind: "blog"; page: ReturnType<typeof getBlogPages>[number] }
  | { kind: "changelog"; page: ReturnType<typeof getChangelogPages>[number] };

export async function LatestContentPreview() {
  const blogs: FeedItem[] = getBlogPages().map((page) => ({ kind: "blog", page }));
  const changelogs: FeedItem[] = getChangelogPages().map((page) => ({ kind: "changelog", page }));

  const merged = [...blogs, ...changelogs]
    .sort(
      (a, b) =>
        new Date(b.page.data.publishedAt).getTime() -
        new Date(a.page.data.publishedAt).getTime(),
    )
    .slice(0, 4);

  if (merged.length === 0) return null;

  const [featured, ...rest] = merged;

  return (
    <>
      <div className="mb-8">
        <h2 className="font-medium font-pp text-3xl text-foreground tracking-tight">
          Featured
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FeaturedCard item={featured} />
        <div className="flex flex-col gap-4">
          {rest.map((item) => (
            <SquareCard item={item} key={hrefFor(item)} />
          ))}
        </div>
      </div>
    </>
  );
}
```

`FeaturedCard` and `SquareCard` are local components in the same file (small, single-use — no separate file). `hrefFor(item)` is a tiny local helper that returns `(\`/${item.kind}/${item.page.slugs[0]}\`) as Route`.

#### 2. Wire into landing page

**File**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`

**Change at line 13**:
```ts
// before
import { ChangelogPreview } from "~/app/(app)/_components/changelog-preview";
// after
import { LatestContentPreview } from "~/app/(app)/_components/latest-content-preview";
```

**Change at line 335**:
```tsx
// before
<ChangelogPreview />
// after
<LatestContentPreview />
```

The surrounding `<section>` wrapper (lines 333–337) is unchanged.

#### 3. Delete the old component

**File**: `apps/www/src/app/(app)/_components/changelog-preview.tsx` — delete the file. (Confirmed via grep that `page.tsx` is the sole importer.)

### Success Criteria

#### Automated Verification
- [x] Type check passes: `pnpm --filter=@lightfast/www typecheck`
- [x] Lint/format passes on changed files: `npx ultracite@latest check apps/www/src/app/(app)/_components/latest-content-preview.tsx` (root has no per-package `check`; ran scoped). Pre-existing nursery-rule warning on `page.tsx:319` (FlowField div) is unrelated.
- [x] No remaining imports of `changelog-preview` in `apps/www/src`.
- [ ] Build succeeds: `pnpm build:www` (full Next.js build).

#### Manual Verification
- [ ] Landing page (`pnpm dev:www`, visit `http://localhost:4101`) renders the section heading "Featured" in place of the old "Changelog" header.
- [ ] The most recent of `{2026-03-26-why-we-built-lightfast.mdx, 2026-03-26-lightfast-engineering-intelligence-shipped.mdx}` appears as the 16:9 hero on the left at `lg` breakpoint and above. (They share a `publishedAt` date — sort order between them will be deterministic but arbitrary; verify whichever appears renders correctly.)
- [ ] The other entry appears as a 1:1 square in the right column. The remaining two square slots are absent (only 2 total entries today).
- [ ] Both entries display their `featuredImage` (`/images/blog/why-we-built-lightfast.png` and `/images/changelog/v010-featured.png`) cropped via `object-cover`.
- [ ] Type badge correctly reads "Blog" on the blog entry and "Changelog" on the changelog entry.
- [ ] Clicking the hero navigates to `/blog/2026-03-26-why-we-built-lightfast` or `/changelog/2026-03-26-lightfast-engineering-intelligence-shipped` accordingly.
- [ ] At `md` and below, layout collapses to a single column (hero on top, squares below) without overflow.
- [ ] Manually remove `featuredImage` line from one MDX file → page reloads → that entry's image slot now shows `Icons.logoShort` centered on `bg-card`. Restore the field afterward.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the rendered layout matches before considering the work complete.

---

## Testing Strategy

### Unit Tests
None added — this is a presentational server component with no branching logic worth isolating beyond what the manual checks already cover. The codebase has no existing test setup for these components (`apps/www/src/app/(app)/_components/` contains no `.test.tsx` files), so introducing one solely for this swap would be premature.

### Manual Testing Steps
1. `pnpm dev:www` and open `http://localhost:4101`. Scroll to the "Featured" section.
2. Verify hero, square, and link routing per the manual checks above.
3. Resize the viewport from desktop → tablet → mobile and confirm the layout collapses cleanly.
4. Temporarily delete the `featuredImage` frontmatter line from one MDX file, observe the logo fallback, restore.
5. (Optional, only if you have time) Add a third dummy MDX entry under `apps/www/src/content/blog/` with a recent `publishedAt` to verify the squares column populates a second slot. Remove afterward.

## Performance Considerations

- The component is async server-side; both `getBlogPages()` and `getChangelogPages()` are synchronous fumadocs calls already used elsewhere — no added I/O cost.
- `next/image` with `fill` automatically generates responsive sizes; provide a `sizes` prop matching the column widths (`sizes="(min-width: 1024px) 66vw, 100vw"` for the hero, `sizes="(min-width: 1024px) 33vw, 100vw"` for squares) to avoid oversized fetches.
- Landing page is statically rendered (`export const revalidate = 3600` at `page.tsx:82`), so the merge runs at most once per hour.

## Migration Notes

No data migration. The change is purely a UI swap on a static marketing page. Old `changelog-preview.tsx` has no other consumers (confirmed via grep), so deletion is safe.

## References

- Original component: `apps/www/src/app/(app)/_components/changelog-preview.tsx`
- Landing page consumer: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:13,335`
- Pattern to model after (combined sort + featured hero): `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx:69-141`
- Source loaders: `apps/www/src/app/(app)/(content)/_lib/source.ts:90-106`
- Shared schema field: `apps/www/src/lib/content-schemas.ts:43-49` (`featuredImage` on `ContentPageSchema`)
- Logo fallback source: `Icons.logoShort` from `@repo/ui/components/icons` (e.g. `apps/www/src/app/(app)/_components/app-navbar.tsx:25`)

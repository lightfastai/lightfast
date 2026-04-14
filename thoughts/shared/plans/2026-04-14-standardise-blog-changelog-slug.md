# Standardise Blog & Changelog Slug Pages Implementation Plan

## Overview

Rework the blog and changelog `[slug]/page.tsx` pages for a consistent layout: trim the blog's bottom sections, align TL;DR styling to the changelog's, standardise the share-button sizing, swap the ad-hoc `border-t` for shadcn `Separator` (with `bg-border/50`), and reuse the existing `v010-featured.png` as the featured image for the founder-letter blog post.

## Current State Analysis

### Blog slug page — `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`
- Lines 115–121: top share section wrapped in `<div className="border-t pt-4">`.
- Lines 124–132: TL;DR uses `my-8 rounded-xs bg-card p-8` with `h2.mb-12 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest`. The `mb-12` gap between "TL;DR" label and body diverges from the changelog's `mb-4`.
- Lines 152–163: "Enjoyed this article?" share CTA block — **to be removed**.
- Lines 165–193: "About the Author" bios block — **to be removed**.
- `SocialShare` (`apps/www/src/app/(app)/_components/blog-social-share.tsx`) uses `size="sm"` buttons with `h-4 w-4` icons — needs to be `h-6 w-6` buttons with `size-3.5` icons.

### Changelog slug page — `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`
- Lines 111–120: author + date line; no separator below it.
- Lines 122–129: TL;DR uses the target style (`mb-4` on the label).
- No share UI — that stays (user explicitly wants no share in changelog).

### Shared building blocks
- `@repo/ui/components/ui/separator` exists (Radix-backed, default `bg-border`, accepts `className` override → use `bg-border/50`).
- `apps/www/public/images/changelog/v010-featured.png` exists (64 KB, verified).
- Blog MDX `apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx` currently has no `featuredImage` frontmatter key (grep confirmed).

## Desired End State

- Blog slug page: no bottom "Enjoyed this article" or "About the Author" blocks. Top share row is retained but divided by a shadcn `Separator` (`bg-border/50`). TL;DR label uses `mb-4` matching changelog.
- Changelog slug page: identical shadcn `Separator` (`bg-border/50`) placed between author/date line and the TL;DR / featured-image block, for visual parity with blog.
- `SocialShare` buttons are `h-6 w-6` with `size-3.5` icons across the app.
- Blog founder letter renders with `/images/changelog/v010-featured.png` as its featured image.

### Key Discoveries
- `Separator` at `packages/ui/src/components/ui/separator.tsx:14` uses `bg-border` by default → override with `className="bg-border/50"`.
- `SocialShare` is used only in the blog slug page (`blog/[slug]/page.tsx:116,158`) — after removing the bottom CTA, only the top instance remains.
- Changelog page header ordering differs from blog: `featuredImage` comes **above** author/date line (lines 99–120). The separator placement below author/date in changelog slots cleanly between metadata and TL;DR/content.

## What We're NOT Doing

- Not removing the `SocialShare` component file (still used at the top of blog slug).
- Not restructuring the changelog header ordering (featured image stays above author/date).
- Not introducing share UI to changelog.
- Not touching the prev/next nav, improvements accordion, or MDX rendering.
- Not updating any other blog posts' frontmatter — only the founder-letter post.
- Not changing the `Share:` label text or the overall flex gap in `SocialShare`.

## Implementation Approach

Five small, independent edits. All changes are UI-only and touch 4 files.

---

## Phase 1: Tighten `SocialShare` button sizing

### Changes Required

**File**: `apps/www/src/app/(app)/_components/blog-social-share.tsx`

For each of the three `Button` usages (Twitter, LinkedIn, Copy-link):
- Replace `size="sm"` with `size="icon"` plus `className="h-6 w-6"`.
- Replace icon classes `h-4 w-4` with `size-3.5`.

```tsx
<Button
  aria-label="Share on Twitter"
  className="h-6 w-6"
  onClick={() => window.open(shareLinks.twitter, "_blank")}
  size="icon"
  variant="ghost"
>
  <Twitter className="size-3.5" />
</Button>
```

Apply the same shape to the LinkedIn and Copy-link buttons (keeping the existing `copied` span in the copy button).

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] Lint (`npx ultracite check`) introduces no new errors

#### Manual Verification
- [ ] Buttons render at 24×24px with 14px icons in the blog slug top share row
- [ ] Hover/focus states still visible
- [ ] Copy-link "Copied!" indicator still appears

---

## Phase 2: Rework blog slug page

### Changes Required

**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`

1. Add `Separator` import:
   ```tsx
   import { Separator } from "@repo/ui/components/ui/separator";
   ```
2. Replace the wrapper around the top `SocialShare` (currently `<div className="border-t pt-4">`) with a `Separator` followed by the share component:
   ```tsx
   <Separator className="bg-border/50" />
   <SocialShare
     description={description}
     title={title}
     url={`https://lightfast.ai/blog/${slug}`}
   />
   ```
   Keep these inside `<header>` at the same indentation. Spacing is already handled by `header.space-y-6`.
3. Change the TL;DR heading from `className="mb-12 ..."` to `className="mb-4 ..."` so it matches the changelog's spacing.
4. Delete the "Share CTA" block (currently lines 152–163, the `<div className="mt-16 rounded-sm bg-card p-6">...</div>`).
5. Delete the "Author bios" block (currently lines 165–193, the `{authors.length > 0 && (...)}` block after the share CTA).
6. Drop the now-unused `SocialShare` call count check — the import stays (top share still uses it).

### Success Criteria

#### Automated Verification
- [x] Typecheck passes for `apps/www`
- [x] Lint clean (no new errors from changes)
- [ ] `pnpm build:www` succeeds (static generation for blog slugs) — not run

#### Manual Verification
- [ ] `/blog/2026-03-26-why-we-built-lightfast` renders with: breadcrumb → title/description → author·date·read → thin divider → share buttons → TL;DR → featured image → MDX body
- [ ] No "Enjoyed this article?" block at the bottom
- [ ] No "About the Author" block at the bottom
- [ ] Divider above share buttons is subtle (50% border opacity)
- [ ] TL;DR label sits ~16px above the paragraph, matching the changelog entry

---

## Phase 3: Add separator to changelog slug page

### Changes Required

**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

1. Add `Separator` import:
   ```tsx
   import { Separator } from "@repo/ui/components/ui/separator";
   ```
2. Immediately after the author/date `<p>` block (currently ending at line 120, before the TL;DR block), insert:
   ```tsx
   <Separator className="mt-4 bg-border/50" />
   ```
   **Placement note**: this lands the divider between the metadata line and the TL;DR / content area, mirroring the blog's divider-above-share placement. If you'd prefer the divider below the breadcrumb instead, we can move it — flagging this as the one judgement call in the plan.

### Success Criteria

#### Automated Verification
- [x] Typecheck passes
- [x] Lint clean (no new errors from changes)
- [ ] `pnpm build:www` succeeds — not run

#### Manual Verification
- [ ] `/changelog/2026-03-26-initial` shows a thin divider below the author/date line, above the TL;DR block
- [ ] Divider color matches the blog page's divider (both `bg-border/50`)
- [ ] No share UI appears on the changelog page

---

## Phase 4: Add `featuredImage` to founder-letter MDX

### Changes Required

**File**: `apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx`

Add a `featuredImage` key to the frontmatter. Insert it adjacent to `category` / `readingTimeMinutes` so it groups with other display fields:

```yaml
category: "company"
readingTimeMinutes: 6
featured: true
featuredImage: "/images/changelog/v010-featured.png"
```

### Success Criteria

#### Automated Verification
- [x] Blog schema supports `featuredImage` — confirmed via `apps/www/src/lib/content-schemas.ts:48`
- [x] Typecheck passes

#### Manual Verification
- [ ] The founder-letter article renders the `/images/changelog/v010-featured.png` hero between TL;DR and MDX body
- [ ] OG / social preview for the post picks up the image (if the SEO bundle uses it)

---

## Phase 5: Final pass

### Changes Required
- Run `pnpm --filter @lightfast/www check && pnpm --filter @lightfast/www typecheck`.
- Visual spot-check of one blog post and one changelog entry in the dev server.

### Success Criteria

#### Automated Verification
- [x] Typecheck clean across apps/www
- [x] No new lint errors from changed files
- [x] `SocialShare` still used in blog top header; no dead imports

#### Manual Verification
- [ ] Blog and changelog slug pages share a visually consistent header rhythm (author row → `bg-border/50` divider → next block)
- [ ] TL;DR blocks are visually identical across both pages
- [ ] No regressions on other blog posts (spot-check one without TL;DR and one without featured image if they exist)

---

## Testing Strategy

### Manual Testing Steps
1. `pnpm dev:www`
2. Open `/blog/2026-03-26-why-we-built-lightfast` — verify layout changes (Phases 1, 2, 4).
3. Open `/changelog/2026-03-26-initial` — verify separator added, TL;DR unchanged, no share UI (Phase 3).
4. Compare dividers: both should render the same subtle horizontal line.
5. View source / devtools on share buttons — confirm `h-6 w-6` button and `size-3.5` icon.

## References

- Blog slug page: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`
- Changelog slug page: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`
- `SocialShare`: `apps/www/src/app/(app)/_components/blog-social-share.tsx`
- Shadcn separator: `packages/ui/src/components/ui/separator.tsx`
- Founder-letter MDX: `apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx`
- Featured image asset: `apps/www/public/images/changelog/v010-featured.png`

# Integrations Listing Page Rework Implementation Plan

## Overview

Rework `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx` so the header styling matches the blog and changelog listing pages, and each integration card adopts the minimal "icon → title → description" stacking used by OpenAI's developer portal hero cards.

## Current State Analysis

**Listing page** — `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx:88-142`
- Self-owned header wrapper: `mx-auto w-full min-w-0 max-w-4xl pt-24 pb-32`
- h1: `text-4xl font-medium font-pp` + long `PAGE_DESCRIPTION` paragraph (`max-w-2xl text-lg text-muted-foreground`)
- 3-col grid of `NavLink` cards: `rounded-lg border border-border/50 bg-card/40 p-6`
- Card top row: `flex items-center justify-between` with provider icon on the left and a Soon/Beta badge on the right
- Card body: title `text-xl` + tagline `text-sm`

**Reference — Blog listing** — `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/layout.tsx:18-46`
- Layout wrapper owns the header: `mx-auto w-full max-w-2xl pt-24 pb-32`
- h1: `font-medium font-pp text-3xl text-foreground` with an optional RSS `NavLink` on the right (`flex items-center justify-between mb-12`)
- `page.tsx` just renders the content list, no page-level heading

**Reference — Changelog** — `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx:115-192`
- Same pattern: `mx-auto w-full max-w-2xl pt-24 pb-32`, `text-3xl` h1, optional RSS link, then list of entries

**Data sources & types**
- `getIntegrationPages()` — `apps/www/src/app/(app)/(content)/_lib/source.ts:125`
- Frontmatter schema — `apps/www/src/lib/content-schemas.ts:98-111` (exposes `providerId`, `tagline`, `category`, `status`)
- Provider display metadata (including `comingSoon`) — `packages/app-providers/src/client/display.ts`
- Provider icon resolver — `apps/www/src/lib/get-provider-icon.ts:15-17`

**Content** — three MDX entries exist today: `github.mdx` (live), `vercel.mdx` (live), `linear.mdx` (coming soon).

## Desired End State

The `/integrations` index looks like a sibling of `/blog` and `/changelog`: a `text-3xl` h1 at the top, no long intro paragraph, then a grid of minimal cards where each card is a vertical stack of icon → title → tagline. The Soon/Beta signal is preserved but moved out of its own column so the card reads top-down like the OpenAI developer-portal cards.

### Key decisions locked in

1. Container stays `max-w-4xl` (a grid of 3 cards at `max-w-2xl` is too cramped); only the h1 style and the absence of an intro paragraph are copied from blog.
2. The `PAGE_DESCRIPTION` constant stays (still needed for metadata / JSON-LD) but is **not rendered** on the page.
3. Status badge is kept but moves inline — a muted label directly under the title rather than a right-aligned pill — so the card has a clean three-part vertical rhythm like the OpenAI cards.
4. JSON-LD, metadata, FAQ, and `force-static` export are unchanged.

### Verification

- `/integrations` header visually matches `/blog` and `/changelog` (same font, size, weight, top padding).
- No prose paragraph renders under the h1.
- Each card renders icon, title, tagline in a top-down stack with no right-aligned chrome.
- Cards for `linear` (coming soon) display a muted "Coming soon" label under the title; `github` and `vercel` (live) show no status label.
- `pnpm --filter @apps/www typecheck` and `pnpm --filter @apps/www lint` pass.

## What We're NOT Doing

- No changes to `integrations/[slug]/page.tsx`, the detail layout, hero component, or OG image route.
- No changes to `content-schemas.ts`, the `IntegrationPageSchema`, or any MDX frontmatter.
- No category filter / nav rail (blog has one, but the integration count is too small to justify).
- No RSS feed for integrations.
- No redesign of `IntegrationFeatureGrid` or `IntegrationHero` MDX components.
- No changes to `PROVIDER_DISPLAY` in `packages/app-providers`.

## Implementation Approach

Single-file edit to `page.tsx`. Swap the header block for the blog/changelog pattern, drop the rendered description paragraph, and restructure the card JSX from a two-column top row into a clean vertical stack with the status label demoted to an inline muted span under the title.

## Phase 1: Page Rework

### Overview

Update the header and card layout in `integrations/page.tsx` to match the blog/changelog header pattern and the OpenAI-style vertical card stack.

### Changes Required

#### File: `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx`

**Header block** — replace the existing `<div className="mb-12">…</div>` with the blog/changelog pattern:

```tsx
<div className="mb-12 flex items-center justify-between">
  <h1 className="font-medium font-pp text-3xl text-foreground">
    Integrations
  </h1>
</div>
```

No RSS action is needed; the `flex items-center justify-between` wrapper is kept so future actions (e.g. a "Request integration" link) can be added without restructuring.

Keep the outer container as `mx-auto w-full min-w-0 max-w-4xl pt-24 pb-32`. Do not render `PAGE_DESCRIPTION` on the page — it remains in scope for `createMetadata`, the OG tags, and the JSON-LD `WebPage.description`.

**Card block** — replace the current card body inside the `.map()` with a vertical stack:

```tsx
<NavLink
  className="group flex h-full flex-col gap-6 rounded-lg border border-border/50 bg-card/40 p-6 transition-colors hover:border-border hover:bg-card"
  href={`/integrations/${slug}` as Route}
  key={slug}
  prefetch
>
  {Icon && <Icon aria-hidden className="size-8 text-foreground" />}
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline gap-2">
      <h2 className="font-medium font-pp text-foreground text-xl">
        {title}
      </h2>
      {derivedStatus !== "live" && (
        <span className="text-muted-foreground text-xs uppercase tracking-wider">
          {derivedStatus === "coming-soon" ? "Soon" : "Beta"}
        </span>
      )}
    </div>
    <p className="text-muted-foreground text-sm leading-relaxed">
      {tagline}
    </p>
  </div>
</NavLink>
```

Key changes from current JSX:
- Drop the `flex items-center justify-between` top row; icon now sits on its own above the text block.
- `gap-6` between icon and text block (was `gap-4` for the whole card).
- Status becomes an inline muted `<span>` beside the title at `items-baseline`, not a bordered pill on the right. Hidden entirely when status is `"live"`.
- Text block unchanged: title `text-xl` + tagline `text-sm`.

All logic above the `return` (metadata, `structuredData`, `derivedStatus` derivation, `Icon = getProviderIcon(providerId)`) is unchanged.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @apps/www typecheck` passes
- [ ] `pnpm --filter @apps/www lint` passes
- [ ] `pnpm --filter @apps/www build` succeeds (page still statically renders under `force-static`)

#### Manual Verification

- [ ] `/integrations` h1 visually matches `/blog` and `/changelog` (same font family, `text-3xl`, same top padding)
- [ ] No intro paragraph renders under the h1
- [ ] Each card shows icon on top, title + (optional) status label on the next line, tagline below
- [ ] `github` and `vercel` cards show **no** status label; `linear` shows "Soon" inline after the title in muted color
- [ ] Hovering a card still transitions `border` and `bg-card` as today
- [ ] Cards are still keyboard-focusable and navigate to `/integrations/<slug>`
- [ ] `view-source:` on `/integrations` still contains the JSON-LD `<script>` and the `PAGE_DESCRIPTION` meta tags

**Implementation Note**: After automated checks pass, pause for manual visual confirmation against `/blog` and `/changelog` before marking complete.

## Testing Strategy

### Manual Testing Steps

1. Run `pnpm dev:www` and open `/integrations`, `/blog`, `/changelog` side by side; confirm the three headers render with identical `font-pp text-3xl` styling and the same top padding.
2. Confirm the integrations page no longer has a lead paragraph under the h1.
3. Tab through the grid — each card is a single focusable target and navigates correctly.
4. Confirm the `linear` card shows "Soon" inline; `github` and `vercel` do not.
5. Resize to mobile (`sm:`), tablet (`md:`), and desktop (`lg:`) breakpoints and confirm 1 / 2 / 3 column layout still holds.
6. `view-source` on `/integrations` and confirm JSON-LD, OG tags, and canonical URL are still emitted.

## References

- Original request: reply from user in this session (adopt blog/changelog header; card layout inspired by `developers.openai.com` hero cards)
- Blog listing layout: `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/layout.tsx:18-46`
- Changelog listing: `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx:115-192`
- Current integrations page: `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx`
- Integration schema: `apps/www/src/lib/content-schemas.ts:89-111`
- Provider display metadata: `packages/app-providers/src/client/display.ts`
- Provider icon resolver: `apps/www/src/lib/get-provider-icon.ts`
- Prior research: `thoughts/shared/research/2026-04-14-marketing-integrations-page.md`
- Prior plan: `thoughts/shared/plans/2026-04-14-marketing-integrations-page.md`

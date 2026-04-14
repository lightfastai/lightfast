---
date: 2026-04-14T00:00:00Z
author: claude
git_commit: 953ba60a19fd8006e87ed71af6e10e88ece38219
branch: main
status: ready
tags: [plan, integrations, www, marketing, mdx, layout]
research: thoughts/shared/research/2026-04-14-integrations-detail-rework.md
---

# Integrations detail page rework — Linear-style two-column layout

## Overview

Rebuild `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx` from a single-column `max-w-3xl` hero+MDX layout into a Linear-style detail page: badge row → title → tagline → two-column grid (content left, metadata sidebar right 320px) → related integrations → prev/next nav. No frontmatter/schema changes.

## Current State Analysis

- `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx:36-70` renders a single-column `max-w-3xl` container with `<IntegrationHero>` and the compiled MDX body. `featuredImage` frontmatter is loaded but never rendered.
- `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-hero.tsx:12-43` is the current hero component; it is only consumed by `[slug]/page.tsx` and **not** registered in `mdxComponents` (see `apps/www/src/app/(app)/(content)/_lib/mdx-components.tsx:405-487`), so it can be safely retired.
- `apps/www/src/lib/content-schemas.ts:89-111` already supplies every field the new layout needs: `title`, `tagline`, `category`, `providerId`, `featuredImage`, `docsUrl`, `status`, plus inherited `description`.
- `PROVIDER_DISPLAY[providerId].comingSoon` continues to drive the coming-soon fallback via `derivedStatus = mdxStatus ?? (providerComingSoon ? "coming-soon" : "live")`.
- Only three integration MDX files exist today: `github.mdx`, `linear.mdx`, `vercel.mdx` (`apps/www/src/content/integrations/`). `github.mdx` renders `<FAQAccordion>` inline; `vercel.mdx` and `linear.mdx` do not.
- Changelog detail page (`apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx:79-220`) is the pattern source for typography, Separator, TL;DR card (not used here), and prev/next NavLink cards.
- `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx:96-125` is the listing page — its card pattern (NavLink → `bg-accent/40 hover:bg-accent`, icon + title + clamped tagline) is the reference for the "Related integrations" block.

## Desired End State

Navigating to `/integrations/github` (or any integration slug) shows:

1. Breadcrumb back to `/integrations`.
2. Badge row: `<Category>` · `Lightfast crafted` · `<Status>` (when status ≠ `live`).
3. `h1` title (`font-pp`) + tagline paragraph.
4. `<Separator />`.
5. Two-column grid (`lg:grid-cols-[minmax(0,1fr)_320px]`, gap-12, stacks on smaller widths):
   - Left: optional `aspect-16/9` featured image (`rounded-lg bg-card`), then the MDX body.
   - Right: metadata sidebar with Logo, Name, Publisher, Category, Status, Docs, Contact, and a primary CTA button.
6. "Related integrations" grid showing the other integrations (excluding current).
7. Prev/Next NavLink cards (alphabetical by title).

Verify by:
- Visiting `/integrations/github`, `/integrations/vercel`, `/integrations/linear` in dev (`pnpm dev:www` on port 4101).
- `pnpm check && pnpm typecheck` pass.
- `pnpm --filter lightfast-www build` succeeds with all three routes statically generated.

### Key Discoveries:

- Schema already provides everything needed; **no changes to `content-schemas.ts` or any MDX frontmatter** (`apps/www/src/lib/content-schemas.ts:98-111`).
- `getProviderIcon(providerId)` returns the SVG component for the sidebar logo (`apps/www/src/lib/get-provider-icon.ts:15-17`).
- `NavLink` in `apps/www/src/components/nav-link.tsx:38-59` supports typed `Route` for internal hrefs and string for external/microfrontend — use internal `Route` for `/integrations/<slug>` and `/docs/<path>`, and raw anchor for `mailto:`.
- `IntegrationCategorySchema` has no human-friendly labels; a local label map is required (`content-schemas.ts:90-96`).

## What We're NOT Doing

- **No schema changes.** `websiteUrl`, `publisher`, `contactUrl`, and related-integration frontmatter stay out. Publisher is hardcoded `"Lightfast"`; contact is hardcoded `mailto:support@lightfast.ai`; related integrations are auto-derived from the other MDX files.
- **No rework of `mdxComponents`.** `IntegrationFeatureGrid`, `IntegrationFeature`, `IntegrationScreenshot` stay registered as-is.
- **No FAQ migration.** `<FAQAccordion>` in `github.mdx` stays inline in the MDX body. Frontmatter `faq` keeps feeding SEO only.
- **No changes to the listing page** (`integrations/page.tsx`).
- **No "Build your own integration" block** below the grid.
- **No changes to SEO/JSON-LD.** `emitIntegrationSeo` consumption stays identical.

## Implementation Approach

Single PR, three phases:

1. Add tiny data helpers (category/status label maps) and build the new `IntegrationSidebar` component.
2. Rewrite `[slug]/page.tsx` into the new layout, wiring sidebar + featured image + MDX body.
3. Add the below-grid sections (related + prev/next) and retire the unused `IntegrationHero` component.

Each phase is independently shippable and keeps the page rendering cleanly between commits.

---

## Phase 1: Label maps + sidebar component

### Overview

Introduce the category/status label maps and the new sidebar component. No consumer wired up yet — page still renders via the old hero path after this phase.

### Changes Required:

#### 1. Category + status label maps

**File**: `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-labels.ts` (new)
**Changes**: Small module exporting a label map for each category/status. Co-located with the integration components so the sidebar can import it directly.

```ts
import type {
  IntegrationCategory,
  IntegrationStatus,
} from "~/lib/content-schemas";

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  "dev-tools": "Dev tools",
  monitoring: "Monitoring",
  comms: "Comms",
  data: "Data",
  "project-management": "Project management",
};

export const STATUS_LABEL: Record<
  NonNullable<IntegrationStatus> | "live",
  string
> = {
  live: "Live",
  beta: "Beta",
  "coming-soon": "Coming soon",
};
```

#### 2. IntegrationSidebar component

**File**: `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-sidebar.tsx` (new)
**Changes**: Server component rendering the 320px metadata sidebar. Uses `<dl>`/`<dt>`/`<dd>` for semantics. CTA: `"Connect in workspace"` for live/beta, `"Join waitlist"` for coming-soon — both link to `/`.

```tsx
import type { Route } from "next";
import type { ComponentType, SVGProps } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { ExternalLink } from "lucide-react";
import { NavLink } from "~/components/nav-link";
import type { IntegrationCategory, IntegrationStatus } from "~/lib/content-schemas";
import { CATEGORY_LABEL, STATUS_LABEL } from "./integration-labels";

interface IntegrationSidebarProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  category: IntegrationCategory;
  status: NonNullable<IntegrationStatus> | "live";
  docsUrl?: string;
}

export function IntegrationSidebar({
  icon: Icon,
  title,
  category,
  status,
  docsUrl,
}: IntegrationSidebarProps) {
  const ctaLabel = status === "coming-soon" ? "Join waitlist" : "Connect in workspace";

  return (
    <aside className="flex w-full flex-col gap-6 rounded-lg border border-border/50 bg-card/40 p-6 lg:w-[320px]">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border/50 bg-card">
          <Icon aria-hidden className="size-6 text-foreground" />
        </div>
      )}

      <dl className="flex flex-col gap-4 text-sm">
        <Row label="Name" value={title} />
        <Row label="Publisher" value="Lightfast" />
        <Row label="Category" value={CATEGORY_LABEL[category]} />
        <Row label="Status" value={STATUS_LABEL[status]} />
        {docsUrl && (
          <Row
            label="Docs"
            value={
              <NavLink
                className="inline-flex items-center gap-1 text-foreground hover:text-muted-foreground"
                href={docsUrl as Route}
                prefetch
              >
                Read docs
                <ExternalLink aria-hidden className="size-3" />
              </NavLink>
            }
          />
        )}
        <Row
          label="Contact"
          value={
            <a
              className="inline-flex items-center gap-1 text-foreground hover:text-muted-foreground"
              href="mailto:support@lightfast.ai"
            >
              Email us
              <ExternalLink aria-hidden className="size-3" />
            </a>
          }
        />
      </dl>

      <Separator className="bg-border/50" />

      <Button asChild className="w-full" variant="default">
        <NavLink href={"/" as Route}>{ctaLabel}</NavLink>
      </Button>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter lightfast-www typecheck` passes.
- [ ] `pnpm --filter lightfast-www lint` passes.
- [x] Import `IntegrationSidebar` from a scratch file and the TS compiler accepts the current props shape.

#### Manual Verification:

- [ ] File tree: both new files exist under `_components/`.
- [ ] No runtime usage introduced yet — `/integrations/github` renders unchanged.

---

## Phase 2: Rewrite the detail page layout

### Overview

Replace the single-column layout in `[slug]/page.tsx` with the new structure: breadcrumb → badge row → title → tagline → `<Separator />` → two-column grid with featured image + MDX on the left and `<IntegrationSidebar>` on the right. `IntegrationHero` is no longer imported here; removal happens in Phase 3 once nothing consumes it.

### Changes Required:

#### 1. Rewrite page default export

**File**: `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx`
**Changes**: Replace the default export body. `dynamic`, `generateStaticParams`, `generateMetadata`, and `derivedStatus`/`Icon` derivation stay the same. Container widens from `max-w-3xl` → `max-w-6xl`. Breadcrumb mirrors `changelog/[slug]/page.tsx:83-92`.

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import Image from "next/image";
import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import {
  getIntegrationPage,
  getIntegrationPages,
} from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";
import { getProviderIcon } from "~/lib/get-provider-icon";
import { emitIntegrationSeo } from "~/lib/seo-bundle";
import type { IntegrationUrl } from "~/lib/url-types";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
} from "../_components/integration-labels";
import { IntegrationSidebar } from "../_components/integration-sidebar";

// ...generateStaticParams + generateMetadata unchanged...

export default async function IntegrationDetailPage({ params }: Props) {
  const { slug } = await params;
  const page = getIntegrationPage([slug]);
  if (!page) notFound();

  const url = `https://lightfast.ai/integrations/${slug}` as IntegrationUrl;
  const { jsonLd } = emitIntegrationSeo(page.data, url);
  const MDXContent = page.data.body;

  const {
    title,
    tagline,
    providerId,
    status: mdxStatus,
    category,
    featuredImage,
    docsUrl,
  } = page.data;

  const providerComingSoon =
    providerId && "comingSoon" in PROVIDER_DISPLAY[providerId]
      ? PROVIDER_DISPLAY[providerId].comingSoon
      : false;
  const derivedStatus: "live" | "beta" | "coming-soon" =
    mdxStatus ?? (providerComingSoon ? "coming-soon" : "live");
  const Icon = providerId ? getProviderIcon(providerId) : undefined;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl pt-24 pb-32">
      <JsonLd code={jsonLd} />
      <article className="space-y-8">
        <p className="text-muted-foreground text-sm">
          <Button
            asChild
            className="h-auto p-0 text-muted-foreground text-sm hover:text-foreground"
            variant="link"
          >
            <NavLink href="/integrations">Integrations</NavLink>
          </Button>
        </p>

        <div className="flex flex-wrap items-center gap-2 font-mono text-muted-foreground text-xs uppercase tracking-wider">
          <span>{CATEGORY_LABEL[category]}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>Lightfast crafted</span>
          {derivedStatus !== "live" && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>{STATUS_LABEL[derivedStatus]}</span>
            </>
          )}
        </div>

        <div className="space-y-4">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            {title}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
            {tagline}
          </p>
        </div>

        <Separator className="bg-border/50" />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            {featuredImage && (
              <div className="relative aspect-16/9 overflow-hidden rounded-lg bg-card">
                <Image
                  alt={title}
                  className="h-full w-full object-cover"
                  fill
                  priority
                  src={featuredImage}
                />
              </div>
            )}
            <div className="max-w-none">
              <MDXContent components={mdxComponents} />
            </div>
          </div>

          <IntegrationSidebar
            category={category}
            docsUrl={docsUrl}
            icon={Icon}
            status={derivedStatus}
            title={title}
          />
        </div>
      </article>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter lightfast-www typecheck` passes.
- [x] `pnpm --filter lightfast-www lint` passes.
- [x] `pnpm --filter lightfast-www build` statically generates `/integrations/github`, `/integrations/vercel`, `/integrations/linear`.

#### Manual Verification (pnpm dev:www):

- [ ] `/integrations/github` renders: breadcrumb → badge row (Dev tools · Lightfast crafted) → title → tagline → separator → two columns with featured image + MDX body on left, sidebar on right.
- [ ] `/integrations/linear` shows `Coming soon` badge in the header row and the sidebar (since `PROVIDER_DISPLAY.linear.comingSoon` is true); CTA reads "Join waitlist".
- [ ] `/integrations/vercel` renders correctly even though its MDX body is short (single paragraph). Sidebar height does not create awkward stretching — sidebar is at natural height, content column drives article height.
- [ ] Layout stacks (sidebar below content) on viewports < `lg` (1024 px). Resize the browser to confirm.
- [ ] Sidebar CTA "Connect in workspace" links to `/` (the app microfrontend's dashboard) and is reachable via keyboard Tab order.
- [ ] Docs link (when present) opens `/docs/connectors/github` via NavLink; Contact opens `mailto:support@lightfast.ai`.
- [ ] No console errors; no hydration warnings.

**Implementation Note**: After Phase 2 automated checks pass, pause for human manual confirmation before starting Phase 3.

---

## Phase 3: Related integrations, prev/next, cleanup

### Overview

Append the below-grid sections and remove the now-unused `IntegrationHero`.

### Changes Required:

#### 1. Related integrations + prev/next in page.tsx

**File**: `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx`
**Changes**: Append, inside the `<article>` (after the two-column grid):

```tsx
{/* Related integrations */}
{(() => {
  const related = getIntegrationPages().filter((p) => p.slugs[0] !== slug);
  if (related.length === 0) return null;
  return (
    <section className="pt-16">
      <h2 className="mb-6 font-medium font-pp text-xl">Other integrations</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((p) => {
          const rSlug = p.slugs[0] ?? "";
          const RIcon = p.data.providerId
            ? getProviderIcon(p.data.providerId)
            : undefined;
          return (
            <NavLink
              className="group flex h-[200px] flex-col justify-between gap-6 overflow-hidden rounded-md bg-accent/40 p-6 transition-colors hover:bg-accent"
              href={`/integrations/${rSlug}` as Route}
              key={rSlug}
              prefetch
            >
              {RIcon && (
                <RIcon aria-hidden className="size-5 text-foreground" />
              )}
              <div className="flex flex-col gap-3">
                <h3 className="font-medium font-pp text-foreground text-xl">
                  {p.data.title}
                </h3>
                <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                  {p.data.tagline}
                </p>
              </div>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
})()}

{/* Prev / Next */}
{(() => {
  const allSorted = [...getIntegrationPages()].sort((a, b) =>
    a.data.title.localeCompare(b.data.title)
  );
  const idx = allSorted.findIndex((p) => p.slugs[0] === slug);
  const prev = idx > 0 ? allSorted[idx - 1] : null;
  const next = idx < allSorted.length - 1 ? allSorted[idx + 1] : null;
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="Integration navigation"
      className="grid grid-cols-1 gap-4 pt-16 md:grid-cols-2"
    >
      {prev ? (
        <NavLink
          className="group"
          href={`/integrations/${prev.slugs[0]}` as Route}
          prefetch
        >
          <div className="h-full rounded-sm border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
            <span className="flex items-center gap-1 text-muted-foreground text-sm">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </span>
            <span className="mt-1 line-clamp-2 block font-medium text-foreground text-sm">
              {prev.data.title}
            </span>
          </div>
        </NavLink>
      ) : (
        <div />
      )}
      {next ? (
        <NavLink
          className="group md:text-right"
          href={`/integrations/${next.slugs[0]}` as Route}
          prefetch
        >
          <div className="h-full rounded-sm border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
            <span className="flex items-center justify-end gap-1 text-muted-foreground text-sm">
              Next
              <ChevronRight className="h-4 w-4" />
            </span>
            <span className="mt-1 line-clamp-2 block font-medium text-foreground text-sm">
              {next.data.title}
            </span>
          </div>
        </NavLink>
      ) : (
        <div />
      )}
    </nav>
  );
})()}
```

Add the new imports at the top of the file:

```ts
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
```

If `Route` is already in scope through `NavLink` props, the explicit import stays — `Route` is a type-only import from `next`, matches the pattern at `changelog/[slug]/page.tsx:5`.

#### 2. Remove unused IntegrationHero component

**File**: `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-hero.tsx`
**Changes**: Delete the file. Verified unused by:
- It is not registered in `apps/www/src/app/(app)/(content)/_lib/mdx-components.tsx:405-487`.
- After Phase 2 the only prior consumer (`[slug]/page.tsx`) no longer imports it.

Before deleting, run `pnpm --filter lightfast-www grep "IntegrationHero"` (or `Grep` tool) to confirm zero remaining references.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter lightfast-www typecheck` passes.
- [x] `pnpm --filter lightfast-www lint` passes.
- [x] `pnpm --filter lightfast-www build` still generates all three integration routes.
- [x] `rg "IntegrationHero" apps/www/src` returns no matches (file deleted + no stragglers).

#### Manual Verification (pnpm dev:www):

- [ ] `/integrations/github` shows "Other integrations" with Linear and Vercel cards in correct order (not including self).
- [ ] Prev/Next: `github` → prev `—`, next `Linear`; `linear` → prev `GitHub`, next `Vercel`; `vercel` → prev `Linear`, next `—` (alphabetical: GitHub, Linear, Vercel).
- [ ] Cards are keyboard-focusable and navigate correctly; hover styles (`bg-accent`, `border-muted-foreground/20`) render.
- [ ] On `/integrations/github`, the inline `<FAQAccordion>` in the MDX body still expands/collapses exactly as before (regression check).
- [ ] Lighthouse/Accessibility: no landmark duplication warnings (`<aside>` + `<nav>` are siblings of `<article>` content).

**Implementation Note**: After Phase 3 automated checks pass, pause for human manual confirmation before merging.

---

## Testing Strategy

### Automated

- Typecheck + lint + build at the end of each phase (commands above).
- No new unit tests: the page is a static server component with no business logic beyond the status-derivation that already existed.

### Manual (golden path)

1. `pnpm dev:www` → visit `/integrations/github`, `/integrations/linear`, `/integrations/vercel`.
2. At each page, check: breadcrumb, badge row, title, tagline, separator, featured image (where frontmatter provides one), MDX body, sidebar rows (Logo, Name, Publisher, Category, Status, Docs?, Contact), CTA, Other integrations grid, prev/next.
3. Resize browser: confirm sidebar stacks below content on < `lg`, grid reappears at ≥ `lg`.
4. Click Docs link → lands on `/docs/connectors/github`. Click Email us → opens mail client. Click CTA → navigates to `/`.
5. Regression check: `/integrations` listing page unchanged; `/changelog/<any>` still renders its existing layout (we did not touch its files but imports of `Separator`, `Button`, `NavLink` are shared — sanity-check).

### Edge cases

- Integration with no `featuredImage` (`linear.mdx`): image slot is omitted; MDX body is the only left-column content.
- Integration with no `docsUrl`: the "Docs" row is omitted; Contact becomes the last metadata row before the separator.
- Provider flagged `comingSoon` in `PROVIDER_DISPLAY`: status badge in header + sidebar read `Coming soon`; CTA text swaps to `Join waitlist`.
- Only one integration MDX file in future: "Other integrations" section auto-hides when `related.length === 0`.

## Performance Considerations

- Page stays `export const dynamic = "force-static"` with `generateStaticParams` — build-time only, no runtime cost.
- `getIntegrationPages()` is called up to three times per render (main, related, prev/next). Fumadocs loader reads an in-memory collection; acceptable for static generation and not worth memoising.
- Featured image uses `priority` (same as changelog pattern) since it is above-the-fold on wide viewports.

## Migration Notes

None. No schema, frontmatter, or data shape changes. All existing integration MDX files render under the new layout without edits.

## References

- Research: `thoughts/shared/research/2026-04-14-integrations-detail-rework.md`
- Current detail page: `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx:36-70`
- Legacy hero to retire: `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-hero.tsx:12-43`
- Pattern source for breadcrumb + prev/next: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx:83-216`
- Pattern source for related-integration cards: `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx:96-125`
- Schema (no changes): `apps/www/src/lib/content-schemas.ts:89-111`
- Provider icon resolver: `apps/www/src/lib/get-provider-icon.ts:15-17`
- Provider coming-soon source of truth: `packages/app-providers/src/client/display.ts:41-90`

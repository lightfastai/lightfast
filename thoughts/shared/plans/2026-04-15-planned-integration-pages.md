# Planned Integration Pages Implementation Plan

## Overview

Give every roadmap ("planned") integration its own page at `/integrations/<slug>`, authored as MDX and rendered through the existing integration detail route. Make MDX the single source of truth by deleting the TS roadmap array, and tighten the schema with a `status`-discriminated union so live and planned pages carry the fields they each need.

## Current State Analysis

- Live integrations (`github`, `vercel`, `linear`) render from MDX in `apps/www/src/content/integrations/` through fumadocs-mdx, validated by `IntegrationPageSchema` (`apps/www/src/lib/content-schemas.ts:98`) and routed via `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx:41`.
- Roadmap items live as a 37-entry TS array in `apps/www/src/app/(app)/(marketing)/(content)/integrations/_lib/upcoming-integrations.ts:11`, rendered by `UpcomingIntegrationsList` (`_components/upcoming-integrations-list.tsx`) as a non-clickable list on the integrations index page.
- `IntegrationStatusSchema` already allows `"coming-soon"` (`content-schemas.ts:89`) and `IntegrationSidebar:28` already branches its CTA on it, but no MDX file uses the value today.
- The detail page's icon comes via `getProviderIcon(providerId)` → `PROVIDER_TO_ICON_KEY` (`apps/www/src/lib/get-provider-icon.ts:9-13`) → `IntegrationLogoIcons`. That indirection only covers 5 slugs.
- `buildIntegratedAppEntity` (`apps/www/src/lib/builders/integrations.ts:35-49`) looks up `PROVIDER_DISPLAY[providerId]` and only handles the 5 live connector providers. Planned pages with `providerId` set would break it.
- `IntegrationLogoIcons` in `packages/ui/src/components/integration-icons.tsx:202` covers 40 logos today; a diff against the 37 roadmap slugs shows **4 missing**: `incident-io`, `better-stack`, `customer-io`, `cal-com`.
- The integrations index page (`integrations/page.tsx:75`) renders `getIntegrationPages()` directly without filtering — once planned pages exist, the live grid would include them.
- The detail page's "Other integrations" section (`[slug]/page.tsx:125-130`) filters only by `slugs[0] !== slug` and would mix live + planned post-change.
- `content-schemas.ts:6-12` inlines `providerSlugSchema` because fumadocs-mdx's build-time loader can't resolve extensionless re-exports from `@repo/app-providers/client`. Any new enum consumed by frontmatter must be inlined the same way.

## Desired End State

- Visiting `/integrations/sentry` (or any of the 37 roadmap slugs) renders a full detail page with per-integration copy, icon, tagline, FAQ, and a "Join waitlist" CTA.
- The `UPCOMING_INTEGRATIONS` TS array is deleted; `UpcomingIntegrationsList` pulls planned pages from `getIntegrationPages()` and each list row is a link to the page.
- `IntegrationPageSchema` is a discriminated union on `status` — live/beta variants require `providerId` + `featuredImage`, planned disallows `docsUrl`.
- All 37 planned slugs + all 3 live slugs resolve to a valid icon from `IntegrationLogoIcons`; the 4 missing icons exist in `packages/ui`.
- Typecheck + build pass; no runtime surprises in `buildIntegratedAppEntity` (no planned page has `providerId`).
- `pnpm --filter @lightfastai/www build` succeeds and `force-static` generates 40 integration pages.

### Key Discoveries

- Fumadocs-mdx auto-discovers new MDX files under the configured collection directory; `.source/server.ts` regenerates on next build (`apps/www/source.config.ts:42-46`).
- Schema validation runs at build time via fumadocs — so a discriminated union will catch missing fields before runtime.
- `providerId` is used in two places: (1) `getProviderIcon` for icon rendering, (2) `buildIntegratedAppEntity` for JSON-LD `SoftwareApplication`. Only (2) requires a real connector. Planned pages can drop `providerId` entirely if we decouple icon lookup.
- `IntegrationLogoIcons` lives in a TSX file and isn't importable from the fumadocs-mdx schema loader; any enum derived from its keys must be duplicated in `content-schemas.ts` (same pattern as `providerSlugSchema:6-12`).
- `STATUS_LABEL` covers "coming-soon" but not "planned" — needs rename.

## What We're NOT Doing

- Not expanding `PROVIDER_DISPLAY` or `providerSlugSchema` in `@repo/app-providers/client`. That package is for live connector wiring; planned marketing pages have no business extending it.
- Not adding a waitlist capture form, email submit flow, or database table. The "Join waitlist" CTA keeps its current `href="/"` link behavior for this plan.
- Not changing live integration URLs, live MDX content, or how `status: "live"` pages render.
- Not adding per-integration `opengraph-image` routes (those already exist per route and can keep generating from the MDX data unchanged).
- Not authoring 37 bespoke long-form essays — each MDX gets a consistent templated structure (Overview / What we'll ingest / Why it matters / FAQ), tuned per integration but not novel prose.
- Not building a redirect story for "sentry went from planned → live." Swapping `status: "planned"` → `status: "live"` in the MDX is the migration; no URL change, no redirect needed.

## Implementation Approach

Land schema and icon plumbing first (Phase 1–2) so the 37 MDX stubs type-check as they're authored. Then author the MDX files (Phase 3), wire routing/filtering (Phase 4), and delete the dead TS array (Phase 5). Each phase ends green on typecheck + build.

---

## Phase 1: Schema rework — status rename + discriminated union + iconKey [DONE]

### Overview

Rename `coming-soon` → `planned`, introduce an inlined `iconKey` enum covering all integration logo slugs, and rebuild `IntegrationPageSchema` as a discriminated union on `status` so the shape enforces live vs planned expectations.

### Changes Required

#### 1. `apps/www/src/lib/content-schemas.ts`

**Changes**:
- Rename `IntegrationStatusSchema` enum value `"coming-soon"` → `"planned"`.
- Add inlined `integrationIconKeySchema` — a `z.enum([...])` with all 40 slugs present in `IntegrationLogoIcons` (apollo, airtable, claude, codex, datadog, discord, github, linear, notion, posthog, sentry, slack, vercel, circleci, pagerduty, intercom, hubspot, stripe, grafana, clerk, jira, mixpanel, zendesk, cloudflare, supabase, resend, typeform, loops, segment, statsig, launchdarkly, amplitude, gong, outreach, instantly, plain, attio, neon, fireflies, workos) plus the 4 new ones added in Phase 2 (`incident-io`, `better-stack`, `customer-io`, `cal-com`). Document the same "keep in sync with packages/ui/src/components/integration-icons.tsx" comment the existing `providerSlugSchema` carries.
- Add `IntegrationCategorySchema` value `"engineering-intelligence"` if needed for any new category — **audit the 37 roadmap items' target categories first** (default mapping will be: monitoring for sentry/datadog/grafana/better-stack/pagerduty/incident-io; dev-tools for circleci/cloudflare/supabase/neon/cal-com; project-management for jira/notion; comms for slack/intercom/plain/zendesk; data for posthog/mixpanel/amplitude/segment/statsig/launchdarkly/stripe/resend/customer-io/loops/clerk/workos/attio/hubspot/apollo/outreach/instantly/fireflies/gong/typeform). If all map cleanly, no new category needed.
- Split `IntegrationPageSchema` into `IntegrationPageLiveSchema`, `IntegrationPageBetaSchema`, `IntegrationPagePlannedSchema`, and export `IntegrationPageSchema` as `z.discriminatedUnion("status", [...])`. Shared fields go in a `BaseIntegrationSchema` extending `BasePageSchema`.

```typescript
const integrationIconKeySchema = z.enum([
  "apollo","airtable","claude","codex","datadog","discord","github","linear",
  "notion","posthog","sentry","slack","vercel","circleci","pagerduty","intercom",
  "hubspot","stripe","grafana","clerk","jira","mixpanel","zendesk","cloudflare",
  "supabase","resend","typeform","loops","segment","statsig","launchdarkly",
  "amplitude","gong","outreach","instantly","plain","attio","neon","fireflies",
  "workos","incident-io","better-stack","customer-io","cal-com",
]);

const IntegrationStatusSchema = z.enum(["live", "beta", "planned"]);

const BaseIntegrationSchema = BasePageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/integrations/"))
    .optional(),
  iconKey: integrationIconKeySchema,
  tagline: z.string().min(10).max(120),
  category: IntegrationCategorySchema,
  faq: z.array(FaqItemSchema).min(1).optional(),
  updatedAt: z.iso.datetime(),
});

const IntegrationPageLiveSchema = BaseIntegrationSchema.extend({
  status: z.literal("live"),
  providerId: providerSlugSchema,              // required for live
  featuredImage: z.string().startsWith("/images/"),  // required for live
  docsUrl: z.string().startsWith("/docs/"),    // required for live
});

const IntegrationPageBetaSchema = BaseIntegrationSchema.extend({
  status: z.literal("beta"),
  providerId: providerSlugSchema,
  featuredImage: z.string().startsWith("/images/").optional(),
  docsUrl: z.string().startsWith("/docs/").optional(),
});

const IntegrationPagePlannedSchema = BaseIntegrationSchema.extend({
  status: z.literal("planned"),
  // no providerId — planned has no live connector
  // no docsUrl — docs don't exist yet
  featuredImage: z.string().startsWith("/images/").optional(),
});

export const IntegrationPageSchema = z.discriminatedUnion("status", [
  IntegrationPageLiveSchema,
  IntegrationPageBetaSchema,
  IntegrationPagePlannedSchema,
]);
```

#### 2. `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-labels.ts`

**Changes**:
- Rename the `STATUS_LABEL` key `"coming-soon"` → `"planned"`, label value stays `"Planned"` (match the existing badge copy in `upcoming-integrations-list.tsx:21` and the badge on each row at line 47).

```typescript
export const STATUS_LABEL: Record<
  NonNullable<IntegrationStatus> | "live",
  string
> = {
  live: "Live",
  beta: "Beta",
  planned: "Planned",
};
```

#### 3. `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-sidebar.tsx`

**Changes**:
- Update the CTA branch at line 28: `status === "planned" ? "Join waitlist" : "Connect in workspace"`.

#### 4. `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx`

**Changes**:
- Drop the `PROVIDER_DISPLAY` fallback (lines 62-67) — status is now required by the schema, so derive the displayed status directly from `page.data.status`.
- Replace `getProviderIcon(providerId)` lookup with `IntegrationLogoIcons[page.data.iconKey]` — import `IntegrationLogoIcons` from `@repo/ui/integration-icons` directly.
- Update the `derivedStatus` type to match the schema union without the "coming-soon" literal.
- Remove the unused `PROVIDER_DISPLAY` import.

#### 5. `apps/www/src/lib/builders/integrations.ts`

**Changes**:
- `buildIntegratedAppEntity:35` currently returns null when `providerId` is absent — that's already correct behavior for planned pages. Under the new discriminated union, TypeScript narrows `providerId` to `undefined` for planned, so the existing guard continues to work. No code changes needed here, but add a type assertion that `data.status !== "planned"` when accessing `providerId` if TS complains.

#### 6. `apps/www/src/lib/get-provider-icon.ts`

**Changes**:
- Delete this file — callers move to direct `IntegrationLogoIcons[iconKey]` lookup.
- Find all call sites (`getProviderIcon` in `integrations/page.tsx:12,118`, `[slug]/page.tsx:14,68,141`) and swap to direct indexing.

### Success Criteria

#### Automated Verification

- [x] Typecheck: `pnpm --filter @lightfastai/www typecheck` passes
- [x] Build: `pnpm --filter @lightfastai/www build` passes (schema changes break existing MDX if any field is wrong — expected to fail until Phase 3 is done on the 3 live MDX, since `iconKey` must be added. Do this rename as part of Phase 1)
- [ ] Lint: `pnpm --filter @lightfastai/www check` passes

#### Manual Verification

- [ ] `/integrations/github`, `/integrations/vercel`, `/integrations/linear` still render with correct icon, tagline, featured image, FAQ, sidebar
- [ ] Sidebar CTA still reads "Connect in workspace" for live pages
- [ ] No console errors or missing icons on live pages

**Implementation Note**: Phase 1 includes updating the 3 existing live MDX files to add `iconKey: "github"|"vercel"|"linear"` and `status: "live"` (if missing). Without this the build will fail after the schema split. Pause here for confirmation before Phase 2.

---

## Phase 2: Add the 4 missing icons to `@repo/ui/integration-icons` [DONE]

### Overview

Add SVG entries for `incident-io`, `better-stack`, `customer-io`, `cal-com` in `IntegrationLogoIcons` so every roadmap slug resolves.

### Changes Required

#### 1. `packages/ui/src/components/integration-icons.tsx`

**File**: `packages/ui/src/components/integration-icons.tsx`
**Changes**: Append 4 new entries to the `IntegrationLogoIcons` object literal. Source brand SVGs from each vendor's brand page (or simpleicons.org) — monochrome `currentColor` fills so they inherit `text-foreground`, matching the existing entries.

```typescript
"incident-io": (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* paste monochrome incident.io mark */}
  </svg>
),
"better-stack": (props: IconProps) => (...),
"customer-io": (props: IconProps) => (...),
"cal-com": (props: IconProps) => (...),
```

### Success Criteria

#### Automated Verification

- [x] Typecheck: `pnpm --filter @repo/ui typecheck` passes (icons already existed)
- [x] `integrationIconKeySchema` (Phase 1) enum matches the final `IntegrationLogoIcons` keys 1:1 (manual cross-check)

#### Manual Verification

- [ ] Render a smoke page or storybook frame with the 4 new icons at `size-5` — each displays cleanly at small and large sizes, uses `currentColor`, and has no fill artifacts

---

## Phase 3: Author 37 planned-integration MDX files [DONE]

### Overview

Create one MDX file per roadmap slug in `apps/www/src/content/integrations/`, conforming to `IntegrationPagePlannedSchema`. Use a consistent template with per-integration copy.

### Changes Required

#### 1. `apps/www/src/content/integrations/<slug>.mdx` × 37

**Template**:

```yaml
---
title: "Sentry"
description: "Connect Sentry to Lightfast. Ingest errors, releases, and performance events — resolve issues with full codebase context. Coming soon."
keywords:
  - sentry integration
  - lightfast sentry
  - error tracking
  - release monitoring
  - engineering intelligence
canonicalUrl: "https://lightfast.ai/integrations/sentry"
ogTitle: "Sentry Integration – Coming Soon on Lightfast"
ogDescription: "Connect Sentry to Lightfast. Ingest errors, releases, and performance — coming soon. Join the waitlist."
iconKey: "sentry"
tagline: "Errors, releases, and performance — resolve issues with context."
category: "monitoring"
status: "planned"
updatedAt: "2026-04-15T00:00:00Z"
faq:
  - question: "When will the Sentry integration be available?"
    answer: "We're prioritizing based on design-partner demand. Join the waitlist from this page to be notified when it ships."
  - question: "What Sentry events will Lightfast ingest?"
    answer: "Issues (new, regressed, resolved), releases, deploys, and performance transactions — streamed via webhooks and the Sentry API."
  - question: "Can I request priority on this integration?"
    answer: "Yes. Every waitlist signup is weighed against other roadmap items — tell us what workflows you'd unlock."
---

## Overview

Lightfast's Sentry integration ingests your production errors, release markers, and performance data into a single event stream alongside GitHub, Vercel, and Linear. Ask questions across the data: which PR shipped the regression, what commit introduced the spike, which user first hit the error.

## What we'll ingest

- Issue lifecycle: new, regressed, assigned, resolved, ignored
- Releases and deploy markers across environments
- Performance transactions and tracing data
- Alert rule triggers and notifications

## Why it matters

[1–2 sentence per-integration hook tying this tool into the Lightfast "one question, everywhere" pitch.]

## Status

Planned — join the waitlist to be notified when Sentry is live.
```

**Per-integration tuning required**:
- `title` → from `UPCOMING_INTEGRATIONS[i].name`
- `description` (50–160 chars) → expand from `UPCOMING_INTEGRATIONS[i].description`
- `keywords` (3–20) → include `<slug> integration`, `lightfast <slug>`, + 3 domain-specific terms
- `canonicalUrl` → `https://lightfast.ai/integrations/<slug>`
- `ogTitle`, `ogDescription`
- `iconKey` → matches `UPCOMING_INTEGRATIONS[i].id`
- `tagline` → can reuse `UPCOMING_INTEGRATIONS[i].description` if ≥10 chars
- `category` → mapped per integration per the table in Phase 1
- `status: "planned"`
- `faq` → 3 entries, generic pattern above with per-integration event specifics
- Body → Overview + What we'll ingest + Why it matters, tuned per-integration

**Execution note**: draft the 37 files programmatically (a throwaway Node script that reads the TS array, writes stubs, then hand-tune each). Do **not** check in the script — it's one-shot.

### Success Criteria

#### Automated Verification

- [x] `ls apps/www/src/content/integrations/*.mdx | wc -l` returns 40 (3 live + 37 planned)
- [x] `pnpm --filter @lightfastai/www build` passes — fumadocs schema validation catches any frontmatter issue
- [x] `generateStaticParams` in `[slug]/page.tsx:26` pre-renders all 40

#### Manual Verification

- [ ] Spot-check 5 random planned pages in browser: icon renders, tagline/description display, FAQ expands, sidebar shows "Planned" label + "Join waitlist" button, breadcrumb reads `Integrations / <Title> · Planned`
- [ ] No featured-image 404s (planned pages don't set `featuredImage`)
- [ ] Body copy reads naturally, no template placeholders left in

**Implementation Note**: After automated verification, pause for human review of at least 5 pages' copy before moving to Phase 4.

---

## Phase 4: Index page filtering + related-integrations rework [DONE]

### Overview

Filter the live grid on `/integrations` to live status only. Update the detail page's "Other integrations" section to show live-only when viewing a planned page (converts intent), and same-status-first-then-live when viewing a live page.

### Changes Required

#### 1. `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx`

**Changes**:
- Line 75: `const pages = getIntegrationPages().filter((p) => p.data.status === "live");`
- The card grid (lines 115-142) otherwise stays — keyed by `iconKey` via `IntegrationLogoIcons[page.data.iconKey]` instead of `getProviderIcon(providerId)`.
- Update the FAQ copy on the integrations index (line 22-37) to reflect "37 planned integrations — each with its own page" rather than a flat list.

#### 2. `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx`

**Changes**:
- Rework the related section (lines 125-167) to filter:
  - If current page is planned → related = `getIntegrationPages().filter((p) => p.data.status === "live" && p.slugs[0] !== slug)` (show live integrations to convert intent).
  - If current page is live → related = same status + live siblings.
- Swap `getProviderIcon(p.data.providerId)` at line 141 with `IntegrationLogoIcons[p.data.iconKey]`.

### Success Criteria

#### Automated Verification

- [x] Typecheck + build pass
- [x] Live grid on `/integrations` shows exactly 3 cards

#### Manual Verification

- [ ] `/integrations` renders only live integrations in the main grid
- [ ] `/integrations/sentry` (planned) shows live integrations in the "Other integrations" section
- [ ] `/integrations/github` (live) shows live siblings only
- [ ] No duplicate cards, no planned cards in the live grid

---

## Phase 5: Rework `UpcomingIntegrationsList` + delete TS array [DONE]

### Overview

Make the roadmap list read from MDX and link to each planned page. Delete the now-redundant TS source.

### Changes Required

#### 1. `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/upcoming-integrations-list.tsx`

**Changes**:
- Remove the import from `../_lib/upcoming-integrations`.
- Import `getIntegrationPages` from `~/app/(app)/(content)/_lib/source` and filter `status === "planned"`.
- Sort alphabetically by `title`.
- Each `<li>` becomes a `<NavLink href={`/integrations/${slug}` as Route} prefetch>` wrapping the existing row. Keep the visual treatment; add a hover state matching the live grid cards (`hover:bg-accent/40`).
- Icon source: `IntegrationLogoIcons[page.data.iconKey]`.

#### 2. Delete `apps/www/src/app/(app)/(marketing)/(content)/integrations/_lib/upcoming-integrations.ts`

**Changes**:
- Delete the file.
- `rm -rf` the `_lib` directory if nothing else lives there.

#### 3. Grep for other callers

**Changes**:
- Grep `UPCOMING_INTEGRATIONS` across the repo; remove/migrate any remaining callers. Expected call sites: only `UpcomingIntegrationsList`.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfastai/www build` passes
- [x] `grep -r "UPCOMING_INTEGRATIONS\|upcoming-integrations.ts" apps/www/src` returns nothing

#### Manual Verification

- [ ] Roadmap section on `/integrations` shows 37 linked rows
- [ ] Clicking any row navigates to its planned detail page
- [ ] Hover state looks consistent with the live grid cards
- [ ] Row count indicator still reads "37 planned"

---

## Testing Strategy

### Unit Tests

None added — the existing content pipeline is covered by fumadocs schema validation at build time, which catches every frontmatter error.

### Integration Tests

Build-time validation on 40 MDX files is the integration test. `pnpm build` failing on any schema violation is a hard gate.

### Manual Testing Steps

1. `pnpm dev:www` and visit `/integrations` — live grid shows 3, roadmap shows 37 linked rows.
2. Click through 5 random planned pages — verify icon, tagline, FAQ, sidebar CTA, breadcrumb.
3. Visit `/integrations/github` — verify no regression.
4. Run Lighthouse on one planned page — score should match live pages (no broken images, no CLS issues).
5. View-source a planned page — verify JSON-LD `@graph` includes `WebPage` + `BreadcrumbList` + `FAQPage`, does **not** include `SoftwareApplication` (that's the intended planned behavior).
6. Check `/sitemap.xml` — all 40 integration URLs should be present.
7. Confirm OG image route still generates per planned slug (it reads from MDX, so it should work).

## Performance Considerations

- 40 static pages vs 3 today. Build time will increase marginally; force-static caching keeps runtime identical.
- Bundle size is unaffected — icons are inline SVG already loaded by the roadmap list.
- No new data fetching, no new API routes.

## Migration Notes

- When a planned integration ships live, the migration is: swap MDX `status: "planned"` → `status: "live"`, add `providerId`, `featuredImage`, `docsUrl`. No URL change. No redirect needed. The related-integrations filter (Phase 4) will automatically start including it in the live grid.
- No data migration, no cache busting, no backfill.

## References

- Current integrations index: `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx`
- Current detail page: `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx`
- Schema: `apps/www/src/lib/content-schemas.ts:89-111`
- Sidebar: `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-sidebar.tsx`
- SEO bundle: `apps/www/src/lib/seo-bundle.ts:248-295`, `apps/www/src/lib/builders/integrations.ts`
- Icon source: `packages/ui/src/components/integration-icons.tsx:202`
- Fumadocs config: `apps/www/source.config.ts:42-46`
- Live MDX exemplar: `apps/www/src/content/integrations/github.mdx`
- Roadmap TS array (to delete): `apps/www/src/app/(app)/(marketing)/(content)/integrations/_lib/upcoming-integrations.ts`

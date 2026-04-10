# Featured Image / OG Image Separation

## Overview

Separate the conflated `ogImage` field into two distinct concerns: programmatic OG images (generated via `opengraph-image.tsx` route handlers) and an optional `featuredImage` field for in-page hero rendering. Remove `ogImage` from all schemas and frontmatter entirely.

## Current State Analysis

`ogImage` on `BasePageSchema` (`content-schemas.ts:21`) serves two unrelated purposes:

1. **OG meta tags** — `seo-bundle.ts:69-80` feeds it into `openGraph.images` and `twitter.images`. But for blog and changelog, colocated `opengraph-image.tsx` files already override these meta tags with programmatically generated images.
2. **In-page hero image** — `changelog/[slug]/page.tsx:90-101` and `blog/[slug]/page.tsx:135-145` conditionally render `ogImage` as a `next/image` hero. The changelog uses a hacky string comparison (`!== "https://lightfast.ai/images/og-default.png"`) to suppress the default.

Additional consumers: JSON-LD builders (`blog.ts:38`, `changelog.ts:37`), feed generators (`generate-feed.ts:54`, `generate-changelog-feed.ts:49`), and `ContentSeoData` type (`content-schemas.ts:99`).

17 MDX files across blog, changelog, legal, docs, and API reference all declare `ogImage` in frontmatter. Legal and docs pages lack `opengraph-image.tsx` handlers, falling back to the frontmatter URL.

## Desired End State

- `ogImage` does not exist anywhere in the codebase — no schema field, no frontmatter, no consumers.
- All content types (blog, changelog, legal, docs, API reference) have colocated `opengraph-image.tsx` route handlers that generate OG images programmatically via `@repo/og` layouts.
- `ContentPageSchema` has an optional `featuredImage` field (`z.string().startsWith("/images/")`) for in-page hero images, using relative paths to `apps/www/public/images/`.
- Blog and changelog page components render `featuredImage` as the hero (when present), with no default-URL guard hacks.
- Feed generators and JSON-LD builders reference the programmatic OG URL (`${url}/opengraph-image`) instead of frontmatter.
- `seo-bundle.ts` no longer emits `openGraph.images` or `twitter.images` — the colocated handlers provide these automatically.

### Verification

- `pnpm build:www` succeeds with no type errors
- `grep -r "ogImage" apps/www/src/` returns zero results
- Every content route (`/blog/*`, `/changelog/*`, `/legal/*`, `/docs/*`, `/docs/api-reference/*`) serves a programmatic OG image at its `/opengraph-image` sub-path
- Blog/changelog pages with `featuredImage` render a hero; those without do not
- RSS/Atom feeds include image URLs that resolve to valid PNGs

## What We're NOT Doing

- Adding `featuredImage` to `LegalPageSchema` or `DocsPageSchema` — legal and docs pages have no hero images
- Changing the `@repo/og` layout components themselves — existing layouts are sufficient
- Modifying `opengraph-image.tsx` files for blog or changelog — they already work correctly
- Touching the MDX `img` component or `NextImage` component — inline content images are unaffected

## Implementation Approach

Single atomic change — all modifications ship as one PR. TypeScript enforces consistency: removing `ogImage` from the schema makes every stale reference a compile error. `pnpm build:www` validates all frontmatter against updated Zod schemas.

Ordering within the change set: schema → SEO layer → JSON-LD builders → OG handlers → page components → feed generators → listing metadata → MDX frontmatter.

---

## Changes Required

### 1. Schema: Remove `ogImage`, Add `featuredImage`

**File**: `apps/www/src/lib/content-schemas.ts`

**Remove `ogImage` from `BasePageSchema`** (line 21):

```ts
const BasePageSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  keywords: z.array(z.string().min(1)).min(3).max(20),
  canonicalUrl: z.url(),
  ogTitle: z.string().min(1).max(70),
  ogDescription: z.string().min(50).max(160),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
});
```

**Add `featuredImage` to `ContentPageSchema`** (after line 31):

```ts
const ContentPageSchema = BasePageSchema.extend({
  authors: z.array(AuthorSchema).min(1),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  faq: z.array(FaqItemSchema).min(1),
  featuredImage: z.string().startsWith("/images/").optional(),
});
```

Only blog and changelog (which extend `ContentPageSchema`) get the field. No changes to `LegalPageSchema` or `DocsPageSchema`.

**Remove `ogImage` from `ContentSeoData`** (lines 91-104):

```ts
export type ContentSeoData = Pick<
  BlogPostData,
  | "authors"
  | "description"
  | "keywords"
  | "nofollow"
  | "noindex"
  | "ogDescription"
  | "ogTitle"
  | "publishedAt"
  | "title"
  | "updatedAt"
>;
```

### 2. SEO Bundle: Remove `openGraph.images` and `twitter.images`

**File**: `apps/www/src/lib/seo-bundle.ts`

**In `buildArticleMetadata`** (lines 37-86), remove the `images` property from both `openGraph` and `twitter`:

```ts
// Remove from openGraph (lines 69-71):
images: [
  { url: data.ogImage, width: 1200, height: 630, alt: data.ogTitle },
],

// Remove from twitter (line 80):
images: [data.ogImage],
```

**Note**: This change implicitly covers `emitDocsSeo` (line 127) and `emitApiRefSeo` (line 189), since both call `buildArticleMetadata`. No additional changes needed for those emitters.

**In `emitLegalSeo`** (lines 137-180), same change — remove `images` from `openGraph` (lines 165-167) and `twitter` (line 175). `emitLegalSeo` builds metadata directly via `createMetadata`, not through `buildArticleMetadata`.

### 3. JSON-LD Builders: Use Programmatic OG URL

**File**: `apps/www/src/lib/builders/blog.ts`

Thread `url` through to `buildBlogPostEntity` and replace `data.ogImage`:

```ts
// Before (function signature, line 20):
function buildBlogPostEntity(
  data: BlogPostData
): Omit<BlogPosting, "@id" | "url"> {

// After:
function buildBlogPostEntity(
  data: BlogPostData,
  url: BlogPostUrl
): Omit<BlogPosting, "@id" | "url"> {
```

```ts
// Before (lines 36-41):
image: {
  "@type": "ImageObject" as const,
  url: data.ogImage,
  width: "1200",
  height: "630",
},

// After:
image: {
  "@type": "ImageObject" as const,
  url: `${url}/opengraph-image`,
  width: "1200",
  height: "630",
},
```

Update the call site at line 54:
```ts
// Before:
const entity = buildBlogPostEntity(data);

// After:
const entity = buildBlogPostEntity(data, url);
```

**File**: `apps/www/src/lib/builders/changelog.ts`

Same pattern — add `url: ChangelogUrl` parameter to `buildChangelogEntryEntity` and replace `data.ogImage` with `` `${url}/opengraph-image` ``.

### 4. New OG Route Handlers

Three new files. Follow the exact pattern of existing `blog/[slug]/opengraph-image.tsx` — no `generateStaticParams` export (Next.js inherits params from the co-located `page.tsx` in the same route segment).

#### Legal OG Handler

**File** (new): `apps/www/src/app/(app)/(marketing)/legal/[slug]/opengraph-image.tsx`

Uses `FeatureLayout` — appropriate for legal pages (simple title + description, no authorship metadata).

```tsx
import { FeatureLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { ImageResponse } from "next/og";
import { getLegalPage } from "~/app/(app)/(content)/_lib/source";
import { loadOGFonts } from "~/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "Lightfast Legal";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getLegalPage([slug]);
  const fonts = await loadOGFonts();

  if (!page) {
    return new ImageResponse(<div>Not Found</div>, { ...size });
  }

  const { title, description } = page.data;

  return new ImageResponse(
    <FeatureLayout description={description} title={title} />,
    { ...size, fonts }
  );
}
```

#### Docs OG Handler

**File** (new): `apps/www/src/app/(app)/(content)/docs/(general)/[[...slug]]/opengraph-image.tsx`

```tsx
import { DocsLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { ImageResponse } from "next/og";
import { getPage } from "~/app/(app)/(content)/_lib/source";
import { loadOGFonts } from "~/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "Lightfast Documentation";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const fonts = await loadOGFonts();

  if (!slug || slug.length === 0) {
    return new ImageResponse(
      <DocsLayout title="Documentation" />,
      { ...size, fonts }
    );
  }

  const page = getPage(slug);

  if (!page) {
    return new ImageResponse(<div>Not Found</div>, { ...size });
  }

  return new ImageResponse(
    <DocsLayout
      breadcrumb={slug.map((s) =>
        s.split("-").map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1)).join(" ")
      )}
      title={page.data.title}
    />,
    { ...size, fonts }
  );
}
```

#### API Reference OG Handler

**File** (new): `apps/www/src/app/(app)/(content)/docs/(api)/api-reference/[[...slug]]/opengraph-image.tsx`

```tsx
import { DocsLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { ImageResponse } from "next/og";
import { getApiPage } from "~/app/(app)/(content)/_lib/source";
import { loadOGFonts } from "~/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "Lightfast API Reference";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const fonts = await loadOGFonts();

  if (!slug || slug.length === 0) {
    return new ImageResponse(
      <DocsLayout section="API Reference" title="API Reference" />,
      { ...size, fonts }
    );
  }

  const page = getApiPage(slug);

  if (!page) {
    return new ImageResponse(<div>Not Found</div>, { ...size });
  }

  return new ImageResponse(
    <DocsLayout section="API Reference" title={page.data.title} />,
    { ...size, fonts }
  );
}
```

### 5. Page Components: Swap `ogImage` to `featuredImage`

#### Blog Entry Page

**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`

Replace `ogImage` with `featuredImage` in destructuring (line 50) and hero rendering (lines 135-145):

```tsx
{featuredImage && (
  <div className="relative mt-8 mb-12 aspect-video overflow-hidden rounded-lg">
    <Image
      alt={title}
      className="h-full w-full object-cover"
      fill
      priority
      src={featuredImage}
    />
  </div>
)}
```

**Behavioral change**: The existing blog post's `ogImage` is `og-default.png`, which currently renders as a hero. After this change, `featuredImage` is `undefined` — no hero. This is intentional — the placeholder was never meant to be in-page content.

#### Changelog Entry Page

**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

Replace `ogImage` with `featuredImage` in destructuring (line 55). Replace hero rendering (lines 90-101) — remove the `og-default.png` guard:

```tsx
{featuredImage && (
  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
    <Image
      alt={title}
      className="h-full w-full object-cover"
      fill
      priority
      src={featuredImage}
    />
  </div>
)}
```

#### Changelog Listing Page — Preview Cards

**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx`

Replace `page.data.ogImage` with `page.data.featuredImage` in preview card rendering (lines 149-160), remove `og-default.png` guard:

```tsx
{page.data.featuredImage && (
  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
    <Image
      alt={page.data.title}
      className="h-full w-full object-cover"
      fill
      src={page.data.featuredImage}
    />
  </div>
)}
```

### 6. Feed Generators: Use Programmatic OG URL

**File**: `apps/www/src/app/(app)/_lib/feeds/generate-feed.ts`

```ts
// Before (line 54):
image: page.data.ogImage,

// After:
image: `${url}/opengraph-image`,
```

**File**: `apps/www/src/app/(app)/_lib/feeds/generate-changelog-feed.ts`

```ts
// Before (line 49):
image: page.data.ogImage,

// After:
image: `${url}/opengraph-image`,
```

### 7. Changelog Listing: Clean Up Static Metadata

**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx`

Remove hardcoded `images` from the static `metadata` export's `openGraph` (lines 57-64) and `twitter` (line 72) objects. These contain `"https://lightfast.ai/images/og-default.png"` as a literal string (not schema-driven). The changelog listing page has no colocated `opengraph-image.tsx`, so the app-level default OG image will apply.

### 8. MDX Frontmatter: Remove `ogImage`

Delete the `ogImage: ...` line from all 17 MDX files:

**Blog** (1 file):
- `apps/www/src/content/blog/2026-03-26-hello-world.mdx`

**Changelog** (1 file):
- `apps/www/src/content/changelog/2026-03-26-initial.mdx`

**Legal** (2 files):
- `apps/www/src/content/legal/privacy.mdx`
- `apps/www/src/content/legal/terms-of-service.mdx`

**Docs** (8 files):
- `apps/www/src/content/docs/get-started/overview.mdx`
- `apps/www/src/content/docs/get-started/quickstart.mdx`
- `apps/www/src/content/docs/connectors/github.mdx`
- `apps/www/src/content/docs/connectors/linear.mdx`
- `apps/www/src/content/docs/connectors/sentry.mdx`
- `apps/www/src/content/docs/connectors/vercel.mdx`
- `apps/www/src/content/docs/integrate/mcp.mdx`
- `apps/www/src/content/docs/integrate/sdk.mdx`

**API Reference** (5 files):
- `apps/www/src/content/api/getting-started/authentication.mdx`
- `apps/www/src/content/api/getting-started/errors.mdx`
- `apps/www/src/content/api/getting-started/overview.mdx`
- `apps/www/src/content/api/sdks-tools/mcp-server.mdx`
- `apps/www/src/content/api/sdks-tools/typescript-sdk.mdx`

No current content entries need `featuredImage` set. The existing changelog entry uses `og-default.png` as `ogImage` (guarded against and never displayed as hero). Future entries can add `featuredImage: "/images/changelog/v020-hero.png"` to display a hero.

---

## Success Criteria

### Automated Verification

- [x] `pnpm typecheck` passes — no remaining references to `ogImage` in TypeScript
- [x] `pnpm build:www` succeeds — fumadocs validates all frontmatter against updated schemas, OG route handlers generate images at build time
- [x] `pnpm check` passes — lint clean (pre-existing Clerk re-export errors unrelated to this change)
- [x] `grep -r "ogImage" apps/www/src/` returns zero results (word-boundary match; `ogImageUrl` is a new local variable, not the removed field)
- [x] `grep -r "og-default.png" apps/www/src/` returns zero results

### Manual Verification

- [ ] Blog post without `featuredImage` shows no hero (intentional — `og-default.png` placeholder removed)
- [ ] Changelog entry without `featuredImage` shows no hero
- [ ] Changelog listing shows preview images only for entries with `featuredImage`
- [ ] OG meta tags served correctly for all content types (check `<meta property="og:image">` in devtools)
- [ ] Visit `/legal/privacy/opengraph-image` — renders `FeatureLayout` OG image with title
- [ ] Visit `/docs/og/get-started/overview` — renders `DocsLayout` with breadcrumb (route handler, not co-located — Next.js doesn't support opengraph-image.tsx inside `[[...slug]]`)
- [ ] Visit `/docs/api-reference/og/getting-started/overview` — renders `DocsLayout` with "API Reference" section (route handler)
- [ ] Existing blog/changelog OG images still work
- [ ] RSS feeds at `/blog/rss.xml` and `/changelog/rss.xml` include image URLs that resolve

---

## Testing Strategy

### Automated Tests

- `pnpm typecheck` — catches all type errors from `ogImage` removal
- `pnpm check` — lint + format
- `pnpm build:www` — fumadocs frontmatter validation, Next.js static generation, OG handler execution

### Manual Testing Steps

1. Build the site: `pnpm build:www`
2. Start preview: `cd apps/www && pnpm start`
3. Check each content type's OG image:
   - `/blog/2026-03-26-hello-world/opengraph-image`
   - `/changelog/2026-03-26-initial/opengraph-image`
   - `/legal/privacy/opengraph-image`
   - `/docs/get-started/overview/opengraph-image`
   - `/docs/api-reference/overview/opengraph-image`
4. Check hero images do NOT render on pages without `featuredImage`
5. Validate RSS feeds at `/blog/rss.xml` and `/changelog/rss.xml`
6. Use a social sharing debugger to verify OG tags resolve for each content type

## Performance Considerations

- New OG handlers add build-time image generation for legal (2 pages), docs (~8 pages), and API reference (~5 pages). Each takes ~100-200ms. Negligible impact on total build time.
- No runtime performance changes — all pages are `force-static`.

## References

- Research: `thoughts/shared/research/2026-04-09-changelog-ogimage-featuredimage-rework.md`
- Superseded plan: `thoughts/shared/plans/2026-04-09-changelog-ogimage-featuredimage-rework.md`
- Schema: `apps/www/src/lib/content-schemas.ts`
- SEO bundle: `apps/www/src/lib/seo-bundle.ts`
- Blog OG handler (reference pattern): `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/opengraph-image.tsx`
- Changelog OG handler (reference pattern): `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/opengraph-image.tsx`
- `@repo/og` layouts: `packages/og/src/layouts/`

## Improvement Log

### 2026-04-10 — Adversarial Review

**Collapsed 3 phases into 1 atomic change** — No data migrations or API contracts; TypeScript enforces consistency across the entire change set. Single PR is faster to implement, review, and deploy. The 3-phase approach added overhead without meaningful safety benefit for a static content site.

**Fixed Legal OG handler layout** — Replaced `ContentLayout` (designed for authored content with category/date/author) with `FeatureLayout` (title + description only). Legal pages extend `BasePageSchema` with no authorship metadata; `ContentLayout` was semantically incorrect. Matches predecessor plan's corrected choice.

**Removed `generateStaticParams` from new OG handlers** — Existing blog/changelog `opengraph-image.tsx` files don't export `generateStaticParams`; Next.js App Router inherits params from the co-located `page.tsx` in the same route segment. Adding it was redundant and inconsistent with established patterns.

**Added changelog listing static metadata cleanup (§7)** — `changelog/page.tsx` has hardcoded `og-default.png` in its static `metadata` export's `openGraph.images` and `twitter.images`. This is a literal URL string, not schema-driven — `grep -r "ogImage"` wouldn't catch it. The predecessor plan caught this; the new plan had dropped it.

**Removed dead fallback code** — `page.data.title ?? "Documentation"` and `page.data.title ?? "API Reference"` in Docs/API OG handlers were dead code since `BasePageSchema` defines `title: z.string().min(1)`. Replaced with direct `page.data.title` access.

**Added `og-default.png` grep to verification** — `grep -r "ogImage"` alone misses hardcoded `og-default.png` URLs that aren't tied to the schema field name. Added as a second verification grep.

**Called out `emitDocsSeo`/`emitApiRefSeo` coverage** — Added explicit note in §2 that these emitters are implicitly fixed by the `buildArticleMetadata` change, preventing implementer confusion.

**Marked predecessor plan as superseded** — Added superseded notice to `thoughts/shared/plans/2026-04-09-changelog-ogimage-featuredimage-rework.md` to avoid confusion about which plan is canonical.

### 2026-04-10 — Implementation Deviations

**Docs/API OG handlers moved to route handlers** — Next.js doesn't support co-located `opengraph-image.tsx` inside optional catch-all `[[...slug]]` route segments (build error: "Optional catch-all must be the last part of the URL"). Replaced with `GET` route handlers at `/docs/og/[...slug]/route.tsx` and `/docs/api-reference/og/[...slug]/route.tsx`. These export `generateStaticParams` for static pre-rendering. `emitDocsSeo` and `emitApiRefSeo` now pass explicit `openGraph.images` / `twitter.images` via an optional `ogImageUrl` parameter on `buildArticleMetadata`.

**Blog listing static metadata cleanup** — The plan's §7 only covered the changelog listing. The blog listing page (`blog/(listing)/page.tsx`) had the same hardcoded `og-default.png` in `openGraph.images` and `twitter.images`. Cleaned up in the same pass.

**Kept `page.data.title ?? "API Reference"` fallback** — The plan's adversarial review removed this as dead code, but the API reference source uses `multiple()` combining MDX and OpenAPI virtual pages. OpenAPI pages have `title?: string` (optional), so the fallback is necessary for type safety.

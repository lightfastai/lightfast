# Marketing Integrations Page Implementation Plan

## Overview

Ship a marketing `/integrations` index and `/integrations/<id>` detail pages on `apps/www`, modelled on Linear's integrations surface. Reuses the existing fumadocs-mdx content pipeline (same pattern as blog/changelog/legal). GitHub is the only detail page authored in v1; Vercel and Linear appear as cards on the index; Vercel/Linear/Sentry/Apollo detail MDX land in follow-up PRs. Adds a top-level `Integrations` entry to `INTERNAL_NAV`.

## Current State Analysis

- `apps/www` has four existing MDX collections — `docs`, `apiDocs`, `blogCollection`, `changelogCollection`, `legalCollection` — all defined in `apps/www/source.config.ts:13-39` with Zod schemas in `apps/www/src/lib/content-schemas.ts`.
- The fumadocs loader is wrapped in `apps/www/src/app/(app)/(content)/_lib/source.ts:97-105` exposing `getChangelogPage/getChangelogPages` helpers — the direct template for integrations.
- JSON-LD builders live per-content-type in `apps/www/src/lib/builders/` and are re-exported from `apps/www/src/lib/builders/index.ts`.
- SEO bundles in `apps/www/src/lib/seo-bundle.ts` fuse metadata + JSON-LD into typed `SeoBundle` returns per content type.
- URL-type brands live in `apps/www/src/lib/url-types.ts`.
- Nav is defined in `apps/www/src/config/nav.ts` with compile-time `Route<H>` validation via `defineNavItems` in `apps/www/src/types/nav.ts`.
- `apps/www/src/app/sitemap.ts` is the authoritative sitemap for the www zone (research doc incorrectly attributed it to `apps/app`).
- Provider display metadata lives in `packages/app-providers/src/client/display.ts` (`PROVIDER_DISPLAY`, `providerSlugSchema` enum with `apollo`/`github`/`vercel`/`linear`/`sentry`).
- Broader icon set (14 providers) in `packages/ui/src/components/integration-icons.tsx` (`IntegrationLogoIcons`).
- `<IntegrationShowcase>` already in use on the landing page at `apps/www/src/app/(app)/_components/integration-showcase.tsx`.
- `@repo/og` `<ContentLayout>` (packages/og/src/layouts/content.tsx) is the canonical OG image layout — reused by blog/changelog.
- Existing connector docs at `apps/www/src/content/docs/connectors/{github,linear,vercel,sentry}.mdx` (technical surface; cross-linked but separate from marketing).
- No `/integrations` route exists today.

### Key Discoveries

- `ProviderSlug` enum (`packages/app-providers/src/client/display.ts:15-23`) is client-safe and can be imported into `apps/www/src/lib/content-schemas.ts` without pulling server-only provider code.
- `createArticleMetadata` (`apps/www/src/lib/content-seo.ts:37-55`) forces `og:type: "article"` — we want `createMetadata` with `og:type: "website"` for integrations (matches legal pages pattern).
- Canonical URL pattern in schemas uses `.refine((val) => val.startsWith("https://lightfast.ai/<prefix>/"))` per content type — same pattern applies to integrations.
- `mdxComponents` spread `defaultMdxComponents` first then overrides — new components (`IntegrationHero`, etc.) slot in at the component map.
- Sitemap already sorts blog/changelog entries by `publishedAt`; integrations have no `publishedAt` so we emit them with static priority and no `lastModified` (or use a file-mtime-free approach).

## Desired End State

- `/integrations` renders a static index listing GitHub, Vercel, and Linear, with coming-soon badges driven by `PROVIDER_DISPLAY.comingSoon` (override via MDX `status`).
- `/integrations/github` renders a marketing detail page with hero, feature grid, screenshots, FAQ, CTAs. OG image served at `/integrations/github/opengraph-image`.
- `Integrations` appears as a top-level nav item on desktop, mobile, and pitch-deck navbars (all three auto-pick-up from `INTERNAL_NAV`).
- Sitemap emits `/integrations` and `/integrations/github` with proper priorities.
- JSON-LD includes `Organization`, `WebSite`, `WebPage` (the marketing page), `SoftwareApplication` (the provider being integrated), `BreadcrumbList`, and `FAQPage` when FAQ present.
- PostHog events fire with `providerId` on both index-card clicks and detail CTA clicks.
- `pnpm typecheck --filter=@repo/www` passes; `pnpm check --filter=@repo/www` passes; `pnpm build --filter=@repo/www` passes.

### Verification

Load `http://localhost:4101/integrations` in a browser: index grid renders with three cards, Linear shows coming-soon badge. Click GitHub card → lands on `/integrations/github` with hero, features, FAQ. View page source: JSON-LD `@graph` contains the expected entities. `curl http://localhost:4101/sitemap.xml | grep integrations` returns both URLs.

## What We're NOT Doing

- RSS/Atom/feed routes (integrations are not a news stream).
- Prev/next navigation between integrations.
- Auto-generating pages from the `PROVIDERS` registry (marketing needs human-authored differentiating copy).
- Per-integration waitlist forms (reuse generic `WaitlistCTA`).
- Vercel, Linear, Sentry, Apollo detail MDX (follow-up PRs after pattern is validated).
- Fumadocs in-app search indexing (parity with blog/changelog — not a regression).
- Remotion programmatic featured-image templates (follow-up).
- Unified merge with `/docs/connectors/*` (dual-surface strategy is intentional per research).
- Generic content-type factory abstractions (clone the changelog pipeline inline).

## Implementation Approach

Clone the changelog pipeline pattern near-verbatim, strip chronology (no `publishedAt`, no feeds, no prev/next sort), and add integration-specific surface (hero/feature grid components, optional `providerId` linkage to `PROVIDER_DISPLAY`). Build the schema + data pipeline first, then SEO infrastructure, then components, then pages, then wiring. GitHub MDX proves the end-to-end pattern before Vercel/Linear MDX land as content-only PRs.

---

## Phase 1: Content Pipeline Foundation

### Overview

Introduce the `IntegrationPageSchema`, register `integrationsCollection`, wrap with fumadocs loader, add typed URL brand, and scaffold the content directory.

### Changes Required

#### 1. Schema — `apps/www/src/lib/content-schemas.ts`

Add `IntegrationPageSchema` extending `BasePageSchema` directly (NOT `ContentPageSchema` — `authors`/`publishedAt` don't apply). Reuse existing `FaqItemSchema` (already defined). Import `providerSlugSchema` from `@repo/app-providers` client bundle.

> **Implementation deviation**: `providerSlugSchema` is inlined as a local zod enum in `content-schemas.ts` instead of imported from `@repo/app-providers/client`. fumadocs-mdx's esbuild-based loader runs `source.config.ts` → `content-schemas.ts` under raw Node ESM, which can't resolve the extensionless internal re-exports inside `@repo/app-providers/src/client.ts` (e.g., `export * from "./client/categories"`). Keep the inlined enum in sync with `packages/app-providers/src/client/display.ts`. The runtime `PROVIDER_DISPLAY` import works fine inside Next.js-bundled code (Phase 2 builders, Phase 4 page).

```ts
// Inlined mirror of providerSlugSchema (see deviation note above)
const providerSlugSchema = z.enum([
  "apollo",
  "github",
  "vercel",
  "linear",
  "sentry",
]);

const IntegrationStatusSchema = z.enum(["live", "beta", "coming-soon"]);
const IntegrationCategorySchema = z.enum([
  "dev-tools",
  "monitoring",
  "comms",
  "data",
  "project-management",
]);

export const IntegrationPageSchema = BasePageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/integrations/"))
    .optional(),
  providerId: providerSlugSchema.optional(),
  tagline: z.string().min(10).max(120),
  category: IntegrationCategorySchema,
  featuredImage: z.string().startsWith("/images/").optional(),
  docsUrl: z.string().startsWith("/docs/").optional(),
  status: IntegrationStatusSchema.optional(),
  faq: z.array(FaqItemSchema).min(1).optional(),
  updatedAt: z.iso.datetime(),
});

export type IntegrationPageData = z.infer<typeof IntegrationPageSchema>;
export type IntegrationCategory = IntegrationPageData["category"];
export type IntegrationStatus = IntegrationPageData["status"];
```

Verify `@repo/app-providers/client` export path exists — search for `client/display` re-export in package `index.ts` or `package.json` exports map. If `providerSlugSchema` isn't client-surfaced, add it to the package's client barrel.

#### 2. Collection registration — `apps/www/source.config.ts`

Add collection after `legalCollection`:

```ts
import {
  BlogPostSchema,
  ChangelogEntrySchema,
  DocsPageSchema,
  IntegrationPageSchema,
  LegalPageSchema,
} from "./src/lib/content-schemas";

export const integrationsCollection = defineCollections({
  type: "doc",
  dir: "src/content/integrations",
  schema: IntegrationPageSchema,
});
```

#### 3. Source loader — `apps/www/src/app/(app)/(content)/_lib/source.ts`

Add after the legal section:

```ts
import {
  apiDocs,
  apiMeta,
  blogCollection,
  changelogCollection,
  docs,
  integrationsCollection,
  legalCollection,
  meta,
} from "fumadocs-mdx:collections/server";

// ... existing code ...

// --- Integrations ---
const integrationsSource = loader({
  baseUrl: "/integrations",
  source: toFumadocsSource(integrationsCollection, []),
});

export const getIntegrationPage = (slugs: string[]) =>
  integrationsSource.getPage(slugs);
export const getIntegrationPages = () => integrationsSource.getPages();
```

#### 4. URL brand — `apps/www/src/lib/url-types.ts`

```ts
export type IntegrationUrl = LightfastUrl<`integrations/${string}`>;
```

#### 5. Content directory — `apps/www/src/content/integrations/`

Create the directory (empty). A placeholder `.gitkeep` is unnecessary because GitHub MDX lands in Phase 5.

### Success Criteria

> **Filter name correction**: the workspace package is `@lightfast/www`, not `@repo/www`. Use `pnpm typecheck --filter=@lightfast/www` (or `cd apps/www && pnpm typecheck`).

#### Automated Verification

- [x] `pnpm typecheck` passes (run from `apps/www/`)
- [ ] `pnpm check --filter=@lightfast/www` passes
- [x] `pnpm build:www` succeeds (fumadocs-mdx generates types for empty `integrationsCollection`)

#### Manual Verification

- [ ] Importing `getIntegrationPages` from source.ts in a scratch file type-checks against expected shape
- [ ] `providerSlugSchema` is importable client-side (no server imports pulled in)

---

## Phase 2: SEO Infrastructure

### Overview

Build the JSON-LD graph builder, add `emitIntegrationSeo` to the seo-bundle, and wire re-exports.

### Changes Required

#### 1. JSON-LD builder — `apps/www/src/lib/builders/integrations.ts` (new file)

```ts
import type {
  FAQPage,
  GraphContext,
  SoftwareApplication,
  WebPage,
} from "@vendor/seo/json-ld";
import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import type { IntegrationPageData } from "~/lib/content-schemas";
import type { IntegrationUrl } from "~/lib/url-types";
import {
  buildBreadcrumbList,
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "./shared";

function buildIntegrationPageEntity(
  data: IntegrationPageData,
  url: IntegrationUrl
): Omit<WebPage, "@id" | "url"> {
  return {
    "@type": "WebPage",
    name: data.title,
    description: data.description,
    dateModified: data.updatedAt,
    inLanguage: "en-US",
    isPartOf: { "@id": "https://lightfast.ai/#website" },
    publisher: { "@id": "https://lightfast.ai/#organization" },
    about: data.providerId
      ? { "@id": `${url}#integrated-app` }
      : undefined,
    keywords: data.keywords.join(", "),
  };
}

function buildIntegratedAppEntity(
  data: IntegrationPageData,
  url: IntegrationUrl
): SoftwareApplication | null {
  if (!data.providerId) return null;
  const display = PROVIDER_DISPLAY[data.providerId];
  return {
    "@type": "SoftwareApplication",
    "@id": `${url}#integrated-app`,
    name: display.displayName,
    description: display.description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
  };
}

export function buildIntegrationJsonLd(
  data: IntegrationPageData,
  url: IntegrationUrl
): GraphContext {
  const entity = buildIntegrationPageEntity(data, url);
  const integratedApp = buildIntegratedAppEntity(data, url);
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      { ...entity, "@id": `${url}#webpage`, url },
      ...(integratedApp ? [integratedApp] : []),
      ...(data.faq && data.faq.length > 0 ? [buildFaqEntity(data.faq, url)] : []),
      buildBreadcrumbList([
        { name: "Home", url: "https://lightfast.ai" },
        { name: "Integrations", url: "https://lightfast.ai/integrations" },
        { name: data.title, url },
      ]),
    ],
  };
}
```

Verify `SoftwareApplication` type is exported from `@vendor/seo/json-ld`. If not, either add it to the vendor barrel or use the structural shape directly (following the same pattern the changelog builder uses for `BlogPosting`).

#### 2. Builder re-export — `apps/www/src/lib/builders/index.ts`

```ts
export { buildIntegrationJsonLd } from "./integrations";
```

#### 3. SEO bundle — `apps/www/src/lib/seo-bundle.ts`

Add alongside existing emitters:

```ts
import type { IntegrationPageData } from "./content-schemas";
import type { IntegrationUrl } from "./url-types";
import { buildIntegrationJsonLd } from "./builders";

export function emitIntegrationSeo(
  data: IntegrationPageData,
  url: IntegrationUrl
): SeoBundle {
  const canonicalUrl = data.canonicalUrl ?? url;
  const ogImageUrl = `${url}/opengraph-image`;
  return {
    metadata: createMetadata({
      title: `${data.title} – Lightfast Integrations`,
      description: data.description,
      keywords: data.keywords,
      creator: "Lightfast",
      publisher: "Lightfast",
      robots: {
        index: !data.noindex,
        follow: !data.nofollow,
        googleBot: {
          index: !data.noindex,
          follow: !data.nofollow,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: data.ogTitle,
        description: data.ogDescription,
        type: "website",
        url: canonicalUrl,
        siteName: "Lightfast Integrations",
        locale: "en_US",
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: data.ogTitle }],
      },
      twitter: {
        card: "summary_large_image",
        title: data.ogTitle,
        description: data.ogDescription,
        site: "@lightfastai",
        creator: "@lightfastai",
        images: [ogImageUrl],
      },
    }),
    jsonLd: buildIntegrationJsonLd(data, url),
  };
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [ ] `pnpm check --filter=@lightfast/www` passes

#### Manual Verification

- [ ] Calling `emitIntegrationSeo` in a scratch file returns the expected `{ metadata, jsonLd }` shape
- [ ] `jsonLd["@graph"]` includes `Organization`, `WebSite`, `WebPage`, `SoftwareApplication`, `BreadcrumbList`

---

## Phase 3: MDX Components & Provider Helpers

### Overview

Add `getProviderIcon(providerId)` helper, and three new MDX components — `IntegrationHero`, `IntegrationFeatureGrid`, `IntegrationScreenshot` — wired into `mdxComponents`.

### Changes Required

#### 1. Provider icon helper — `apps/www/src/lib/get-provider-icon.ts` (new file)

```ts
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import type { ProviderSlug } from "@repo/app-providers/client";

const PROVIDER_TO_ICON_KEY: Record<ProviderSlug, keyof typeof IntegrationLogoIcons> = {
  apollo: "apollo",
  github: "github",
  vercel: "vercel",
  linear: "linear",
  sentry: "sentry",
};

export function getProviderIcon(providerId: ProviderSlug) {
  return IntegrationLogoIcons[PROVIDER_TO_ICON_KEY[providerId]];
}
```

The mapping is 1:1 today; the indirection future-proofs against divergence between `ProviderSlug` union and `IntegrationLogoIcons` key set (14 icons, 5 providers).

#### 2. IntegrationHero — `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-hero.tsx`

```tsx
"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ComponentType, SVGProps } from "react";

interface IntegrationHeroProps {
  title: string;
  tagline: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  status?: "live" | "beta" | "coming-soon";
  className?: string;
}

export function IntegrationHero({
  title,
  tagline,
  icon: Icon,
  status,
  className,
}: IntegrationHeroProps) {
  return (
    <div className={cn("flex flex-col gap-6 py-12", className)}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border/50 bg-card/40">
            <Icon aria-hidden className="size-8 text-foreground" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            {title}
          </h1>
          {status && status !== "live" && (
            <span className="inline-flex w-fit items-center rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs uppercase tracking-wider">
              {status === "coming-soon" ? "Coming soon" : "Beta"}
            </span>
          )}
        </div>
      </div>
      <p className="max-w-2xl text-muted-foreground text-lg leading-relaxed">
        {tagline}
      </p>
    </div>
  );
}
```

#### 3. IntegrationFeatureGrid — same directory, `integration-feature-grid.tsx`

Renders a 2-column responsive grid that accepts children (individual `IntegrationFeature` cards authored in MDX) — simpler than a props-driven array, and matches the research decision to keep structured visual content in MDX body.

```tsx
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

export function IntegrationFeatureGrid({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "my-12 grid grid-cols-1 gap-4 sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function IntegrationFeature({
  title,
  children,
}: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xs border border-border/50 bg-card/40 p-6">
      <h3 className="mb-2 font-medium text-base text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {children}
      </p>
    </div>
  );
}
```

#### 4. IntegrationScreenshot — same directory, `integration-screenshot.tsx`

Wrapper around `next/image` with the visual chrome used on the changelog featured image.

```tsx
import Image from "next/image";

export function IntegrationScreenshot({
  src,
  alt,
  caption,
}: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-10">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/50 bg-card">
        <Image
          alt={alt}
          className="h-full w-full object-cover"
          fill
          src={src}
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-muted-foreground text-sm">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
```

#### 5. MDX component registration — `apps/www/src/app/(app)/(content)/_lib/mdx-components.tsx`

Import and add to the exported map:

```tsx
import { IntegrationHero } from "~/app/(app)/(marketing)/(content)/integrations/_components/integration-hero";
import {
  IntegrationFeature,
  IntegrationFeatureGrid,
} from "~/app/(app)/(marketing)/(content)/integrations/_components/integration-feature-grid";
import { IntegrationScreenshot } from "~/app/(app)/(marketing)/(content)/integrations/_components/integration-screenshot";

export const mdxComponents = {
  ...defaultMdxComponents,
  // ... existing overrides ...

  // Integration components
  IntegrationHero,
  IntegrationFeatureGrid,
  IntegrationFeature,
  IntegrationScreenshot,
};
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [ ] `pnpm check --filter=@lightfast/www` passes

#### Manual Verification

- [ ] Storybook/scratch render of `IntegrationHero` displays icon + title + tagline
- [ ] Grid layout is responsive at 375px, 768px, 1200px

---

## Phase 4: Index Page

### Overview

Static `/integrations` index with FAQ, JSON-LD, and a 3-card grid.

### Changes Required

#### 1. Layout — `apps/www/src/app/(app)/(marketing)/(content)/integrations/layout.tsx`

```tsx
export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
```

#### 2. Index page — `apps/www/src/app/(app)/(marketing)/(content)/integrations/page.tsx`

```tsx
import { JsonLd } from "@vendor/seo/json-ld";
import type { GraphContext } from "@vendor/seo/json-ld";
import type { Metadata, Route } from "next";
import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import { getIntegrationPages } from "~/app/(app)/(content)/_lib/source";
import { getProviderIcon } from "~/lib/get-provider-icon";
import { NavLink } from "~/components/nav-link";
import {
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "~/lib/builders";
import { createMetadata } from "~/lib/content-seo";
import { IntegrationCardAnalytics } from "./_components/integration-card-analytics";

export const dynamic = "force-static";

const PAGE_TITLE = "Integrations";
const PAGE_DESCRIPTION =
  "Connect Lightfast to the tools your engineering org already runs on. GitHub, Vercel, Linear, Sentry, and more — one integration, every event.";
const PAGE_URL = "https://lightfast.ai/integrations";
const FAQ = [
  {
    question: "What integrations does Lightfast support?",
    answer:
      "Lightfast integrates with GitHub and Vercel today, with Linear, Sentry, and Apollo shipping next. Each integration ingests events in real-time via OAuth and webhooks.",
  },
  {
    question: "How do I connect an integration?",
    answer:
      "Install the integration from your Lightfast workspace under Settings → Integrations. OAuth flow completes in under a minute; events start flowing immediately.",
  },
  {
    question: "Can I request a new integration?",
    answer:
      "Yes. Join the waitlist from any coming-soon integration page — demand drives our roadmap prioritisation.",
  },
];

export const metadata: Metadata = createMetadata({
  title: `${PAGE_TITLE} | Lightfast`,
  description: PAGE_DESCRIPTION,
  keywords: [
    "lightfast integrations",
    "github integration",
    "vercel integration",
    "linear integration",
    "engineering intelligence integrations",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Lightfast Integrations",
    description: PAGE_DESCRIPTION,
    type: "website",
    url: PAGE_URL,
    siteName: "Lightfast",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Integrations",
    description: PAGE_DESCRIPTION,
    site: "@lightfastai",
    creator: "@lightfastai",
  },
});

export default function IntegrationsIndexPage() {
  const pages = getIntegrationPages();

  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "WebPage" as const,
        "@id": `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: "Lightfast Integrations",
        description: PAGE_DESCRIPTION,
        isPartOf: { "@id": "https://lightfast.ai/#website" },
        publisher: { "@id": "https://lightfast.ai/#organization" },
      },
      buildFaqEntity(FAQ, PAGE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl pt-24 pb-32">
      <JsonLd code={structuredData} />
      <div className="mb-12">
        <h1 className="mb-4 font-medium font-pp text-4xl text-foreground">
          Integrations
        </h1>
        <p className="max-w-2xl text-muted-foreground text-lg leading-relaxed">
          {PAGE_DESCRIPTION}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => {
          const { providerId, status: mdxStatus, title, tagline } = page.data;
          const derivedStatus: "live" | "beta" | "coming-soon" =
            mdxStatus ??
            (providerId && PROVIDER_DISPLAY[providerId].comingSoon
              ? "coming-soon"
              : "live");
          const Icon = providerId ? getProviderIcon(providerId) : undefined;
          const slug = page.slugs[0] ?? "";

          return (
            <IntegrationCardAnalytics
              key={slug}
              providerId={providerId}
              slug={slug}
            >
              <NavLink
                href={`/integrations/${slug}` as Route}
                prefetch
                className="group flex h-full flex-col gap-4 rounded-lg border border-border/50 bg-card/40 p-6 transition-colors hover:border-border hover:bg-card"
              >
                <div className="flex items-center justify-between">
                  {Icon && (
                    <Icon aria-hidden className="size-8 text-foreground" />
                  )}
                  {derivedStatus !== "live" && (
                    <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs uppercase tracking-wider">
                      {derivedStatus === "coming-soon" ? "Soon" : "Beta"}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="font-medium font-pp text-xl text-foreground">
                    {title}
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {tagline}
                  </p>
                </div>
              </NavLink>
            </IntegrationCardAnalytics>
          );
        })}
      </div>
    </div>
  );
}
```

> **Implementation deviation**: PostHog isn't wired in `apps/www` (only Vercel Analytics is). The `IntegrationCardAnalytics` wrapper below was **skipped entirely** during implementation — the index page uses a plain `<NavLink>` directly. Wire PostHog in a follow-up before reintroducing this component.

> **Implementation deviation — `comingSoon` access**: `PROVIDER_DISPLAY` is typed as a literal `as const` map, so TS narrows per-key — `comingSoon` only exists on apollo/linear/sentry, not github/vercel. Accessing `PROVIDER_DISPLAY[providerId].comingSoon` directly errors. Use:
> ```ts
> const providerComingSoon =
>   providerId && "comingSoon" in PROVIDER_DISPLAY[providerId]
>     ? PROVIDER_DISPLAY[providerId].comingSoon
>     : false;
> ```
> Phase 5's detail page derives the same `derivedStatus` and needs the same pattern.

#### 3. Analytics wrapper — `apps/www/src/app/(app)/(marketing)/(content)/integrations/_components/integration-card-analytics.tsx` (SKIPPED in v1)

```tsx
"use client";

import { usePostHog } from "posthog-js/react";
import type { ProviderSlug } from "@repo/app-providers/client";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  slug: string;
  providerId?: ProviderSlug;
}

export function IntegrationCardAnalytics({ children, slug, providerId }: Props) {
  const posthog = usePostHog();
  return (
    <div
      onClick={() => {
        posthog?.capture("integration_card_clicked", {
          slug,
          providerId: providerId ?? null,
        });
      }}
    >
      {children}
    </div>
  );
}
```

Verify PostHog provider is mounted upstream — search for `usePostHog` usage in `apps/www`. If not already wired, fall back to a plain click handler and land PostHog wiring in a follow-up.

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [ ] `pnpm check --filter=@lightfast/www` passes
- [x] `pnpm build:www` succeeds (`/integrations` listed as `○` static prerender)

#### Manual Verification

- [ ] `pnpm dev:www` and open `http://localhost:4101/integrations` — page renders with grid (empty grid if no MDX yet; Phase 5 adds GitHub)
- [ ] View source shows JSON-LD block with FAQ
- [ ] Page metadata (title/description) matches expected
- [ ] Responsive at 375px, 768px, 1200px

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Detail Page + GitHub MDX

### Overview

Static `/integrations/[slug]` page, OG image route, GitHub MDX with real marketing content.

### Changes Required

#### 1. Detail page — `apps/www/src/app/(app)/(marketing)/(content)/integrations/[slug]/page.tsx`

```tsx
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import {
  getIntegrationPage,
  getIntegrationPages,
} from "~/app/(app)/(content)/_lib/source";
import { getProviderIcon } from "~/lib/get-provider-icon";
import { emitIntegrationSeo } from "~/lib/seo-bundle";
import type { IntegrationUrl } from "~/lib/url-types";
import { IntegrationHero } from "../_components/integration-hero";
import { IntegrationDetailAnalytics } from "../_components/integration-detail-analytics";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getIntegrationPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getIntegrationPage([slug]);
  if (!page) return {};
  const url = `https://lightfast.ai/integrations/${slug}` as IntegrationUrl;
  const { metadata } = emitIntegrationSeo(page.data, url);
  return metadata;
}

export default async function IntegrationDetailPage({ params }: Props) {
  const { slug } = await params;
  const page = getIntegrationPage([slug]);
  if (!page) notFound();

  const url = `https://lightfast.ai/integrations/${slug}` as IntegrationUrl;
  const { jsonLd } = emitIntegrationSeo(page.data, url);
  const MDXContent = page.data.body;

  const { title, tagline, providerId, status: mdxStatus } = page.data;
  const derivedStatus: "live" | "beta" | "coming-soon" =
    mdxStatus ??
    (providerId && PROVIDER_DISPLAY[providerId].comingSoon
      ? "coming-soon"
      : "live");
  const Icon = providerId ? getProviderIcon(providerId) : undefined;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl pt-24 pb-32">
      <JsonLd code={jsonLd} />
      <IntegrationHero
        title={title}
        tagline={tagline}
        icon={Icon}
        status={derivedStatus}
      />
      <IntegrationDetailAnalytics providerId={providerId} slug={slug} />
      <div className="mt-8 max-w-none">
        <MDXContent components={mdxComponents} />
      </div>
    </div>
  );
}
```

#### 2. Detail analytics — `integrations/_components/integration-detail-analytics.tsx`

Tracks page view with `providerId` on mount (client component). Mirror the card-analytics pattern.

#### 3. OG image — `integrations/[slug]/opengraph-image.tsx`

```tsx
import { ContentLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { ImageResponse } from "next/og";
import { getIntegrationPage } from "~/app/(app)/(content)/_lib/source";
import { loadOGFonts } from "~/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "Lightfast Integration";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getIntegrationPage([slug]);
  const fonts = await loadOGFonts();

  if (!page) {
    return new ImageResponse(<div>Not Found</div>, { ...size });
  }

  const { title, tagline } = page.data;

  return new ImageResponse(
    <ContentLayout
      category="Integration"
      description={tagline}
      title={title}
    />,
    { ...size, fonts }
  );
}
```

#### 4. GitHub MDX — `apps/www/src/content/integrations/github.mdx`

```mdx
---
title: "GitHub"
description: "Connect GitHub to Lightfast. Ingest pull requests, issues, pushes, and CI status in real-time — query your repo activity with AI."
keywords:
  - github integration
  - lightfast github
  - pull request analytics
  - repo intelligence
  - engineering insights
canonicalUrl: "https://lightfast.ai/integrations/github"
ogTitle: "GitHub Integration – Lightfast"
ogDescription: "Connect GitHub to Lightfast. Ingest pull requests, issues, pushes, and CI status in real-time — query your repo activity with AI."
providerId: "github"
tagline: "Ingest every pull request, issue, push, and CI run from your repos. Query your codebase activity with AI."
category: "dev-tools"
featuredImage: "/images/github-banner.png"
docsUrl: "/docs/connectors/github"
updatedAt: "2026-04-14T00:00:00Z"
faq:
  - question: "What events does the GitHub integration capture?"
    answer: "Pull requests (open/merge/close/review), issues, pushes, workflow runs, deployments, and releases. Full event list in the connector docs."
  - question: "What permissions does Lightfast request?"
    answer: "Read-only access to repositories, issues, pull requests, and workflow runs. Lightfast never writes to your repos."
  - question: "How long does backfill take?"
    answer: "Historical events backfill in minutes for small repos, up to an hour for large orgs. Progress is visible in your workspace."
---

<IntegrationFeatureGrid>
  <IntegrationFeature title="Real-time events">
    Webhooks stream every PR, issue, push, and workflow run into Lightfast within seconds.
  </IntegrationFeature>
  <IntegrationFeature title="Read-only access">
    Lightfast requests the minimum scope needed — repository read, issues read, pull requests read. Never writes.
  </IntegrationFeature>
  <IntegrationFeature title="Historical backfill">
    Install once and Lightfast backfills your entire event history. Query activity from day one.
  </IntegrationFeature>
  <IntegrationFeature title="Entity graph">
    Pull requests, issues, authors, and reviewers become first-class entities in your engineering graph.
  </IntegrationFeature>
</IntegrationFeatureGrid>

## Why connect GitHub?

Your repos are the source of truth for what your team shipped, reviewed, and deployed. Connecting GitHub turns that activity into queryable knowledge — ask "what did Alex ship last sprint?" and Lightfast answers from real PR data.

## How it works

1. Click **Install GitHub** on the Lightfast integrations settings page.
2. Authorize the Lightfast GitHub App on the repos you want to connect.
3. Events start flowing immediately. Backfill runs in the background.
4. Query your engineering activity through chat or the API.

<NextLink href="/docs/connectors/github">Read the full GitHub connector docs →</NextLink>

## Frequently asked questions

<FAQAccordion>
  <FAQItem value="events" question="What events does the GitHub integration capture?">
    Pull requests (open/merge/close/review), issues, pushes, workflow runs, deployments, and releases. Full event list in the connector docs.
  </FAQItem>
  <FAQItem value="permissions" question="What permissions does Lightfast request?">
    Read-only access to repositories, issues, pull requests, and workflow runs. Lightfast never writes to your repos.
  </FAQItem>
  <FAQItem value="backfill" question="How long does backfill take?">
    Historical events backfill in minutes for small repos, up to an hour for large orgs. Progress is visible in your workspace.
  </FAQItem>
</FAQAccordion>
```

#### 5. not-found — `integrations/[slug]/not-found.tsx`

Standard 404 mirroring the changelog pattern if present, otherwise omit (Next.js defaults apply).

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck --filter=@repo/www` passes
- [x] `pnpm check --filter=@repo/www` passes
- [x] `pnpm build --filter=@repo/www` succeeds (generates static params for `github`)
- [x] Schema validation passes at build time on `github.mdx` frontmatter

#### Manual Verification

- [ ] `http://localhost:4101/integrations/github` renders hero, feature grid, content, FAQ
- [ ] View source shows JSON-LD with `WebPage`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList`
- [ ] `http://localhost:4101/integrations/github/opengraph-image` returns a 1200×630 PNG
- [ ] Metadata title is `GitHub – Lightfast Integrations`, canonical is `https://lightfast.ai/integrations/github`
- [ ] Cross-link to `/docs/connectors/github` works
- [ ] `http://localhost:4101/integrations/nonexistent` returns 404

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 6.

---

## Phase 6: Nav + Sitemap Wiring

### Overview

Surface `/integrations` in nav and sitemap. Add Vercel and Linear index cards (MDX stubs).

### Changes Required

#### 1. Nav — `apps/www/src/config/nav.ts`

```ts
export const INTERNAL_NAV = defineNavItems([
  { title: "Pricing", href: "/pricing" },
  { title: "Integrations", href: "/integrations" },
  { title: "Early Access", href: "/early-access", microfrontend: true },
  { title: "Docs", href: "/docs/get-started/overview" },
]);
```

Ordering: Pricing → Integrations → Early Access → Docs. Integrations sits between Pricing (the commercial lead) and Early Access (the conversion CTA) — product-capability visibility without disrupting the conversion path.

Compile-time `Route<H>` validation will require `/integrations` to resolve to a real route; Phase 4 already shipped the page so this should pass.

#### 2. Sitemap — `apps/www/src/app/sitemap.ts`

Add after the blog-related entries:

```ts
import {
  getBlogPages,
  getChangelogPages,
  getIntegrationPages,
  getLegalPages,
} from "~/app/(app)/(content)/_lib/source";

// ... inside default export ...

const integrationPages = getIntegrationPages();
const mostRecentIntegration = integrationPages
  .map((p) => p.data.updatedAt)
  .sort()
  .reverse()[0];

return [
  // ... existing entries ...

  // Integrations listing
  {
    url: `${base}/integrations`,
    ...(mostRecentIntegration && {
      lastModified: new Date(mostRecentIntegration),
    }),
    changeFrequency: "weekly",
    priority: 0.9,
  },
  // Individual integration pages
  ...integrationPages.map((page) => ({
    url: `${base}/integrations/${page.slugs[0]}`,
    lastModified: new Date(page.data.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  })),

  // ... rest ...
];
```

#### 3. Vercel & Linear stub MDX

Add `apps/www/src/content/integrations/vercel.mdx` and `linear.mdx` with lean frontmatter (title/tagline/providerId/etc.) but minimal body — enough for the index cards to render and the detail pages to not 404. Full marketing content lands in follow-up PRs.

Vercel:
```mdx
---
title: "Vercel"
description: "Connect Vercel to Lightfast. Track deployments, preview URLs, and production releases alongside your repo activity."
keywords: ["vercel integration", "lightfast vercel", "deployment tracking", "preview deployments", "release monitoring"]
canonicalUrl: "https://lightfast.ai/integrations/vercel"
ogTitle: "Vercel Integration – Lightfast"
ogDescription: "Connect Vercel to Lightfast. Track deployments, preview URLs, and production releases alongside your repo activity."
providerId: "vercel"
tagline: "Track every deployment, preview URL, and production release. See what shipped and when."
category: "dev-tools"
featuredImage: "/images/vercel-integration-placeholder.png"
docsUrl: "/docs/connectors/vercel"
updatedAt: "2026-04-14T00:00:00Z"
faq:
  - question: "What Vercel events does Lightfast capture?"
    answer: "Deployment created, building, ready, error, and canceled events — across preview and production environments."
---

More details coming soon. For setup instructions, see the [Vercel connector docs](/docs/connectors/vercel).
```

Linear:
```mdx
---
title: "Linear"
description: "Connect Linear to Lightfast. Ingest issues, cycles, and project state — correlate planning with shipped code."
keywords: ["linear integration", "lightfast linear", "issue tracking", "cycle analytics", "project intelligence"]
canonicalUrl: "https://lightfast.ai/integrations/linear"
ogTitle: "Linear Integration – Lightfast"
ogDescription: "Connect Linear to Lightfast. Ingest issues, cycles, and project state — correlate planning with shipped code."
providerId: "linear"
tagline: "Ingest issues, cycles, and project state. Correlate planning with shipped code."
category: "project-management"
docsUrl: "/docs/connectors/linear"
updatedAt: "2026-04-14T00:00:00Z"
faq:
  - question: "When will the Linear integration ship?"
    answer: "Linear is on our Q2 2026 roadmap. Join the waitlist to be notified when it's available."
---

Linear integration is coming soon. Join the waitlist to get notified.
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck --filter=@repo/www` passes (nav `Route<H>` validation)
- [x] `pnpm check --filter=@repo/www` passes
- [x] `pnpm build --filter=@repo/www` succeeds
- [ ] `curl http://localhost:4101/sitemap.xml | grep "integrations/"` returns 3 URLs (index + github + vercel + linear = 4)

#### Manual Verification

- [ ] Desktop navbar shows `Integrations` between `Pricing` and `Early Access`
- [ ] Mobile sheet nav shows `Integrations`
- [ ] Pitch-deck navbar does NOT need changes (uses `PITCH_DECK_NAV`, not `INTERNAL_NAV`)
- [ ] `/integrations` index renders 3 cards — GitHub (live), Vercel (live — check `PROVIDER_DISPLAY.vercel.comingSoon` is falsy), Linear (coming-soon badge)
- [ ] Clicking each card navigates to `/integrations/<slug>`
- [ ] PostHog event `integration_card_clicked` fires with correct `providerId` on each click
- [ ] Sitemap.xml includes `/integrations` and all three detail URLs

---

## Testing Strategy

### Unit Tests

No new unit tests. Schema validation happens at build time via fumadocs-mdx against Zod; type-level guarantees cover the rest. Matches changelog/blog pattern — no existing unit tests for those pipelines either.

### Integration Tests

None today. End-to-end verification is manual through the dev server plus the `pnpm build` static export, which surfaces any route-resolution or schema-validation failures.

### Manual Testing Steps

1. `pnpm dev:www` → open `/integrations` → verify 3 cards render with correct status badges.
2. Click GitHub card → verify `/integrations/github` renders hero, feature grid, MDX body, FAQ accordion, docs cross-link.
3. Click Vercel card → verify lean detail page renders with "More details coming soon" placeholder.
4. Click Linear card → verify coming-soon badge on both index card and detail hero.
5. View page source on `/integrations/github` → verify JSON-LD includes `Organization`, `WebSite`, `WebPage`, `SoftwareApplication` with `@id: #integrated-app`, `FAQPage`, `BreadcrumbList`.
6. Open `/integrations/github/opengraph-image` in a new tab → verify 1200×630 PNG renders with "Integration" category, GitHub title, tagline.
7. Open `/sitemap.xml` → verify 4 integration URLs present.
8. Resize browser to 375px, 768px, 1200px → verify responsive layout on both index and detail.
9. Verify PostHog panel shows `integration_card_clicked` events after clicking cards (if PostHog is wired — otherwise a known gap documented).
10. Verify desktop and mobile nav both show `Integrations` top-level entry.
11. `pnpm build --filter=@repo/www` → verify static generation succeeds and emits `/integrations/*.html` files.

## Performance Considerations

- All pages use `dynamic = "force-static"` — no runtime cost beyond static asset serving.
- OG images generated at build time via `next/og` `ImageResponse` — fonts loaded from `~/lib/og-fonts`, matching the existing cached pattern.
- MDX compiled at build time by fumadocs-mdx — zero runtime compilation cost.
- PostHog events are client-side only; no server impact.

## Migration Notes

No data migration. Purely additive — new routes, new collection, new nav entry. No existing URL or behavior changes.

## Follow-up Work (explicitly out of scope)

- Vercel full marketing MDX body (screenshots, feature narrative).
- Linear full marketing MDX body (post-GA or in beta).
- Sentry, Apollo integration pages.
- Additional integration cards from the 14-logo icon set (Slack, Notion, PostHog, Datadog, etc.) — requires backend work before marketing surface.
- Remotion programmatic featured-image generator per integration.
- Per-integration waitlist forms with Resend or similar.
- Fumadocs search integration for integrations collection.
- Index filtering by category.
- Animated hero backgrounds or interactive demos per integration.

## References

- Research doc: `thoughts/shared/research/2026-04-14-marketing-integrations-page.md`
- AEO guidance: `thoughts/shared/research/2026-04-10-changelog-aeo-best-practices.md`
- Changelog pipeline (template): `apps/www/src/app/(app)/(marketing)/(content)/changelog/`
- Schema source: `apps/www/src/lib/content-schemas.ts:21-38`
- Loader pattern: `apps/www/src/app/(app)/(content)/_lib/source.ts:97-105`
- SEO bundle: `apps/www/src/lib/seo-bundle.ts:112-126`
- Nav config: `apps/www/src/config/nav.ts:10-14`
- Sitemap: `apps/www/src/app/sitemap.ts`
- Provider display: `packages/app-providers/src/client/display.ts:15-90`
- OG layout: `packages/og/src/layouts/content.tsx`

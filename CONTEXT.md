# Context

## Domain Terms

### Static Publishing Module

The `apps/www/src/lib` module that turns static MDX content and frontmatter into public website facts.

It owns content lookup, static slugs, public URLs, canonical URLs, publishability, publication dates, sorting, and content-backed SEO for static pages.

It does not own page rendering, sitemap formatting, `llms.txt` formatting, root layout metadata, robots policy, app manifest, analytics, theme providers, actions, or retired route behavior.

### Static Publication

A public website page derived from static content and prepared by the static publishing module.

Home, brand, blog posts, and legal pages are all first-class static publications. They should not be treated as route-local exceptions when deriving public URLs, canonical URLs, metadata, JSON-LD, sitemap entries, or `llms.txt` entries.

Use `publication` as the domain word in static publishing code. Avoid `page` for this concept because it collides with Next.js route pages, Fumadocs pages, MDX pages, and browser pages.

### Static Collection Publication

A public website page derived from a static content collection rather than a single MDX file.

The blog index is a static collection publication. It owns public facts such as the blog URL, metadata, content-backed SEO, and post ordering, even though its rendered page lists many blog posts.

### Site Identity Module

The `apps/www/src/lib/site/identity.ts` module that owns public website identity facts for Lightfast.

It owns the canonical site origin, site name, public social and authority links, public contact facts, default image and icon facts, Organization and WebSite JSON-LD roots, root metadata facts, and app manifest identity facts.

It does not own content-backed publication facts, page rendering, sitemap formatting, `llms.txt` formatting, robots environment rules, analytics, microfrontend URL routing, or retired route behavior.

### Site Discovery Policy Module

The `apps/www/src/lib/site/discovery.ts` module that turns static publications and site identity facts into shared discovery policy.

It owns publication discovery sections, optionality, sitemap priority and change-frequency policy, external authority entries, and shared `llms.txt` contact lines.

It does not own static publication lookup, content-backed metadata, JSON-LD graph construction, sitemap formatting, `llms.txt` formatting, robots environment rules, page rendering, or retired route behavior.

## Static Publishing Decisions

### Publication Outputs Are Plain Data

Static publications should expose route-ready plain data.

Metadata and JSON-LD are computed by the static publishing module as part of each publication output, not assembled by route modules from raw frontmatter.

### Discovery Formats Consume Publications

Sitemap and `llms.txt` are discovery formats over static publications, not core responsibilities of the static publishing module.

The static publishing module exposes publication facts and public publication lists. Route modules format those facts into sitemap entries, `llms.txt` entries, or other discovery outputs.

### External Static Publishing Seam

The static publishing module should expose a small publication-first interface:

- `getAllPublications()`
- `getPublicPublications()`
- `getHomePublication()`
- `getBrandPublication()`
- `getBlogIndexPublication()`
- `getBlogPostPublication(slug)`
- `getLegalPublication(slug)`
- `getBlogPostStaticParams()`
- `getLegalStaticParams()`

### Publishability Means Discoverability

`getAllPublications()` includes every valid static publication, including `noindex` publications.

`getPublicPublications()` excludes `noindex` publications for discovery formats.

Direct publication lookups return valid publications even when they are `noindex`; route modules may render them while metadata emits the correct robots policy.

### Publication Types Are Discriminated

Static publication outputs should form a discriminated union keyed by `kind`.

Supported kinds are `home`, `brand`, `blog-index`, `blog-post`, and `legal`.

Shared publication fields include `kind`, `url`, `canonicalUrl`, `metadata`, `jsonLd`, `lastModified`, and `isPublic`.

Rendering fields are explicit per kind. Single-content publications expose body content. Blog posts expose blog-specific rendering facts such as `featuredImage`, `tldr`, and `answerSummary`. The blog index exposes ordered post summaries.

### Raw Frontmatter Does Not Cross The External Seam

Route modules should not receive raw content frontmatter from the static publishing module.

Publication outputs expose deliberately named rendering and publishing facts, such as `title`, `description`, `body`, `url`, `canonicalUrl`, `metadata`, `jsonLd`, `lastModified`, `featuredImage`, `tldr`, `answerSummary`, and ordered post summaries.

### Slug Arrays Are Internal Adapter Detail

External static publishing functions should accept single slug strings for blog posts and legal pages.

Fumadocs slug arrays stay behind the static publishing module seam.

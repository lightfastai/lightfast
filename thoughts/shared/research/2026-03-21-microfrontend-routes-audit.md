---
date: 2026-03-21T00:00:00+00:00
researcher: claude
git_commit: f2431a860f05bf086cfa08fe3971f2133ed30d79
branch: feat/platform-gate-first-health-hardening
repository: lightfast
topic: "Microfrontend links audit — apps/www vs microfrontends.json"
tags: [research, codebase, microfrontends, www, routing, apps-app, apps-www]
status: complete
last_updated: 2026-03-21
---

# Research: Microfrontend Links Audit — `apps/www` vs `microfrontends.json`

**Date**: 2026-03-21
**Git Commit**: `f2431a860f05bf086cfa08fe3971f2133ed30d79`
**Branch**: `feat/platform-gate-first-health-hardening`

## Research Question

Find all microfrontend links in `apps/www` and cross-reference against `apps/app/microfrontends.json`. There have been considerable changes to microfrontends and the links need to be audited.

## Summary

`apps/app/microfrontends.json` is the canonical mesh configuration. It defines two zones: `lightfast-app` (catch-all, port 4107) and `lightfast-www` (marketing+docs, port 4101). The www zone lists 35 path patterns.

The audit found **6 paths in `microfrontends.json` with no corresponding route in either app**, **2 opengraph-image paths with no files**, and **1 base path (`/use-cases`) with no index page**. Additionally, `apps/www` has routes for `/blog/topic/[category]` not explicitly listed in `microfrontends.json` (covered by the `/blog/:path*` catch-all).

---

## Detailed Findings

### 1. `microfrontends.json` — Current lightfast-www paths

File: `apps/app/microfrontends.json`

```json
"routing": [
  {
    "group": "marketing",
    "paths": [
      "/",
      "/opengraph-image-:hash",
      "/api/og/search-demo",
      "/pricing",
      "/pricing/opengraph-image-:hash",
      "/changelog",
      "/changelog/:path*",
      "/blog",
      "/blog/:path*",
      "/use-cases",
      "/use-cases/:path",
      "/use-cases/:path/opengraph-image-:hash",
      "/legal/:path*",
      "/search",
      "/preview",
      "/pitch-deck",
      "/unicorn-test",
      "/api/health",
      "/images/:path*",
      "/fonts/:path*",
      "/favicon.ico",
      "/android-chrome-192x192.png",
      "/android-chrome-512x512.png",
      "/apple-touch-icon.png",
      "/favicon-16x16.png",
      "/favicon-32x32.png",
      "/docs",
      "/docs/:path*",
      "/api/search",
      "/sitemap.xml",
      "/robots.txt",
      "/manifest.json",
      "/llms.txt",
      "/llms-full.txt"
    ]
  }
]
```

---

### 2. Actual `apps/www` Route Files

All page routes (`page.tsx`) and API routes (`route.ts`) currently in `apps/www/src/app`:

#### Marketing pages
| URL | File |
|-----|------|
| `/` | `(app)/(marketing)/(landing)/page.tsx` |
| `/pricing` | `(app)/(marketing)/(content)/pricing/page.tsx` |
| `/blog` | `(app)/(marketing)/(content)/blog/(listing)/page.tsx` |
| `/blog/topic/[category]` | `(app)/(marketing)/(content)/blog/(listing)/topic/[category]/page.tsx` |
| `/blog/[slug]` | `(app)/(marketing)/(content)/blog/[slug]/page.tsx` |
| `/changelog` | `(app)/(marketing)/(content)/changelog/page.tsx` |
| `/changelog/[slug]` | `(app)/(marketing)/(content)/changelog/[slug]/page.tsx` |
| `/use-cases/agent-builders` | `(app)/(marketing)/(content)/use-cases/agent-builders/page.tsx` |
| `/use-cases/engineering-leaders` | `(app)/(marketing)/(content)/use-cases/engineering-leaders/page.tsx` |
| `/use-cases/platform-engineers` | `(app)/(marketing)/(content)/use-cases/platform-engineers/page.tsx` |
| `/use-cases/technical-founders` | `(app)/(marketing)/(content)/use-cases/technical-founders/page.tsx` |
| `/legal/[slug]` | `(app)/(marketing)/legal/[slug]/page.tsx` |
| `/search` | `(app)/(search)/search/page.tsx` |
| `/pitch-deck` | `(app)/(internal)/pitch-deck/page.tsx` |

#### Docs pages
| URL | File |
|-----|------|
| `/docs` + `/docs/[[...slug]]` | `(docs)/docs/(general)/[[...slug]]/page.tsx` |
| `/docs/api-reference` + `/docs/api-reference/[[...slug]]` | `(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx` |

#### API routes
| URL | File |
|-----|------|
| `/api/search` | `(docs)/api/search/route.ts` |
| `/api/health` | `(health)/api/health/route.ts` |

#### SEO / feed routes
| URL | File |
|-----|------|
| `/llms.txt` | `(seo)/llms.txt/route.ts` |
| `/blog/atom.xml` | `(app)/(marketing)/(content)/blog/atom.xml/route.ts` |
| `/blog/feed.xml` | `(app)/(marketing)/(content)/blog/feed.xml/route.ts` |
| `/blog/rss.xml` | `(app)/(marketing)/(content)/blog/rss.xml/route.ts` |
| `/changelog/atom.xml` | `(app)/(marketing)/(content)/changelog/atom.xml/route.ts` |
| `/changelog/feed.xml` | `(app)/(marketing)/(content)/changelog/feed.xml/route.ts` |
| `/changelog/rss.xml` | `(app)/(marketing)/(content)/changelog/rss.xml/route.ts` |

#### Next.js special files (auto-generate routes)
| URL | File |
|-----|------|
| `/sitemap.xml` | `src/app/sitemap.ts` |
| `/robots.txt` | `src/app/robots.ts` |
| `/manifest.json` | `src/app/manifest.ts` |
| `/opengraph-image-:hash` | `(app)/(marketing)/(landing)/opengraph-image.tsx` |
| `/blog/[slug]/opengraph-image-:hash` | `(app)/(marketing)/(content)/blog/[slug]/opengraph-image.tsx` |
| `/changelog/[slug]/opengraph-image-:hash` | `(app)/(marketing)/(content)/changelog/[slug]/opengraph-image.tsx` |

#### Static assets (from `apps/www/public/`)
- `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`
- `android-chrome-192x192.png`, `android-chrome-512x512.png`, `apple-touch-icon.png`
- `images/` — 14 image files
- `fonts/` — 4 font families

---

### 3. Paths in `microfrontends.json` With No Corresponding Route

| Path | Status |
|------|--------|
| `/preview` | No `page.tsx` or `route.ts` in `apps/www` or `apps/app` |
| `/unicorn-test` | No `page.tsx` or `route.ts` in `apps/www` or `apps/app` |
| `/llms-full.txt` | No route anywhere; only `/llms.txt` exists (`(seo)/llms.txt/route.ts`) |
| `/api/og/search-demo` | No API route in `apps/www` or `apps/app` |
| `/pricing/opengraph-image-:hash` | No `opengraph-image.tsx` under `pricing/` |
| `/use-cases/:path/opengraph-image-:hash` | No `opengraph-image.tsx` under any use-case directory |

---

### 4. Paths in `apps/www` Not Explicitly in `microfrontends.json`

| Path | Coverage |
|------|----------|
| `/blog/topic/[category]` | Covered by `/blog/:path*` catch-all |
| `/docs/api-reference/[[...slug]]` | Covered by `/docs/:path*` catch-all |
| `/blog/atom.xml`, `/blog/feed.xml`, `/blog/rss.xml` | Covered by `/blog/:path*` |
| `/changelog/atom.xml`, `/changelog/feed.xml`, `/changelog/rss.xml` | Covered by `/changelog/:path*` |

All of these are implicitly covered by existing catch-all patterns.

---

### 5. `/use-cases` Index Page

`microfrontends.json` lists `/use-cases` (no subpath). However, `apps/www` has **no `/use-cases/page.tsx`** — only four hardcoded sub-directory pages:
- `/use-cases/agent-builders/page.tsx`
- `/use-cases/engineering-leaders/page.tsx`
- `/use-cases/platform-engineers/page.tsx`
- `/use-cases/technical-founders/page.tsx`

The path `/use-cases` itself (no trailing segment) has no handler.

---

### 6. Cross-Zone Links in `apps/www` (routes served by `apps/app`)

These are internal links in `apps/www` that point to `lightfast-app` zone routes. They use `MicrofrontendLink` from `@vercel/microfrontends/next/client` or `withRelatedProject` for URL construction:

| Path | Where used | Mechanism |
|------|-----------|-----------|
| `/early-access` | `app-navbar.tsx`, `app-mobile-nav.tsx`, `waitlist-cta.tsx`, `faq-section.tsx`, use-case pages | `MicrofrontendLink` |
| `/sign-in` | `app-navbar-menu.tsx`, `app-mobile-nav.tsx`, `search-navbar.tsx` | `MicrofrontendLink` |
| Console-relative paths (`/sign-in`, `/dashboard`, etc.) | `(docs)/_lib/mdx-components.tsx:544-573` `AuthLink` MDX component | `consoleUrl` from `@vercel/related-projects` |

The `consoleUrl` resolves to `http://localhost:4107` in dev and `https://app.lightfast.ai` in prod/preview, via `apps/www/src/lib/related-projects.ts`.

---

### 7. Navigation Link Inventory (`apps/www/src/config/nav.ts`)

**`INTERNAL_NAV`** (site header):
| Title | href | `microfrontend` flag |
|-------|------|---------------------|
| Pricing | `/pricing` | — |
| Early Access | `/early-access` | `true` |
| Docs | `/docs/get-started/overview` | `true` |

**`RESOURCES_NAV`** (header dropdown):
| Title | href |
|-------|------|
| Changelog | `/changelog` |
| Blog | `/blog` |

**Footer product column**: `/`, `/pricing`, `/blog`, `/changelog`
**Footer resources column**: `/docs/get-started/overview`, `/early-access`, `/docs/api-reference/getting-started/overview`

---

### 8. Hardcoded Deep Doc Links

These specific doc paths are hardcoded across multiple components in `apps/www` (not from a docs content source-of-truth):

| Path | Locations |
|------|-----------|
| `/docs/get-started/overview` | `config/nav.ts`, `app-footer.tsx`, `pitch-deck-mobile-nav.tsx`, use-case pages (×4), doc layouts (×2) |
| `/docs/api-reference/getting-started/overview` | `app-footer.tsx`, doc layouts (×2) |
| `/docs/get-started/quickstart` | `developer-platform-landing.tsx:157` |
| `/docs/integrate/sdk` | `developer-platform-landing.tsx:70` |
| `/docs/integrate/mcp` | `developer-platform-landing.tsx:76` |
| `/docs/connectors/github` | `developer-platform-landing.tsx:82` |
| `/docs/guides/agents` | `next-steps.tsx:40` |
| `/docs/guides/slash-commands` | `next-steps.tsx:46` |
| `/docs/guides/mcp` | `next-steps.tsx:52` |
| `/docs/guides/ci` | `next-steps.tsx:58` |

---

## Architecture Documentation

### Microfrontend mesh configuration

The mesh is orchestrated by `apps/app`. The `VC_MICROFRONTENDS_CONFIG` env var in `apps/www/package.json:16` points to `../../apps/app/microfrontends.json`. The `apps/www/next.config.ts:128` wraps the config with `withMicrofrontends(config, { debug: true })`.

### Cross-zone link rendering pattern

`apps/www/src/types/nav.ts` extends `NavItem` with `microfrontend?: boolean`. When `true`, nav rendering components swap `next/link` for `@vercel/microfrontends/next/client`'s `Link`. This pattern is used in `app-navbar-menu.tsx`, `app-mobile-nav.tsx`.

### Console URL resolution

`apps/www/src/lib/related-projects.ts` exports `consoleUrl` via `@vercel/related-projects`'s `withRelatedProject({ projectName: "lightfast-app" })`. Dev default: `http://localhost:4107`. Prod/preview default: `https://app.lightfast.ai`.

### No rewrites in next.config.ts

`apps/www/next.config.ts` defines redirects only (all within `/docs`), no rewrites. Cross-zone routing is entirely handled by `@vercel/microfrontends` via the mesh config.

---

## Code References

- `apps/app/microfrontends.json:1-59` — Canonical mesh config
- `apps/www/src/config/nav.ts:10-45` — Header and resources nav definitions
- `apps/www/src/app/(app)/_components/app-footer.tsx:14-134` — Footer links
- `apps/www/src/app/(app)/_components/app-navbar-menu.tsx:38-46` — Conditional MicrofrontendLink vs NextLink
- `apps/www/src/lib/related-projects.ts:1-14` — `consoleUrl` via `withRelatedProject`
- `apps/www/src/types/nav.ts:4-7` — `microfrontend?: boolean` NavItem extension
- `apps/www/src/components/stable-prefetch-provider.tsx:1-41` — Cross-zone prefetch wrapper
- `apps/www/src/app/layout.tsx:149-154` — Root layout mounts prefetch provider
- `apps/www/next.config.ts:30-73` — Docs redirects; line 128 — `withMicrofrontends` wrapper
- `apps/www/package.json:16` — `VC_MICROFRONTENDS_CONFIG` env var
- `apps/www/src/app/(docs)/_lib/mdx-components.tsx:544-573` — `AuthLink` MDX component
- `apps/www/src/app/(app)/(marketing)/(content)/use-cases/` — 4 pages, no index
- `apps/www/src/app/(docs)/docs/(general)/developer-platform-landing.tsx:24-83` — Hardcoded doc links

## Open Questions

- `/preview` and `/unicorn-test`: were these removed from `apps/www` or are they expected to exist?
- `/llms-full.txt`: intentionally omitted from www (route to be added) or should be removed from `microfrontends.json`?
- `/api/og/search-demo`: was this API route deleted from www?
- `/pricing/opengraph-image-:hash` and `/use-cases/:path/opengraph-image-:hash`: were these OG image files removed from www, or are they planned but not yet implemented?
- `/use-cases` (no subpath): does this intentionally 404, or should there be an index/redirect?

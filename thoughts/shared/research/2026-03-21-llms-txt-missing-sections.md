---
date: 2026-03-21T00:00:00+00:00
researcher: claude
git_commit: f2431a860f05bf086cfa08fe3971f2133ed30d79
branch: feat/platform-gate-first-health-hardening
repository: lightfast
topic: "Why llms.txt only generates Marketing/Blog/Changelog/Legal sections in prod"
tags: [research, codebase, aeo, llms-txt, vendor-aeo, vendor-cms, basehub, static-discovery]
status: complete
last_updated: 2026-03-21
---

# Research: Why `llms.txt` Only Generates Partial Output in Production

**Date**: 2026-03-21
**Git Commit**: `f2431a860f05bf086cfa08fe3971f2133ed30d79`
**Branch**: `feat/platform-gate-first-health-hardening`

## Research Question

Why does `apps/www/src/app/(seo)/llms.txt/route.ts` only generate Marketing, Blog (listing only), Changelog, and Legal sections in production — missing Use Cases, Docs, API Reference, and individual blog post entries?

## Summary

There are **two independent root causes**, each responsible for a different class of missing entries:

1. **Static page discovery always returns `[]` on Vercel** — the `@vendor/aeo` handler's `collectStaticPages` function walks `.next/server/app` at the time the route is pre-rendered (build time), but the use-cases, docs, and API-reference HTML files either haven't been written yet (build-time ordering) or are unavailable in the pre-rendering sandbox.
2. **`blog.getPosts()` returns `[]`** — BaseHub has no published blog posts, or the posts were added after the last deploy (and `revalidate = false` means the route never auto-revalidates).

Everything that **does** appear in the output comes exclusively from the explicit provider functions in the `providers` array via CMS API calls.

## Detailed Findings

### How `createLlmsTxtHandler` Works (`vendor/aeo/handlers.ts:14`)

The handler collects pages from two parallel sources:

1. **Static discovery** (`vendor/aeo/collect.ts:82`) — walks `join(process.cwd(), ".next", "server", "app")` recursively for `.html` files, parses `<title>`, `<meta name="description">`, and `<link rel="canonical">` from each via regex. A page is dropped if `canonical` or `title` is absent. No section is assigned (section comes later from `sectionResolver`).

2. **Dynamic providers** (`vendor/aeo/collect.ts:129`) — calls each function in the `providers` array concurrently. Each provider can include an explicit `section` field. Errors are silently swallowed (`.catch(() => [])`).

Results are merged into a URL-keyed `Map` — providers win on URL collision (`collect.ts:151-157`).

The `sectionResolver` in `route.ts:105-119` applies **only** to static-discovery pages (provider pages already have `section` set). It maps:
- `/use-cases/` → `"Use Cases"`
- `/docs/api-reference` → `"API Reference"`
- `/docs` → `"Docs"`
- everything else → `defaultSection: "Marketing"`

Sections listed in `sectionOrder` but with 0 entries are silently omitted from output (`vendor/aeo/format.ts:63-65`).

---

### Root Cause 1: Static Discovery Returns `[]` in Production

`collectStaticPages` checks `existsSync(buildOutputDir)` at `collect.ts:68`. If the directory doesn't exist, the function returns immediately with no pages.

The route is exported with `export const revalidate = false` (`route.ts:4`), which in Next.js App Router **pre-renders the route handler at build time** — the `GET` function runs during `next build`. At that moment, `process.cwd()` resolves to the www app directory, so the build output path is `apps/www/.next/server/app`.

The problem: **other pages' HTML files may not have been written to this directory yet** when `llms.txt` is pre-rendered. Next.js static generation runs routes in parallel; `llms.txt` may execute before `use-cases/agent-builders`, `docs/**`, etc. have been persisted to disk.

The effect: `walkBuildOutput` yields no `.html` files → `collectStaticPages` returns `[]` → all sections that rely on static discovery (Use Cases, Docs, API Reference, Pricing) get 0 entries → those headings are suppressed.

Evidence: **not a single statically-discovered page appears in the production output** — the pricing page at `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx` also has a canonical tag but also doesn't appear.

---

### Root Cause 2: No Individual Blog Posts

`blog.getPosts()` (`vendor/cms/index.ts:144-151`) calls BaseHub with `blog.postsQuery` — which fetches all `blog.post.items` with **no ordering or filtering `__args`**. The query selects `_slug`, `_title`, `slug`, `description`, etc.

The route (`route.ts:33-44`) iterates posts with:
```ts
const slug = post.slug ?? post._slug;
if (!slug) continue;
```
Since `_slug` is always set by BaseHub, this guard never filters valid posts. If `blog.getPosts()` returns posts, they would appear.

The call wraps everything in `try { ... } catch { return []; }` with no logging (`index.ts:145-151`). Possible silent failure modes:
- `BASEHUB_TOKEN` env var missing or invalid (would also break changelog, so this is ruled out since changelog works)
- BaseHub returns `data.blog.post.items = []` — meaning **no published posts exist in the CMS**
- Posts were added to BaseHub after the last deployment; since `revalidate = false` = never revalidates, a redeploy is required to pick them up

Since changelog **does** work (3 entries fetched successfully), the BaseHub token and network are fine. The most likely explanation is **no blog posts exist in BaseHub** at the time of the last production build.

---

### What Currently Works and Why

| Output Section | Source | Why It Works |
|---|---|---|
| Marketing (home) | Explicit provider, `route.ts:10-19` | Hard-coded entry, no CMS call |
| Blog (listing only) | Explicit provider, `route.ts:22-46` | Hard-coded listing entry; individual posts from `blog.getPosts()` which returns `[]` |
| Changelog (listing + 3 entries) | Explicit provider, `route.ts:49-72` | `changelog.getEntries()` returns 3 entries from BaseHub |
| Optional (legal) | Explicit provider, `route.ts:75-87` | `legal.getPosts()` returns 2 entries from BaseHub; `optional: true` puts them in "Optional" bucket |

---

## Code References

- `apps/www/src/app/(seo)/llms.txt/route.ts:4` — `export const revalidate = false` (build-time pre-render)
- `apps/www/src/app/(seo)/llms.txt/route.ts:89-140` — `createLlmsTxtHandler` call with providers, sectionResolver, skipUrl
- `vendor/aeo/handlers.ts:14` — `createLlmsTxtHandler` function definition
- `vendor/aeo/collect.ts:67-79` — `walkBuildOutput` generator (returns immediately if dir missing)
- `vendor/aeo/collect.ts:82-126` — `collectStaticPages` — walks `.next/server/app`, parses HTML
- `vendor/aeo/collect.ts:129-134` — `collectDynamicPages` — calls provider functions, swallows errors
- `vendor/aeo/collect.ts:141-160` — `collectAllPages` — merges static + dynamic, providers win on URL collision
- `vendor/aeo/format.ts:20-27` — `sectionResolver` applied only to static-discovery pages
- `vendor/aeo/format.ts:63-65` — empty section suppression (silent `continue`)
- `vendor/cms/index.ts:10` — `basehub` singleton client creation
- `vendor/cms/index.ts:144-151` — `blog.getPosts()` — try/catch, returns `[]` on any error
- `vendor/cms/index.ts:405-412` — `changelog.getEntries()` — try/catch, returns `[]` on any error

## Architecture Documentation

The `@vendor/aeo` package is designed for a single-app Next.js deployment where the build output directory is at `process.cwd()/.next/server/app`. In a monorepo where multiple apps build independently, this assumption holds — the www app's `cwd` is `apps/www/` during its build. The timing dependency (static discovery needing other pages already rendered) is an inherent design constraint.

The `@vendor/cms` package (`vendor/cms/index.ts`) uses a module-level `basehub` singleton and silently returns empty arrays for all API errors. This means build-time CMS failures produce no observable signal in the output.

## Open Questions

1. **Is there a way to verify build-time ordering?** — Running `next build` locally and checking the timestamp order of files in `.next/server/app` would confirm whether use-cases HTML files exist before or after the llms.txt route is pre-rendered.
2. **Are there currently any blog posts in BaseHub?** — The simplest check is to open the BaseHub dashboard and look at `blog.post.items`.
3. **Should static discovery be deferred?** — If `revalidate = false` is removed (making the route an on-demand serverless function), `collectStaticPages` would run after the build completes, when `.next/server/app` has all HTML files written. However, this would change caching behavior.

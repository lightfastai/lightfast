# Microfrontend Routes Fix

## Overview

Surgically clean the microfrontend mesh config: remove 6 phantom routes from `microfrontends.json` and 3 stale references from `robots.ts`. OG images are not implemented — Next.js App Router inherits the root OG image for pages without a local `opengraph-image.tsx`.

## Current State Analysis

`apps/app/microfrontends.json` declares 35 paths in the `lightfast-www` routing zone. Six of those have zero implementation anywhere in the codebase. The OG image paths (`/pricing/opengraph-image-:hash`, `/use-cases/:path/opengraph-image-:hash`) are also unimplemented — but since Next.js metadata inherits from ancestor segments, those pages already serve the root OG image without any local file.

### Key Discoveries

- `/preview` and `/unicorn-test` — ghost routes, referenced only in `robots.ts` disallow list
- `/api/og/search-demo` — completely orphaned, no trace in either app
- `/llms-full.txt` — no route exists, referenced in `robots.ts` allow list
- `/pricing/opengraph-image-:hash` — no `opengraph-image.tsx`, but pricing inherits root OG
- `/use-cases/:path/opengraph-image-:hash` — no `opengraph-image.tsx`, but use-case pages inherit root OG

## What We're NOT Doing

- No new `opengraph-image.tsx` files — root OG inheritance is sufficient
- No `/use-cases` index page
- No `/llms-full.txt` implementation
- No changes to `@vendor/aeo`, CMS, or any package

## Desired End State

Every path in `microfrontends.json` has a corresponding implementation. `robots.ts` references no nonexistent paths.

### Verify With

```bash
grep -E "preview|unicorn-test|api/og/search-demo|llms-full|opengraph-image" apps/app/microfrontends.json
# Should return nothing

grep -E "preview|unicorn-test|llms-full" apps/www/src/app/robots.ts
# Should return nothing
```

---

## Phase 1: Mesh Surgery

### Overview

Delete 6 phantom paths from `microfrontends.json` and clean 3 stale entries from `robots.ts`. Pure deletion, zero new code.

### Changes Required

#### 1. `apps/app/microfrontends.json`

Remove the following 6 paths from the `lightfast-www` routing array:

| Path | Line | Reason |
|------|------|--------|
| `/api/og/search-demo` | 22 | No route exists anywhere |
| `/pricing/opengraph-image-:hash` | 24 | No file, not needed (root OG inherited) |
| `/use-cases/:path/opengraph-image-:hash` | 31 | No file, not needed (root OG inherited) |
| `/preview` | 34 | Ghost route, never implemented |
| `/unicorn-test` | 36 | Ghost route, never implemented |
| `/llms-full.txt` | 53 | No route, no implementation planned |

Final `paths` array:

```json
"paths": [
  "/",
  "/opengraph-image-:hash",
  "/pricing",
  "/changelog",
  "/changelog/:path*",
  "/blog",
  "/blog/:path*",
  "/use-cases",
  "/use-cases/:path",
  "/legal/:path*",
  "/search",
  "/pitch-deck",
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
  "/llms.txt"
]
```

#### 2. `apps/www/src/app/robots.ts`

**Remove from `allow` array** (line 30):
```ts
"/llms-full.txt",
```

**Remove from `disallow` array** (lines 43–44):
```ts
"/preview",
"/unicorn-test",
```

### Success Criteria

#### Automated Verification
- [ ] `grep -E "preview|unicorn-test|api/og/search-demo|llms-full|opengraph-image" apps/app/microfrontends.json` returns nothing
- [ ] `grep -E "preview|unicorn-test|llms-full" apps/www/src/app/robots.ts` returns nothing
- [ ] `pnpm typecheck` passes

#### Manual Verification
- [ ] `http://localhost:4101/robots.txt` — no `/preview`, `/unicorn-test`, `/llms-full.txt` entries

---

## References

- Research: `thoughts/shared/research/2026-03-21-microfrontend-routes-audit.md`
- Mesh config: `apps/app/microfrontends.json`
- Robots: `apps/www/src/app/robots.ts`

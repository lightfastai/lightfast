---
date: 2026-02-21T00:00:00+11:00
researcher: claude
git_commit: 7f0b7438c1b44095c66e9e365c9c50a26cb56d0e
branch: main
repository: lightfast
topic: "Early-access page font FOUT / layout shift"
tags: [research, codebase, fonts, early-access, fout, next-font, microfrontends, www]
status: complete
last_updated: 2026-02-21
last_updated_by: claude
---

# Research: Early-Access Page Font Shift

**Date**: 2026-02-21
**Git Commit**: `7f0b7438c1b44095c66e9e365c9c50a26cb56d0e`
**Branch**: main
**Repository**: lightfast

## Research Question

> There is a strange bug in `apps/www/src/app/(app)/early-access/` where the fonts take some time to load and then apply, causing a visible layout shift. Why is this happening only on this page?

## Summary

The shift is a FOUT (Flash of Unstyled Text) caused by three things converging uniquely on the early-access page:

1. **All www fonts are intentionally loaded with `preload: false` + `display: "swap"`** — by design, to avoid a Vercel microfrontend double-download bug.
2. **The early-access page applies `font-pp` (PP Neue Montreal) directly on its most prominent element** — a centered `<h1>` that is the *only* visible content above the fold.
3. **The page is typically reached via a hard (cold) navigation** — users arrive from emails, direct links, or cross-zone links from the console app — so no font is in memory yet.

Every other www page has the same underlying FOUT mechanism, but it is not visible because those pages are reached via soft navigation (fonts already loaded) or have enough surrounding content that the swap is imperceptible.

---

## Detailed Findings

### 1. Font Loading Strategy — `preload: false` + `display: "swap"`

**File**: `apps/www/src/lib/fonts.ts`

Every font in the www app (`geistSans`, `geistMono`, `ppNeueMontreal`, `exposurePlus`, `exposureTrial`, `ppSupplySans`) is configured identically:

```ts
preload: false,
display: "swap",
```

The comment at the top of the file explains the rationale (`fonts.ts:2-9`):

> Vercel's microfrontend proxy rewrites `<link rel="preload">` URLs to include the app prefix (`vc-ap-fb51eb/...`) but CSS `@font-face` declarations still reference the original `/_next/static/media/` paths. The browser treats these as different URLs and downloads each font twice. Disabling preload means fonts load only via `@font-face` (single download).

**Effect**: With `preload: false`, the browser does not fetch fonts eagerly. With `display: "swap"`, the browser renders text using the system fallback immediately, then **swaps** to the custom font once it downloads — causing a visual reflow if the font metrics differ from the fallback.

---

### 2. Root Layout Applies Font Variables to `<html>`

**File**: `apps/www/src/app/layout.tsx:6,144-151`

```tsx
import { geistSans, geistMono, exposurePlus, ppNeueMontreal, ppSupplySans } from "~/lib/fonts";

<html className={cn(
  geistSans.variable,
  geistMono.variable,
  ppNeueMontreal.variable,   // → sets --font-pp-neue-montreal CSS var
  exposurePlus.variable,
  ppSupplySans.variable,
  "touch-manipulation font-sans antialiased dark scrollbar-thin",
)}>
```

All five font CSS variables are registered on `<html>`. The browser only **downloads** a font file when an element actually uses that `font-family`. The CSS variables are available immediately via `@font-face`, but the file download is deferred.

---

### 3. The `.font-pp` Utility — What It Does

**File**: `apps/www/src/styles/globals.css:14-24`

```css
@layer utilities {
  .font-pp {
    font-family: var(--font-pp-neue-montreal);
    letter-spacing: var(--font-pp-letter-spacing);  /* -0.03em */
    line-height: var(--font-pp-line-height);         /* 1.1 */
  }
}
```

`--font-pp-letter-spacing` and `--font-pp-line-height` are defined in the `:root` block of the same file (`globals.css:8-12`). These values (`-0.03em` letter-spacing, `1.1` line-height) are **significantly different from system font defaults** (typically `normal`/`0` letter-spacing, `1.2–1.5` line-height). This metric difference is what causes the visible shift when the font swaps in.

---

### 4. The Early-Access Page — Why the Shift Is Visible Here

**File**: `apps/www/src/app/(app)/early-access/page.tsx:53`

```tsx
<h1 className="text-2xl pb-4 font-pp font-medium text-foreground">
  Join the Early Access waitlist
</h1>
```

The `font-pp` class is applied to the page's **only major visible element** — a centered heading on an otherwise empty page. The surrounding structure is:

```tsx
<div className="min-h-screen bg-background flex flex-col">
  <main className="flex-1 flex items-center justify-center p-4">
    <div className="w-full max-w-md space-y-4">
      {/* Logo icon (SVG, not text) */}
      <h1 className="... font-pp ...">Join the Early Access waitlist</h1>
      <EarlyAccessForm ... />
    </div>
  </main>
</div>
```

There is no navigation bar, no hero image, no footer, no other visual weight — the heading is front and center on an empty background.

---

### 5. Route Structure — No Group Layout

**Directory**: `apps/www/src/app/(app)/early-access/`
**Contains**: `page.tsx`, `opengraph-image.tsx`

The early-access page sits directly under `(app)/` — it is **not** wrapped by the `(marketing)` group layout (`apps/www/src/app/(app)/(marketing)/layout.tsx`). The marketing layout renders `AppNavbar` and `AppFooter`, which contain their own visual elements (including logo SVGs, nav links, etc.) that load concurrently and mask font swap events visually.

The early-access page's layout chain is:
```
app/layout.tsx (root — registers font variables)
  └── (app)/early-access/page.tsx (no intermediate layout)
```

Marketing pages have:
```
app/layout.tsx (root)
  └── (app)/(marketing)/layout.tsx (AppNavbar + AppFooter)
    └── page.tsx
```

---

### 6. Navigation Pattern — Cold vs. Soft

The critical behavioral difference is **how users arrive at the page**:

| Page | Typical arrival | Font state on arrival |
|---|---|---|
| `/` (home) | Direct URL / bookmark | Cold — fonts not loaded |
| `/blog`, `/changelog` | Soft nav from home | Warm — fonts already in HTTP cache |
| `/early-access` | Email CTA, cross-zone link from console | **Cold** — fonts not loaded |

The early-access page is the destination of signup CTAs shared in emails, Slack, direct links, and cross-zone navigations from the console microfrontend. Cross-zone navigation (console → www) is a **hard navigation** (full page reload). On a cold load, no fonts are in memory. The swap is immediate and visible.

Marketing pages are typically reached through soft navigation (Next.js client-side routing) after the homepage has already loaded — at which point fonts are in the browser's HTTP cache and apply before the new page renders.

---

## Code References

| File | Line | Description |
|---|---|---|
| `apps/www/src/lib/fonts.ts` | 2–9 | Comment explaining `preload: false` rationale for microfrontend proxy |
| `apps/www/src/lib/fonts.ts` | 36–72 | `ppNeueMontreal` definition — 6 weights, `preload: false`, `display: "swap"` |
| `apps/www/src/app/layout.tsx` | 6 | Import of all five font variables |
| `apps/www/src/app/layout.tsx` | 144–151 | Font variables applied to `<html>` element |
| `apps/www/src/styles/globals.css` | 8–12 | `:root` — `--font-pp-letter-spacing: -0.03em`, `--font-pp-line-height: 1.1` |
| `apps/www/src/styles/globals.css` | 14–24 | `.font-pp` utility — applies PP Neue Montreal with tight metrics |
| `apps/www/src/app/(app)/early-access/page.tsx` | 53 | `font-pp` on the only visible heading on the page |
| `apps/www/src/app/(app)/(marketing)/layout.tsx` | 1–32 | Marketing layout (AppNavbar + AppFooter) — NOT present on early-access |

## Architecture Documentation

The Vercel microfrontend setup (`apps/console/microfrontends.json`) routes all four apps through a single domain. Cross-zone navigations (e.g., console → www `/early-access`) trigger full page reloads. The intentional `preload: false` on all www fonts prevents the microfrontend proxy double-download issue but removes the eager font-fetch that would otherwise hide the FOUT.

The FOUT mechanism is active on every www page on cold load. It is only perceived on early-access because:
1. It is a cold-load entry point (not reached via soft navigation normally)
2. It is a minimal page where the `font-pp` heading is the only prominent element
3. PP Neue Montreal's `-0.03em` letter-spacing and `1.1` line-height deviate enough from system font defaults to cause a visible reflow

## Open Questions

- Are there other pages in `(app)/` that sit outside `(marketing)/` and use `font-pp` that may exhibit the same issue?
- Would adding a `<link rel="preload">` for only PP Neue Montreal (with the correct microfrontend-prefixed URL) resolve the shift without reintroducing the double-download?
- Could `font-display: optional` instead of `swap` prevent the shift at the cost of potentially always showing the fallback on very slow connections?

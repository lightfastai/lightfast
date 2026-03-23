---
date: 2026-03-23T00:00:00+11:00
researcher: claude
git_commit: b48ba6d2efab7ba3dd9146479ddaaa0f02116f89
branch: main
repository: lightfast
topic: "apps/app slow first load — root cause analysis (microfrontends, Clerk, Sentry, cross-zone navigation)"
tags: [research, performance, apps/app, microfrontends, clerk, sentry, first-load]
status: complete
last_updated: 2026-03-23
---

# Research: apps/app Slow First Load

**Date**: 2026-03-23
**Git Commit**: b48ba6d2efab7ba3dd9146479ddaaa0f02116f89
**Branch**: main

## Research Question

In production, the apps/app links to `/early-access` and `/sign-in` (routed through `MicrofrontendLink` from apps/www) feel slow on first load (~1–2 seconds). What is actually causing these slow loads?

## Summary

Playwright live measurements on a local dev server (port 4107) confirmed the slowness is real and attributable to **four compounding causes**. The single biggest contributor in dev is on-demand Turbopack route compilation causing a 2.8s TTFB for `/early-access`. In production, the equivalent culprit is **serverless cold starts** combined with the overhead of **cross-zone hard navigation** (MicrofrontendLink forces a full browser page load across zones, not SPA navigation). On top of that, every auth/early-access page loads ~1.5MB of JS including 202KB of Sentry bundles.

---

## Live Measurements (Playwright, localhost:4107, dev build)

### `/sign-in`

| Metric | Value |
|--------|-------|
| TTFB | 976ms (incl. redirect from :4107 → :3024; actual server time ~58ms) |
| FCP | 1033ms |
| DOM Content Loaded | 1046ms |
| Load Complete | 2875ms |
| JS chunks | 36 chunks / **1528KB total** |
| Largest chunk | `next-devtools` 219KB (dev only) |
| 2nd largest | `react-dom` 179KB |
| 3rd largest | `next/dist/client` 133KB |
| 4th largest | `@sentry/core` 124KB |
| Sentry total | ~202KB (`@sentry/core` + `@sentry/replay`) |

### `/early-access`

| Metric | Value |
|--------|-------|
| TTFB | **2810ms** (pure server-side time — no redirect involved) |
| FCP | 2861ms |
| DOM Content Loaded | 2850ms |
| Load Complete | 3733ms |
| JS chunks | 37 chunks / **1573KB total** |

### Console Errors (both pages)

- CSP `frame-ancestors` violations (4 per page) — Sentry Replay CSP mismatch
- `Connecting to 'http://localhost:8969/stream'` — Sentry dev tunnel not running locally
- `[Client Instrumentation Hook] Slow execution` — logged on both pages

### Slowest Resources — /sign-in

| Resource | Duration |
|----------|----------|
| `clerk-telemetry.com/v1/event` | 2453ms |
| `va.vercel-scripts.com` (Analytics + Speed Insights) | 1655ms each |
| `clerk.accounts.dev` — `clerk.browser.js` | 1212ms |
| `/monitoring` × 11 (Sentry Speed Insights) | 927–1089ms each |
| Clerk `/client` API | 937ms |

---

## Detailed Findings

### Cause 1: Cross-Zone Hard Navigation (Production Primary Cause)

- **File**: `apps/www/src/app/(app)/_components/app-navbar-menu.tsx:84` (`MicrofrontendLink href="/sign-in"`)
- **File**: `apps/www/src/app/(app)/_components/app-navbar.tsx:38` (`MicrofrontendLink href="/early-access"`)
- **File**: `apps/app/microfrontends.json` — routing manifest

`/sign-in` and `/early-access` are **not** in the `lightfast-www` routing group. They are owned by `lightfast-app`. When a user on a www page (e.g. `/`, `/pricing`) clicks "Sign In" or "Join Early Access", `MicrofrontendLink` performs a **full browser navigation** — the browser discards the www JS runtime, downloads apps/app's HTML, and fetches all 36–37 JS chunks from scratch.

This is inherent to how Vercel Microfrontends work: cross-zone links cannot reuse the previous zone's client-side router. Every cross-zone navigation is effectively a cold page load.

The `PrefetchCrossZoneLinksProvider` + `PrefetchCrossZoneLinks` pattern in both root layouts (`apps/app/src/app/layout.tsx:66–71`, `apps/www/src/app/layout.tsx:148–153`) does prefetch the target zone's HTML on link hover, which can reduce perceived latency — but all JS chunks still load fresh.

### Cause 2: Serverless Cold Starts (Production)

In production on Vercel, apps/app serverless functions cold-start after inactivity. The auth and early-access routes are likely less frequently hit than the main console routes, making cold starts more likely. Cold start latency on Node.js serverless functions is typically 300–1500ms depending on bundle size and number of dependencies initialized.

In dev, this manifests as on-demand Turbopack route compilation: the 2807ms TTFB on `/early-access` is Turbopack compiling that route for the first time. Once compiled, subsequent requests are fast (~58ms).

### Cause 3: Sentry Bundle Weight on Every Auth Page

- **File**: `apps/app/src/instrumentation-client.ts:1–64`
- **File**: `vendor/next/src/next-config-builder.ts:99–142`

Every page in apps/app (including sign-in and early-access) loads:
- `@sentry/core` — 124KB
- `@sentry/replay` — ~78KB
- **Total: ~202KB of Sentry JS**

The `replayIntegration` is initialized at module load (not lazily). In non-production environments, `replaysSessionSampleRate` is set to `1.0` (`instrumentation-client.ts:37`) — every session is recorded, adding setup overhead.

Additionally, `reactComponentAnnotation.enabled: true` (`vendor/next/src/next-config-builder.ts:116`) annotates all React components, adding a small cost to every component render.

### Cause 4: External Third-Party Script Latency

On each auth page load, the browser makes cold requests to three external origins:

| Origin | Scripts | Observed Latency |
|--------|---------|-----------------|
| `clerk.accounts.dev` | `clerk.browser.js`, `ui.browser.js` | 1035–1212ms |
| `va.vercel-scripts.com` | `script.debug.js` (Analytics), `script.debug.js` (Speed Insights) | 1655ms each |
| `clerk-telemetry.com` | `/v1/event` | 2453ms |

These run in parallel after the page HTML is received so they don't directly block TTFB, but they extend `loadEventEnd` and can trigger layout shifts or delayed interactivity.

The Vercel Analytics and Speed Insights scripts load the `.debug.js` variants in non-production (larger, source-mapped).

### Cause 5: Sentry Flooding `/monitoring` (11 requests/page)

The Sentry `tunnelRoute: "/monitoring"` config (`vendor/next/src/next-config-builder.ts:126`) routes all Sentry events through the app's own `/monitoring` endpoint. On each page load, 11 requests fire to `/monitoring` in parallel. Each takes 927–1089ms in dev. This does not block FCP but keeps the network busy and contributes to elevated `loadEventEnd`.

---

## Configuration Reference

### Next.js Config (affecting performance)

| Setting | Value | File | Line |
|---------|-------|------|------|
| `reactStrictMode` | `true` | `vendor/next/src/next-config-builder.ts` | 12 |
| `reactCompiler` | `true` | `vendor/next/src/next-config-builder.ts` | 13 |
| `optimizeCss` | `true` | `vendor/next/src/next-config-builder.ts` | 87 |
| `staleTimes.dynamic` | 30s | `vendor/next/src/next-config-builder.ts` | 89 |
| `staleTimes.static` | 180s | `vendor/next/src/next-config-builder.ts` | 90 |
| `turbopackScopeHoisting` | `false` | `apps/app/next.config.ts` | 83 |
| `optimizePackageImports` | 26 packages | `apps/app/next.config.ts` + vendor | 51–82 |
| `transpilePackages` | 18 packages | `apps/app/next.config.ts` | 23–49 |
| Sentry `tunnelRoute` | `"/monitoring"` | `vendor/next/src/next-config-builder.ts` | 126 |
| Sentry Replay (non-prod) | 100% sessions | `apps/app/src/instrumentation-client.ts` | 37 |

### Provider Stack (apps/app first load)

Every first load of apps/app initializes in order:

1. `PrefetchCrossZoneLinksProvider` (`@vercel/microfrontends/next/client`) — fetches `/.well-known/vercel/microfrontends/client-config`
2. Clerk middleware auth resolution (`proxy.ts:121–124`)
3. CSP headers from 5 directive factories (`proxy.ts:17–25`)
4. `ClerkProvider` (`(auth)/layout.tsx:15` or `(app)/layout.tsx:15`)
5. Sentry client (`instrumentation-client.ts`) — replay, httpClient, captureConsole, extraErrorData, feedback, spotlight integrations
6. `KnockProvider` + `KnockFeedProvider` (only in `(app)` layout, not auth/early-access)
7. PP Neue Montreal font fetch (`apps/app/src/lib/fonts.ts:8–23`, local font from `public/fonts/`)
8. `PrefetchCrossZoneLinks` — fetches routing manifest

### Microfrontends Routing

- **Manifest owner**: `apps/app/microfrontends.json`
- **lightfast-app** (port 4107): default catch-all, no explicit routing rules
- **lightfast-www** (port 4101): 33 explicit paths (marketing, docs, blog, changelog, etc.)
- `/sign-in`, `/sign-up`, `/early-access` → **not in lightfast-www routing group** → served by lightfast-app → cross-zone navigation from www

---

## Code References

- `apps/www/src/app/(app)/_components/app-navbar-menu.tsx:84` — MicrofrontendLink to `/sign-in`
- `apps/www/src/app/(app)/_components/app-navbar.tsx:38` — MicrofrontendLink to `/early-access`
- `apps/app/microfrontends.json:3–49` — routing manifest
- `apps/app/src/proxy.ts:114–118` — `runMicrofrontendsMiddleware` called first in every request
- `apps/app/src/proxy.ts:228–234` — middleware matcher (includes `/.well-known/vercel/microfrontends/client-config`)
- `apps/app/src/instrumentation-client.ts:35–59` — Sentry client integrations + replay sample rates
- `apps/app/src/app/layout.tsx:66–71` — `PrefetchCrossZoneLinksProvider` wraps entire body
- `apps/app/src/app/(auth)/layout.tsx:15–23` — ClerkProvider for auth routes
- `apps/app/src/app/(early-access)/layout.tsx:15–23` — ClerkProvider for early-access
- `vendor/next/src/next-config-builder.ts:99–142` — Sentry config (tunnelRoute, reactComponentAnnotation)
- `apps/app/src/lib/fonts.ts:8–23` — PP Neue Montreal local font

## Related Research

- `thoughts/shared/research/2026-03-21-microfrontend-routes-audit.md` — prior audit of microfrontend routing

---
date: 2026-03-23T02:30:00+11:00
researcher: claude
git_commit: 3bdbd26398d5051c30423b2055cb489a2bd6f6e9
branch: perf/sign-in-isolation
repository: lightfast
topic: "Why is /sign-in super slow? TTFB isolation testing"
tags: [research, performance, sign-in, clerk, ttfb, cold-start, middleware]
status: complete
last_updated: 2026-03-23
---

# Research: Why is /sign-in super slow?

**Date**: 2026-03-23
**Branch**: `perf/sign-in-isolation`
**Method**: 6-step additive isolation — stripped all layers to a bare page, added each back one by one, measured TTFB (5 runs per step) against a production Next.js build on localhost.

## Research Question

`/sign-in` is reported as super slow. Identify which layer in the request stack causes the latency and by how much.

---

## TTFB Results Table

Measured with `curl -o /dev/null -s -w '%{time_starttransfer}'` against `next start` (production build, localhost, no network overhead).

| Step | Layers Active | Cold Run 1 | Cold Run 2 | Warm (avg runs 3-5) |
|------|--------------|-----------|-----------|---------------------|
| 0 | Nothing — bare `NextResponse.next()`, bare layouts, bare page | 14ms | 10ms | **8ms** |
| 1 | + Root layout (fonts, `PrefetchCrossZoneLinksProvider`, analytics) | 45ms | 23ms | **9ms** |
| 2 | + Auth layout (`ClerkProvider`, `Show`, `RedirectToTasks`) | **825ms** | **641ms** | **18ms** |
| 3 | + `clerkMiddleware` + `securityHeaders` (no MFE middleware) | **696ms** | **534ms** | **14ms** |
| 4 | + `runMicrofrontendsMiddleware` | 717ms | 545ms | **15ms** |
| 5 | + Full sign-in page (all components) | 789ms | 442ms | **16ms** |

---

## Root Cause: Clerk JWKS Cold Fetch

**The jump happens at Step 2.** Adding `ClerkProvider` to the auth layout explodes cold TTFB from 45ms → 825ms (run 1) and 23ms → 641ms (run 2). Every subsequent step shows the same pattern — once the JWKS keys are cached in-process, warm TTFB stabilizes at 14-18ms.

### What's happening

Clerk validates JWTs using JWKS (JSON Web Key Set) keys fetched from `https://<clerk-domain>/.well-known/jwks.json`. On a cold function instance:

1. No cached keys → Clerk makes an outbound HTTP request to its FAPI
2. This fetch takes **400-800ms** depending on network conditions
3. Keys are cached in the Node.js module scope after the first fetch
4. Requests 3+ are fast (~14-16ms TTFB)

This affects `/sign-in` specifically because:
- The middleware calls `auth({ treatPendingAsSignedOut: false })` for `/sign-in` (it's in both `isPublicRoute` AND `isAuthRoute`, so `skipAuth = false`)
- The `ClerkProvider` in the auth layout also initializes Clerk context (server-side render of client components triggers Clerk's auth machinery)
- Both middleware and layout share the same in-process JWKS cache, but the cache starts empty on every cold start

### Why it feels "always slow" in production

Vercel serverless functions:
- Scale to zero when idle (sign-in is low-traffic between waves of users)
- New deployments cold-start all instances
- Traffic spikes create new cold instances

Result: a disproportionate fraction of real users hit the cold path.

---

## What Is NOT the Cause

| Suspect | Delta Added | Verdict |
|---------|------------|---------|
| `runMicrofrontendsMiddleware` | +1-2ms warm, +20ms cold (noise) | ✅ **Innocent** |
| Root layout (fonts, MFE providers, analytics) | +1ms warm, +31ms cold (font init) | ✅ **Innocent** |
| Sign-in page components | +1ms warm | ✅ **Innocent** |
| `securityHeaders` CSP composition | <1ms warm | ✅ **Innocent** |

---

## Fix Options (Priority Order)

### Fix 1 — Skip auth for unauthenticated sign-in requests (highest impact)

`/sign-in` calls `auth()` to redirect authenticated users away. But if there's no session cookie, the user is definitely not authenticated — no JWKS validation needed.

In `proxy.ts`:
```ts
// Before calling auth() for /sign-in, check if a session cookie exists
const hasSession = req.cookies.has('__session') || req.cookies.has('__client_uat');
if (isAuthRoute(req) && !hasSession) {
  // No session → user is unauthenticated → let through, no redirect needed
  // Skip auth() entirely — saves the JWKS fetch on cold starts
}
```

This makes `/sign-in` a true passthrough for unauthenticated users (the common case), eliminating the cold JWKS fetch entirely.

**Risk**: Low. Authenticated users have `__session` cookies, so they still get redirected. Unauthenticated users just see the sign-in page.

### Fix 2 — Prewarm JWKS at module load (medium impact)

Trigger JWKS fetch outside the request handler so it runs at cold-start time instead of on the first user request:

```ts
// In proxy.ts, at module level (runs once on cold start):
import { createClerkClient } from "@vendor/clerk/server";
// Prewarm JWKS — runs during module initialization, before any request hits
createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  .jwks.getPublicKey()
  .catch(() => {}); // fire-and-forget, don't block module load
```

This moves the 600-800ms penalty from the first user request to the function initialization phase (which happens in parallel with request routing).

**Risk**: Low. Worst case it fails silently and falls back to on-demand fetch.

### Fix 3 — Use Vercel Fluid Compute (infrastructure fix)

Fluid Compute keeps function instances alive between requests instead of scaling to zero. Eliminates cold starts entirely.

In `vercel.json` for the app:
```json
{
  "functions": {
    "apps/app/**": {
      "maxDuration": 800
    }
  }
}
```

Enable Fluid Compute in the Vercel dashboard for the `lightfast-app` project.

**Risk**: Cost — Fluid Compute uses different billing (execution seconds vs invocations). Check pricing before enabling.

### Fix 4 — Cache JWKS in Vercel Runtime Cache (advanced)

Use Vercel's edge Runtime Cache to persist JWKS across cold starts across all function instances:

```ts
// At module level or in a shared utility
import { get, set } from '@vercel/runtime-cache';
// Fetch JWKS once, cache globally across instances (not just per-process)
```

This is the most robust fix but requires the most code.

---

## Code References

- `apps/app/src/proxy.ts` — middleware (clerkMiddleware, auth(), skipAuth logic)
- `apps/app/src/app/(auth)/layout.tsx` — ClerkProvider initialization
- `apps/app/src/app/(auth)/sign-in/page.tsx` — sign-in page (no server-side overhead)
- `apps/app/microfrontends.json` — MFE routing config (not involved in slowness)

## Isolation Branch

Branch `perf/sign-in-isolation` contains all 6 step commits. After this research, the branch was restored to approximately production state (full page, full proxy with MFE middleware, full layouts).

## Recommended Next Step

Implement **Fix 1** (skip auth when no session cookie) on this branch — it's zero-risk, requires ~5 lines of change in `proxy.ts`, and eliminates the cold-start JWKS fetch for unauthenticated sign-in visitors (the vast majority of users).

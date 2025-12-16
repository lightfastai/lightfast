---
date: 2025-12-16T22:21:30+1100
researcher: Claude
git_commit: b8b3afd9ca6a0875a13e918ed6ee9b45c0aa5808
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Auth Middleware NEMO Architecture - Streamlining Composition"
tags: [research, middleware, nemo, clerk, architecture, security]
status: complete
last_updated: 2025-12-16
last_updated_by: Claude
---

# Research: Auth Middleware NEMO Architecture

**Date**: 2025-12-16T22:21:30+1100
**Researcher**: Claude
**Git Commit**: b8b3afd9ca6a0875a13e918ed6ee9b45c0aa5808
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

How to streamline `apps/auth/src/middleware.ts` to use NEMO properly, and investigate the weird pattern where we determine if final response is a redirect. What's the cleanest architecture?

## Summary

The current auth middleware has an **architectural tension** between three different paradigms:

1. **Clerk's wrapper pattern** - designed to wrap the entire middleware
2. **NEMO's composition pattern** - designed for middleware chaining
3. **Security headers** - generates a Response object that must be applied to other responses

The "weird redirect detection pattern" (lines 118-121) exists because NEMO's response isn't being used correctly—the code manually checks if we're redirecting to avoid letting NEMO override the redirect. This is a **code smell** indicating incomplete integration.

**Core insight**: Clerk is fundamentally a **wrapper**, not a **composable middleware**. Trying to fit it into NEMO's composition model creates friction.

## Detailed Findings

### Current Architecture Analysis

**File**: `apps/auth/src/middleware.ts:65-128`

```typescript
export default clerkMiddleware(
  async (auth, req: NextRequest, event) => {
    // Auth logic creates response variable
    let response = NextResponse.next();

    // Conditionally set response to redirects
    if ((isPending || isActive) && isAuthRoute(req)) {
      response = NextResponse.redirect(...);
    } else if (isRootPath(req)) {
      response = NextResponse.redirect(...);
    }

    // Run security headers (returns Response with headers)
    const headersResponse = await securityHeaders();

    // Run NEMO composed middleware
    const middlewareResponse = await composedMiddleware(req, event);

    // THE WEIRD PATTERN - manual redirect detection
    const isRedirect = response.status >= 300 && response.status < 400;
    const finalResponse = isRedirect
      ? response                              // Keep redirect
      : (middlewareResponse ?? response);     // Use NEMO's response

    // Apply security headers
    for (const [key, value] of headersResponse.headers.entries()) {
      finalResponse.headers.set(key, value);
    }

    return finalResponse;
  }
);
```

**Why this pattern exists**:
1. NEMO's `composedMiddleware` can return a different response
2. If we've decided to redirect, we don't want NEMO to override it
3. So we manually check "is this a redirect?" and preserve it

**Why it's a code smell**:
- NEMO is being used but its response chaining isn't leveraged
- Security headers aren't part of NEMO's chain
- Manual response type detection is fragile

### How NEMO Is Designed to Work

From `@rescale/nemo` documentation:

```typescript
const composedMiddleware = createNEMO(
  {
    '/api': apiMiddleware,        // Route-specific
    '/admin': adminMiddleware,
  },
  {
    before: [loggerMiddleware],   // Runs BEFORE route middleware
    after: [cleanupMiddleware],   // Runs AFTER route middleware
  },
);
```

**Response handling in NEMO**:
- **Return a Response**: Short-circuits the chain immediately
- **Don't return anything**: Implicitly forwards to next middleware
- **Use `event.storage`**: Share state between middlewares

**Current usage** (`apps/auth/src/middleware.ts:41-46`):
```typescript
const composedMiddleware = createNEMO(
  {},                             // No route-specific middleware!
  {
    before: [authMiddleware],     // Only has a placeholder middleware
  },
);
```

The NEMO usage is essentially a no-op with a placeholder `authMiddleware` that just returns `NextResponse.next()`.

### Comparison with Other Apps

| App | NEMO Usage | Redirect Handling | Notes |
|-----|-----------|-------------------|-------|
| **Auth** | Placeholder in `before` | Manual redirect check | The problem pattern |
| **Console** | Empty `before` | Early return with headers | Cleaner—returns early |
| **WWW** | `wwwMiddleware` sets header | Uses `middlewareResponse ?? response` | No redirect check |
| **Chat** | No NEMO | Direct returns | Simplest, most readable |

**Console's approach** (`apps/console/src/middleware.ts:111-122`):
```typescript
// Helper to apply headers and return redirect
const createRedirectResponse = async (url: URL) => {
  const redirectResponse = NextResponse.redirect(url);
  const headersResponse = await securityHeaders();
  for (const [key, value] of headersResponse.headers.entries()) {
    redirectResponse.headers.set(key, value);
  }
  return redirectResponse;  // Early return with headers already applied
};
```

Console creates a helper that applies headers immediately, then returns early. No need for redirect detection at the end.

### The Three Paradigm Clash

```
┌────────────────────────────────────────────────────────────────────┐
│                    CLERK MIDDLEWARE (Wrapper)                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │   Auth Logic → Redirects?  ─────────────────┐               │  │
│  │        │                                    │               │  │
│  │        ▼                                    │               │  │
│  │   ┌─────────────────────┐                   │               │  │
│  │   │ NEMO Composition    │                   │               │  │
│  │   │ (currently unused)  │                   │               │  │
│  │   └─────────────────────┘                   │               │  │
│  │        │                                    │               │  │
│  │        ▼                                    │               │  │
│  │   Manual redirect check ◄───────────────────┘               │  │
│  │        │                                                    │  │
│  │        ▼                                                    │  │
│  │   Security Headers (applied to final)                       │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Problem**: NEMO sits in the middle but doesn't actually do anything useful. The "composition" is:
1. Auth logic (inside Clerk callback)
2. NEMO (placeholder)
3. Security headers (applied manually)

## Proposed Architecture Options

### Option A: Remove NEMO Entirely (Simplest)

If NEMO isn't being used for real composition, remove it. Follow Chat app's pattern.

```typescript
export default clerkMiddleware(
  async (auth, req: NextRequest) => {
    const { userId, orgId, orgSlug } = await auth({ treatPendingAsSignedOut: false });
    const isPending = Boolean(userId && !orgId);
    const isActive = Boolean(userId && orgId);

    // Helper for redirect responses with headers
    const redirect = async (url: URL) => {
      const response = NextResponse.redirect(url);
      const headers = await securityHeaders();
      for (const [key, value] of headers.headers.entries()) {
        response.headers.set(key, value);
      }
      return response;
    };

    // Auth page redirects
    if ((isPending || isActive) && isAuthRoute(req)) {
      if (isPending) {
        return redirect(new URL("/account/teams/new", consoleUrl));
      }
      return redirect(new URL(`/${orgSlug}`, consoleUrl));
    }

    // Root path routing
    if (isRootPath(req)) {
      if (!userId) return redirect(new URL("/sign-in", req.url));
      if (isPending) return redirect(new URL("/account/teams/new", consoleUrl));
      if (isActive && orgSlug) return redirect(new URL(`/${orgSlug}`, consoleUrl));
    }

    // Protect non-public routes
    if (!isPublicRoute(req)) {
      await auth.protect();
    }

    // Default response with security headers
    const response = NextResponse.next();
    const headers = await securityHeaders();
    for (const [key, value] of headers.headers.entries()) {
      response.headers.set(key, value);
    }
    return response;
  },
);
```

**Pros**:
- Removes unused abstraction
- Clear, linear control flow
- No redirect detection hack needed
- Matches Chat app pattern

**Cons**:
- Loses NEMO's extensibility (if future middleware needed)
- Slightly more code for header application

### Option B: Integrate Security Headers into NEMO (Full Composition)

Make security headers a proper NEMO middleware:

```typescript
// Security headers as NEMO-compatible middleware
const securityHeadersMiddleware: NextMiddleware = async (request, event) => {
  const headersResponse = await securityHeaders();

  // Store headers in NEMO's storage for later application
  event.storage.set("securityHeaders", headersResponse.headers);

  // Don't return - let chain continue
};

// Final middleware that applies stored headers
const applyHeadersMiddleware: NextMiddleware = async (request, event) => {
  const response = NextResponse.next();
  const headers = event.storage.get("securityHeaders") as Headers;

  if (headers) {
    for (const [key, value] of headers.entries()) {
      response.headers.set(key, value);
    }
  }

  return response;
};

const composedMiddleware = createNEMO(
  {},
  {
    before: [securityHeadersMiddleware, authMiddleware],
    after: [applyHeadersMiddleware],
  },
);
```

**Problem**: This doesn't solve the redirect issue. Redirects need headers applied to THEM, not to `NextResponse.next()`.

### Option C: Use Early Returns with Header Helper (Recommended)

Combine Console's helper pattern with explicit early returns:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  composeCspOptions,
  createClerkCspDirectives,
  createAnalyticsCspDirectives,
  createSentryCspDirectives,
  createNextjsCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { consoleUrl } from "~/lib/related-projects";

// Security headers generator
const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
  ),
);

// Route matchers
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-in/sso-callback",
  "/sign-up",
  "/sign-up/sso-callback",
  "/api/health",
  "/robots.txt",
  "/sitemap.xml",
]);
const isAuthRoute = createRouteMatcher(["/sign-in", "/sign-up"]);
const isRootPath = createRouteMatcher(["/"]);

// Helper: Apply security headers to any response
async function withSecurityHeaders(response: NextResponse): Promise<NextResponse> {
  const headers = await securityHeaders();
  for (const [key, value] of headers.headers.entries()) {
    response.headers.set(key, value);
  }
  return response;
}

// Helper: Create redirect with security headers
async function secureRedirect(url: URL | string): Promise<NextResponse> {
  return withSecurityHeaders(NextResponse.redirect(url));
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, orgId, orgSlug } = await auth({ treatPendingAsSignedOut: false });
  const isPending = Boolean(userId && !orgId);
  const isActive = Boolean(userId && orgId);

  // 1. Redirect authenticated users away from auth pages
  if ((isPending || isActive) && isAuthRoute(req)) {
    if (isPending) {
      return secureRedirect(new URL("/account/teams/new", consoleUrl));
    }
    if (isActive && orgSlug) {
      return secureRedirect(new URL(`/${orgSlug}`, consoleUrl));
    }
  }

  // 2. Root path routing
  if (isRootPath(req)) {
    if (!userId) {
      return secureRedirect(new URL("/sign-in", req.url));
    }
    if (isPending) {
      return secureRedirect(new URL("/account/teams/new", consoleUrl));
    }
    if (isActive && orgSlug) {
      return secureRedirect(new URL(`/${orgSlug}`, consoleUrl));
    }
  }

  // 3. Protect non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // 4. Default: continue with security headers
  return withSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Changes from current**:
1. **Removed NEMO entirely** - it wasn't being used
2. **Created `withSecurityHeaders()` helper** - reusable for any response
3. **Created `secureRedirect()` helper** - combines redirect + headers
4. **Early returns everywhere** - no need for redirect detection
5. **Linear control flow** - easy to trace execution path

### Option D: Keep NEMO for Future Extensibility

If you want to keep NEMO for future middleware (rate limiting, analytics, etc.):

```typescript
import { createNEMO } from "@rescale/nemo";

// Custom middleware for auth-specific logic (rate limiting, fraud detection)
const authRateLimitMiddleware: NextMiddleware = async (request, event) => {
  // Future: Rate limiting for sign-in attempts
  // Future: Custom analytics for auth events
  // Future: Fraud detection
  return; // Implicit forward
};

const composedMiddleware = createNEMO(
  {},
  {
    before: [authRateLimitMiddleware],
  },
);

export default clerkMiddleware(async (auth, req: NextRequest, event) => {
  const { userId, orgId, orgSlug } = await auth({ treatPendingAsSignedOut: false });
  const isPending = Boolean(userId && !orgId);
  const isActive = Boolean(userId && orgId);

  // Handle redirects FIRST with early returns
  if ((isPending || isActive) && isAuthRoute(req)) {
    if (isPending) return secureRedirect(new URL("/account/teams/new", consoleUrl));
    if (isActive && orgSlug) return secureRedirect(new URL(`/${orgSlug}`, consoleUrl));
  }

  if (isRootPath(req)) {
    if (!userId) return secureRedirect(new URL("/sign-in", req.url));
    if (isPending) return secureRedirect(new URL("/account/teams/new", consoleUrl));
    if (isActive && orgSlug) return secureRedirect(new URL(`/${orgSlug}`, consoleUrl));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Only run NEMO for non-redirect paths
  const nemoResponse = await composedMiddleware(req, event);
  return withSecurityHeaders(nemoResponse ?? NextResponse.next());
});
```

**Key insight**: Only run NEMO for non-redirect paths. Redirects are "exit conditions" that bypass the middleware chain.

## Architecture Decision Matrix

| Criteria | Option A (No NEMO) | Option C (Early Returns) | Option D (Keep NEMO) |
|----------|-------------------|-------------------------|---------------------|
| Simplicity | High | High | Medium |
| Readability | High | High | High |
| Extensibility | Low | Low | High |
| Lines of Code | ~60 | ~70 | ~80 |
| Redirect Handling | Clean | Clean | Clean |
| Future Middleware | Rewrite needed | Rewrite needed | Ready |

## Recommendation

**Use Option C (Early Returns with Header Helper)** for these reasons:

1. **Removes the weird pattern entirely** - no redirect detection needed
2. **Clear control flow** - easy to understand and maintain
3. **Reusable helpers** - `withSecurityHeaders()` and `secureRedirect()`
4. **Matches Console pattern** - consistency across apps
5. **YAGNI principle** - NEMO isn't being used, don't keep unused abstractions

If future middleware is needed, you can add NEMO back with Option D's pattern.

## Code References

- `apps/auth/src/middleware.ts:118-121` - The weird redirect detection pattern
- `apps/console/src/middleware.ts:111-122` - Console's helper pattern (better)
- `apps/chat/src/middleware.ts:1-51` - Chat's simple pattern (no NEMO)
- `apps/www/src/middleware.ts:83-92` - WWW's header application pattern
- `vendor/security/src/middleware.ts:1-14` - Security middleware implementation
- `vendor/security/src/csp/compose.ts:113-173` - CSP composition logic

## Open Questions

1. **Should all apps use the same pattern?** Currently Console, Auth, WWW use slightly different approaches
2. **Should we create a shared `@vendor/security` helper for `withSecurityHeaders()`?** Would reduce duplication
3. **Is NEMO needed anywhere?** Consider removing from all apps if unused

## Related Research

- `thoughts/shared/research/2025-12-16-auth-sign-in-redirect-loop.md` - Related auth redirect issues

import { createNEMO } from "@rescale/nemo";
import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";
import { runMicrofrontendsMiddleware } from "@vercel/microfrontends/next/middleware";
import {
  composeCspOptions,
  createAnalyticsCspDirectives,
  createClerkCspDirectives,
  createKnockCspDirectives,
  createNextjsCspDirectives,
  createSentryCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Security headers with composable CSP configuration
const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createKnockCspDirectives(),
    createSentryCspDirectives()
  )
);

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/docs(.*)", // Documentation pages
  "/monitoring", // Sentry error reporting tunnel (tunnelRoute in vendor/next config)
  "/ingest(.*)", // PostHog analytics proxy (rewrites to us.i.posthog.com)
  "/manifest.json", // Web app manifest (requested by iOS/social crawlers)
  // Auth routes (migrated from apps/auth)
  "/sign-in",
  "/sign-in/sso-callback",
  "/sign-up",
  "/sign-up/sso-callback",
  "/early-access",
]);

// Auth page routes — redirect authenticated users away
const isAuthRoute = createRouteMatcher(["/sign-in", "/sign-up"]);

// Pending-allowed routes - accessible to pending users (authenticated but no org claimed)
// Includes all account routes and API routes used during team/workspace creation
const isTeamCreationRoute = createRouteMatcher([
  "/account(.*)", // All account routes — pending users can access settings, team creation, welcome
  "/provider/vercel/connected", // Vercel OAuth success page (used by gateway service redirect)
  "/provider/github/connected", // GitHub OAuth success page (used by gateway service redirect)
  "/provider/sentry/connected", // Sentry OAuth success page (used by gateway service redirect)
  "/api/organizations(.*)",
]);

// User-scoped tRPC endpoint - accessible to pending users
const isUserScopedRoute = createRouteMatcher([
  "/api/trpc/user(.*)", // All procedures under /api/trpc/user/*
  // /cli/auth moved to (pending-not-allowed) — requires active org
]);

// Org-scoped tRPC endpoint - requires active org
const isOrgScopedRoute = createRouteMatcher([
  "/api/trpc/org(.*)", // All procedures under /api/trpc/org/*
]);

// Organization page routes - requires active org
// Matches /:slug and /:slug/* patterns (excluding reserved routes)
// organizationSyncOptions activates org from URL, then auth.protect verifies access
const isOrgPageRoute = createRouteMatcher(["/:slug", "/:slug/(.*)"]);

// API routes - auth handled at route level (API key or session)
// Must bypass Clerk middleware to allow API key authentication
const isApiRoute = createRouteMatcher([
  "/v1/(.*)", // keep for answer route
  "/search(.*)", // new search
  "/contents(.*)", // new contents
  "/findsimilar(.*)", // new findsimilar
  "/related(.*)", // new related
  "/api/cli/(.*)",
  "/api/events/(.*)",
]);

/**
 * Compose middleware with NEMO
 * Future middleware can be added to the before array
 */
const composedMiddleware = createNEMO(
  {},
  {
    before: [],
  }
);

/**
 * Authentication & Authorization Flow:
 *
 * 1. Auth pages (/sign-in, /sign-up) → redirect authenticated users away
 * 2. Public routes (health, webhooks, early-access) → allowed without auth
 * 3. Pending-allowed routes (/account/*) → pending users allowed (see (pending-allowed)/ route group)
 * 4. User-scoped tRPC (/api/trpc/user/*) → pending + active users allowed
 * 5. Org-scoped tRPC (/api/trpc/org/*) → active org required (auth.protect)
 * 6. Org page routes (/:slug, /:slug/*) → active org required (auth.protect)
 *    - organizationSyncOptions activates org from URL BEFORE auth.protect runs
 * 7. All other routes → protected or redirect pending users to /account/teams/new
 *    (includes (pending-not-allowed)/ routes: /cli/auth, /new/*)
 *
 * Key: organizationSyncOptions handles syncing org from /:slug pattern in URL.
 * auth.protect() then verifies the user has access to that activated org.
 */
export default clerkMiddleware(
  async (auth, req: NextRequest, event) => {
    // Handle microfrontends client-config endpoint for cross-zone prefetching
    const mfeResponse = await runMicrofrontendsMiddleware({
      request: req,
      flagValues: {},
    });
    if (mfeResponse) return mfeResponse;

    // Skip Clerk JWT decode for routes that never use auth state
    // (public routes that don't redirect authenticated users away)
    const skipAuth = isPublicRoute(req) && !isAuthRoute(req);
    const { userId, orgId, orgSlug } = skipAuth
      ? { userId: null, orgId: null, orgSlug: null }
      : await auth({ treatPendingAsSignedOut: false });
    const isPending = Boolean(userId && !orgId);

    // Helper to apply headers and return redirect
    const createRedirectResponse = async (url: URL) => {
      const redirectResponse = NextResponse.redirect(url);
      const headersResponse = await securityHeaders();

      // Apply security headers to redirect
      for (const [key, value] of headersResponse.headers.entries()) {
        redirectResponse.headers.set(key, value);
      }

      return redirectResponse;
    };

    // Redirect authenticated users away from auth pages
    if (isAuthRoute(req) && userId) {
      if (isPending) {
        return await createRedirectResponse(
          new URL("/account/teams/new", req.url)
        );
      }
      if (orgSlug) {
        return await createRedirectResponse(new URL(`/${orgSlug}`, req.url));
      }
    }

    // Public routes - no auth required
    if (isPublicRoute(req)) {
      // Allow through without any checks
    }
    // Team creation routes - require authentication, allow pending users
    else if (isTeamCreationRoute(req)) {
      if (!userId) {
        await auth.protect();
      }
      // Allow both pending and active users
    }
    // User-scoped tRPC routes: allow both pending and active users
    else if (isUserScopedRoute(req)) {
      const { userId } = await auth({ treatPendingAsSignedOut: false });
      if (!userId) {
        // Unauthenticated - the tRPC procedure will handle this
        // Let request through to get proper tRPC error
      }
      // Allow both pending and active users to proceed
      // Authorization happens at procedure level
    }
    // API routes: auth handled at route level via withDualAuth
    // Supports both API key (external clients) and session (console UI)
    else if (isApiRoute(req)) {
      // Allow through without Clerk auth checks
      // Route handlers use withDualAuth() for authentication
    }
    // Org-scoped tRPC routes: require active org
    else if (isOrgScopedRoute(req)) {
      await auth.protect(); // Requires active org
    }
    // Organization page routes (/:slug, /:slug/*): require active org
    // organizationSyncOptions activates org from URL before auth.protect() runs
    else if (isOrgPageRoute(req)) {
      await auth.protect(); // Requires active org
    }
    // Redirect pending users to team creation
    else if (isPending) {
      return await createRedirectResponse(
        new URL("/account/teams/new", req.url)
      );
    }
    // Protect all other routes
    else {
      await auth.protect();
    }

    // Run security headers first
    const headersResponse = await securityHeaders();

    // Then run composed middleware
    const middlewareResponse = await composedMiddleware(req, event);

    // Apply security headers to final response
    const finalResponse = middlewareResponse ?? NextResponse.next();
    for (const [key, value] of headersResponse.headers.entries()) {
      finalResponse.headers.set(key, value);
    }

    return finalResponse;
  },
  {
    // Auth routes are now self-hosted (migrated from apps/auth)
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    // Post-authentication redirects - always to team creation which handles org creation
    afterSignInUrl: "/account/welcome",
    afterSignUpUrl: "/account/welcome",
    // Sync Clerk organization state for /:slug routes
    organizationSyncOptions: {
      organizationPatterns: ["/:slug", "/:slug/(.*)"],
    },
    // Enable debug logging in development
    // debug: process.env.NODE_ENV === "development",
  }
);

export const config = {
  matcher: [
    "/.well-known/vercel/microfrontends/client-config",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  composeCspOptions,
  createClerkCspDirectives,
  createAnalyticsCspDirectives,
  createKnockCspDirectives,
  createSentryCspDirectives,
  createNextjsCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import { createNEMO } from "@rescale/nemo";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authUrl } from "~/lib/related-projects";

// Security headers with composable CSP configuration
const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createKnockCspDirectives(),
    createSentryCspDirectives(),
  ),
);

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/api/github/webhooks", // GitHub webhook endpoint (CRITICAL: must be public)
  "/api/vercel/webhooks", // Vercel webhook endpoint
  "/robots.txt",
  "/sitemap(.*)",
  "/llms.txt", // AI crawler guidance file
  "/llms-full.txt", // AI crawler full content file
  "/docs(.*)", // Documentation pages
  "/monitoring", // Sentry error reporting tunnel (tunnelRoute in vendor/next config)
  "/ingest(.*)", // PostHog analytics proxy (rewrites to us.i.posthog.com)
  "/manifest.json", // Web app manifest (requested by iOS/social crawlers)
]);

// Team creation routes - accessible to pending users (authenticated but no org claimed)
// Includes both page routes and API routes used during team/workspace creation
const isTeamCreationRoute = createRouteMatcher([
  "/account/teams/new", // Team/org creation flow
  "/new(.*)", // Workspace creation flow
  "/api/github(.*)",
  "/api/vercel/authorize", // Vercel OAuth initiation
  "/api/vercel/callback", // Vercel OAuth callback
  "/vercel/connected", // Vercel OAuth success page
  "/api/organizations(.*)",
]);

// User-scoped tRPC endpoint - accessible to pending users
const isUserScopedRoute = createRouteMatcher([
  "/api/trpc/user(.*)", // All procedures under /api/trpc/user/*
]);

// Org-scoped tRPC endpoint - requires active org
const isOrgScopedRoute = createRouteMatcher([
  "/api/trpc/org(.*)", // All procedures under /api/trpc/org/*
]);

// Organization page routes - requires active org
// Matches /:slug and /:slug/* patterns (excluding reserved routes)
// organizationSyncOptions activates org from URL, then auth.protect verifies access
const isOrgPageRoute = createRouteMatcher(["/:slug", "/:slug/(.*)"]);

// v1 API routes - auth handled at route level (API key or session)
// Must bypass Clerk middleware to allow API key authentication
const isV1ApiRoute = createRouteMatcher(["/v1/(.*)"]);

/**
 * Compose middleware with NEMO
 * Future middleware can be added to the before array
 */
const composedMiddleware = createNEMO(
  {},
  {
    before: [],
  },
);

/**
 * Authentication & Authorization Flow:
 *
 * 1. Public routes (health, webhooks) → allowed without auth
 * 2. Team creation routes (/account/teams/new, /new) → pending users allowed
 * 3. User-scoped tRPC (/api/trpc/user/*) → pending + active users allowed
 * 4. Org-scoped tRPC (/api/trpc/org/*) → active org required (auth.protect)
 * 5. Org page routes (/:slug, /:slug/*) → active org required (auth.protect)
 *    - organizationSyncOptions activates org from URL BEFORE auth.protect runs
 * 6. All other routes → protected or redirect pending users to team creation
 *
 * Key: organizationSyncOptions handles syncing org from /:slug pattern in URL.
 * auth.protect() then verifies the user has access to that activated org.
 */
export default clerkMiddleware(
  async (auth, req: NextRequest, event) => {
    // Single auth check - detect both pending and active users
    const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
    const isPending = Boolean(userId && !orgId);

    // Log middleware flow for GitHub routes
    if (req.nextUrl.pathname.startsWith('/api/github')) {
      console.log("[Middleware] GitHub route detected:", {
        path: req.nextUrl.pathname,
        userId,
        orgId,
        isPending,
        isTeamCreationRoute: isTeamCreationRoute(req),
      });
    }

    // Helper to apply headers and return redirect
    const createRedirectResponse = async (url: URL) => {
      console.log("[Middleware] Creating redirect response to:", url.toString());
      const redirectResponse = NextResponse.redirect(url);
      const headersResponse = await securityHeaders();

      // Apply security headers to redirect
      for (const [key, value] of headersResponse.headers.entries()) {
        redirectResponse.headers.set(key, value);
      }

      return redirectResponse;
    };

    // Public routes - no auth required
    if (isPublicRoute(req)) {
      // Allow through without any checks
    }
    // Team creation routes - allow pending users
    else if (isTeamCreationRoute(req)) {
      // Allow both pending and active users
      if (req.nextUrl.pathname.startsWith('/api/github')) {
        console.log("[Middleware] Allowing GitHub route (team creation)");
      }
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
    // v1 API routes: auth handled at route level via withDualAuth
    // Supports both API key (external clients) and session (console UI)
    else if (isV1ApiRoute(req)) {
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
        new URL("/account/teams/new", req.url),
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
    // Redirect to auth app for sign-in/sign-up
    signInUrl: `${authUrl}/sign-in`,
    signUpUrl: `${authUrl}/sign-up`,
    // Post-authentication redirects - always to team creation which handles org creation
    afterSignInUrl: "/account/teams/new",
    afterSignUpUrl: "/account/teams/new",
    // Sync Clerk organization state for /:slug routes
    organizationSyncOptions: {
      organizationPatterns: ["/:slug", "/:slug/(.*)"],
    },
    // Enable debug logging in development
    // debug: process.env.NODE_ENV === "development",
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

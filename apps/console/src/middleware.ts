import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  composeCspOptions,
  createClerkCspDirectives,
  createAnalyticsCspDirectives,
  createSentryCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import { createNEMO } from "@rescale/nemo";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authUrl } from "~/lib/related-projects";

// Security headers with composable CSP configuration
const securityHeaders = securityMiddleware(
  composeCspOptions(
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
  ),
);

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/robots.txt",
  "/sitemap(.*)",
]);

// Team creation routes - accessible to pending users (authenticated but no org claimed)
// Includes both page routes and API routes used during team/workspace creation
const isTeamCreationRoute = createRouteMatcher([
  "/account/teams/new", // Team/org creation flow
  "/new(.*)", // Workspace creation flow
  "/api/github(.*)",
  "/api/organizations(.*)",
]);

// User-scoped tRPC endpoint - accessible to pending users
const isUserScopedRoute = createRouteMatcher([
  "/api/trpc/user(.*)",  // All procedures under /api/trpc/user/*
]);

// Org-scoped tRPC endpoint - requires active org
const isOrgScopedRoute = createRouteMatcher([
  "/api/trpc/org(.*)",   // All procedures under /api/trpc/org/*
]);

/**
 * Custom middleware for console-specific logic
 * Can be extended with rate limiting, analytics, logging, etc.
 */
const consoleMiddleware = (_request: NextRequest) => {
  // Future: Add console-specific middleware here
  // - Rate limiting for API routes
  // - Analytics tracking
  // - Custom logging
  return NextResponse.next();
};

/**
 * Compose middleware with NEMO
 * Execution order: consoleMiddleware runs before the auth check
 */
const composedMiddleware = createNEMO(
  {},
  {
    before: [consoleMiddleware],
  },
);

// Protected routes (not listed above) include:
// - /:slug/* - Organization-specific pages (settings, repositories, etc.)
// - /account/settings/* - Personal account settings (profile, integrations, API keys)
// - /api/trpc/* - tRPC API routes
export default clerkMiddleware(
  async (auth, req: NextRequest, event) => {
    // Single auth check - detect both pending and active users
    const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
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

    // User-scoped tRPC routes: allow both pending and active users
    if (isUserScopedRoute(req)) {
      const { userId } = await auth({ treatPendingAsSignedOut: false });
      if (!userId) {
        // Unauthenticated - the tRPC procedure will handle this
        // Let request through to get proper tRPC error
      }
      // Allow both pending and active users to proceed
      // Authorization happens at procedure level
    }
    // Org-scoped tRPC routes: require active org
    else if (isOrgScopedRoute(req)) {
      await auth.protect(); // Requires active org
    }
    // Redirect pending users to team creation (unless on allowed routes)
    else if (
      isPending &&
      !isTeamCreationRoute(req) &&
      !isPublicRoute(req)
    ) {
      return await createRedirectResponse(
        new URL("/account/teams/new", req.url),
      );
    }
    // Protect all other routes except public and team creation
    else if (
      !isPublicRoute(req) &&
      !isTeamCreationRoute(req)
    ) {
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
    //    debug: process.env.NODE_ENV === "development",
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

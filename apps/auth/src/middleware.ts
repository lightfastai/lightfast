import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
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
import { consoleUrl } from "~/lib/related-projects";

// Security headers with composable CSP configuration
const securityHeaders = securityMiddleware(
  composeCspOptions(
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
  ),
);

/**
 * Custom middleware for auth-specific logic
 * Handles CORS for cross-origin authentication
 */
const authMiddleware = (_request: NextRequest) => {
  // Future: Add auth-specific middleware here
  // - Rate limiting for sign-in attempts
  // - Custom analytics for auth events
  // - Fraud detection
  return NextResponse.next();
};

/**
 * Compose middleware with NEMO
 * Execution order: authMiddleware runs before the auth check
 */
const composedMiddleware = createNEMO(
  {},
  {
    before: [authMiddleware],
  },
);

// Define public routes that don't need authentication
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

// Define auth routes that authenticated users with orgs should be redirected away from
const isAuthRoute = createRouteMatcher(["/sign-in", "/sign-up"]);

const isRootPath = createRouteMatcher(["/"]);

export default clerkMiddleware(
  async (auth, req: NextRequest, event) => {
    // Handle CORS preflight requests
    const preflightResponse = handleCorsPreflightRequest(req);
    if (preflightResponse) return preflightResponse;

    // Single auth check - detect both pending and active users
    // Pending = authenticated but no org (hasn't completed choose-organization task)
    // Active = authenticated with org (completed all tasks)
    const { userId, orgId, orgSlug } = await auth({
      treatPendingAsSignedOut: false,
    });
    const isPending = Boolean(userId && !orgId);
    const isActive = Boolean(userId && orgId);
    // Helper to apply headers and return redirect
    const createRedirectResponse = async (url: URL) => {
      const redirectResponse = NextResponse.redirect(url);
      const headersResponse = await securityHeaders();

      // Apply security headers to redirect
      for (const [key, value] of headersResponse.headers.entries()) {
        redirectResponse.headers.set(key, value);
      }

      return applyCorsHeaders(redirectResponse, req);
    };

    // UX improvement: redirect authenticated users away from auth pages
    if ((isPending || isActive) && isAuthRoute(req)) {
      if (isPending) {
        return await createRedirectResponse(
          new URL("/account/teams/new", consoleUrl),
        );
      }
      if (isActive && orgSlug) {
        return await createRedirectResponse(
          new URL(`/org/${orgSlug}`, consoleUrl),
        );
      }
    }

    // Root path routing
    if (isRootPath(req)) {
      if (!userId) {
        // Not signed in → sign-in page
        return await createRedirectResponse(new URL("/sign-in", req.url));
      }
      if (isPending) {
        // Signed in but no org → team creation
        return await createRedirectResponse(
          new URL("/account/teams/new", consoleUrl),
        );
      }
      if (isActive && orgSlug) {
        // Signed in with org → org dashboard
        return await createRedirectResponse(
          new URL(`/org/${orgSlug}`, consoleUrl),
        );
      }
    }

    // Protect non-public routes (will redirect to sign-in if needed)
    if (!isPublicRoute(req)) {
      await auth.protect();
    }

    // Run security headers first
    const headersResponse = await securityHeaders();

    // Then run composed middleware
    const middlewareResponse = await composedMiddleware(req, event);

    // Apply CORS headers to final response
    const finalResponse = applyCorsHeaders(middlewareResponse, req);

    // Apply security headers to final response
    for (const [key, value] of headersResponse.headers.entries()) {
      finalResponse.headers.set(key, value);
    }

    return finalResponse;
  },
  {
    // Enable debug logging in development
    // debug: process.env.NODE_ENV === "development",
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

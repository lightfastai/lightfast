import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";
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
import { consoleUrl, authUrl } from "~/lib/related-projects";

// Security headers with composable CSP configuration
const securityHeaders = securityMiddleware(
  composeCspOptions(
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
  ),
);

/**
 * Custom middleware for www-specific logic
 * Can be extended with analytics, rate limiting, etc.
 */
const wwwMiddleware = (_request: NextRequest) => {
  // Future: Add www-specific middleware here
  // - Analytics tracking for marketing pages
  // - A/B testing
  // - Custom redirects
  return NextResponse.next();
};

/**
 * Compose middleware with NEMO
 * Execution order: wwwMiddleware runs before the auth check
 */
const composedMiddleware = createNEMO(
  {},
  {
    before: [wwwMiddleware],
  }
);

/**
 * Routes that authenticated users can still access
 * (won't trigger redirect to console)
 * All other routes redirect authenticated users to the console app
 */
const isAllowedForAuthenticatedUsers = createRouteMatcher([
  "/legal(.*)",
  "/api(.*)",
  "/robots.txt",
  "/sitemap(.*)",
  "/favicon.ico",
  "/manifest.json",
]);

export default clerkMiddleware(
  async (auth, req: NextRequest, event) => {
    // Check if user is authenticated
    const { userId } = await auth();

    // Create base response
    let response = NextResponse.next();

    /**
     * Redirect authenticated users to console app
     * Exception: legal pages and API routes
     */
    if (userId && !isAllowedForAuthenticatedUsers(req)) {
      response = NextResponse.redirect(new URL(consoleUrl));
    }

    // Run security headers first
    const headersResponse = await securityHeaders();

    // Then run composed middleware
    const middlewareResponse = await composedMiddleware(req, event);

    // Apply security headers to final response
    const finalResponse = middlewareResponse ?? response;
    for (const [key, value] of headersResponse.headers.entries()) {
      finalResponse.headers.set(key, value);
    }

    return finalResponse;
  },
  {
    // Point to auth app for sign-in/sign-up
    signInUrl: `${authUrl}/sign-in`,
    signUpUrl: `${authUrl}/sign-up`,
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

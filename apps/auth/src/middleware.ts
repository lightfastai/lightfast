import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  composeCspOptions,
  createClerkCspDirectives,
  createAnalyticsCspDirectives,
  createSentryCspDirectives,
  createNextjsCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import { createNEMO } from "@rescale/nemo";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { consoleUrl } from "~/lib/related-projects";

// =============================================================================
// Security Headers
// =============================================================================

const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
  ),
);

async function withSecurityHeaders(
  response: NextResponse,
): Promise<NextResponse> {
  const headers = await securityHeaders();
  for (const [key, value] of headers.headers.entries()) {
    response.headers.set(key, value);
  }
  return response;
}

async function secureRedirect(url: URL | string): Promise<NextResponse> {
  return withSecurityHeaders(NextResponse.redirect(url));
}

// =============================================================================
// Route Matchers
// =============================================================================

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-in/sso-callback",
  "/sign-up",
  "/sign-up/sso-callback",
  "/api/health",
]);

const isAuthRoute = createRouteMatcher(["/sign-in", "/sign-up"]);
const isRootPath = createRouteMatcher(["/"]);

// =============================================================================
// NEMO Composition
// =============================================================================

const composedMiddleware = createNEMO(
  {},
  {
    before: [
      // Future: Add auth-specific middleware here
      // - Rate limiting for sign-in attempts
      // - Custom analytics for auth events
      // - Fraud detection
    ],
  },
);

// =============================================================================
// Main Middleware
// =============================================================================

export default clerkMiddleware(
  async (auth, req: NextRequest, event: NextFetchEvent) => {
    const { userId, orgId, orgSlug } = await auth({
      treatPendingAsSignedOut: false,
    });
    const isPending = Boolean(userId && !orgId);
    const isActive = Boolean(userId && orgId);

    // -------------------------------------------------------------------------
    // 1. Redirect authenticated users away from auth pages
    // -------------------------------------------------------------------------
    if ((isPending || isActive) && isAuthRoute(req)) {
      if (isPending) {
        return secureRedirect(new URL("/account/teams/new", consoleUrl));
      }
      if (isActive && orgSlug) {
        return secureRedirect(new URL(`/${orgSlug}`, consoleUrl));
      }
    }

    // -------------------------------------------------------------------------
    // 2. Root path routing
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // 3. Protect non-public routes
    // -------------------------------------------------------------------------
    if (!isPublicRoute(req)) {
      await auth.protect();
    }

    // -------------------------------------------------------------------------
    // 4. Run NEMO middleware chain (rate limiting, analytics, etc.)
    // -------------------------------------------------------------------------
    const nemoResponse = await composedMiddleware(req, event);

    // -------------------------------------------------------------------------
    // 5. Return with security headers
    // -------------------------------------------------------------------------
    return withSecurityHeaders(
      (nemoResponse as NextResponse | null) ?? NextResponse.next(),
    );
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

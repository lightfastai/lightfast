import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";
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
import { authUrl } from "~/lib/related-projects";

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

const isRootPath = createRouteMatcher(["/"]);

const isAllowedForAuthenticatedUsers = createRouteMatcher([
  "/legal(.*)",
  "/api(.*)",
]);

// =============================================================================
// NEMO Composition
// =============================================================================

/**
 * Custom middleware for www-specific logic
 * Sets x-pathname header for SSR components
 */
const wwwMiddleware = (request: NextRequest) => {
  const response = NextResponse.next();
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
};

const composedMiddleware = createNEMO(
  {},
  {
    before: [wwwMiddleware],
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

    // -------------------------------------------------------------------------
    // 1. Redirect authenticated users from root to sign-in (which routes them)
    // -------------------------------------------------------------------------
    if (userId && isRootPath(req)) {
      return secureRedirect(new URL("/sign-in", authUrl));
    }

    // -------------------------------------------------------------------------
    // 2. Redirect authenticated users from marketing pages to sign-in
    // -------------------------------------------------------------------------
    if (userId && !isAllowedForAuthenticatedUsers(req)) {
      return secureRedirect(new URL("/sign-in", authUrl));
    }

    // -------------------------------------------------------------------------
    // 3. Run NEMO middleware chain (sets x-pathname, etc.)
    // -------------------------------------------------------------------------
    const nemoResponse = await composedMiddleware(req, event);

    // -------------------------------------------------------------------------
    // 4. Return with security headers
    // -------------------------------------------------------------------------
    return withSecurityHeaders(
      (nemoResponse as NextResponse | null) ?? NextResponse.next(),
    );
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

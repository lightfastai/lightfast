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

// =============================================================================
// Security Headers
// =============================================================================

const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(), // Keep for other apps in microfrontends
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
    // UnicornStudio
    {
      scriptSrc: ["https://cdn.jsdelivr.net"],
      connectSrc: ["https://assets.unicorn.studio"],
      imgSrc: ["https://assets.unicorn.studio"],
    },
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

export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  // Run NEMO middleware chain (sets x-pathname, etc.)
  const nemoResponse = await composedMiddleware(req, event);

  // Return with security headers
  return withSecurityHeaders(
    (nemoResponse as NextResponse | null) ?? NextResponse.next(),
  );
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

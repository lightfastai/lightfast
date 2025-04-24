import { NextRequest, NextResponse } from "next/server";

import { withRequestId } from "@vendor/security/requests/with-request-id-middleware";

export const middleware = async (request: NextRequest) => {
  const requestWithId = await withRequestId(request);
  return NextResponse.next({
    request: requestWithId,
  });
};

/**
 * Default matcher configuration for the request ID middleware
 * Excludes static files, includes API routes, and excludes Sentry monitoring tunnel
 */
export const defaultRequestIdMatcher = [
  // Skip Next.js internals, static files, and Sentry monitoring tunnel
  "/((?!_next|monitoring-tunnel|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  // Always run for API routes
  "/(api)(.*)",
];

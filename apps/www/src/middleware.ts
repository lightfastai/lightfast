import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { log } from "@vendor/observability/log";

import {
  generateSignedRequestId,
  REQUEST_ID_HEADER,
} from "./lib/requests/request-id";

/**
 * Middleware to handle request ID generation and protected routes
 */
export const middleware = async (request: NextRequest) => {
  // Generate a new request ID for all requests if one doesn't exist
  const existingRequestId = request.headers.get(REQUEST_ID_HEADER);
  const requestId = existingRequestId ?? (await generateSignedRequestId(log));

  // Clone the request headers and set the request ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  // Return response with both request and response headers set
  return NextResponse.next({
    request: {
      // New request headers
      headers: requestHeaders,
    },
    headers: {
      // Also set response header for consistency
      [REQUEST_ID_HEADER]: requestId,
    },
  });
};

export const config = {
  matcher: [
    // Skip Next.js internals, Inngest webhooks, and all static files
    "/((?!_next|monitoring-tunnel|api/inngest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes except Inngest
    "/(api(?!/inngest)|trpc)(.*)",
  ],
};

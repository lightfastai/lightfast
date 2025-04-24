import { NextRequest } from "next/server";

import {
  REQUEST_ID_HEADER,
  setRequestIdCookie,
  withRequestId,
} from "@vendor/security/requests";

/**
 * Paths that are public and don't require request ID validation
 * but will still receive a new request ID for tracking
 */
const PUBLIC_PATHS = [
  "/api/health", // Health check endpoints
  "/legal/terms", // Legal pages (terms, privacy, etc)
  "/legal/privacy",
  "/",
] as const;

/**
 * Paths that require valid request IDs
 * These endpoints will reject requests with missing or invalid request IDs
 */
const PROTECTED_PATHS = [
  "/api/early-access", //Early access signup endpoints
] as const;

export const middleware = async (request: NextRequest) => {
  // Get response with request ID handling
  const response = await withRequestId(request, {
    publicPaths: PUBLIC_PATHS,
    protectedPaths: PROTECTED_PATHS,
  });

  // Check if this is an error response from request ID validation
  // If status code is 400 or 401, it's an error response from withRequestId
  if (response.status === 400 || response.status === 401) {
    // Return the error response directly without modification
    return response;
  }

  // For successful responses, set the request ID cookie if present
  const requestId = response.headers.get(REQUEST_ID_HEADER);
  if (requestId) {
    setRequestIdCookie(response, requestId);
  }

  return response;
};

export const config = {
  matcher: [
    // Skip Next.js internals, Inngest webhooks, and all static files
    "/((?!_next|monitoring-tunnel|api/inngest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes except Inngest
    "/(api(?!/inngest)|trpc)(.*)",
  ],
};

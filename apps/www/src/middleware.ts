import { NextRequest, NextResponse } from "next/server";

import { withRequestId } from "@vendor/security/requests/with-request-id-middleware";

/**
 * Paths that are public and don't require request ID validation
 * but will still receive a new request ID for tracking
 */
const PUBLIC_PATHS = [
  "/api/health", // Health check endpoints
  "/legal", // Legal pages (terms, privacy, etc)
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
  const requestWithId = await withRequestId(request, {
    publicPaths: PUBLIC_PATHS,
    protectedPaths: PROTECTED_PATHS,
  });

  return NextResponse.next({
    request: requestWithId,
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

import type { NextRequest } from "next/server";

import {
  REQUEST_ID_HEADER,
  RequestIdError,
  RequestIdErrorType,
  setRequestIdCookie,
  withRequestIdSafe,
} from "@vendor/security/requests";

import { reportApiError } from "~/lib/error-reporting/api-error-reporter";

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
  // Get response with request ID handling using the safe implementation
  const result = await withRequestIdSafe(request, {
    publicPaths: PUBLIC_PATHS,
    protectedPaths: PROTECTED_PATHS,
  });

  return result.match(
    // Success case - return the response with cookie set
    (data) => {
      const { response, newRequestId } = data;

      // Set the request ID cookie if a new ID was generated
      if (newRequestId) {
        setRequestIdCookie(response, newRequestId);
      } else {
        // For existing request IDs that were validated successfully
        const requestId = response.headers.get(REQUEST_ID_HEADER);
        if (requestId) {
          setRequestIdCookie(response, requestId);
        }
      }

      return response;
    },

    // Error case - handle and report the error
    async (error) => {
      // Extract relevant error information
      const errorType =
        error instanceof RequestIdError
          ? error.type
          : RequestIdErrorType.INVALID_FORMAT;

      const statusCode =
        error instanceof RequestIdError ? error.statusCode : 500;

      const errorMessage = error.message || "Request ID validation failed";

      // Get a request ID for reporting, use "unknown" as fallback
      const requestId = "unknown";

      // Report the error directly using the RequestIdErrorType
      await reportApiError(error, {
        route: request.nextUrl.pathname,
        errorType: errorType, // Use RequestIdErrorType directly
        requestId,
        error: error.name || "Request ID validation error",
        message: errorMessage,
      });

      // Return an error response
      return new Response(
        JSON.stringify({
          type: errorType,
          error: error.name,
          message: errorMessage,
        }),
        {
          status: statusCode,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    },
  );
};

export const config = {
  matcher: [
    // Skip Next.js internals, Inngest webhooks, and all static files
    "/((?!_next|monitoring-tunnel|api/inngest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes except Inngest
    "/(api(?!/inngest)|trpc)(.*)",
  ],
};

import type { NextRequest } from "next/server";

import {
  REQUEST_ID_HEADER,
  RequestIdErrorType,
  setRequestIdCookie,
  withRequestId,
} from "@vendor/security/requests";

import { EarlyAccessErrorType } from "~/components/early-access/errors";
import { reportApiError } from "~/lib/error-reporting/api-error-reporter";

/**
 * Maps request ID error types to early access error types
 * for compatibility with the error reporting system
 */
const errorTypeMap: Record<RequestIdErrorType, EarlyAccessErrorType> = {
  [RequestIdErrorType.MISSING]: EarlyAccessErrorType.NO_REQUEST_ID,
  [RequestIdErrorType.INVALID_FORMAT]: EarlyAccessErrorType.INVALID_REQUEST_ID,
  [RequestIdErrorType.EXPIRED]: EarlyAccessErrorType.INVALID_REQUEST_ID,
  [RequestIdErrorType.INVALID_CONTEXT]: EarlyAccessErrorType.INVALID_REQUEST_ID,
  [RequestIdErrorType.INVALID_SIGNATURE]:
    EarlyAccessErrorType.INVALID_REQUEST_ID,
};

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
  try {
    // Get response with request ID handling
    const response = await withRequestId(request, {
      publicPaths: PUBLIC_PATHS,
      protectedPaths: PROTECTED_PATHS,
    });

    // Check if this is an error response from request ID validation
    // If status code is 400 or 401, it's an error response from withRequestId
    if (response.status === 400 || response.status === 401) {
      // Extract error information for reporting
      try {
        const errorBody = await response.clone().json();

        // Report error to Sentry
        if (errorBody?.type) {
          const requestIdErrorType = errorBody.type as RequestIdErrorType;
          const errorMessage =
            errorBody.message || "Request ID validation failed";

          // Map to early access error type for compatibility with error reporting
          const errorType =
            errorTypeMap[requestIdErrorType] ||
            EarlyAccessErrorType.INTERNAL_SERVER_ERROR;

          // Create an error object for reporting
          const validationError = new Error(errorMessage);
          validationError.name = requestIdErrorType;

          // Get the request ID from the response (for generating a new Sentry event)
          const requestId =
            response.headers.get(REQUEST_ID_HEADER) || "unknown";

          // Report the error
          await reportApiError(validationError, {
            route: request.nextUrl.pathname,
            errorType,
            requestId,
            error: errorBody.error || "Request ID validation error",
            message: errorMessage,
          });
        }
      } catch (reportingError) {
        // Silent failure for error reporting issues
        console.error(
          "Failed to report request ID validation error:",
          reportingError,
        );
      }

      // Return the error response directly without modification
      return response;
    }

    // For successful responses, set the request ID cookie if present
    const requestId = response.headers.get(REQUEST_ID_HEADER);
    if (requestId) {
      setRequestIdCookie(response, requestId);
    }

    return response;
  } catch (error) {
    // Handle unexpected errors in the middleware itself
    console.error("Unexpected error in request ID middleware:", error);

    // Report the error with a fallback request ID
    const requestId =
      request.headers.get(REQUEST_ID_HEADER) ?? "middleware_error";
    await reportApiError(
      error instanceof Error ? error : new Error("Unknown middleware error"),
      {
        route: request.nextUrl.pathname,
        errorType: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        requestId,
        error: "Middleware failure",
        message: "An unexpected error occurred in the request ID middleware",
      },
    );

    // Return a generic error response
    return new Response(
      JSON.stringify({
        type: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        error: "Internal server error",
        message: "An unexpected error occurred processing your request",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};

export const config = {
  matcher: [
    // Skip Next.js internals, Inngest webhooks, and all static files
    "/((?!_next|monitoring-tunnel|api/inngest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes except Inngest
    "/(api(?!/inngest)|trpc)(.*)",
  ],
};

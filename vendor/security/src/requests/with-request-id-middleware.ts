import { NextRequest, NextResponse } from "next/server";

import type { RequestContext } from "./create-secure-request-id";
import { secureApiRequestEnv } from "../../env";
import { REQUEST_ID_HEADER } from "./constants";
import { SecureRequestId } from "./create-secure-request-id";

/**
 * Error types for request ID validation failures
 */
export enum RequestIdErrorType {
  MISSING = "MISSING_REQUEST_ID",
  INVALID_FORMAT = "INVALID_REQUEST_ID_FORMAT",
  EXPIRED = "EXPIRED_REQUEST_ID",
  INVALID_CONTEXT = "INVALID_REQUEST_CONTEXT",
  INVALID_SIGNATURE = "INVALID_REQUEST_SIGNATURE",
}

export interface RequestIdPathConfig {
  publicPaths: readonly string[];
  protectedPaths: readonly string[];
}

export async function withRequestId(
  request: NextRequest,
  pathConfig: RequestIdPathConfig,
) {
  const requestContext: RequestContext = {
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };

  // 1. Check if this is a path that needs request ID handling
  const isPublicPath = pathConfig.publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  const isProtectedPath = pathConfig.protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!isProtectedPath && !isPublicPath) {
    // Regular page load or static asset - generate new ID if needed
    const existingRequestId = request.headers.get(REQUEST_ID_HEADER);
    const headers = new Headers(request.headers);

    if (!existingRequestId) {
      headers.set(
        REQUEST_ID_HEADER,
        await SecureRequestId.generate(requestContext),
      );
    }

    return NextResponse.next({
      request: {
        ...request,
        headers,
      },
    });
  }

  // 2. Handle protected paths
  if (isProtectedPath) {
    const existingRequestId = request.headers.get(REQUEST_ID_HEADER);
    // No request ID for protected path
    if (!existingRequestId) {
      return new NextResponse(
        JSON.stringify({
          type: RequestIdErrorType.MISSING,
          error: "Missing request ID",
          message: "This endpoint requires a valid request ID",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            // Generate one anyway to help client fix their request
            [REQUEST_ID_HEADER]: await SecureRequestId.generate(requestContext),
          },
        },
      );
    }

    // Check if request ID has valid structure before full verification
    const parsed = SecureRequestId.parse(existingRequestId);
    if (!parsed) {
      // Malformed request ID - generate a new one
      const newRequestId = await SecureRequestId.generate(requestContext);
      return new NextResponse(
        JSON.stringify({
          type: RequestIdErrorType.INVALID_FORMAT,
          error: "Malformed request ID",
          message: "The provided request ID has an invalid format",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            [REQUEST_ID_HEADER]: newRequestId,
          },
        },
      );
    }

    // Check if request ID is expired
    const isExpired = SecureRequestId.isExpired(existingRequestId);

    // If expired and auto-refresh is enabled, handle immediately
    if (isExpired && secureApiRequestEnv.AUTO_REFRESH_EXPIRED_IDS) {
      // First verify signature to ensure this is a legitimate request ID (prevent forgery)
      const isValidSignature = await SecureRequestId.verifySignature(
        existingRequestId,
        requestContext,
      );

      if (isValidSignature) {
        // Valid signature but expired - generate a new one and continue
        // This auto-refresh mechanism prevents users from encountering expired request ID errors
        // when they stay on the site for longer than the MAX_AGE period (5 minutes)
        const headers = new Headers(request.headers);
        const newRequestId = await SecureRequestId.generate(requestContext);
        headers.set(REQUEST_ID_HEADER, newRequestId);

        return NextResponse.next({
          request: {
            ...request,
            headers,
          },
        });
      }
    }

    // If expired and auto-refresh is disabled, return a clear error
    if (isExpired && !secureApiRequestEnv.AUTO_REFRESH_EXPIRED_IDS) {
      return new NextResponse(
        JSON.stringify({
          type: RequestIdErrorType.EXPIRED,
          error: "Expired request ID",
          message: "The request ID has expired",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            [REQUEST_ID_HEADER]: await SecureRequestId.generate(requestContext),
          },
        },
      );
    }

    // Verify context matches
    const isValidContext = await SecureRequestId.verifyContext(
      existingRequestId,
      requestContext,
    );

    if (!isValidContext) {
      // Context mismatch - likely a replayed request
      return new NextResponse(
        JSON.stringify({
          type: RequestIdErrorType.INVALID_CONTEXT,
          error: "Invalid request context",
          message: "The request ID is not valid for this request context",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            [REQUEST_ID_HEADER]: await SecureRequestId.generate(requestContext),
          },
        },
      );
    }

    // Verify signature only
    const isValidSignature = await SecureRequestId.verifySignature(
      existingRequestId,
      requestContext,
    );

    if (!isValidSignature) {
      // Invalid signature - potential tampering
      return new NextResponse(
        JSON.stringify({
          type: RequestIdErrorType.INVALID_SIGNATURE,
          error: "Invalid signature",
          message: "The request ID signature is invalid",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            [REQUEST_ID_HEADER]: await SecureRequestId.generate(requestContext),
          },
        },
      );
    }

    // Valid request ID - proceed with existing headers
    const headers = new Headers(request.headers);
    return NextResponse.next({
      request: {
        ...request,
        headers,
      },
    });
  }

  // 3. Handle public paths - always generate new ID
  const headers = new Headers(request.headers);
  headers.set(
    REQUEST_ID_HEADER,
    await SecureRequestId.generate(requestContext),
  );

  return NextResponse.next({
    request: {
      ...request,
      headers,
    },
  });
}

/**
 * Default matcher configuration for the request ID middleware
 * Excludes static files and includes API routes
 */
export const defaultRequestIdMatcher = [
  // Skip Next.js internals and static files
  "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  // Always run for API routes
  "/(api|trpc)(.*)",
] as const;

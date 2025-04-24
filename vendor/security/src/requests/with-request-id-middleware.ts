import { NextRequest, NextResponse } from "next/server";

import type { RequestContext } from "./create-secure-request-id";
import { REQUEST_ID_HEADER } from "./constants";
import { SecureRequestId } from "./create-secure-request-id";

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
          type: "NO_REQUEST_ID",
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
          type: "INVALID_REQUEST_ID_FORMAT",
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
    const isExpired = Date.now() - parsed.timestamp > SecureRequestId.MAX_AGE;

    // Validate the request ID signature (even if expired)
    const isValidSignature = await SecureRequestId.verifySignature(
      existingRequestId,
      requestContext,
    );

    if (!isValidSignature) {
      // Invalid signature - potential tampering
      return new NextResponse(
        JSON.stringify({
          type: "INVALID_REQUEST_ID",
          error: "Invalid request ID",
          message: "The provided request ID is invalid",
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

    if (isExpired) {
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

import { NextRequest } from "next/server";

import type { RequestContext } from "./create-secure-request-id";
import { REQUEST_ID_HEADER } from "./constants";
import { SecureRequestId } from "./create-secure-request-id";

export async function withRequestId(request: NextRequest) {
  const requestContext: RequestContext = {
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };

  const existingRequestId = request.headers.get(REQUEST_ID_HEADER);
  const headers = new Headers(request.headers);

  if (existingRequestId) {
    // Verify existing request ID
    const isValid = await SecureRequestId.verify(
      existingRequestId,
      requestContext,
    );
    if (!isValid) {
      // Invalid or tampered request ID, create new one
      headers.set(
        REQUEST_ID_HEADER,
        await SecureRequestId.generate(requestContext),
      );
    }
  } else {
    // No request ID, create new one
    headers.set(
      REQUEST_ID_HEADER,
      await SecureRequestId.generate(requestContext),
    );
  }

  // Clone the request with updated headers
  return new NextRequest(request.url, {
    ...request,
    headers,
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
];

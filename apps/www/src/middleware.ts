import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { REQUEST_ID_HEADER } from "./lib/requests/request-id";

/**
 * Validates if the origin is from the same site as the host
 */
const isSameOrigin = (origin: string | null, host: string | null): boolean => {
  if (!origin || !host) return false;

  try {
    // Parse the origin into its components
    const originUrl = new URL(origin);

    // Compare the hostname (this handles subdomains correctly)
    // We want exact domain match, not partial match
    const originHostname = originUrl.hostname;

    // Remove port from host if present
    const hostName = host.split(":")[0];

    return originHostname === hostName;
  } catch {
    // If URL parsing fails, consider it invalid
    return false;
  }
};

/**
 * Middleware to handle request ID generation and protected routes
 */
export const middleware = (request: NextRequest) => {
  const response = NextResponse.next();

  // Generate a new request ID for all requests if one doesn't exist
  const existingRequestId = request.headers.get(REQUEST_ID_HEADER);
  if (!existingRequestId) {
    const newRequestId = nanoid();
    response.headers.set(REQUEST_ID_HEADER, newRequestId);
  }

  // Protect /api/early-access endpoint with same-site origin check
  if (request.nextUrl.pathname === "/api/early-access") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    // Check if the request is from the same origin
    if (!isSameOrigin(origin, host)) {
      return new Response("Access denied", {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
        statusText: "Forbidden: Cross-origin request denied",
      });
    }
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

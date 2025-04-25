import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { log } from "@vendor/observability/log";

import type { NextErrorResponse } from "~/components/early-access/errors";
import { EarlyAccessErrorType } from "~/components/early-access/errors";
import {
  generateSignedRequestId,
  REQUEST_ID_HEADER,
} from "./lib/requests/request-id";

/**
 * Validates if the origin is from the same site as the host
 */
const isSameOrigin = (origin: string | null, host: string | null): boolean => {
  if (!origin || !host) {
    log.error("Debug: Missing origin or host", { origin, host });
    return false;
  }

  try {
    // Parse the origin into its components
    const originUrl = new URL(origin);

    // Compare the hostname (this handles subdomains correctly)
    // We want exact domain match, not partial match
    const originHostname = originUrl.hostname;

    // Remove port from host if present
    const hostName = host.split(":")[0];

    log.info("Debug: Origin check", {
      originHostname,
      hostName,
      matches: originHostname === hostName,
    });

    return originHostname === hostName;
  } catch (error) {
    log.error("Debug: URL parsing error", { error, origin });
    // If URL parsing fails, consider it invalid
    return false;
  }
};

/**
 * Middleware to handle request ID generation and protected routes
 */
export const middleware = async (request: NextRequest) => {
  const response = NextResponse.next();

  // Generate a new request ID for all requests if one doesn't exist
  const existingRequestId = request.headers.get(REQUEST_ID_HEADER);
  const requestId = existingRequestId ?? (await generateSignedRequestId());
  response.headers.set(REQUEST_ID_HEADER, requestId);

  // Protect /api/early-access endpoint with same-site origin check
  if (request.nextUrl.pathname.startsWith("/api/early-access/create")) {
    log.info("Debug: Checking early access endpoint");
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    log.info("Debug: Request details", {
      pathname: request.nextUrl.pathname,
      origin,
      host,
    });

    // Check if the request is from the same origin
    if (!isSameOrigin(origin, host)) {
      log.info("Debug: Origin check failed");
      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.SECURITY_CHECK,
          error: "Cross-origin request denied",
          message: "Security check failed. Please try again.",
        },
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            [REQUEST_ID_HEADER]: requestId,
          },
        },
      );
    }
    log.info("Debug: Origin check passed");
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

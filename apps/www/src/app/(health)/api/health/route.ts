import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { env } from "~/env";

export const runtime = "edge";

/**
 * Health check endpoint for monitoring services like BetterStack.
 *
 * Authentication:
 * - If HEALTH_CHECK_AUTH_TOKEN is set, requires Bearer token authentication
 * - If not set, endpoint is public (for development/testing)
 *
 * BetterStack Configuration:
 * 1. Set HTTP method: GET
 * 2. Add header: Authorization: Bearer <your-token>
 * 3. Optional: Add custom User-Agent header to identify BetterStack
 */
export function GET(request: NextRequest) {
  // Check if authentication is configured
  const authToken = env.HEALTH_CHECK_AUTH_TOKEN;

  if (authToken) {
    // Extract bearer token from Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 },
      );
    }

    // Check for Bearer token format
    const bearerRegex = /^Bearer\s+(.+)$/i;
    const bearerMatch = bearerRegex.exec(authHeader);
    if (!bearerMatch) {
      return NextResponse.json(
        { error: "Invalid authorization format" },
        { status: 401 },
      );
    }

    const providedToken = bearerMatch[1];

    // Constant-time comparison to prevent timing attacks
    const encoder = new TextEncoder();
    const expectedBytes = encoder.encode(authToken);
    const providedBytes = encoder.encode(providedToken);

    if (expectedBytes.length !== providedBytes.length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let valid = true;
    for (let i = 0; i < expectedBytes.length; i++) {
      if (expectedBytes[i] !== providedBytes[i]) {
        valid = false;
      }
    }

    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Log monitoring access for observability (optional)
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const isLikelyBetterStack =
    userAgent.toLowerCase().includes("betterstack") ||
    userAgent.toLowerCase().includes("uptime") ||
    userAgent.toLowerCase().includes("monitor");

  // Return health status
  const response = NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "www",
      environment: env.NODE_ENV,
      // Include additional health checks if needed
      checks: {
        api: "operational",
        // Add database, cache, etc. checks here if needed
      },
      // Only include monitoring info if it looks like a monitoring service
      ...(isLikelyBetterStack && {
        monitor: {
          detected: true,
          userAgent: userAgent.substring(0, 100), // Truncate for security
        },
      }),
    },
    {
      status: 200,
    },
  );

  // Prevent caching of health check responses
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

/**
 * Handle OPTIONS requests for CORS preflight (if needed by monitoring service)
 */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

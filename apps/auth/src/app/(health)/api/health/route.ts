import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";

export const runtime = "edge";

/**
 * Health check endpoint for monitoring services.
 * Requires Bearer token authentication if HEALTH_CHECK_AUTH_TOKEN is set.
 */
export function GET(request: NextRequest) {
  // Check if authentication is configured
  const authToken = env.HEALTH_CHECK_AUTH_TOKEN;
  
  if (authToken) {
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }
    
    const bearerRegex = /^Bearer\s+(.+)$/i;
    const bearerMatch = bearerRegex.exec(authHeader);
    if (!bearerMatch || bearerMatch[1] !== authToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }
  
  const response = NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "auth",
    environment: env.NODE_ENV,
  });
  
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  
  return response;
}

/**
 * Handle OPTIONS requests for CORS preflight (if needed by monitoring service)
 */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Allow": "GET, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}
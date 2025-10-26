import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";

export const runtime = "edge";

/**
 * Health check endpoint for monitoring services.
 * Public endpoint for documentation site - no authentication required.
 */
export function GET(_request: NextRequest) {
  const response = NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "docs",
    environment: env.NODE_ENV,
  });
  
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  
  return response;
}

/**
 * Handle OPTIONS requests for CORS preflight
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
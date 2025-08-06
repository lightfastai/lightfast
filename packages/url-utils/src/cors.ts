import { NextRequest, NextResponse } from "next/server";
import { getAllAppUrls } from "@repo/vercel-config";

export interface CorsConfig {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization", 
    "X-Requested-With",
    "Accept",
    "Origin",
    // Next.js specific headers
    "next-router-prefetch",
    "next-router-state-tree",
    "next-url",
    "rsc",
    "x-invoke-path",
    "x-invoke-query",
    // Vercel specific headers
    "x-deployment-id",
    "x-vercel-id",
    "x-vercel-ip-country",
    "x-vercel-ip-country-region",
    // Custom headers
    "x-request-id",
  ],
  exposedHeaders: [
    "Content-Length",
    "Content-Type",
    "Date",
    "ETag",
    "X-Request-Id",
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Get CORS configuration with allowed origins for all Lightfast apps
 */
export function getCorsConfig(additionalOrigins: string[] = []): CorsConfig {
  const urls = getAllAppUrls();
  
  const allowedOrigins = [
    urls.app,
    urls.www,
    urls.auth,
    // Add common variations
    "https://playground.lightfast.ai",
    "https://app.lightfast.ai",
    "https://www.lightfast.ai",
    "https://auth.lightfast.ai",
    // Development URLs
    "http://localhost:4101", // www
    "http://localhost:4102", // darkarmy
    "http://localhost:4103", // app
    "http://localhost:4104", // auth
    "http://localhost:4105", // playground
    "http://localhost:3000", // common dev port
    "http://localhost:3001",
    "http://localhost:3002",
    ...additionalOrigins,
  ];

  return {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins,
  };
}

/**
 * Apply CORS headers to a response
 */
export function applyCorsHeaders(
  response: NextResponse,
  request: NextRequest,
  config: CorsConfig = getCorsConfig()
): NextResponse {
  const origin = request.headers.get("origin");
  
  // Check if origin is allowed
  const isAllowedOrigin = origin && (
    config.allowedOrigins?.includes(origin) ||
    config.allowedOrigins?.includes("*") ||
    false
  );
  
  if (!isAllowedOrigin) {
    return response;
  }
  
  // Set CORS headers
  response.headers.set("Access-Control-Allow-Origin", origin);
  
  if (config.credentials) {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  
  if (config.allowedMethods?.length) {
    response.headers.set(
      "Access-Control-Allow-Methods",
      config.allowedMethods.join(", ")
    );
  }
  
  if (config.allowedHeaders?.length) {
    response.headers.set(
      "Access-Control-Allow-Headers",
      config.allowedHeaders.join(", ")
    );
  }
  
  if (config.exposedHeaders?.length) {
    response.headers.set(
      "Access-Control-Expose-Headers",
      config.exposedHeaders.join(", ")
    );
  }
  
  if (config.maxAge) {
    response.headers.set("Access-Control-Max-Age", config.maxAge.toString());
  }
  
  return response;
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(
  request: NextRequest,
  config: CorsConfig = getCorsConfig()
): NextResponse | null {
  if (request.method !== "OPTIONS") {
    return null;
  }
  
  const origin = request.headers.get("origin");
  const isAllowedOrigin = origin && (
    config.allowedOrigins?.includes(origin) ||
    config.allowedOrigins?.includes("*") ||
    false
  );
  
  if (!isAllowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }
  
  const response = new NextResponse(null, { status: 200 });
  return applyCorsHeaders(response, request, config);
}

/**
 * Create CORS middleware wrapper
 */
export function withCors(
  handler: (request: NextRequest) => NextResponse | Promise<NextResponse>,
  config: CorsConfig = getCorsConfig()
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Handle preflight
    const preflightResponse = handleCorsPreflightRequest(request, config);
    if (preflightResponse) {
      return preflightResponse;
    }
    
    // Handle actual request
    const response = await handler(request);
    return applyCorsHeaders(response, request, config);
  };
}
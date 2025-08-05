import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig } from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfig = getClerkMiddlewareConfig("app");

// Define protected routes - everything except public routes should require auth
const isPublicRoute = createRouteMatcher([
  "/api/health",
  "/playground",
  "/playground/(.*)",
]);

const isApiRoute = createRouteMatcher(["/api/(.*)"]);

function corsMiddleware(request: NextRequest) {
  // Check if request is from playground
  const origin = request.headers.get("origin");
  const isFromPlayground = origin === "http://localhost:4105";
  
  if (isApiRoute(request) && isFromPlayground) {
    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "http://localhost:4105",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }
  }
  
  return null;
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Handle CORS first
  const corsResponse = corsMiddleware(req);
  if (corsResponse) return corsResponse;

  // If it's not a public route, protect it
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  
  // Add CORS headers to response
  const response = NextResponse.next();
  const origin = req.headers.get("origin");
  
  if (isApiRoute(req) && origin === "http://localhost:4105") {
    response.headers.set("Access-Control-Allow-Origin", "http://localhost:4105");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  
  return response;
}, clerkConfig);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};


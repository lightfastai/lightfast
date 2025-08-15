import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { getClerkMiddlewareConfig } from "@repo/url-utils";

const clerkConfig = getClerkMiddlewareConfig("www");

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/api/health", 
  "/api/early-access/(.*)",
  "/legal/(.*)",
  "/docs",
  "/docs/(.*)"
]);

/**
 * Middleware to handle authentication and protected routes
 */
export const middleware = clerkMiddleware(async (auth, request: NextRequest) => {
  // Handle authentication protection first
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
  
  // Removed redirect for authenticated users on landing page
  // Users can now access the homepage even when logged in

  return NextResponse.next();
}, clerkConfig);

export const config = {
  matcher: [
    // Skip Next.js internals, Inngest webhooks, and all static files
    "/((?!_next|monitoring-tunnel|api/inngest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes except Inngest
    "/(api(?!/inngest)|trpc)(.*)",
  ],
}

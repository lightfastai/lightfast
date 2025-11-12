import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { consoleUrl, authUrl } from "~/lib/related-projects";

// Public routes that don't require authentication checks
const isPublicRoute = createRouteMatcher([
  "/",
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/api/early-access(.*)",
  "/robots.txt",
  "/sitemap(.*)",
  "/legal(.*)",
  "/(.*)",  // Allow all routes on www (it's a marketing site)
]);

export default clerkMiddleware(
  async (auth, req: NextRequest) => {
    // Check if user is authenticated
    const { userId } = await auth();

    // Security headers
    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "origin-when-cross-origin");

    // If user is authenticated and not on a public API route, redirect to console
    if (userId && !req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL(consoleUrl));
    }

    return response;
  },
  {
    // Point to auth app for sign-in/sign-up
    signInUrl: `${authUrl}/sign-in`,
    signUpUrl: `${authUrl}/sign-up`,
    // Enable debug logging in development
    debug: process.env.NODE_ENV === "development",
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

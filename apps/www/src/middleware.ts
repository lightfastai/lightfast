import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { consoleUrl, authUrl } from "~/lib/related-projects";

/**
 * Public routes that don't require authentication.
 * The www app is a public marketing site, so all routes are accessible.
 * However, authenticated users will be redirected to the console app.
 */
const isPublicRoute = createRouteMatcher([
  // Marketing pages
  "/",
  "/features(.*)",
  "/pricing(.*)",
  "/blog(.*)",
  "/changelog(.*)",
  "/integrations(.*)",
  "/use-cases(.*)",
  "/early-access(.*)",
  "/search(.*)",

  // Legal pages (accessible even when authenticated)
  "/legal(.*)",

  // API routes
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/api/early-access(.*)",

  // Static files
  "/robots.txt",
  "/sitemap(.*)",
  "/favicon.ico",
  "/manifest.json",
]);

/**
 * Routes that authenticated users can still access
 * (won't trigger redirect to console)
 */
const isAllowedForAuthenticatedUsers = createRouteMatcher([
  "/legal(.*)",
  "/api(.*)",
  "/robots.txt",
  "/sitemap(.*)",
  "/favicon.ico",
  "/manifest.json",
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

    /**
     * Redirect authenticated users to console app
     * Exception: legal pages and API routes
     */
    if (userId && !isAllowedForAuthenticatedUsers(req)) {
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

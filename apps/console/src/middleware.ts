import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authUrl } from "~/lib/related-projects";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/robots.txt",
  "/sitemap(.*)",
]);

// Onboarding routes - accessible to pending users (authenticated but no org claimed)
// Includes both page routes and API routes used during onboarding
const isOnboardingRoute = createRouteMatcher([
  "/onboarding(.*)",
  "/api/github(.*)",
  "/api/organizations(.*)",
]);
export default clerkMiddleware(
  async (auth, req: NextRequest) => {
    // Single auth check - detect both pending and active users
    const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
    const isPending = Boolean(userId && !orgId);

    // Security headers
    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "origin-when-cross-origin");

    // Redirect pending users to onboarding (unless already there or on public route)
    if (isPending && !isOnboardingRoute(req) && !isPublicRoute(req)) {
      return NextResponse.redirect(new URL("/onboarding/claim-org", req.url));
    }

    // Protect all routes except public and onboarding routes
    // This requires active authentication (pending users will be redirected to sign-in)
    if (!isPublicRoute(req) && !isOnboardingRoute(req)) {
      await auth.protect();
    }

    return response;
  },
  {
    // Redirect to auth app for sign-in/sign-up
    signInUrl: `${authUrl}/sign-in`,
    signUpUrl: `${authUrl}/sign-up`,
    // Post-authentication redirects - always to onboarding which handles org selection
    afterSignInUrl: "/onboarding/claim-org",
    afterSignUpUrl: "/onboarding/claim-org",
    // Sync Clerk organization state for /org/:slug routes
    organizationSyncOptions: {
      organizationPatterns: ["/org/:slug", "/org/:slug/(.*)"],
    },
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

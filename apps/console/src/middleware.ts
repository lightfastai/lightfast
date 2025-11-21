import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { nosecone, defaults } from "@nosecone/next";
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

// Team creation routes - accessible to pending users (authenticated but no org claimed)
// Includes both page routes and API routes used during team/workspace creation
const isTeamCreationRoute = createRouteMatcher([
  "/account/teams/new", // Team/org creation flow
  "/new(.*)", // Workspace creation flow
  "/api/github(.*)",
  "/api/organizations(.*)",
]);

// Protected routes (not listed above) include:
// - /:slug/* - Organization-specific pages (settings, repositories, etc.)
// - /account/settings/* - Personal account settings (profile, integrations, API keys)
// - /api/trpc/* - tRPC API routes
export default clerkMiddleware(
  async (auth, req: NextRequest) => {
    // Single auth check - detect both pending and active users
    const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
    const isPending = Boolean(userId && !orgId);

    // Create base response
    let response = NextResponse.next();

    // Redirect pending users to team creation (unless already there or on public route)
    if (isPending && !isTeamCreationRoute(req) && !isPublicRoute(req)) {
      response = NextResponse.redirect(new URL("/account/teams/new", req.url));
    }

    // Protect all routes except public and team creation routes
    // This requires active authentication (pending users will be redirected to sign-in)
    if (!isPublicRoute(req) && !isTeamCreationRoute(req)) {
      await auth.protect();
    }

    // Apply comprehensive security headers via Nosecone
    // Nosecone provides: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, etc.
    const secureHeaders = nosecone({
      ...defaults,
    });

    // Apply security headers to response
    for (const [key, value] of secureHeaders.entries()) {
      response.headers.set(key, value);
    }

    return response;
  },
  {
    // Redirect to auth app for sign-in/sign-up
    signInUrl: `${authUrl}/sign-in`,
    signUpUrl: `${authUrl}/sign-up`,
    // Post-authentication redirects - always to team creation which handles org creation
    afterSignInUrl: "/account/teams/new",
    afterSignUpUrl: "/account/teams/new",
    // Sync Clerk organization state for /:slug routes
    organizationSyncOptions: {
      organizationPatterns: ["/:slug", "/:slug/(.*)"],
    },
    // Enable debug logging in development
    //    debug: process.env.NODE_ENV === "development",
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

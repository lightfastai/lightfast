import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Create matchers so auth checks stay readable
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isDashboardRoute = createRouteMatcher(["/dashboard", "/dashboard/(.*)"]);
const isProtectedRoute = createRouteMatcher([
  "/((?!sign-in|sign-up|api/health|robots.txt|sitemap|$).*)",
]);

const requiresAuth = (req: NextRequest) =>
  isDashboardRoute(req) || isProtectedRoute(req);

export default clerkMiddleware(
  async (auth, req: NextRequest) => {
    const { userId } = await auth();

    // Add security headers to all responses
    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "origin-when-cross-origin");

    // Redirect authenticated users away from auth pages
    if (userId && isAuthRoute(req)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Protect routes that require authentication
    if (requiresAuth(req)) {
      await auth.protect();
    }

    return response;
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

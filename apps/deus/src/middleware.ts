import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Create matchers so auth checks stay readable
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isPublicRoute = createRouteMatcher([
	"/sign-in(.*)",
	"/sign-up(.*)",
	"/api/health(.*)",
	"/robots.txt",
	"/sitemap(.*)",
]);
// Onboarding routes should be accessible to pending users (authenticated but no org claimed)
// Uses treatPendingAsSignedOut={false} in the layout to allow access
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isDashboardRoute = createRouteMatcher(["/dashboard", "/dashboard/(.*)"]);
const isProtectedRoute = createRouteMatcher([
	"/org(.*)",
	"/app(.*)",
]);

// Require auth protection for routes that need ACTIVE (non-pending) sessions
// Onboarding routes are excluded because they handle pending sessions specially
const requiresAuth = (req: NextRequest) =>
	!isPublicRoute(req) &&
	!isOnboardingRoute(req) &&
	(isDashboardRoute(req) || isProtectedRoute(req));

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
			return NextResponse.redirect(new URL("/app", req.url));
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
		organizationSyncOptions: {
			organizationPatterns: ["/org/:slug", "/org/:slug/(.*)"],
		},
	},
);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

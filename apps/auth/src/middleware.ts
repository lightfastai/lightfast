import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { consoleUrl } from "~/lib/related-projects";


// Define public routes that don't need authentication
const isPublicRoute = createRouteMatcher([
	"/",
	"/sign-in",
	"/sign-in/sso-callback",
	"/sign-up",
	"/sign-up/sso-callback",
	"/api/health",
	"/robots.txt",
	"/sitemap.xml",
]);

// Define auth routes that authenticated users with orgs should be redirected away from
const isAuthRoute = createRouteMatcher([
	"/sign-in",
	"/sign-up",
]);

const isRootPath = createRouteMatcher(["/"]);

export default clerkMiddleware(
	async (auth, req: NextRequest) => {
		// Handle CORS preflight requests
		const preflightResponse = handleCorsPreflightRequest(req);
		if (preflightResponse) return preflightResponse;

		// Single auth check - detect both pending and active users
		// Pending = authenticated but no org (hasn't completed choose-organization task)
		// Active = authenticated with org (completed all tasks)
		const { userId, orgId, orgSlug } = await auth({ treatPendingAsSignedOut: false });
		const isPending = Boolean(userId && !orgId);
		const isActive = Boolean(userId && orgId);

		// UX improvement: redirect authenticated users away from auth pages
		if ((isPending || isActive) && isAuthRoute(req)) {
			// Pending users → onboarding to claim org
			if (isPending) {
				return NextResponse.redirect(new URL("/onboarding/claim-org", consoleUrl));
			}
			// Active users → their org dashboard
			if (isActive && orgSlug) {
				return NextResponse.redirect(new URL(`/org/${orgSlug}`, consoleUrl));
			}
		}

		// Root path routing
		if (isRootPath(req)) {
			if (!userId) {
				// Not signed in → sign-in page
				return NextResponse.redirect(new URL("/sign-in", req.url));
			}
			if (isPending) {
				// Signed in but no org → onboarding
				return NextResponse.redirect(new URL("/onboarding/claim-org", consoleUrl));
			}
			if (isActive && orgSlug) {
				// Signed in with org → org dashboard
				return NextResponse.redirect(new URL(`/org/${orgSlug}`, consoleUrl));
			}
		}

		// Protect non-public routes (will redirect to sign-in if needed)
		if (!isPublicRoute(req)) {
			await auth.protect();
		}

		return applyCorsHeaders(NextResponse.next(), req);
	},
	{
		// Enable debug logging in development
		debug: process.env.NODE_ENV === "development",
	},
);

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

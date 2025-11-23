import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
import { createClerkNoseconeOptions } from "@vendor/security/clerk-nosecone";
import { securityMiddleware } from "@vendor/security/middleware";
import { createNEMO } from "@rescale/nemo";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { consoleUrl } from "~/lib/related-projects";

// Security headers with Clerk CSP configuration
const securityHeaders = securityMiddleware(createClerkNoseconeOptions());

/**
 * Custom middleware for auth-specific logic
 * Handles CORS for cross-origin authentication
 */
const authMiddleware = (_request: NextRequest) => {
  // Future: Add auth-specific middleware here
  // - Rate limiting for sign-in attempts
  // - Custom analytics for auth events
  // - Fraud detection
  return NextResponse.next();
};

/**
 * Compose middleware with NEMO
 * Execution order: authMiddleware runs before the auth check
 */
const composedMiddleware = createNEMO(
  {},
  {
    before: [authMiddleware],
  }
);


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
	async (auth, req: NextRequest, event) => {
		// Handle CORS preflight requests
		const preflightResponse = handleCorsPreflightRequest(req);
		if (preflightResponse) return preflightResponse;

		// Single auth check - detect both pending and active users
		// Pending = authenticated but no org (hasn't completed choose-organization task)
		// Active = authenticated with org (completed all tasks)
		const { userId, orgId, orgSlug } = await auth({ treatPendingAsSignedOut: false });
		const isPending = Boolean(userId && !orgId);
		const isActive = Boolean(userId && orgId);

		// Create base response
		let response = NextResponse.next();

		// UX improvement: redirect authenticated users away from auth pages
		if ((isPending || isActive) && isAuthRoute(req)) {
			// Pending users → team creation to create org
			if (isPending) {
				response = NextResponse.redirect(new URL("/account/teams/new", consoleUrl));
			}
			// Active users → their org dashboard
			else if (isActive && orgSlug) {
				response = NextResponse.redirect(new URL(`/org/${orgSlug}`, consoleUrl));
			}
		}

		// Root path routing
		if (isRootPath(req)) {
			if (!userId) {
				// Not signed in → sign-in page
				response = NextResponse.redirect(new URL("/sign-in", req.url));
			}
			else if (isPending) {
				// Signed in but no org → team creation
				response = NextResponse.redirect(new URL("/account/teams/new", consoleUrl));
			}
			else if (isActive && orgSlug) {
				// Signed in with org → org dashboard
				response = NextResponse.redirect(new URL(`/org/${orgSlug}`, consoleUrl));
			}
		}

		// Protect non-public routes (will redirect to sign-in if needed)
		if (!isPublicRoute(req)) {
			await auth.protect();
		}

		// Run security headers first
		const headersResponse = await securityHeaders();

		// Then run composed middleware
		const middlewareResponse = await composedMiddleware(req, event);

		// Apply CORS headers to final response
		const finalResponse = applyCorsHeaders(middlewareResponse ?? response, req);

		// Apply security headers to final response
		for (const [key, value] of headersResponse.headers.entries()) {
			finalResponse.headers.set(key, value);
		}

		return finalResponse;
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

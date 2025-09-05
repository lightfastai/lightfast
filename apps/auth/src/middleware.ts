import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
	handleCorsPreflightRequest,
	applyCorsHeaders,
} from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define public routes that don't need authentication
const isPublicRoute = createRouteMatcher([
	"/",
	"/sign-in",
	"/sign-in/sso-callback",
	"/sign-up",
	"/sign-up/sso-callback",
	"/select-organization",
	"/api/health",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		return preflightResponse;
	}

	const { userId } = await auth();

	// Handle fully authenticated users
	if (userId) {
		// User is fully authenticated - let them access auth app pages
		// No automatic redirects to external apps
	}

	// For all other cases (including pending sessions with tasks),
	// let Clerk handle routing automatically using taskUrls configuration

	// Redirect unauthenticated users from root to sign-in
	if (req.nextUrl.pathname === "/" && !userId) {
		return NextResponse.redirect(new URL("/sign-in", req.url));
	}

	// Protect all routes except public ones
	if (!isPublicRoute(req)) {
		await auth.protect();
	}

	const response = NextResponse.next();

	// Apply CORS headers to the response
	return applyCorsHeaders(response, req);
});

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

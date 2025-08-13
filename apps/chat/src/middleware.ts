import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
	getClerkMiddlewareConfig,
	handleCorsPreflightRequest,
	applyCorsHeaders,
} from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfig = getClerkMiddlewareConfig("chat");

// Define routes that need protection
// Note: /new and /[sessionId] are NOT here because they're already in (authenticated) route group
// "/" is public, "/api/health" is public, "/api/v/*" is public
const isProtectedRoute = createRouteMatcher([
	// Add any routes that need protection here
	// Currently empty since all our routes are either public or already protected
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		return preflightResponse;
	}

	// Only get auth state when needed for redirects
	if (req.nextUrl.pathname === "/") {
		const { userId } = await auth();
		if (userId) {
			return NextResponse.redirect(new URL("/new", req.url));
		}
	}

	// Only protect routes that explicitly need protection
	if (isProtectedRoute(req)) {
		await auth.protect();
	}

	const response = NextResponse.next();

	// Apply CORS headers to the response
	return applyCorsHeaders(response, req);
}, clerkConfig);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};


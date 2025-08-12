import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
	getClerkMiddlewareConfig,
	handleCorsPreflightRequest,
	applyCorsHeaders,
} from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfig = getClerkMiddlewareConfig("chat");

// Define protected routes - everything except public routes should require auth
const isPublicRoute = createRouteMatcher([
	"/", 
	"/api/health",
	"/api/v/(.*)" // Allow anonymous access to AI API routes
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		return preflightResponse;
	}

	// Get auth state
	const { userId } = await auth();

	// Redirect authenticated users from / to /new
	if (userId && req.nextUrl.pathname === "/") {
		return NextResponse.redirect(new URL("/new", req.url));
	}

	// If it's not a public route, protect it
	if (!isPublicRoute(req)) {
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


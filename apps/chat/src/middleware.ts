import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
	getClerkMiddlewareConfig,
	handleCorsPreflightRequest,
	applyCorsHeaders,
} from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfig = getClerkMiddlewareConfig("chat");

// Define public routes that don't need authentication
const isPublicRoute = createRouteMatcher([
	"/",
	"/api/health",
	"/api/v/(.*)",
	"/sign-in",
	"/sign-in/sso-callback",
	"/sign-up",
	"/sign-up/sso-callback",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		return preflightResponse;
	}

	const { userId } = await auth();

	// Handle redirects for authenticated users only
	if (req.nextUrl.pathname === "/" && userId) {
		return NextResponse.redirect(new URL("/new", req.url));
	}

	// Redirect authenticated users away from auth pages
	if (userId && (req.nextUrl.pathname.startsWith("/sign-in") || req.nextUrl.pathname.startsWith("/sign-up"))) {
		return NextResponse.redirect(new URL("/new", req.url));
	}

	// Protect all routes except public ones
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


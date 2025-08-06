import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig, handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
import { NextResponse } from "next/server";

const clerkConfig = getClerkMiddlewareConfig("auth");

// Define public routes for the auth app
const isPublicRoute = createRouteMatcher([
	"/sign-in",
	"/sign-in/sso-callback",
	"/sign-up",
	"/sign-up/sso-callback",
	"/api/health",
]);

export default clerkMiddleware(async (auth, req) => {
	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		return preflightResponse;
	}
	
	// Handle authentication protection
	if (!isPublicRoute(req)) {
		await auth.protect();
	}

	const { userId } = await auth();
	
	// Create the appropriate response
	let response: NextResponse;
	if (userId) {
		// User is signed in, redirect to app
		const { getAllAppUrls } = await import("@repo/url-utils");
		const urls = getAllAppUrls();
		response = NextResponse.redirect(new URL(urls.app));
	} else if (req.nextUrl.pathname === "/") {
		// Not signed in and at root, redirect to sign-in
		response = NextResponse.redirect(new URL("/sign-in", req.url));
	} else {
		// Continue with the request
		response = NextResponse.next();
	}
	
	// Apply CORS headers to the response
	return applyCorsHeaders(response, req);
}, clerkConfig);

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
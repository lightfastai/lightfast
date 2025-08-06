import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig, handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
import { NextResponse } from "next/server";

// Playground is accessed via app domain, so use app's Clerk config
const clerkConfig = getClerkMiddlewareConfig("app");

// Define public routes
const isPublicRoute = createRouteMatcher([
	"/api/health",
	"/api/agents/(.*)", // Agent routes handle auth internally
	"/api/screenshots", // Screenshots API (handles auth internally)
	"/api/test", // Test route
]);

export default clerkMiddleware(async (auth, req) => {
	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		return preflightResponse;
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
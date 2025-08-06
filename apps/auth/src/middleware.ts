import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getAllAppUrls, getClerkMiddlewareConfig } from "@repo/url-utils";
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
	// Handle CORS headers first for preflight requests
	const origin = req.headers.get("origin");
	const urls = getAllAppUrls();
	
	// List of allowed origins (production and development)
	const allowedOrigins = [
		urls.app,
		urls.www,
		"https://playground.lightfast.ai",
		"http://localhost:4101",
		"http://localhost:4103", 
		"http://localhost:4105",
	];
	
	// Check if origin is allowed
	const isAllowedOrigin = origin && allowedOrigins.includes(origin);
	
	// Handle preflight OPTIONS requests immediately
	if (req.method === "OPTIONS" && isAllowedOrigin) {
		const response = new NextResponse(null, { status: 200 });
		response.headers.set("Access-Control-Allow-Origin", origin);
		response.headers.set("Access-Control-Allow-Credentials", "true");
		response.headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-Requested-With, Accept, next-router-prefetch, next-router-state-tree, next-url, rsc, x-invoke-path, x-invoke-query"
		);
		response.headers.set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS, HEAD"
		);
		response.headers.set("Access-Control-Max-Age", "86400");
		return response;
	}
	
	// Handle authentication protection
	if (!isPublicRoute(req)) {
		await auth.protect();
	}

	const { userId } = await auth();
	
	// Create the appropriate response
	const response = userId 
		? NextResponse.redirect(new URL(urls.app))
		: req.nextUrl.pathname === "/" 
			? NextResponse.redirect(new URL("/sign-in", req.url))
			: NextResponse.next();
	
	// Add CORS headers to all responses for allowed origins
	if (isAllowedOrigin) {
		response.headers.set("Access-Control-Allow-Origin", origin);
		response.headers.set("Access-Control-Allow-Credentials", "true");
		response.headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-Requested-With, Accept, next-router-prefetch, next-router-state-tree, next-url, rsc, x-invoke-path, x-invoke-query"
		);
		response.headers.set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS, HEAD"
		);
	}
	
	return response;
}, clerkConfig);

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};


import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
	getClerkMiddlewareConfig,
	handleCorsPreflightRequest,
	applyCorsHeaders,
	getAllAppUrls,
} from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfig = getClerkMiddlewareConfig("auth");
const urls = getAllAppUrls();

// Define public routes that don't need authentication
const isPublicRoute = createRouteMatcher([
	"/",
	"/sign-in",
	"/sign-in/sso-callback",
	"/sign-up",
	"/sign-up/sso-callback",
	"/api/health",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		return preflightResponse;
	}

	const { userId, sessionClaims } = await auth();

	// Handle authenticated users
	if (userId) {
		// Check if user has pending tasks (organization selection)
		if (sessionClaims?.currentTask) {
			// User is authenticated but has pending organization task
			// Redirect directly to cloud app onboarding to complete task
			const onboardingUrl = new URL('/onboarding', urls.cloud);
			return NextResponse.redirect(onboardingUrl);
		}

		// User is fully authenticated with no pending tasks
		// Redirect from root to cloud app
		if (req.nextUrl.pathname === "/") {
			return NextResponse.redirect(new URL(urls.cloud));
		}

		// Redirect away from auth pages to cloud app
		if (req.nextUrl.pathname.startsWith("/sign-in") || req.nextUrl.pathname.startsWith("/sign-up")) {
			return NextResponse.redirect(new URL(urls.cloud));
		}
	}

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
}, clerkConfig);

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
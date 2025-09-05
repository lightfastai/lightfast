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
	console.log('🔒 Middleware - Processing request:', {
		pathname: req.nextUrl.pathname,
		searchParams: req.nextUrl.searchParams.toString(),
		url: req.url
	});

	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		console.log('🔒 Middleware - Returning CORS preflight response');
		return preflightResponse;
	}

	const { userId } = await auth();
	console.log('🔒 Middleware - Auth check:', { userId: userId ? 'authenticated' : 'not authenticated' });

	// Handle redirect logic for authenticated users on sign-in page with redirect_url
	if (userId && req.nextUrl.pathname === "/sign-in") {
		const redirectUrl = req.nextUrl.searchParams.get("redirect_url");
		console.log('🔒 Middleware - Authenticated user on sign-in page:', { redirectUrl });
		
		if (redirectUrl) {
			console.log('🔒 Middleware - Redirecting authenticated user to:', redirectUrl);
			return NextResponse.redirect(redirectUrl);
		} else {
			console.log('🔒 Middleware - No redirect_url, redirecting to select-organization');
			return NextResponse.redirect(new URL("/select-organization", req.url));
		}
	}

	// Handle fully authenticated users
	if (userId) {
		console.log('🔒 Middleware - Authenticated user accessing:', req.nextUrl.pathname);
		// User is fully authenticated - let them access auth app pages
		// No automatic redirects to external apps unless they're on sign-in with redirect_url
	}

	// Redirect unauthenticated users from root to sign-in
	if (req.nextUrl.pathname === "/" && !userId) {
		console.log('🔒 Middleware - Redirecting unauthenticated user from root to sign-in');
		return NextResponse.redirect(new URL("/sign-in", req.url));
	}

	// Protect all routes except public ones
	if (!isPublicRoute(req)) {
		console.log('🔒 Middleware - Protecting route:', req.nextUrl.pathname);
		await auth.protect();
	}

	console.log('🔒 Middleware - Allowing request to continue');
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

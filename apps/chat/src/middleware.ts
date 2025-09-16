import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
	"/new",
	"/new/(.*)",
	// Billing routes explicitly protected
	"/billing",
	"/billing/(.*)",
	// Dynamic session ID routes (any path that's not public/auth)
	"/((?!sign-in|sign-up|api|robots.txt|sitemap|pricing$|$).*)",
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
	if (
		userId &&
		(req.nextUrl.pathname.startsWith("/sign-in") ||
			req.nextUrl.pathname.startsWith("/sign-up"))
	) {
		return NextResponse.redirect(new URL("/new", req.url));
	}

	// Protect routes that require authentication
	if (isProtectedRoute(req)) {
		await auth.protect();
	}

	const response = NextResponse.next();

	// Apply CORS headers to the response
	return applyCorsHeaders(response, req);
});

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

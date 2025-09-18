import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
	handleCorsPreflightRequest,
	applyCorsHeaders,
} from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Create matchers so auth checks stay readable
const isRootRoute = createRouteMatcher(["/"]);
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isNewChatRoute = createRouteMatcher(["/new", "/new/(.*)"]);
const isBillingRoute = createRouteMatcher(["/billing", "/billing/(.*)"]);
const isSessionScopedRoute = createRouteMatcher([
	"/((?!sign-in|sign-up|api|robots.txt|sitemap|pricing$|$).*)",
]);

const requiresAuth = (req: NextRequest) =>
	isNewChatRoute(req) || isBillingRoute(req) || isSessionScopedRoute(req);

export default clerkMiddleware(
	async (auth, req: NextRequest) => {
		// Handle CORS preflight requests
		const preflightResponse = handleCorsPreflightRequest(req);
		if (preflightResponse) {
			return preflightResponse;
		}

		const { userId } = await auth();

		// Handle redirects for authenticated users only
		if (isRootRoute(req) && userId) {
			return NextResponse.redirect(new URL("/new", req.url));
		}

		// Redirect authenticated users away from auth pages
		if (userId && isAuthRoute(req)) {
			return NextResponse.redirect(new URL("/new", req.url));
		}

		// Protect routes that require authentication
		if (requiresAuth(req)) {
			await auth.protect();
		}

		const response = NextResponse.next();

		// Apply CORS headers to the response
		return applyCorsHeaders(response, req);
	},
	{
		signInUrl: "/sign-in",
		signUpUrl: "/sign-up",
	},
);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

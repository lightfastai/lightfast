import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { NextResponse } from "next/server";

// Define protected routes - everything except public routes
const isProtectedRoute = createRouteMatcher([
	"/((?!sign-in|api/webhooks|api/cron|api/v2|test-event-driven|test-resumable-stream|test-simple|test-instant-stream).*)",
]);

// Default agent
const DEFAULT_AGENT: string = "a011";

export default clerkMiddleware(
	async (auth, req) => {
		// Protect routes using Clerk's built-in protection
		if (isProtectedRoute(req)) {
			await auth.protect();
		}

		// Handle root path redirect for authenticated users
		if (req.nextUrl.pathname === "/") {
			// Redirect to default agent chat (new chat)
			return NextResponse.redirect(new URL(`/chat/${DEFAULT_AGENT}`, req.url));
		}
	},
	{
		signInUrl: "/sign-in",
	},
);

// Configure which paths the middleware should run on
export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

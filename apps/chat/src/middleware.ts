import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Create matchers so auth checks stay readable
const isRootRoute = createRouteMatcher(["/"]);
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isNewChatRoute = createRouteMatcher(["/new", "/new/(.*)"]);
const isBillingRoute = createRouteMatcher(["/billing", "/billing/(.*)"]);
const isSessionScopedRoute = createRouteMatcher([
	"/((?!sign-in|sign-up|api|robots.txt|sitemap|pricing$|share|$).*)",
]);

const requiresAuth = (req: NextRequest) =>
	isNewChatRoute(req) || isBillingRoute(req) || isSessionScopedRoute(req);

export default clerkMiddleware(
	async (auth, req: NextRequest) => {
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

		return NextResponse.next();
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

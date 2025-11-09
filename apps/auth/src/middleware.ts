import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { consoleUrl } from "~/lib/related-projects";


// Define public routes that don't need authentication
const isPublicRoute = createRouteMatcher([
	"/",
	"/sign-in",
	"/sign-in/sso-callback",
	"/sign-up",
	"/sign-up/sso-callback",
	"/api/health",
	"/robots.txt",
	"/sitemap.xml",
]);

// Define auth routes that authenticated users with orgs should be redirected away from
const isAuthRoute = createRouteMatcher([
	"/sign-in",
	"/sign-up",
]);

// Define organization routes that need Clerk organization sync
const isOrgRoute = createRouteMatcher([
	"/org/(.*)"
]);

const isRootRedirect = createRouteMatcher(["/"]);

export default clerkMiddleware(
	async (auth, req: NextRequest) => {
		// Handle CORS preflight requests
		const preflightResponse = handleCorsPreflightRequest(req);
		if (preflightResponse) {
			return preflightResponse;
		}

		// For /orgs/:slug routes, let Clerk's organizationSyncOptions handle everything
		if (isOrgRoute(req)) {
			console.log(
				`[AUTH MIDDLEWARE] Organization route detected, letting Clerk handle: ${req.nextUrl.pathname}`,
			);
			await auth.protect();
			const response = NextResponse.next();
			return applyCorsHeaders(response, req);
		}

		const authResult = await auth();
		const { userId, orgId, orgSlug, sessionId, isAuthenticated } = authResult;

		console.log(`[AUTH MIDDLEWARE] Auth state:`, {
			isAuthenticated,
			userId: userId ? "present" : "null",
			orgId: orgId ? "present" : "null", 
			orgSlug: orgSlug ?? "null",
			sessionId: sessionId ? "present" : "null",
			pathname: req.nextUrl.pathname,
		});

		// Handle authenticated users with organizations - redirect away from auth pages
		if (isAuthenticated && orgId && orgSlug && isAuthRoute(req)) {
			console.log(`[AUTH MIDDLEWARE] Redirecting authenticated user away from auth route: ${req.nextUrl.pathname} → console app /org/${orgSlug}`);
			return NextResponse.redirect(new URL(`/org/${orgSlug}`, consoleUrl));
		}

		// Handle root path redirect logic
		if (isRootRedirect(req)) {
			if (!isAuthenticated) {
				// Not authenticated - go to sign-in
				console.log("[AUTH MIDDLEWARE] Redirecting to sign-in (not authenticated)");
				return NextResponse.redirect(new URL("/sign-in", req.url));
			}
			
			if (!orgId) {
				// Authenticated but no org - redirect to console app onboarding
				console.log("[AUTH MIDDLEWARE] Redirecting to console app onboarding (no org)");
				return NextResponse.redirect(new URL("/onboarding/claim-org", consoleUrl));
			}
			
			if (orgId) {
				// Authenticated with org - redirect to console app
				console.log(`[AUTH MIDDLEWARE] Redirecting authenticated user with org from root → console app /org/${orgSlug}`);
				return NextResponse.redirect(new URL(`/org/${orgSlug}`, consoleUrl));
			}
		}

		// Protect all routes except public ones
		if (!isPublicRoute(req)) {
			await auth.protect();
		}

		// Allow request to continue
		const response = NextResponse.next();
		return applyCorsHeaders(response, req);
	},
	{
		// Organization sync for /org/:slug routes in auth app
		organizationSyncOptions: {
			organizationPatterns: ["/org/:slug", "/org/:slug/(.*)"],
		},
	},
);

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

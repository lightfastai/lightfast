import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
	handleCorsPreflightRequest,
	applyCorsHeaders,
} from "@repo/url-utils";
import { getAppUrl } from "@repo/vercel-config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Allowed redirect domains for security
const ALLOWED_REDIRECT_HOSTS = [
	"lightfast.ai",
	"auth.lightfast.ai", 
	"cloud.lightfast.ai",
	"localhost"
];

// Validate redirect URLs to prevent open redirect attacks
function isValidRedirectUrl(url: string): boolean {
	if (!url) return false;
	
	try {
		const parsed = new URL(url);
		return ALLOWED_REDIRECT_HOSTS.some(host => 
			parsed.hostname === host || 
			parsed.hostname.endsWith(`.${host}`)
		);
	} catch {
		return false;
	}
}

// Define public routes that don't need authentication
const isPublicRoute = createRouteMatcher([
	"/",
	"/sign-in",
	"/sign-in/sso-callback",
	"/sign-up",
	"/sign-up/sso-callback",
	"/select-organization",
	"/api/health",
	"/api/validate-org-creation",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
	// Handle CORS preflight requests
	const preflightResponse = handleCorsPreflightRequest(req);
	if (preflightResponse) {
		return preflightResponse;
	}

	const { userId, orgId } = await auth();

	// USE CASE 5: Existing user with org accessing any auth route -> immediate cloud redirect
	if (userId && orgId) {
		// Redirect user with existing organization to cloud app
		return NextResponse.redirect(new URL(getAppUrl("cloud"), req.url));
	}

	// USE CASE 2 & 4: Handle authenticated users on sign-in page  
	if (userId && req.nextUrl.pathname === "/sign-in") {
		const redirectUrl = req.nextUrl.searchParams.get("redirect_url");
		// Handle authenticated user on sign-in page
		
		if (orgId) {
			// User has organization, redirect to cloud app or validated URL
			let targetUrl = getAppUrl("cloud");
			if (redirectUrl && isValidRedirectUrl(redirectUrl)) {
				targetUrl = redirectUrl;
			}
			// Redirect user with organization to target URL
			return NextResponse.redirect(targetUrl);
		} else {
			// User needs to select/create organization
			// Redirect user without organization to select-organization
			let orgUrl = "/select-organization";
			if (redirectUrl && isValidRedirectUrl(redirectUrl)) {
				orgUrl = `/select-organization?redirect_url=${encodeURIComponent(redirectUrl)}`;
			}
			return NextResponse.redirect(new URL(orgUrl, req.url));
		}
	}

	// USE CASE 3: Authenticated users without org should only access select-organization
	if (userId && !orgId && req.nextUrl.pathname !== "/select-organization") {
		// Redirect authenticated user without organization
		return NextResponse.redirect(new URL("/select-organization", req.url));
	}

	// Redirect unauthenticated users from root to sign-in
	if (req.nextUrl.pathname === "/" && !userId) {
		// Redirect unauthenticated user from root to sign-in
		return NextResponse.redirect(new URL("/sign-in", req.url));
	}

	// Protect all routes except public ones
	if (!isPublicRoute(req)) {
		// Protecting non-public route
		await auth.protect();
	}

	// Allow request to continue
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

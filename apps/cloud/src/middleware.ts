import arcjet, { shield, fixedWindow } from "@arcjet/next";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { handleCorsPreflightRequest, applyCorsHeaders, getAppUrl } from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "~/env";

// Shared shield configuration for all endpoints
const shieldRule = shield({ mode: "LIVE" });

// Arcjet configurations for different endpoints
const ajDefault = arcjet({
	key: env.ARCJET_KEY,
	rules: [
		shieldRule,
		fixedWindow({
			mode: "LIVE",
			window: "1m",
			max: 100, // 100 requests per minute for general API usage
		}),
	],
});

// Strict rate limiting for API key validation with burst protection
const ajValidation = arcjet({
	key: env.ARCJET_KEY,
	rules: [
		shieldRule,
		fixedWindow({
			mode: "LIVE",
			window: "10m",
			max: 20, // 20 attempts per 10 minutes
		}),
		fixedWindow({
			mode: "LIVE",
			window: "10s",
			max: 5, // Burst protection: max 5 attempts per 10 seconds
		}),
	],
});

// Lenient rate limiting for whoami endpoint (CLI status checks)
const ajWhoami = arcjet({
	key: env.ARCJET_KEY,
	rules: [
		shieldRule,
		fixedWindow({
			mode: "LIVE",
			window: "1m",
			max: 30, // 30 requests per minute for CLI status checks
		}),
	],
});

// Define protected routes - everything except public routes should require auth
const isPublicRoute = createRouteMatcher([
	"/", // Landing page accessible to all, but middleware handles auth redirect
	"/api/health",
	"/api/trpc/apiKey.validate", // tRPC endpoint for API key validation
	"/api/trpc/apiKey.whoami", // tRPC endpoint for whoami command
	"/playground",
	"/playground/(.*)",
	"/settings/api-keys", // Temporarily public for testing
	"/org_(.*)", // Clerk's organization-specific URLs
]);

// Define routes that require organization membership
const isOrganizationRoute = createRouteMatcher([
	"/orgs/(.*)/dashboard",
	"/orgs/(.*)/dashboard/(.*)",
	"/orgs/(.*)/settings",
	"/orgs/(.*)/settings/(.*)",
	"/orgs/(.*)/deployments",
	"/orgs/(.*)/deployments/(.*)",
]);

// Define API key validation routes for enhanced security
// const isApiKeyRoute = createRouteMatcher([
// 	"/api/trpc/apiKey.validate",
// 	"/api/trpc/apiKey.whoami",
// ]);

export default clerkMiddleware(
	async (auth, req: NextRequest) => {
		// Handle CORS preflight requests first
		const preflightResponse = handleCorsPreflightRequest(req);
		if (preflightResponse) {
			return preflightResponse;
		}

		// Select appropriate Arcjet configuration based on endpoint
		let aj = ajDefault;
		if (req.url.includes("/api/trpc/apiKey.validate")) {
			aj = ajValidation;
		} else if (req.url.includes("/api/trpc/apiKey.whoami")) {
			aj = ajWhoami;
		}

		// Apply Arcjet protection (rate limiting + shield)
		// Arcjet automatically handles IP extraction from standard headers
		const decision = await aj.protect(req);

		// Block requests that violate rate limits or security rules
		if (decision.isDenied()) {
			// Determine which endpoint was hit for better user feedback
			const isValidationEndpoint = req.url.includes(
				"/api/trpc/apiKey.validate",
			);
			const isWhoamiEndpoint = req.url.includes("/api/trpc/apiKey.whoami");

			let specificMessage = "Too many requests. Please try again later.";

			if (decision.reason.isRateLimit()) {
				// Rate limit specific messaging
				if (isValidationEndpoint) {
					specificMessage =
						"Too many authentication attempts. Please wait before trying again.";
				} else if (isWhoamiEndpoint) {
					specificMessage =
						"Too many status check requests. Please reduce request frequency.";
				}

				return NextResponse.json(
					{
						error: "Rate limit exceeded",
						message: specificMessage,
					},
					{
						status: 429,
						headers: {
							"Retry-After": "60", // Default 60 seconds retry
						},
					},
				);
			}

			// Shield or other security violations
			if (decision.reason.isShield()) {
				return NextResponse.json(
					{
						error: "Security violation",
						message: "Request blocked due to suspicious activity.",
					},
					{ status: 403 },
				);
			}

			// Generic security block
			return NextResponse.json(
				{
					error: "Request blocked",
					message: "Request blocked for security reasons.",
				},
				{ status: 403 },
			);
		}

		// Handle root path specially - check auth status without forcing auth
		if (req.nextUrl.pathname === "/") {
			const authResult = await auth();
			const { userId, orgId, sessionClaims } = authResult;

			console.log(`[MIDDLEWARE DEBUG] Auth result:`, { 
				userId: userId ? 'present' : 'null', 
				orgId: orgId || 'null',
				sessionClaims: sessionClaims ? Object.keys(sessionClaims) : 'null'
			});

			// If user is authenticated, redirect to org dashboard
			if (userId) {
				if (orgId) {
					try {
						// Fetch organization details to get slug for clean URLs
						const orgResponse = await fetch(`https://api.clerk.com/v1/organizations/${orgId}`, {
							headers: {
								"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
								"Content-Type": "application/json",
							},
						});

						if (orgResponse.ok) {
							const orgData = await orgResponse.json() as { slug: string | null };
							const orgSlug = orgData.slug || orgId;
							console.log(`[MIDDLEWARE] Redirecting logged-in user ${userId} from root to org dashboard: /orgs/${orgSlug}/dashboard`);
							return NextResponse.redirect(new URL(`/orgs/${orgSlug}/dashboard`, req.url));
						}
					} catch (error) {
						console.error("[MIDDLEWARE] Error fetching org details, using orgId as fallback");
					}
					// Fallback: redirect using orgId
					console.log(`[MIDDLEWARE] Redirecting logged-in user ${userId} from root to org dashboard (fallback): /orgs/${orgId}/dashboard`);
					return NextResponse.redirect(new URL(`/orgs/${orgId}/dashboard`, req.url));
				} else {
					// User has no org, redirect to select-organization
					console.log(`[MIDDLEWARE] Logged-in user ${userId} with no org accessing root, redirecting to select-organization`);
					return NextResponse.redirect(new URL("/select-organization", getAppUrl("auth")));
				}
			}
			// If user is not authenticated, allow them to see the landing page (continue to render)
			console.log(`[MIDDLEWARE] Unauthenticated user accessing root, allowing landing page`);
		}

		// For non-public routes, let Clerk handle authentication and organization sync
		if (!isPublicRoute(req)) {
			await auth.protect();
		}

		const response = NextResponse.next();

		// Apply CORS headers to the response
		return applyCorsHeaders(response, req);
	},
	{
		// Organization sync using proper Clerk patterns
		organizationSyncOptions: {
			organizationPatterns: [
				"/orgs/:slug", // Matches organization home page, e.g. /orgs/acmecorp
				"/orgs/:slug/(.*)", // Matches organization sub-pages, e.g. /orgs/acmecorp/dashboard
			],
		}
	}
);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

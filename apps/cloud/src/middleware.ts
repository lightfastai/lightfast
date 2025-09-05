import arcjet, { shield, fixedWindow } from "@arcjet/next";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
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
	"/",
	"/api/health",
	"/api/trpc/apiKey.validate", // tRPC endpoint for API key validation
	"/api/trpc/apiKey.whoami", // tRPC endpoint for whoami command
	"/playground",
	"/playground/(.*)",
	"/settings/api-keys", // Temporarily public for testing
]);

// Define routes that require organization membership
const isOrganizationRoute = createRouteMatcher([
	"/settings",
	"/settings/(.*)",
	"/dashboard",
	"/dashboard/(.*)",
	"/api-keys",
	"/deployments",
	"/deployments/(.*)",
	"/(.*)/dashboard",
	"/(.*)/dashboard/(.*)",
	"/(.*)/settings",
	"/(.*)/settings/(.*)",
	"/(.*)/deployments",
	"/(.*)/deployments/(.*)",
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

		// Handle authentication and organization requirements
		if (!isPublicRoute(req)) {
			// First, ensure user is authenticated
			const { userId, orgId } = await auth.protect();

			// Check if this route requires organization membership
			if (isOrganizationRoute(req)) {
				// Log detailed auth information for debugging
				console.log(
					`[MIDDLEWARE] User ${userId} accessing org route ${req.nextUrl.pathname}`,
					{ orgId },
				);

				// Let Clerk handle any session tasks automatically via taskUrls configuration

				// Check if user has organization membership
				if (!orgId) {
					console.log(
						`[MIDDLEWARE] User ${userId} attempting to access organization route without org membership, redirecting to select-organization`,
					);

					// Redirect to organization selection/creation on auth app
					const selectOrgUrl = new URL("http://localhost:4104/select-organization");
					return NextResponse.redirect(selectOrgUrl);
				}

				console.log(
					`[MIDDLEWARE] User ${userId} successfully accessing organization route with org ${orgId}`,
				);
			}
		}

		const response = NextResponse.next();

		// Apply CORS headers to the response
		return applyCorsHeaders(response, req);
	},
	{
		publicRoutes: ["/api/health"],
		ignoredRoutes: [],
		// Cloud app configuration - redirects to auth subdomain
		signInUrl: "http://localhost:4104/sign-in",
		signUpUrl: "http://localhost:4104/sign-up",
		signInFallbackRedirectUrl: "/",
		signUpFallbackRedirectUrl: "/",
		afterSignOutUrl: "http://localhost:4101", // www app
		// CRITICAL: Include taskUrls in middleware to prevent /sign-in/tasks fallback
		taskUrls: {
			"choose-organization": "http://localhost:4104/select-organization",
		},
	},
);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

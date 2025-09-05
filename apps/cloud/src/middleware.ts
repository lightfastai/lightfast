import arcjet, { shield, fixedWindow } from "@arcjet/next";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
	getClerkMiddlewareConfig,
	handleCorsPreflightRequest,
	applyCorsHeaders,
} from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "~/env";

const clerkConfig = getClerkMiddlewareConfig("cloud");

// Arcjet configurations for different endpoints
// We'll select the appropriate config based on the request path
const ajDefault = arcjet({
	key: env.ARCJET_KEY,
	rules: [
		shield({
			mode: "LIVE",
		}),
		// General API rate limiting 
		fixedWindow({
			mode: "LIVE",
			characteristics: ["ip"],
			window: "1m",
			max: 100, // 100 requests per minute for general API usage
		}),
	],
});

// Strict rate limiting for API key validation
const ajValidation = arcjet({
	key: env.ARCJET_KEY,
	rules: [
		shield({
			mode: "LIVE", 
		}),
		// Prevent brute force attacks on validation
		fixedWindow({
			mode: "LIVE",
			characteristics: ["ip"],
			window: "10m", // 10 minute window
			max: 20, // 20 attempts per 10 minutes
		}),
		// Burst protection
		fixedWindow({
			mode: "LIVE",
			characteristics: ["ip"],
			window: "10s", // 10 second window  
			max: 5, // Max 5 attempts per 10 seconds
		}),
	],
});

// More lenient rate limiting for whoami endpoint
const ajWhoami = arcjet({
	key: env.ARCJET_KEY,
	rules: [
		shield({
			mode: "LIVE",
		}),
		fixedWindow({
			mode: "LIVE",
			characteristics: ["ip"],
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

// Define API key validation routes for enhanced security
const isApiKeyRoute = createRouteMatcher([
	"/api/trpc/apiKey.validate",
	"/api/trpc/apiKey.whoami",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
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
	// Extract IP from headers
	const ip = req.headers.get("x-forwarded-for") || 
	           req.headers.get("x-real-ip") || 
	           "unknown";
	const decision = await aj.protect(req, { ip });

	// Block requests that violate rate limits or security rules
	if (decision.isDenied()) {
		// Determine which endpoint was hit for better user feedback
		const isValidationEndpoint = req.url.includes("/api/trpc/apiKey.validate");
		const isWhoamiEndpoint = req.url.includes("/api/trpc/apiKey.whoami");
		
		let specificMessage = "Too many requests. Please try again later.";
		let status = 429;
		
		if (decision.reason.isRateLimit()) {
			// Rate limit specific messaging
			if (isValidationEndpoint) {
				specificMessage = "Too many authentication attempts. Please wait before trying again.";
			} else if (isWhoamiEndpoint) {
				specificMessage = "Too many status check requests. Please reduce request frequency.";
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
					}
				}
			);
		}

		// Shield or other security violations
		if (decision.reason.isShield()) {
			return NextResponse.json(
				{ 
					error: "Security violation",
					message: "Request blocked due to suspicious activity.",
				}, 
				{ status: 403 }
			);
		}

		// Generic security block
		return NextResponse.json(
			{ 
				error: "Request blocked",
				message: "Request blocked for security reasons.",
			}, 
			{ status: 403 }
		);
	}

	// If it's not a public route, protect it with Clerk
	if (!isPublicRoute(req)) {
		await auth.protect();
	}

	const response = NextResponse.next();

	// Apply CORS headers to the response
	return applyCorsHeaders(response, req);
}, clerkConfig);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};


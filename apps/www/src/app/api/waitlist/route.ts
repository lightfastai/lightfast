import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { arcjet, shield, detectBot, fixedWindow, validateEmail, ARCJET_KEY } from "@vendor/security";
import { redis } from "@vendor/upstash";
import { handleClerkError } from "~/lib/clerk-error-handler";
import { captureException } from "@sentry/nextjs";
import { env } from "~/env";

export const runtime = "edge";

// Response types
type WaitlistSuccessResponse = {
	success: true;
	message: string;
};

type WaitlistErrorResponse = {
	success: false;
	error: string;
	isRateLimit?: boolean;
	fieldErrors?: { email?: string[] };
};

type WaitlistResponse = WaitlistSuccessResponse | WaitlistErrorResponse;

const waitlistSchema = z.object({
	email: z
		.string()
		.min(1, "Email is required")
		.email("Please enter a valid email address")
		.toLowerCase()
		.trim(),
});

const WAITLIST_EMAILS_SET_KEY = "waitlist:emails";

// Configure Arcjet protection for waitlist signup
const aj = arcjet({
	key: ARCJET_KEY,
	// Use IP for rate limiting characteristics
	characteristics: ["ip.src"],
	rules: [
		// Validate email quality - block disposable/temporary emails
		validateEmail({
			mode: "LIVE",
			// Block disposable email services, invalid formats, and domains without MX records
			deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
		}),
		// Shield protects against common attacks like SQL injection, XSS
		// Start in DRY_RUN mode to monitor before blocking
		shield({
			mode: env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN",
		}),
		// Block automated bots from spamming the waitlist
		detectBot({
			mode: "LIVE",
			allow: [
				"CATEGORY:SEARCH_ENGINE", // Allow search engines for SEO
				"CATEGORY:MONITOR", // Allow monitoring services
			],
		}),
		// Hourly limit: More lenient for shared networks
		fixedWindow({
			mode: "LIVE",
			window: "1h",
			max: 10, // Allow up to 10 signups per hour from same IP (offices, families)
		}),
		// Daily limit: Prevent sustained abuse
		fixedWindow({
			mode: "LIVE",
			window: "24h",
			max: 50, // Maximum 50 signups per day from same IP
		}),
		// Burst protection: Prevent rapid-fire submissions
		fixedWindow({
			mode: "LIVE",
			window: "10s",
			max: 3, // Max 3 attempts in 10 seconds (allows for quick corrections)
		}),
	],
});

export async function POST(request: NextRequest): Promise<NextResponse<WaitlistResponse>> {
	try {
		// Parse request body
		const body = await request.json();

		// Parse and validate email
		const validatedFields = waitlistSchema.safeParse(body);

		// Return field errors if validation fails
		if (!validatedFields.success) {
			return NextResponse.json<WaitlistErrorResponse>(
				{
					success: false,
					error: "Please fix the errors below",
					fieldErrors: validatedFields.error.flatten().fieldErrors,
				},
				{ status: 400 }
			);
		}

		// Email has been validated for format
		const { email } = validatedFields.data;

		// Check Arcjet protection with the validated email
		const decision = await aj.protect(request, {
			// Pass email for validateEmail rule
			email: email,
		});

		// Handle denied requests from Arcjet
		if (decision.isDenied()) {
			const reason = decision.reason;

			// Check specific denial reasons
			if (reason.isRateLimit()) {
				return NextResponse.json<WaitlistErrorResponse>(
					{
						success: false,
						error: "Too many signup attempts. Please try again later.",
						isRateLimit: true,
					},
					{ status: 429 }
				);
			}

			if (reason.isBot()) {
				return NextResponse.json<WaitlistErrorResponse>(
					{
						success: false,
						error: "Automated signup detected. Please complete the form manually.",
					},
					{ status: 403 }
				);
			}

			if (reason.isShield()) {
				return NextResponse.json<WaitlistErrorResponse>(
					{
						success: false,
						error: "Request blocked for security reasons. Please try again.",
					},
					{ status: 403 }
				);
			}

			// Check if email validation failed (disposable, invalid domain, etc.)
			if ('isEmail' in reason && typeof reason.isEmail === 'function' && reason.isEmail()) {
				return NextResponse.json<WaitlistErrorResponse>(
					{
						success: false,
						error: "Please use a valid email address. Temporary or disposable email addresses are not allowed.",
					},
					{ status: 400 }
				);
			}

			// Generic denial message
			return NextResponse.json<WaitlistErrorResponse>(
				{
					success: false,
					error: "Your request could not be processed. Please try again.",
				},
				{ status: 403 }
			);
		}

		// Check if email already exists in our Redis cache for fast duplicate detection
		try {
			const emailExists = await redis.sismember(WAITLIST_EMAILS_SET_KEY, email);
			if (emailExists) {
				return NextResponse.json<WaitlistErrorResponse>(
					{
						success: false,
						error: "This email is already on the waitlist!",
					},
					{ status: 409 }
				);
			}
		} catch (redisError) {
			// Log Redis errors but don't block the user if Redis is down
			console.error("Redis error checking waitlist:", redisError);
			captureException(redisError, {
				tags: {
					action: "joinWaitlist:redis-check",
					email,
				},
			});
			// Continue with the request - Clerk will catch duplicates anyway
		}

		try {
			// Use Clerk's Backend API to add to waitlist
			const response = await fetch("https://api.clerk.com/v1/waitlist_entries", {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${env.CLERK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email_address: email,
				}),
			});

			if (!response.ok) {
				// Parse Clerk API error response
				const errorData = await response.json() as unknown;

				// Use improved Clerk error handler
				const errorResult = handleClerkError(errorData, {
					action: "joinWaitlist:api-call",
					email,
					httpStatus: response.status,
				});

				// Handle specific error cases
				if (errorResult.isAlreadyExists) {
					return NextResponse.json<WaitlistErrorResponse>(
						{
							success: false,
							error: "This email is already on the waitlist!",
						},
						{ status: 409 }
					);
				}

				if (errorResult.isRateLimit) {
					return NextResponse.json<WaitlistErrorResponse>(
						{
							success: false,
							error: errorResult.userMessage,
							isRateLimit: true,
						},
						{ status: 429 }
					);
				}

				if (errorResult.isUserLocked) {
					const retryMessage = errorResult.retryAfterSeconds
						? ` Please try again in ${Math.ceil(errorResult.retryAfterSeconds / 60)} minutes.`
						: " Please try again later.";
					return NextResponse.json<WaitlistErrorResponse>(
						{
							success: false,
							error: `Your account is temporarily locked.${retryMessage}`,
						},
						{ status: 423 }
					);
				}

				// For validation errors, return more specific message
				if (errorResult.isValidationError) {
					return NextResponse.json<WaitlistErrorResponse>(
						{
							success: false,
							error: errorResult.userMessage,
						},
						{ status: 400 }
					);
				}

				// For other errors, throw to be caught by outer handler
				throw new Error(errorResult.message);
			}

			// Add email to Redis set for tracking (non-critical)
			try {
				await redis.sadd(WAITLIST_EMAILS_SET_KEY, email);
			} catch (redisError) {
				// Log but don't fail the user experience if Redis is down
				console.error("Failed to add email to Redis tracking:", redisError);
				captureException(redisError, {
					tags: {
						action: "joinWaitlist:redis-add",
						email,
					},
				});
			}

			return NextResponse.json<WaitlistSuccessResponse>(
				{
					success: true,
					message:
						"Successfully joined the waitlist! We'll send you an invite when Lightfast Cloud is ready.",
				},
				{ status: 200 }
			);
		} catch (clerkError) {
			// If it's already an error we want to show, return it
			if (clerkError instanceof Error && clerkError.message.includes("already on the waitlist")) {
				return NextResponse.json<WaitlistErrorResponse>(
					{
						success: false,
						error: clerkError.message,
					},
					{ status: 409 }
				);
			}

			// Handle unexpected Clerk errors
			console.error("Unexpected Clerk error:", clerkError);
			captureException(clerkError, {
				tags: {
					action: "joinWaitlist:unexpected",
					email,
				},
			});

			return NextResponse.json<WaitlistErrorResponse>(
				{
					success: false,
					error: "An unexpected error occurred. Please try again later.",
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		// Handle any outer errors (validation, JSON parsing, etc.)
		console.error("Error in waitlist API:", error);
		captureException(error, {
			tags: {
				action: "joinWaitlist:outer",
			},
		});

		return NextResponse.json<WaitlistErrorResponse>(
			{
				success: false,
				error: error instanceof Error ? error.message : "An error occurred. Please try again.",
			},
			{ status: 500 }
		);
	}
}

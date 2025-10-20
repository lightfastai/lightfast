"use server";

import { z } from "zod";
import { arcjet, shield, detectBot, fixedWindow, validateEmail, request, ARCJET_KEY } from "@vendor/security";
import { redis } from "@vendor/upstash";
import { handleClerkError } from "~/lib/clerk-error-handler";
import { captureException } from "@sentry/nextjs";
import { env } from "~/env";

export type WaitlistState =
	| { status: "idle" }
	| { status: "success"; message: string }
	| { status: "error"; error: string; isRateLimit?: boolean }
	| {
			status: "validation_error";
			fieldErrors: { email?: string[] };
			error: string;
	  };

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

export async function joinWaitlistAction(
	prevState: WaitlistState | null,
	formData: FormData,
): Promise<WaitlistState> {
	try {
		// Parse and validate form data first
		const validatedFields = waitlistSchema.safeParse({
			email: formData.get("email"),
		});

		// Return field errors if validation fails
		if (!validatedFields.success) {
			return {
				status: "validation_error",
				fieldErrors: validatedFields.error.flatten().fieldErrors,
				error: "Please fix the errors below",
			};
		}

		// Email has been validated for format
		const { email } = validatedFields.data;

		// Check Arcjet protection with the validated email
		const req = await request();
		const decision = await aj.protect(req, {
			// Pass email for validateEmail rule
			email: email,
		});

		// Handle denied requests from Arcjet
		if (decision.isDenied()) {
			const reason = decision.reason;
			
			// Check specific denial reasons
			if (reason.isRateLimit()) {
				return {
					status: "error",
					error: "Too many signup attempts. Please try again later.",
					isRateLimit: true,
				};
			}
			
			if (reason.isBot()) {
				return {
					status: "error",
					error: "Automated signup detected. Please complete the form manually.",
				};
			}
			
			if (reason.isShield()) {
				return {
					status: "error",
					error: "Request blocked for security reasons. Please try again.",
				};
			}
			
			// Check if email validation failed (disposable, invalid domain, etc.)
			if ('isEmail' in reason && typeof reason.isEmail === 'function' && reason.isEmail()) {
				return {
					status: "error",
					error: "Please use a valid email address. Temporary or disposable email addresses are not allowed.",
				};
			}
			
			// Generic denial message
			return {
				status: "error",
				error: "Your request could not be processed. Please try again.",
			};
		}

		// Check if email already exists in our Redis cache for fast duplicate detection
		try {
			const emailExists = await redis.sismember(WAITLIST_EMAILS_SET_KEY, email);
			if (emailExists) {
				return {
					status: "error",
					error: "This email is already on the waitlist!",
				};
			}
		} catch (redisError) {
			// Log Redis errors but don't block the user if Redis is down
			console.error("Redis error checking waitlist:", redisError);
			captureException(redisError, {
				tags: {
					action: "joinClerkWaitlist:redis-check",
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
					action: "joinClerkWaitlist:api-call",
					email,
					httpStatus: response.status,
				});
				
				// Handle specific error cases
				if (errorResult.isAlreadyExists) {
					return {
						status: "error",
						error: "This email is already on the waitlist!",
					};
				}
				
				if (errorResult.isRateLimit) {
					return {
						status: "error",
						error: errorResult.userMessage,
						isRateLimit: true,
					};
				}
				
				if (errorResult.isUserLocked) {
					const retryMessage = errorResult.retryAfterSeconds 
						? ` Please try again in ${Math.ceil(errorResult.retryAfterSeconds / 60)} minutes.`
						: " Please try again later.";
					return {
						status: "error",
						error: `Your account is temporarily locked.${retryMessage}`,
					};
				}
				
				// For validation errors, return more specific message
				if (errorResult.isValidationError) {
					return {
						status: "error",
						error: errorResult.userMessage,
					};
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
						action: "joinClerkWaitlist:redis-add",
						email,
					},
				});
			}

			return {
				status: "success",
				message:
					"Successfully joined the waitlist! We'll send you an invite when Lightfast Cloud is ready.",
			};
		} catch (clerkError) {
			// If it's already an error we want to show, return it
			if (clerkError instanceof Error && clerkError.message.includes("already on the waitlist")) {
				return {
					status: "error",
					error: clerkError.message,
				};
			}

			// Handle unexpected Clerk errors
			console.error("Unexpected Clerk error:", clerkError);
			captureException(clerkError, {
				tags: {
					action: "joinClerkWaitlist:unexpected",
					email,
				},
			});

			return {
				status: "error",
				error: "An unexpected error occurred. Please try again later.",
			};
		}
	} catch (error) {
		// Handle any outer errors (validation, etc.)
		console.error("Error in waitlist action:", error);
		captureException(error, {
			tags: {
				action: "joinClerkWaitlist:outer",
			},
			extra: {
				formData: Object.fromEntries(formData.entries()),
			},
		});

		return {
			status: "error",
			error: error instanceof Error ? error.message : "An error occurred. Please try again.",
		};
	}
}
"use server";

import { z } from "zod";
import { after } from "next/server";
import { arcjet, shield, detectBot, fixedWindow, slidingWindow, validateEmail, request, ARCJET_KEY } from "@vendor/security";
import { redis } from "@vendor/upstash";
import { handleClerkError } from "~/lib/clerk-error-handler";
import { captureException } from "@sentry/nextjs";
import { env } from "~/env";

export type EarlyAccessState =
	| { status: "idle" }
	| { status: "pending" }
	| { status: "success"; message: string }
	| { status: "error"; error: string; isRateLimit?: boolean }
	| {
			status: "validation_error";
			fieldErrors: {
				email?: string[];
				companySize?: string[];
				sources?: string[];
			};
			error: string;
	  };

const earlyAccessSchema = z.object({
	email: z
		.string()
		.min(1, "Email is required")
		.email("Please enter a valid email address")
		.toLowerCase()
		.trim(),
	companySize: z
		.string()
		.min(1, "Company size is required"),
	sources: z
		.array(z.string())
		.min(1, "Please select at least one data source"),
});

const EARLY_ACCESS_EMAILS_SET_KEY = "early-access:emails";

// Configure Arcjet protection for early access signup
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
		// Block automated bots from spamming the early access
		detectBot({
			mode: "LIVE",
			allow: [
				"CATEGORY:SEARCH_ENGINE", // Allow search engines for SEO
				"CATEGORY:MONITOR", // Allow monitoring services
			],
		}),
		// Hourly limit: Sliding window prevents burst at window boundaries
		slidingWindow({
			mode: "LIVE",
			interval: "1h",
			max: 10, // Allow up to 10 signups per hour from same IP (offices, families)
		}),
		// Daily limit: Sliding window for consistent daily protection
		slidingWindow({
			mode: "LIVE",
			interval: "24h",
			max: 50, // Maximum 50 signups per day from same IP
		}),
		// Burst protection: Fixed window is fine for short bursts
		fixedWindow({
			mode: "LIVE",
			window: "10s",
			max: 3, // Max 3 attempts in 10 seconds (allows for quick corrections)
		}),
	],
});

export async function joinEarlyAccessAction(
	prevState: EarlyAccessState | null,
	formData: FormData,
): Promise<EarlyAccessState> {
	try {
		// Parse and validate form data first
		const validatedFields = earlyAccessSchema.safeParse({
			email: formData.get("email"),
			companySize: formData.get("companySize"),
			sources: ((formData.get("sources") as string | null) ?? "").split(",").filter(Boolean),
		});

		// Return field errors if validation fails
		if (!validatedFields.success) {
			return {
				status: "validation_error",
				fieldErrors: validatedFields.error.flatten().fieldErrors,
				error: "Please fix the errors below",
			};
		}

		// Fields have been validated
		const { email, companySize, sources } = validatedFields.data;

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
			const emailExists = await redis.sismember(EARLY_ACCESS_EMAILS_SET_KEY, email);
			if (emailExists) {
				return {
					status: "error",
					error: "This email is already registered for early access!",
				};
			}
		} catch (redisError) {
			// Log Redis errors but don't block the user if Redis is down
			console.error("Redis error checking early access:", redisError);
			captureException(redisError, {
				tags: {
					action: "joinEarlyAccess:redis-check",
					email,
				},
			});
			// Continue with the request - Clerk will catch duplicates anyway
		}

		try {
			// Use Clerk's Backend API to add to waitlist with metadata
			const response = await fetch("https://api.clerk.com/v1/waitlist_entries", {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${env.CLERK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email_address: email,
					// Store additional metadata about company size and sources
					public_metadata: {
						companySize,
						sources: sources.join(","),
						submittedAt: new Date().toISOString(),
					},
				}),
			});

			if (!response.ok) {
				// Parse Clerk API error response
				const errorData = await response.json() as unknown;

				// Use improved Clerk error handler
				const errorResult = handleClerkError(errorData, {
					action: "joinEarlyAccess:api-call",
					email,
					httpStatus: response.status,
				});

				// Handle specific error cases
				if (errorResult.isAlreadyExists) {
					return {
						status: "error",
						error: "This email is already registered for early access!",
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

			// Return immediately for faster response
			const successResponse: EarlyAccessState = {
				status: "success",
				message:
					"Successfully joined early access! We'll send you an invite when Lightfast is ready.",
			};

			// Track in Redis after response is sent (non-blocking)
			after(async () => {
				try {
					await redis.sadd(EARLY_ACCESS_EMAILS_SET_KEY, email);
				} catch (redisError) {
					console.error("Failed to add email to Redis tracking:", redisError);
					captureException(redisError, {
						tags: {
							action: "joinEarlyAccess:redis-add",
							email,
						},
					});
				}
			});

			return successResponse;
		} catch (clerkError) {
			// If it's already an error we want to show, return it
			if (clerkError instanceof Error && clerkError.message.includes("already registered")) {
				return {
					status: "error",
					error: clerkError.message,
				};
			}

			// Handle unexpected Clerk errors
			console.error("Unexpected Clerk error:", clerkError);
			captureException(clerkError, {
				tags: {
					action: "joinEarlyAccess:unexpected",
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
		console.error("Error in early access action:", error);
		captureException(error, {
			tags: {
				action: "joinEarlyAccess:outer",
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

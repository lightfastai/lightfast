"use server";

import { z } from "zod";
import { redis } from "~/lib/redis";
import { handleClerkAPIError, handleServerActionError } from "~/lib/error-handler";

export type ClerkWaitlistState =
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

const WAITLIST_COUNT_KEY = "waitlist:count";
const WAITLIST_EMAILS_SET_KEY = "waitlist:emails";

export async function joinClerkWaitlistAction(
	prevState: ClerkWaitlistState | null,
	formData: FormData,
): Promise<ClerkWaitlistState> {
	try {
		// Parse and validate form data
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

		const { email } = validatedFields.data;

		// Check if email already exists in our Redis set
		try {
			const emailExists = await redis.sismember(WAITLIST_EMAILS_SET_KEY, email);
			if (emailExists) {
				return {
					status: "error",
					error: "This email is already on the waitlist!",
				};
			}
		} catch (redisError) {
			// Log Redis errors but don't block the user
			handleServerActionError(redisError, {
				action: "joinClerkWaitlist:redis-check",
				email,
				operation: "sismember",
			});
			// Continue with the request even if Redis check fails
		}

		try {
			// Use Clerk's Backend API to add to waitlist
			const response = await fetch("https://api.clerk.com/v1/waitlist_entries", {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email_address: email,
				}),
			});

			if (!response.ok) {
				// Clerk API error response structure
				const errorData = await response.json() as { 
					errors?: {
						code: string;
						message: string;
						long_message?: string;
						meta?: Record<string, unknown>;
					}[];
					clerk_trace_id?: string;
					status?: number;
				};
				
				// Check if the error is because the email already exists
				if (response.status === 400 || response.status === 422) {
					const firstError = errorData.errors?.[0];
					if (firstError) {
						// Check for duplicate email error codes
						if (firstError.code === 'form_identifier_exists' || 
							firstError.code === 'email_address_exists' ||
							firstError.message.toLowerCase().includes('already') ||
							firstError.long_message?.toLowerCase().includes('already')) {
							return {
								status: "error",
								error: "This email is already on the waitlist!",
							};
						}
					}
				}
				
				// Get the error message
				const errorMessage = errorData.errors?.[0]?.message ?? 
					errorData.errors?.[0]?.long_message ?? 
					`Failed to join waitlist: ${response.status}`;
				
				// Report to Sentry with full context
				const errorResult = handleClerkAPIError(
					new Error(errorMessage),
					{
						action: "joinClerkWaitlist:api-call",
						email,
						clerkTraceId: errorData.clerk_trace_id,
						status: response.status,
						errorData,
					}
				);
				
				// Check for rate limit
				if (response.status === 429 || errorResult.isRateLimit) {
					return {
						status: "error",
						error: errorResult.userMessage,
						isRateLimit: true,
					};
				}
				
				throw new Error(errorMessage);
			}

			// Add email to Redis set and increment counter
			// Using a pipeline for atomic operations
			const pipe = redis.pipeline();
			pipe.sadd(WAITLIST_EMAILS_SET_KEY, email);
			pipe.incr(WAITLIST_COUNT_KEY);
			await pipe.exec();

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
			const errorResult = handleServerActionError(clerkError, {
				action: "joinClerkWaitlist:unexpected",
				email,
			});

			return {
				status: "error",
				error: errorResult.userMessage,
				isRateLimit: errorResult.isRateLimit,
			};
		}
	} catch (error) {
		// Handle any outer errors (validation, etc.)
		const errorResult = handleServerActionError(error, {
			action: "joinClerkWaitlist:outer",
			formData: Object.fromEntries(formData.entries()),
		});

		return {
			status: "error",
			error: errorResult.userMessage,
			isRateLimit: errorResult.isRateLimit,
		};
	}
}

/**
 * Get the current waitlist count
 */
export async function getWaitlistCount(): Promise<number> {
	try {
		const count = await redis.get<string>(WAITLIST_COUNT_KEY);
		return count ? parseInt(count, 10) : 0;
	} catch (error) {
		console.error("Error getting waitlist count:", error);
		return 0;
	}
}

/**
 * Get the actual unique email count from the set
 * This is the source of truth for the waitlist size
 */
export async function getWaitlistUniqueCount(): Promise<number> {
	try {
		const count = await redis.scard(WAITLIST_EMAILS_SET_KEY);
		return count;
	} catch (error) {
		console.error("Error getting unique waitlist count:", error);
		return 0;
	}
}

/**
 * Get all waitlist emails (use with caution for large sets)
 * Useful for admin purposes or exports
 */
export async function getWaitlistEmails(): Promise<string[]> {
	try {
		const emails = await redis.smembers(WAITLIST_EMAILS_SET_KEY);
		return emails;
	} catch (error) {
		console.error("Error getting waitlist emails:", error);
		return [];
	}
}
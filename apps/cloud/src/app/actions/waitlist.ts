"use server";

import { z } from "zod";
import { redis, REDIS_KEYS } from "~/lib/redis";

export type WaitlistState =
	| { status: "idle" }
	| { status: "success"; message: string }
	| { status: "error"; error: string }
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

interface WaitlistEntry {
	email: string;
	timestamp: string;
}

export async function joinWaitlistAction(
	prevState: WaitlistState | null,
	formData: FormData,
): Promise<WaitlistState> {
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

		// Check if email already exists in the hash
		const exists = await redis.hexists(REDIS_KEYS.WAITLIST, email);
		if (exists) {
			return {
				status: "error",
				error: "This email is already on the waitlist!",
			};
		}

		// Create waitlist entry
		const entry: WaitlistEntry = {
			email,
			timestamp: new Date().toISOString(),
		};

		// Add to hash (field = email, value = JSON data)
		await redis.hset(REDIS_KEYS.WAITLIST, {
			[email]: JSON.stringify(entry),
		});

		return {
			status: "success",
			message:
				"Successfully joined the waitlist! We'll notify you when Lightfast Cloud is ready.",
		};
	} catch (error) {
		console.error("Waitlist error:", error);
		return {
			status: "error",
			error:
				error instanceof Error
					? error.message
					: "Something went wrong. Please try again.",
		};
	}
}

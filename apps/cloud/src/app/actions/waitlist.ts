"use server";

import { z } from "zod";

export interface WaitlistState {
	success?: boolean;
	message?: string;
	error?: string;
	fieldErrors?: {
		email?: string[];
	};
}

const waitlistSchema = z.object({
	email: z
		.string()
		.min(1, "Email is required")
		.email("Please enter a valid email address")
		.toLowerCase()
		.trim(),
});

export async function joinWaitlistAction(
	prevState: WaitlistState | null,
	formData: FormData
): Promise<WaitlistState> {
	try {
		// Parse and validate form data
		const validatedFields = waitlistSchema.safeParse({
			email: formData.get("email"),
		});
		
		// Return field errors if validation fails
		if (!validatedFields.success) {
			return {
				success: false,
				fieldErrors: validatedFields.error.flatten().fieldErrors,
				error: "Please fix the errors below"
			};
		}
		
		const { email: _email } = validatedFields.data;
		
		// TODO: Implement actual waitlist logic (save to database, send to CRM, etc.)
		// For now, just simulate a delay and return success
		await new Promise(resolve => setTimeout(resolve, 1000));
		
		
		return {
			success: true,
			message: "Successfully joined the waitlist! We'll notify you when Lightfast Cloud is ready."
		};
	} catch (error) {
		console.error("Waitlist error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Something went wrong. Please try again."
		};
	}
}
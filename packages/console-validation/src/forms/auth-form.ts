import { z } from "zod";

/**
 * Auth Email Form Schema
 *
 * Used in:
 * - /apps/auth/src/app/(app)/(auth)/_components/sign-in-email-input.tsx
 * - /apps/auth/src/app/(app)/(auth)/_components/sign-up-email-input.tsx
 */
export const authEmailFormSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

export type AuthEmailFormValues = z.infer<typeof authEmailFormSchema>;

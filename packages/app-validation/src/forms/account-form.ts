/**
 * Account Form Schemas
 *
 * Client-side validation schemas for personal-account forms.
 * Used with React Hook Form + zodResolver.
 */

import { z } from "zod";

/**
 * Account Settings Form Schema
 *
 * The single display name is stored in Clerk's firstName (lastName cleared).
 */
export const accountSettingsFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(100, "Display name must be 100 characters or fewer"),
});

export type AccountSettingsFormValues = z.infer<
  typeof accountSettingsFormSchema
>;

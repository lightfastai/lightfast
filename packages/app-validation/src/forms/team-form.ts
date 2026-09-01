/**
 * Team Form Schemas
 *
 * Client-side validation schemas for team/organization-related forms.
 * Used with React Hook Form + zodResolver.
 */

import { z } from "zod";
import { clerkOrgSlugSchema } from "../primitives/slugs";

/**
 * Team Settings Form Schema
 */
export const teamSettingsFormSchema = z.object({
  teamName: clerkOrgSlugSchema,
});

export type TeamSettingsFormValues = z.infer<typeof teamSettingsFormSchema>;

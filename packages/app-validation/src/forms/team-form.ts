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
 *
 * Used in:
 * - apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx
 */
export const teamSettingsFormSchema = z.object({
  teamName: clerkOrgSlugSchema,
});

export type TeamSettingsFormValues = z.infer<typeof teamSettingsFormSchema>;

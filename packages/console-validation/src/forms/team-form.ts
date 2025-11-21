/**
 * Team Form Schemas
 *
 * Client-side validation schemas for team/organization-related forms.
 * Used with React Hook Form + zodResolver.
 */

import { z } from "zod";
import { clerkOrgSlugSchema } from "../primitives/slugs";

/**
 * Team Creation Form Schema
 *
 * Used in:
 * - /apps/console/src/app/(app)/account/teams/new/page.tsx
 *
 * @example
 * ```typescript
 * const form = useForm<TeamFormValues>({
 *   resolver: zodResolver(teamFormSchema),
 *   defaultValues: { teamName: "" },
 * });
 * ```
 */
export const teamFormSchema = z.object({
  teamName: clerkOrgSlugSchema,
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

/**
 * Team Settings Form Schema
 *
 * Used in:
 * - /apps/console/src/app/(app)/[slug]/settings/page.tsx
 *
 * @example
 * ```typescript
 * const form = useForm<TeamSettingsFormValues>({
 *   resolver: zodResolver(teamSettingsFormSchema),
 *   defaultValues: { teamName: currentOrg.slug },
 * });
 * ```
 */
export const teamSettingsFormSchema = z.object({
  teamName: clerkOrgSlugSchema,
});

export type TeamSettingsFormValues = z.infer<typeof teamSettingsFormSchema>;

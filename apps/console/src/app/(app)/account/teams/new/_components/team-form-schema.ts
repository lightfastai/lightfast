import { z } from "zod";
import {
  CLERK_ORG_SLUG,
  NAMING_ERRORS,
} from "@db/console/constants/naming";

/**
 * Team Creation Form Schema
 *
 * Validation rules (Clerk organization slug):
 * - Min 3 chars, max 39 chars (matches GitHub org limit)
 * - Lowercase alphanumeric + hyphens only
 * - Must start and end with letter or number
 * - Cannot contain consecutive hyphens
 */
export const teamFormSchema = z.object({
  teamName: z
    .string()
    .min(CLERK_ORG_SLUG.MIN_LENGTH, NAMING_ERRORS.ORG_MIN_LENGTH)
    .max(CLERK_ORG_SLUG.MAX_LENGTH, NAMING_ERRORS.ORG_MAX_LENGTH)
    .regex(CLERK_ORG_SLUG.PATTERN, NAMING_ERRORS.ORG_PATTERN)
    .regex(CLERK_ORG_SLUG.START_PATTERN, NAMING_ERRORS.ORG_START)
    .regex(CLERK_ORG_SLUG.END_PATTERN, NAMING_ERRORS.ORG_END)
    .refine((val) => !CLERK_ORG_SLUG.NO_CONSECUTIVE_HYPHENS.test(val), {
      message: NAMING_ERRORS.ORG_CONSECUTIVE,
    }),
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

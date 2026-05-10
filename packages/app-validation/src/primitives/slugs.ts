/**
 * Org Slug Validation
 *
 * Validates org slugs for Clerk + GitHub-org constraints.
 */

import { organization } from "@repo/app-reserved-names";
import { z } from "zod";

/**
 * Clerk Organization Slug Constraints
 *
 * - Max 39 chars (matches GitHub organization name limit)
 * - Lowercase alphanumeric + hyphens only
 * - Must start/end with letter or number
 * - No consecutive hyphens
 */
const CLERK_ORG_SLUG = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 39,
  PATTERN: /^[a-z0-9-]+$/,
  START_PATTERN: /^[a-z0-9]/,
  END_PATTERN: /[a-z0-9]$/,
  NO_CONSECUTIVE_HYPHENS: /--/,
} as const;

const NAMING_ERRORS = {
  ORG_MIN_LENGTH: `Team name must be at least ${CLERK_ORG_SLUG.MIN_LENGTH} characters`,
  ORG_MAX_LENGTH: `Team name must be less than ${CLERK_ORG_SLUG.MAX_LENGTH} characters`,
  ORG_PATTERN: "Only lowercase letters, numbers, and hyphens are allowed",
  ORG_START: "Must start with a letter or number",
  ORG_END: "Must end with a letter or number",
  ORG_CONSECUTIVE: "Cannot contain consecutive hyphens",
  ORG_RESERVED:
    "This name is reserved for system use. Please choose a different name.",
} as const;

export const clerkOrgSlugSchema = z
  .string()
  .min(CLERK_ORG_SLUG.MIN_LENGTH, NAMING_ERRORS.ORG_MIN_LENGTH)
  .max(CLERK_ORG_SLUG.MAX_LENGTH, NAMING_ERRORS.ORG_MAX_LENGTH)
  .regex(CLERK_ORG_SLUG.PATTERN, NAMING_ERRORS.ORG_PATTERN)
  .regex(CLERK_ORG_SLUG.START_PATTERN, NAMING_ERRORS.ORG_START)
  .regex(CLERK_ORG_SLUG.END_PATTERN, NAMING_ERRORS.ORG_END)
  .refine((val) => !CLERK_ORG_SLUG.NO_CONSECUTIVE_HYPHENS.test(val), {
    message: NAMING_ERRORS.ORG_CONSECUTIVE,
  })
  .refine((slug) => !organization.check(slug), {
    message: NAMING_ERRORS.ORG_RESERVED,
  });

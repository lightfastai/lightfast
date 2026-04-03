/**
 * Slug Validation Primitives
 *
 * Reusable Zod schemas for validating slugs (org, workspace, store).
 * All slugs are URL-safe and follow specific naming conventions.
 */

import { organization } from "@repo/app-reserved-names";
import { z } from "zod";
import { CLERK_ORG_SLUG, NAMING_ERRORS, STORE_NAME } from "../constants/naming";

/**
 * Clerk Organization Slug Schema
 *
 * Validates organization slugs according to Clerk constraints:
 * - 3-39 characters (matches GitHub organization name limit)
 * - Lowercase alphanumeric + hyphens only
 * - Must start/end with letter or number
 * - No consecutive hyphens
 * - Cannot use reserved names (case-insensitive)
 *
 * Used in: Team creation, org settings, URL slugs
 *
 * @example
 * ```typescript
 * clerkOrgSlugSchema.parse("lightfast-ai"); // ✅ Valid
 * clerkOrgSlugSchema.parse("Light Fast AI"); // ❌ No spaces/uppercase
 * clerkOrgSlugSchema.parse("-invalid"); // ❌ Cannot start with hyphen
 * clerkOrgSlugSchema.parse("test--org"); // ❌ No consecutive hyphens
 * clerkOrgSlugSchema.parse("pricing"); // ❌ Reserved name
 * clerkOrgSlugSchema.parse("api"); // ❌ Reserved name
 * ```
 */
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

/**
 * Store Name Schema
 *
 * Validates store names for Pinecone index naming:
 * - 1-20 characters
 * - Lowercase alphanumeric + hyphens
 * - Must start/end with letter or number
 * - No consecutive hyphens
 *
 * Used in: Store creation, Pinecone index naming
 *
 * @example
 * ```typescript
 * storeNameSchema.parse("docs"); // ✅ Valid
 * storeNameSchema.parse("kb-v2"); // ✅ Valid
 * storeNameSchema.parse("My-Store"); // ❌ Must be lowercase
 * storeNameSchema.parse("-store"); // ❌ Cannot start with hyphen
 * storeNameSchema.parse("store--name"); // ❌ No consecutive hyphens
 * ```
 */
export const storeNameSchema = z
  .string()
  .min(STORE_NAME.MIN_LENGTH, NAMING_ERRORS.STORE_MIN_LENGTH)
  .max(STORE_NAME.MAX_LENGTH, NAMING_ERRORS.STORE_MAX_LENGTH)
  .regex(STORE_NAME.PATTERN, NAMING_ERRORS.STORE_PATTERN)
  .regex(STORE_NAME.START_PATTERN, NAMING_ERRORS.STORE_START)
  .regex(STORE_NAME.END_PATTERN, NAMING_ERRORS.STORE_END)
  .refine((val) => !STORE_NAME.NO_CONSECUTIVE_HYPHENS.test(val), {
    message: NAMING_ERRORS.STORE_CONSECUTIVE,
  });

/**
 * Repository Full Name Schema
 *
 * Validates GitHub repository full name (owner/repo format)
 * - Pattern: owner/repo
 * - Owner: alphanumeric + hyphens/underscores/periods
 * - Repo: same as owner
 *
 * Used in: GitHub integration, repository management
 *
 * @example
 * ```typescript
 * repositoryFullNameSchema.parse("lightfastai/lightfast"); // ✅ Valid
 * repositoryFullNameSchema.parse("my-org/repo_name"); // ✅ Valid
 * repositoryFullNameSchema.parse("invalid"); // ❌ Must have owner/repo format
 * repositoryFullNameSchema.parse("owner / repo"); // ❌ No spaces
 * ```
 */
export const repositoryFullNameSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
    "Invalid GitHub repository format (expected: owner/repo)"
  );

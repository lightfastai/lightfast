/**
 * Slug Validation Primitives
 *
 * Reusable Zod schemas for validating slugs (org, workspace, store).
 * All slugs are URL-safe and follow specific naming conventions.
 */

import { z } from "zod";
import {
  CLERK_ORG_SLUG,
  WORKSPACE_NAME,
  STORE_NAME,
  NAMING_ERRORS,
} from "../constants/naming";

/**
 * Clerk Organization Slug Schema
 *
 * Validates organization slugs according to Clerk constraints:
 * - 3-39 characters (matches GitHub organization name limit)
 * - Lowercase alphanumeric + hyphens only
 * - Must start/end with letter or number
 * - No consecutive hyphens
 *
 * Used in: Team creation, org settings, URL slugs
 *
 * @example
 * ```typescript
 * clerkOrgSlugSchema.parse("lightfast-ai"); // ✅ Valid
 * clerkOrgSlugSchema.parse("Light Fast AI"); // ❌ No spaces/uppercase
 * clerkOrgSlugSchema.parse("-invalid"); // ❌ Cannot start with hyphen
 * clerkOrgSlugSchema.parse("test--org"); // ❌ No consecutive hyphens
 * ```
 */
export const clerkOrgSlugSchema = z
  .string()
  .min(CLERK_ORG_SLUG.MIN_LENGTH, NAMING_ERRORS.ORG_MIN_LENGTH)
  .max(CLERK_ORG_SLUG.MAX_LENGTH, NAMING_ERRORS.ORG_MAX_LENGTH)
  .regex(CLERK_ORG_SLUG.PATTERN, NAMING_ERRORS.ORG_PATTERN)
  .regex(CLERK_ORG_SLUG.START_PATTERN, NAMING_ERRORS.ORG_START)
  .regex(CLERK_ORG_SLUG.END_PATTERN, NAMING_ERRORS.ORG_END)
  .refine(
    (val) => !CLERK_ORG_SLUG.NO_CONSECUTIVE_HYPHENS.test(val),
    { message: NAMING_ERRORS.ORG_CONSECUTIVE }
  );

/**
 * Workspace Name Schema (User-Facing)
 *
 * Validates user-facing workspace names:
 * - 1-100 characters (GitHub repo naming rules)
 * - Alphanumeric + hyphens, periods, underscores
 * - URL-safe without encoding (. _ - don't need escaping)
 * - Can start/end with any allowed character
 *
 * Used in: Workspace creation, workspace settings, URL paths
 *
 * @example
 * ```typescript
 * workspaceNameSchema.parse("my-awesome-project"); // ✅ Valid
 * workspaceNameSchema.parse("Project_v2.0"); // ✅ Valid (periods, underscores)
 * workspaceNameSchema.parse("my project"); // ❌ No spaces
 * workspaceNameSchema.parse("project@2024"); // ❌ No special chars
 * ```
 */
export const workspaceNameSchema = z
  .string()
  .min(WORKSPACE_NAME.MIN_LENGTH, NAMING_ERRORS.WORKSPACE_MIN_LENGTH)
  .max(WORKSPACE_NAME.MAX_LENGTH, NAMING_ERRORS.WORKSPACE_MAX_LENGTH)
  .regex(WORKSPACE_NAME.PATTERN, NAMING_ERRORS.WORKSPACE_PATTERN);

/**
 * Workspace Slug Schema (Internal, Pinecone)
 *
 * Validates internal workspace slugs:
 * - 1-20 characters (Pinecone constraint)
 * - Lowercase alphanumeric + hyphens only
 * - No leading/trailing/consecutive hyphens
 *
 * Used in: Pinecone namespace naming, internal references
 * Generated from workspace name via generateWorkspaceSlug()
 *
 * @example
 * ```typescript
 * workspaceSlugSchema.parse("robust-chicken"); // ✅ Valid
 * workspaceSlugSchema.parse("my-workspace-123"); // ✅ Valid
 * workspaceSlugSchema.parse("My-Workspace"); // ❌ Must be lowercase
 * workspaceSlugSchema.parse("-invalid-"); // ❌ No leading/trailing hyphens
 * workspaceSlugSchema.parse("test--slug"); // ❌ No consecutive hyphens
 * ```
 */
export const workspaceSlugSchema = z
  .string()
  .min(1, "Workspace slug must not be empty")
  .max(20, "Workspace slug must be 20 characters or less")
  .regex(
    /^[a-z0-9-]+$/,
    "Workspace slug must be lowercase alphanumeric with hyphens"
  )
  .refine(
    (slug) => !/^-|-$|--/.test(slug),
    "Workspace slug cannot have leading/trailing/consecutive hyphens"
  );

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
  .refine(
    (val) => !STORE_NAME.NO_CONSECUTIVE_HYPHENS.test(val),
    { message: NAMING_ERRORS.STORE_CONSECUTIVE }
  );

/**
 * Store Slug Schema (Internal)
 *
 * Same as storeNameSchema - stores use name as slug.
 * Kept as separate export for consistency with workspace patterns.
 */
export const storeSlugSchema = storeNameSchema;

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

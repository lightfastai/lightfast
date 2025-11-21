/**
 * Organization Validation Schemas
 *
 * Domain-specific validation for organization-related operations.
 * Used in tRPC procedures for organization lookup and management.
 */

import { z } from "zod";
import {
  clerkOrgIdSchema,
  clerkUserIdSchema,
} from "../primitives/ids";
import { clerkOrgSlugSchema } from "../primitives/slugs";

/**
 * Organization Lookup by ID Input Schema
 *
 * Used in:
 * - tRPC organization.findByClerkOrgId procedure
 *
 * @example
 * ```typescript
 * const input = organizationFindByIdInputSchema.parse({
 *   clerkOrgId: "org_2abcdef123",
 * });
 * ```
 */
export const organizationFindByIdInputSchema = z.object({
  clerkOrgId: clerkOrgIdSchema,
});

export type OrganizationFindByIdInput = z.infer<
  typeof organizationFindByIdInputSchema
>;

/**
 * Organization Lookup by Slug Input Schema
 *
 * Used in:
 * - tRPC organization.findByClerkOrgSlug procedure
 *
 * @example
 * ```typescript
 * const input = organizationFindBySlugInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 * });
 * ```
 */
export const organizationFindBySlugInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
});

export type OrganizationFindBySlugInput = z.infer<
  typeof organizationFindBySlugInputSchema
>;

/**
 * Organization Create or Get Input Schema
 *
 * Used in:
 * - tRPC clerk.createOrGetOrganization procedure
 *
 * @example
 * ```typescript
 * const input = organizationCreateOrGetInputSchema.parse({
 *   userId: "user_2abcdef123",
 *   orgName: "Lightfast AI",
 *   orgSlug: "lightfast-ai",
 * });
 * ```
 */
export const organizationCreateOrGetInputSchema = z.object({
  userId: clerkUserIdSchema,
  orgName: z.string().min(1, "Organization name must not be empty"),
  orgSlug: clerkOrgSlugSchema,
});

export type OrganizationCreateOrGetInput = z.infer<
  typeof organizationCreateOrGetInputSchema
>;

/**
 * Organization Add User Input Schema
 *
 * Used in:
 * - tRPC clerk.addUserToOrganization procedure
 *
 * @example
 * ```typescript
 * const input = organizationAddUserInputSchema.parse({
 *   clerkOrgId: "org_2abcdef123",
 *   userId: "user_2abcdef123",
 *   githubToken: "ghp_...",
 *   githubOrgSlug: "lightfastai",
 *   githubUsername: "johndoe",
 * });
 * ```
 */
export const organizationAddUserInputSchema = z.object({
  clerkOrgId: clerkOrgIdSchema,
  userId: clerkUserIdSchema,
  githubToken: z.string().min(1, "GitHub token must not be empty"),
  githubOrgSlug: z.string().min(1, "GitHub org slug must not be empty"),
  githubUsername: z.string().min(1, "GitHub username must not be empty"),
});

export type OrganizationAddUserInput = z.infer<
  typeof organizationAddUserInputSchema
>;

/**
 * GitHub Role Enum
 *
 * Maps GitHub organization roles to Clerk roles
 */
export const githubRoleSchema = z.enum(["admin", "member"]);

export type GitHubRole = z.infer<typeof githubRoleSchema>;

/**
 * Organization Map Role Input Schema
 *
 * Used in:
 * - tRPC clerk.mapRole procedure
 *
 * @example
 * ```typescript
 * const input = organizationMapRoleInputSchema.parse({
 *   githubRole: "admin",
 * });
 * ```
 */
export const organizationMapRoleInputSchema = z.object({
  githubRole: githubRoleSchema,
});

export type OrganizationMapRoleInput = z.infer<
  typeof organizationMapRoleInputSchema
>;

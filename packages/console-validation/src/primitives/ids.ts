/**
 * ID Validation Primitives
 *
 * Reusable Zod schemas for validating various ID formats used across the application.
 */

import { z } from "zod";

/**
 * Nanoid Schema
 *
 * Validates nanoid format (default 21 characters, URL-safe)
 * Used for: workspace IDs, job IDs, API key IDs, document IDs, etc.
 *
 * @example
 * ```typescript
 * nanoidSchema.parse("V1StGXR8_Z5jdHi6B-myT"); // ✅ Valid
 * nanoidSchema.parse("invalid!@#"); // ❌ Invalid characters
 * ```
 */
export const nanoidSchema = z
  .string()
  .length(21, "Invalid ID format")
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid ID characters");

/**
 * Clerk User ID Schema
 *
 * Validates Clerk user IDs (format: user_*)
 *
 * @example
 * ```typescript
 * clerkUserIdSchema.parse("user_2abcdef123"); // ✅ Valid
 * clerkUserIdSchema.parse("invalid_123"); // ❌ Must start with user_
 * ```
 */
export const clerkUserIdSchema = z
  .string()
  .startsWith("user_", "Invalid user ID format");

/**
 * Clerk Organization ID Schema
 *
 * Validates Clerk organization IDs (format: org_*)
 *
 * @example
 * ```typescript
 * clerkOrgIdSchema.parse("org_2abcdef123"); // ✅ Valid
 * clerkOrgIdSchema.parse("user_123"); // ❌ Must start with org_
 * ```
 */
export const clerkOrgIdSchema = z
  .string()
  .startsWith("org_", "Invalid organization ID format");

/**
 * GitHub Installation ID Schema
 *
 * Validates GitHub App installation IDs (numeric string)
 *
 * @example
 * ```typescript
 * githubInstallationIdSchema.parse("12345678"); // ✅ Valid
 * githubInstallationIdSchema.parse("abc123"); // ❌ Must be numeric
 * ```
 */
export const githubInstallationIdSchema = z
  .string()
  .regex(/^\d+$/, "Invalid GitHub installation ID");

/**
 * GitHub Repository ID Schema
 *
 * Validates GitHub repository IDs (numeric string)
 *
 * @example
 * ```typescript
 * githubRepoIdSchema.parse("987654321"); // ✅ Valid
 * githubRepoIdSchema.parse("not-a-number"); // ❌ Must be numeric
 * ```
 */
export const githubRepoIdSchema = z
  .string()
  .regex(/^\d+$/, "Invalid GitHub repository ID");

/**
 * UUID v4 Schema
 *
 * Validates UUID v4 format (used in chat app for usage records, etc.)
 *
 * @example
 * ```typescript
 * uuidSchema.parse("550e8400-e29b-41d4-a716-446655440000"); // ✅ Valid
 * uuidSchema.parse("not-a-uuid"); // ❌ Invalid format
 * ```
 */
export const uuidSchema = z
  .string()
  .uuid("Invalid UUID format");

/**
 * Inngest Run ID Schema
 *
 * Validates Inngest run IDs (UUID format with optional prefix)
 *
 * @example
 * ```typescript
 * inngestRunIdSchema.parse("01HE8X7ZQK6YG9B5R8J9QVXT0Q"); // ✅ Valid ULID
 * ```
 */
export const inngestRunIdSchema = z
  .string()
  .min(1, "Inngest run ID must not be empty");

/**
 * Inngest Function ID Schema
 *
 * Validates Inngest function IDs (slug format)
 *
 * @example
 * ```typescript
 * inngestFunctionIdSchema.parse("apps-console/docs.push"); // ✅ Valid
 * inngestFunctionIdSchema.parse("invalid space"); // ❌ Invalid characters
 * ```
 */
export const inngestFunctionIdSchema = z
  .string()
  .regex(/^[a-z0-9-/]+$/, "Invalid Inngest function ID format");

/**
 * Name Validation Primitives
 *
 * Reusable Zod schemas for validating display names, labels, and descriptions.
 */

import { z } from "zod";

/**
 * Display Name Schema
 *
 * User-facing display names (integrations, repositories, connections, etc.)
 * - 1-255 characters
 * - No strict pattern enforcement (allow spaces, special chars)
 * - Trimmed whitespace
 *
 * Used in: Integration names, repository display names, source names
 *
 * @example
 * ```typescript
 * displayNameSchema.parse("My Awesome Repository"); // ✅ Valid
 * displayNameSchema.parse("Project #1 (2024)"); // ✅ Valid (special chars)
 * displayNameSchema.parse("  spaced  "); // ✅ Valid (trimmed to "spaced")
 * displayNameSchema.parse(""); // ❌ Must not be empty
 * ```
 */
export const displayNameSchema = z
  .string()
  .min(1, "Name must not be empty")
  .max(255, "Name must be 255 characters or less")
  .trim();

/**
 * API Key Name Schema
 *
 * API key description/label
 * - 1-100 characters
 * - Trimmed whitespace
 * - Allows any characters (free-form description)
 *
 * Used in: API key creation, API key management
 *
 * @example
 * ```typescript
 * apiKeyNameSchema.parse("Production API Key"); // ✅ Valid
 * apiKeyNameSchema.parse("CLI Tool - v2.0"); // ✅ Valid
 * apiKeyNameSchema.parse("  my key  "); // ✅ Valid (trimmed to "my key")
 * apiKeyNameSchema.parse(""); // ❌ Must not be empty
 * ```
 */
export const apiKeyNameSchema = z
  .string()
  .min(1, "API key name must not be empty")
  .max(100, "API key name must be 100 characters or less")
  .trim();

/**
 * Job Name Schema
 *
 * Human-readable job name/description
 * - 1-191 characters
 * - Trimmed whitespace
 * - Allows any characters
 *
 * Used in: Background job tracking, workflow names
 *
 * @example
 * ```typescript
 * jobNameSchema.parse("Document Ingestion"); // ✅ Valid
 * jobNameSchema.parse("Sync GitHub PR #123"); // ✅ Valid
 * jobNameSchema.parse(""); // ❌ Must not be empty
 * ```
 */
export const jobNameSchema = z
  .string()
  .min(1, "Job name must not be empty")
  .max(191, "Job name must be 191 characters or less")
  .trim();

/**
 * Integration Display Name Schema
 *
 * Display name for connected integrations
 * - 1-255 characters
 * - Trimmed whitespace
 *
 * Used in: GitHub integration names, Linear integration names, etc.
 *
 * @example
 * ```typescript
 * integrationDisplayNameSchema.parse("GitHub: lightfastai"); // ✅ Valid
 * integrationDisplayNameSchema.parse("Linear Workspace"); // ✅ Valid
 * ```
 */
export const integrationDisplayNameSchema = displayNameSchema;

/**
 * Source Identifier Schema
 *
 * Source-specific external identifier (e.g., GitHub repo ID, Linear issue ID)
 * - 1-255 characters
 * - Usually numeric or alphanumeric
 *
 * Used in: Connected sources, document source tracking
 *
 * @example
 * ```typescript
 * sourceIdentifierSchema.parse("123456789"); // ✅ Valid (GitHub repo ID)
 * sourceIdentifierSchema.parse("PROJ-123"); // ✅ Valid (Linear issue ID)
 * sourceIdentifierSchema.parse("abc-def-ghi"); // ✅ Valid (any format)
 * ```
 */
export const sourceIdentifierSchema = z
  .string()
  .min(1, "Source identifier must not be empty")
  .max(255, "Source identifier must be 255 characters or less");

export type SourceIdentifier = z.infer<typeof sourceIdentifierSchema>;

/**
 * Content Hash Schema
 *
 * SHA-256 hash for content deduplication
 * - Exactly 64 characters (SHA-256 hex representation)
 * - Hexadecimal characters only
 *
 * Used in: Document content hashing, config hashing
 *
 * @example
 * ```typescript
 * contentHashSchema.parse("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"); // ✅ Valid
 * contentHashSchema.parse("invalid"); // ❌ Must be 64 chars
 * contentHashSchema.parse("xyz123..."); // ❌ Must be hexadecimal
 * ```
 */
export const contentHashSchema = z
  .string()
  .length(64, "Content hash must be exactly 64 characters (SHA-256)")
  .regex(/^[a-f0-9]{64}$/, "Content hash must be hexadecimal");

export type ContentHash = z.infer<typeof contentHashSchema>;

/**
 * Document Slug Schema
 *
 * URL-friendly document slug
 * - 1-256 characters
 * - Allows alphanumeric, hyphens, underscores, periods, slashes
 * - Trimmed whitespace
 *
 * Used in: Document URLs, document routing
 *
 * @example
 * ```typescript
 * documentSlugSchema.parse("getting-started/installation"); // ✅ Valid
 * documentSlugSchema.parse("api/v1/users"); // ✅ Valid
 * documentSlugSchema.parse("README.md"); // ✅ Valid
 * ```
 */
export const documentSlugSchema = z
  .string()
  .min(1, "Document slug must not be empty")
  .max(256, "Document slug must be 256 characters or less")
  .regex(
    /^[a-zA-Z0-9_.\/-]+$/,
    "Document slug can only contain alphanumeric, hyphens, underscores, periods, and slashes"
  )
  .trim();

export type DocumentSlug = z.infer<typeof documentSlugSchema>;

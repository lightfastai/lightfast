/**
 * Naming Constraints and Validation Constants
 *
 * Centralized naming rules for organizations and workspaces to ensure:
 * - URL compatibility
 * - External system constraints (Pinecone, GitHub, Clerk)
 * - Consistent validation across frontend and backend
 *
 * **This is the single source of truth for all naming rules.**
 */

/**
 * Clerk Organization Slug Constraints
 *
 * Used for team/organization creation (Clerk orgs)
 * URL format: /{orgSlug}/{workspaceSlug}
 *
 * Constraints:
 * - Max 39 chars (matches GitHub organization name limit)
 * - Lowercase alphanumeric + hyphens only
 * - Must start/end with letter or number
 * - No consecutive hyphens
 */
export const CLERK_ORG_SLUG = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 39, // GitHub org max
  PATTERN: /^[a-z0-9-]+$/,
  START_PATTERN: /^[a-z0-9]/,
  END_PATTERN: /[a-z0-9]$/,
  NO_CONSECUTIVE_HYPHENS: /--/,
} as const;

/**
 * Workspace Name Constraints
 *
 * Used for workspace creation within organizations
 * URL format: /{orgSlug}/{workspaceName}
 *
 * Design:
 * - **name**: User-specified, used in URLs, follows GitHub repo naming rules
 * - **slug**: Internal identifier, auto-generated, never shown to users
 *
 * Constraints aligned with GitHub repository naming:
 * - Allows: alphanumeric (A-Z, a-z, 0-9), hyphens (-), periods (.), underscores (_)
 * - Pattern: ^[A-Za-z0-9_.-]+$
 * - Max 100 chars (GitHub allows 100, we keep it reasonable for URLs)
 * - Can start/end with any allowed character
 * - URL-safe without encoding (., _, - don't need escaping)
 */
export const WORKSPACE_NAME = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 100, // GitHub repo name limit
  PATTERN: /^[A-Za-z0-9_.-]+$/,
} as const;

/**
 * Store Name Constraints
 *
 * Used for vector store naming within workspaces
 * Part of Pinecone index: ws-{workspaceSlug}-{storeSlug}
 */
export const STORE_NAME = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 20, // Pinecone constraint
  PATTERN: /^[a-z0-9-]+$/,
  START_PATTERN: /^[a-z0-9]/,
  END_PATTERN: /[a-z0-9]$/,
  NO_CONSECUTIVE_HYPHENS: /--/,
} as const;

/**
 * Reserved Names
 *
 * Names that cannot be used for organizations or workspaces to prevent routing conflicts.
 * These names are reserved for app routes, features, and critical system paths.
 *
 * Organization URL format: /{orgSlug}
 * Workspace URL format: /{orgSlug}/{workspaceName}
 *
 * Reserved paths prevent conflicts with:
 * - Microfrontends routes (e.g., /pricing, /sign-in handled by www/auth apps)
 * - Organization routes (e.g., /{orgSlug}/settings)
 * - HTTP status codes (e.g., /404, /500)
 * - Framework internals (e.g., /_next, .well-known)
 *
 * @see @repo/console-reserved-names for full list and rationale
 */
import { workspace, organization } from '@repo/console-reserved-names';

/**
 * @deprecated Use @repo/console-reserved-names package directly
 * This re-export is kept for backward compatibility
 */
export const RESERVED_WORKSPACE_NAMES = workspace.all;

/**
 * Reserved organization slugs to prevent routing conflicts
 *
 * These prevent orgs from hijacking:
 * - Microfrontends routes: /pricing → www app (not org "pricing")
 * - Auth routes: /sign-in → auth app (not org "sign-in")
 * - System routes: /api, /health, etc.
 * - Error pages: /404, /500, etc.
 */
export const RESERVED_ORGANIZATION_SLUGS = organization.all;

/**
 * Error Messages
 */
export const NAMING_ERRORS = {
  ORG_MIN_LENGTH: `Team name must be at least ${CLERK_ORG_SLUG.MIN_LENGTH} characters`,
  ORG_MAX_LENGTH: `Team name must be less than ${CLERK_ORG_SLUG.MAX_LENGTH} characters`,
  ORG_PATTERN: "Only lowercase letters, numbers, and hyphens are allowed",
  ORG_START: "Must start with a letter or number",
  ORG_END: "Must end with a letter or number",
  ORG_CONSECUTIVE: "Cannot contain consecutive hyphens",

  WORKSPACE_MIN_LENGTH: `Workspace name must be at least ${WORKSPACE_NAME.MIN_LENGTH} character`,
  WORKSPACE_MAX_LENGTH: `Workspace name must be ${WORKSPACE_NAME.MAX_LENGTH} characters or less`,
  WORKSPACE_PATTERN: "Only letters, numbers, hyphens (-), periods (.), and underscores (_) are allowed",
  WORKSPACE_RESERVED: "This name is reserved for system use. Please choose a different name.",

  STORE_MIN_LENGTH: `Store name must be at least ${STORE_NAME.MIN_LENGTH} characters`,
  STORE_MAX_LENGTH: `Store name must be less than ${STORE_NAME.MAX_LENGTH} characters`,
  STORE_PATTERN: "Only lowercase letters, numbers, and hyphens are allowed",
  STORE_START: "Must start with a letter or number",
  STORE_END: "Must end with a letter or number",
  STORE_CONSECUTIVE: "Cannot contain consecutive hyphens",
} as const;

/**
 * Validation Helpers
 */

export function validateOrgSlug(slug: string): {
  valid: boolean;
  error?: string;
} {
  if (slug.length < CLERK_ORG_SLUG.MIN_LENGTH) {
    return { valid: false, error: NAMING_ERRORS.ORG_MIN_LENGTH };
  }
  if (slug.length > CLERK_ORG_SLUG.MAX_LENGTH) {
    return { valid: false, error: NAMING_ERRORS.ORG_MAX_LENGTH };
  }
  if (!CLERK_ORG_SLUG.PATTERN.test(slug)) {
    return { valid: false, error: NAMING_ERRORS.ORG_PATTERN };
  }
  if (!CLERK_ORG_SLUG.START_PATTERN.test(slug)) {
    return { valid: false, error: NAMING_ERRORS.ORG_START };
  }
  if (!CLERK_ORG_SLUG.END_PATTERN.test(slug)) {
    return { valid: false, error: NAMING_ERRORS.ORG_END };
  }
  if (CLERK_ORG_SLUG.NO_CONSECUTIVE_HYPHENS.test(slug)) {
    return { valid: false, error: NAMING_ERRORS.ORG_CONSECUTIVE };
  }
  return { valid: true };
}

export function validateWorkspaceName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (name.length < WORKSPACE_NAME.MIN_LENGTH) {
    return { valid: false, error: NAMING_ERRORS.WORKSPACE_MIN_LENGTH };
  }
  if (name.length > WORKSPACE_NAME.MAX_LENGTH) {
    return { valid: false, error: NAMING_ERRORS.WORKSPACE_MAX_LENGTH };
  }
  if (!WORKSPACE_NAME.PATTERN.test(name)) {
    return { valid: false, error: NAMING_ERRORS.WORKSPACE_PATTERN };
  }
  // Check reserved names (case-insensitive)
  if (RESERVED_WORKSPACE_NAMES.includes(name.toLowerCase() as any)) {
    return { valid: false, error: NAMING_ERRORS.WORKSPACE_RESERVED };
  }
  return { valid: true };
}

export function validateStoreName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (name.length < STORE_NAME.MIN_LENGTH) {
    return { valid: false, error: NAMING_ERRORS.STORE_MIN_LENGTH };
  }
  if (name.length > STORE_NAME.MAX_LENGTH) {
    return { valid: false, error: NAMING_ERRORS.STORE_MAX_LENGTH };
  }
  if (!STORE_NAME.PATTERN.test(name)) {
    return { valid: false, error: NAMING_ERRORS.STORE_PATTERN };
  }
  if (!STORE_NAME.START_PATTERN.test(name)) {
    return { valid: false, error: NAMING_ERRORS.STORE_START };
  }
  if (!STORE_NAME.END_PATTERN.test(name)) {
    return { valid: false, error: NAMING_ERRORS.STORE_END };
  }
  if (STORE_NAME.NO_CONSECUTIVE_HYPHENS.test(name)) {
    return { valid: false, error: NAMING_ERRORS.STORE_CONSECUTIVE };
  }
  return { valid: true };
}

/**
 * Naming Constants and Validation Helpers
 *
 * Re-exported from @db/console for convenience.
 * These are the single source of truth for all naming rules.
 */

export {
  // Organization constraints
  CLERK_ORG_SLUG,

  // Workspace constraints
  WORKSPACE_NAME,

  // Store constraints
  STORE_NAME,

  // Error messages
  NAMING_ERRORS,

  // Validation helper functions
  validateOrgSlug,
  validateWorkspaceName,
  validateStoreName,
} from "@db/console/constants/naming";

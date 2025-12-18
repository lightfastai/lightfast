/**
 * Naming Constants and Validation Helpers
 *
 * This is the single source of truth for all naming rules.
 * Exported from this package, used across console app and API.
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
} from "./naming";

/**
 * Embedding Configuration Defaults
 *
 * Single source of truth for embedding/vector storage configuration.
 */
export {
  PINECONE_DEFAULTS,
  EMBEDDING_MODEL_DEFAULTS,
  CHUNKING_DEFAULTS,
  EMBEDDING_DEFAULTS,
  type EmbeddingDefaults,
} from "./embedding";

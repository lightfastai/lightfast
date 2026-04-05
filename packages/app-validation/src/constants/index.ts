/**
 * Naming Constants and Validation Helpers
 *
 * This is the single source of truth for all naming rules.
 * Exported from this package, used across console app and API.
 */

/**
 * Embedding Configuration Defaults
 *
 * Single source of truth for embedding/vector storage configuration.
 */
export {
  CHUNKING_DEFAULTS,
  EMBEDDING_DEFAULTS,
  EMBEDDING_MODEL_DEFAULTS,
  type EmbeddingDefaults,
  PINECONE_DEFAULTS,
} from "./embedding";
export {
  // Organization constraints
  CLERK_ORG_SLUG,
  // Error messages
  NAMING_ERRORS,
  // Store constraints
  STORE_NAME,
  // Validation helper functions
  validateOrgSlug,
  validateStoreName,
} from "./naming";

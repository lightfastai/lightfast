/**
 * @repo/console-config
 *
 * Parse and validate lightfast.yml configuration files
 *
 * @packageDocumentation
 */

// Export glob utilities
export {
  matchesGlobs,
  matchFiles,
  validateGlobPatterns,
} from "./glob";
// Export parsing functions and errors
export { ConfigError, loadConfig, validateConfig } from "./parse";

// Export private infrastructure configuration
export {
  CHUNKING_CONFIG,
  EMBEDDING_CONFIG,
  GITHUB_CONFIG,
  PINECONE_CONFIG,
  PRIVATE_CONFIG,
  type PrivateConfig,
  RERANK_CONFIG,
} from "./private-config";
// Export schema and types
export { type LightfastConfig, LightfastConfigSchema } from "./schema";

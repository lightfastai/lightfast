/**
 * @repo/app-embed
 *
 * Console-specific embedding utilities with environment-aware provider selection.
 * Uses @vendor/embed for core embedding functionality.
 *
 * @packageDocumentation
 */

// Re-export types from vendor/embed
export type {
  EmbeddingProvider,
  EmbedRequest,
  EmbedResponse,
} from "@vendor/embed";

// Export console-specific utilities
export {
  createEmbeddingProvider,
  createEmbeddingProviderForWorkspace,
  type EmbeddingDefaults,
  type EmbeddingProviderConfig,
  embedTextsInBatches,
  resolveEmbeddingDefaults,
  type WorkspaceEmbeddingConfig,
} from "./utils";

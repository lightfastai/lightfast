/**
 * @repo/console-embed
 *
 * Embedding computation with swappable providers
 *
 * @packageDocumentation
 */

// Export types
export type {
  EmbedRequest,
  EmbedResponse,
  EmbeddingProvider,
} from "./types";

// Export Phase 1 provider (char-hash)
export {
  CharHashEmbedding,
  createCharHashEmbedding,
} from "./char-hash";

// Export Phase 2 placeholder (OpenAI - not implemented yet)
export {
  OpenAIEmbedding,
  createOpenAIEmbedding,
} from "./model";

// Export batch processing utilities
export { embedBatch } from "./batch";

// Export default provider for Phase 1
export { createCharHashEmbedding as createDefaultEmbedding } from "./char-hash";

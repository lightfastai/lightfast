/**
 * @vendor/embed
 *
 * Pure embedding provider abstraction layer.
 * Supports multiple providers (CharHash, Cohere, OpenAI) with a unified interface.
 *
 * @packageDocumentation
 */

// Export batch processing utilities
export { embedBatch } from "./batch";

// Export embedding providers
export {
  CharHashEmbedding,
  createCharHashEmbedding,
} from "./provider/char-hash";
export {
  CohereEmbedding,
  type CohereEmbeddingConfig,
  type CohereInputType,
  createCohereEmbedding,
} from "./provider/cohere";
export {
  createOpenAIEmbedding,
  OpenAIEmbedding,
} from "./provider/openai";
// Export types
export type { EmbeddingProvider, EmbedRequest, EmbedResponse } from "./types";

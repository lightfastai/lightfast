/**
 * @vendor/embed
 *
 * Pure embedding provider abstraction layer.
 * Supports multiple providers (CharHash, Cohere, OpenAI) with a unified interface.
 *
 * @packageDocumentation
 */

// Export types
export type { EmbedRequest, EmbedResponse, EmbeddingProvider } from "./types";

// Export embedding providers
export {
	CharHashEmbedding,
	createCharHashEmbedding,
} from "./provider/char-hash";

export {
	OpenAIEmbedding,
	createOpenAIEmbedding,
} from "./provider/openai";

export {
	CohereEmbedding,
	createCohereEmbedding,
	type CohereInputType,
	type CohereEmbeddingConfig,
} from "./provider/cohere";

// Export batch processing utilities
export { embedBatch } from "./batch";

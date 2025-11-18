/**
 * @repo/console-embed
 *
 * Console-specific embedding utilities with environment-aware provider selection.
 * Uses @vendor/embed for core embedding functionality.
 *
 * @packageDocumentation
 */

// Re-export types from vendor/embed
export type {
	EmbedRequest,
	EmbedResponse,
	EmbeddingProvider,
} from "@vendor/embed";

// Export console-specific utilities
export {
	resolveEmbeddingDefaults,
	createEmbeddingProvider,
	createEmbeddingProviderForStore,
	embedTextsInBatches,
	type EmbeddingDefaults,
	type EmbeddingProviderConfig,
	type StoreEmbeddingConfig,
} from "./utils";

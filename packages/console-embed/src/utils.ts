/**
 * Console-specific embedding utilities
 *
 * Provides environment-aware configuration and provider selection
 * for the console application.
 */

import type { EmbeddingProvider } from "@vendor/embed";
import { createCharHashEmbedding } from "@vendor/embed";
import { createCohereEmbedding } from "@vendor/embed";
import type { CohereInputType } from "@vendor/embed";
import { embedEnv } from "@vendor/embed/env";
import { EMBEDDING_CONFIG } from "@repo/console-config";

/**
 * Default embedding configuration
 */
export interface EmbeddingDefaults {
	/**
	 * Default embedding dimension
	 */
	dimension: number;

	/**
	 * Default model name
	 */
	model: string;
}

/**
 * Resolve default embedding configuration
 *
 * Returns the default embedding settings based on environment.
 * Uses Cohere if API key is available, otherwise falls back to CharHash.
 * Configuration values come from @repo/console-config.
 *
 * @returns Default embedding configuration
 *
 * @example
 * ```typescript
 * const defaults = resolveEmbeddingDefaults();
 * console.log(defaults.dimension); // 1024 (Cohere) or 1536 (CharHash)
 * ```
 */
export function resolveEmbeddingDefaults(): EmbeddingDefaults {
	if (embedEnv.COHERE_API_KEY) {
		// Use Cohere if API key is available
		return {
			dimension: EMBEDDING_CONFIG.cohere.dimension,
			model: EMBEDDING_CONFIG.cohere.model,
		};
	}

	// Fall back to CharHash for development
	return {
		dimension: EMBEDDING_CONFIG.charHash.dimension,
		model: EMBEDDING_CONFIG.charHash.model,
	};
}

/**
 * Embedding provider configuration
 */
export interface EmbeddingProviderConfig {
	/**
	 * Input type for embedding optimization
	 * - search_query: Optimize for search queries (short text, user intent)
	 * - search_document: Optimize for document indexing (long passages)
	 */
	inputType: "search_query" | "search_document";
}

/**
 * Create an embedding provider with automatic provider selection
 *
 * Automatically selects the best available provider:
 * 1. Cohere (if API key is available) - production quality
 * 2. CharHash (fallback) - development/testing
 *
 * @param config - Provider configuration
 * @returns Embedding provider instance
 *
 * @example
 * ```typescript
 * // For search queries
 * const queryProvider = createEmbeddingProvider({
 *   inputType: "search_query"
 * });
 *
 * // For document indexing
 * const docProvider = createEmbeddingProvider({
 *   inputType: "search_document"
 * });
 * ```
 */
export function createEmbeddingProvider(
	config: EmbeddingProviderConfig,
): EmbeddingProvider {
	if (embedEnv.COHERE_API_KEY) {
		// Use Cohere with input_type optimization
		return createCohereEmbedding({
			apiKey: embedEnv.COHERE_API_KEY,
			model: EMBEDDING_CONFIG.cohere.model,
			inputType: config.inputType as CohereInputType,
			dimension: EMBEDDING_CONFIG.cohere.dimension,
		});
	}

	// Fall back to CharHash (no input_type differentiation)
	return createCharHashEmbedding();
}

/**
 * Embed texts using the provided provider while respecting Cohere's 96-text limit.
 *
 * @param provider - Embedding provider_instance created via {@link createEmbeddingProvider}
 * @param items - Items containing the text content to embed
 * @param options - Optional batching configuration
 * @returns Ordered list of embedding vectors matching the input order
 */
export async function embedTextsInBatches(
	provider: EmbeddingProvider,
	items: Array<{ text: string }>,
	options: { batchSize?: number } = {},
): Promise<number[][]> {
	const batchSize = options.batchSize ?? 96;
	const embeddings: number[][] = [];

	if (items.length === 0) {
		return embeddings;
	}

	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		const response = await provider.embed(batch.map((item) => item.text));
		embeddings.push(...response.embeddings);
	}

	return embeddings;
}

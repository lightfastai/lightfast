/**
 * Console-specific embedding utilities
 *
 * Provides environment-aware configuration and provider selection
 * for the console application.
 */

import type { EmbeddingProvider } from "@vendor/embed";
import { createCohereEmbedding } from "@vendor/embed";
import type { CohereInputType } from "@vendor/embed";
import { embedEnv } from "@vendor/embed/env";
import { EMBEDDING_CONFIG } from "@repo/console-config";

/**
 * Default embedding configuration
 *
 * Note: Provider is stored separately in EMBEDDING_CONFIG.cohere.provider
 * and is validated against the database schema enum.
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
 * Returns the default embedding settings for Cohere.
 * COHERE_API_KEY is required in the environment.
 * Configuration values come from @repo/console-config.
 *
 * @returns Default embedding configuration
 *
 * @example
 * ```typescript
 * const defaults = resolveEmbeddingDefaults();
 * console.log(defaults.dimension); // 1024
 * console.log(defaults.model); // "embed-english-v3.0"
 * ```
 */
export function resolveEmbeddingDefaults(): EmbeddingDefaults {
	return {
		dimension: EMBEDDING_CONFIG.cohere.dimension,
		model: EMBEDDING_CONFIG.cohere.model,
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
 * Create a Cohere embedding provider
 *
 * COHERE_API_KEY is required in the environment.
 *
 * @param config - Provider configuration
 * @returns Cohere embedding provider instance
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
	return createCohereEmbedding({
		apiKey: embedEnv.COHERE_API_KEY,
		model: EMBEDDING_CONFIG.cohere.model,
		inputType: config.inputType as CohereInputType,
		dimension: EMBEDDING_CONFIG.cohere.dimension,
	});
}

/**
 * Store configuration required for embedding provider selection
 */
export interface StoreEmbeddingConfig {
	/**
	 * Store ID for error messages
	 */
	id: string;

	/**
	 * Embedding model used by this store
	 */
	embeddingModel: string;

	/**
	 * Embedding dimension
	 */
	embeddingDim: number;
}

/**
 * Create an embedding provider bound to a specific store's configuration
 *
 * CRITICAL: This ensures the same embedding model is used for both indexing
 * and retrieval. Vector stores require consistent embedding models - you
 * cannot mix different models in the same semantic space.
 *
 * This function enforces store-level embedding model locking:
 * - Uses the store's configured Cohere embedding model
 * - All stores must use Cohere (COHERE_API_KEY required)
 * - Prevents accidental model switching that would corrupt search results
 *
 * @param store - Store configuration with embedding model settings
 * @param config - Provider configuration (input type)
 * @returns Cohere embedding provider instance matching store's configuration
 *
 * @example
 * ```typescript
 * // Create provider for a Cohere-based store
 * const provider = createEmbeddingProviderForStore(
 *   { id: "store_123", embeddingModel: "embed-english-v3.0", embeddingDim: 1024 },
 *   { inputType: "search_query" }
 * );
 * ```
 */
export function createEmbeddingProviderForStore(
	store: StoreEmbeddingConfig,
	config: EmbeddingProviderConfig,
): EmbeddingProvider {
	return createCohereEmbedding({
		apiKey: embedEnv.COHERE_API_KEY,
		model: EMBEDDING_CONFIG.cohere.model,
		inputType: config.inputType as CohereInputType,
		dimension: store.embeddingDim, // Use store's dimension, not config default
	});
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

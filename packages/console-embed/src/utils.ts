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

	/**
	 * Embedding provider name
	 */
	provider: "cohere" | "charHash";
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
			provider: "cohere",
		};
	}

	// Fall back to CharHash for development
	return {
		dimension: EMBEDDING_CONFIG.charHash.dimension,
		model: EMBEDDING_CONFIG.charHash.model,
		provider: "charHash",
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
 * - Uses the store's configured embedding model, NOT environment defaults
 * - Throws error if required API key is missing for store's model
 * - Prevents accidental model switching that would corrupt search results
 *
 * @param store - Store configuration with embedding model settings
 * @param config - Provider configuration (input type)
 * @returns Embedding provider instance matching store's configuration
 * @throws Error if store requires an API key that is not available
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
	// Check if store uses Cohere
	if (store.embeddingModel.includes("cohere")) {
		if (!embedEnv.COHERE_API_KEY) {
			throw new Error(
				`Store '${store.id}' requires Cohere embedding model (${store.embeddingModel}) ` +
					`but COHERE_API_KEY is not set in environment. ` +
					`Cannot switch embedding models on existing store. ` +
					`Either set COHERE_API_KEY or create a new store.`,
			);
		}

		return createCohereEmbedding({
			apiKey: embedEnv.COHERE_API_KEY,
			model: EMBEDDING_CONFIG.cohere.model,
			inputType: config.inputType as CohereInputType,
			dimension: store.embeddingDim, // Use store's dimension, not config default
		});
	}

	// Use CharHash (always available, no API key required)
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

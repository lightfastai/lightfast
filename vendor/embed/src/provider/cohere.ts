/**
 * Cohere Embed v4 provider
 *
 * Production-grade embeddings with input_type optimization.
 * Supports search_query and search_document modes for asymmetric search.
 *
 * @see https://docs.cohere.com/docs/embed-2
 */

import { CohereClient } from "cohere-ai";
import type { EmbeddingProvider, EmbedResponse } from "../types";

/**
 * Cohere embedding input types
 *
 * Different input types optimize embeddings for specific tasks:
 * - search_query: Optimize for search queries (short text, user intent)
 * - search_document: Optimize for document indexing (long passages)
 * - classification: Optimize for classification tasks
 * - clustering: Optimize for clustering tasks
 */
export type CohereInputType =
	| "search_query"
	| "search_document"
	| "classification"
	| "clustering";

/**
 * Cohere embedding configuration
 */
export interface CohereEmbeddingConfig {
	/**
	 * Cohere API key
	 */
	apiKey: string;

	/**
	 * Model to use
	 * @default "embed-english-v3.0"
	 */
	model?: string;

	/**
	 * Input type for embedding optimization
	 * @default "search_document"
	 */
	inputType?: CohereInputType;

	/**
	 * Embedding dimension
	 * @default 1024 (max for v3)
	 */
	dimension?: number;
}

/**
 * Cohere embedding provider
 *
 * Uses Cohere's embedding API with input_type optimization for
 * better search relevance. Supports both query and document modes.
 *
 * Features:
 * - Input type optimization (query vs document)
 * - Configurable dimensions (up to 1024 for v3)
 * - Batch processing support
 * - Usage tracking
 *
 * @example
 * ```typescript
 * const provider = new CohereEmbedding({
 *   apiKey: process.env.COHERE_API_KEY,
 *   inputType: "search_query"
 * });
 * const response = await provider.embed(["search query"]);
 * ```
 */
export class CohereEmbedding implements EmbeddingProvider {
	readonly dimension: number;
	private readonly client: CohereClient;
	private readonly model: string;
	private readonly inputType: CohereInputType;

	constructor(config: CohereEmbeddingConfig) {
		if (!config.apiKey) {
			throw new Error("Cohere API key is required");
		}

		this.client = new CohereClient({
			token: config.apiKey,
		});
		this.model = config.model ?? "embed-english-v3.0";
		this.inputType = config.inputType ?? "search_document";
		this.dimension = config.dimension ?? 1024;
	}

	/**
	 * Generate embeddings using Cohere API
	 *
	 * @param texts - Array of text strings to embed
	 * @returns Promise resolving to embed response
	 */
	async embed(texts: string[]): Promise<EmbedResponse> {
		if (texts.length === 0) {
			return {
				embeddings: [],
				model: this.model,
			};
		}

		try {
			const response = await this.client.embed({
				texts,
				model: this.model,
				inputType: this.inputType,
				embeddingTypes: ["float"],
			});

			// Extract embeddings from response
			// Type is either number[][] or { float?: number[][] }
			const embeddings = Array.isArray(response.embeddings)
				? response.embeddings
				: (response.embeddings.float ?? []);

			return {
				embeddings,
				model: this.model,
				usage: response.meta?.billedUnits?.inputTokens
					? {
							totalTokens: response.meta.billedUnits.inputTokens,
						}
					: undefined,
			};
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to generate Cohere embeddings: ${error.message}`);
			}
			throw error;
		}
	}
}

/**
 * Create a new Cohere embedding provider
 *
 * Factory function for creating Cohere embedding provider instances.
 *
 * @param config - Cohere embedding configuration
 * @returns New CohereEmbedding instance
 *
 * @example
 * ```typescript
 * const provider = createCohereEmbedding({
 *   apiKey: process.env.COHERE_API_KEY,
 *   inputType: "search_query"
 * });
 * ```
 */
export function createCohereEmbedding(
	config: CohereEmbeddingConfig,
): CohereEmbedding {
	return new CohereEmbedding(config);
}

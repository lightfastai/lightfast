/**
 * Private infrastructure configuration defaults
 *
 * These are NOT user-configurable via lightfast.yml.
 * They define infrastructure defaults that can be expanded to user config in the future.
 *
 * To make a setting user-configurable:
 * 1. Add it to the LightfastConfigSchema in schema.ts
 * 2. Update this file to use the user value as override
 *
 * Type Safety:
 * All enum values are type-checked against validation schemas (@repo/console-validation).
 * This ensures config values can never violate database constraints.
 *
 * Single Source of Truth:
 * Core embedding defaults are defined in @repo/console-validation/constants.
 * This file re-exports and extends them with additional operational config.
 *
 * @packageDocumentation
 */

import type {
  EmbeddingProvider,
  PineconeMetric,
  PineconeCloud,
} from "@repo/console-validation";
import {
  PINECONE_DEFAULTS,
  EMBEDDING_MODEL_DEFAULTS,
  CHUNKING_DEFAULTS,
} from "@repo/console-validation/constants";

/**
 * Pinecone infrastructure configuration
 *
 * Controls how Pinecone indexes are created and managed.
 * Currently private - users cannot override these settings.
 *
 * Type Safety: metric and cloud are validated against validation schemas.
 *
 * Future: Could be made configurable per workspace or store.
 */
export const PINECONE_CONFIG = {
  /**
   * Shared Pinecone index configuration
   *
   * ARCHITECTURE: Single index name per Pinecone project (environment separation at project level)
   * - lightfast-prod project → lightfast-v1 index (PINECONE_API_KEY for prod)
   * - lightfast-dev project → lightfast-v1 index (PINECONE_API_KEY for dev)
   *
   * Benefits:
   * - Massive cost savings: $50/month vs $7,500+/month for 3000 stores
   * - Scales to 25,000 namespaces per index (Standard plan)
   * - Physical isolation via Pinecone's serverless architecture
   * - Environment separation at Pinecone project level (different API keys)
   *
   * Each workspace gets a hierarchical namespace within the shared index:
   * Format: org_{clerkOrgId}:ws_{workspaceId}
   *
   * Values from: @repo/console-validation/constants (single source of truth)
   */
  index: {
    name: PINECONE_DEFAULTS.indexName,
    embeddingDim: EMBEDDING_MODEL_DEFAULTS.dimension,
    embeddingModel: EMBEDDING_MODEL_DEFAULTS.model,
    embeddingProvider: EMBEDDING_MODEL_DEFAULTS.provider,
  },

  /**
   * Vector similarity metric
   *
   * Type-safe: must match PineconeMetric from validation schemas
   * Default: "cosine" (best for normalized embeddings)
   *
   * @private
   */
  metric: PINECONE_DEFAULTS.metric as PineconeMetric,

  /**
   * Cloud provider for serverless indexes
   *
   * Type-safe: must match PineconeCloud from validation schemas
   * Default: "aws"
   *
   * @private
   */
  cloud: PINECONE_DEFAULTS.cloud as PineconeCloud,

  /**
   * AWS region for serverless indexes
   *
   * Note: Not enum-validated as regions vary by cloud provider
   * Default: "us-east-1" (primary AWS region)
   *
   * @private
   */
  region: PINECONE_DEFAULTS.region,

  /**
   * Default deletion protection value for new indexes
   */
  deletionProtection: "enabled" as const,

  /**
   * Batch size for vector upsert operations
   *
   * Default: 100 vectors per batch
   * Constraint: Pinecone API limits
   *
   * @private
   */
  upsertBatchSize: 100,

  /**
   * Batch size for vector delete operations
   *
   * Default: 100 vector IDs per batch
   * Constraint: Pinecone API limits
   *
   * @private
   */
  deleteBatchSize: 100,

  /**
   * Maximum length for Pinecone index names
   *
   * Constraint: Pinecone platform limit
   * Used for truncation and hashing of long names
   *
   * @private
   */
  maxIndexNameLength: 45,
} as const;

/**
 * Embedding provider configuration
 *
 * Controls which embedding models are used and their parameters.
 * Currently private - all stores use Cohere.
 *
 * Type Safety: provider is validated against validation schemas.
 *
 * Future: Could allow users to specify model version per store.
 */
export const EMBEDDING_CONFIG = {
  /**
   * Cohere embedding configuration
   *
   * COHERE_API_KEY is required for all embedding operations.
   *
   * Values from: @repo/console-validation/constants (single source of truth)
   */
  cohere: {
    /**
     * Provider name
     *
     * Type-safe: literal "cohere" matches EmbeddingProvider from validation schemas
     * TypeScript will enforce this is a valid enum value at assignment time
     *
     * @private
     */
    provider: EMBEDDING_MODEL_DEFAULTS.provider,

    /**
     * Model name
     *
     * Options: "embed-english-v3.0" | "embed-multilingual-v3.0" | etc.
     * Default: "embed-english-v3.0"
     *
     * @private
     */
    model: EMBEDDING_MODEL_DEFAULTS.model,

    /**
     * Embedding dimension
     *
     * Must match the model's output dimension
     * Default: 1024 (for embed-english-v3.0)
     *
     * @private
     */
    dimension: EMBEDDING_MODEL_DEFAULTS.dimension,
  },

  /**
   * Default batch size for embedding operations
   *
   * Default: 96 texts per batch (Cohere API limit)
   * Used across all embedding operations
   *
   * @private
   */
  batchSize: 96 as const,
} satisfies {
  cohere: {
    provider: EmbeddingProvider;
    model: string;
    dimension: number;
  };
  batchSize: number;
};

/**
 * Rerank provider configuration
 *
 * Controls reranking behavior for neural memory search.
 * Currently private - optimized for quality vs latency trade-offs.
 *
 * Future: Could allow users to specify mode per workspace.
 */
export const RERANK_CONFIG = {
  /**
   * Cohere rerank configuration
   */
  cohere: {
    /**
     * Cohere rerank model
     * @default "rerank-v3.5"
     */
    model: "rerank-v3.5" as const,

    /**
     * Default relevance threshold
     * @default 0.4
     */
    threshold: 0.4 as const,
  },

  /**
   * LLM rerank configuration
   */
  llm: {
    /**
     * Model to use via AI Gateway
     * @default "anthropic/claude-haiku-4.5"
     */
    model: "anthropic/claude-haiku-4.5" as const,

    /**
     * Weight for LLM score in final calculation
     * @default 0.6
     */
    llmWeight: 0.6 as const,

    /**
     * Weight for vector score in final calculation
     * @default 0.4
     */
    vectorWeight: 0.4 as const,

    /**
     * Skip LLM if candidate count is <= this value
     * @default 5
     */
    bypassThreshold: 5 as const,

    /**
     * Default relevance threshold
     * @default 0.4
     */
    threshold: 0.4 as const,
  },

  /**
   * Default rerank mode
   * @default "balanced"
   */
  defaultMode: "balanced" as const,
} as const;

/**
 * Document chunking configuration
 *
 * Controls how documents are split into chunks for embedding.
 * Currently private - applied globally to all stores.
 *
 * Future: Could be configurable per store for different content types.
 */
export const CHUNKING_CONFIG = {
  /**
   * Maximum tokens per chunk
   *
   * Default: 512 tokens
   * Affects retrieval precision vs context window
   *
   * Trade-offs:
   * - Smaller chunks: More precise retrieval, less context
   * - Larger chunks: More context, less precise retrieval
   *
   * Values from: @repo/console-validation/constants (single source of truth)
   *
   * @private
   */
  maxTokens: CHUNKING_DEFAULTS.maxTokens,

  /**
   * Token overlap between consecutive chunks
   *
   * Default: 50 tokens
   * Preserves context across chunk boundaries
   *
   * @private
   */
  overlap: CHUNKING_DEFAULTS.overlap,
} as const;

/**
 * GitHub integration configuration
 *
 * Controls how content is fetched from GitHub repositories.
 * Currently private - optimized for GitHub API limits.
 *
 * Future: Could be tuned based on GitHub plan (free vs enterprise).
 */
export const GITHUB_CONFIG = {
  /**
   * Threshold for switching to Tree API
   *
   * Default: 20 files
   *
   * Logic:
   * - < 20 files: Use Contents API (simpler, more requests)
   * - >= 20 files: Use Tree + Blobs API (complex, fewer requests)
   *
   * @private
   */
  contentsApiThreshold: 20,

  /**
   * Batch size for parallel blob fetching
   *
   * Default: 20 blobs
   * Used when fetching via Tree + Blobs API
   *
   * @private
   */
  blobsBatchSize: 20,

  /**
   * Max number of files fetched in one docs-ingestion run
   */
  ingestFileBatchSize: 50,

  /**
   * Parallel request limit when fetching file contents
   */
  fetchConcurrency: 5,
} as const;

/**
 * Complete private configuration object
 *
 * Aggregates all infrastructure defaults in one place.
 * Import this to access any private config setting.
 *
 * @example
 * ```typescript
 * import { PRIVATE_CONFIG } from "@repo/console-config/private";
 *
 * const metric = PRIVATE_CONFIG.pinecone.metric; // "cosine"
 * const model = PRIVATE_CONFIG.embedding.cohere.model; // "embed-english-v3.0"
 * ```
 */
export const PRIVATE_CONFIG = {
  pinecone: PINECONE_CONFIG,
  embedding: EMBEDDING_CONFIG,
  rerank: RERANK_CONFIG,
  chunking: CHUNKING_CONFIG,
  github: GITHUB_CONFIG,
} as const;

/**
 * Type for the complete private configuration
 */
export type PrivateConfig = typeof PRIVATE_CONFIG;

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
 * @packageDocumentation
 */

import type {
	EmbeddingProvider,
	PineconeMetric,
	PineconeCloud,
} from "@repo/console-validation";

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
   * Vector similarity metric
   *
   * Type-safe: must match PineconeMetric from validation schemas
   * Default: "cosine" (best for normalized embeddings)
   *
   * @private
   */
  metric: "cosine" as PineconeMetric,

  /**
   * Cloud provider for serverless indexes
   *
   * Type-safe: must match PineconeCloud from validation schemas
   * Default: "aws"
   *
   * @private
   */
  cloud: "aws" as PineconeCloud,

  /**
   * AWS region for serverless indexes
   *
   * Note: Not enum-validated as regions vary by cloud provider
   * Default: "us-east-1" (primary AWS region)
   *
   * @private
   */
  region: "us-east-1" as const,

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
    provider: "cohere" as const,

    /**
     * Model name
     *
     * Options: "embed-english-v3.0" | "embed-multilingual-v3.0" | etc.
     * Default: "embed-english-v3.0"
     *
     * @private
     */
    model: "embed-english-v3.0" as const,

    /**
     * Embedding dimension
     *
     * Must match the model's output dimension
     * Default: 1024 (for embed-english-v3.0)
     *
     * @private
     */
    dimension: 1024 as const,
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
   * @private
   */
  maxTokens: 512,

  /**
   * Token overlap between consecutive chunks
   *
   * Default: 50 tokens
   * Preserves context across chunk boundaries
   *
   * @private
   */
  overlap: 50,
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
 * Inngest workflow configuration
 *
 * Controls workflow behavior and retry policies.
 * Currently private - applied globally to all workflows.
 *
 * Future: Could be configurable per workflow type.
 */
export const WORKFLOW_CONFIG = {
  /**
   * Number of retries for failed workflows
   *
   * Default: 3 retries
   * Applied to: docs-ingestion, process-doc, delete-doc
   *
   * @private
   */
  retries: 3,

  /**
   * Default glob patterns for document ingestion
   *
   * Used when no lightfast.yml is found in repository.
   * Covers common documentation paths.
   *
   * @private
   */
  defaultIncludePatterns: [
    "docs/**/*.md",
    "docs/**/*.mdx",
    "README.md",
  ] as const,

  /**
   * Process document workflow tuning
   */
  processDoc: {
    /**
     * Max number of docs per batch event
     */
    batchSize: 25,
    /**
     * How long to wait for batch accumulation before running
     */
    batchTimeout: "5s",
    /**
     * Per-store concurrency limit for process-doc execution
     */
    perStoreConcurrency: 5,
    /**
     * Embedding batch size (Cohere limit is 96 texts/request)
     */
    embeddingBatchSize: 96,
  },

  /**
   * Delete document workflow tuning
   */
  deleteDoc: {
    perStoreConcurrency: 10,
    timeout: {
      start: "30s",
      finish: "5m",
    },
  },

  /**
   * Ensure store workflow tuning
   *
   * Note: Singleton removed in favor of natural function idempotency.
   * This prevents "rate limited" errors during concurrent store creation.
   */
  ensureStore: {
    retries: 5,
    timeout: {
      start: "1m",
      finish: "10m",
    },
  },
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
  chunking: CHUNKING_CONFIG,
  github: GITHUB_CONFIG,
  workflow: WORKFLOW_CONFIG,
} as const;

/**
 * Type for the complete private configuration
 */
export type PrivateConfig = typeof PRIVATE_CONFIG;

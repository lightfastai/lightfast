/**
 * Embedding Configuration Defaults
 *
 * Centralized default values for embedding and vector storage configuration.
 * These are the infrastructure defaults used across the platform.
 *
 * **This is the single source of truth for embedding configuration defaults.**
 *
 * Used by:
 * - @db/console: Workspace creation (buildWorkspaceSettings)
 * - @repo/console-config: PRIVATE_CONFIG (re-exports these)
 * - Workflows: Embedding provider initialization
 */

/**
 * Default Pinecone configuration
 */
export const PINECONE_DEFAULTS = {
  /** Shared index name (environment separation via Pinecone project/API key) */
  indexName: "lightfast-v1",
  /** Vector similarity metric */
  metric: "cosine",
  /** Cloud provider for serverless indexes */
  cloud: "aws",
  /** AWS region for serverless indexes */
  region: "us-east-1",
} as const;

/**
 * Default embedding model configuration
 */
export const EMBEDDING_MODEL_DEFAULTS = {
  /** Embedding provider */
  provider: "cohere",
  /** Embedding model name */
  model: "embed-english-v3.0",
  /** Embedding vector dimension */
  dimension: 1024,
} as const;

/**
 * Default chunking configuration
 */
export const CHUNKING_DEFAULTS = {
  /** Maximum tokens per chunk (64-4096) */
  maxTokens: 512,
  /** Token overlap between chunks (0-1024, must be < maxTokens) */
  overlap: 50,
} as const;

/**
 * Combined embedding defaults for workspace settings
 *
 * All configuration values needed to populate workspace.settings.embedding
 */
export const EMBEDDING_DEFAULTS = {
  indexName: PINECONE_DEFAULTS.indexName,
  embeddingDim: EMBEDDING_MODEL_DEFAULTS.dimension,
  embeddingModel: EMBEDDING_MODEL_DEFAULTS.model,
  embeddingProvider: EMBEDDING_MODEL_DEFAULTS.provider,
  pineconeMetric: PINECONE_DEFAULTS.metric,
  pineconeCloud: PINECONE_DEFAULTS.cloud,
  pineconeRegion: PINECONE_DEFAULTS.region,
  chunkMaxTokens: CHUNKING_DEFAULTS.maxTokens,
  chunkOverlap: CHUNKING_DEFAULTS.overlap,
} as const;

/**
 * Type for embedding defaults
 */
export type EmbeddingDefaults = typeof EMBEDDING_DEFAULTS;

/**
 * Type definitions for Pinecone operations
 *
 * @see docs/architecture/phase1/mastra-integration.md
 */

/**
 * Vector metadata stored with each embedding
 */
export interface VectorMetadata {
  /** Chunk text content */
  text: string;
  /** Document repo-relative path */
  path: string;
  /** URL-friendly slug */
  slug: string;
  /** Document content hash */
  contentHash: string;
  /** 0-based chunk index within document */
  chunkIndex: number;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Request to upsert vectors into an index
 */
export interface UpsertRequest {
  /** Vector IDs (stable per chunk) */
  ids: string[];
  /** Vector embeddings */
  vectors: number[][];
  /** Metadata for each vector */
  metadata: VectorMetadata[];
}

/**
 * Response from upserting vectors
 */
export interface UpsertResponse {
  /** Number of vectors upserted */
  upsertedCount: number;
}

/**
 * Request to query similar vectors
 */
export interface QueryRequest {
  /** Query vector */
  vector: number[];
  /** Number of results to return */
  topK: number;
  /** Whether to include metadata in results */
  includeMetadata?: boolean;
  /** Optional filter on metadata */
  filter?: Record<string, unknown>;
}

/**
 * Individual query match result
 */
export interface QueryMatch {
  /** Vector ID */
  id: string;
  /** Similarity score */
  score: number;
  /** Vector metadata (if requested) */
  metadata?: VectorMetadata;
}

/**
 * Response from querying vectors
 */
export interface QueryResponse {
  /** Matching vectors */
  matches: QueryMatch[];
  /** Namespace queried */
  namespace?: string;
}

/**
 * Request to delete vectors
 */
export interface DeleteRequest {
  /** Vector IDs to delete */
  ids: string[];
  /** Whether to delete all vectors in namespace */
  deleteAll?: boolean;
}

/**
 * Type definitions for Pinecone operations
 *
 * Generic types for vector operations. Application-specific metadata
 * types should be defined in application packages (e.g., @repo/console-pinecone).
 */

import type { RecordMetadata } from "@pinecone-database/pinecone";

/**
 * Request to upsert vectors into an index
 *
 * Generic type - use with application-specific metadata types:
 * @example
 * ```typescript
 * import type { VectorMetadata } from "@repo/console-pinecone";
 * const request: UpsertRequest<VectorMetadata> = { ... };
 * ```
 */
export interface UpsertRequest<T extends RecordMetadata = RecordMetadata> {
  /** Vector IDs (stable per chunk) */
  ids: string[];
  /** Vector embeddings */
  vectors: number[][];
  /** Metadata for each vector */
  metadata: T[];
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
 *
 * Generic type - use with application-specific metadata types
 */
export interface QueryMatch<T extends RecordMetadata = RecordMetadata> {
  /** Vector ID */
  id: string;
  /** Similarity score */
  score: number;
  /** Vector metadata (if requested) */
  metadata?: T;
}

/**
 * Response from querying vectors
 *
 * Generic type - use with application-specific metadata types
 */
export interface QueryResponse<T extends RecordMetadata = RecordMetadata> {
  /** Matching vectors */
  matches: QueryMatch<T>[];
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

/**
 * A single fetched vector record
 */
export interface FetchedRecord<T extends RecordMetadata = RecordMetadata> {
  id: string;
  values: number[];
  metadata?: T;
}

/**
 * Response from fetching vectors by ID
 */
export interface FetchResponse<T extends RecordMetadata = RecordMetadata> {
  records: Record<string, FetchedRecord<T>>;
}

/**
 * Request to update a vector's metadata
 */
export interface UpdateRequest<T extends RecordMetadata = RecordMetadata> {
  /** Vector ID to update */
  id: string;
  /** New metadata (partial merge) */
  metadata: Partial<T>;
}

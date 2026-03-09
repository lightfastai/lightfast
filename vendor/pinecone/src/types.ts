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
  /** Metadata for each vector */
  metadata: T[];
  /** Vector embeddings */
  vectors: number[][];
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
  /** Optional filter on metadata */
  filter?: Record<string, unknown>;
  /** Whether to include metadata in results */
  includeMetadata?: boolean;
  /** Number of results to return */
  topK: number;
  /** Query vector */
  vector: number[];
}

/**
 * Individual query match result
 *
 * Generic type - use with application-specific metadata types
 */
export interface QueryMatch<T extends RecordMetadata = RecordMetadata> {
  /** Vector ID */
  id: string;
  /** Vector metadata (if requested) */
  metadata?: T;
  /** Similarity score */
  score: number;
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
  /** Whether to delete all vectors in namespace */
  deleteAll?: boolean;
  /** Vector IDs to delete */
  ids: string[];
}

/**
 * A single fetched vector record
 */
export interface FetchedRecord<T extends RecordMetadata = RecordMetadata> {
  id: string;
  metadata?: T;
  values: number[];
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

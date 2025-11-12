/**
 * Console-specific vector metadata types
 *
 * Defines the schema for document metadata stored in Pinecone indexes
 * for the console application's document ingestion pipeline.
 */

import type { RecordMetadata } from "@pinecone-database/pinecone";

/**
 * Vector metadata stored with each embedding
 *
 * Extends Pinecone's RecordMetadata which allows:
 * - string, boolean, number, string[]
 * - Does NOT allow null or undefined
 *
 * All fields are required - no optional fields.
 */
export interface VectorMetadata extends RecordMetadata {
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
  /** Owning document id */
  docId: string;
  /** Human title */
  title: string;
  /** Short snippet (first 200 chars of chunk) */
  snippet: string;
  /** Source URL */
  url: string;
}

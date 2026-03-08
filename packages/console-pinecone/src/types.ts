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
  /** 0-based chunk index within document */
  chunkIndex: number;
  /** Document content hash */
  contentHash: string;
  /** Owning document id */
  docId: string;
  /** Document repo-relative path */
  path: string;
  /** URL-friendly slug */
  slug: string;
  /** Short snippet (first 200 chars of chunk) */
  snippet: string;
  /** Chunk text content */
  text: string;
  /** Human title */
  title: string;
  /** Source URL */
  url: string;
}

/**
 * @repo/app-pinecone
 *
 * Lightfast Pinecone utilities with typed vector metadata.
 * Uses @vendor/pinecone for core Pinecone functionality.
 *
 * @packageDocumentation
 */

// Re-export types from vendor/pinecone
export type {
  FetchedRecord,
  FetchResponse,
  QueryMatch,
  QueryRequest,
  QueryResponse,
  UpdateRequest,
  UpsertRequest,
  UpsertResponse,
} from "@vendor/pinecone/types";
// Export Lightfast client with injected config
export {
  LightfastPineconeClient,
  lightfastPineconeClient,
  lightfastPineconeClient as pineconeClient,
  createLightfastPineconeClient,
} from "./client";

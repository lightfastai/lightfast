/**
 * @repo/app-pinecone
 *
 * App-specific Pinecone utilities with typed vector metadata.
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
// Export app-specific client with injected config
export {
  AppPineconeClient,
  appPineconeClient,
  appPineconeClient as pineconeClient,
  createAppPineconeClient,
} from "./client";

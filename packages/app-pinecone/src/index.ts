/**
 * @repo/app-pinecone
 *
 * Console-specific Pinecone utilities with typed vector metadata.
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
// Export console-specific client with injected config
// Alias for backwards compatibility
export {
  ConsolePineconeClient,
  consolePineconeClient,
  consolePineconeClient as pineconeClient,
  createConsolePineconeClient,
} from "./client";

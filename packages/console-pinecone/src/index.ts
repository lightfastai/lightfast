/**
 * @repo/console-pinecone
 *
 * Console-specific Pinecone utilities with typed vector metadata.
 * Uses @vendor/pinecone for core Pinecone functionality.
 *
 * @packageDocumentation
 */

// Re-export types from vendor/pinecone
export type {
  QueryRequest,
  QueryResponse,
  QueryMatch,
  UpsertRequest,
  UpsertResponse,
  FetchResponse,
  FetchedRecord,
  UpdateRequest,
} from "@vendor/pinecone/types";

// Export console-specific client with injected config
export {
  ConsolePineconeClient,
  createConsolePineconeClient,
  consolePineconeClient,
} from "./client";

// Alias for backwards compatibility
export { consolePineconeClient as pineconeClient } from "./client";

// Export console-specific types
export type { VectorMetadata } from "./types";

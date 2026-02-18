// Export client
export { PineconeClient, createPineconeClient, pineconeClient } from "./client";

// Export types
export type {
  UpsertRequest,
  UpsertResponse,
  QueryRequest,
  QueryMatch,
  QueryResponse,
  DeleteRequest,
  FetchedRecord,
  FetchResponse,
  UpdateRequest,
} from "./types";

// Export errors
export {
  PineconeError,
  PineconeConnectionError,
  PineconeRateLimitError,
  PineconeNotFoundError,
  PineconeInvalidRequestError,
} from "./errors";

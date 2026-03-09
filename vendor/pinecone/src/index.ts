// Export client
export { createPineconeClient, PineconeClient, pineconeClient } from "./client";
// Export errors
export {
  PineconeConnectionError,
  PineconeError,
  PineconeInvalidRequestError,
  PineconeNotFoundError,
  PineconeRateLimitError,
} from "./errors";
// Export types
export type {
  DeleteRequest,
  FetchedRecord,
  FetchResponse,
  QueryMatch,
  QueryRequest,
  QueryResponse,
  UpdateRequest,
  UpsertRequest,
  UpsertResponse,
} from "./types";

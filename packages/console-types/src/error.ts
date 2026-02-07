/**
 * Error types and codes for Lightfast API responses
 */

/**
 * Standard error codes used across the API
 */
export enum ErrorCode {
  INVALID_REQUEST = "INVALID_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  NOT_FOUND = "NOT_FOUND",
  STORE_NOT_FOUND = "STORE_NOT_FOUND",
  WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Typed error for resources that don't exist.
 * Route handlers should catch this and return 404.
 */
export class NotFoundError extends Error {
  readonly code = ErrorCode.NOT_FOUND;

  constructor(
    public readonly resource: string,
    public readonly resourceId: string,
  ) {
    super(`${resource} not found: ${resourceId}`);
    this.name = "NotFoundError";
  }
}

/**
 * Standard API error response structure
 */
export interface APIError {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error context */
  details?: Record<string, unknown>;
  /** Request ID for debugging */
  requestId: string;
}

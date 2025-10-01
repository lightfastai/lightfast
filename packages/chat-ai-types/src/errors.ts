/**
 * Error types and classes for the chat application
 *
 * This module provides:
 * - ChatInlineError: UI error display structure
 * - Request validation error classes
 * - Shared error types for API and client
 */

/**
 * Error types for chat application
 */
export enum ChatErrorType {
  // Network & Connection
  NETWORK = "NETWORK",
  TIMEOUT = "TIMEOUT",

  // Rate Limiting & Security
  RATE_LIMIT = "RATE_LIMIT",
  BOT_DETECTION = "BOT_DETECTION",
  SECURITY_BLOCKED = "SECURITY_BLOCKED",

  // Authentication & Authorization
  AUTHENTICATION = "AUTHENTICATION",
  MODEL_ACCESS_DENIED = "MODEL_ACCESS_DENIED",
  USAGE_LIMIT_EXCEEDED = "USAGE_LIMIT_EXCEEDED",

  // Model & API Issues
  MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE",
  INVALID_MODEL = "INVALID_MODEL",

  // Request Issues
  INVALID_REQUEST = "INVALID_REQUEST",
  PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE",

  // Server Issues
  SERVER_ERROR = "SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Unknown
  UNKNOWN = "UNKNOWN",
}

/**
 * Standardized API error response structure
 * This is what the API returns for ALL errors
 */
export interface ApiErrorResponse {
  type: ChatErrorType;
  error: string;         // Technical error message
  message: string;       // User-facing message
  statusCode: number;    // HTTP status code
  errorCode?: string;
  source?: string;
  category?: string;
  severity?: string;
  metadata?: {
    requestId?: string;
    timestamp?: number;
    modelId?: string;
    isAnonymous?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Chat error structure used in the UI
 * Since ALL errors go to error boundary, this is simplified
 */
export interface ChatError {
  type: ChatErrorType;
  message: string;
  details?: string;
  retryable: false; // Always false - all errors go to error boundary
  statusCode?: number;
  errorCode?: string;
  source?: string;
  category?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Inline error displayed in the chat UI
 * Used for non-critical errors that don't require error boundary
 */
export interface ChatInlineError {
  id: string;
  error: ChatError;
  relatedAssistantMessageId?: string;
  relatedUserMessageId?: string;
  category?: string;
  severity?: string;
  source?: string;
  errorCode?: string;
}

/**
 * Error thrown when request payload exceeds size limit
 */
export class RequestPayloadTooLargeError extends Error {
  constructor(
    public readonly limit: number,
    public readonly received: number,
  ) {
    super(`Request payload exceeded limit of ${limit} bytes`);
    this.name = "RequestPayloadTooLargeError";
  }
}

/**
 * Error thrown when request body cannot be parsed
 */
export class RequestBodyParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RequestBodyParseError";
  }
}

/**
 * Type guard to check if an error is an API error response
 */
export function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  return (
    error !== null &&
    typeof error === 'object' &&
    'type' in error &&
    'error' in error &&
    'message' in error &&
    'statusCode' in error &&
    Object.values(ChatErrorType).includes((error as Record<string, unknown>).type as ChatErrorType)
  );
}

/**
 * Map error types to HTTP status codes
 */
export const ERROR_STATUS_CODES: Record<ChatErrorType, number> = {
  [ChatErrorType.NETWORK]: 503,
  [ChatErrorType.TIMEOUT]: 504,
  [ChatErrorType.RATE_LIMIT]: 429,
  [ChatErrorType.BOT_DETECTION]: 403,
  [ChatErrorType.SECURITY_BLOCKED]: 403,
  [ChatErrorType.AUTHENTICATION]: 401,
  [ChatErrorType.MODEL_ACCESS_DENIED]: 403,
  [ChatErrorType.USAGE_LIMIT_EXCEEDED]: 403,
  [ChatErrorType.MODEL_UNAVAILABLE]: 503,
  [ChatErrorType.INVALID_MODEL]: 400,
  [ChatErrorType.INVALID_REQUEST]: 400,
  [ChatErrorType.PAYLOAD_TOO_LARGE]: 413,
  [ChatErrorType.SERVER_ERROR]: 500,
  [ChatErrorType.SERVICE_UNAVAILABLE]: 503,
  [ChatErrorType.UNKNOWN]: 500,
};

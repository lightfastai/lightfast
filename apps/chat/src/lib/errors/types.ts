// Centralized error types for the chat application
// ALL errors from the API route go to the error boundary - no inline/retryable errors

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
  
  // Server Issues
  SERVER_ERROR = "SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  
  // Unknown
  UNKNOWN = "UNKNOWN",
}

// Standardized API error response structure
// This is what the API returns for ALL errors
export interface ApiErrorResponse {
  type: ChatErrorType;
  error: string;         // Technical error message
  message: string;       // User-facing message
  statusCode: number;    // HTTP status code
  metadata?: {
    requestId?: string;
    timestamp?: number;
    modelId?: string;
    isAnonymous?: boolean;
    [key: string]: unknown;
  };
}

// Chat error structure used in the UI
// Since ALL errors go to error boundary, this is simplified
export interface ChatError {
  type: ChatErrorType;
  message: string;
  details?: string;
  retryable: false; // Always false - all errors go to error boundary
  statusCode?: number;
  metadata?: Record<string, unknown>;
}

// Type guard to check if an error is an API error response
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

// Map error types to HTTP status codes
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
  [ChatErrorType.SERVER_ERROR]: 500,
  [ChatErrorType.SERVICE_UNAVAILABLE]: 503,
  [ChatErrorType.UNKNOWN]: 500,
};
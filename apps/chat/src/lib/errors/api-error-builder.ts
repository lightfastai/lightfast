// API error response builder
// Provides consistent error responses from the API route

import { 
  ChatErrorType, 
  type ApiErrorResponse, 
  ERROR_STATUS_CODES 
} from "./types";

interface ErrorBuilderOptions {
  requestId?: string;
  modelId?: string;
  isAnonymous?: boolean;
  [key: string]: any;
}

// Create a standardized error response
export function createErrorResponse(
  type: ChatErrorType,
  error: string,
  message: string,
  options?: ErrorBuilderOptions
): Response {
  const statusCode = ERROR_STATUS_CODES[type];
  
  const errorResponse: ApiErrorResponse = {
    type,
    error,
    message,
    statusCode,
    metadata: {
      timestamp: Date.now(),
      ...options,
    },
  };
  
  return Response.json(errorResponse, { status: statusCode });
}

// Pre-defined error responses for common scenarios
export const ApiErrors = {
  // Authentication & Authorization
  authenticationUnavailable: (options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.AUTHENTICATION,
      "Authentication service unavailable",
      "Unable to verify authentication status. Please try again later.",
      options
    ),
  
  // Rate Limiting
  rateLimitExceeded: (options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.RATE_LIMIT,
      "Rate limit exceeded",
      "You've reached the daily message limit for anonymous users. Please sign in to continue.",
      options
    ),
  
  // Bot Detection
  botDetected: (options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.BOT_DETECTION,
      "Bot detection triggered",
      "Automated activity detected. Please verify you're human to continue.",
      options
    ),
  
  // Security Shield
  securityBlocked: (options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.SECURITY_BLOCKED,
      "Request blocked",
      "Your request was blocked for security reasons. Please try again.",
      options
    ),
  
  // Model Access
  modelAccessDenied: (modelId: string, options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.MODEL_ACCESS_DENIED,
      "Model access denied",
      "This model requires authentication. Please sign in to use this model.",
      { ...options, modelId }
    ),
  
  // Invalid Model
  invalidModel: (modelId: string, options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.INVALID_MODEL,
      "Invalid model",
      `Model '${modelId}' not found. Please select a valid model.`,
      { ...options, modelId }
    ),
  
  // Service Issues
  memoryInitFailed: (options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.SERVICE_UNAVAILABLE,
      "Service initialization failed",
      "Unable to initialize chat memory. Please try again later.",
      options
    ),
  
  // Invalid Request
  invalidPath: (options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.INVALID_REQUEST,
      "Invalid path",
      "Invalid path. Expected /api/v/[agentId]/[sessionId]",
      options
    ),
  
  agentNotFound: (agentId: string, options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.INVALID_REQUEST,
      "Agent not found",
      `Agent '${agentId}' not found.`,
      { ...options, agentId }
    ),
  
  // Generic Server Error
  internalError: (error?: Error, options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.SERVER_ERROR,
      "Internal server error",
      "An unexpected error occurred. Please try again later.",
      {
        ...options,
        errorMessage: error?.message,
        errorStack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      }
    ),
};
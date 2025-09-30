// API error response builder
// Provides consistent error responses from the API route

import type { ApiErrorResponse } from "./types";
import { ChatErrorType, ERROR_STATUS_CODES } from "./types";

interface ErrorBuilderOptions {
  requestId?: string;
  modelId?: string;
  isAnonymous?: boolean;
  category?: string;
  severity?: string;
  source?: string;
  errorCode?: string;
  [key: string]: unknown;
}

const CATEGORY_BY_TYPE: Partial<Record<ChatErrorType, string>> = {
  [ChatErrorType.RATE_LIMIT]: "rate-limit",
  [ChatErrorType.BOT_DETECTION]: "security",
  [ChatErrorType.SECURITY_BLOCKED]: "security",
  [ChatErrorType.AUTHENTICATION]: "authentication",
  [ChatErrorType.MODEL_ACCESS_DENIED]: "authorization",
  [ChatErrorType.USAGE_LIMIT_EXCEEDED]: "rate-limit",
  [ChatErrorType.MODEL_UNAVAILABLE]: "model",
  [ChatErrorType.INVALID_MODEL]: "model",
  [ChatErrorType.INVALID_REQUEST]: "request",
  [ChatErrorType.PAYLOAD_TOO_LARGE]: "request",
  [ChatErrorType.SERVICE_UNAVAILABLE]: "infrastructure",
  [ChatErrorType.SERVER_ERROR]: "internal",
  [ChatErrorType.UNKNOWN]: "unknown",
};

const SEVERITY_BY_TYPE: Partial<Record<ChatErrorType, string>> = {
  [ChatErrorType.RATE_LIMIT]: "transient",
  [ChatErrorType.USAGE_LIMIT_EXCEEDED]: "recoverable",
  [ChatErrorType.MODEL_ACCESS_DENIED]: "fatal",
  [ChatErrorType.AUTHENTICATION]: "fatal",
  [ChatErrorType.SECURITY_BLOCKED]: "fatal",
  [ChatErrorType.BOT_DETECTION]: "fatal",
  [ChatErrorType.INVALID_REQUEST]: "recoverable",
  [ChatErrorType.PAYLOAD_TOO_LARGE]: "recoverable",
};

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
    errorCode: options?.errorCode,
    source: options?.source ?? "guard",
    category: options?.category ?? CATEGORY_BY_TYPE[type] ?? "unknown",
    severity: options?.severity ?? SEVERITY_BY_TYPE[type] ?? "recoverable",
    metadata: {
      timestamp: Date.now(),
      ...options,
    },
  };

  if (errorResponse.metadata) {
    delete (errorResponse.metadata as Record<string, unknown>).category;
    delete (errorResponse.metadata as Record<string, unknown>).severity;
    delete (errorResponse.metadata as Record<string, unknown>).source;
    delete (errorResponse.metadata as Record<string, unknown>).errorCode;
  }
  
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
  payloadTooLarge: (
    options?: ErrorBuilderOptions & { limitBytes?: number; receivedBytes?: number },
  ) =>
    createErrorResponse(
      ChatErrorType.PAYLOAD_TOO_LARGE,
      "Request payload too large",
      "This request exceeds the maximum allowed size. Please reduce the message or remove attachments and try again.",
      options,
    ),

  invalidRequestBody: (reason: string, options?: ErrorBuilderOptions) =>
    createErrorResponse(
      ChatErrorType.INVALID_REQUEST,
      reason,
      "The chat request payload was invalid. Please refresh and try again.",
      options,
    ),

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

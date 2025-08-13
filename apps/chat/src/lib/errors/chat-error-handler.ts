import { ErrorCode } from "@repo/ui/components/lightfast-error-page";
import { 
  ChatErrorType, 
  type ApiErrorResponse, 
  type ChatError,
  isApiErrorResponse 
} from "./types";

export class ChatErrorHandler {
  // Parse the error to extract API error response if available
  private static parseApiError(error: unknown): ApiErrorResponse | null {
    // First check if it's already an API error response
    if (isApiErrorResponse(error)) {
      return error;
    }
    
    // AI SDK wraps our JSON response in an Error object's message field
    if (error instanceof Error && error.message) {
      try {
        const parsed = JSON.parse(error.message);
        if (isApiErrorResponse(parsed)) {
          console.log('[Chat Error Handler] Successfully parsed API error from message:', parsed);
          return parsed;
        }
      } catch (e) {
        // Not valid JSON, continue checking other patterns
      }
    }
    
    // Check if it's wrapped in other properties
    if (error && typeof error === 'object') {
      // Check various properties where the error might be nested
      const possibleProps = ['cause', 'response', 'data', 'body'];
      for (const prop of possibleProps) {
        if (prop in error) {
          const value = (error as any)[prop];
          if (isApiErrorResponse(value)) {
            return value;
          }
          // Check one level deeper
          if (value && typeof value === 'object' && 'body' in value) {
            if (isApiErrorResponse(value.body)) {
              return value.body;
            }
          }
        }
      }
    }
    
    return null;
  }

  // Since all errors go to error boundary, we just need to extract the error info
  static extractErrorInfo(error: unknown): ChatError {
    // Try to get the API error response
    const apiError = this.parseApiError(error);
    
    if (apiError) {
      // We have a structured API error, use it directly
      return {
        type: apiError.type,
        message: apiError.message,
        details: apiError.error,
        retryable: false, // All errors go to error boundary, no retry
        statusCode: apiError.statusCode,
        metadata: apiError.metadata,
      };
    }
    
    // Fallback for non-API errors (network failures, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Basic classification for non-API errors
    let type = ChatErrorType.UNKNOWN;
    let statusCode = 500;
    
    if (errorMessage.toLowerCase().includes('network') || 
        errorMessage.toLowerCase().includes('fetch')) {
      type = ChatErrorType.NETWORK;
      statusCode = 503;
    } else if (errorMessage.toLowerCase().includes('timeout')) {
      type = ChatErrorType.TIMEOUT;
      statusCode = 504;
    }
    
    return {
      type,
      message: "Something went wrong",
      details: errorMessage,
      retryable: false,
      statusCode,
    };
  }

  // Since ALL errors go to error boundary, we just extract and log
  static handleError(error: unknown): ChatError {
    const chatError = this.extractErrorInfo(error);
    
    // Log error for debugging
    console.error(`[Chat Error] Type: ${chatError.type}, Status: ${chatError.statusCode}`, error);
    
    return chatError;
  }

  // Get error page configuration for error boundaries
  static getErrorPageConfig(
    error: Error & { digest?: string },
    context: "session" | "new" | "unauthenticated"
  ): { errorCode: ErrorCode; description: string } {
    // Extract the chat error to get type and status code
    const chatError = this.extractErrorInfo(error);
    
    // Use the pre-classified error type from API
    switch (chatError.type) {
      case ChatErrorType.RATE_LIMIT:
        return {
          errorCode: ErrorCode.TooManyRequests,
          description: chatError.message || "You've sent too many messages. Please wait a moment and try again."
        };
        
      case ChatErrorType.AUTHENTICATION:
        return {
          errorCode: ErrorCode.Unauthorized,
          description: chatError.message || "Please sign in to continue."
        };
        
      case ChatErrorType.BOT_DETECTION:
      case ChatErrorType.SECURITY_BLOCKED:
      case ChatErrorType.MODEL_ACCESS_DENIED:
        return {
          errorCode: ErrorCode.Forbidden,
          description: chatError.message || "Access denied. You don't have permission to access this resource."
        };
        
      case ChatErrorType.INVALID_MODEL:
      case ChatErrorType.INVALID_REQUEST:
        return {
          errorCode: ErrorCode.BadRequest,
          description: chatError.message || "Invalid request. Please check your input and try again."
        };
        
      case ChatErrorType.SERVICE_UNAVAILABLE:
      case ChatErrorType.MODEL_UNAVAILABLE:
        return {
          errorCode: ErrorCode.ServiceUnavailable,
          description: chatError.message || "Service is temporarily unavailable. Please try again later."
        };
        
      case ChatErrorType.NETWORK:
      case ChatErrorType.TIMEOUT:
        return {
          errorCode: ErrorCode.ServiceUnavailable,
          description: chatError.message || "Connection issue. Please check your internet and try again."
        };
        
      case ChatErrorType.SERVER_ERROR:
      case ChatErrorType.UNKNOWN:
      default:
        // Context-specific default descriptions for server errors
        let description = chatError.message || "Something went wrong.";
        if (!chatError.message) {
          switch (context) {
            case "session":
              description = "Something went wrong with this chat session.";
              break;
            case "new":
              description = "Something went wrong starting a new chat.";
              break;
            case "unauthenticated":
              description = "Something went wrong. Please try again.";
              break;
          }
        }
        
        return {
          errorCode: ErrorCode.InternalServerError,
          description
        };
    }
  }
}
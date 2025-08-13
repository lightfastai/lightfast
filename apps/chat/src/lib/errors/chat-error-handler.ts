import { toast } from "sonner";
import type { AISDKError } from "ai";
import { ErrorCode } from "@repo/ui/components/lightfast-error-page";

export enum ChatErrorType {
  // Network & Connection
  NETWORK = "NETWORK",
  TIMEOUT = "TIMEOUT",
  
  // Rate Limiting & Security
  RATE_LIMIT = "RATE_LIMIT",
  BOT_DETECTION = "BOT_DETECTION",
  
  // Authentication & Authorization
  AUTHENTICATION = "AUTHENTICATION",
  MODEL_ACCESS_DENIED = "MODEL_ACCESS_DENIED",
  
  // Model & API Issues
  MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE",
  INVALID_MODEL = "INVALID_MODEL",
  NO_CONTENT = "NO_CONTENT",
  
  // Request Issues
  INVALID_REQUEST = "INVALID_REQUEST",
  INVALID_MESSAGE = "INVALID_MESSAGE",
  
  // Server Issues
  SERVER_ERROR = "SERVER_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  
  // Unknown
  UNKNOWN = "UNKNOWN",
}

export interface ChatError {
  type: ChatErrorType;
  message: string;
  details?: string;
  retryable: boolean;
  actionLabel?: string;
  action?: () => void;
  statusCode?: number;
}

export class ChatErrorHandler {
  private static parseErrorResponse(error: unknown): { 
    statusCode?: number; 
    errorMessage?: string; 
    errorCode?: string;
  } {
    // Handle fetch response errors
    if (error && typeof error === 'object' && 'status' in error) {
      return { 
        statusCode: (error as any).status,
        errorMessage: (error as any).statusText
      };
    }
    
    // Handle AI SDK errors
    if (error && typeof error === 'object' && 'name' in error) {
      const aiError = error as AISDKError;
      
      // Extract status code if available
      let statusCode: number | undefined;
      if ('statusCode' in aiError) {
        statusCode = (aiError as any).statusCode;
      } else if ('cause' in aiError && aiError.cause && typeof aiError.cause === 'object' && 'status' in aiError.cause) {
        statusCode = (aiError.cause as any).status;
      }
      
      return {
        statusCode,
        errorMessage: aiError.message,
        errorCode: aiError.name
      };
    }
    
    // Handle standard Error objects
    if (error instanceof Error) {
      return { errorMessage: error.message };
    }
    
    return {};
  }

  private static classifyError(error: unknown): ChatErrorType {
    const { statusCode, errorMessage, errorCode } = this.parseErrorResponse(error);
    const message = (errorMessage || '').toLowerCase();
    const code = (errorCode || '').toLowerCase();
    
    // Status code based classification
    if (statusCode) {
      switch (statusCode) {
        case 429:
          return ChatErrorType.RATE_LIMIT;
        case 401:
          return ChatErrorType.AUTHENTICATION;
        case 403:
          // Check specific 403 reasons
          if (message.includes('bot')) return ChatErrorType.BOT_DETECTION;
          if (message.includes('model') || message.includes('access')) return ChatErrorType.MODEL_ACCESS_DENIED;
          return ChatErrorType.AUTHENTICATION;
        case 400:
          return ChatErrorType.INVALID_REQUEST;
        case 404:
          if (message.includes('model')) return ChatErrorType.INVALID_MODEL;
          return ChatErrorType.INVALID_REQUEST;
        case 500:
        case 502:
        case 503:
        case 504:
          return ChatErrorType.SERVER_ERROR;
      }
    }
    
    // AI SDK error code classification
    if (code.includes('apiCall')) return ChatErrorType.NETWORK;
    if (code.includes('noContent')) return ChatErrorType.NO_CONTENT;
    if (code.includes('noSuchModel')) return ChatErrorType.INVALID_MODEL;
    if (code.includes('invalidMessage')) return ChatErrorType.INVALID_MESSAGE;
    if (code.includes('retry')) return ChatErrorType.NETWORK;
    
    // Message-based classification
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ChatErrorType.NETWORK;
    }
    if (message.includes('timeout')) {
      return ChatErrorType.TIMEOUT;
    }
    if (message.includes('rate') || message.includes('limit') || message.includes('too many')) {
      return ChatErrorType.RATE_LIMIT;
    }
    if (message.includes('bot')) {
      return ChatErrorType.BOT_DETECTION;
    }
    if (message.includes('model') && message.includes('access')) {
      return ChatErrorType.MODEL_ACCESS_DENIED;
    }
    if (message.includes('model') || message.includes('unavailable')) {
      return ChatErrorType.MODEL_UNAVAILABLE;
    }
    if (message.includes('auth') || message.includes('unauthorized')) {
      return ChatErrorType.AUTHENTICATION;
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return ChatErrorType.INVALID_REQUEST;
    }
    if (message.includes('server') || message.includes('internal')) {
      return ChatErrorType.SERVER_ERROR;
    }
    
    return ChatErrorType.UNKNOWN;
  }

  static handleError(
    error: unknown,
    options?: {
      onRetry?: () => void;
      showToast?: boolean;
      customMessage?: string;
    }
  ): ChatError {
    const errorType = this.classifyError(error);
    const { onRetry, showToast = true, customMessage } = options || {};
    const { statusCode } = this.parseErrorResponse(error);
    
    let chatError: ChatError;
    
    switch (errorType) {
      case ChatErrorType.NETWORK:
        chatError = {
          type: ChatErrorType.NETWORK,
          message: customMessage || "Connection issue",
          details: "Check your internet connection and try again.",
          retryable: true,
          actionLabel: "Retry",
          action: onRetry,
          statusCode,
        };
        break;
        
      case ChatErrorType.TIMEOUT:
        chatError = {
          type: ChatErrorType.TIMEOUT,
          message: customMessage || "Request timed out",
          details: "The request took too long. Please try again.",
          retryable: true,
          actionLabel: "Retry",
          action: onRetry,
          statusCode,
        };
        break;
        
      case ChatErrorType.RATE_LIMIT:
        chatError = {
          type: ChatErrorType.RATE_LIMIT,
          message: customMessage || "Rate limit reached",
          details: "You've sent too many messages. Please wait a moment.",
          retryable: false,
          statusCode: 429,
        };
        break;
        
      case ChatErrorType.BOT_DETECTION:
        chatError = {
          type: ChatErrorType.BOT_DETECTION,
          message: customMessage || "Automated activity detected",
          details: "Please verify you're human to continue.",
          retryable: false,
          statusCode: 403,
        };
        break;
        
      case ChatErrorType.MODEL_ACCESS_DENIED:
        chatError = {
          type: ChatErrorType.MODEL_ACCESS_DENIED,
          message: customMessage || "Model requires authentication",
          details: "Sign in to use this AI model.",
          retryable: false,
          statusCode: 403,
        };
        break;
        
      case ChatErrorType.MODEL_UNAVAILABLE:
        chatError = {
          type: ChatErrorType.MODEL_UNAVAILABLE,
          message: customMessage || "Model temporarily unavailable",
          details: "Try a different model or wait a moment.",
          retryable: true,
          actionLabel: "Retry",
          action: onRetry,
          statusCode,
        };
        break;
        
      case ChatErrorType.INVALID_MODEL:
        chatError = {
          type: ChatErrorType.INVALID_MODEL,
          message: customMessage || "Invalid model selected",
          details: "Please select a different model.",
          retryable: false,
          statusCode: 404,
        };
        break;
        
      case ChatErrorType.NO_CONTENT:
        chatError = {
          type: ChatErrorType.NO_CONTENT,
          message: customMessage || "No response generated",
          details: "The AI couldn't generate a response. Try rephrasing.",
          retryable: true,
          actionLabel: "Retry",
          action: onRetry,
          statusCode,
        };
        break;
        
      case ChatErrorType.AUTHENTICATION:
        chatError = {
          type: ChatErrorType.AUTHENTICATION,
          message: customMessage || "Authentication required",
          details: "Please sign in to continue.",
          retryable: false,
          statusCode: 401,
        };
        break;
        
      case ChatErrorType.INVALID_REQUEST:
        chatError = {
          type: ChatErrorType.INVALID_REQUEST,
          message: customMessage || "Invalid request",
          details: "Your message couldn't be processed. Try rephrasing.",
          retryable: true,
          actionLabel: "Edit & Retry",
          action: onRetry,
          statusCode: 400,
        };
        break;
        
      case ChatErrorType.INVALID_MESSAGE:
        chatError = {
          type: ChatErrorType.INVALID_MESSAGE,
          message: customMessage || "Message format error",
          details: "Your message format is invalid. Please try again.",
          retryable: true,
          actionLabel: "Retry",
          action: onRetry,
          statusCode: 400,
        };
        break;
        
      case ChatErrorType.SERVER_ERROR:
        chatError = {
          type: ChatErrorType.SERVER_ERROR,
          message: customMessage || "Server error",
          details: "Our servers are having issues. Please try again.",
          retryable: true,
          actionLabel: "Retry",
          action: onRetry,
          statusCode: statusCode || 500,
        };
        break;
        
      case ChatErrorType.INTERNAL_ERROR:
        chatError = {
          type: ChatErrorType.INTERNAL_ERROR,
          message: customMessage || "Something went wrong",
          details: "An unexpected error occurred. Please try again.",
          retryable: true,
          actionLabel: "Retry",
          action: onRetry,
          statusCode: 500,
        };
        break;
        
      default:
        chatError = {
          type: ChatErrorType.UNKNOWN,
          message: customMessage || "Something went wrong",
          details: error instanceof Error ? error.message : "Please try again later.",
          retryable: true,
          actionLabel: "Try Again",
          action: onRetry,
          statusCode,
        };
    }
    
    // Log error for debugging
    console.error(`[Chat Error] Type: ${errorType}, Status: ${statusCode}`, error);
    
    // Show toast notification if requested
    if (showToast) {
      this.showErrorToast(chatError);
    }
    
    return chatError;
  }

  private static showErrorToast(error: ChatError): void {
    // Longer duration for rate limits and auth errors
    const duration = [
      ChatErrorType.RATE_LIMIT,
      ChatErrorType.AUTHENTICATION,
      ChatErrorType.MODEL_ACCESS_DENIED,
      ChatErrorType.BOT_DETECTION
    ].includes(error.type) ? 6000 : 4000;
    
    toast.error(error.message, {
      description: error.details,
      duration,
      action: error.action && error.actionLabel ? {
        label: error.actionLabel,
        onClick: error.action,
      } : undefined,
    });
  }
  
  // Helper to determine if error should show inline in chat
  static shouldShowInline(error: ChatError): boolean {
    return [
      ChatErrorType.RATE_LIMIT,
      ChatErrorType.MODEL_ACCESS_DENIED,
      ChatErrorType.BOT_DETECTION,
      ChatErrorType.AUTHENTICATION,
    ].includes(error.type);
  }

  // Get error page configuration for error boundaries
  static getErrorPageConfig(
    error: Error & { digest?: string },
    context: "session" | "new" | "unauthenticated"
  ): { errorCode: ErrorCode; description: string } {
    // Context-specific default descriptions
    let description = "Something went wrong with the chat.";
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

    // Check for status code in error object
    const status = (error as any)?.status ?? (error as any)?.statusCode;
    const message = error.message?.toLowerCase() ?? "";
    
    if (status === 429 || message.includes("rate limit")) {
      return {
        errorCode: ErrorCode.TooManyRequests,
        description: "You've sent too many messages. Please wait a moment and try again."
      };
    } else if (status === 401 || message.includes("unauthorized")) {
      return {
        errorCode: ErrorCode.Unauthorized,
        description: "Please sign in to continue."
      };
    } else if (status === 403 || message.includes("forbidden") || message.includes("bot")) {
      return {
        errorCode: ErrorCode.Forbidden,
        description: message.includes("bot") 
          ? "Automated activity detected. Please verify you're human."
          : "Access denied. You don't have permission to access this resource."
      };
    } else if (status === 404 || message.includes("not found")) {
      return {
        errorCode: ErrorCode.NotFound,
        description: "The requested resource was not found."
      };
    } else if (status === 503 || message.includes("unavailable")) {
      return {
        errorCode: ErrorCode.ServiceUnavailable,
        description: "Service is temporarily unavailable. Please try again later."
      };
    } else if (status === 400 || message.includes("bad request")) {
      return {
        errorCode: ErrorCode.BadRequest,
        description: "Invalid request. Please check your input and try again."
      };
    }

    return {
      errorCode: ErrorCode.InternalServerError,
      description
    };
  }
}
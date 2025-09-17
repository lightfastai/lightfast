import { captureException } from "@sentry/nextjs";
import { 
  getErrorMessage, 
  isRateLimitError, 
  isAccountLockedError,
  formatLockoutTime
} from "~/app/lib/clerk/error-handling";

export interface ClerkErrorContext {
  component: string;
  action: string;
  email?: string;
  [key: string]: unknown;
}

export interface ClerkErrorResult {
  message: string;
  userMessage: string;
  isRateLimit: boolean;
  isAccountLocked: boolean;
  retryAfterSeconds?: number;
}

/**
 * Comprehensive Clerk error handler that:
 * 1. Extracts meaningful error messages
 * 2. Captures to Sentry with full context
 * 3. Returns user-friendly messages and metadata
 */
export function handleClerkError(
  error: unknown,
  context: ClerkErrorContext
): ClerkErrorResult {
  // Extract the Clerk error message
  const message = getErrorMessage(error);
  
  // Check for specific error types
  const rateLimitInfo = isRateLimitError(error);
  const lockoutInfo = isAccountLockedError(error);
  
  // Determine the user-facing message
  let userMessage = message;
  
  if (rateLimitInfo.rateLimited) {
    userMessage = rateLimitInfo.retryAfterSeconds
      ? `Rate limit exceeded. Please try again in ${formatLockoutTime(rateLimitInfo.retryAfterSeconds)}.`
      : "Rate limit exceeded. Please wait a moment and try again.";
  } else if (lockoutInfo.locked) {
    userMessage = lockoutInfo.expiresInSeconds
      ? `Account locked. Please try again in ${formatLockoutTime(lockoutInfo.expiresInSeconds)}.`
      : "Account locked. Please try again later.";
  } else if (message.toLowerCase().includes('incorrect') || message.toLowerCase().includes('invalid')) {
    userMessage = "The entered code is incorrect. Please try again and check for typos.";
  }
  
  // Create a descriptive error for Sentry with proper message
  const sentryError = new Error(`[${context.component}] ${context.action}: ${message}`);
  // Preserve original error as cause for full stack trace
  // Using Object.defineProperty to avoid ESLint warnings
  Object.defineProperty(sentryError, 'cause', {
    value: error,
    enumerable: false,
    writable: true,
    configurable: true
  });
  
  // Capture to Sentry with comprehensive context
  captureException(sentryError, {
    tags: {
      component: context.component,
      action: context.action,
      error_type: rateLimitInfo.rateLimited 
        ? 'rate_limit' 
        : lockoutInfo.locked 
          ? 'account_locked' 
          : 'validation',
    },
    extra: {
      ...context,
      clerkErrorMessage: message,
      userMessage,
      originalError: error,
      isRateLimited: rateLimitInfo.rateLimited,
      retryAfterSeconds: rateLimitInfo.retryAfterSeconds,
      isAccountLocked: lockoutInfo.locked,
      lockoutExpiresInSeconds: lockoutInfo.expiresInSeconds,
    },
  });
  
  return {
    message,
    userMessage,
    isRateLimit: rateLimitInfo.rateLimited,
    isAccountLocked: lockoutInfo.locked,
    retryAfterSeconds: rateLimitInfo.retryAfterSeconds,
  };
}

/**
 * Handle unexpected status responses (non-error cases that shouldn't happen)
 */
export function handleUnexpectedStatus(
  status: string,
  context: ClerkErrorContext & { result?: unknown }
): void {
  const error = new Error(
    `[${context.component}] Unexpected status: ${status} for ${context.action}`
  );
  
  captureException(error, {
    tags: {
      component: context.component,
      action: context.action,
      status,
      error_type: 'unexpected_status',
    },
    extra: {
      ...context,
      status,
    },
  });
}
import { isClerkAPIResponseError, isUserLockedError } from '@clerk/shared'
import type { ClerkAPIError } from '@clerk/types'

export interface AuthError {
  code: string
  message: string
  longMessage: string
  meta?: Record<string, unknown>
}

/**
 * Extract user-friendly error message from Clerk errors
 */
export function getErrorMessage(err: unknown): string {
  // Handle Clerk API errors
  if (isClerkAPIResponseError(err)) {
    // When isClerkAPIResponseError is true, err.errors is guaranteed to exist
    const firstError = err.errors[0]
    if (firstError) {
      return firstError.longMessage ?? firstError.message
    }
  }
  
  // Handle standard Error objects
  if (err instanceof Error) {
    return err.message
  }
  
  // Handle string errors
  if (typeof err === 'string') {
    return err
  }
  
  // Default error message
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Get all errors from a Clerk error response
 */
export function getAllErrors(err: unknown): AuthError[] {
  if (isClerkAPIResponseError(err)) {
    return err.errors.map((error: ClerkAPIError) => ({
      code: error.code,
      message: error.message,
      longMessage: error.longMessage ?? error.message,
      meta: error.meta,
    }))
  }
  
  return []
}

/**
 * Check if error is due to account lockout
 */
export function isAccountLockedError(err: unknown): { locked: boolean; expiresInSeconds?: number } {
  if (isUserLockedError(err)) {
    // When user is locked, check for lockout expiration in the error metadata
    if (isClerkAPIResponseError(err)) {
      const lockoutError = err.errors.find(
        (error: ClerkAPIError) => error.code === 'user_locked'
      )
      
      // According to Clerk docs, lockout_expires_in_seconds is included in the response
      // but not in the TypeScript types. We'll access it safely.
      const meta = lockoutError?.meta as Record<string, unknown> | undefined
      const expiresInSeconds = meta?.lockout_expires_in_seconds
      
      if (typeof expiresInSeconds === 'number') {
        return {
          locked: true,
          expiresInSeconds,
        }
      }
    }
    
    return { locked: true }
  }
  
  return { locked: false }
}

/**
 * Check if error is due to sign-up waitlist restriction
 */
export function isSignUpRestricted(err: unknown): boolean {
  if (isClerkAPIResponseError(err)) {
    return err.errors.some(
      (error: ClerkAPIError) => error.code === 'sign_up_restricted_waitlist'
    )
  }

  return false
}

/**
 * Check if error is due to rate limiting
 */
export function isRateLimitError(err: unknown): { rateLimited: boolean; retryAfterSeconds?: number } {
  if (isClerkAPIResponseError(err)) {
    // Check if it's a rate limit error (429 status or too_many_requests code)
    if (err.status === 429 || err.errors.some(e => e.code === 'too_many_requests')) {
      // The Retry-After header might be available on the error object
      // Note: Clerk's error type doesn't expose headers directly, so we need to check various possible locations
      // This is a defensive approach since the exact structure depends on Clerk's internal implementation
      
      // Try to extract retry-after from various possible locations
      let retryAfterValue: unknown = undefined;
      
      // Check if headers property exists
      if ('headers' in err) {
        const headers = err.headers as Record<string, unknown> | undefined;
        retryAfterValue = headers?.['retry-after'];
      }
      
      // Check for direct retryAfter property
      if (!retryAfterValue && 'retryAfter' in err) {
        retryAfterValue = err.retryAfter;
      }
      
      // Convert to seconds if we found a value
      if (retryAfterValue !== undefined && retryAfterValue !== null) {
        const retryAfterSeconds = typeof retryAfterValue === 'string' 
          ? parseInt(retryAfterValue, 10) 
          : typeof retryAfterValue === 'number' 
            ? retryAfterValue 
            : undefined;
            
        if (retryAfterSeconds !== undefined && !isNaN(retryAfterSeconds)) {
          return {
            rateLimited: true,
            retryAfterSeconds
          }
        }
      }
      
      // If we can't find retry-after, still indicate it's rate limited
      return { rateLimited: true }
    }
  }
  
  return { rateLimited: false }
}

/**
 * Format lockout time for display
 */
export function formatLockoutTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes === 1) {
    return remainingSeconds > 0 
      ? `1 minute and ${remainingSeconds} seconds`
      : '1 minute'
  }
  
  return remainingSeconds > 0
    ? `${minutes} minutes and ${remainingSeconds} seconds`
    : `${minutes} minutes`
}

/**
 * Format error details for logging
 * @param context - The context where the error occurred
 * @param err - The error object
 * @returns Structured error data for logging
 */
export function formatErrorForLogging(context: string, err: unknown): Record<string, unknown> {
  const errorData: Record<string, unknown> = {
    context,
    timestamp: new Date().toISOString(),
  }
  
  if (isClerkAPIResponseError(err)) {
    errorData.error = {
      message: err.message,
      clerkErrors: err.errors,
      status: err.status,
    }
  } else if (err instanceof Error) {
    errorData.error = {
      message: err.message,
      stack: err.stack,
      name: err.name
    }
  } else {
    errorData.error = err
  }
  
  return errorData
}
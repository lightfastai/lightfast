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
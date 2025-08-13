import { useState, useCallback } from "react";

/**
 * Custom hook for handling non-streaming errors that need to be caught by error boundaries
 * 
 * HOW THE RE-THROW MECHANISM WORKS:
 * ================================
 * 
 * The challenge: When errors occur in async callbacks (like useChat's onError), 
 * throwing directly doesn't propagate to React error boundaries because:
 * 
 * 1. Error boundaries only catch errors during render, lifecycle methods, and constructors
 * 2. Async callbacks execute outside the React render cycle
 * 3. Throwing in setTimeout, Promise.catch, or event handlers won't trigger error boundaries
 * 
 * The solution: State-based error throwing
 * 
 * 1. CAPTURE: Store the error in component state (setErrorToThrow)
 * 2. RE-RENDER: State update triggers component re-render
 * 3. THROW: During render, if errorToThrow exists, throw it synchronously
 * 4. CATCH: Error boundary catches the synchronous throw during render
 * 
 * Flow:
 * onError callback → setErrorToThrow(error) → component re-renders → throw error → error.tsx
 * 
 * Why this works:
 * - The throw happens during the render phase (synchronous)
 * - Error boundaries are designed to catch render-phase errors
 * - React's error boundary mechanism can handle the error properly
 * 
 * Alternative approaches that DON'T work:
 * - Direct throw in onError: throw error ❌
 * - setTimeout throw: setTimeout(() => throw error) ❌  
 * - Promise rejection: Promise.reject(error) ❌
 * 
 * ERROR CLASSIFICATION:
 * ====================
 * 
 * Non-streaming errors (→ Error Boundaries):
 * - 429 Rate Limit: "You've sent too many messages"
 * - 401 Unauthorized: "Please sign in to continue"
 * - 403 Bot Detection: "Automated activity detected"
 * - 403 Model Access: "This model requires authentication"
 * 
 * Streaming errors (→ Chat UI with toast + inline):
 * - Network/Timeout: Connection issues
 * - Server Errors (500/502/503/504): Temporary server problems
 * - Model Unavailable: Temporary model issues
 * - Invalid Request: Recoverable request problems
 * 
 * USAGE EXAMPLES:
 * ===============
 * 
 * Basic usage:
 * ```typescript
 * const { throwToErrorBoundary, shouldThrowToErrorBoundary } = useErrorBoundaryHandler();
 * 
 * const { messages } = useChat({
 *   onError: (error) => {
 *     if (shouldThrowToErrorBoundary(status)) {
 *       throwToErrorBoundary(error); // → error.tsx
 *       return;
 *     }
 *     // Handle streaming errors in chat UI
 *     handleStreamingError(error); // → toast + inline
 *   }
 * });
 * ```
 * 
 * Custom error classification:
 * ```typescript
 * const handleError = (error: unknown) => {
 *   if (error instanceof AuthenticationError) {
 *     throwToErrorBoundary(error);
 *     return;
 *   }
 *   // Handle other errors inline
 *   showInlineError(error);
 * };
 * ```
 * 
 * Testing error boundaries (development):
 * ```typescript
 * const testErrorBoundary = () => {
 *   throwToErrorBoundary(new Error("Test error"));
 * };
 * ```
 * 
 * Available development chat commands:
 * 
 * Non-streaming errors (→ Error Boundaries):
 * - `/test error rate-limit` - Trigger rate limit (429)
 * - `/test error bot` - Trigger bot detection (403)  
 * - `/test error model-access` - Model access denied (403)
 * - `/test error auth` - Authentication required (401)
 * 
 * Streaming errors (→ Chat UI with toast + inline):
 * - `/test error server` - Server error (500)
 * - `/test error bad-gateway` - Bad gateway (502)
 * - `/test error unavailable` - Service unavailable (503)
 * - `/test error timeout` - Gateway timeout (504)
 * - `/test error bad-request` - Bad request (400)
 * - `/test error not-found` - Not found (404)
 * 
 * You can also use HTTP status codes:
 * - `/test error 429` - Same as rate-limit
 * - `/test error 500` - Same as server
 * - Any status code 400-599
 * 
 * Use `/test error help` to see all commands in chat.
 * 
 * Cleanup:
 * ```typescript
 * useEffect(() => {
 *   return () => clearError(); // Clear on unmount
 * }, [clearError]);
 * 
 * const handleSuccess = () => {
 *   clearError(); // Clear after success
 * };
 * ```
 */
export function useErrorBoundaryHandler() {
  // State to hold error that should be thrown to error boundary
  const [errorToThrow, setErrorToThrow] = useState<Error | null>(null);

  /**
   * Throw error to error boundary using state-based mechanism
   * This logs the error and sets it to be thrown on next render
   */
  const throwToErrorBoundary = useCallback((error: unknown) => {
    // Convert unknown error to Error object
    const errorObj = error instanceof Error 
      ? error 
      : new Error(error ? String(error) : "Unknown error");

    console.error(
      "[Error Boundary Handler] Non-streaming error, triggering error boundary:",
      errorObj
    );

    // Set error state - this will cause re-render and throw
    setErrorToThrow(errorObj);
  }, []);

  /**
   * Clear error state (useful for cleanup)
   */
  const clearError = useCallback(() => {
    setErrorToThrow(null);
  }, []);

  /**
   * Check if we should throw an error based on streaming status
   * Call this at the component level to determine error handling path
   */
  const shouldThrowToErrorBoundary = useCallback((status: string) => {
    // Non-streaming errors should go to error boundary
    // These are typically blocking errors like auth, rate limits, etc.
    return status !== "streaming";
  }, []);

  // CRITICAL: This throw must happen during render phase
  // If errorToThrow is set, throw it synchronously so error boundary can catch it
  if (errorToThrow) {
    // Clear the error state before throwing to prevent infinite loops
    const errorToThrowNow = errorToThrow;
    setErrorToThrow(null);
    throw errorToThrowNow;
  }

  return {
    throwToErrorBoundary,
    clearError,
    shouldThrowToErrorBoundary,
  };
}
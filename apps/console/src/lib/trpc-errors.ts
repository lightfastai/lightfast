import type { TRPCClientError } from "@trpc/client";
import { toast } from "@repo/ui/components/ui/sonner";
import type { UserRouter, OrgRouter } from "@api/console";

/**
 * Combined router type for error handling
 * Matches client-side router union used in @repo/console-trpc
 */
type ConsoleRouters = UserRouter & OrgRouter;

/**
 * TRPC error codes - matches server-side codes
 */
type TRPCErrorCode =
  | "PARSE_ERROR"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "TIMEOUT";

/**
 * Error codes where the server message is safe to display to users.
 * These are codes where procedures intentionally set user-facing messages
 * (e.g., "Workspace already exists" for CONFLICT).
 */
const SAFE_MESSAGE_CODES: ReadonlySet<TRPCErrorCode> = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "TOO_MANY_REQUESTS",
]);

/**
 * Type guard to check if an error is a TRPCClientError
 */
export function isTRPCClientError(
  error: unknown
): error is TRPCClientError<ConsoleRouters> {
  return error instanceof Error && error.name === "TRPCClientError";
}

/**
 * Extract the TRPC error code from an error
 */
export function getTRPCErrorCode(error: unknown): TRPCErrorCode | null {
  if (!isTRPCClientError(error)) {
    return null;
  }

  if (error.data?.code && typeof error.data.code === "string") {
    return error.data.code as TRPCErrorCode;
  }

  return null;
}

/**
 * Get a safe error message for display to users.
 *
 * For known-safe codes (CONFLICT, BAD_REQUEST, etc.), returns the server message.
 * For INTERNAL_SERVER_ERROR or unknown errors, returns a generic message.
 */
export function getSafeErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again."
): string {
  if (!isTRPCClientError(error)) {
    return fallback;
  }

  const code = getTRPCErrorCode(error);

  if (code && SAFE_MESSAGE_CODES.has(code) && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * Show an error toast with safe message handling.
 *
 * For known-safe error codes, displays the server message.
 * For INTERNAL_SERVER_ERROR, displays a generic message.
 */
export function showErrorToast(
  error: unknown,
  title: string,
  fallback?: string
): void {
  toast.error(title, {
    description: getSafeErrorMessage(error, fallback),
  });
}

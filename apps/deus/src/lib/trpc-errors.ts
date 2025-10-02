import type { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import type { DeusAppRouter } from "@api/deus";

/**
 * TRPC error codes that can be returned from the server
 * These match the official TRPC error code keys
 */
export const TRPC_ERROR_CODES = {
	PARSE_ERROR: "PARSE_ERROR",
	BAD_REQUEST: "BAD_REQUEST",
	INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	METHOD_NOT_SUPPORTED: "METHOD_NOT_SUPPORTED",
	TIMEOUT: "TIMEOUT",
	CONFLICT: "CONFLICT",
	PRECONDITION_FAILED: "PRECONDITION_FAILED",
	PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
	TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
	CLIENT_CLOSED_REQUEST: "CLIENT_CLOSED_REQUEST",
	UNPROCESSABLE_CONTENT: "UNPROCESSABLE_CONTENT",
} as const;

export type TRPCErrorCode = keyof typeof TRPC_ERROR_CODES;

/**
 * User-friendly error messages for each TRPC error code
 */
export const ERROR_MESSAGES: Record<TRPCErrorCode, string> = {
	PARSE_ERROR: "There was an error processing your request",
	BAD_REQUEST: "Invalid request. Please check your input",
	INTERNAL_SERVER_ERROR: "Something went wrong. Please try again",
	UNAUTHORIZED: "You need to be logged in to perform this action",
	FORBIDDEN: "You don't have permission to perform this action",
	NOT_FOUND: "The requested resource was not found",
	METHOD_NOT_SUPPORTED: "This operation is not supported",
	TIMEOUT: "The request timed out. Please try again",
	CONFLICT: "This action conflicts with the current state. Please refresh and try again",
	PRECONDITION_FAILED: "The request conditions were not met",
	PAYLOAD_TOO_LARGE: "The request is too large",
	TOO_MANY_REQUESTS: "Too many requests. Please slow down",
	CLIENT_CLOSED_REQUEST: "The request was cancelled",
	UNPROCESSABLE_CONTENT: "The submitted content could not be processed",
};

/**
 * Type guard to check if an error is a TRPCClientError
 */
export function isTRPCClientError(
	error: unknown
): error is TRPCClientError<DeusAppRouter> {
	return error instanceof Error && error.name === "TRPCClientError";
}

/**
 * Extract the TRPC error code from an error
 */
export function getTRPCErrorCode(error: unknown): TRPCErrorCode | null {
	if (!isTRPCClientError(error)) {
		return null;
	}
	
	// The error code is available in the data.code property
	if (error.data?.code && typeof error.data.code === "string") {
		return error.data.code as TRPCErrorCode;
	}
	
	return null;
}

/**
 * Extract the HTTP status code from a TRPC error
 */
export function getTRPCHttpStatus(error: unknown): number | null {
	if (!isTRPCClientError(error)) {
		return null;
	}
	
	// The HTTP status is available in the data.httpStatus property
	if (error.data?.httpStatus && typeof error.data.httpStatus === "number") {
		return error.data.httpStatus;
	}
	
	return null;
}

/**
 * Extract the TRPC error message from an error
 */
export function getTRPCErrorMessage(error: unknown): string {
	if (!isTRPCClientError(error)) {
		return "An unexpected error occurred";
	}

	// First try to get the custom message from the server
	if (error.message) {
		return error.message;
	}

	// Fallback to our predefined messages
	const code = getTRPCErrorCode(error);
	if (code && code in ERROR_MESSAGES) {
		return ERROR_MESSAGES[code];
	}

	return "An unexpected error occurred";
}

/**
 * Get a user-friendly error message based on the error code
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
	const code = getTRPCErrorCode(error);
	
	if (code && code in ERROR_MESSAGES) {
		return ERROR_MESSAGES[code];
	}

	// Fallback to the original error message if it's available
	if (isTRPCClientError(error) && error.message) {
		return error.message;
	}

	return ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
}

/**
 * Extract validation errors from BAD_REQUEST errors
 */
export function getValidationErrors(error: unknown): Record<string, string[]> | null {
	if (!isTRPCClientError(error)) {
		return null;
	}

	const code = getTRPCErrorCode(error);
	if (code !== "BAD_REQUEST") {
		return null;
	}

	// Check if the error has validation details (Zod errors typically structure this way)
	// Access the data property of TRPCClientError
	if (error.data && typeof error.data === "object" && "zodError" in error.data) {
		const zodError = error.data.zodError;
		if (zodError && typeof zodError === 'object' && 'fieldErrors' in zodError) {
			// Type assertion is safe here because we've checked the structure
			return (zodError as { fieldErrors: Record<string, string[]> }).fieldErrors;
		}
	}

	// Alternative structure for validation errors
	if (error.data && typeof error.data === "object" && "validationErrors" in error.data) {
		return error.data.validationErrors as Record<string, string[]>;
	}

	return null;
}

/**
 * Check if an error is a specific TRPC error code
 */
export function isUnauthorized(error: unknown): boolean {
	return getTRPCErrorCode(error) === "UNAUTHORIZED";
}

export function isForbidden(error: unknown): boolean {
	return getTRPCErrorCode(error) === "FORBIDDEN";
}

export function isNotFound(error: unknown): boolean {
	return getTRPCErrorCode(error) === "NOT_FOUND";
}

export function isBadRequest(error: unknown): boolean {
	return getTRPCErrorCode(error) === "BAD_REQUEST";
}

export function isInternalServerError(error: unknown): boolean {
	return getTRPCErrorCode(error) === "INTERNAL_SERVER_ERROR";
}

export function isTimeout(error: unknown): boolean {
	return getTRPCErrorCode(error) === "TIMEOUT";
}

export function isTooManyRequests(error: unknown): boolean {
	return getTRPCErrorCode(error) === "TOO_MANY_REQUESTS";
}

export function isConflict(error: unknown): boolean {
	return getTRPCErrorCode(error) === "CONFLICT";
}

export function isUnprocessableContent(error: unknown): boolean {
	return getTRPCErrorCode(error) === "UNPROCESSABLE_CONTENT";
}

export function isParseError(error: unknown): boolean {
	return getTRPCErrorCode(error) === "PARSE_ERROR";
}

export function isMethodNotSupported(error: unknown): boolean {
	return getTRPCErrorCode(error) === "METHOD_NOT_SUPPORTED";
}

export function isPreconditionFailed(error: unknown): boolean {
	return getTRPCErrorCode(error) === "PRECONDITION_FAILED";
}

export function isPayloadTooLarge(error: unknown): boolean {
	return getTRPCErrorCode(error) === "PAYLOAD_TOO_LARGE";
}

export function isClientClosedRequest(error: unknown): boolean {
	return getTRPCErrorCode(error) === "CLIENT_CLOSED_REQUEST";
}

/**
 * Display an error toast with appropriate styling and message
 */
export function showTRPCErrorToast(error: unknown, customMessage?: string): void {
	const code = getTRPCErrorCode(error);
	const message = customMessage ?? getUserFriendlyErrorMessage(error);

	// Special handling for different error types
	switch (code) {
		case "UNAUTHORIZED":
			toast.error(message, {
				description: "Please log in to continue",
				duration: 5000,
			});
			break;

		case "FORBIDDEN":
			toast.error(message, {
				description: "Contact support if you believe this is an error",
				duration: 5000,
			});
			break;

		case "NOT_FOUND":
			toast.error(message, {
				description: "The item you're looking for might have been moved or deleted",
				duration: 4000,
			});
			break;

		case "BAD_REQUEST": {
			const validationErrors = getValidationErrors(error);
			if (validationErrors) {
				// Show validation errors in a more detailed way
				const errorDetails = Object.entries(validationErrors)
					.map(([field, errors]) => `${field}: ${errors.join(", ")}`)
					.join("\n");
				
				toast.error(message, {
					description: errorDetails,
					duration: 6000,
				});
			} else {
				toast.error(message, {
					duration: 4000,
				});
			}
			break;
		}

		case "TOO_MANY_REQUESTS":
			toast.error(message, {
				description: "Please wait a moment before trying again",
				duration: 6000,
			});
			break;

		case "TIMEOUT":
			toast.error(message, {
				description: "The server took too long to respond",
				duration: 5000,
			});
			break;

		case "INTERNAL_SERVER_ERROR":
			toast.error(message, {
				description: "Our team has been notified of this issue",
				duration: 5000,
			});
			break;

		case "PARSE_ERROR":
			toast.error(message, {
				description: "There was an issue with the request format",
				duration: 4000,
			});
			break;

		case "METHOD_NOT_SUPPORTED":
			toast.error(message, {
				description: "This feature is not available",
				duration: 4000,
			});
			break;

		case "PRECONDITION_FAILED":
			toast.error(message, {
				description: "Please refresh and try again",
				duration: 4000,
			});
			break;

		case "PAYLOAD_TOO_LARGE":
			toast.error(message, {
				description: "Please reduce the size of your request",
				duration: 5000,
			});
			break;

		case "UNPROCESSABLE_CONTENT":
			toast.error(message, {
				description: "Please check your input and try again",
				duration: 4000,
			});
			break;

		case "CLIENT_CLOSED_REQUEST":
			toast.warning(message, {
				description: "The operation was cancelled",
				duration: 3000,
			});
			break;

		default:
			toast.error(message, {
				duration: 4000,
			});
			break;
	}
}

/**
 * Display a success toast (helper for consistent success messaging)
 */
export function showSuccessToast(message: string, description?: string): void {
	toast.success(message, {
		description,
		duration: 3000,
	});
}

/**
 * Display a warning toast (helper for consistent warning messaging)
 */
export function showWarningToast(message: string, description?: string): void {
	toast.warning(message, {
		description,
		duration: 4000,
	});
}

/**
 * Display an info toast (helper for consistent info messaging)
 */
export function showInfoToast(message: string, description?: string): void {
	toast.info(message, {
		description,
		duration: 3000,
	});
}

/**
 * Utility to handle TRPC errors with automatic toast display
 * Returns true if the error was handled, false otherwise
 */
export function handleTRPCError(error: unknown, customMessage?: string): boolean {
	if (isTRPCClientError(error)) {
		showTRPCErrorToast(error, customMessage);
		return true;
	}
	
	return false;
}

/**
 * Higher-order function to wrap async operations with automatic error handling
 */
export function withTRPCErrorHandling<T extends unknown[], R>(
	fn: (...args: T) => Promise<R>,
	options?: {
		customErrorMessage?: string;
		onError?: (error: unknown) => void;
		suppressToast?: boolean;
	}
) {
	return async (...args: T): Promise<R | undefined> => {
		try {
			return await fn(...args);
		} catch (error) {
			// Call custom error handler if provided
			options?.onError?.(error);

			// Show toast unless suppressed
			if (!options?.suppressToast) {
				handleTRPCError(error, options?.customErrorMessage);
			}

			// Re-throw non-TRPC errors
			if (!isTRPCClientError(error)) {
				throw error;
			}

			return undefined;
		}
	};
}

/**
 * React hook for consistent error handling in components
 */
export function useTRPCErrorHandler() {
	return {
		handleError: handleTRPCError,
		showTRPCErrorToast,
		showSuccessToast,
		showWarningToast,
		showInfoToast,
		isTRPCError: isTRPCClientError,
		getErrorCode: getTRPCErrorCode,
		getErrorMessage: getTRPCErrorMessage,
		getUserFriendlyMessage: getUserFriendlyErrorMessage,
		getValidationErrors,
		// Error type checkers
		isUnauthorized,
		isForbidden,
		isNotFound,
		isBadRequest,
		isInternalServerError,
		isTimeout,
		isTooManyRequests,
		isConflict,
		isUnprocessableContent,
		isParseError,
		isMethodNotSupported,
		isPreconditionFailed,
		isPayloadTooLarge,
		isClientClosedRequest,
	};
}
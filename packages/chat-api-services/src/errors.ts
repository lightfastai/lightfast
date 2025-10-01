import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import { TRPCError } from "@trpc/server";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/rpc";

import { ChatApiError } from "./base-service";

// Re-export ChatApiError for convenience
export { ChatApiError };

export type TRPCErrorCode = TRPC_ERROR_CODE_KEY;

export const TRPC_ERROR_CODES = TRPC_ERROR_CODES_BY_KEY;

export const ERROR_MESSAGES: Partial<Record<TRPCErrorCode, string>> = {
	PARSE_ERROR: "There was an error processing your request",
	BAD_REQUEST: "Invalid request. Please check your input",
	INTERNAL_SERVER_ERROR: "Something went wrong. Please try again",
	UNAUTHORIZED: "You need to be logged in to perform this action",
	FORBIDDEN: "You don't have permission to perform this action",
	NOT_FOUND: "The requested resource was not found",
	METHOD_NOT_SUPPORTED: "This operation is not supported",
	TIMEOUT: "The request timed out. Please try again",
	CONFLICT:
		"This action conflicts with the current state. Please refresh and try again",
	PRECONDITION_FAILED: "The request conditions were not met",
	PAYLOAD_TOO_LARGE: "The request is too large",
	TOO_MANY_REQUESTS: "Too many requests. Please slow down",
	CLIENT_CLOSED_REQUEST: "The request was cancelled",
	UNPROCESSABLE_CONTENT: "The submitted content could not be processed",
};

export function isTRPCClientError(
	error: unknown,
): error is ChatApiError | TRPCError {
	return error instanceof ChatApiError || error instanceof TRPCError;
}

export function getTRPCErrorCode(error: unknown): TRPCErrorCode | null {
	if (error instanceof ChatApiError) {
		return error.code;
	}

	if (error instanceof TRPCError) {
		return error.code;
	}

	return null;
}

export function getTRPCErrorMessage(error: unknown): string {
	if (error instanceof ChatApiError) {
		return (
			error.message ??
			ERROR_MESSAGES[error.code] ??
			"An unexpected error occurred"
		);
	}

	if (error instanceof TRPCError) {
		return (
			error.message ??
			ERROR_MESSAGES[error.code] ??
			"An unexpected error occurred"
		);
	}

	return "An unexpected error occurred";
}

export function getTRPCHttpStatus(error: unknown): number | null {
	if (error instanceof ChatApiError) {
		return error.status ?? null;
	}

	if (error instanceof TRPCError) {
		return error.cause &&
			typeof (error.cause as { httpStatus?: number }).httpStatus === "number"
			? ((error.cause as { httpStatus?: number }).httpStatus as number)
			: null;
	}

	return null;
}

export function getUserFriendlyErrorMessage(error: unknown): string {
	const code = getTRPCErrorCode(error);

	if (code && code in ERROR_MESSAGES) {
		return ERROR_MESSAGES[code] ?? "An unexpected error occurred";
	}

	if (error instanceof ChatApiError || error instanceof TRPCError) {
		return error.message ?? "An unexpected error occurred";
	}

	return "An unexpected error occurred";
}

export function getValidationErrors(
	_error: unknown,
): Record<string, string[]> | null {
	return null;
}

function isErrorCode(error: unknown, code: TRPCErrorCode): boolean {
	return getTRPCErrorCode(error) === code;
}

export const isUnauthorized = (error: unknown): boolean =>
	isErrorCode(error, "UNAUTHORIZED");
export const isForbidden = (error: unknown): boolean =>
	isErrorCode(error, "FORBIDDEN");
export const isNotFound = (error: unknown): boolean =>
	isErrorCode(error, "NOT_FOUND");
export const isBadRequest = (error: unknown): boolean =>
	isErrorCode(error, "BAD_REQUEST");
export const isInternalServerError = (error: unknown): boolean =>
	isErrorCode(error, "INTERNAL_SERVER_ERROR");
export const isTimeout = (error: unknown): boolean =>
	isErrorCode(error, "TIMEOUT");
export const isTooManyRequests = (error: unknown): boolean =>
	isErrorCode(error, "TOO_MANY_REQUESTS");
export const isConflict = (error: unknown): boolean =>
	isErrorCode(error, "CONFLICT");
export const isUnprocessableContent = (error: unknown): boolean =>
	isErrorCode(error, "UNPROCESSABLE_CONTENT");
export const isParseError = (error: unknown): boolean =>
	isErrorCode(error, "PARSE_ERROR");

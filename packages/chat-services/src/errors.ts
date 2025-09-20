import type { TRPCClientError } from "@trpc/client";
import type { ChatAppRouter } from "@api/chat";

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

export function isTRPCClientError(
  error: unknown,
): error is TRPCClientError<ChatAppRouter> {
  return error instanceof Error && error.name === "TRPCClientError";
}

export function getTRPCErrorCode(error: unknown): TRPCErrorCode | null {
  if (!isTRPCClientError(error)) {
    return null;
  }

  if (error.data?.code && typeof error.data.code === "string") {
    return error.data.code as TRPCErrorCode;
  }

  return null;
}

export function getTRPCErrorMessage(error: unknown): string {
  if (!isTRPCClientError(error)) {
    return "An unexpected error occurred";
  }

  if (error.message) {
    return error.message;
  }

  const code = getTRPCErrorCode(error);
  if (code && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }

  return "An unexpected error occurred";
}

export function getTRPCHttpStatus(error: unknown): number | null {
  if (!isTRPCClientError(error)) {
    return null;
  }

  if (error.data?.httpStatus && typeof error.data.httpStatus === "number") {
    return error.data.httpStatus;
  }

  return null;
}

export function getUserFriendlyErrorMessage(error: unknown): string {
  const code = getTRPCErrorCode(error);

  if (code && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }

  if (isTRPCClientError(error) && error.message) {
    return error.message;
  }

  return ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
}

export function getValidationErrors(
  error: unknown,
): Record<string, string[]> | null {
  if (!isTRPCClientError(error)) {
    return null;
  }

  const code = getTRPCErrorCode(error);
  if (code !== "BAD_REQUEST") {
    return null;
  }

  if (error.data && typeof error.data === "object" && "zodError" in error.data) {
    const zodError = error.data.zodError;
    if (zodError && typeof zodError === "object" && "fieldErrors" in zodError) {
      return (zodError as { fieldErrors: Record<string, string[]> }).fieldErrors;
    }
  }

  if (error.data && typeof error.data === "object" && "validationErrors" in error.data) {
    return error.data.validationErrors as Record<string, string[]>;
  }

  return null;
}

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

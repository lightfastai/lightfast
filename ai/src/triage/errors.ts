import { APICallError, NoObjectGeneratedError, RetryError } from "@vendor/ai";

import {
  TRIAGE_FAILED_ERROR_CODE,
  TRIAGE_INVALID_OUTPUT_ERROR_CODE,
  TRIAGE_PROVIDER_ERROR_CODE,
  TRIAGE_TIMEOUT_ERROR_CODE,
  type TriageFailureCode,
} from "./constants";

export interface TriageFailure {
  errorCode: TriageFailureCode;
  errorMessage: string;
}

export function getTriageFailure(error: unknown): TriageFailure {
  const message = getErrorMessage(error);

  if (isTimeoutError(error)) {
    return {
      errorCode: TRIAGE_TIMEOUT_ERROR_CODE,
      errorMessage: message,
    };
  }

  if (isInvalidOutputError(error)) {
    return {
      errorCode: TRIAGE_INVALID_OUTPUT_ERROR_CODE,
      errorMessage: message,
    };
  }

  if (isProviderError(error)) {
    return {
      errorCode: TRIAGE_PROVIDER_ERROR_CODE,
      errorMessage: message,
    };
  }

  return {
    errorCode: TRIAGE_FAILED_ERROR_CODE,
    errorMessage: message,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isProviderError(error: unknown): boolean {
  return (
    APICallError.isInstance(error) ||
    hasErrorName(error, "AI_APICallError") ||
    hasErrorName(error, "GatewayError") ||
    hasCauseMatching(error, isProviderError)
  );
}

function isInvalidOutputError(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    hasErrorName(error, "AI_NoObjectGeneratedError") ||
    hasCauseMatching(error, isInvalidOutputError)
  );
}

function isTimeoutError(error: unknown): boolean {
  return (
    hasErrorName(error, "AbortError") ||
    hasErrorName(error, "TimeoutError") ||
    (RetryError.isInstance(error) && error.reason === "abort") ||
    hasCauseMatching(error, isTimeoutError)
  );
}

function hasErrorName(error: unknown, name: string): boolean {
  return (
    error instanceof Error && (error.name === name || error.name.includes(name))
  );
}

function hasCauseMatching(
  error: unknown,
  predicate: (error: unknown) => boolean
): boolean {
  if (!(error instanceof Error && "cause" in error)) {
    return false;
  }

  return predicate(error.cause);
}

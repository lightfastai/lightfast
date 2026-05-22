import { APICallError, NoObjectGeneratedError, RetryError } from "ai";

import {
  SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE,
  SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
  SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE,
  SIGNAL_CLASSIFICATION_TIMEOUT_ERROR_CODE,
  type SignalClassificationFailureCode,
} from "./constants";

export function getSignalClassificationFailure(error: unknown): {
  errorCode: SignalClassificationFailureCode;
  errorMessage: string;
} {
  const errorMessage = getErrorMessage(error);

  if (isInvalidOutputError(error)) {
    return {
      errorCode: SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
      errorMessage,
    };
  }

  if (isTimeoutError(error)) {
    return {
      errorCode: SIGNAL_CLASSIFICATION_TIMEOUT_ERROR_CODE,
      errorMessage,
    };
  }

  if (isProviderError(error)) {
    return {
      errorCode: SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE,
      errorMessage,
    };
  }

  return {
    errorCode: SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE,
    errorMessage,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function isProviderError(error: unknown): boolean {
  return (
    APICallError.isInstance(error) ||
    hasErrorName(error, "AI_APICallError") ||
    hasErrorName(error, "GatewayError") ||
    hasCauseMatching(error, isProviderError)
  );
}

function hasErrorName(error: unknown, name: string): boolean {
  return (
    error instanceof Error &&
    (error.name === name || error.name.includes(name))
  );
}

function hasCauseMatching(
  error: unknown,
  predicate: (error: unknown) => boolean
): boolean {
  if (!(error instanceof Error) || !("cause" in error)) {
    return false;
  }

  return predicate(error.cause);
}

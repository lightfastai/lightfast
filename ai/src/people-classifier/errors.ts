import { APICallError, NoObjectGeneratedError, RetryError } from "ai";

import {
  PEOPLE_CLASSIFICATION_FAILED_ERROR_CODE,
  PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
  PEOPLE_CLASSIFICATION_PROVIDER_ERROR_CODE,
  PEOPLE_CLASSIFICATION_TIMEOUT_ERROR_CODE,
  type PeopleClassificationFailureCode,
} from "./constants";

export interface PeopleClassificationFailure {
  errorCode: PeopleClassificationFailureCode;
  errorMessage: string;
}

export function getPeopleClassificationFailure(
  error: unknown
): PeopleClassificationFailure {
  const message = getErrorMessage(error);

  if (isTimeoutError(error)) {
    return {
      errorCode: PEOPLE_CLASSIFICATION_TIMEOUT_ERROR_CODE,
      errorMessage: message,
    };
  }

  if (isInvalidOutputError(error)) {
    return {
      errorCode: PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
      errorMessage: message,
    };
  }

  if (isProviderError(error)) {
    return {
      errorCode: PEOPLE_CLASSIFICATION_PROVIDER_ERROR_CODE,
      errorMessage: message,
    };
  }

  return {
    errorCode: PEOPLE_CLASSIFICATION_FAILED_ERROR_CODE,
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

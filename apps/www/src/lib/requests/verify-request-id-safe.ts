import { ResultAsync } from "neverthrow";

import type { RequestContext } from "@vendor/security/requests/create-secure-request-id";
import { SecureRequestId } from "@vendor/security/requests/create-secure-request-id";

// Error classes
export class SecureRequestIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecureRequestIdError";
  }
}

export class SecureRequestIdMissingError extends SecureRequestIdError {
  constructor(message: string = "Request ID is missing") {
    super(message);
    this.name = "SecureRequestIdMissingError";
  }
}

export class SecureRequestIdInvalidError extends SecureRequestIdError {
  constructor(
    public requestId: string,
    message: string = "Request ID is invalid",
  ) {
    super(message);
    this.name = "SecureRequestIdInvalidError";
  }
}

export class UnknownError extends Error {
  constructor(message: string = "An unknown error occurred") {
    super(message);
    this.name = "UnknownError";
  }
}

// Union type of all possible SecureRequestId errors
export type SecureRequestIdVerificationError =
  | SecureRequestIdMissingError
  | SecureRequestIdInvalidError;

export const verifyRequestIdSafe = ({
  requestId,
  context,
}: {
  requestId: string | null;
  context: RequestContext;
}) =>
  ResultAsync.fromPromise(
    (async () => {
      if (!requestId) {
        throw new SecureRequestIdMissingError();
      }

      const isValid = await SecureRequestId.verify(requestId, context);
      if (!isValid) {
        throw new SecureRequestIdInvalidError(requestId);
      }

      return requestId;
    })(),
    (error): SecureRequestIdVerificationError => {
      // If it's already one of our error types, return it
      if (
        error instanceof SecureRequestIdMissingError ||
        error instanceof SecureRequestIdInvalidError
      ) {
        return error;
      }
      // Otherwise wrap in InvalidError
      return new UnknownError(
        error instanceof Error ? error.message : "Failed to verify request ID",
      );
    },
  );

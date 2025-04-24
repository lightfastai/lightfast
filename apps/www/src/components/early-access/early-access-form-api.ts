import { ResultAsync } from "neverthrow";

import { REQUEST_ID_HEADER } from "@vendor/security/requests/constants";

import type { NextErrorResponse } from "./errors";
import { EarlyAccessErrorType, EarlyAccessFormErrorMap } from "./errors";

// Base error class
export class EarlyAccessError extends Error {
  constructor(
    message: string,
    public type: EarlyAccessErrorType,
    public error: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = "EarlyAccessError";
  }
}

// Success response type
export interface EarlyAccessResponse {
  success: boolean;
  requestId: string;
}

interface CreateEarlyAccessParams {
  email: string;
}

const createEarlyAccessUnsafe = async ({
  email,
}: CreateEarlyAccessParams): Promise<EarlyAccessResponse> => {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  const response = await fetch("/api/early-access/create", {
    method: "POST",
    headers,
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as NextErrorResponse;
    const responseRequestId = response.headers.get(REQUEST_ID_HEADER);

    throw new EarlyAccessError(
      errorData.message,
      errorData.type,
      errorData.error,
      responseRequestId ?? undefined, // @todo should handle the case where the request ID is not present
    );
  }

  const requestId = response.headers.get(REQUEST_ID_HEADER);
  if (!requestId) {
    throw new EarlyAccessError(
      EarlyAccessFormErrorMap[EarlyAccessErrorType.NO_REQUEST_ID],
      EarlyAccessErrorType.NO_REQUEST_ID,
      "No request ID found in response",
    );
  }

  return {
    success: true,
    requestId,
  };
};

export const createEarlyAccessSafe = (params: CreateEarlyAccessParams) =>
  ResultAsync.fromPromise(
    createEarlyAccessUnsafe(params),
    (error): EarlyAccessError => {
      if (error instanceof EarlyAccessError) {
        return error;
      }
      return new EarlyAccessError(
        "An unexpected error occurred",
        EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : "Unknown error",
      );
    },
  );

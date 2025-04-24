import { ResultAsync } from "neverthrow";

import {
  addRequestIdToHeaders,
  updateRequestIdFromResponse,
} from "@vendor/security/requests/client";

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

  // Add request ID to headers if we have one
  addRequestIdToHeaders(headers);

  const response = await fetch("/api/early-access/create", {
    method: "POST",
    headers,
    body: JSON.stringify({ email }),
  });

  // Update stored request ID from response
  const responseRequestId = updateRequestIdFromResponse(response);

  if (!response.ok) {
    const errorData = (await response.json()) as NextErrorResponse;
    throw new EarlyAccessError(
      errorData.message,
      errorData.type,
      errorData.error,
      responseRequestId,
    );
  }

  if (!responseRequestId) {
    throw new EarlyAccessError(
      EarlyAccessFormErrorMap[EarlyAccessErrorType.NO_REQUEST_ID],
      EarlyAccessErrorType.NO_REQUEST_ID,
      "No request ID found in response",
    );
  }

  return {
    success: true,
    requestId: responseRequestId,
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

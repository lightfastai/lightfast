import { ResultAsync } from "neverthrow";

import type { NextErrorResponse } from "../errors";
import { REQUEST_ID_HEADER } from "~/lib/requests/request-id";
import { EarlyAccessErrorType, EarlyAccessFormErrorMap } from "../errors";

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

const createEarlyAccessEntryUnsafe = async ({
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

  // Update stored request ID from response
  const responseRequestId = response.headers.get(REQUEST_ID_HEADER);

  if (!response.ok) {
    const errorData = (await response.json()) as NextErrorResponse;
    if (!responseRequestId) {
      throw new EarlyAccessError(
        EarlyAccessFormErrorMap[EarlyAccessErrorType.NO_REQUEST_ID],
        EarlyAccessErrorType.NO_REQUEST_ID,
        "No request ID found in response",
      );
    }

    throw new EarlyAccessError(
      errorData.message,
      errorData.type,
      errorData.error,
      responseRequestId,
    );
  }

  return {
    success: true,
    requestId: responseRequestId ?? "",
  };
};

export const createEarlyAccessEntrySafe = (params: CreateEarlyAccessParams) =>
  ResultAsync.fromPromise(
    createEarlyAccessEntryUnsafe(params),
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

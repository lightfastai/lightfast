import { ResultAsync } from "neverthrow";

import type { NextErrorResponse } from "./errors";
import { extractRequestContext, withRequestId } from "~/lib/next-request-id";
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
  requestId: string;
}

const createEarlyAccessUnsafe = async ({
  email,
  requestId,
}: CreateEarlyAccessParams): Promise<EarlyAccessResponse> => {
  const headers = new Headers(
    withRequestId(requestId, {
      "Content-Type": "application/json",
    }),
  );

  const response = await fetch("/api/early-access/create", {
    method: "POST",
    headers,
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as NextErrorResponse;
    const responseRequestId = extractRequestContext(
      response.headers,
    )?.requestId;
    if (!responseRequestId) {
      console.error("No request ID found in response", {
        responseRequestId,
        errorData,
      });
      throw new EarlyAccessError(
        EarlyAccessFormErrorMap[EarlyAccessErrorType.NO_REQUEST_ID],
        EarlyAccessErrorType.NO_REQUEST_ID,
        "No request ID found in response",
        requestId,
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
    requestId: response.headers.get("X-Request-Id") ?? requestId,
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
        params.requestId,
      );
    },
  );

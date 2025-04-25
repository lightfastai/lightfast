import { ResultAsync } from "neverthrow";

import { log } from "@vendor/observability/log";

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

  if (!responseRequestId) {
    log.error("No request ID found in response", {
      response,
    });
    throw new EarlyAccessError(
      EarlyAccessFormErrorMap[EarlyAccessErrorType.NO_REQUEST_ID],
      EarlyAccessErrorType.NO_REQUEST_ID,
      "No request ID found in response",
    );
  }

  if (!response.ok) {
    log.error("Early access error", {
      response,
    });
    let errorData: Partial<NextErrorResponse> = {};
    try {
      errorData = (await response.json()) as Partial<NextErrorResponse>;
    } catch {
      throw new EarlyAccessError(
        "Failed to parse early access error payload",
        EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        "Failed to parse early access error payload",
        responseRequestId,
      );
    }

    // If no errors array or it's empty, throw a generic error
    if (!errorData.error) {
      log.error("Unknown error from early access API", {
        response,
        errorData,
      });

      throw new EarlyAccessError(
        "Unknown error from early access API",
        EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        "Unknown error from early access API",
        responseRequestId,
      );
    }

    const error = errorData.error;
    const type = errorData.type ?? EarlyAccessErrorType.INTERNAL_SERVER_ERROR;
    const message = errorData.message ?? "An unexpected error occurred";

    throw new EarlyAccessError(message, type, error, responseRequestId);
  }

  return {
    success: true,
    requestId: responseRequestId,
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

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { REQUEST_ID_HEADER } from "@vendor/security/requests/constants";

import type { NextErrorResponse } from "~/components/early-access/errors";
import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import {
  ArcjetEmailError,
  ArcjetRateLimitError,
  ArcjetSecurityError,
  protectSignupSafe,
} from "~/components/early-access/aj";
import { EarlyAccessErrorType } from "~/components/early-access/errors";
import { reportApiError } from "~/lib/error-reporting/api-error-reporter";
import {
  InvalidJsonError,
  jsonParseSafe,
} from "~/lib/requests/json-parse-safe";

export const runtime = "edge";

interface CreateEarlyAccessJoinRequest {
  email: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the validated request ID from middleware
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const requestId = request.headers.get(REQUEST_ID_HEADER)!;

    const res = await jsonParseSafe<CreateEarlyAccessJoinRequest>(request);

    if (res.isErr()) {
      console.error("Safe JSON parse error:", {
        requestId,
        type: res.error.name,
        message: res.error.message,
      });

      await reportApiError(res.error, {
        route: "/api/early-access/create",
        errorType: EarlyAccessErrorType.BAD_REQUEST,
        requestId,
        error: "Invalid JSON",
        message: res.error.message,
      });

      if (res.error instanceof InvalidJsonError) {
        return NextResponse.json<NextErrorResponse>(
          {
            type: EarlyAccessErrorType.BAD_REQUEST,
            error: "Invalid JSON",
            message: res.error.message,
          },
          {
            status: 400,
            headers: { [REQUEST_ID_HEADER]: requestId },
          },
        );
      }
      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
          error: "An unexpected error occurred.",
          message: "Unknown error",
        },
        {
          status: 500,
          headers: { [REQUEST_ID_HEADER]: requestId },
        },
      );
    }

    const { email } = res.value;

    const protectionResult = await protectSignupSafe({ request, email });

    if (protectionResult.isErr()) {
      const error = protectionResult.error;
      console.error("Arcjet protection error:", {
        requestId,
        type: error.name,
        message: error.message,
        originalError: error.originalError,
      });

      await reportApiError(error, {
        route: "/api/early-access/create",
        errorType:
          error.originalError instanceof ArcjetEmailError
            ? EarlyAccessErrorType.INVALID_EMAIL
            : error.originalError instanceof ArcjetRateLimitError
              ? EarlyAccessErrorType.RATE_LIMIT
              : error.originalError instanceof ArcjetSecurityError
                ? EarlyAccessErrorType.SECURITY_CHECK
                : EarlyAccessErrorType.SERVICE_UNAVAILABLE,
        requestId,
        error: error.name,
        message: error.message,
        metadata: {
          originalError: error.originalError,
        },
      });

      // Map to domain-specific errors
      if (error.originalError instanceof ArcjetEmailError) {
        return NextResponse.json<NextErrorResponse>(
          {
            type: EarlyAccessErrorType.INVALID_EMAIL,
            error: "Invalid email",
            message: error.message,
          },
          {
            status: 400,
            headers: { [REQUEST_ID_HEADER]: requestId },
          },
        );
      }

      if (error.originalError instanceof ArcjetRateLimitError) {
        const retryAfter = error.originalError.retryAfter;
        return NextResponse.json<NextErrorResponse>(
          {
            type: EarlyAccessErrorType.RATE_LIMIT,
            error: "Too many attempts",
            message: error.message,
          },
          {
            status: 429,
            headers: {
              [REQUEST_ID_HEADER]: requestId,
              "Retry-After": retryAfter,
            },
          },
        );
      }

      if (error.originalError instanceof ArcjetSecurityError) {
        return NextResponse.json<NextErrorResponse>(
          {
            type: EarlyAccessErrorType.SECURITY_CHECK,
            error: "Security check failed",
            message: error.message,
          },
          {
            status: 403,
            headers: { [REQUEST_ID_HEADER]: requestId },
          },
        );
      }

      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.SERVICE_UNAVAILABLE,
          error: "Service unavailable",
          message:
            "We're having trouble processing requests right now. Please try again later.",
        },
        {
          status: 503,
          headers: { [REQUEST_ID_HEADER]: requestId },
        },
      );
    }

    await inngest.send({
      name: "early-access/join",
      data: {
        email,
        requestId,
      },
    });

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: { [REQUEST_ID_HEADER]: requestId },
      },
    );
  } catch (error) {
    // For unexpected errors, generate a new request ID
    const newRequestId = request.headers.get(REQUEST_ID_HEADER);
    console.error("Unexpected error in early access signup:", {
      requestId: newRequestId,
      error,
    });

    await reportApiError(
      error instanceof Error ? error : new Error("Unknown error"),
      {
        route: "/api/early-access/create",
        errorType: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        requestId: newRequestId ?? "unknown",
        error: "An unexpected error occurred",
        message: "Please try again later",
      },
    );

    return NextResponse.json<NextErrorResponse>(
      {
        type: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        error: "An unexpected error occurred",
        message: "Please try again later",
      },
      {
        status: 500,
        headers: { [REQUEST_ID_HEADER]: newRequestId ?? "unknown" },
      },
    );
  }
}

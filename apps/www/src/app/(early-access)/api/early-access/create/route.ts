import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { REQUEST_ID_HEADER } from "@vendor/security/requests/constants";
import { SecureRequestId } from "@vendor/security/requests/create-secure-request-id";

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
import {
  SecureRequestIdInvalidError,
  SecureRequestIdMissingError,
  verifyRequestIdSafe,
} from "~/lib/requests/verify-request-id-safe";

export const runtime = "edge";

interface CreateEarlyAccessJoinRequest {
  email: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestContext = {
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };

  try {
    const requestId = request.headers.get(REQUEST_ID_HEADER);
    const verificationResult = await verifyRequestIdSafe({
      requestId,
      context: requestContext,
    });

    if (verificationResult.isErr()) {
      const error = verificationResult.error;
      console.error("Request ID verification error:", {
        type: error.name,
        message: error.message,
      });

      if (error instanceof SecureRequestIdMissingError) {
        const newRequestId = await SecureRequestId.generate(requestContext);
        await reportApiError(error, {
          route: "/api/early-access/create",
          errorType: EarlyAccessErrorType.NO_REQUEST_ID,
          requestId: newRequestId,
          error: "Invalid request ID",
          message: error.message,
        });

        return NextResponse.json<NextErrorResponse>(
          {
            type: EarlyAccessErrorType.NO_REQUEST_ID,
            error: "Invalid request ID",
            message: error.message,
          },
          {
            status: 400,
            headers: {
              [REQUEST_ID_HEADER]: newRequestId,
            },
          },
        );
      }

      if (error instanceof SecureRequestIdInvalidError) {
        await reportApiError(error, {
          route: "/api/early-access/create",
          errorType: EarlyAccessErrorType.INVALID_REQUEST_ID,
          requestId: error.requestId,
          error: "Invalid request ID",
          message: error.message,
        });

        return NextResponse.json<NextErrorResponse>(
          {
            type: EarlyAccessErrorType.INVALID_REQUEST_ID,
            error: "Invalid request ID",
            message: error.message,
          },
          {
            status: 400,
            headers: { [REQUEST_ID_HEADER]: error.requestId },
          },
        );
      }

      await reportApiError(error, {
        route: "/api/early-access/create",
        errorType: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        requestId:
          requestId ?? (await SecureRequestId.generate(requestContext)),
        error: "An unexpected error occurred.",
        message: "Unknown error",
      });

      return NextResponse.json<NextErrorResponse>({
        type: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        error: "An unexpected error occurred.",
        message: "Unknown error",
      });
    }

    const verifiedRequestId = verificationResult.value;
    const res = await jsonParseSafe<CreateEarlyAccessJoinRequest>(request);

    if (res.isErr()) {
      console.error("Safe JSON parse error:", {
        requestId: verifiedRequestId,
        type: res.error.name,
        message: res.error.message,
      });

      await reportApiError(res.error, {
        route: "/api/early-access/create",
        errorType: EarlyAccessErrorType.BAD_REQUEST,
        requestId: verifiedRequestId,
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
            headers: { [REQUEST_ID_HEADER]: verifiedRequestId },
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
          headers: { [REQUEST_ID_HEADER]: verifiedRequestId },
        },
      );
    }

    const { email } = res.value;

    const protectionResult = await protectSignupSafe({ request, email });

    if (protectionResult.isErr()) {
      const error = protectionResult.error;
      console.error("Arcjet protection error:", {
        requestId: verifiedRequestId,
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
        requestId: verifiedRequestId,
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
            headers: { [REQUEST_ID_HEADER]: verifiedRequestId },
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
              [REQUEST_ID_HEADER]: verifiedRequestId,
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
            headers: { [REQUEST_ID_HEADER]: verifiedRequestId },
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
          headers: { [REQUEST_ID_HEADER]: verifiedRequestId },
        },
      );
    }

    await inngest.send({
      name: "early-access/join",
      data: {
        email,
        requestId: verifiedRequestId,
      },
    });

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: { [REQUEST_ID_HEADER]: verifiedRequestId },
      },
    );
  } catch (error) {
    // For unexpected errors, generate a new request ID
    const newRequestId = await SecureRequestId.generate(requestContext);
    console.error("Unexpected error in early access signup:", {
      requestId: newRequestId,
      error,
    });

    await reportApiError(
      error instanceof Error ? error : new Error("Unknown error"),
      {
        route: "/api/early-access/create",
        errorType: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        requestId: newRequestId,
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
        headers: { [REQUEST_ID_HEADER]: newRequestId },
      },
    );
  }
}

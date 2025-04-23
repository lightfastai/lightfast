import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { NextErrorResponse } from "~/components/early-access/errors";
import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import {
  ArcjetEmailError,
  ArcjetRateLimitError,
  ArcjetSecurityError,
  protectSignupSafe,
} from "~/components/early-access/aj";
import { EarlyAccessErrorType } from "~/components/early-access/errors";
import {
  createRequestContext,
  extractRequestContext,
  withRequestId,
} from "~/lib/next-request-id";
import { InvalidJsonError, safeJsonParse } from "~/lib/next-request-json-parse";

export const runtime = "edge";

interface CreateEarlyAccessJoinRequest {
  email: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const requestContext = extractRequestContext(request.headers);

    // If no valid request ID provided, return 400
    if (!requestContext) {
      // Create a new context just for the error response
      const errorContext = createRequestContext();
      console.error("Missing or invalid request ID in headers");

      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.BAD_REQUEST,
          error: "Missing request ID",
          message: "X-Lightfast-Request-Id header is required",
        },
        {
          status: 400,
          headers: withRequestId(errorContext.requestId),
        },
      );
    }

    const res = await safeJsonParse<CreateEarlyAccessJoinRequest>(request);

    if (res.isErr()) {
      console.error("Safe JSON parse error:", {
        requestId: requestContext.requestId,
        type: res.error.name,
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
            headers: withRequestId(requestContext.requestId),
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
          headers: withRequestId(requestContext.requestId),
        },
      );
    }

    const { email } = res.value;

    const protectionResult = await protectSignupSafe({ request, email });

    if (protectionResult.isErr()) {
      const error = protectionResult.error;
      console.error("Arcjet protection error:", {
        requestId: requestContext.requestId,
        type: error.name,
        message: error.message,
        originalError: error.originalError,
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
            headers: withRequestId(requestContext.requestId),
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
              ...withRequestId(requestContext.requestId),
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
            headers: withRequestId(requestContext.requestId),
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
          headers: withRequestId(requestContext.requestId),
        },
      );
    }

    await inngest.send({
      name: "early-access/join",
      data: {
        email,
        requestId: requestContext.requestId,
      },
    });

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: withRequestId(requestContext.requestId),
      },
    );
  } catch (error) {
    // For unexpected errors, create a new request ID for the error response
    const errorContext = createRequestContext();
    console.error("Unexpected error in early access signup:", {
      requestId: errorContext.requestId,
      error,
    });

    return NextResponse.json<NextErrorResponse>(
      {
        type: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        error: "An unexpected error occurred",
        message: "Please try again later",
      },
      {
        status: 500,
        headers: withRequestId(errorContext.requestId),
      },
    );
  }
}

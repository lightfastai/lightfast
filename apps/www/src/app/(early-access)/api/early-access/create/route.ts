import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { NextErrorResponse } from "~/components/early-access/errors";
import {
  ArcjetEmailError,
  ArcjetRateLimitError,
  ArcjetSecurityError,
  protectSignupSafe,
} from "~/components/early-access/aj";
import { EarlyAccessErrorType } from "~/components/early-access/errors";
import { InvalidJsonError, safeJsonParse } from "~/lib/next-request-json-parse";

export const runtime = "edge";

interface CreateEarlyAccessJoinRequest {
  email: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const res = await safeJsonParse<CreateEarlyAccessJoinRequest>(request);

  if (res.isErr()) {
    console.error("Safe JSON parse error:", {
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
        { status: 400 },
      );
    }
    return NextResponse.json<NextErrorResponse>(
      {
        type: EarlyAccessErrorType.INTERNAL_SERVER_ERROR,
        error: "An unexpected error occurred.",
        message: "Unknown error",
      },
      { status: 500 },
    );
  }

  const { email } = res.value;

  const protectionResult = await protectSignupSafe({ request, email });

  if (protectionResult.isErr()) {
    const error = protectionResult.error;
    console.error("Arcjet protection error:", {
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
        { status: 400 },
      );
    }

    if (error.originalError instanceof ArcjetRateLimitError) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.RATE_LIMIT,
          error: "Too many attempts",
          message: error.message,
        },
        { status: 429 },
      );
    }

    if (error.originalError instanceof ArcjetSecurityError) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.SECURITY_CHECK,
          error: "Security check failed",
          message: error.message,
        },
        { status: 403 },
      );
    }

    return NextResponse.json<NextErrorResponse>(
      {
        type: EarlyAccessErrorType.SERVICE_UNAVAILABLE,
        error: "Service unavailable",
        message:
          "We're having trouble processing requests right now. Please try again later.",
      },
      { status: 503 },
    );
  }

  // await inngest.send({
  //   name: "early-access/join",
  //   data: { email },
  // });

  return NextResponse.json({ success: true }, { status: 200 });
}

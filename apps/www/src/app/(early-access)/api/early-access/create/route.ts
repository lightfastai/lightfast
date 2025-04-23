import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { NextErrorResponse } from "~/components/early-access/errors";
import {
  ArcjetEmailError,
  ArcjetRateLimitError,
  ArcjetSecurityError,
  protectSignupSafe,
} from "~/components/early-access/aj";
import {
  ClerkAuthenticationError,
  ClerkError,
  ClerkRateLimitError,
  ClerkSecurityError,
  ClerkValidationError,
  createWaitlistEntrySafe,
  UnknownError,
} from "~/components/early-access/clerk";
import { EarlyAccessErrorType } from "~/components/early-access/errors";
import { InvalidJsonError, safeJsonParse } from "~/lib/next-request-json-parse";

export const runtime = "edge";

interface CreateEarlyAccessJoinRequest {
  email: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const res = await safeJsonParse<CreateEarlyAccessJoinRequest>(request);

  if (res.isErr()) {
    if (res.error instanceof InvalidJsonError) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: InvalidJsonError.name,
          error: "Invalid JSON",
          message: res.error.message,
        },
        { status: 400 },
      );
    }
    console.error("Unknown error", res.error);
    return NextResponse.json<NextErrorResponse>(
      {
        type: UnknownError.name,
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

  const result = await createWaitlistEntrySafe({ email });

  if (result.isErr()) {
    const error = result.error;

    // Log the original error for monitoring
    console.error("Clerk waitlist error:", {
      type: error.name,
      message: error.message,
      email, // Log email for debugging but ensure it's properly redacted in prod
    });

    // Map Clerk errors to domain-specific errors
    if (error instanceof ClerkRateLimitError) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.RATE_LIMIT,
          error: "Too many attempts",
          message:
            "We're having trouble processing requests right now. Please try again in a few minutes.",
        },
        { status: 429 },
      );
    }

    if (error instanceof ClerkValidationError) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.INVALID_EMAIL,
          error: "Invalid email",
          message: "Please provide a valid email address.",
        },
        { status: 400 },
      );
    }

    // Map security-related errors to a generic security message
    if (
      error instanceof ClerkAuthenticationError ||
      error instanceof ClerkSecurityError
    ) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.SECURITY_CHECK,
          error: "Security check failed",
          message:
            "We couldn't process your request. Please try again in a few minutes.",
        },
        { status: 403 },
      );
    }

    // Special handling for email already registered
    if (
      error instanceof ClerkError &&
      error.message.toLowerCase().includes("already exists")
    ) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: EarlyAccessErrorType.ALREADY_REGISTERED,
          error: "Email already registered",
          message: "This email is already registered for early access.",
        },
        { status: 409 },
      );
    }

    // All other errors map to service unavailable
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

  return NextResponse.json(
    { success: true, entry: result.value },
    { status: 200 },
  );
}

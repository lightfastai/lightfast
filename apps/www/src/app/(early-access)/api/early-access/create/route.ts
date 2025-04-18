import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { err, ok } from "neverthrow";

import { arcjet, protectSignup } from "@vendor/security";

import type { NextErrorResponse } from "~/lib/errors";
import { env } from "~/env";
import {
  createWaitlistEntrySafe,
  UnknownError,
  WaitlistError,
} from "~/lib/clerk/clerk-create-waitlist-entry";
import {
  ArcjetEmailError,
  ArcjetRateLimitError,
  ArcjetSecurityError,
} from "~/lib/errors";
import { InvalidJsonError, safeJsonParse } from "~/lib/next-request-parse";

export const runtime = "edge";

const aj = arcjet({
  key: env.ARCJET_KEY, // Get your site key from https://app.arcjet.com
  rules: [
    protectSignup({
      email: {
        mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
        // Block emails that are disposable, invalid, or have no MX records
        block: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
      },
      bots: {
        mode: "LIVE",
        // configured with a list of bots to allow from
        // https://arcjet.com/bot-list
        allow: [], // "allow none" will block all detected bots
      },
      // It would be unusual for a form to be submitted more than 5 times in 10
      // minutes from the same IP address
      rateLimit: {
        // uses a sliding window rate limit
        mode: "LIVE",
        interval: "10m", // counts requests over a 10 minute sliding window
        max: 20, // allows 5 submissions within the window
      },
    }),
  ],
});

const safeAjProtect = async (request: NextRequest, email: string) => {
  try {
    const decision = await aj.protect(request, { email });
    return ok(decision);
  } catch (error) {
    console.error("Arcjet protection error:", error);
    return err(
      error instanceof Error ? error : new UnknownError("Unknown error"),
    );
  }
};

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

  const decisionResult = await safeAjProtect(request, email);
  if (decisionResult.isErr()) {
    console.error("Arcjet protection error:", decisionResult.error);
    return NextResponse.json<NextErrorResponse>(
      {
        type: UnknownError.name,
        error: "Arcjet protection error",
        message: decisionResult.error.message,
      },
      { status: 500 },
    );
  }

  const decision = decisionResult.value;

  if (decision.isDenied()) {
    if (decision.reason.isEmail()) {
      console.error("Invalid email address provided.", decision.reason);
      return NextResponse.json<NextErrorResponse>(
        {
          type: ArcjetEmailError.name,
          error: "Invalid email address provided.",
          message:
            "You have provided an invalid email address. Please try again.",
        },
        { status: 400 },
      );
    }

    if (decision.reason.isRateLimit()) {
      console.error("Rate limit exceeded.", decision.reason);
      return NextResponse.json<NextErrorResponse>(
        {
          type: ArcjetRateLimitError.name,
          error: "Rate limit exceeded. Please try again in 10 minutes.",
          message:
            "You have exceeded the rate limit. Please try again in 10 minutes.",
        },
        { status: 429 },
      );
    }

    console.error("Security check failed.", decision.reason);
    return NextResponse.json<NextErrorResponse>(
      {
        type: ArcjetSecurityError.name,
        error: "Security check failed. Are you a bot?",
        message:
          "You have been blocked from joining the waitlist. Please try again later.",
      },
      { status: 403 },
    );
  }

  const result = await createWaitlistEntrySafe({ email })();

  if (result.isErr()) {
    if (result.error instanceof WaitlistError) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: WaitlistError.name,
          error: "Failed to add email to the waitlist.",
          message: result.error.message,
        },
        { status: 400 },
      );
    }

    if (result.error instanceof UnknownError) {
      return NextResponse.json<NextErrorResponse>(
        {
          type: UnknownError.name,
          error: "An unexpected error occurred.",
          message: result.error.message,
        },
        { status: 500 },
      );
    }

    console.error("Unknown error", result.error);
    return NextResponse.json<NextErrorResponse>(
      {
        type: UnknownError.name,
        error: "An unexpected error occurred.",
        message: "Unknown error",
      },
      { status: 500 },
    );
  }

  // @todo fix value.value....
  return NextResponse.json(
    { success: true, entry: result.value.value },
    { status: 200 },
  );
}

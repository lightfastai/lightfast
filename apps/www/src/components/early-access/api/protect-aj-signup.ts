import type { NextRequest } from "next/server";
import { ResultAsync } from "neverthrow";

import { arcjet, protectSignup, setRateLimitHeaders } from "@vendor/security";

import { env } from "~/env";

// Initialize Arcjet with configuration
const aj = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    protectSignup({
      email: {
        mode: "LIVE",
        block: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
      },
      bots: {
        mode: "LIVE",
        allow: [],
      },
      rateLimit: {
        mode: "LIVE",
        interval: "10m",
        max: 20,
      },
    }),
  ],
});

export class ArcjetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArcjetError";
  }
}

export class ArcjetEmailError extends ArcjetError {
  constructor(message = "Invalid email address provided.") {
    super(message);
    this.name = "ArcjetEmailError";
  }
}

export class ArcjetRateLimitError extends ArcjetError {
  constructor(
    message = "Rate limit exceeded. Please try again in 10 minutes.",
    public retryAfter: string,
  ) {
    super(message);
    this.name = "ArcjetRateLimitError";
  }
}

export class ArcjetSecurityError extends ArcjetError {
  constructor(message = "Security check failed. Are you a bot?") {
    super(message);
    this.name = "ArcjetSecurityError";
  }
}

export class ArcjetProtectionError extends Error {
  constructor(
    message: string,
    public readonly originalError: ArcjetError | Error,
  ) {
    super(message);
    this.name = "ArcjetProtectionError";
  }
}

export type ArcjetErrorType =
  | ArcjetEmailError
  | ArcjetRateLimitError
  | ArcjetSecurityError
  | ArcjetProtectionError;

interface ProtectSignupParams {
  request: NextRequest;
  email: string;
}

const protectSignupUnsafe = async ({ request, email }: ProtectSignupParams) => {
  const decision = await aj.protect(request, { email });

  if (decision.isDenied()) {
    const reason = decision.reason;

    if (reason.isEmail()) {
      throw new ArcjetEmailError(
        "You have provided an invalid email address. Please try again.",
      );
    }

    if (reason.isRateLimit()) {
      // Create headers to store rate limit information
      const headers = new Headers();
      setRateLimitHeaders(headers, decision);
      const retryAfter = headers.get("retry-after");
      throw new ArcjetRateLimitError(
        "You have exceeded the rate limit. Please try again later.",
        retryAfter ?? "10m",
      );
    }

    throw new ArcjetSecurityError(
      "You have been blocked from joining the waitlist. Please try again later.",
    );
  }

  return decision;
};

export const protectSignupSafe = ({ request, email }: ProtectSignupParams) =>
  ResultAsync.fromPromise(
    protectSignupUnsafe({ request, email }),
    (error): ArcjetProtectionError => {
      // If it's already one of our error types, wrap it
      if (
        error instanceof ArcjetEmailError ||
        error instanceof ArcjetRateLimitError ||
        error instanceof ArcjetSecurityError
      ) {
        return new ArcjetProtectionError(error.message, error);
      }

      // Otherwise wrap in ArcjetProtectionError with a generic message
      return new ArcjetProtectionError(
        "Failed to process signup protection",
        error instanceof Error ? error : new Error("Unknown error"),
      );
    },
  );

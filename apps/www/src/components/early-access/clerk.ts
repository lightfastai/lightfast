import { ResultAsync } from "neverthrow";

import type { ClerkWaitlistEntry } from "./clerk/types";
import { env } from "~/env";

const CLERK_API_URL = "https://api.clerk.com/v1";

// Error classes
export class ClerkError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ClerkError";
  }
}

export class ClerkRateLimitError extends ClerkError {
  constructor(
    message: string,
    public retryAfter?: string,
  ) {
    super(message);
    this.name = "ClerkRateLimitError";
  }
}

export class ClerkValidationError extends ClerkError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ClerkValidationError";
  }
}

export class ClerkAuthenticationError extends ClerkError {
  constructor(message: string) {
    super(message, 401);
    this.name = "ClerkAuthenticationError";
  }
}

export class ClerkSecurityError extends ClerkError {
  constructor(message: string) {
    super(message, 451);
    this.name = "ClerkSecurityError";
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

// Union type of all possible Clerk errors
export type ClerkWaitlistError =
  | ClerkRateLimitError
  | ClerkValidationError
  | ClerkAuthenticationError
  | ClerkSecurityError
  | ClerkError
  | UnknownError;

interface ClerkAPIError {
  code: string;
  message: string;
  long_message: string;
  meta?: {
    lockout_expires_in_seconds?: number;
  };
}

interface ClerkErrorResponse {
  errors: ClerkAPIError[];
}

const createWaitlistEntryUnsafe = async ({
  email,
}: {
  email: string;
}): Promise<ClerkWaitlistEntry> => {
  const response = await fetch(`${CLERK_API_URL}/waitlist_entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
    },
    // @IMPORTANT notify is false to avoid clerk sending email to user. we also set this directly in clerk.
    body: JSON.stringify({ email_address: email, notify: false }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as ClerkErrorResponse;

    // If no errors array or it's empty, throw a generic error
    if (!errorData.errors.length) {
      throw new ClerkError("Unknown error from Clerk API", response.status);
    }

    // At this point we know we have at least one error
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const error = errorData.errors[0]!;
    const long_message = error.long_message;
    const statusCode = response.status;

    // Handle specific error types based on status code and message
    switch (statusCode) {
      case 422: {
        throw new ClerkValidationError(long_message);
      }
      case 429: {
        const retryAfter = response.headers.get("retry-after");
        throw new ClerkRateLimitError(
          long_message,
          retryAfter ? `${retryAfter}s` : "15m",
        );
      }
      case 401:
        throw new ClerkAuthenticationError(long_message);
      case 451:
        throw new ClerkSecurityError(long_message);
      case 403: {
        // Special handling for user locked case
        if (error.code === "user_locked") {
          const retryAfter = error.meta?.lockout_expires_in_seconds
            ? `${error.meta.lockout_expires_in_seconds}s`
            : "15m";
          throw new ClerkRateLimitError(long_message, retryAfter);
        }
        throw new ClerkSecurityError(long_message);
      }
      default:
        throw new ClerkError(long_message, statusCode);
    }
  }

  const data = (await response.json()) as ClerkWaitlistEntry;
  return data;
};

export const createWaitlistEntrySafe = ({ email }: { email: string }) =>
  ResultAsync.fromPromise(
    createWaitlistEntryUnsafe({ email }),
    (error): ClerkWaitlistError => {
      // If it's already one of our error types, return it
      if (
        error instanceof ClerkRateLimitError ||
        error instanceof ClerkValidationError ||
        error instanceof ClerkAuthenticationError ||
        error instanceof ClerkSecurityError ||
        error instanceof ClerkError
      ) {
        return error;
      }
      // Otherwise wrap in UnknownError
      return new UnknownError(
        error instanceof Error
          ? error.message
          : "Unknown error while creating waitlist entry",
      );
    },
  );

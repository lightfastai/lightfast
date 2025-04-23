import { ResultAsync } from "neverthrow";

import type { ClerkWaitlistError } from "./create-waitlist-entry-errors";
import type { ClerkWaitlistEntry } from "./types";
import { env } from "~/env";
import {
  ClerkAuthenticationError,
  ClerkError,
  ClerkRateLimitError,
  ClerkSecurityError,
  ClerkValidationError,
  UnknownError,
} from "./create-waitlist-entry-errors";

const CLERK_API_URL = "https://api.clerk.com/v1";

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
    body: JSON.stringify({ email_address: email }),
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
      case 429: {
        const retryAfter = response.headers.get("retry-after");
        throw new ClerkRateLimitError(
          long_message,
          retryAfter ? `${retryAfter}s` : "15m",
        );
      }
      case 400:
        throw new ClerkValidationError(long_message);
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

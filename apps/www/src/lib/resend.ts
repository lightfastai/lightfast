import type { JSX } from "react";
import { ResultAsync } from "neverthrow";

import { createEmailClient } from "@vendor/email";

import { emailConfig } from "~/config/email";
import { env } from "~/env";

export const mail = createEmailClient(env.RESEND_API_KEY);

// Types for Resend error response
interface ResendErrorResponse {
  statusCode: number;
  name: string;
  message: string;
  headers?: {
    "retry-after"?: string;
  };
}

export class ResendError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ResendError";
  }
}

export class ResendRateLimitError extends ResendError {
  constructor(
    message: string,
    public retryAfter?: string,
  ) {
    super(message);
    this.name = "ResendRateLimitError";
  }
}

export class ResendDailyQuotaError extends ResendError {
  constructor(message: string) {
    super(message);
    this.name = "ResendDailyQuotaError";
  }
}

export class ResendValidationError extends ResendError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ResendValidationError";
  }
}

export class ResendAuthenticationError extends ResendError {
  constructor(message: string) {
    super(message, 401);
    this.name = "ResendAuthenticationError";
  }
}

export class ResendSecurityError extends ResendError {
  constructor(message: string) {
    super(message, 451);
    this.name = "ResendSecurityError";
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

// Union type of all possible Resend errors
export type ResendEmailError =
  | ResendRateLimitError
  | ResendDailyQuotaError
  | ResendValidationError
  | ResendAuthenticationError
  | ResendSecurityError
  | ResendError
  | UnknownError;

const sendResendEmailUnsafe = async ({
  react,
  to,
  subject,
}: {
  react: JSX.Element;
  to: string;
  subject: string;
}) => {
  const response = await mail.emails.send({
    from: emailConfig.support,
    to,
    subject,
    react,
  });

  if (response.error) {
    const error = response.error as ResendErrorResponse;
    const { statusCode, message } = error;

    // Handle specific error types based on status code and message
    switch (statusCode) {
      case 429: {
        // Check if it's a daily quota error
        if (message.toLowerCase().includes("daily quota")) {
          throw new ResendDailyQuotaError(message);
        }
        // Otherwise it's a rate limit error
        const retryAfter = error.headers?.["retry-after"];
        throw new ResendRateLimitError(
          message,
          retryAfter ? `${retryAfter}s` : "15m",
        );
      }
      case 400:
        throw new ResendValidationError(message);
      case 401:
        throw new ResendAuthenticationError(message);
      case 451:
        throw new ResendSecurityError(message);
      default:
        throw new ResendError(message, statusCode);
    }
  }

  return response.data?.id ?? "";
};

export const sendResendEmailSafe = ({
  react,
  to,
  subject,
}: {
  react: JSX.Element;
  to: string;
  subject: string;
}) =>
  ResultAsync.fromPromise(
    sendResendEmailUnsafe({ react, to, subject }),
    (error): ResendEmailError => {
      // If it's already one of our error types, return it
      if (
        error instanceof ResendRateLimitError ||
        error instanceof ResendDailyQuotaError ||
        error instanceof ResendValidationError ||
        error instanceof ResendAuthenticationError ||
        error instanceof ResendSecurityError ||
        error instanceof ResendError
      ) {
        return error;
      }
      // Otherwise wrap in UnknownError
      return new UnknownError(
        error instanceof Error
          ? error.message
          : "Unknown error while sending email",
      );
    },
  );

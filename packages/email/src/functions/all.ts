import type { JSX } from "react";
import { ResultAsync } from "neverthrow";

import type {
  CreateContactOptions,
  CreateContactResponseSuccess,
  CreateEmailOptions,
  CreateEmailResponseSuccess,
} from "@vendor/email/types";
import { emailConfig } from "@repo/site-config";
import { createEmailClient } from "@vendor/email";
import { env } from "@vendor/email/env";

import { RESEND_AUDIENCES_ID_MAPPING } from "../constants";

export const mail = createEmailClient(env.RESEND_API_KEY);

// Types for Resend error response
export interface ResendErrorResponse {
  statusCode: number;
  name: string;
  message: string;
  headers?: {
    "retry-after"?: string;
  };
}

type CreateResendEmailSuccess = Pick<CreateEmailResponseSuccess, "id">;
export type CreateResendContactSuccess = Pick<
  CreateContactResponseSuccess,
  "id"
>;
export type CreateResendContact = Pick<
  CreateContactOptions,
  "email" | "unsubscribed"
>;
type CreateResendEmail = Pick<
  CreateEmailOptions,
  "to" | "subject" | "text" | "from"
> & {
  react: JSX.Element;
};

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

export class ResendUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendUnknownError";
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
  | ResendUnknownError;

const sendResendEmailUnsafe = async ({
  react,
  to,
  subject,
  text,
}: CreateResendEmail): Promise<CreateResendEmailSuccess> => {
  const response = await mail.emails.send({
    from: emailConfig.welcome,
    replyTo: emailConfig.supportReployTo,
    to,
    subject,
    react,
    text,
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

  // @IMPORTANT as of 23/04/2025, I am unsure whether this will ever happen
  if (!response.data) {
    throw new ResendError("No data returned from Resend", 500);
  }

  return response.data;
};

export const addToWaitlistContactsUnsafe = async (
  contact: CreateResendContact,
): Promise<CreateResendContactSuccess> => {
  const response = await mail.contacts.create({
    audienceId: RESEND_AUDIENCES_ID_MAPPING["early-access"],
    ...contact,
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

  // @IMPORTANT as of 23/04/2025, I am unsure whether this will ever happen
  if (!response.data) {
    throw new ResendError("No data returned from Resend", 500);
  }

  return response.data;
};

export const sendResendEmailSafe = ({
  from,
  react,
  to,
  subject,
  text,
}: CreateResendEmail) =>
  ResultAsync.fromPromise(
    sendResendEmailUnsafe({ from, react, to, subject, text }),
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
      return new ResendUnknownError(
        error instanceof Error
          ? error.message
          : "Unknown error while sending email",
      );
    },
  );

export const addToWaitlistContactsSafe = (contact: CreateResendContact) =>
  ResultAsync.fromPromise(
    addToWaitlistContactsUnsafe(contact),
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
      return new ResendUnknownError(
        error instanceof Error
          ? error.message
          : "Unknown error while adding contact",
      );
    },
  );

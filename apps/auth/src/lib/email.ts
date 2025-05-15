import type { JSX } from "react";
import { ResultAsync } from "neverthrow";

import { createEmailClient } from "@vendor/email";

import { env } from "../env"; // Import the validated env

// Basic email configuration for the auth app
const authEmailConfig = {
  from: "Lightfast.ai Auth <auth@mail.lightfast.ai>", // Example from address
  replyTo: "Lightfast.ai Support <support@lightfast.ai>", // Example reply-to
};

// Use the validated RESEND_API_KEY from env
const mail = createEmailClient(env.RESEND_API_KEY);

// Types for Resend error response (simplified from www/src/lib/resend.ts)
interface ResendErrorResponse {
  statusCode: number;
  name: string;
  message: string;
}

// Custom error classes for Resend
export class ResendError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ResendError";
  }
}

export class ResendUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendUnknownError";
  }
}

export type SendEmailError = ResendError | ResendUnknownError;

interface CreateEmailParams {
  to: string;
  subject: string;
  text: string;
  react: JSX.Element;
}

const sendEmailUnsafe = async ({
  react,
  to,
  subject,
  text,
}: CreateEmailParams): Promise<{ id: string }> => {
  const response = await mail.emails.send({
    from: authEmailConfig.from,
    replyTo: authEmailConfig.replyTo,
    to,
    subject,
    react,
    text,
  });

  if (response.error) {
    const error = response.error as ResendErrorResponse;
    throw new ResendError(error.message, error.statusCode);
  }

  if (!response.data) {
    throw new ResendError("No data returned from Resend", 500);
  }

  return response.data;
};

export const sendEmail = ({ react, to, subject, text }: CreateEmailParams) =>
  ResultAsync.fromPromise(
    sendEmailUnsafe({ react, to, subject, text }),
    (error): SendEmailError => {
      if (error instanceof ResendError) {
        return error;
      }
      return new ResendUnknownError(
        error instanceof Error
          ? error.message
          : "Unknown error while sending email",
      );
    },
  );

import type { JSX } from "react";
import { ok, ResultAsync } from "neverthrow";

import { createEmailClient } from "@vendor/email";

import { emailConfig } from "~/config/email";
import { env } from "~/env";

export const mail = createEmailClient(env.RESEND_API_KEY);

export class ResendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendError";
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailError";
  }
}

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
    throw new ResendError(response.error.message);
  }

  return ok(response.data?.id ?? "");
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
  ResultAsync.fromThrowable(
    () => sendResendEmailUnsafe({ react, to, subject }),
    (error) => {
      if (error instanceof ResendError) {
        return new EmailError(error.message);
      }
      return new UnknownError("Unknown error while sending email");
    },
  );

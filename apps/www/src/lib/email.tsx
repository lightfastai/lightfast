import { err, ok, ResultAsync } from "neverthrow";

import { createEmailClient } from "@vendor/email";

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

export const sendResendEmail = async ({
  from,
  to,
  subject,
  react,
}: {
  from: string;
  to: string;
  subject: string;
  react: React.ReactNode;
}) => {
  const result = await mail.emails.send({
    from,
    to,
    subject,
    react,
  });

  if (result.error) {
    return err(new ResendError(result.error.message));
  }

  return ok(true);
};

export const sendEmail = ({
  from,
  to,
  subject,
  react,
}: {
  from: string;
  to: string;
  subject: string;
  react: React.ReactNode;
}) =>
  ResultAsync.fromPromise(
    sendResendEmail({
      from,
      to,
      subject,
      react,
    }),
    (error) => {
      if (error instanceof ResendError) {
        return error;
      }
      return new UnknownError(`Failed to send email`);
    },
  );

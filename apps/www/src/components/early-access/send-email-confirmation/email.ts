import { err, ok } from "neverthrow";

import type { NextErrorResponse } from "../aj/errors";
import { getBaseApiUrl } from "~/lib/base-url";

export class EmailConfirmationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfirmationError";
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

export interface SendEmailConfirmationResponse {
  success: boolean;
}

export const sendEmailConfirmationSafe = async ({
  email,
}: {
  email: string;
}) => {
  const response = await fetch(
    `${getBaseApiUrl()}/early-access/send-email-confirmation`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );

  if (!response.ok) {
    const result = (await response.json()) as NextErrorResponse;
    return err(new EmailConfirmationError(result.error));
  }

  const data = (await response.json()) as SendEmailConfirmationResponse;
  return ok(data);
};

import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";

import type { EarlyAccessFormSchema } from "./early-acesss-form.schema";
import { earlyAcessFormSchema } from "./early-acesss-form.schema";

export class EmailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailValidationError";
  }
}

export const validateEmail = (
  data: EarlyAccessFormSchema,
): Result<boolean, EmailValidationError> => {
  const result = earlyAcessFormSchema.safeParse({ email: data.email });
  if (!result.success) {
    return err(
      new EmailValidationError(
        "SafeParseError for email validation: " + data.email,
      ),
    );
  }
  return ok(true);
};

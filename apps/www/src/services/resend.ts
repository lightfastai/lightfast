import { parseError } from "@vendor/observability/error/next";
import { createResendClient } from "@vendor/resend";
import type {
  AddContactSegmentOptions,
  CreateContactOptions,
  UpdateContactOptions,
} from "@vendor/resend/types";
import { Data, Effect } from "effect";
import { env } from "~/env";

const RESEND_CONFLICT_STATUS_CODE = 409;

const resend = createResendClient(env.RESEND_API_KEY);

export class ApplicationError extends Data.TaggedError("ApplicationError")<{
  readonly message: string;
}> {}

export class ResendError extends Data.TaggedError("ResendError")<{
  readonly code: string;
  readonly message: string;
  readonly statusCode: number | null;
}> {}

type ResendServiceError = ApplicationError | ResendError;

export const createContact = (options: CreateContactOptions) =>
  Effect.tryPromise({
    try: () => resend.contacts.create(options),
    catch: (error) =>
      new ApplicationError({
        message: parseError(error),
      }),
  }).pipe(
    Effect.flatMap((response) => {
      if (response.error) {
        return Effect.fail(
          new ResendError({
            code: response.error.name,
            message: response.error.message,
            statusCode: response.error.statusCode,
          })
        );
      }

      return Effect.succeed(response.data);
    })
  );

export const updateContact = (options: UpdateContactOptions) =>
  Effect.tryPromise({
    try: () => resend.contacts.update(options),
    catch: (error) =>
      new ApplicationError({
        message: parseError(error),
      }),
  }).pipe(
    Effect.flatMap((response) => {
      if (response.error) {
        return Effect.fail(
          new ResendError({
            code: response.error.name,
            message: response.error.message,
            statusCode: response.error.statusCode,
          })
        );
      }

      return Effect.succeed(response.data);
    })
  );

export const addContactToSegment = (options: AddContactSegmentOptions) =>
  Effect.tryPromise({
    try: () => resend.contacts.segments.add(options),
    catch: (error) =>
      new ApplicationError({
        message: parseError(error),
      }),
  }).pipe(
    Effect.flatMap((response) => {
      if (response.error) {
        return Effect.fail(
          new ResendError({
            code: response.error.name,
            message: response.error.message,
            statusCode: response.error.statusCode,
          })
        );
      }

      return Effect.succeed(response.data);
    })
  );

export const isResendConflict = (
  error: ResendServiceError
): error is ResendError =>
  error._tag === "ResendError" &&
  error.statusCode === RESEND_CONFLICT_STATUS_CODE;

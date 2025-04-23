import { NonRetriableError, RetryAfterError } from "@vendor/inngest";

import {
  ClerkAuthenticationError,
  ClerkRateLimitError,
  ClerkSecurityError,
  createWaitlistEntrySafe,
  UnknownError,
} from "~/components/early-access/clerk";
import {
  addToWaitlistContactsSafe,
  ResendAuthenticationError,
  ResendDailyQuotaError,
  ResendRateLimitError,
  ResendSecurityError,
  ResendValidationError,
  sendResendEmailSafe,
} from "~/lib/resend";
import EarlyAccessEntryEmail from "~/templates/early-access-entry-email";
import { inngest } from "../_client/client";

export const handleJoinEarlyAccess = inngest.createFunction(
  {
    id: "handle-join-early-access",
  },
  { event: "early-access/join" },
  async ({ event, step }) => {
    const { email } = event.data;

    const result = await step.run("create-clerk-waitlist-entry", async () => {
      const res = await createWaitlistEntrySafe({ email });

      if (res.isErr()) {
        const error = res.error;

        if (error instanceof ClerkRateLimitError) {
          throw new RetryAfterError(
            "Rate limited by contacts service",
            error.retryAfter ?? "15m",
          );
        }

        if (
          error instanceof ClerkAuthenticationError ||
          error instanceof ClerkSecurityError
        ) {
          throw new NonRetriableError(error.name, {
            cause: error.message,
          });
        }

        throw new Error("Failed to create waitlist entry", {
          cause: res.error,
        });
      }

      return res.value;
    });

    await step.run("create-early-access-audience-contact", async () => {
      const res = await addToWaitlistContactsSafe({
        email,
        unsubscribed: false,
      });

      if (res.isErr()) {
        const error = res.error;

        if (error instanceof ResendRateLimitError) {
          throw new RetryAfterError(
            "Rate limited by contacts service",
            error.retryAfter ?? "15m",
          );
        }

        if (error instanceof ResendDailyQuotaError) {
          throw new RetryAfterError("Daily contacts quota exceeded", "24h");
        }

        if (
          error instanceof ResendValidationError ||
          error instanceof ResendAuthenticationError ||
          error instanceof ResendSecurityError
        ) {
          throw new NonRetriableError(error.name, {
            cause: error.message,
          });
        }

        if (error instanceof UnknownError) {
          throw new Error("Unknown error", {
            cause: error.message,
          });
        }

        throw new Error("Contact error", {
          cause: error.message,
        });
      }

      return res.value;
    });

    await step.run("send-welcome-email", async () => {
      const res = await sendResendEmailSafe({
        to: email,
        react: EarlyAccessEntryEmail({ email }),
        subject: "Welcome to Lightfast.ai Early Access",
      });

      if (res.isErr()) {
        const error = res.error;

        if (error instanceof ResendRateLimitError) {
          throw new RetryAfterError(
            "Rate limited by email service",
            error.retryAfter ?? "15m",
          );
        }

        if (error instanceof ResendDailyQuotaError) {
          throw new RetryAfterError("Daily email quota exceeded", "24h");
        }

        if (
          error instanceof ResendValidationError ||
          error instanceof ResendAuthenticationError ||
          error instanceof ResendSecurityError
        ) {
          throw new NonRetriableError(error.name, {
            cause: error.message,
          });
        }

        if (error instanceof UnknownError) {
          throw new Error("Unknown error", {
            cause: error.message,
          });
        }

        throw new Error("Email error", {
          cause: error.message,
        });
      }
    });

    return result;
  },
);

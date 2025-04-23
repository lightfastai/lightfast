import { NonRetriableError, RetryAfterError } from "inngest";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import {
  EmailValidationError,
  validateEmail,
} from "~/components/early-access/early-access-form.validation";
import {
  ResendAuthenticationError,
  ResendDailyQuotaError,
  ResendRateLimitError,
  ResendSecurityError,
  ResendValidationError,
  sendResendEmailSafe,
  UnknownError,
} from "~/lib/resend";
import EarlyAccessEntryEmail from "~/templates/early-access-entry-email";

/**
 * Handles the sending of an email confirmation to the user.
 * Implements throttling to prevent overwhelming the email service
 * and ensures uniqueness based on email address.
 *
 * Throttling is set to 30 emails per minute (1 every 2 seconds) with a small burst capacity
 * to ensure smooth delivery and prevent overwhelming email services.
 */
export const handleSendEmailConfirmation = inngest.createFunction(
  {
    id: "handle-send-email-confirmation",
    // Add throttling to prevent overwhelming email service
    // Limit to 30 emails per minute (1 every 2 seconds)
    throttle: {
      limit: 30,
      period: "1m",
      burst: 5,
    },
    // Add rate limiting to prevent duplicate emails
    // Only allow 1 email per email address per hour
    rateLimit: {
      key: "event.data.email",
      limit: 1,
      period: "1h",
    },
    // Configure retries with exponential backoff
    retries: 3, // 3 retries (4 total attempts)
  },
  { event: "early-access/user.created" },
  async ({ event, step }) => {
    const { email } = event.data;

    await step.run("validate-email", () => {
      const res = validateEmail({ email });
      if (res.isErr()) {
        if (res.error instanceof EmailValidationError) {
          // Don't retry validation errors as they won't succeed on retry
          throw new NonRetriableError("Invalid email", {
            cause: res.error.message,
          });
        }

        throw new Error("Validation error", {
          cause: "An unexpected error occurred during validation",
        });
      }
    });

    await step.run("send-email-confirmation", async () => {
      const res2 = await sendResendEmailSafe({
        react: EarlyAccessEntryEmail({ email }),
        to: email,
        subject: "Welcome to Lightfast.ai Early Access",
      });

      if (res2.isErr()) {
        const error = res2.error;

        // Handle specific Resend error types
        if (error instanceof ResendRateLimitError) {
          throw new RetryAfterError(
            "Rate limited by email service",
            error.retryAfter ?? "15m",
          );
        }

        if (error instanceof ResendDailyQuotaError) {
          throw new RetryAfterError("Daily email quota exceeded", "24h");
        }

        // Non-retriable errors
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
          // Let Inngest's default retry logic handle unknown errors
          throw new Error("Unknown error", {
            cause: error.message,
          });
        }

        // For other Resend errors (including 500s), let Inngest retry with backoff
        throw new Error("Email sending error", {
          cause: error.message,
        });
      }
    });

    return {
      success: true,
    };
  },
);

import { NonRetriableError, RetryAfterError } from "inngest";

import type { EarlyAccessSendWelcomeEmailResult } from "../_client/types";
import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import {
  ResendAuthenticationError,
  ResendDailyQuotaError,
  ResendRateLimitError,
  ResendSecurityError,
  ResendValidationError,
  sendResendEmailSafe,
  UnknownError,
} from "~/lib/resend";
import { EarlyAccessEntryEmail } from "~/templates/early-access-entry-email";

/**
 * Handles sending the early access welcome email.
 * Implements throttling to prevent overwhelming the email service
 * and ensures uniqueness based on email address.
 */
export const handleSendEarlyAccessEmail = inngest.createFunction(
  {
    id: "handle-send-early-access-email",
    // Add throttling to prevent overwhelming email service
    throttle: {
      limit: 50,
      period: "1m",
      burst: 8,
    },
    // Add rate limiting to prevent duplicate emails
    rateLimit: {
      key: "event.data.email",
      limit: 3,
      period: "24h",
    },
    // Configure retries with exponential backoff
    retries: 3,
  },
  { event: "early-access/email.welcome" },
  async ({ event, step }): Promise<EarlyAccessSendWelcomeEmailResult> => {
    const { recipient, contactId } = event.data;

    await step.run("send-welcome-email", async () => {
      const res = await sendResendEmailSafe({
        to: recipient,
        react: EarlyAccessEntryEmail({ email: recipient }),
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

    return {
      success: true,
      contactId,
      recipient,
      timestamp: new Date().toISOString(),
    };
  },
);

import { NonRetriableError, RetryAfterError } from "inngest";

import type { EarlyAccessContractCreateResult } from "../_client/types";
import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import {
  EmailValidationError,
  validateEmail,
} from "~/components/early-access/early-access-form.validation";
import {
  addToWaitlistContactsSafe,
  ResendAuthenticationError,
  ResendDailyQuotaError,
  ResendRateLimitError,
  ResendSecurityError,
  ResendValidationError,
  UnknownError,
} from "~/lib/resend";

/**
 * Handles the creation of an early access contact.
 * Implements throttling to prevent overwhelming the contact service
 * and ensures uniqueness based on email address.
 */
export const handleCreateEarlyAccessContact = inngest.createFunction(
  {
    id: "handle-create-early-access-contact",
    // Add throttling to prevent overwhelming contact service
    throttle: {
      limit: 30,
      period: "1m",
      burst: 5,
    },
    // Add rate limiting to prevent duplicate contacts
    rateLimit: {
      key: "event.data.email",
      limit: 1,
      period: "1h",
    },
    // Configure retries with exponential backoff
    retries: 3,
  },
  { event: "early-access/contact.create" },
  async ({ event, step }): Promise<EarlyAccessContractCreateResult> => {
    const { email } = event.data;

    await step.run("validate-email", () => {
      const res = validateEmail({ email });
      if (res.isErr()) {
        if (res.error instanceof EmailValidationError) {
          throw new NonRetriableError("Invalid email", {
            cause: res.error.message,
          });
        }

        throw new Error("Validation error", {
          cause: "An unexpected error occurred during validation",
        });
      }
    });

    const contactResult = await step.run(
      "create-early-access-audience-contact",
      async () => {
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
      },
    );

    // Send event to trigger welcome email
    await step.sendEvent("send-welcome-email", {
      name: "early-access/email.welcome",
      data: {
        recipient: email,
        contactId: contactResult.id,
      },
    });

    return {
      success: true,
      contactId: contactResult.id,
      email,
      timestamp: new Date().toISOString(),
    };
  },
);

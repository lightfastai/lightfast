import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import {
  EmailValidationError,
  validateEmail,
} from "~/components/early-access/early-access-form.validation";
import { EmailError, sendResendEmailSafe, UnknownError } from "~/lib/resend";
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
  },
  { event: "early-access/user.created" },
  async ({ event, step }) => {
    const { email } = event.data;

    await step.run("validate-email", () => {
      const res = validateEmail({ email });
      if (res.isErr()) {
        if (res.error instanceof EmailValidationError) {
          throw new Error("Invalid email", {
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
      })();

      if (res2.isErr()) {
        if (res2.error instanceof EmailError) {
          throw new Error("Failed to send email", {
            cause: res2.error.message,
          });
        }

        if (res2.error instanceof UnknownError) {
          throw new Error("Unknown error", {
            cause: res2.error.message,
          });
        }

        throw new Error("Email sending error", {
          cause: "An unexpected error occurred while sending email",
        });
      }
    });

    return {
      success: true,
    };
  },
);

import { nanoid } from "nanoid";

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
    idempotency: `event.data.email`,
    throttle: {
      limit: 5,
      period: "10s",
      burst: 10,
    },
  },
  { event: "early-access/join" },
  async ({ event, step }) => {
    const { email, requestId: originalRequestId } = event.data;
    const workflowTraceId = nanoid();

    const result = await step.run("create-clerk-waitlist-entry", async () => {
      const res = await createWaitlistEntrySafe({ email });

      if (res.isErr()) {
        const error = res.error;

        if (error instanceof ClerkRateLimitError) {
          console.error("Clerk rate limit error:", {
            workflowTraceId,
            originalRequestId,
            retryAfter: error.retryAfter,
            email,
          });

          throw new RetryAfterError(
            "Rate limited by contacts service",
            error.retryAfter ?? "15m",
          );
        }

        if (
          error instanceof ClerkAuthenticationError ||
          error instanceof ClerkSecurityError
        ) {
          console.error("Clerk auth/security error:", {
            workflowTraceId,
            originalRequestId,
            errorType: error.name,
            message: error.message,
            email,
          });

          throw new NonRetriableError(error.name, {
            cause: error.message,
          });
        }

        console.error("Clerk unknown error:", {
          workflowTraceId,
          originalRequestId,
          error: res.error,
          email,
        });

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
          console.error("Resend rate limit error:", {
            workflowTraceId,
            originalRequestId,
            retryAfter: error.retryAfter,
            email,
          });

          throw new RetryAfterError(
            "Rate limited by contacts service",
            error.retryAfter ?? "15m",
          );
        }

        if (error instanceof ResendDailyQuotaError) {
          console.error("Resend daily quota exceeded:", {
            workflowTraceId,
            originalRequestId,
            email,
          });

          throw new RetryAfterError("Daily contacts quota exceeded", "24h");
        }

        if (
          error instanceof ResendValidationError ||
          error instanceof ResendAuthenticationError ||
          error instanceof ResendSecurityError
        ) {
          console.error("Resend auth/security error:", {
            workflowTraceId,
            originalRequestId,
            errorType: error.name,
            message: error.message,
            email,
          });

          throw new NonRetriableError(error.name, {
            cause: error.message,
          });
        }

        if (error instanceof UnknownError) {
          console.error("Resend unknown error:", {
            workflowTraceId,
            originalRequestId,
            error: error.message,
            email,
          });

          throw new Error("Unknown error", {
            cause: error.message,
          });
        }

        console.error("Resend contact error:", {
          workflowTraceId,
          originalRequestId,
          error: error.message,
          email,
        });

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
          console.error("Email rate limit error:", {
            workflowTraceId,
            originalRequestId,
            retryAfter: error.retryAfter,
            email,
          });

          throw new RetryAfterError(
            "Rate limited by email service",
            error.retryAfter ?? "15m",
          );
        }

        if (error instanceof ResendDailyQuotaError) {
          console.error("Email daily quota exceeded:", {
            workflowTraceId,
            originalRequestId,
            email,
          });

          throw new RetryAfterError("Daily email quota exceeded", "24h");
        }

        if (
          error instanceof ResendValidationError ||
          error instanceof ResendAuthenticationError ||
          error instanceof ResendSecurityError
        ) {
          console.error("Email auth/security error:", {
            workflowTraceId,
            originalRequestId,
            errorType: error.name,
            message: error.message,
            email,
          });

          throw new NonRetriableError(error.name, {
            cause: error.message,
          });
        }

        if (error instanceof UnknownError) {
          console.error("Email unknown error:", {
            workflowTraceId,
            originalRequestId,
            error: error.message,
            email,
          });

          throw new Error("Unknown error", {
            cause: error.message,
          });
        }

        console.error("Email error:", {
          workflowTraceId,
          originalRequestId,
          error: error.message,
          email,
        });

        throw new Error("Email error", {
          cause: error.message,
        });
      }
    });

    return result;
  },
);

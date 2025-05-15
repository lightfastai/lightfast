import { nanoid } from "nanoid";

import { emailConfig } from "@repo/lightfast-config";
import {
  addToWaitlistContactsSafe,
  ResendAuthenticationError,
  ResendDailyQuotaError,
  ResendRateLimitError,
  ResendSecurityError,
  ResendUnknownError,
  ResendValidationError,
  sendResendEmailSafe,
} from "@repo/lightfast-email/functions";
import {
  EarlyAccessEntryEmail,
  earlyAccessEntryEmailText,
} from "@repo/lightfast-email/templates";
import { NonRetriableError, RetryAfterError } from "@vendor/inngest";
import { log } from "@vendor/observability/log";

import {
  ClerkAuthenticationError,
  ClerkRateLimitError,
  ClerkSecurityError,
  createClerkEarlyAccessEntrySafe,
} from "~/components/early-access/api/create-clerk-early-access-entry";
import {
  incrementEarlyAccessCountSafe,
  UpstashRateLimitError,
} from "~/components/early-access/api/get-early-access-count";
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
      const res = await createClerkEarlyAccessEntrySafe({
        email,
        logger: log,
      });

      if (res.isErr()) {
        const error = res.error;

        if (error instanceof ClerkRateLimitError) {
          log.error("Clerk rate limit error:", {
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
          log.error("Clerk auth/security error:", {
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

        log.error("Clerk unknown error:", {
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

    // Increment waitlist count
    await step.run("increment-waitlist-count", async () => {
      const result = await incrementEarlyAccessCountSafe({ logger: log });

      result.match(
        () => {
          // Success, no action needed
        },
        (error) => {
          if (error.originalError instanceof UpstashRateLimitError) {
            log.error("Redis rate limit error:", {
              workflowTraceId,
              originalRequestId,
              retryAfter: error.originalError.retryAfter,
              email,
            });

            throw new RetryAfterError(
              "Rate limited by Redis",
              error.originalError.retryAfter ?? "60s",
            );
          }

          log.error("Failed to increment waitlist count:", {
            workflowTraceId,
            originalRequestId,
            error,
            email,
          });
          // Don't throw error here as this is not critical for the workflow
        },
      );
    });

    await step.run("create-early-access-audience-contact", async () => {
      const res = await addToWaitlistContactsSafe({
        email,
        unsubscribed: false,
      });

      if (res.isErr()) {
        const error = res.error;

        if (error instanceof ResendRateLimitError) {
          log.error("Resend rate limit error:", {
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
          log.error("Resend daily quota exceeded:", {
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
          log.error("Resend auth/security error:", {
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

        if (error instanceof ResendUnknownError) {
          log.error("Resend unknown error:", {
            workflowTraceId,
            originalRequestId,
            error: error.message,
            email,
          });

          throw new Error("Unknown error", {
            cause: error.message,
          });
        }

        log.error("Resend contact error:", {
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
        from: emailConfig.welcome,
        to: email,
        react: EarlyAccessEntryEmail({ email }),
        subject: "Welcome to Lightfast.ai Early Access",
        text: earlyAccessEntryEmailText({ email }),
      });

      if (res.isErr()) {
        const error = res.error;

        if (error instanceof ResendRateLimitError) {
          log.error("Email rate limit error:", {
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
          log.error("Email daily quota exceeded:", {
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
          log.error("Email auth/security error:", {
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

        if (error instanceof ResendUnknownError) {
          log.error("Email unknown error:", {
            workflowTraceId,
            originalRequestId,
            error: error.message,
            email,
          });

          throw new Error("Unknown error", {
            cause: error.message,
          });
        }

        log.error("Email error:", {
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

"use server";

import { createEmailClient } from "@vendor/email";
import { parseError } from "@vendor/observability/error/next";
import {
  captureException,
  logger,
  withServerActionInstrumentation,
} from "@vendor/observability/sentry-nextjs";
import {
  ARCJET_KEY,
  arcjet,
  request as arcjetRequest,
  protectSignup,
} from "@vendor/security";
import { headers } from "next/headers";
import { z } from "zod";
import { env } from "~/env";

const NEWSLETTER_SEGMENT_ID = "55744eed-18f8-42fa-9d04-36fe6ec71772";

const newsletterArcjet = arcjet({
  key: ARCJET_KEY,
  rules: [
    protectSignup({
      bots: {
        allow: [],
        mode: "DRY_RUN",
      },
      email: {
        deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
        mode: "DRY_RUN",
      },
      rateLimit: {
        interval: "10m",
        max: 5,
        mode: "DRY_RUN",
      },
    }),
  ],
});

export interface NewsletterActionState {
  message: string;
  status: "idle" | "success" | "error";
}

export async function subscribeToNewsletter(
  _state: NewsletterActionState,
  formData: FormData
): Promise<NewsletterActionState> {
  return withServerActionInstrumentation(
    "subscribeToNewsletter",
    {
      headers: await headers(),
      recordResponse: true,
    },
    async (): Promise<NewsletterActionState> => {
      const parsed = z
        .object({
          email: z.string().trim().toLowerCase().max(256).email(),
        })
        .safeParse({
          email: formData.get("email"),
        });

      if (!parsed.success) {
        return {
          message: "Please enter a valid email address.",
          status: "error",
        };
      }

      const { email } = parsed.data;

      try {
        const decision = await newsletterArcjet.protect(await arcjetRequest(), {
          email,
        });
        const shouldLogDecision =
          decision.isDenied() ||
          decision.isErrored() ||
          decision.results.some((result) => result.conclusion !== "ALLOW");

        if (shouldLogDecision) {
          logger.warn("Newsletter Arcjet dry-run decision", {
            conclusion: decision.conclusion,
            decision_id: decision.id,
            provider: "arcjet",
            reason_type: decision.reason.type,
            step: "dry_run",
          });
        }
      } catch (error) {
        captureException(error);

        logger.error("Newsletter Arcjet dry-run failed", {
          error: parseError(error),
          provider: "arcjet",
          step: "dry_run",
        });
      }

      const emailClient = createEmailClient(env.RESEND_API_KEY);

      try {
        const createResult = await emailClient.contacts.create({
          email,
          segments: [{ id: NEWSLETTER_SEGMENT_ID }],
          unsubscribed: false,
        });

        if (!createResult.error) {
          return {
            message: "You're subscribed. Stay tuned for updates.",
            status: "success",
          };
        }

        if (createResult.error.statusCode !== 409) {
          logger.error("Newsletter subscription failed", {
            error: parseError(createResult.error),
            provider: "resend",
            status_code: createResult.error.statusCode,
            step: "create_contact",
          });

          return {
            message: "We couldn't subscribe that address. Please try again.",
            status: "error",
          };
        }

        const updateResult = await emailClient.contacts.update({
          email,
          unsubscribed: false,
        });

        if (updateResult.error) {
          logger.error("Newsletter subscription failed", {
            error: parseError(updateResult.error),
            provider: "resend",
            status_code: updateResult.error.statusCode,
            step: "update_contact",
          });

          return {
            message: "We couldn't subscribe that address. Please try again.",
            status: "error",
          };
        }

        const segmentResult = await emailClient.contacts.segments.add({
          email,
          segmentId: NEWSLETTER_SEGMENT_ID,
        });

        if (!segmentResult.error || segmentResult.error.statusCode === 409) {
          return {
            message: "You're subscribed. Stay tuned for updates.",
            status: "success",
          };
        }

        logger.error("Newsletter subscription failed", {
          error: parseError(segmentResult.error),
          provider: "resend",
          status_code: segmentResult.error.statusCode,
          step: "add_segment",
        });

        return {
          message: "We couldn't subscribe that address. Please try again.",
          status: "error",
        };
      } catch (error) {
        captureException(error);

        logger.error("Newsletter subscription failed", {
          error: parseError(error),
          provider: "resend",
          step: "unexpected_error",
        });

        return {
          message: "We couldn't subscribe that address. Please try again.",
          status: "error",
        };
      }
    }
  );
}

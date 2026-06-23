"use server";

import { parseError } from "@vendor/observability/error/next";
import {
  captureException,
  logger,
  withServerActionInstrumentation,
} from "@vendor/observability/sentry-nextjs";
import {
  ARCJET_KEY,
  type ArcjetDecision,
  arcjet,
  request as arcjetRequest,
  protectSignup,
} from "@vendor/security";
import { Effect } from "effect";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import {
  addContactToSegment,
  createContact,
  isResendConflict,
  updateContact,
} from "~/services/resend";
import { notifyNewsletterSignup } from "~/services/slack";

const NEWSLETTER_SEGMENT_ID = "55744eed-18f8-42fa-9d04-36fe6ec71772";

const newsletterArcjet = arcjet({
  key: ARCJET_KEY,
  rules: [
    protectSignup({
      bots: {
        allow: [],
        mode: "LIVE",
      },
      email: {
        deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
        mode: "LIVE",
      },
      rateLimit: {
        interval: "10m",
        max: 5,
        mode: "LIVE",
      },
    }),
  ],
});

function getArcjetDeniedMessage(decision: ArcjetDecision): string {
  if (decision.reason.isRateLimit()) {
    return decision.reason.reset > 0
      ? `Too many attempts. Please wait ${decision.reason.reset}s and try again.`
      : "Too many attempts. Please wait a moment and try again.";
  }

  if (decision.reason.isBot()) {
    return "We couldn't verify this signup. Please try again from a browser.";
  }

  if (decision.reason.isEmail()) {
    return "Please enter a valid email address.";
  }

  return "We couldn't subscribe that address. Please try again.";
}

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

        if (decision.isDenied()) {
          logger.warn("Newsletter Arcjet blocked signup", {
            conclusion: decision.conclusion,
            decision_id: decision.id,
            provider: "arcjet",
            reason_type: decision.reason.type,
            step: "protect",
          });

          return {
            message: getArcjetDeniedMessage(decision),
            status: "error",
          };
        }

        if (decision.isErrored()) {
          logger.error("Newsletter Arcjet protection failed open", {
            conclusion: decision.conclusion,
            decision_id: decision.id,
            error: parseError(decision.reason),
            provider: "arcjet",
            reason_type: decision.reason.type,
            step: "protect",
          });
        }
      } catch (error) {
        captureException(error);

        logger.error("Newsletter Arcjet protection failed open", {
          error: parseError(error),
          provider: "arcjet",
          step: "protect",
        });
      }

      return await Effect.runPromise(
        createContact({
          email,
          segments: [{ id: NEWSLETTER_SEGMENT_ID }],
          unsubscribed: false,
        }).pipe(
          Effect.catchIf(isResendConflict, () =>
            Effect.gen(function* () {
              yield* updateContact({
                email,
                unsubscribed: false,
              });

              yield* addContactToSegment({
                email,
                segmentId: NEWSLETTER_SEGMENT_ID,
              }).pipe(Effect.catchIf(isResendConflict, () => Effect.void));
            })
          ),
          Effect.tap(() =>
            Effect.sync(() => {
              after(() =>
                Effect.runPromise(
                  notifyNewsletterSignup({ email }).pipe(
                    Effect.catchTags({
                      ApplicationError: (error) => {
                        captureException(error);

                        logger.error("Newsletter Slack notification failed", {
                          error: error.message,
                          provider: "slack",
                          step: "unexpected_error",
                        });

                        return Effect.void;
                      },
                      SlackError: (error) => {
                        logger.error("Newsletter Slack notification failed", {
                          error: error.message,
                          provider: "slack",
                          status_code: error.statusCode,
                        });

                        return Effect.void;
                      },
                    })
                  )
                )
              );
            })
          ),
          Effect.as({
            message: "You're subscribed. Stay tuned for updates.",
            status: "success" as const,
          }),
          Effect.catchTags({
            ApplicationError: (error) => {
              captureException(error);

              logger.error("Newsletter subscription failed", {
                error: error.message,
                step: "unexpected_error",
              });

              return Effect.succeed({
                message:
                  "We couldn't subscribe that address. Please try again.",
                status: "error" as const,
              });
            },
            ResendError: (error) => {
              logger.error("Newsletter subscription failed", {
                error: error.message,
                error_code: error.code,
                provider: "resend",
                status_code: error.statusCode,
              });

              return Effect.succeed({
                message:
                  "We couldn't subscribe that address. Please try again.",
                status: "error" as const,
              });
            },
          })
        )
      );
    }
  );
}

import { parseError } from "@vendor/observability/error/next";
import { env as slackEnv } from "@vendor/slack/env";
import { Data, Effect } from "effect";

const SLACK_WEBHOOK_TIMEOUT_MS = 5000;

export class ApplicationError extends Data.TaggedError("ApplicationError")<{
  readonly message: string;
}> {}

export class SlackError extends Data.TaggedError("SlackError")<{
  readonly message: string;
  readonly statusCode: number;
}> {}

interface NotifyNewsletterSignupOptions {
  readonly email: string;
}

export const notifyNewsletterSignup = ({
  email,
}: NotifyNewsletterSignupOptions) => {
  const webhookUrl = slackEnv.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return Effect.void;
  }

  return Effect.tryPromise({
    try: () =>
      fetch(webhookUrl, {
        body: JSON.stringify({
          blocks: [
            {
              text: {
                emoji: true,
                text: `New newsletter signup\nEmail: ${email}`,
                type: "plain_text",
              },
              type: "section",
            },
          ],
          text: `New newsletter signup: ${email}`,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(SLACK_WEBHOOK_TIMEOUT_MS),
      }),
    catch: (error) =>
      new ApplicationError({
        message: parseError(error),
      }),
  }).pipe(
    Effect.flatMap((response) => {
      if (!response.ok) {
        return Effect.fail(
          new SlackError({
            message: `Slack newsletter webhook failed with ${response.status} ${response.statusText}`,
            statusCode: response.status,
          })
        );
      }

      return Effect.void;
    })
  );
};

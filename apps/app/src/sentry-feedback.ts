export const FEEDBACK_MESSAGE_PLACEHOLDER =
  "Tell us what happened, what you expected, and any useful context.";

const FEEDBACK_FLUSH_TIMEOUT_MS = 5000;

export interface SubmitSentryFeedbackInput {
  email?: string;
  message: string;
  name?: string;
}

export async function submitSentryFeedback(input: SubmitSentryFeedbackInput) {
  const message = input.message.trim();

  if (!message) {
    throw new Error("Feedback message is required");
  }

  const Sentry = await import("@sentry/nextjs");
  const payload = {
    message,
    source: "custom-app-feedback",
    tags: {
      feedback_source: "app-sidebar",
    },
    url: typeof window === "undefined" ? undefined : window.location.href,
  };
  const name = input.name?.trim();
  const email = input.email?.trim();

  const eventId = Sentry.captureFeedback(
    {
      ...payload,
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    },
    { includeReplay: true }
  );

  const didFlush = await Sentry.flush(FEEDBACK_FLUSH_TIMEOUT_MS);

  if (!didFlush) {
    throw new Error("Unable to send feedback");
  }

  return eventId;
}

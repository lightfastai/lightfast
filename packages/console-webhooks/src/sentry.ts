/**
 * Sentry webhook types
 *
 * Re-exports Sentry webhook types from the transformer module.
 */

export type {
  SentryActor,
  SentryErrorEvent,
  SentryErrorWebhook,
  SentryEventAlertWebhook,
  SentryIssue,
  SentryIssueWebhook,
  SentryMetricAlertWebhook,
  SentryWebhookEventType,
} from "./transformers/sentry.js";

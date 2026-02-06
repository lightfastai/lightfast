/**
 * Sentry webhook types
 *
 * Re-exports Sentry webhook types from the transformer module.
 */

export type {
  SentryIssueWebhook,
  SentryErrorWebhook,
  SentryEventAlertWebhook,
  SentryMetricAlertWebhook,
  SentryIssue,
  SentryErrorEvent,
  SentryActor,
  SentryEventType,
} from "./transformers/sentry.js";

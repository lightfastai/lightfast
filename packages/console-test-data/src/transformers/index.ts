/**
 * Mock Transformers for Test Data
 *
 * This module exports mock transformers for sources that are not yet
 * implemented in production (Sentry, Linear). These transformers use
 * official webhook payload structures from their respective APIs.
 *
 * Production transformers (GitHub, Vercel) are imported from @repo/console-webhooks.
 */

export {
  sentryTransformers,
  type SentryEventType,
  type SentryIssueWebhook,
  type SentryErrorWebhook,
  type SentryEventAlertWebhook,
  type SentryMetricAlertWebhook,
  type SentryIssue,
  type SentryErrorEvent,
  type SentryActor,
} from "./sentry.js";

export {
  linearTransformers,
  type LinearWebhookType,
  type LinearIssueWebhook,
  type LinearCommentWebhook,
  type LinearProjectWebhook,
  type LinearCycleWebhook,
  type LinearProjectUpdateWebhook,
  type LinearIssue,
  type LinearComment,
  type LinearProject,
  type LinearCycle,
  type LinearProjectUpdate,
  type LinearUser,
  type LinearLabel,
} from "./linear.js";

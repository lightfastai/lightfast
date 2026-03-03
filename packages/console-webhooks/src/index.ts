/**
 * @repo/console-webhooks
 *
 * Webhook event transformers, validation, and sanitization for Console integrations.
 *
 * Signature verification is handled by the Relay service (apps/relay/).
 * This package provides:
 * - Event transformers (GitHub, Vercel, Linear, Sentry) that produce PostTransformEvent shapes
 * - Payload validation against Zod schemas
 * - Sanitization utilities for webhook content
 */

// Validation utilities
export { validatePostTransformEvent, type ValidationResult } from "./validation.js";

// Transform context
export type { TransformContext } from "./transform-context.js";

// Sanitization utilities
export {
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  encodeHtmlEntities,
  truncateWithEllipsis,
  sanitizeContent,
  sanitizeTitle,
  sanitizeBody,
} from "./sanitize.js";

// GitHub transformers and types
export {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  githubTransformers,
} from "./transformers/github.js";
export type {
  PushEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
  GitHubWebhookEventType,
} from "./transformers/github.js";

// Vercel transformers and types
export {
  transformVercelDeployment,
  vercelTransformers,
} from "./transformers/vercel.js";
export type {
  VercelWebhookEventType,
  VercelWebhookPayload,
} from "./transformers/vercel.js";

// Linear transformers and types
export {
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
  linearTransformers,
} from "./transformers/linear.js";
export type {
  LinearWebhookBase,
  LinearWebhookEventType,
  LinearIssueWebhook,
  LinearCommentWebhook,
  LinearProjectWebhook,
  LinearCycleWebhook,
  LinearProjectUpdateWebhook,
  LinearIssue,
  LinearAttachment,
  LinearComment,
  LinearProject,
  LinearCycle,
  LinearProjectUpdate,
  LinearUser,
  LinearLabel,
} from "./transformers/linear.js";

// Sentry transformers and types
export {
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
  sentryTransformers,
} from "./transformers/sentry.js";
export type {
  SentryIssueWebhook,
  SentryErrorWebhook,
  SentryEventAlertWebhook,
  SentryMetricAlertWebhook,
  SentryIssue,
  SentryErrorEvent,
  SentryActor,
  SentryWebhookEventType,
} from "./transformers/sentry.js";

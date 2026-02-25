/**
 * @repo/console-webhooks
 *
 * Webhook event transformers, validation, and storage utilities for Console integrations.
 *
 * Signature verification is handled by the Gateway service (apps/gateway/).
 * This package provides:
 * - Event transformers (GitHub, Vercel, Linear, Sentry) that produce SourceEvent shapes
 * - Payload validation against Zod schemas
 * - Sanitization utilities for webhook content
 * - Storage helpers for ingestion payloads
 * - Type re-exports for Linear and Sentry webhook shapes
 */

// Type re-exports for Linear webhook shapes
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
} from "./linear.js";

// Type re-exports for Sentry webhook shapes
export type {
  SentryIssueWebhook,
  SentryErrorWebhook,
  SentryEventAlertWebhook,
  SentryMetricAlertWebhook,
  SentryIssue,
  SentryErrorEvent,
  SentryActor,
  SentryWebhookEventType,
} from "./sentry.js";

// Validation utilities
export { validateSourceEvent } from "./validation.js";
export type { ValidationResult } from "./validation.js";

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

// Storage utilities
export { storeIngestionPayload, extractWebhookHeaders } from "./storage.js";
export type { StoreIngestionPayloadParams, StoreWebhookPayloadParams } from "./storage.js";

// Transformers
export {
  // GitHub
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  githubTransformers,
  // Vercel
  transformVercelDeployment,
  vercelTransformers,
  // Linear
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
  linearTransformers,
  // Sentry
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
  sentryTransformers,
} from "./transformers/index.js";
export type {
  // GitHub
  PushEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
  GitHubWebhookEventType,
  // Vercel
  VercelWebhookEventType,
  VercelWebhookPayload,
} from "./transformers/index.js";

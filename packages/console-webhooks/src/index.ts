/**
 * @repo/console-webhooks
 *
 * Webhook event transformers, validation, and storage utilities for Console integrations.
 *
 * Signature verification is handled by the Relay service (apps/relay/).
 * This package provides:
 * - Event transformers (GitHub, Vercel, Linear, Sentry) that produce SourceEvent shapes
 * - Payload validation against Zod schemas
 * - Sanitization utilities for webhook content
 * - Storage helpers for ingestion payloads
 * - Type re-exports for Linear and Sentry webhook shapes
 */

// Type re-exports for Linear webhook shapes
export type {
  LinearAttachment,
  LinearComment,
  LinearCommentWebhook,
  LinearCycle,
  LinearCycleWebhook,
  LinearIssue,
  LinearIssueWebhook,
  LinearLabel,
  LinearProject,
  LinearProjectUpdate,
  LinearProjectUpdateWebhook,
  LinearProjectWebhook,
  LinearUser,
  LinearWebhookBase,
  LinearWebhookEventType,
} from "./linear.js";
// Sanitization utilities
export {
  encodeHtmlEntities,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  sanitizeBody,
  sanitizeContent,
  sanitizeTitle,
  truncateWithEllipsis,
} from "./sanitize.js";
// Type re-exports for Sentry webhook shapes
export type {
  SentryActor,
  SentryErrorEvent,
  SentryErrorWebhook,
  SentryEventAlertWebhook,
  SentryIssue,
  SentryIssueWebhook,
  SentryMetricAlertWebhook,
  SentryWebhookEventType,
} from "./sentry.js";
// Storage utilities
export {
  extractWebhookHeaders,
  type StoreIngestionPayloadParams,
  type StoreWebhookPayloadParams,
  storeIngestionPayload,
} from "./storage.js";
export type {
  DiscussionEvent,
  GitHubWebhookEventType,
  IssuesEvent,
  PullRequestEvent,
  // GitHub
  PushEvent,
  ReleaseEvent,
  // Vercel
  VercelWebhookEventType,
  VercelWebhookPayload,
} from "./transformers/index.js";

// Transformers
export {
  githubTransformers,
  linearTransformers,
  sentryTransformers,
  transformGitHubDiscussion,
  transformGitHubIssue,
  transformGitHubPullRequest,
  // GitHub
  transformGitHubPush,
  transformGitHubRelease,
  transformLinearComment,
  transformLinearCycle,
  // Linear
  transformLinearIssue,
  transformLinearProject,
  transformLinearProjectUpdate,
  transformSentryError,
  transformSentryEventAlert,
  // Sentry
  transformSentryIssue,
  transformSentryMetricAlert,
  // Vercel
  transformVercelDeployment,
  vercelTransformers,
} from "./transformers/index.js";
// Validation utilities
export { type ValidationResult, validateSourceEvent } from "./validation.js";

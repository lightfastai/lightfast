/**
 * @repo/console-webhooks
 *
 * Webhook event pre-transformers, post-transform validation, and sanitization
 * for Console integrations.
 *
 * Structure:
 * - pre-transformers/  — PreTransform types + transform functions per provider
 * - post-transformers/ — PostTransform validation
 * - sanitize.ts        — Content sanitization utilities
 */

// Central dispatch
export { transformWebhookPayload } from "./dispatch";

// Post-transform validation
export { validatePostTransformEvent, sanitizePostTransformEvent, type ValidationResult } from "./post-transformers";

// Transform context
export type { TransformContext } from "./transform-context";

// Sanitization utilities
export {
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  encodeHtmlEntities,
  truncateWithEllipsis,
  sanitizeContent,
  sanitizeTitle,
  sanitizeBody,
} from "./sanitize";

// Pre-transformer Zod schemas (source of truth for payload shapes)
export * from "./pre-transformers/schemas";

// Pre-transformers (types + transform functions)
export {
  // GitHub
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  // Vercel
  transformVercelDeployment,
  // Linear
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
  // Sentry
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
} from "./pre-transformers";

export type {
  // GitHub
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  GitHubWebhookEventType,
  // Vercel (self-defined)
  VercelWebhookEventType,
  PreTransformVercelWebhookPayload,
  // Linear (self-defined)
  LinearWebhookBase,
  LinearWebhookEventType,
  PreTransformLinearIssueWebhook,
  PreTransformLinearCommentWebhook,
  PreTransformLinearProjectWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearProjectUpdateWebhook,
  LinearIssue,
  LinearAttachment,
  LinearComment,
  LinearProject,
  LinearCycle,
  LinearProjectUpdate,
  LinearUser,
  LinearActor,
  LinearLabel,
  // Sentry (self-defined)
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
  SentryIssue,
  SentryErrorEvent,
  SentryActor,
  SentryWebhookEventType,
} from "./pre-transformers";

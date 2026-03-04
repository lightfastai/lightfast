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

// Post-transform validation
export { validatePostTransformEvent, type ValidationResult } from "./post-transformers";

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

// Pre-transformers (types + transform functions)
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
} from "./pre-transformers";

export type {
  // GitHub (from @octokit/webhooks-types)
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

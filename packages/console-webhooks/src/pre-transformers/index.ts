/**
 * Pre-Transform Types & Transformers
 *
 * Each provider file contains:
 * 1. PreTransform type definitions (wire payload shapes as received from the provider)
 * 2. Transform functions that convert PreTransform → PostTransformEvent
 *
 * Type source decisions are documented at the top of each provider file.
 */

// GitHub (Zod schemas in ./schemas/github.ts)
export {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "./github";
export type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  GitHubWebhookEventType,
} from "./github";

// Vercel (self-defined types)
export {
  transformVercelDeployment,
} from "./vercel";
export type {
  VercelWebhookEventType,
  PreTransformVercelWebhookPayload,
} from "./vercel";

// Linear (self-defined types)
export {
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
} from "./linear";
export type {
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
} from "./linear";

// Sentry (self-defined types)
export {
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
} from "./sentry";
export type {
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
  SentryIssue,
  SentryErrorEvent,
  SentryActor,
  SentryWebhookEventType,
} from "./sentry";

// ── Core Types & Helpers ──────────────────────────────────────────────────────
export type { CategoryDef, ActionDef, EventDefinition, SimpleEventDef, ActionEventDef, WebhookDef, OAuthDef, ProviderDefinition, RuntimeConfig } from "./define.js";
export { defineEvent, defineProvider, simpleEvent, actionEvent } from "./define.js";

// ── Post-Transform Event (canonical source of truth) ─────────────────────────
export {
  postTransformEventSchema,
  postTransformActorSchema,
  postTransformReferenceSchema,
} from "./post-transform-event.js";
export type {
  PostTransformEvent,
  PostTransformActor,
  PostTransformReference,
} from "./post-transform-event.js";

// ── Pre-Transform Schemas & Types ─────────────────────────────────────────────
export {
  preTransformGitHubPushEventSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubReleaseEventSchema,
  preTransformGitHubDiscussionEventSchema,
  githubWebhookPayloadSchema,
} from "./schemas/github.js";
export type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  GitHubWebhookPayload,
  GitHubWebhookEventType,
} from "./schemas/github.js";

export {
  preTransformVercelWebhookPayloadSchema,
  vercelWebhookEventTypeSchema,
  vercelWebhookPayloadSchema,
} from "./schemas/vercel.js";
export type {
  PreTransformVercelWebhookPayload,
  VercelWebhookEventType,
  VercelWebhookPayload,
} from "./schemas/vercel.js";

export {
  preTransformLinearIssueWebhookSchema,
  preTransformLinearCommentWebhookSchema,
  preTransformLinearProjectWebhookSchema,
  preTransformLinearCycleWebhookSchema,
  preTransformLinearProjectUpdateWebhookSchema,
  linearWebhookPayloadSchema,
} from "./schemas/linear.js";
export type {
  LinearActor,
  LinearUser,
  LinearLabel,
  LinearAttachment,
  LinearIssue,
  LinearComment,
  LinearProject,
  LinearCycle,
  LinearProjectUpdate,
  LinearWebhookBase,
  LinearWebhookEventType,
  PreTransformLinearIssueWebhook,
  PreTransformLinearCommentWebhook,
  PreTransformLinearProjectWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearProjectUpdateWebhook,
  LinearWebhookPayload,
} from "./schemas/linear.js";

export {
  preTransformSentryIssueWebhookSchema,
  preTransformSentryErrorWebhookSchema,
  preTransformSentryEventAlertWebhookSchema,
  preTransformSentryMetricAlertWebhookSchema,
  sentryWebhookPayloadSchema,
} from "./schemas/sentry.js";
export type {
  SentryActor,
  SentryIssue,
  SentryErrorEvent,
  SentryWebhookEventType,
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
  SentryWebhookPayload,
} from "./schemas/sentry.js";

// ── Transformer Functions ─────────────────────────────────────────────────────
export {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "./transformers/github.js";
export {
  transformVercelDeployment,
} from "./transformers/vercel.js";
export {
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
} from "./transformers/linear.js";
export {
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
} from "./transformers/sentry.js";

// ── Event Registry (derived from provider definitions) ───────────────────────
// EVENT_REGISTRY, EventKey, and ALL_*_EVENTS are now derived from PROVIDERS
// in registry.ts — no hand-maintained event-registry.ts needed.

// ── Config Schemas & Types ────────────────────────────────────────────────────
export {
  githubConfigSchema,
  vercelConfigSchema,
  linearConfigSchema,
  sentryConfigSchema,
  oAuthTokensSchema,
  callbackResultSchema,
  encodeSentryToken,
  decodeSentryToken,
} from "./types.js";
export type {
  GitHubConfig,
  VercelConfig,
  LinearConfig,
  SentryConfig,
  OAuthTokens,
  CallbackResult,
  TransformContext,
  SentryInstallationToken,
} from "./types.js";

// ── Provider Account Info (strict, discriminated union) ───────────────────────
export {
  githubInstallationRawSchema,
  vercelOAuthRawSchema,
  linearOAuthRawSchema,
  sentryOAuthRawSchema,
  githubAccountInfoSchema,
  vercelAccountInfoSchema,
  linearAccountInfoSchema,
  sentryAccountInfoSchema,
} from "./types.js";
export type {
  GitHubInstallationRaw,
  VercelOAuthRaw,
  LinearOAuthRaw,
  SentryOAuthRaw,
  GitHubAccountInfo,
  VercelAccountInfo,
  LinearAccountInfo,
  SentryAccountInfo,
} from "./types.js";

// ── Gateway Service Contracts ─────────────────────────────────────────────────
export {
  webhookReceiptPayloadSchema,
  webhookEnvelopeSchema,
  gatewayConnectionSchema,
  gatewayTokenResultSchema,
} from "./gateway.js";
export type {
  WebhookReceiptPayload,
  WebhookEnvelope,
  GatewayConnection,
  GatewayTokenResult,
} from "./gateway.js";

// ── Crypto & JWT ──────────────────────────────────────────────────────────────
export { computeHmac, timingSafeEqual } from "./crypto.js";
export { createRS256JWT, importPKCS8Key } from "./jwt.js";

// ── Content Utilities ─────────────────────────────────────────────────────────
export {
  sanitizeTitle,
  sanitizeBody,
  sanitizeContent,
  truncateWithEllipsis,
  encodeHtmlEntities,
} from "./sanitize.js";
export {
  validatePostTransformEvent,
  sanitizePostTransformEvent,
  logValidationErrors,
} from "./validation.js";

// ── Dispatch ──────────────────────────────────────────────────────────────────
export { transformWebhookPayload } from "./dispatch.js";

// ── Registry ─────────────────────────────────────────────────────────────────
export {
  PROVIDERS,
  PROVIDER_REGISTRY,
  PROVIDER_ENV_SCHEMAS,
  EVENT_CATEGORIES,
  WEBHOOK_EVENT_TYPES,
  EVENT_REGISTRY,
  ALL_GITHUB_EVENTS,
  ALL_VERCEL_EVENTS,
  ALL_SENTRY_EVENTS,
  ALL_LINEAR_EVENTS,
  getProvider,
  providerAccountInfoSchema,
} from "./registry.js";
export type { ProviderName, SourceType, EventKey, ProviderAccountInfo } from "./registry.js";
export { sourceTypeSchema, PROVIDER_NAMES } from "./registry.js";

// ── Provider Definitions ──────────────────────────────────────────────────────
export { github } from "./providers/github.js";
export { vercel } from "./providers/vercel.js";
export { linear } from "./providers/linear.js";
export { sentry } from "./providers/sentry.js";

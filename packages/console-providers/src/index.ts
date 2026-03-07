// ── Core Types & Helpers ──────────────────────────────────────────────────────
export type { CategoryDef, ActionDef, EventDefinition, SimpleEventDef, ActionEventDef, WebhookDef, OAuthDef, ProviderDefinition, RuntimeConfig, IconDef } from "./define.js";
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
} from "./providers/github/schemas.js";
export type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  GitHubWebhookPayload,
  GitHubWebhookEventType,
} from "./providers/github/schemas.js";

export {
  preTransformVercelWebhookPayloadSchema,
  vercelWebhookEventTypeSchema,
  vercelWebhookPayloadSchema,
} from "./providers/vercel/schemas.js";
export type {
  PreTransformVercelWebhookPayload,
  VercelWebhookEventType,
  VercelWebhookPayload,
} from "./providers/vercel/schemas.js";

export {
  preTransformLinearIssueWebhookSchema,
  preTransformLinearCommentWebhookSchema,
  preTransformLinearProjectWebhookSchema,
  preTransformLinearCycleWebhookSchema,
  preTransformLinearProjectUpdateWebhookSchema,
  linearWebhookPayloadSchema,
} from "./providers/linear/schemas.js";
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
} from "./providers/linear/schemas.js";

export {
  preTransformSentryIssueWebhookSchema,
  preTransformSentryErrorWebhookSchema,
  preTransformSentryEventAlertWebhookSchema,
  preTransformSentryMetricAlertWebhookSchema,
  sentryWebhookPayloadSchema,
} from "./providers/sentry/schemas.js";
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
} from "./providers/sentry/schemas.js";

// ── Transformer Functions ─────────────────────────────────────────────────────
export {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "./providers/github/transformers.js";
export {
  transformVercelDeployment,
} from "./providers/vercel/transformers.js";
export {
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
} from "./providers/linear/transformers.js";
export {
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
} from "./providers/sentry/transformers.js";

// ── Event Registry (derived from provider definitions) ───────────────────────
// EVENT_REGISTRY, EventKey, and ALL_*_EVENTS are now derived from PROVIDERS
// in registry.ts — no hand-maintained event-registry.ts needed.

// ── Shared OAuth & Callback Contracts ─────────────────────────────────────────
export {
  oAuthTokensSchema,
  callbackResultSchema,
} from "./types.js";
export type {
  OAuthTokens,
  CallbackResult,
  TransformContext,
} from "./types.js";

// ── GitHub ────────────────────────────────────────────────────────────────────
export {
  githubConfigSchema,
  githubInstallationRawSchema,
  githubAccountInfoSchema,
  githubOAuthResponseSchema,
} from "./providers/github/auth.js";
export type {
  GitHubConfig,
  GitHubInstallationRaw,
  GitHubAccountInfo,
} from "./providers/github/auth.js";

// ── Vercel ────────────────────────────────────────────────────────────────────
export {
  vercelConfigSchema,
  vercelOAuthRawSchema,
  vercelAccountInfoSchema,
  vercelOAuthResponseSchema,
} from "./providers/vercel/auth.js";
export type {
  VercelConfig,
  VercelOAuthRaw,
  VercelAccountInfo,
} from "./providers/vercel/auth.js";

// ── Linear ────────────────────────────────────────────────────────────────────
export {
  linearConfigSchema,
  linearOAuthRawSchema,
  linearAccountInfoSchema,
  linearOAuthResponseSchema,
} from "./providers/linear/auth.js";
export type {
  LinearConfig,
  LinearOAuthRaw,
  LinearAccountInfo,
} from "./providers/linear/auth.js";

// ── Sentry ────────────────────────────────────────────────────────────────────
export {
  sentryConfigSchema,
  sentryOAuthRawSchema,
  sentryAccountInfoSchema,
  sentryOAuthResponseSchema,
  encodeSentryToken,
  decodeSentryToken,
} from "./providers/sentry/auth.js";
export type {
  SentryConfig,
  SentryOAuthRaw,
  SentryAccountInfo,
  SentryInstallationToken,
} from "./providers/sentry/auth.js";

// ── Gateway Service Contracts ─────────────────────────────────────────────────
export {
  serviceAuthWebhookBodySchema,
  webhookReceiptPayloadSchema,
  webhookEnvelopeSchema,
  gatewayConnectionSchema,
  gatewayTokenResultSchema,
} from "./gateway.js";
export type {
  ServiceAuthWebhookBody,
  WebhookReceiptPayload,
  WebhookEnvelope,
  GatewayConnection,
  GatewayTokenResult,
} from "./gateway.js";

// ── Crypto & JWT ──────────────────────────────────────────────────────────────
export { computeHmac, timingSafeEqual, timingSafeStringEqual, sha256Hex } from "./crypto.js";
export { createRS256JWT } from "./jwt.js";

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

// ── Event Normalization ───────────────────────────────────────────────────────
export { getBaseEventType, deriveObservationType } from "./event-normalization.js";

// ── Dispatch ──────────────────────────────────────────────────────────────────
export { transformWebhookPayload } from "./dispatch.js";

// ── Registry ─────────────────────────────────────────────────────────────────
export {
  PROVIDERS,
  PROVIDER_ENV_SCHEMAS,
  PROVIDER_ENVS,
  EVENT_REGISTRY,
  getProvider,
  getDefaultSyncEvents,
  providerAccountInfoSchema,
  sourceTypeSchema,
} from "./registry.js";
export type {
  ProviderName,
  SourceType,
  EventKey,
  EventRegistryEntry,
  ProviderAccountInfo,
} from "./registry.js";

// ── Provider Definitions ──────────────────────────────────────────────────────
export { github } from "./providers/github/index.js";
export { vercel } from "./providers/vercel/index.js";
export { linear } from "./providers/linear/index.js";
export { sentry } from "./providers/sentry/index.js";

// ── Provider Config (JSONB shapes for workspace_integrations.provider_config) ─
export {
  providerConfigSchema,
} from "./registry.js";
export type {
  ProviderConfig,
} from "./registry.js";
export {
  githubProviderConfigSchema,
} from "./providers/github/auth.js";
export type {
  GithubProviderConfig,
} from "./providers/github/auth.js";
export {
  vercelProviderConfigSchema,
} from "./providers/vercel/auth.js";
export type {
  VercelProviderConfig,
} from "./providers/vercel/auth.js";
export {
  sentryProviderConfigSchema,
} from "./providers/sentry/auth.js";
export type {
  SentryProviderConfig,
} from "./providers/sentry/auth.js";
export {
  linearProviderConfigSchema,
} from "./providers/linear/auth.js";
export type {
  LinearProviderConfig,
} from "./providers/linear/auth.js";

// ── Display Metadata (re-exported for server consumers) ─────────────────────
export {
  PROVIDER_DISPLAY,
  PROVIDER_SLUGS,
  SOURCE_TYPE_OPTIONS,
} from "./display.js";
export type { ProviderSlug } from "./display.js";

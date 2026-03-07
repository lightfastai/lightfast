// ── Core Types & Helpers ──────────────────────────────────────────────────────
export type { CategoryDef, ActionDef, EventDefinition, SimpleEventDef, ActionEventDef, WebhookDef, OAuthDef, ProviderDefinition, RuntimeConfig, IconDef } from "./define";
export { defineEvent, defineProvider, simpleEvent, actionEvent } from "./define";

// ── Post-Transform Event (canonical source of truth) ─────────────────────────
export {
  postTransformEventSchema,
  postTransformActorSchema,
  postTransformReferenceSchema,
} from "./post-transform-event";
export type {
  PostTransformEvent,
  PostTransformActor,
  PostTransformReference,
} from "./post-transform-event";

// ── Pre-Transform Schemas & Types ─────────────────────────────────────────────
export {
  preTransformGitHubPushEventSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubReleaseEventSchema,
  preTransformGitHubDiscussionEventSchema,
  githubWebhookPayloadSchema,
} from "./providers/github/schemas";
export type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  GitHubWebhookPayload,
  GitHubWebhookEventType,
} from "./providers/github/schemas";

export {
  preTransformVercelWebhookPayloadSchema,
  vercelWebhookEventTypeSchema,
  vercelWebhookPayloadSchema,
} from "./providers/vercel/schemas";
export type {
  PreTransformVercelWebhookPayload,
  VercelWebhookEventType,
  VercelWebhookPayload,
} from "./providers/vercel/schemas";

export {
  preTransformLinearIssueWebhookSchema,
  preTransformLinearCommentWebhookSchema,
  preTransformLinearProjectWebhookSchema,
  preTransformLinearCycleWebhookSchema,
  preTransformLinearProjectUpdateWebhookSchema,
  linearWebhookPayloadSchema,
} from "./providers/linear/schemas";
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
} from "./providers/linear/schemas";

export {
  preTransformSentryIssueWebhookSchema,
  preTransformSentryErrorWebhookSchema,
  preTransformSentryEventAlertWebhookSchema,
  preTransformSentryMetricAlertWebhookSchema,
  sentryWebhookPayloadSchema,
} from "./providers/sentry/schemas";
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
} from "./providers/sentry/schemas";

// ── Transformer Functions ─────────────────────────────────────────────────────
export {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "./providers/github/transformers";
export {
  transformVercelDeployment,
} from "./providers/vercel/transformers";
export {
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
} from "./providers/linear/transformers";
export {
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
} from "./providers/sentry/transformers";

// ── Event Registry (derived from provider definitions) ───────────────────────
// EVENT_REGISTRY, EventKey, and ALL_*_EVENTS are now derived from PROVIDERS
// in registry.ts — no hand-maintained event-registry.ts needed.

// ── Shared OAuth & Callback Contracts ─────────────────────────────────────────
export {
  oAuthTokensSchema,
  callbackResultSchema,
} from "./types";
export type {
  OAuthTokens,
  CallbackResult,
  TransformContext,
} from "./types";

// ── GitHub ────────────────────────────────────────────────────────────────────
export {
  githubConfigSchema,
  githubInstallationRawSchema,
  githubAccountInfoSchema,
  githubOAuthResponseSchema,
} from "./providers/github/auth";
export type {
  GitHubConfig,
  GitHubInstallationRaw,
  GitHubAccountInfo,
} from "./providers/github/auth";

// ── Vercel ────────────────────────────────────────────────────────────────────
export {
  vercelConfigSchema,
  vercelOAuthRawSchema,
  vercelAccountInfoSchema,
  vercelOAuthResponseSchema,
} from "./providers/vercel/auth";
export type {
  VercelConfig,
  VercelOAuthRaw,
  VercelAccountInfo,
} from "./providers/vercel/auth";

// ── Linear ────────────────────────────────────────────────────────────────────
export {
  linearConfigSchema,
  linearOAuthRawSchema,
  linearAccountInfoSchema,
  linearOAuthResponseSchema,
} from "./providers/linear/auth";
export type {
  LinearConfig,
  LinearOAuthRaw,
  LinearAccountInfo,
} from "./providers/linear/auth";

// ── Sentry ────────────────────────────────────────────────────────────────────
export {
  sentryConfigSchema,
  sentryOAuthRawSchema,
  sentryAccountInfoSchema,
  sentryOAuthResponseSchema,
  encodeSentryToken,
  decodeSentryToken,
} from "./providers/sentry/auth";
export type {
  SentryConfig,
  SentryOAuthRaw,
  SentryAccountInfo,
  SentryInstallationToken,
} from "./providers/sentry/auth";

// ── Gateway Service Contracts ─────────────────────────────────────────────────
export {
  serviceAuthWebhookBodySchema,
  webhookReceiptPayloadSchema,
  webhookEnvelopeSchema,
  gatewayConnectionSchema,
  gatewayTokenResultSchema,
} from "./gateway";
export type {
  ServiceAuthWebhookBody,
  WebhookReceiptPayload,
  WebhookEnvelope,
  GatewayConnection,
  GatewayTokenResult,
} from "./gateway";

// ── Crypto & JWT ──────────────────────────────────────────────────────────────
export { computeHmac, timingSafeEqual, timingSafeStringEqual, sha256Hex } from "./crypto";
export { createRS256JWT } from "./jwt";

// ── Content Utilities ─────────────────────────────────────────────────────────
export {
  sanitizeTitle,
  sanitizeBody,
  sanitizeContent,
  truncateWithEllipsis,
  encodeHtmlEntities,
} from "./sanitize";
export {
  validatePostTransformEvent,
  sanitizePostTransformEvent,
  logValidationErrors,
} from "./validation";

// ── Event Normalization ───────────────────────────────────────────────────────
export { getBaseEventType, deriveObservationType } from "./event-normalization";

// ── Dispatch ──────────────────────────────────────────────────────────────────
export { transformWebhookPayload } from "./dispatch";

// ── Registry ─────────────────────────────────────────────────────────────────
export {
  PROVIDERS,
  PROVIDER_ENVS,
  EVENT_REGISTRY,
  getProvider,
  getDefaultSyncEvents,
  providerAccountInfoSchema,
  sourceTypeSchema,
} from "./registry";
export type {
  ProviderName,
  SourceType,
  EventKey,
  EventRegistryEntry,
  ProviderAccountInfo,
} from "./registry";

// ── Provider Definitions ──────────────────────────────────────────────────────
export { github } from "./providers/github/index";
export { vercel } from "./providers/vercel/index";
export { linear } from "./providers/linear/index";
export { sentry } from "./providers/sentry/index";

// ── Provider Config (JSONB shapes for workspace_integrations.provider_config) ─
export {
  providerConfigSchema,
} from "./registry";
export type {
  ProviderConfig,
} from "./registry";
export {
  githubProviderConfigSchema,
} from "./providers/github/auth";
export type {
  GithubProviderConfig,
} from "./providers/github/auth";
export {
  vercelProviderConfigSchema,
} from "./providers/vercel/auth";
export type {
  VercelProviderConfig,
} from "./providers/vercel/auth";
export {
  sentryProviderConfigSchema,
} from "./providers/sentry/auth";
export type {
  SentryProviderConfig,
} from "./providers/sentry/auth";
export {
  linearProviderConfigSchema,
} from "./providers/linear/auth";
export type {
  LinearProviderConfig,
} from "./providers/linear/auth";

// ── Display Metadata (re-exported for server consumers) ─────────────────────
export {
  PROVIDER_DISPLAY,
  PROVIDER_SLUGS,
  SOURCE_TYPE_OPTIONS,
} from "./display";
export type { ProviderSlug } from "./display";

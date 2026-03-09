// ── Core Types & Helpers ──────────────────────────────────────────────────────
export type {
  ActionDef,
  ActionEventDef,
  CategoryDef,
  EventDefinition,
  IconDef,
  OAuthDef,
  ProviderDefinition,
  RuntimeConfig,
  SimpleEventDef,
  WebhookDef,
} from "./define";
export {
  actionEvent,
  defineEvent,
  defineProvider,
  simpleEvent,
} from "./define";
export type {
  PostTransformActor,
  PostTransformEvent,
  PostTransformReference,
} from "./post-transform-event";
// ── Post-Transform Event (canonical source of truth) ─────────────────────────
export {
  postTransformActorSchema,
  postTransformEventSchema,
  postTransformReferenceSchema,
} from "./post-transform-event";
export type {
  GitHubWebhookEventType,
  GitHubWebhookPayload,
  PreTransformGitHubDiscussionEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubPushEvent,
  PreTransformGitHubReleaseEvent,
} from "./providers/github/schemas";
// ── Pre-Transform Schemas & Types ─────────────────────────────────────────────
export {
  githubWebhookPayloadSchema,
  preTransformGitHubDiscussionEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubPushEventSchema,
  preTransformGitHubReleaseEventSchema,
} from "./providers/github/schemas";
// ── Transformer Functions ─────────────────────────────────────────────────────
export {
  transformGitHubDiscussion,
  transformGitHubIssue,
  transformGitHubPullRequest,
  transformGitHubPush,
  transformGitHubRelease,
} from "./providers/github/transformers";
export type {
  LinearActor,
  LinearAttachment,
  LinearComment,
  LinearCycle,
  LinearIssue,
  LinearLabel,
  LinearProject,
  LinearProjectUpdate,
  LinearUser,
  LinearWebhookBase,
  LinearWebhookEventType,
  LinearWebhookPayload,
  PreTransformLinearCommentWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearIssueWebhook,
  PreTransformLinearProjectUpdateWebhook,
  PreTransformLinearProjectWebhook,
} from "./providers/linear/schemas";

export {
  linearWebhookPayloadSchema,
  preTransformLinearCommentWebhookSchema,
  preTransformLinearCycleWebhookSchema,
  preTransformLinearIssueWebhookSchema,
  preTransformLinearProjectUpdateWebhookSchema,
  preTransformLinearProjectWebhookSchema,
} from "./providers/linear/schemas";
export {
  transformLinearComment,
  transformLinearCycle,
  transformLinearIssue,
  transformLinearProject,
  transformLinearProjectUpdate,
} from "./providers/linear/transformers";
export type {
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryIssueWebhook,
  PreTransformSentryMetricAlertWebhook,
  SentryActor,
  SentryErrorEvent,
  SentryIssue,
  SentryWebhookEventType,
  SentryWebhookPayload,
} from "./providers/sentry/schemas";
export {
  preTransformSentryErrorWebhookSchema,
  preTransformSentryEventAlertWebhookSchema,
  preTransformSentryIssueWebhookSchema,
  preTransformSentryMetricAlertWebhookSchema,
  sentryWebhookPayloadSchema,
} from "./providers/sentry/schemas";
export {
  transformSentryError,
  transformSentryEventAlert,
  transformSentryIssue,
  transformSentryMetricAlert,
} from "./providers/sentry/transformers";
export type {
  PreTransformVercelWebhookPayload,
  VercelWebhookEventType,
  VercelWebhookPayload,
} from "./providers/vercel/schemas";
export {
  preTransformVercelWebhookPayloadSchema,
  vercelWebhookEventTypeSchema,
  vercelWebhookPayloadSchema,
} from "./providers/vercel/schemas";
export { transformVercelDeployment } from "./providers/vercel/transformers";

// ── Event Registry (derived from provider definitions) ───────────────────────
// EVENT_REGISTRY, EventKey, and ALL_*_EVENTS are now derived from PROVIDERS
// in registry.ts — no hand-maintained event-registry.ts needed.

// ── Crypto & JWT ──────────────────────────────────────────────────────────────
export {
  computeHmac,
  sha256Hex,
  timingSafeEqual,
  timingSafeStringEqual,
} from "./crypto";
// ── Dispatch ──────────────────────────────────────────────────────────────────
export { transformWebhookPayload } from "./dispatch";
export type { ProviderSlug } from "./display";
// ── Display Metadata (re-exported for server consumers) ─────────────────────
export {
  PROVIDER_DISPLAY,
  PROVIDER_SLUGS,
  SOURCE_TYPE_OPTIONS,
} from "./display";
// ── Event Normalization ───────────────────────────────────────────────────────
export { deriveObservationType, getBaseEventType } from "./event-normalization";
export type {
  GatewayConnection,
  GatewayTokenResult,
  ServiceAuthWebhookBody,
  WebhookEnvelope,
  WebhookReceiptPayload,
} from "./gateway";
// ── Gateway Service Contracts ─────────────────────────────────────────────────
export {
  gatewayConnectionSchema,
  gatewayTokenResultSchema,
  serviceAuthWebhookBodySchema,
  webhookEnvelopeSchema,
  webhookReceiptPayloadSchema,
} from "./gateway";
export { createRS256JWT } from "./jwt";
export type {
  GitHubAccountInfo,
  GitHubConfig,
  GitHubInstallationRaw,
  GithubProviderConfig,
} from "./providers/github/auth";
// ── GitHub ────────────────────────────────────────────────────────────────────
export {
  githubAccountInfoSchema,
  githubConfigSchema,
  githubInstallationRawSchema,
  githubOAuthResponseSchema,
  githubProviderConfigSchema,
} from "./providers/github/auth";
// ── Provider Definitions ──────────────────────────────────────────────────────
export { github } from "./providers/github/index";
export type {
  LinearAccountInfo,
  LinearConfig,
  LinearOAuthRaw,
  LinearProviderConfig,
} from "./providers/linear/auth";
// ── Linear ────────────────────────────────────────────────────────────────────
export {
  linearAccountInfoSchema,
  linearConfigSchema,
  linearOAuthRawSchema,
  linearOAuthResponseSchema,
  linearProviderConfigSchema,
} from "./providers/linear/auth";
export { linear } from "./providers/linear/index";
export type {
  SentryAccountInfo,
  SentryConfig,
  SentryInstallationToken,
  SentryOAuthRaw,
  SentryProviderConfig,
} from "./providers/sentry/auth";
// ── Sentry ────────────────────────────────────────────────────────────────────
export {
  decodeSentryToken,
  encodeSentryToken,
  sentryAccountInfoSchema,
  sentryConfigSchema,
  sentryOAuthRawSchema,
  sentryOAuthResponseSchema,
  sentryProviderConfigSchema,
} from "./providers/sentry/auth";
export { sentry } from "./providers/sentry/index";
export type {
  VercelAccountInfo,
  VercelConfig,
  VercelOAuthRaw,
  VercelProviderConfig,
} from "./providers/vercel/auth";
// ── Vercel ────────────────────────────────────────────────────────────────────
export {
  vercelAccountInfoSchema,
  vercelConfigSchema,
  vercelOAuthRawSchema,
  vercelOAuthResponseSchema,
  vercelProviderConfigSchema,
} from "./providers/vercel/auth";
export { vercel } from "./providers/vercel/index";
export type {
  EventKey,
  EventRegistryEntry,
  ProviderAccountInfo,
  ProviderConfig,
  ProviderName,
  SourceType,
} from "./registry";
// ── Registry ─────────────────────────────────────────────────────────────────
// ── Provider Config (JSONB shapes for workspace_integrations.provider_config) ─
export {
  EVENT_REGISTRY,
  getDefaultSyncEvents,
  getProvider,
  PROVIDER_ENVS,
  PROVIDERS,
  providerAccountInfoSchema,
  providerConfigSchema,
  sourceTypeSchema,
} from "./registry";
// ── Content Utilities ─────────────────────────────────────────────────────────
export {
  encodeHtmlEntities,
  sanitizeBody,
  sanitizeContent,
  sanitizeTitle,
  truncateWithEllipsis,
} from "./sanitize";
export type {
  CallbackResult,
  OAuthTokens,
  TransformContext,
} from "./types";
// ── Shared OAuth & Callback Contracts ─────────────────────────────────────────
export {
  callbackResultSchema,
  oAuthTokensSchema,
} from "./types";
export {
  logValidationErrors,
  sanitizePostTransformEvent,
  validatePostTransformEvent,
} from "./validation";

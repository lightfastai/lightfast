import "server-only";

// ── Core Types & Helpers ──────────────────────────────────────────────────────
export type {
  ActionDef,
  ActionEventDef,
  ApiEndpoint,
  ApiKeyDef,
  ApiProvider,
  AppTokenDef,
  AuthDef,
  AuthKind,
  BackfillContext,
  BackfillDef,
  BackfillDepth,
  BackfillEntityHandler,
  BackfillWebhookEvent,
  CategoryDef,
  ConnectionStatus,
  EventDefinition,
  HealthCheckDef,
  HmacScheme,
  IconDef,
  InstallationMode,
  NormalizedInstallation,
  NormalizedResource,
  OAuthDef,
  ProviderApi,
  ProviderDefinition,
  ProviderKind,
  ProxyExecuteRequest,
  ProxyExecuteResponse,
  RateLimit,
  ResourcePickerDef,
  ResourcePickerExecuteApiFn,
  RuntimeConfig,
  SignatureScheme,
  SimpleEventDef,
  WebhookDef,
  WebhookProvider,
} from "./define";
export {
  actionDefSchema,
  actionEvent,
  authKindSchema,
  BACKFILL_DEPTH_OPTIONS,
  backfillContextSchema,
  backfillDepthSchema,
  backfillWebhookEventSchema,
  categoryDefSchema,
  connectionStatusSchema,
  defineApiProvider,
  defineWebhookProvider,
  deriveVerifySignature,
  hmac,
  iconDefSchema,
  isApiProvider,
  isAppTokenAuth,
  isWebhookProvider,
  providerKindSchema,
  proxyExecuteRequestSchema,
  proxyExecuteResponseSchema,
  rateLimitSchema,
  runtimeConfigSchema,
  signatureSchemeSchema,
  simpleEvent,
  typedEntityHandler,
} from "./define";
export type {
  EntityRef,
  EntityRelation,
  PostTransformEvent,
} from "./post-transform-event";
// ── Post-Transform Event (canonical source of truth) ─────────────────────────
export {
  entityRefSchema,
  entityRelationSchema,
  postTransformEventSchema,
} from "./post-transform-event";
// GitHub API
export {
  githubIssueSchema,
  githubPullRequestSchema,
  githubUserSchema,
  parseGitHubRateLimit,
} from "./providers/github/api";
export type {
  GitHubWebhookEventType,
  GitHubWebhookPayload,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubPullRequestEvent,
} from "./providers/github/schemas";
// ── Pre-Transform Schemas & Types ─────────────────────────────────────────────
export {
  githubWebhookEventTypeSchema,
  githubWebhookPayloadSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubPullRequestEventSchema,
} from "./providers/github/schemas";
// ── Transformer Functions ─────────────────────────────────────────────────────
export {
  transformGitHubIssue,
  transformGitHubPullRequest,
} from "./providers/github/transformers";
// Linear API
export {
  graphqlResponseSchema,
  parseLinearRateLimit,
} from "./providers/linear/api";
export type {
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
  linearWebhookEventTypeSchema,
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
// Sentry API
export { parseSentryRateLimit } from "./providers/sentry/api";
export type {
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryIssueWebhook,
  PreTransformSentryMetricAlertWebhook,
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
  sentryWebhookEventTypeSchema,
  sentryWebhookPayloadSchema,
} from "./providers/sentry/schemas";
export {
  transformSentryError,
  transformSentryEventAlert,
  transformSentryIssue,
  transformSentryMetricAlert,
} from "./providers/sentry/transformers";
// Vercel API
export {
  parseVercelRateLimit,
  vercelDeploymentSchema,
  vercelDeploymentsResponseSchema,
} from "./providers/vercel/api";
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
export type { EdgeRule } from "./types";

// ── Event Registry (derived from provider definitions) ───────────────────────
// EVENT_REGISTRY, EventKey, and ALL_*_EVENTS are now derived from PROVIDERS
// in registry.ts — no hand-maintained event-registry.ts needed.

// ── Backfill Orchestration Contracts ──────────────────────────────────────────
export type {
  BackfillEstimatePayload,
  BackfillRunReadRecord,
  BackfillRunRecord,
  BackfillTriggerPayload,
  GwInstallationBackfillConfig,
} from "./backfill-contracts";
export {
  BACKFILL_TERMINAL_STATUSES,
  backfillEstimatePayload,
  backfillRunReadRecord,
  backfillRunRecord,
  backfillTerminalStatusSchema,
  backfillTriggerPayload,
  gwInstallationBackfillConfigSchema,
} from "./backfill-contracts";
// ── Crypto & JWT ──────────────────────────────────────────────────────────────
export {
  computeHmac,
  sha256Hex,
  timingSafeEqual,
  timingSafeStringEqual,
} from "./crypto";
// ── Dispatch ──────────────────────────────────────────────────────────────────
export { transformWebhookPayload } from "./dispatch";
export type { ProviderDisplayEntry, ProviderSlug } from "./display";
// ── Display Metadata (re-exported for server consumers) ─────────────────────
export {
  PROVIDER_DISPLAY,
  providerDisplayEntrySchema,
  providerSlugSchema,
} from "./display";
// ── Event Normalization ───────────────────────────────────────────────────────
export { deriveObservationType, getBaseEventType } from "./event-normalization";
// ── Gateway API Response Shapes ───────────────────────────────────────────────
export type {
  GatewayConnection,
  GatewayTokenResult,
  ProxyEndpointsResponse,
} from "./gateway";
export {
  gatewayConnectionSchema,
  gatewayTokenResultSchema,
  proxyEndpointsResponseSchema,
} from "./gateway";
export { createRS256JWT } from "./jwt";
// ── Provider Definitions ──────────────────────────────────────────────────────
export type {
  ApolloAccountInfo,
  ApolloConfig,
  ApolloProviderConfig,
} from "./providers/apollo/auth";
// ── Apollo ────────────────────────────────────────────────────────────────────
export {
  apolloAccountInfoSchema,
  apolloConfigSchema,
  apolloProviderConfigSchema,
} from "./providers/apollo/auth";
export { apollo } from "./providers/apollo/index";
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
  sentryInstallationTokenSchema,
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
  AccountInfoFor,
  AnyEndpointKey,
  AuthDefFor,
  EndpointKey,
  EndpointKeysFor,
  EventKey,
  EventKeysFor,
  EventRegistryEntry,
  HasBuildAuth,
  PathParamsFor,
  ProviderAccountInfo,
  ProviderConfig,
  ProviderKey,
  ProviderName,
  ProviderShape,
  ResponseDataFor,
  SourceType,
  TypedProxyRequest,
} from "./registry";
// ── Registry ─────────────────────────────────────────────────────────────────
// ── Provider Config (JSONB shapes for workspace_integrations.provider_config) ─
export {
  EVENT_REGISTRY,
  eventKeySchema,
  eventRegistryEntrySchema,
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
  BaseProviderAccountInfo,
  CallbackResult,
  OAuthTokens,
  TransformContext,
} from "./types";
// ── Shared OAuth & Callback Contracts ─────────────────────────────────────────
export {
  baseProviderAccountInfoSchema,
  callbackResultSchema,
  oAuthTokensSchema,
  transformContextSchema,
} from "./types";
export {
  logValidationErrors,
  sanitizePostTransformEvent,
  validatePostTransformEvent,
} from "./validation";
// ── Relay ↔ Console Webhook Pipeline Wire Contracts ───────────────────────────
export type {
  ServiceAuthWebhookBody,
  WebhookEnvelope,
  WebhookReceiptPayload,
} from "./wire";
export {
  serviceAuthWebhookBodySchema,
  webhookEnvelopeSchema,
  webhookReceiptPayloadSchema,
} from "./wire";

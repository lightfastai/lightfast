import "server-only";

// ── Display Metadata (re-exported for server consumers) ─────────────────────
export type { ProviderDisplayEntry, ProviderSlug } from "./client/display";
export {
  PROVIDER_DISPLAY,
  providerDisplayEntrySchema,
  providerSlugSchema,
} from "./client/display";
// ── Contracts (cross-service Zod schemas) ─────────────────────────────────────
export * from "./contracts/backfill";
export * from "./contracts/event";
export * from "./contracts/gateway";
export * from "./contracts/wire";
// ── Factory Functions ─────────────────────────────────────────────────────────
export {
  defineApiProvider,
  defineManagedProvider,
  defineWebhookProvider,
} from "./factory/index";
// ── Provider Type System ──────────────────────────────────────────────────────
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
  Ed25519Scheme,
  EventDefinition,
  HealthCheckDef,
  HmacScheme,
  IconDef,
  InboundWebhookDef,
  InstallationMode,
  ManagedProvider,
  ManagedWebhookDef,
  NormalizedInstallation,
  NormalizedResource,
  OAuthDef,
  ProviderApi,
  ProviderDefinition,
  ProviderKind,
  ProxyExecuteRequest,
  ProxyExecuteResponse,
  ProxyResolvedResource,
  RateLimit,
  ResourcePickerDef,
  ResourcePickerExecuteApiFn,
  RuntimeConfig,
  SignatureScheme,
  SimpleEventDef,
  VerifyFn,
  WebhookDef,
  WebhookProvider,
  WebhookSetupDef,
  WebhookSetupState,
} from "./provider/index";
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
  ed25519,
  hasInboundWebhooks,
  hmac,
  iconDefSchema,
  isApiProvider,
  isAppTokenAuth,
  isManagedProvider,
  isWebhookProvider,
  providerKindSchema,
  proxyExecuteRequestSchema,
  proxyExecuteResponseSchema,
  rateLimitSchema,
  runtimeConfigSchema,
  signatureSchemeSchema,
  simpleEvent,
  typedEntityHandler,
  webhookSetupStateSchema,
} from "./provider/index";
// ── Shared OAuth & Callback Contracts ─────────────────────────────────────────
export type {
  BaseProviderAccountInfo,
  CallbackResult,
  EdgeRule,
  OAuthTokens,
  TransformContext,
} from "./provider/primitives";
export {
  baseProviderAccountInfoSchema,
  callbackResultSchema,
  oAuthTokensSchema,
  transformContextSchema,
} from "./provider/primitives";
// ── Apollo ────────────────────────────────────────────────────────────────────
export type {
  ApolloAccountInfo,
  ApolloConfig,
  ApolloProviderConfig,
} from "./providers/apollo/auth";
export {
  apolloAccountInfoSchema,
  apolloConfigSchema,
  apolloProviderConfigSchema,
} from "./providers/apollo/auth";
export { apollo } from "./providers/apollo/index";
// ── GitHub ────────────────────────────────────────────────────────────────────
export {
  githubIssueSchema,
  githubPullRequestSchema,
  githubUserSchema,
  parseGitHubRateLimit,
} from "./providers/github/api";
export type {
  GitHubAccountInfo,
  GitHubConfig,
  GitHubInstallationRaw,
  GithubProviderConfig,
} from "./providers/github/auth";
export {
  githubAccountInfoSchema,
  githubConfigSchema,
  githubInstallationRawSchema,
  githubOAuthResponseSchema,
  githubProviderConfigSchema,
} from "./providers/github/auth";
export { github } from "./providers/github/index";
export type {
  GitHubWebhookEventType,
  GitHubWebhookPayload,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubPullRequestEvent,
} from "./providers/github/schemas";
export {
  githubWebhookEventTypeSchema,
  githubWebhookPayloadSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubPullRequestEventSchema,
} from "./providers/github/schemas";
export {
  transformGitHubIssue,
  transformGitHubPullRequest,
} from "./providers/github/transformers";
// ── Linear ────────────────────────────────────────────────────────────────────
export {
  graphqlResponseSchema,
  parseLinearRateLimit,
} from "./providers/linear/api";
export type {
  LinearAccountInfo,
  LinearConfig,
  LinearOAuthRaw,
  LinearProviderConfig,
} from "./providers/linear/auth";
export {
  linearAccountInfoSchema,
  linearConfigSchema,
  linearOAuthRawSchema,
  linearOAuthResponseSchema,
  linearProviderConfigSchema,
} from "./providers/linear/auth";
export { linear } from "./providers/linear/index";
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
// ── Sentry ────────────────────────────────────────────────────────────────────
export { parseSentryRateLimit } from "./providers/sentry/api";
export type {
  SentryAccountInfo,
  SentryConfig,
  SentryInstallationToken,
  SentryOAuthRaw,
  SentryProviderConfig,
} from "./providers/sentry/auth";
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
// ── Vercel ────────────────────────────────────────────────────────────────────
export {
  parseVercelRateLimit,
  vercelDeploymentSchema,
  vercelDeploymentsResponseSchema,
} from "./providers/vercel/api";
export type {
  VercelAccountInfo,
  VercelConfig,
  VercelOAuthRaw,
  VercelProviderConfig,
} from "./providers/vercel/auth";
export {
  vercelAccountInfoSchema,
  vercelConfigSchema,
  vercelOAuthRawSchema,
  vercelOAuthResponseSchema,
  vercelProviderConfigSchema,
} from "./providers/vercel/auth";
export { vercel } from "./providers/vercel/index";
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
// ── Registry ─────────────────────────────────────────────────────────────────
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
} from "./registry";
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
export {
  computeHmac,
  sha256Hex,
  timingSafeEqual,
  timingSafeStringEqual,
} from "./runtime/crypto";
export { transformWebhookPayload } from "./runtime/dispatch";
export { deriveObservationType, getBaseEventType } from "./runtime/event-norm";
export { createRS256JWT } from "./runtime/jwt";
export {
  encodeHtmlEntities,
  sanitizeBody,
  sanitizeContent,
  sanitizeTitle,
  truncateWithEllipsis,
} from "./runtime/sanitize";
export {
  logValidationErrors,
  sanitizePostTransformEvent,
  validatePostTransformEvent,
} from "./runtime/validation";
// ── Runtime Utilities ─────────────────────────────────────────────────────────
export { deriveVerifySignature } from "./runtime/verify/index";

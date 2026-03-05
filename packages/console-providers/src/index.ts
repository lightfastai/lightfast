// ── Core Types & Helpers ──────────────────────────────────────────────────────
export type { CategoryDef, EventDefinition, WebhookDef, OAuthDef, ProviderDefinition, RuntimeConfig } from "./define.js";
export { defineEvent, defineProvider } from "./define.js";

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
  getProvider,
  getEventWeight,
} from "./registry.js";
export type { ProviderName } from "./registry.js";

// ── Provider Definitions ──────────────────────────────────────────────────────
export { github } from "./providers/github.js";
export { vercel } from "./providers/vercel.js";
export { linear } from "./providers/linear.js";
export { sentry } from "./providers/sentry.js";

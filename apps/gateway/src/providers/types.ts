import type { SourceType } from "@repo/console-validation";
import type {
  GitHubWebhookPayload as GH,
  VercelWebhookPayload as VC,
  LinearWebhookPayload as LN,
  SentryWebhookPayload as SN,
  WebhookPayload,
} from "./schemas";
import type { GitHubProvider } from "./github";
import type { VercelProvider } from "./vercel";
import type { LinearProvider } from "./linear";
import type { SentryProvider } from "./sentry";

// Re-export for backward compatibility (lib/keys.ts, workflows/types.ts)
export type { SourceType };

// Re-export schema types for consumer convenience
export type {
  GitHubWebhookPayload,
  VercelWebhookPayload,
  LinearWebhookPayload,
  SentryWebhookPayload,
  WebhookPayload,
  SentryInstallationToken,
} from "./schemas";

// ── Provider Name (subset of SourceType with actual implementations) ──

export type ProviderName = "github" | "vercel" | "linear" | "sentry";

// ── Per-Provider Auth Options ──

export interface GitHubAuthOptions {
  redirectPath?: string;
}

export interface LinearAuthOptions {
  scopes?: string[];
}

/**
 * Union of all provider auth options.
 * Generic callers pass this; typed callers use per-provider types.
 */
export type ProviderOptions = GitHubAuthOptions | LinearAuthOptions;

/** Type map: narrow auth options per provider name */
export type AuthOptionsFor<N extends ProviderName> = N extends "github"
  ? GitHubAuthOptions
  : N extends "linear"
    ? LinearAuthOptions
    : Record<string, never>;

// ── OAuth Tokens (unchanged) ──

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  raw: Record<string, unknown>;
}

// ── Webhook Payload Type Map ──

export type WebhookPayloadFor<N extends ProviderName> = N extends "github"
  ? GH
  : N extends "vercel"
    ? VC
    : N extends "linear"
      ? LN
      : N extends "sentry"
        ? SN
        : never;

// ── ConnectionProvider Interface ──

/**
 * Base interface for all providers.
 * Non-generic for consumer compatibility — callers with a runtime string
 * get this type from getProvider().
 *
 * Providers that support webhook registration implement WebhookRegistrant
 * instead, which extends this with required register/deregister methods.
 */
export interface ConnectionProvider {
  readonly name: ProviderName;
  readonly requiresWebhookRegistration: boolean;

  // OAuth
  getAuthorizationUrl(state: string, options?: ProviderOptions): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;

  // Webhook verification (Web Crypto only — no Node.js crypto)
  verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean>;

  /** Validate raw JSON payload against the provider's Zod schema */
  parsePayload(raw: unknown): WebhookPayload;

  extractDeliveryId(headers: Headers, payload: WebhookPayload): string;
  extractEventType(headers: Headers, payload: WebhookPayload): string;
  extractResourceId(payload: WebhookPayload): string | null;
}

// ── WebhookRegistrant (Linear, Sentry) ──

/**
 * Providers that support programmatic webhook registration.
 * `requiresWebhookRegistration` is `true` at the type level.
 * register/deregister are required, not optional.
 */
export interface WebhookRegistrant extends ConnectionProvider {
  readonly requiresWebhookRegistration: true;
  registerWebhook(
    connectionId: string,
    callbackUrl: string,
    secret: string,
  ): Promise<string>;
  deregisterWebhook(connectionId: string, webhookId: string): Promise<void>;
}

// ── Provider Type Map (for getProvider overloads) ──

export type ProviderFor<N extends ProviderName> = N extends "github"
  ? GitHubProvider
  : N extends "vercel"
    ? VercelProvider
    : N extends "linear"
      ? LinearProvider
      : N extends "sentry"
        ? SentryProvider
        : never;

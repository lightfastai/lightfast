import type { ProviderName } from "./providers";

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

// ── OAuth Tokens ──

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  raw: Record<string, unknown>;
}

// ── ConnectionProvider Interface ──

/**
 * Base interface for all providers.
 * Generic over webhook payload type — defaults to `unknown` so the shared
 * package has zero Zod dependency. Gateway narrows this with concrete types.
 */
export interface ConnectionProvider<TPayload = unknown> {
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
  parsePayload(raw: unknown): TPayload;

  extractDeliveryId(headers: Headers, payload: TPayload): string;
  extractEventType(headers: Headers, payload: TPayload): string;
  extractResourceId(payload: TPayload): string | null;
}

// ── WebhookRegistrant (Linear, Sentry) ──

/**
 * Providers that support programmatic webhook registration.
 * `requiresWebhookRegistration` is `true` at the type level.
 * register/deregister are required, not optional.
 */
export interface WebhookRegistrant<TPayload = unknown>
  extends ConnectionProvider<TPayload> {
  readonly requiresWebhookRegistration: true;
  registerWebhook(
    connectionId: string,
    callbackUrl: string,
    secret: string,
  ): Promise<string>;
  deregisterWebhook(connectionId: string, webhookId: string): Promise<void>;
}

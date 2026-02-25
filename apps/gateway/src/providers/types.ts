import type { Context } from "hono";
import type { GwInstallation } from "@db/console/schema";
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
import type {
  ProviderName,
  OAuthTokens,
  ProviderOptions,
  GitHubAuthOptions,
  LinearAuthOptions,
} from "@repo/gateway-types";

// Re-export for backward compatibility (lib/cache.ts)
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

// Re-export everything from @repo/gateway-types
export {
  PROVIDER_NAMES,
  INSTALLATION_STATUSES,
  RESOURCE_STATUSES,
  DELIVERY_STATUSES,
} from "@repo/gateway-types";
export type {
  ProviderName,
  InstallationStatus,
  ResourceStatus,
  DeliveryStatus,
  OAuthTokens,
  GitHubAuthOptions,
  LinearAuthOptions,
  ProviderOptions,
  WebhookReceiptPayload,
} from "@repo/gateway-types";

// ── Gateway-Specific Type Maps ──

/** Type map: narrow webhook payload per provider name */
export type WebhookPayloadFor<N extends ProviderName> = N extends "github"
  ? GH
  : N extends "vercel"
    ? VC
    : N extends "linear"
      ? LN
      : N extends "sentry"
        ? SN
        : never;

/** Type map: narrow provider class per provider name */
export type ProviderFor<N extends ProviderName> = N extends "github"
  ? GitHubProvider
  : N extends "vercel"
    ? VercelProvider
    : N extends "linear"
      ? LinearProvider
      : N extends "sentry"
        ? SentryProvider
        : never;

/** Type map: narrow auth options per provider name */
export type AuthOptionsFor<N extends ProviderName> = N extends "github"
  ? GitHubAuthOptions
  : N extends "linear"
    ? LinearAuthOptions
    : Record<string, never>;

// ── Provider Interface ──

export interface TokenResult {
  accessToken: string;
  provider: ProviderName;
  expiresIn: number | null;
}

/** Narrowed subtype for JWT-based providers — expiresIn is always present */
export interface JwtTokenResult extends TokenResult {
  expiresIn: number;
}

export interface CallbackResult {
  installationId: string;
  provider: ProviderName;
  status: string;
  [key: string]: unknown;
}

/** Single interface for all gateway providers. */
export interface Provider {
  readonly name: ProviderName;
  readonly requiresWebhookRegistration: boolean;

  // OAuth
  getAuthorizationUrl(state: string, options?: ProviderOptions): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;

  // Webhook verification
  verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean>;
  parsePayload(raw: unknown): WebhookPayload;
  extractDeliveryId(headers: Headers, payload: WebhookPayload): string;
  extractEventType(headers: Headers, payload: WebhookPayload): string;
  extractResourceId(payload: WebhookPayload): string | null;

  // Webhook registration (only when requiresWebhookRegistration)
  registerWebhook?(
    connectionId: string,
    callbackUrl: string,
    secret: string,
  ): Promise<string>;
  deregisterWebhook?(connectionId: string, webhookId: string): Promise<void>;

  // Lifecycle
  handleCallback(
    c: Context,
    stateData: Record<string, string>,
  ): Promise<CallbackResult>;
  resolveToken(installation: GwInstallation): Promise<TokenResult>;
  buildAccountInfo(
    stateData: Record<string, string>,
    oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"];
}

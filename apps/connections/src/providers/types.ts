import type { Context } from "hono";
import type { GwInstallation } from "@db/console/schema";
import type { GitHubProvider } from "./impl/github";
import type { VercelProvider } from "./impl/vercel";
import type { LinearProvider } from "./impl/linear";
import type { SentryProvider } from "./impl/sentry";
import type {
  ProviderName,
  OAuthTokens,
  ProviderOptions,
  GitHubAuthOptions,
  LinearAuthOptions,
} from "@repo/gateway-types";

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
} from "@repo/gateway-types";

// ── Connection-Specific Type Maps ──

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

/** Connection provider interface — OAuth, token vault, lifecycle. No webhook methods. */
export interface ConnectionProvider {
  readonly name: ProviderName;
  readonly requiresWebhookRegistration: boolean;

  // OAuth
  getAuthorizationUrl(state: string, options?: ProviderOptions): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;

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

import type { GwInstallation } from "@db/console/schema";
import type {
  GitHubAuthOptions,
  LinearAuthOptions,
  OAuthTokens,
  ProviderName,
  ProviderOptions,
} from "@repo/gateway-types";
import type { Context } from "hono";
import type { GitHubProvider } from "./impl/github.js";
import type { LinearProvider } from "./impl/linear.js";
import type { SentryProvider } from "./impl/sentry.js";
import type { VercelProvider } from "./impl/vercel.js";

export type {
  BaseAccountInfo,
  DeliveryStatus,
  GitHubAccountInfo,
  GitHubAuthOptions,
  GitHubInstallationRaw,
  InstallationStatus,
  LinearAccountInfo,
  LinearAuthOptions,
  LinearOAuthRaw,
  OAuthTokens,
  ProviderAccountInfo,
  ProviderName,
  ProviderOptions,
  ResourceStatus,
  SentryAccountInfo,
  SentryOAuthRaw,
  VercelAccountInfo,
  VercelOAuthRaw,
} from "@repo/gateway-types";
// Re-export everything from @repo/gateway-types
export {
  DELIVERY_STATUSES,
  INSTALLATION_STATUSES,
  PROVIDER_NAMES,
  RESOURCE_STATUSES,
} from "@repo/gateway-types";

// ── Callback State ──

/** Typed state data passed from the route to provider.handleCallback */
export interface CallbackStateData {
  connectedBy: string;
  orgId: string;
}

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
  expiresIn: number | null;
  provider: ProviderName;
}

/** Narrowed subtype for JWT-based providers — expiresIn is always present */
export interface JwtTokenResult extends TokenResult {
  expiresIn: number;
}

export interface CallbackResult {
  installationId: string;
  provider: ProviderName;
  reactivated?: boolean;
  setupAction?: string;
  status: string;
  [key: string]: unknown;
}

/** Connection provider interface — OAuth, token vault, lifecycle, and optional webhook registration (gated by `requiresWebhookRegistration`). */
export interface ConnectionProvider {
  deregisterWebhook?(
    connectionId: string,
    webhookId: string,
    accessToken?: string
  ): Promise<void>;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;

  // OAuth
  getAuthorizationUrl(state: string, options?: ProviderOptions): string;

  // Lifecycle
  handleCallback(
    c: Context,
    stateData: CallbackStateData
  ): Promise<CallbackResult>;
  readonly name: ProviderName;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;

  // Webhook registration (only when requiresWebhookRegistration)
  registerWebhook?(
    connectionId: string,
    callbackUrl: string,
    secret: string,
    accessToken?: string
  ): Promise<string>;
  readonly requiresWebhookRegistration: boolean;
  resolveToken(installation: GwInstallation): Promise<TokenResult>;
  revokeToken(accessToken: string): Promise<void>;
}

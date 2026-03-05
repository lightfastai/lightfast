import type { GwInstallation } from "@db/console/schema";
import type {
  OAuthTokens,
  ProviderOptions,
  GitHubAuthOptions,
  LinearAuthOptions,
} from "@repo/console-types";
import type { SourceType } from "@repo/console-validation";
import type { Context } from "hono";
import type { GitHubProvider } from "./impl/github.js";
import type { LinearProvider } from "./impl/linear.js";
import type { SentryProvider } from "./impl/sentry.js";
import type { VercelProvider } from "./impl/vercel.js";

// Re-export from @repo/console-validation
export type {
  SourceType,
  InstallationStatus,
  ResourceStatus,
  DeliveryStatus,
} from "@repo/console-validation";

// Re-export from @repo/console-types
export type {
  OAuthTokens,
  GitHubAuthOptions,
  LinearAuthOptions,
  ProviderOptions,
  BaseAccountInfo,
  GitHubAccountInfo,
  GitHubInstallationRaw,
  VercelAccountInfo,
  VercelOAuthRaw,
  LinearAccountInfo,
  LinearOAuthRaw,
  SentryAccountInfo,
  SentryOAuthRaw,
  ProviderAccountInfo,
} from "@repo/console-types";

// ── Callback State ──

/** Typed state data passed from the route to provider.handleCallback */
export interface CallbackStateData {
  orgId: string;
  connectedBy: string;
}

// ── Connection-Specific Type Maps ──

/** Type map: narrow provider class per provider name */
export type ProviderFor<N extends SourceType> = N extends "github"
  ? GitHubProvider
  : N extends "vercel"
    ? VercelProvider
    : N extends "linear"
      ? LinearProvider
      : N extends "sentry"
        ? SentryProvider
        : never;

/** Type map: narrow auth options per provider name */
export type AuthOptionsFor<N extends SourceType> = N extends "github"
  ? GitHubAuthOptions
  : N extends "linear"
    ? LinearAuthOptions
    : Record<string, never>;

// ── Provider Interface ──

export interface TokenResult {
  accessToken: string;
  provider: SourceType;
  expiresIn: number | null;
}

/** Narrowed subtype for JWT-based providers — expiresIn is always present */
export interface JwtTokenResult extends TokenResult {
  expiresIn: number;
}

export interface CallbackResult {
  installationId: string;
  provider: SourceType;
  status: string;
  reactivated?: boolean;
  setupAction?: string;
  [key: string]: unknown;
}

/** Connection provider interface — OAuth, token vault, lifecycle, and optional webhook registration (gated by `requiresWebhookRegistration`). */
export interface ConnectionProvider {
  readonly name: SourceType;
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
    accessToken?: string,
  ): Promise<string>;
  deregisterWebhook?(
    connectionId: string,
    webhookId: string,
    accessToken?: string,
  ): Promise<void>;

  // Lifecycle
  handleCallback(
    c: Context,
    stateData: CallbackStateData,
  ): Promise<CallbackResult>;
  resolveToken(installation: GwInstallation): Promise<TokenResult>;
}

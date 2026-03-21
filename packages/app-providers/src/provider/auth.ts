import type {
  BaseProviderAccountInfo,
  CallbackResult,
  OAuthTokens,
} from "./primitives";

/** OAuth functions — pure fetch, no env/DB/framework */
export interface OAuthDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> {
  readonly buildAuthUrl: (
    config: TConfig,
    state: string,
    options?: Record<string, unknown>
  ) => string;
  readonly exchangeCode: (
    config: TConfig,
    code: string,
    redirectUri: string
  ) => Promise<OAuthTokens>;
  /** Get a usable bearer token — returns the stored access token directly. */
  readonly getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  readonly kind: "oauth";
  /** Extract params from callback query string, call provider APIs, return result. No DB, no Hono. */
  readonly processCallback: (
    config: TConfig,
    query: Record<string, string>
  ) => Promise<CallbackResult<TAccountInfo>>;
  readonly refreshToken: (
    config: TConfig,
    refreshToken: string
  ) => Promise<OAuthTokens>;
  readonly revokeToken: (config: TConfig, accessToken: string) => Promise<void>;
  /** OAuth tokens are always persisted — the stored token IS the active credential. */
  readonly usesStoredToken: true;
}

/** API-key auth — user pastes key, stored encrypted in token vault as accessToken */
export interface ApiKeyDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> {
  /** Build the Authorization header value from the stored key */
  readonly buildAuthHeader: (apiKey: string) => string;
  /** Get the active credential — for API-key providers, returns storedAccessToken (the key itself) */
  readonly getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  readonly kind: "api-key";
  /**
   * Process connection setup: receive key from UI, validate, return CallbackResult to store.
   * Analogous to processCallback for OAuth providers.
   */
  readonly processSetup: (
    config: TConfig,
    params: { apiKey: string }
  ) => Promise<CallbackResult<TAccountInfo>>;
  /** API keys don't refresh */
  readonly refreshToken?: never;
  readonly revokeToken?: (config: TConfig, apiKey: string) => Promise<void>;
  /** API keys are always stored */
  readonly usesStoredToken: true;
  /** Optional: validate key against provider API on connection setup */
  readonly validateKey?: (config: TConfig, apiKey: string) => Promise<boolean>;
}

/**
 * App-token auth — provider uses app-level credentials (private key, app ID)
 * to generate per-installation tokens on demand. No token is stored.
 * Examples: GitHub App (RS256 JWT → installation access token).
 */
export interface AppTokenDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> {
  readonly buildAuthHeader?: (token: string) => string;
  readonly buildInstallUrl: (
    config: TConfig,
    state: string,
    options?: Record<string, unknown>
  ) => string;
  /** Generate a per-installation access token on demand (never reads storedAccessToken). */
  readonly getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  /** Generate an app-level JWT (e.g. GitHub RS256 JWT for app-level API calls). */
  readonly getAppToken?: (config: TConfig) => Promise<string>;
  readonly kind: "app-token";
  readonly processCallback: (
    config: TConfig,
    query: Record<string, string>
  ) => Promise<CallbackResult<TAccountInfo>>;
  readonly revokeAccess?: (
    config: TConfig,
    externalId: string
  ) => Promise<void>;
  /** App-token providers never store tokens — installations use on-demand generation. */
  readonly usesStoredToken: false;
}

export function isAppTokenAuth<TConfig>(
  auth: AuthDef<TConfig>
): auth is AppTokenDef<TConfig> {
  return auth.kind === "app-token";
}

/** Discriminated union of all auth strategies */
export type AuthDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> =
  | OAuthDef<TConfig, TAccountInfo>
  | ApiKeyDef<TConfig, TAccountInfo>
  | AppTokenDef<TConfig, TAccountInfo>;

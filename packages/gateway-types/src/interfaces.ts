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
  expiresIn?: number;
  raw: Record<string, unknown>;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
}

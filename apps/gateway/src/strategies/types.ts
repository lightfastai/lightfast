import type { Context } from "hono";
import type { ConnectionProvider, OAuthTokens } from "../providers/types";
import type { GwInstallation } from "@db/console/schema";

export interface TokenResult {
  accessToken: string;
  provider: string;
  expiresIn: number | null;
}

export interface CallbackResult {
  installationId: string;
  provider: string;
  status: string;
  [key: string]: unknown;
}

export interface ConnectionStrategy {
  /**
   * Handle the OAuth callback for this provider.
   * Returns the created/updated installation ID and response data.
   */
  handleCallback(
    c: Context,
    provider: ConnectionProvider,
    stateData: Record<string, string>,
  ): Promise<CallbackResult>;

  /**
   * Resolve a usable access token for this provider.
   * May generate on-demand (GitHub), decrypt from DB, or refresh if expired.
   */
  resolveToken(installation: GwInstallation): Promise<TokenResult>;

  /**
   * Build the typed providerAccountInfo for this provider.
   */
  buildAccountInfo(
    stateData: Record<string, string>,
    oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"];
}

import { db } from "@db/console/client";
import { gatewayTokens } from "@db/console/schema";
import type { ProviderDefinition } from "@repo/console-providers";
import { decrypt } from "@repo/lib";
import { eq } from "@vendor/db";
import { getEncryptionKey } from "./encryption";
import { updateTokenRecord } from "./token-store";

/**
 * Get the active token for an installation, handling expiry and on-demand refresh.
 * Shared by GET /:id/token and POST /:id/proxy/execute.
 */
export async function getActiveTokenForInstallation(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<{ token: string; expiresAt: string | null }> {
  const tokenRows = await db
    .select()
    .from(gatewayTokens)
    .where(eq(gatewayTokens.installationId, installation.id))
    .limit(1);

  const tokenRow = tokenRows[0];

  // Handle refresh if expired
  if (tokenRow?.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
    if (!tokenRow.refreshToken) {
      throw new Error("token_expired:no_refresh_token");
    }
    const decryptedRefresh = await decrypt(
      tokenRow.refreshToken,
      getEncryptionKey()
    );
    // SAFETY: config is providerConfigs[providerName], created by the same provider's
    // createConfig(). Runtime type matches TConfig; the service cannot know TConfig
    // statically because it serves all providers from a single Record<string, unknown>.
    const auth = providerDef.auth;
    if (auth.kind !== "oauth") {
      throw new Error("token_expired:provider_does_not_support_token_refresh");
    }
    const refreshed = await auth.refreshToken(
      config as never,
      decryptedRefresh
    );
    await updateTokenRecord(
      tokenRow.id,
      refreshed,
      tokenRow.refreshToken,
      tokenRow.expiresAt
    );
    return { token: refreshed.accessToken, expiresAt: tokenRow.expiresAt };
  }

  const decryptedAccessToken = tokenRow
    ? await decrypt(tokenRow.accessToken, getEncryptionKey())
    : null;

  // SAFETY: config is providerConfigs[providerName], created by the same provider's
  // createConfig(). Runtime type matches TConfig; the service cannot know TConfig
  // statically because it serves all providers from a single Record<string, unknown>.
  const token = await providerDef.auth.getActiveToken(
    config as never,
    installation.externalId,
    decryptedAccessToken
  );

  return { token, expiresAt: tokenRow?.expiresAt ?? null };
}

/**
 * Force-refresh the token — used for 401 retry in proxy/execute.
 * Returns null if all refresh attempts fail.
 */
export async function forceRefreshToken(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<string | null> {
  const tokenRows = await db
    .select()
    .from(gatewayTokens)
    .where(eq(gatewayTokens.installationId, installation.id))
    .limit(1);
  const row = tokenRows[0];

  if (row?.refreshToken) {
    try {
      const decryptedRefresh = await decrypt(
        row.refreshToken,
        getEncryptionKey()
      );
      // SAFETY: config is providerConfigs[providerName], created by the same provider's
      // createConfig(). Runtime type matches TConfig; the service cannot know TConfig
      // statically because it serves all providers from a single Record<string, unknown>.
      const auth = providerDef.auth;
      if (auth.kind !== "oauth") {
        return null; // API key providers don't refresh tokens
      }
      const refreshed = await auth.refreshToken(
        config as never,
        decryptedRefresh
      );
      await updateTokenRecord(
        row.id,
        refreshed,
        row.refreshToken,
        row.expiresAt
      );
      return refreshed.accessToken;
    } catch {
      // Refresh failed — fall through to getActiveToken
    }
  }

  try {
    // SAFETY: config is providerConfigs[providerName], created by the same provider's
    // createConfig(). Runtime type matches TConfig; the service cannot know TConfig
    // statically because it serves all providers from a single Record<string, unknown>.
    return await providerDef.auth.getActiveToken(
      config as never,
      installation.externalId,
      null
    );
  } catch {
    return null;
  }
}

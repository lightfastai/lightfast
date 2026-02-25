import { eq } from "drizzle-orm";
import { gwTokens } from "@db/console/schema";
import { db } from "@db/console/client";
import { encrypt } from "./crypto";
import { env } from "../env";
import type { OAuthTokens } from "../providers/types";

/**
 * Write an encrypted token record for an installation.
 * Used after OAuth code exchange.
 */
export async function writeTokenRecord(
  installationId: string,
  oauthTokens: OAuthTokens,
): Promise<void> {
  const encryptedAccess = await encrypt(oauthTokens.accessToken, env.ENCRYPTION_KEY);
  const encryptedRefresh = oauthTokens.refreshToken
    ? await encrypt(oauthTokens.refreshToken, env.ENCRYPTION_KEY)
    : null;

  await db.insert(gwTokens).values({
    installationId,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    expiresAt: oauthTokens.expiresIn
      ? new Date(Date.now() + oauthTokens.expiresIn * 1000).toISOString()
      : null,
    tokenType: oauthTokens.tokenType,
    scope: oauthTokens.scope,
  });
}

/**
 * Update an existing token record after refresh.
 */
export async function updateTokenRecord(
  tokenId: string,
  oauthTokens: OAuthTokens,
  existingRefreshToken: string | null,
): Promise<void> {
  const encryptedAccess = await encrypt(oauthTokens.accessToken, env.ENCRYPTION_KEY);
  const newEncryptedRefresh = oauthTokens.refreshToken
    ? await encrypt(oauthTokens.refreshToken, env.ENCRYPTION_KEY)
    : existingRefreshToken;

  await db
    .update(gwTokens)
    .set({
      accessToken: encryptedAccess,
      refreshToken: newEncryptedRefresh,
      expiresAt: oauthTokens.expiresIn
        ? new Date(Date.now() + oauthTokens.expiresIn * 1000).toISOString()
        : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(gwTokens.id, tokenId));
}

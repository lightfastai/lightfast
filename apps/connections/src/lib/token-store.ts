import { db } from "@db/console/client";
import { gwTokens } from "@db/console/schema";
import { encrypt } from "@repo/lib";
import { eq } from "@vendor/db";
import { env } from "../env.js";
import type { OAuthTokens } from "../providers/types.js";

/**
 * Write an encrypted token record for an installation.
 * Used after OAuth code exchange.
 */
export async function writeTokenRecord(
  installationId: string,
  oauthTokens: OAuthTokens,
): Promise<void> {
  const encryptedAccess = encrypt(oauthTokens.accessToken, env.ENCRYPTION_KEY);
  const encryptedRefresh = oauthTokens.refreshToken
    ? encrypt(oauthTokens.refreshToken, env.ENCRYPTION_KEY)
    : null;

  const expiresAt = oauthTokens.expiresIn
    ? new Date(Date.now() + oauthTokens.expiresIn * 1000).toISOString()
    : null;

  await db
    .insert(gwTokens)
    .values({
      installationId,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt,
      tokenType: oauthTokens.tokenType,
      scope: oauthTokens.scope,
    })
    .onConflictDoUpdate({
      target: gwTokens.installationId,
      set: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt,
        tokenType: oauthTokens.tokenType,
        scope: oauthTokens.scope,
        updatedAt: new Date().toISOString(),
      },
    });
}

/** Minimum base64-decoded byte length for a valid AES-GCM encrypted value (12-byte IV + 16-byte tag). */
const MIN_ENCRYPTED_BYTES = 28;

/**
 * Best-effort check that `value` looks like an AES-GCM ciphertext (base64, >= {@link MIN_ENCRYPTED_BYTES} decoded bytes).
 * This is a heuristic — it can admit some plaintext that happens to be valid base64 of sufficient length.
 * For stricter validation consider a versioned prefix or non-printable-byte heuristic.
 */
function assertEncryptedFormat(value: string): void {
  try {
    const decoded = atob(value);
    if (decoded.length < MIN_ENCRYPTED_BYTES) {
      throw new Error("too short");
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `existingEncryptedRefreshToken does not appear to be an encrypted value — refusing to persist potentially plaintext token (${reason})`,
    );
  }
}

/**
 * Update an existing token record after refresh.
 *
 * @param existingEncryptedRefreshToken - The already-encrypted refresh token from the DB.
 *   Must be the raw encrypted (base64) value as stored; never pass a plaintext token.
 */
export async function updateTokenRecord(
  tokenId: string,
  oauthTokens: OAuthTokens,
  existingEncryptedRefreshToken: string | null,
  existingExpiresAt: string | null,
): Promise<void> {
  const encryptedAccess = encrypt(oauthTokens.accessToken, env.ENCRYPTION_KEY);

  let newEncryptedRefresh: string | null;
  if (oauthTokens.refreshToken) {
    newEncryptedRefresh = encrypt(oauthTokens.refreshToken, env.ENCRYPTION_KEY);
  } else if (existingEncryptedRefreshToken) {
    assertEncryptedFormat(existingEncryptedRefreshToken);
    newEncryptedRefresh = existingEncryptedRefreshToken;
  } else {
    newEncryptedRefresh = null;
  }

  const newExpiresAt = oauthTokens.expiresIn
    ? new Date(Date.now() + oauthTokens.expiresIn * 1000).toISOString()
    : existingExpiresAt;

  await db
    .update(gwTokens)
    .set({
      accessToken: encryptedAccess,
      refreshToken: newEncryptedRefresh,
      expiresAt: newExpiresAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(gwTokens.id, tokenId));
}

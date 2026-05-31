import { finalizeActiveUserSourceControlAccount } from "@db/app";
import { db } from "@db/app/client";
import { encrypt } from "@repo/app-encryption";

import { getAppEncryptionKey } from "../../../env";

export async function finalizeGitHubUserAccountBinding(input: {
  accessToken: string;
  accessTokenExpiresAt: Date;
  clerkUserId: string;
  providerUserId: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}) {
  const encryptionKey = getAppEncryptionKey();
  const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
    encrypt(input.accessToken, encryptionKey),
    encrypt(input.refreshToken, encryptionKey),
  ]);

  return finalizeActiveUserSourceControlAccount(db, {
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    clerkUserId: input.clerkUserId,
    encryptedAccessToken,
    encryptedRefreshToken,
    provider: "github",
    providerUserId: input.providerUserId,
    refreshTokenExpiresAt: input.refreshTokenExpiresAt,
  });
}

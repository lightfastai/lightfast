import { finalizeActiveUserSourceControlAccount } from "@db/app";
import { db } from "@db/app/client";
import { encrypt } from "@repo/app-encryption";

import { env } from "../../../env";

export async function finalizeGitHubUserAccountBinding(input: {
  accessToken: string;
  accessTokenExpiresAt: Date;
  clerkUserId: string;
  providerUserId: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}) {
  const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
    encrypt(input.accessToken, env.ENCRYPTION_KEY),
    encrypt(input.refreshToken, env.ENCRYPTION_KEY),
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

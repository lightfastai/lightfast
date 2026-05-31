import {
  type Database,
  getActiveUserSourceControlAccount,
  markObservedUserSourceControlAccountExpired,
  markObservedUserSourceControlAccountRevoked,
  updateObservedUserSourceControlAccountTokens,
} from "@db/app";
import { decrypt, encrypt } from "@repo/app-encryption";
import {
  GitHubAppNodeError,
  refreshGitHubUserAccessToken,
} from "@repo/github-app-node";

import { getAppEncryptionKey } from "../../../env";
import { getGitHubAppConfig } from "../config";

const DEFAULT_REFRESH_WINDOW_MS = 60 * 60 * 1000;

export type GitHubUserAccountTokenErrorCode =
  | "GITHUB_USER_ACCOUNT_NOT_CONNECTED"
  | "GITHUB_USER_ACCOUNT_REFRESH_FAILED";

export class GitHubUserAccountTokenError extends Error {
  constructor(
    readonly code: GitHubUserAccountTokenErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GitHubUserAccountTokenError";
  }
}

export async function getFreshGitHubUserAccessToken(input: {
  clerkUserId: string;
  db: Database;
  now?: () => Date;
  refreshWindowMs?: number;
}): Promise<{ accessToken: string }> {
  const account = await getActiveUserSourceControlAccount(
    input.db,
    input.clerkUserId
  );
  if (!account) {
    throw new GitHubUserAccountTokenError(
      "GITHUB_USER_ACCOUNT_NOT_CONNECTED",
      "GitHub user account is not connected."
    );
  }

  const now = input.now?.() ?? new Date();
  const refreshWindowMs = input.refreshWindowMs ?? DEFAULT_REFRESH_WINDOW_MS;
  const encryptionKey = getAppEncryptionKey();
  if (
    account.accessTokenExpiresAt.getTime() - now.getTime() >
    refreshWindowMs
  ) {
    return {
      accessToken: await decrypt(account.encryptedAccessToken, encryptionKey),
    };
  }

  if (account.refreshTokenExpiresAt.getTime() <= now.getTime()) {
    await markObservedUserSourceControlAccountExpired(input.db, {
      clerkUserId: input.clerkUserId,
      encryptedRefreshToken: account.encryptedRefreshToken,
      id: account.id,
      now,
    });
    throwRefreshFailed();
  }

  const refreshToken = await decrypt(
    account.encryptedRefreshToken,
    encryptionKey
  );

  let refreshed: Awaited<ReturnType<typeof refreshGitHubUserAccessToken>>;
  try {
    const config = getGitHubAppConfig();
    refreshed = await refreshGitHubUserAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken,
      tokenUrl: config.endpoints.oauthTokenUrl,
    });
  } catch (error) {
    const recovered = await recoverFromConcurrentRefresh({
      clerkUserId: input.clerkUserId,
      db: input.db,
      now,
      observedEncryptedRefreshToken: account.encryptedRefreshToken,
      refreshWindowMs,
      encryptionKey,
    });
    if (recovered) {
      return recovered;
    }
    if (isInvalidRefreshTokenError(error)) {
      await markObservedUserSourceControlAccountRevoked(input.db, {
        clerkUserId: input.clerkUserId,
        encryptedRefreshToken: account.encryptedRefreshToken,
        id: account.id,
        now,
      });
    }
    throwRefreshFailed();
  }

  if (
    refreshed.accessTokenExpiresIn === undefined ||
    !refreshed.refreshToken ||
    refreshed.refreshTokenExpiresIn === undefined
  ) {
    throwRefreshFailed();
  }

  const accessTokenExpiresAt = new Date(
    now.getTime() + refreshed.accessTokenExpiresIn * 1000
  );
  const refreshTokenExpiresAt = new Date(
    now.getTime() + refreshed.refreshTokenExpiresIn * 1000
  );
  const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
    encrypt(refreshed.accessToken, encryptionKey),
    encrypt(refreshed.refreshToken, encryptionKey),
  ]);

  const updated = await updateObservedUserSourceControlAccountTokens(input.db, {
    accessTokenExpiresAt,
    clerkUserId: input.clerkUserId,
    encryptedAccessToken,
    encryptedRefreshToken,
    id: account.id,
    observedEncryptedRefreshToken: account.encryptedRefreshToken,
    refreshTokenExpiresAt,
    updatedAt: now,
  });

  if (!updated) {
    const recovered = await recoverFromConcurrentRefresh({
      clerkUserId: input.clerkUserId,
      db: input.db,
      now,
      observedEncryptedRefreshToken: account.encryptedRefreshToken,
      refreshWindowMs,
      encryptionKey,
    });
    if (recovered) {
      return recovered;
    }
    throwRefreshFailed();
  }

  return { accessToken: refreshed.accessToken };
}

async function recoverFromConcurrentRefresh(input: {
  clerkUserId: string;
  db: Database;
  encryptionKey: string;
  now: Date;
  observedEncryptedRefreshToken: string;
  refreshWindowMs: number;
}): Promise<{ accessToken: string } | null> {
  const currentAccount = await getActiveUserSourceControlAccount(
    input.db,
    input.clerkUserId
  );
  if (
    !currentAccount ||
    (currentAccount.accessTokenExpiresAt.getTime() - input.now.getTime() <=
      input.refreshWindowMs &&
      currentAccount.encryptedRefreshToken ===
        input.observedEncryptedRefreshToken)
  ) {
    return null;
  }

  return {
    accessToken: await decrypt(
      currentAccount.encryptedAccessToken,
      input.encryptionKey
    ),
  };
}

function isInvalidRefreshTokenError(error: unknown): boolean {
  return (
    error instanceof GitHubAppNodeError &&
    error.code === "GITHUB_OAUTH_REFRESH_TOKEN_INVALID"
  );
}

function throwRefreshFailed(): never {
  throw new GitHubUserAccountTokenError(
    "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    "GitHub user account token refresh failed."
  );
}

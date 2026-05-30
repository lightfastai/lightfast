import { type Database, getActiveUserSourceControlAccount } from "@db/app";
import { userSourceControlAccounts } from "@db/app/schema";
import { decrypt, encrypt } from "@repo/app-encryption";
import {
  GitHubAppNodeError,
  refreshGitHubUserAccessToken,
} from "@repo/github-app-node";
import { and, eq } from "drizzle-orm";

import { env } from "../../../env";
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
  if (
    account.accessTokenExpiresAt.getTime() - now.getTime() >
    refreshWindowMs
  ) {
    return {
      accessToken: await decrypt(
        account.encryptedAccessToken,
        env.ENCRYPTION_KEY
      ),
    };
  }

  if (account.refreshTokenExpiresAt.getTime() <= now.getTime()) {
    await expireObservedAccount(input.db, {
      clerkUserId: input.clerkUserId,
      encryptedRefreshToken: account.encryptedRefreshToken,
      id: account.id,
      now,
    });
    throwRefreshFailed();
  }

  const refreshToken = await decrypt(
    account.encryptedRefreshToken,
    env.ENCRYPTION_KEY
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
    });
    if (recovered) {
      return recovered;
    }
    if (isInvalidRefreshTokenError(error)) {
      await revokeObservedAccount(input.db, {
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
    encrypt(refreshed.accessToken, env.ENCRYPTION_KEY),
    encrypt(refreshed.refreshToken, env.ENCRYPTION_KEY),
  ]);

  const result = await input.db
    .update(userSourceControlAccounts)
    .set({
      accessTokenExpiresAt,
      encryptedAccessToken,
      encryptedRefreshToken,
      refreshTokenExpiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(userSourceControlAccounts.id, account.id),
        eq(userSourceControlAccounts.clerkUserId, input.clerkUserId),
        eq(
          userSourceControlAccounts.encryptedRefreshToken,
          account.encryptedRefreshToken
        ),
        eq(userSourceControlAccounts.status, "active")
      )
    );

  if (getRowsAffected(result) <= 0) {
    const recovered = await recoverFromConcurrentRefresh({
      clerkUserId: input.clerkUserId,
      db: input.db,
      now,
      observedEncryptedRefreshToken: account.encryptedRefreshToken,
      refreshWindowMs,
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
      env.ENCRYPTION_KEY
    ),
  };
}

async function expireObservedAccount(
  db: Database,
  input: {
    clerkUserId: string;
    encryptedRefreshToken: string;
    id: number;
    now: Date;
  }
) {
  await db
    .update(userSourceControlAccounts)
    .set({
      activeClerkUserId: null,
      activeProviderUserKey: null,
      revokedAt: null,
      status: "expired",
      updatedAt: input.now,
    })
    .where(
      and(
        eq(userSourceControlAccounts.id, input.id),
        eq(userSourceControlAccounts.clerkUserId, input.clerkUserId),
        eq(
          userSourceControlAccounts.encryptedRefreshToken,
          input.encryptedRefreshToken
        ),
        eq(userSourceControlAccounts.status, "active")
      )
    );
}

async function revokeObservedAccount(
  db: Database,
  input: {
    clerkUserId: string;
    encryptedRefreshToken: string;
    id: number;
    now: Date;
  }
) {
  await db
    .update(userSourceControlAccounts)
    .set({
      activeClerkUserId: null,
      activeProviderUserKey: null,
      revokedAt: input.now,
      status: "revoked",
      updatedAt: input.now,
    })
    .where(
      and(
        eq(userSourceControlAccounts.id, input.id),
        eq(userSourceControlAccounts.clerkUserId, input.clerkUserId),
        eq(
          userSourceControlAccounts.encryptedRefreshToken,
          input.encryptedRefreshToken
        ),
        eq(userSourceControlAccounts.status, "active")
      )
    );
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

function getRowsAffected(result: unknown): number {
  const value = Array.isArray(result) ? result[0] : result;
  if (!value || typeof value !== "object") {
    return 0;
  }

  if ("affectedRows" in value && typeof value.affectedRows === "number") {
    return value.affectedRows;
  }

  if ("rowsAffected" in value && typeof value.rowsAffected === "number") {
    return value.rowsAffected;
  }

  return 0;
}

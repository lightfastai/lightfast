import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const decryptMock = vi.fn();
const encryptMock = vi.fn();
const getActiveUserSourceControlAccountMock = vi.fn();
const markObservedUserSourceControlAccountExpiredMock = vi.fn();
const markObservedUserSourceControlAccountRevokedMock = vi.fn();
const refreshGitHubUserAccessTokenMock = vi.fn();
const updateObservedUserSourceControlAccountTokensMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

const TEST_ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";

vi.mock("@db/app", () => ({
  getActiveUserSourceControlAccount: getActiveUserSourceControlAccountMock,
  markObservedUserSourceControlAccountExpired:
    markObservedUserSourceControlAccountExpiredMock,
  markObservedUserSourceControlAccountRevoked:
    markObservedUserSourceControlAccountRevokedMock,
  updateObservedUserSourceControlAccountTokens:
    updateObservedUserSourceControlAccountTokensMock,
}));

vi.mock("@repo/app-encryption", () => ({
  decrypt: decryptMock,
  encrypt: encryptMock,
}));

vi.mock("@repo/github-app-node", () => ({
  refreshGitHubUserAccessToken: refreshGitHubUserAccessTokenMock,
  GitHubAppNodeError: class GitHubAppNodeError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
      this.name = "GitHubAppNodeError";
    }
  },
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    info: logInfoMock,
    warn: logWarnMock,
  },
}));

vi.mock("../env", () => ({
  env: {
    ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
  },
}));

vi.mock("../services/github/config", () => ({
  getGitHubAppConfig: () => ({
    clientId: "github_client_test",
    clientSecret: "github_secret_test",
    endpoints: {
      oauthTokenUrl:
        "https://github.lightfast.localhost/login/oauth/access_token",
    },
  }),
}));

const { getFreshGitHubUserAccessToken } = await import(
  "../services/github/user-account/refresh"
);
const { GitHubAppNodeError } = await import("@repo/github-app-node");

function mockDb() {
  return {} as Database;
}

function expectLogsNotToContain(values: readonly string[]) {
  const serializedLogs = JSON.stringify([
    ...logInfoMock.mock.calls,
    ...logWarnMock.mock.calls,
  ]);

  for (const value of values) {
    expect(serializedLogs).not.toContain(value);
  }
}

describe("github user account token refresh", () => {
  beforeEach(() => {
    decryptMock.mockReset();
    encryptMock.mockReset();
    getActiveUserSourceControlAccountMock.mockReset();
    markObservedUserSourceControlAccountExpiredMock.mockReset();
    markObservedUserSourceControlAccountRevokedMock.mockReset();
    refreshGitHubUserAccessTokenMock.mockReset();
    updateObservedUserSourceControlAccountTokensMock.mockReset();
    logInfoMock.mockReset();
    logWarnMock.mockReset();

    markObservedUserSourceControlAccountExpiredMock.mockResolvedValue(true);
    markObservedUserSourceControlAccountRevokedMock.mockResolvedValue(true);
    updateObservedUserSourceControlAccountTokensMock.mockResolvedValue(true);
  });

  it("returns the existing decrypted access token outside the refresh window", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      accessTokenExpiresAt: new Date("2026-05-30T12:00:00.000Z"),
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
      status: "active",
    });
    decryptMock.mockResolvedValueOnce("ghu_access");

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).resolves.toEqual({ accessToken: "ghu_access" });

    expect(decryptMock).toHaveBeenCalledTimes(1);
    expect(decryptMock).toHaveBeenCalledWith(
      "encrypted_access",
      expect.any(String)
    );
    expect(refreshGitHubUserAccessTokenMock).not.toHaveBeenCalled();
  });

  it("refreshes and persists rotated tokens inside the refresh window", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      id: 1,
      providerUserId: "12345",
      accessTokenExpiresAt: new Date("2026-05-30T00:30:00.000Z"),
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
      status: "active",
    });
    decryptMock.mockResolvedValueOnce("ghr_refresh");
    refreshGitHubUserAccessTokenMock.mockResolvedValue({
      accessToken: "ghu_next",
      accessTokenExpiresIn: 28_800,
      refreshToken: "ghr_next",
      refreshTokenExpiresIn: 15_768_000,
    });
    encryptMock
      .mockResolvedValueOnce("encrypted_next_access")
      .mockResolvedValueOnce("encrypted_next_refresh");

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).resolves.toEqual({ accessToken: "ghu_next" });

    expect(decryptMock).toHaveBeenCalledWith(
      "encrypted_refresh",
      expect.any(String)
    );
    expect(refreshGitHubUserAccessTokenMock).toHaveBeenCalledWith({
      clientId: "github_client_test",
      clientSecret: "github_secret_test",
      refreshToken: "ghr_refresh",
      tokenUrl: "https://github.lightfast.localhost/login/oauth/access_token",
    });
    expect(
      updateObservedUserSourceControlAccountTokensMock
    ).toHaveBeenCalledWith(expect.anything(), {
      accessTokenExpiresAt: new Date("2026-05-30T08:00:00.000Z"),
      clerkUserId: "user_1",
      encryptedAccessToken: "encrypted_next_access",
      encryptedRefreshToken: "encrypted_next_refresh",
      id: 1,
      observedEncryptedRefreshToken: "encrypted_refresh",
      refreshTokenExpiresAt: new Date("2026-11-28T12:00:00.000Z"),
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
    });
    expect(logInfoMock).toHaveBeenCalledWith(
      "[github-user-account] access token refreshed",
      {
        accessTokenExpiresAt: new Date("2026-05-30T08:00:00.000Z"),
        accountId: 1,
        clerkUserId: "user_1",
        providerUserId: "12345",
        refreshTokenExpiresAt: new Date("2026-11-28T12:00:00.000Z"),
      }
    );
    expectLogsNotToContain([
      "encrypted_access",
      "encrypted_refresh",
      "encrypted_next_access",
      "encrypted_next_refresh",
      "ghr_refresh",
      "ghu_next",
      "ghr_next",
    ]);
  });

  it("throws a typed missing-account error when no active account exists", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue(undefined);

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_NOT_CONNECTED",
    });
    expect(logWarnMock).toHaveBeenCalledWith(
      "[github-user-account] access token unavailable",
      {
        clerkUserId: "user_1",
        reason: "not_connected",
      }
    );
  });

  it("throws when the refresh response is missing refreshable token fields", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      id: 1,
      accessTokenExpiresAt: new Date("2026-05-30T00:30:00.000Z"),
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
      status: "active",
    });
    decryptMock.mockResolvedValueOnce("ghr_refresh");
    refreshGitHubUserAccessTokenMock.mockResolvedValue({
      accessToken: "ghu_next",
      tokenType: "bearer",
    });

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    });
    expect(logWarnMock).toHaveBeenCalledWith(
      "[github-user-account] access token refresh failed",
      expect.objectContaining({
        accountId: 1,
        clerkUserId: "user_1",
        reason: "missing_refreshable_token_fields",
      })
    );
    expectLogsNotToContain([
      "encrypted_access",
      "encrypted_refresh",
      "ghr_refresh",
      "ghu_next",
    ]);
  });

  it("expires only the observed row version when the local refresh token is expired", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      id: 1,
      clerkUserId: "user_1",
      accessTokenExpiresAt: new Date("2026-05-30T00:30:00.000Z"),
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      refreshTokenExpiresAt: new Date("2026-05-29T00:00:00.000Z"),
      status: "active",
    });

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    });
    expect(
      markObservedUserSourceControlAccountExpiredMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkUserId: "user_1",
      encryptedRefreshToken: "encrypted_refresh",
      id: 1,
      now: new Date("2026-05-30T00:00:00.000Z"),
    });
    expect(
      markObservedUserSourceControlAccountRevokedMock
    ).not.toHaveBeenCalled();
    expect(
      updateObservedUserSourceControlAccountTokensMock
    ).not.toHaveBeenCalled();
    expect(decryptMock).not.toHaveBeenCalled();
  });

  it("does not expire accounts for generic provider refresh failures", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      id: 1,
      accessTokenExpiresAt: new Date("2026-05-30T00:30:00.000Z"),
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
      status: "active",
    });
    decryptMock.mockResolvedValueOnce("ghr_refresh");
    refreshGitHubUserAccessTokenMock.mockRejectedValue(
      new GitHubAppNodeError(
        "GITHUB_OAUTH_EXCHANGE_FAILED",
        "GitHub OAuth token refresh failed."
      )
    );

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    });
    expect(
      markObservedUserSourceControlAccountExpiredMock
    ).not.toHaveBeenCalled();
    expect(
      markObservedUserSourceControlAccountRevokedMock
    ).not.toHaveBeenCalled();
  });

  it("revokes only the observed row version when the provider rejects the refresh token", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      id: 1,
      clerkUserId: "user_1",
      accessTokenExpiresAt: new Date("2026-05-30T00:30:00.000Z"),
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
      status: "active",
    });
    decryptMock.mockResolvedValueOnce("ghr_refresh");
    refreshGitHubUserAccessTokenMock.mockRejectedValue(
      new GitHubAppNodeError(
        "GITHUB_OAUTH_REFRESH_TOKEN_INVALID",
        "GitHub OAuth token refresh failed."
      )
    );

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    });

    expect(
      markObservedUserSourceControlAccountRevokedMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkUserId: "user_1",
      encryptedRefreshToken: "encrypted_refresh",
      id: 1,
      now: new Date("2026-05-30T00:00:00.000Z"),
    });
    expect(
      markObservedUserSourceControlAccountExpiredMock
    ).not.toHaveBeenCalled();
  });

  it("recovers from stale provider refresh failures when a concurrent refresh already rotated tokens", async () => {
    getActiveUserSourceControlAccountMock
      .mockResolvedValueOnce({
        id: 1,
        clerkUserId: "user_1",
        accessTokenExpiresAt: new Date("2026-05-30T00:30:00.000Z"),
        encryptedAccessToken: "encrypted_old_access",
        encryptedRefreshToken: "encrypted_old_refresh",
        refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
        status: "active",
      })
      .mockResolvedValueOnce({
        id: 1,
        clerkUserId: "user_1",
        accessTokenExpiresAt: new Date("2026-05-30T08:00:00.000Z"),
        encryptedAccessToken: "encrypted_current_access",
        encryptedRefreshToken: "encrypted_current_refresh",
        refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
        status: "active",
      });
    decryptMock
      .mockResolvedValueOnce("ghr_old")
      .mockResolvedValueOnce("ghu_current");
    refreshGitHubUserAccessTokenMock.mockRejectedValue(
      new GitHubAppNodeError(
        "GITHUB_OAUTH_EXCHANGE_FAILED",
        "GitHub OAuth token refresh failed."
      )
    );

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).resolves.toEqual({ accessToken: "ghu_current" });

    expect(decryptMock).toHaveBeenNthCalledWith(
      1,
      "encrypted_old_refresh",
      expect.any(String)
    );
    expect(decryptMock).toHaveBeenNthCalledWith(
      2,
      "encrypted_current_access",
      expect.any(String)
    );
    expect(
      markObservedUserSourceControlAccountExpiredMock
    ).not.toHaveBeenCalled();
    expect(
      markObservedUserSourceControlAccountRevokedMock
    ).not.toHaveBeenCalled();
  });

  it("throws a deterministic refresh error when rotated token persistence loses the observed row", async () => {
    updateObservedUserSourceControlAccountTokensMock.mockResolvedValue(false);
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      id: 1,
      clerkUserId: "user_1",
      accessTokenExpiresAt: new Date("2026-05-30T00:30:00.000Z"),
      encryptedAccessToken: "encrypted_access",
      encryptedRefreshToken: "encrypted_refresh",
      refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
      status: "active",
    });
    decryptMock.mockResolvedValueOnce("ghr_refresh");
    refreshGitHubUserAccessTokenMock.mockResolvedValue({
      accessToken: "ghu_next",
      accessTokenExpiresIn: 28_800,
      refreshToken: "ghr_next",
      refreshTokenExpiresIn: 15_768_000,
    });
    encryptMock
      .mockResolvedValueOnce("encrypted_next_access")
      .mockResolvedValueOnce("encrypted_next_refresh");

    await expect(
      getFreshGitHubUserAccessToken({
        db: mockDb(),
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    });
  });
});

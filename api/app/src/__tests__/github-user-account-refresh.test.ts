import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const decryptMock = vi.fn();
const encryptMock = vi.fn();
const getActiveUserSourceControlAccountMock = vi.fn();
const markUserSourceControlAccountExpiredMock = vi.fn();
const refreshGitHubUserAccessTokenMock = vi.fn();

const andMock = vi.fn((...conditions: unknown[]) => ({
  conditions,
  type: "and",
}));
const eqMock = vi.fn((column: unknown, value: unknown) => ({
  column,
  type: "eq",
  value,
}));

vi.mock("drizzle-orm", () => ({
  and: andMock,
  eq: eqMock,
}));

vi.mock("@db/app", () => ({
  getActiveUserSourceControlAccount: getActiveUserSourceControlAccountMock,
  markUserSourceControlAccountExpired: markUserSourceControlAccountExpiredMock,
}));

vi.mock("@db/app/schema", () => ({
  userSourceControlAccounts: {
    accessTokenExpiresAt: "accessTokenExpiresAt",
    activeClerkUserId: "activeClerkUserId",
    activeProviderUserKey: "activeProviderUserKey",
    clerkUserId: "clerkUserId",
    encryptedAccessToken: "encryptedAccessToken",
    encryptedRefreshToken: "encryptedRefreshToken",
    id: "id",
    refreshTokenExpiresAt: "refreshTokenExpiresAt",
    revokedAt: "revokedAt",
    status: "status",
  },
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

vi.mock("../env", () => ({
  env: {
    ENCRYPTION_KEY:
      "0000000000000000000000000000000000000000000000000000000000000000",
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

function createUpdateDb() {
  return createUpdateDbWithResult([{ affectedRows: 1 }]);
}

function createUpdateDbWithResult(result: unknown) {
  const whereMock = vi.fn().mockResolvedValue(result);
  const setMock = vi.fn(() => ({ where: whereMock }));
  const updateMock = vi.fn(() => ({ set: setMock }));
  return {
    db: { update: updateMock } as unknown as Database,
    setMock,
    updateMock,
    whereMock,
  };
}

function mockDb() {
  return {} as Database;
}

describe("github user account token refresh", () => {
  beforeEach(() => {
    andMock.mockClear();
    decryptMock.mockReset();
    encryptMock.mockReset();
    eqMock.mockClear();
    getActiveUserSourceControlAccountMock.mockReset();
    markUserSourceControlAccountExpiredMock.mockReset();
    refreshGitHubUserAccessTokenMock.mockReset();
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
    const updateDb = createUpdateDb();
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
      accessTokenExpiresIn: 28_800,
      refreshToken: "ghr_next",
      refreshTokenExpiresIn: 15_768_000,
    });
    encryptMock
      .mockResolvedValueOnce("encrypted_next_access")
      .mockResolvedValueOnce("encrypted_next_refresh");

    await expect(
      getFreshGitHubUserAccessToken({
        db: updateDb.db,
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
    expect(updateDb.updateMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", 1);
    expect(eqMock).toHaveBeenCalledWith("clerkUserId", "user_1");
    expect(eqMock).toHaveBeenCalledWith(
      "encryptedRefreshToken",
      "encrypted_refresh"
    );
    expect(eqMock).toHaveBeenCalledWith("status", "active");
    expect(updateDb.setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedAccessToken: "encrypted_next_access",
        encryptedRefreshToken: "encrypted_next_refresh",
        accessTokenExpiresAt: new Date("2026-05-30T08:00:00.000Z"),
        refreshTokenExpiresAt: new Date("2026-11-28T12:00:00.000Z"),
      })
    );
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
  });

  it("expires only the observed row version when the local refresh token is expired", async () => {
    const updateDb = createUpdateDb();
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
        db: updateDb.db,
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    });
    expect(markUserSourceControlAccountExpiredMock).not.toHaveBeenCalled();
    expect(updateDb.setMock).toHaveBeenCalledWith({
      activeClerkUserId: null,
      activeProviderUserKey: null,
      revokedAt: null,
      status: "expired",
    });
    expect(eqMock).toHaveBeenCalledWith("id", 1);
    expect(eqMock).toHaveBeenCalledWith("clerkUserId", "user_1");
    expect(eqMock).toHaveBeenCalledWith(
      "encryptedRefreshToken",
      "encrypted_refresh"
    );
    expect(eqMock).toHaveBeenCalledWith("status", "active");
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
    expect(markUserSourceControlAccountExpiredMock).not.toHaveBeenCalled();
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
    expect(markUserSourceControlAccountExpiredMock).not.toHaveBeenCalled();
  });

  it("throws a deterministic refresh error when rotated token persistence affects no rows", async () => {
    const updateDb = createUpdateDbWithResult([{ affectedRows: 0 }]);
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
        db: updateDb.db,
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    });
  });

  it("treats unknown rotated token persistence result shapes as failure", async () => {
    const updateDb = createUpdateDbWithResult({ ok: true });
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
        db: updateDb.db,
        clerkUserId: "user_1",
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        refreshWindowMs: 60 * 60 * 1000,
      })
    ).rejects.toMatchObject({
      code: "GITHUB_USER_ACCOUNT_REFRESH_FAILED",
    });
  });
});

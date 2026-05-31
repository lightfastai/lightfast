import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const consumeAttemptMock = vi.fn();
const createGitHubPkcePairMock = vi.fn();
const encryptMock = vi.fn();
const exchangeGitHubOAuthCodeMock = vi.fn();
const finalizeActiveUserSourceControlAccountMock = vi.fn();
const getActiveUserSourceControlAccountMock = vi.fn();
const getFreshGitHubUserAccessTokenMock = vi.fn();
const getGitHubAuthenticatedUserMock = vi.fn();
const issueAttemptMock = vi.fn();
const lookupAttemptMock = vi.fn();
const markUserSourceControlAccountRevokedMock = vi.fn();
const revokeGitHubOAuthGrantMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

const TEST_ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  finalizeActiveUserSourceControlAccount:
    finalizeActiveUserSourceControlAccountMock,
  getActiveUserSourceControlAccount: getActiveUserSourceControlAccountMock,
  markUserSourceControlAccountRevoked: markUserSourceControlAccountRevokedMock,
  UserSourceControlAccountConflictError: class UserSourceControlAccountConflictError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
      this.name = "UserSourceControlAccountConflictError";
    }
  },
}));

vi.mock("@repo/app-encryption", () => ({
  encrypt: encryptMock,
}));

vi.mock("@repo/github-app-node", () => ({
  buildGitHubOAuthAuthorizeUrl: vi.fn(
    ({
      clientId,
      codeChallenge,
      oauthAuthorizeUrl = "https://github.com/login/oauth/authorize",
      redirectUri,
      state,
    }: {
      clientId: string;
      codeChallenge: string;
      oauthAuthorizeUrl?: string;
      redirectUri: string;
      state: string;
    }) => {
      const url = new URL(oauthAuthorizeUrl);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url.toString();
    }
  ),
  createGitHubPkcePair: createGitHubPkcePairMock,
  exchangeGitHubOAuthCode: exchangeGitHubOAuthCodeMock,
  getGitHubAuthenticatedUser: getGitHubAuthenticatedUserMock,
  refreshGitHubUserAccessToken: vi.fn(),
  revokeGitHubOAuthGrant: revokeGitHubOAuthGrantMock,
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

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
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

vi.mock("../services/github/user-account/attempts", () => ({
  consumeGitHubUserAccountOAuthAttempt: consumeAttemptMock,
  issueGitHubUserAccountOAuthAttempt: issueAttemptMock,
  lookupGitHubUserAccountOAuthAttempt: lookupAttemptMock,
}));

vi.mock("../services/github/user-account/refresh", () => ({
  getFreshGitHubUserAccessToken: getFreshGitHubUserAccessTokenMock,
}));

vi.mock("../services/github/config", () => ({
  getGitHubAppConfig: () => ({
    apiVersion: "2022-11-28",
    clientId: "github_client_test",
    clientSecret: "github_secret_test",
    endpoints: {
      apiBaseUrl: "https://github.lightfast.localhost",
      oauthAuthorizeUrl:
        "https://github.lightfast.localhost/login/oauth/authorize",
      oauthTokenUrl:
        "https://github.lightfast.localhost/login/oauth/access_token",
      webBaseUrl: "https://github.lightfast.localhost",
    },
  }),
  resolveGitHubAppOrigin: () => "https://app.lightfast.localhost",
}));

const {
  completeGitHubUserAccountOAuth,
  disconnectGitHubUserAccount,
  getGitHubUserAccountStatus,
  startGitHubUserAccountBinding,
} = await import("../services/github/user-account/flow");

function githubUserAccountAttempt(
  overrides: Partial<{
    codeVerifier: string;
    lightfastUserId: string;
    returnTo: string;
  }> = {}
) {
  return {
    codeVerifier: "verifier_123",
    lightfastUserId: "user_1",
    returnTo: "/account/tasks/github",
    ...overrides,
  };
}

function mockAttempt(record = githubUserAccountAttempt()) {
  lookupAttemptMock.mockResolvedValue(record);
  consumeAttemptMock.mockResolvedValue(record);
  return record;
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

describe("github user account flow", () => {
  beforeEach(() => {
    authMock.mockReset();
    consumeAttemptMock.mockReset();
    createGitHubPkcePairMock.mockReset();
    encryptMock.mockReset();
    exchangeGitHubOAuthCodeMock.mockReset();
    finalizeActiveUserSourceControlAccountMock.mockReset();
    getActiveUserSourceControlAccountMock.mockReset();
    getFreshGitHubUserAccessTokenMock.mockReset();
    getGitHubAuthenticatedUserMock.mockReset();
    issueAttemptMock.mockReset();
    lookupAttemptMock.mockReset();
    logInfoMock.mockReset();
    logWarnMock.mockReset();
    markUserSourceControlAccountRevokedMock.mockReset();
    revokeGitHubOAuthGrantMock.mockReset();

    authMock.mockResolvedValue({ userId: "user_1" });
    createGitHubPkcePairMock.mockReturnValue({
      codeChallenge: "challenge_123",
      codeChallengeMethod: "S256",
      codeVerifier: "verifier_123",
    });
    exchangeGitHubOAuthCodeMock.mockResolvedValue({
      accessToken: "ghu_access",
      accessTokenExpiresIn: 28_800,
      refreshToken: "ghr_refresh",
      refreshTokenExpiresIn: 15_768_000,
      scope: "",
      tokenType: "bearer",
    });
    getGitHubAuthenticatedUserMock.mockResolvedValue({
      id: "12345",
      login: "lightfast-dev",
      type: "User",
    });
    issueAttemptMock.mockResolvedValue({
      attemptId: "attempt_1",
      state: "state_123",
    });
    encryptMock
      .mockResolvedValueOnce("encrypted_access")
      .mockResolvedValueOnce("encrypted_refresh");
    getFreshGitHubUserAccessTokenMock.mockResolvedValue({
      accessToken: "ghu_access",
    });
    revokeGitHubOAuthGrantMock.mockResolvedValue(undefined);
  });

  it("starts user account OAuth with the user callback redirect uri", async () => {
    createGitHubPkcePairMock.mockReturnValue({
      codeChallenge: "challenge_123",
      codeChallengeMethod: "S256",
      codeVerifier: "verifier_123",
    });
    issueAttemptMock.mockResolvedValue({
      attemptId: "attempt_1",
      state: "state_123",
    });

    await expect(
      startGitHubUserAccountBinding({
        lightfastUserId: "user_1",
        returnTo: "/account/tasks/github",
      })
    ).resolves.toEqual({
      authorizationUrl:
        "https://github.lightfast.localhost/login/oauth/authorize?client_id=github_client_test&redirect_uri=https%3A%2F%2Fapp.lightfast.localhost%2Fapi%2Fgithub%2Fuser%2Foauth%2Fcallback&state=state_123&code_challenge=challenge_123&code_challenge_method=S256",
    });
    expect(logInfoMock).toHaveBeenCalledWith(
      "[github-user-account] binding started",
      {
        hasReturnTo: true,
        lightfastUserId: "user_1",
      }
    );
    expectLogsNotToContain(["state_123", "verifier_123"]);
  });

  it.each([
    ["external URL", "https://evil.example/path"],
    ["protocol-relative URL", "//evil.example/path"],
    ["backslash protocol-relative URL", "/\\evil.example/path"],
    ["nested backslash path", "/account\\settings"],
    ["too-long path", `/${"a".repeat(512)}`],
  ])("omits %s returnTo values when starting user account OAuth", async (_label, returnTo) => {
    await startGitHubUserAccountBinding({
      lightfastUserId: "user_1",
      returnTo,
    });

    expect(issueAttemptMock).toHaveBeenCalledWith({
      codeVerifier: "verifier_123",
      lightfastUserId: "user_1",
    });
  });

  it("persists safe returnTo values when starting user account OAuth", async () => {
    await startGitHubUserAccountBinding({
      lightfastUserId: "user_1",
      returnTo: "/account/tasks/github",
    });

    expect(issueAttemptMock).toHaveBeenCalledWith({
      codeVerifier: "verifier_123",
      lightfastUserId: "user_1",
      returnTo: "/account/tasks/github",
    });
  });

  it("requires refreshable token fields before finalizing", async () => {
    mockAttempt();
    authMock.mockResolvedValue({ userId: "user_1" });
    exchangeGitHubOAuthCodeMock.mockResolvedValue({
      accessToken: "ghu_access",
      tokenType: "bearer",
    });

    const result = await completeGitHubUserAccountOAuth({
      requestUrl:
        "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
    });

    expect(result.redirectUrl).toBe(
      "https://app.lightfast.localhost/account/tasks/github?github_error=missing_refresh_token"
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      "[github-user-account] binding failed",
      {
        code: "missing_refresh_token",
        lightfastUserId: "user_1",
      }
    );
    expectLogsNotToContain(["ghu_access", "state_123", "verifier_123"]);
    expect(finalizeActiveUserSourceControlAccountMock).not.toHaveBeenCalled();
  });

  it("finalizes encrypted credentials for the verified GitHub user id", async () => {
    mockAttempt();
    authMock.mockResolvedValue({ userId: "user_1" });
    exchangeGitHubOAuthCodeMock.mockResolvedValue({
      accessToken: "ghu_access",
      accessTokenExpiresIn: 28_800,
      refreshToken: "ghr_refresh",
      refreshTokenExpiresIn: 15_768_000,
      scope: "",
      tokenType: "bearer",
    });
    getGitHubAuthenticatedUserMock.mockResolvedValue({
      id: "12345",
      login: "lightfast-dev",
      type: "User",
    });
    encryptMock
      .mockResolvedValueOnce("encrypted_access")
      .mockResolvedValueOnce("encrypted_refresh");

    await completeGitHubUserAccountOAuth({
      requestUrl:
        "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
    });

    expect(finalizeActiveUserSourceControlAccountMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        clerkUserId: "user_1",
        encryptedAccessToken: "encrypted_access",
        encryptedRefreshToken: "encrypted_refresh",
        provider: "github",
        providerUserId: "12345",
      })
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      "[github-user-account] binding finalized",
      {
        hasReturnTo: true,
        lightfastUserId: "user_1",
        providerUserId: "12345",
      }
    );
    expectLogsNotToContain([
      "abc",
      "ghu_access",
      "ghr_refresh",
      "state_123",
      "verifier_123",
    ]);
  });

  it("redirects unauthenticated callbacks to sign-in without consuming the attempt", async () => {
    mockAttempt();
    authMock.mockResolvedValue({ userId: null });

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/sign-in?redirect_url=%2Fapi%2Fgithub%2Fuser%2Foauth%2Fcallback%3Fcode%3Dabc%26state%3Dstate_123",
    });
    expect(consumeAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects expired-session callbacks to sign-in without consuming the attempt", async () => {
    mockAttempt();
    authMock.mockResolvedValue({
      sessionId: "sess_expired",
      sessionStatus: "expired",
      userId: null,
    });

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/sign-in?redirect_url=%2Fapi%2Fgithub%2Fuser%2Foauth%2Fcallback%3Fcode%3Dabc%26state%3Dstate_123",
    });
    expect(consumeAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects wrong-user callbacks with permission_required without consuming the attempt", async () => {
    mockAttempt();
    authMock.mockResolvedValue({ userId: "user_2" });

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/tasks/github?github_error=permission_required",
    });
    expect(consumeAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated denied callbacks to sign-in without consuming the attempt", async () => {
    mockAttempt();
    authMock.mockResolvedValue({ userId: null });

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?error=access_denied&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/sign-in?redirect_url=%2Fapi%2Fgithub%2Fuser%2Foauth%2Fcallback%3Ferror%3Daccess_denied%26state%3Dstate_123",
    });
    expect(consumeAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects wrong-user denied callbacks with permission_required without consuming the attempt", async () => {
    mockAttempt();
    authMock.mockResolvedValue({ userId: "user_2" });

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?error=access_denied&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/tasks/github?github_error=permission_required",
    });
    expect(consumeAttemptMock).not.toHaveBeenCalled();
  });

  it("consumes denied callbacks only after the auth user matches", async () => {
    mockAttempt();
    authMock.mockResolvedValue({ userId: "user_1" });

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?error=access_denied&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/tasks/github?github_error=github_authorization_denied",
    });
    expect(consumeAttemptMock).toHaveBeenCalledWith({ state: "state_123" });
  });

  it("redirects denied callbacks with missing state to expired_state", async () => {
    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?error=access_denied",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/tasks/github?github_error=expired_state",
    });
    expect(lookupAttemptMock).not.toHaveBeenCalled();
    expect(consumeAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects missing or expired attempts to expired_state", async () => {
    lookupAttemptMock.mockResolvedValue(null);

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/tasks/github?github_error=expired_state",
    });
    expect(consumeAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects successful callbacks to the complete URL with attempt returnTo", async () => {
    mockAttempt(
      githubUserAccountAttempt({ returnTo: "/account/tasks/github" })
    );

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/tasks/github/complete?return_to=%2Faccount%2Ftasks%2Fgithub",
    });
  });

  it.each([
    ["external URL", "https://evil.example/path"],
    ["protocol-relative URL", "//evil.example/path"],
    ["backslash path", "/account\\settings"],
    ["too-long path", `/${"a".repeat(512)}`],
  ])("omits invalid stored %s returnTo values from completion redirects", async (_label, returnTo) => {
    mockAttempt(githubUserAccountAttempt({ returnTo }));

    await expect(
      completeGitHubUserAccountOAuth({
        requestUrl:
          "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/tasks/github/complete",
    });
  });

  it("returns public user account status fields", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      accessTokenExpiresAt: new Date("2026-05-30T12:00:00.000Z"),
      connectedAt: new Date("2026-05-30T00:00:00.000Z"),
      encryptedAccessToken: "secret_access",
      encryptedRefreshToken: "secret_refresh",
      provider: "github",
      providerUserId: "12345",
      refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
      status: "active",
    });

    await expect(
      getGitHubUserAccountStatus({ clerkUserId: "user_1" })
    ).resolves.toEqual({
      account: {
        accessTokenExpiresAt: new Date("2026-05-30T12:00:00.000Z"),
        connectedAt: new Date("2026-05-30T00:00:00.000Z"),
        provider: "github",
        providerUserId: "12345",
        refreshTokenExpiresAt: new Date("2026-11-30T00:00:00.000Z"),
        status: "active",
      },
    });
  });

  it("returns null user account status when no active account exists", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue(undefined);

    await expect(
      getGitHubUserAccountStatus({ clerkUserId: "user_1" })
    ).resolves.toEqual({ account: null });
  });

  it("disconnects the active user account", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      encryptedAccessToken: "encrypted_access",
      status: "active",
    });

    await expect(
      disconnectGitHubUserAccount({ clerkUserId: "user_1" })
    ).resolves.toEqual({ ok: true });
    expect(getFreshGitHubUserAccessTokenMock).toHaveBeenCalledWith({
      clerkUserId: "user_1",
      db: {},
    });
    expect(revokeGitHubOAuthGrantMock).toHaveBeenCalledWith({
      accessToken: "ghu_access",
      apiBaseUrl: "https://github.lightfast.localhost",
      apiVersion: "2022-11-28",
      clientId: "github_client_test",
      clientSecret: "github_secret_test",
    });
    expect(markUserSourceControlAccountRevokedMock).toHaveBeenCalledWith(
      {},
      { clerkUserId: "user_1" }
    );
  });

  it("does not revoke the local row when provider grant revocation fails", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue({
      encryptedAccessToken: "encrypted_access",
      status: "active",
    });
    revokeGitHubOAuthGrantMock.mockRejectedValue(new Error("github down"));

    await expect(
      disconnectGitHubUserAccount({ clerkUserId: "user_1" })
    ).rejects.toThrow("github down");

    expect(markUserSourceControlAccountRevokedMock).not.toHaveBeenCalled();
  });

  it("returns ok when disconnecting without an active account", async () => {
    getActiveUserSourceControlAccountMock.mockResolvedValue(undefined);

    await expect(
      disconnectGitHubUserAccount({ clerkUserId: "user_1" })
    ).resolves.toEqual({ ok: true });

    expect(revokeGitHubOAuthGrantMock).not.toHaveBeenCalled();
    expect(getFreshGitHubUserAccessTokenMock).not.toHaveBeenCalled();
    expect(markUserSourceControlAccountRevokedMock).not.toHaveBeenCalled();
  });
});

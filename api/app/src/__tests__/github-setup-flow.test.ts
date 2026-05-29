import { beforeEach, describe, expect, it, vi } from "vitest";

const consumeGitHubInstallAttemptMock = vi.fn();
const consumeGitHubOAuthAttemptMock = vi.fn();
const createGitHubPkcePairMock = vi.fn();
const exchangeGitHubOAuthCodeMock = vi.fn();
const finalizeActiveOrgProviderBindingMock = vi.fn();
const issueGitHubOAuthAttemptMock = vi.fn();
const lookupGitHubInstallAttemptMock = vi.fn();
const lookupGitHubOAuthAttemptMock = vi.fn();
const mirrorOrgBindingMock = vi.fn();
const verifyGitHubUserInstallationMock = vi.fn();
const assertOrgAdminMock = vi.fn();

class TestGitHubSetupAdminAccessError extends Error {
  constructor(
    readonly code:
      | "PERMISSION_REQUIRED"
      | "UNAUTHENTICATED" = "PERMISSION_REQUIRED",
    message = "Organization administrator access required."
  ) {
    super(message);
    this.name = "GitHubSetupAdminAccessError";
  }
}

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  finalizeActiveOrgProviderBinding: finalizeActiveOrgProviderBindingMock,
  OrgSourceControlBindingConflictError: class OrgSourceControlBindingConflictError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
      this.name = "OrgSourceControlBindingConflictError";
    }
  },
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
  GitHubAppNodeError: class GitHubAppNodeError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
      this.name = "GitHubAppNodeError";
    }
  },
  verifyGitHubUserInstallation: verifyGitHubUserInstallationMock,
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../auth/org-binding-mirror", () => ({
  mirrorOrgBinding: mirrorOrgBindingMock,
}));

vi.mock("../github/admin-access", () => ({
  assertCurrentUserIsOrgAdmin: assertOrgAdminMock,
  GitHubSetupAdminAccessError: TestGitHubSetupAdminAccessError,
}));

vi.mock("../github/bind-attempts", () => ({
  consumeGitHubInstallAttempt: consumeGitHubInstallAttemptMock,
  consumeGitHubOAuthAttempt: consumeGitHubOAuthAttemptMock,
  issueGitHubOAuthAttempt: issueGitHubOAuthAttemptMock,
  lookupGitHubInstallAttempt: lookupGitHubInstallAttemptMock,
  lookupGitHubOAuthAttempt: lookupGitHubOAuthAttemptMock,
}));

vi.mock("../github/config", () => ({
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

const { completeGitHubInstallationSetup, completeGitHubOAuthVerification } =
  await import("../github/setup-flow");
const { GitHubAppNodeError } = await import("@repo/github-app-node");
const { OrgSourceControlBindingConflictError } = await import("@db/app");

function installAttempt() {
  return {
    clerkOrgId: "org_1",
    lightfastUserId: "user_1",
    orgSlug: "acme",
  };
}

function oauthAttempt() {
  return {
    ...installAttempt(),
    codeVerifier: "verifier_123",
    providerInstallationId: "1001",
  };
}

function mockInstallAttempt(record = installAttempt()) {
  lookupGitHubInstallAttemptMock.mockResolvedValue(record);
  consumeGitHubInstallAttemptMock.mockResolvedValue(record);
  return record;
}

function mockOAuthAttempt(record = oauthAttempt()) {
  lookupGitHubOAuthAttemptMock.mockResolvedValue(record);
  consumeGitHubOAuthAttemptMock.mockResolvedValue(record);
  return record;
}

describe("github setup flow", () => {
  beforeEach(() => {
    consumeGitHubInstallAttemptMock.mockReset();
    consumeGitHubOAuthAttemptMock.mockReset();
    createGitHubPkcePairMock.mockReset();
    exchangeGitHubOAuthCodeMock.mockReset();
    finalizeActiveOrgProviderBindingMock.mockReset();
    issueGitHubOAuthAttemptMock.mockReset();
    lookupGitHubInstallAttemptMock.mockReset();
    lookupGitHubOAuthAttemptMock.mockReset();
    mirrorOrgBindingMock.mockReset();
    verifyGitHubUserInstallationMock.mockReset();
    assertOrgAdminMock.mockReset();

    assertOrgAdminMock.mockResolvedValue({ userId: "user_1" });
    createGitHubPkcePairMock.mockReturnValue({
      codeChallenge: "challenge_123",
      codeChallengeMethod: "S256",
      codeVerifier: "verifier_123",
    });
    issueGitHubOAuthAttemptMock.mockResolvedValue({
      attemptId: "oauth_attempt_1",
      state: "oauth_state_123",
    });
    exchangeGitHubOAuthCodeMock.mockResolvedValue({
      accessToken: "github_user_token",
      tokenType: "bearer",
    });
    verifyGitHubUserInstallationMock.mockResolvedValue({
      account: {
        id: "9001",
        login: "acme",
        type: "Organization",
      },
      appId: "12345",
      appSlug: "lightfast-test",
      events: ["push"],
      id: "1001",
      permissions: { contents: "read" },
      repositorySelection: "all",
      targetType: "Organization",
    });
  });

  it("redirects installation setup to the configured OAuth authorize URL", async () => {
    mockInstallAttempt();

    const result = await completeGitHubInstallationSetup({
      appOrigin: "https://app.lightfast.localhost",
      requestUrl:
        "https://app.lightfast.localhost/api/github/setup?installation_id=1001&setup_action=install&state=install_state_123",
    });

    expect(result).toEqual({
      redirectUrl:
        "https://github.lightfast.localhost/login/oauth/authorize?client_id=github_client_test&redirect_uri=https%3A%2F%2Fapp.lightfast.localhost%2Fapi%2Fgithub%2Foauth%2Fcallback&state=oauth_state_123&code_challenge=challenge_123&code_challenge_method=S256",
    });
    expect(issueGitHubOAuthAttemptMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
    });
  });

  it("redirects a successful OAuth callback to the completion page", async () => {
    mockOAuthAttempt();

    const result = await completeGitHubOAuthVerification({
      appOrigin: "https://app.lightfast.localhost",
      requestUrl:
        "https://app.lightfast.localhost/api/github/oauth/callback?code=code_123&state=oauth_state_123",
    });

    expect(result).toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind/github/complete",
    });
    expect(finalizeActiveOrgProviderBindingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clerkOrgId: "org_1",
        connectedByUserId: "user_1",
        provider: "github",
        providerAccountId: "9001",
        providerAccountLogin: "acme",
        providerInstallationId: "1001",
      })
    );
    expect(exchangeGitHubOAuthCodeMock).toHaveBeenCalledWith({
      clientId: "github_client_test",
      clientSecret: "github_secret_test",
      code: "code_123",
      codeVerifier: "verifier_123",
      redirectUri: "https://app.lightfast.localhost/api/github/oauth/callback",
      tokenUrl: "https://github.lightfast.localhost/login/oauth/access_token",
    });
    expect(verifyGitHubUserInstallationMock).toHaveBeenCalledWith({
      apiBaseUrl: "https://github.lightfast.localhost",
      apiVersion: "2022-11-28",
      expectedInstallationId: "1001",
      userAccessToken: "github_user_token",
    });
    expect(
      finalizeActiveOrgProviderBindingMock.mock.calls[0]?.[1].metadata
    ).toEqual({
      events: ["push"],
      githubAppId: "12345",
      githubAppSlug: "lightfast-test",
      permissions: { contents: "read" },
      repositorySelection: "all",
    });
    expect(mirrorOrgBindingMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
      provider: "github",
      status: "bound",
    });
  });

  it("uses a neutral fallback route when state is missing", async () => {
    const result = await completeGitHubInstallationSetup({
      appOrigin: "https://app.lightfast.localhost",
      requestUrl:
        "https://app.lightfast.localhost/api/github/setup?org_slug=attacker",
    });

    expect(result).toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/teams?github_error=expired_state",
    });
  });

  it("does not consume install attempts when admin verification fails", async () => {
    mockInstallAttempt();
    assertOrgAdminMock.mockRejectedValue(new TestGitHubSetupAdminAccessError());

    await expect(
      completeGitHubInstallationSetup({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/setup?installation_id=1001&state=install_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind?github_error=permission_required",
    });
    expect(lookupGitHubInstallAttemptMock).toHaveBeenCalledWith({
      state: "install_state_123",
    });
    expect(consumeGitHubInstallAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated install callbacks to sign-in without consuming the attempt", async () => {
    mockInstallAttempt();
    assertOrgAdminMock.mockRejectedValue(
      new TestGitHubSetupAdminAccessError("UNAUTHENTICATED")
    );

    await expect(
      completeGitHubInstallationSetup({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/setup?installation_id=1001&state=install_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/sign-in?redirect_url=%2Fapi%2Fgithub%2Fsetup%3Finstallation_id%3D1001%26state%3Dinstall_state_123",
    });
    expect(consumeGitHubInstallAttemptMock).not.toHaveBeenCalled();
  });

  it("carries the callback installation id into the OAuth attempt", async () => {
    mockInstallAttempt();

    await completeGitHubInstallationSetup({
      appOrigin: "https://app.lightfast.localhost",
      requestUrl:
        "https://app.lightfast.localhost/api/github/setup?installation_id=7777&setup_action=install&state=install_state_123",
    });

    expect(issueGitHubOAuthAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ providerInstallationId: "7777" })
    );
  });

  it("maps OAuth denial with a consumable attempt to github_authorization_denied", async () => {
    mockOAuthAttempt();

    await expect(
      completeGitHubOAuthVerification({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/oauth/callback?error=access_denied&state=oauth_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind?github_error=github_authorization_denied",
    });
  });

  it("does not consume denied OAuth attempts when admin verification fails", async () => {
    mockOAuthAttempt();
    assertOrgAdminMock.mockRejectedValue(new TestGitHubSetupAdminAccessError());

    await expect(
      completeGitHubOAuthVerification({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/oauth/callback?error=access_denied&state=oauth_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind?github_error=permission_required",
    });
    expect(lookupGitHubOAuthAttemptMock).toHaveBeenCalledWith({
      state: "oauth_state_123",
    });
    expect(consumeGitHubOAuthAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated denied OAuth callbacks to sign-in without consuming the attempt", async () => {
    mockOAuthAttempt();
    assertOrgAdminMock.mockRejectedValue(
      new TestGitHubSetupAdminAccessError("UNAUTHENTICATED")
    );

    await expect(
      completeGitHubOAuthVerification({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/oauth/callback?error=access_denied&state=oauth_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/sign-in?redirect_url=%2Fapi%2Fgithub%2Foauth%2Fcallback%3Ferror%3Daccess_denied%26state%3Doauth_state_123",
    });
    expect(consumeGitHubOAuthAttemptMock).not.toHaveBeenCalled();
  });

  it("does not consume OAuth attempts when admin verification fails", async () => {
    mockOAuthAttempt();
    assertOrgAdminMock.mockRejectedValue(new TestGitHubSetupAdminAccessError());

    await expect(
      completeGitHubOAuthVerification({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/oauth/callback?code=code_123&state=oauth_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind?github_error=permission_required",
    });
    expect(lookupGitHubOAuthAttemptMock).toHaveBeenCalledWith({
      state: "oauth_state_123",
    });
    expect(consumeGitHubOAuthAttemptMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated OAuth callbacks to sign-in without consuming the attempt", async () => {
    mockOAuthAttempt();
    assertOrgAdminMock.mockRejectedValue(
      new TestGitHubSetupAdminAccessError("UNAUTHENTICATED")
    );

    await expect(
      completeGitHubOAuthVerification({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/oauth/callback?code=code_123&state=oauth_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/sign-in?redirect_url=%2Fapi%2Fgithub%2Foauth%2Fcallback%3Fcode%3Dcode_123%26state%3Doauth_state_123",
    });
    expect(consumeGitHubOAuthAttemptMock).not.toHaveBeenCalled();
  });

  it("maps personal account verification failures to personal_account_not_supported", async () => {
    mockOAuthAttempt();
    verifyGitHubUserInstallationMock.mockRejectedValue(
      new GitHubAppNodeError(
        "PERSONAL_ACCOUNT_NOT_SUPPORTED",
        "Only GitHub organization installations are supported."
      )
    );

    await expect(
      completeGitHubOAuthVerification({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/oauth/callback?code=code_123&state=oauth_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind?github_error=personal_account_not_supported",
    });
  });

  it("maps provider installation conflicts to installation_already_bound", async () => {
    mockOAuthAttempt();
    finalizeActiveOrgProviderBindingMock.mockRejectedValue(
      new OrgSourceControlBindingConflictError(
        "INSTALLATION_ALREADY_BOUND",
        "Provider installation is already bound"
      )
    );

    await expect(
      completeGitHubOAuthVerification({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/oauth/callback?code=code_123&state=oauth_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind?github_error=installation_already_bound",
    });
  });

  it("tolerates mirror failure after DB bind and still redirects to completion", async () => {
    mockOAuthAttempt();
    mirrorOrgBindingMock.mockRejectedValue(new Error("mirror unavailable"));

    await expect(
      completeGitHubOAuthVerification({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/oauth/callback?code=code_123&state=oauth_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind/github/complete",
    });
  });
});

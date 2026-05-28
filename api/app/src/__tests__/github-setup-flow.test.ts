import { beforeEach, describe, expect, it, vi } from "vitest";

const consumeGitHubInstallAttemptMock = vi.fn();
const consumeGitHubOAuthAttemptMock = vi.fn();
const createGitHubPkcePairMock = vi.fn();
const exchangeGitHubOAuthCodeMock = vi.fn();
const finalizeActiveOrgProviderBindingMock = vi.fn();
const issueGitHubOAuthAttemptMock = vi.fn();
const mirrorOrgBindingMock = vi.fn();
const verifyGitHubEmulatorInstallationMock = vi.fn();
const assertOrgAdminMock = vi.fn();

class TestGitHubSetupAdminAccessError extends Error {
  constructor(message = "Organization administrator access required.") {
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
  buildGitHubOAuthAuthorizeUrl: (input: {
    authorizationBaseUrl?: string;
    clientId: string;
    codeChallenge: string;
    redirectUri: string;
    state: string;
  }) => {
    const url = new URL(
      input.authorizationBaseUrl ?? "https://github.com/login/oauth/authorize"
    );
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },
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
  verifyGitHubEmulatorInstallation: verifyGitHubEmulatorInstallationMock,
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
}));

vi.mock("../github/config", () => ({
  getGitHubEmulatorConfig: () => ({
    clientId: "github_client_test",
    clientSecret: "github_secret_test",
  }),
}));

const {
  completeGitHubInstallationSetup,
  completeGitHubOAuthVerification,
} = await import("../github/setup-flow");
const { GitHubAppNodeError } = await import("@repo/github-app-node");
const { OrgSourceControlBindingConflictError } = await import("@db/app");

function installAttempt() {
  return {
    clerkOrgId: "org_1",
    emulator: {
      emulatorOrigin: "http://127.0.0.1:4567",
      installationId: "1001",
      providerAccountLogin: "lightfast-emulated",
    },
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

describe("github setup flow", () => {
  beforeEach(() => {
    consumeGitHubInstallAttemptMock.mockReset();
    consumeGitHubOAuthAttemptMock.mockReset();
    createGitHubPkcePairMock.mockReset();
    exchangeGitHubOAuthCodeMock.mockReset();
    finalizeActiveOrgProviderBindingMock.mockReset();
    issueGitHubOAuthAttemptMock.mockReset();
    mirrorOrgBindingMock.mockReset();
    verifyGitHubEmulatorInstallationMock.mockReset();
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
    verifyGitHubEmulatorInstallationMock.mockResolvedValue({
      account: {
        id: "2001",
        login: "lightfast-emulated",
        type: "Organization",
      },
      appId: "12345",
      appSlug: "lightfast-test",
      events: ["push"],
      id: "1001",
      permissions: { contents: "read" },
      repositorySelection: "all",
      suspendedAt: null,
      targetType: "Organization",
    });
  });

  it("redirects installation setup to the emulator OAuth authorize URL", async () => {
    consumeGitHubInstallAttemptMock.mockResolvedValue(installAttempt());

    const result = await completeGitHubInstallationSetup({
      appOrigin: "https://app.lightfast.localhost",
      requestUrl:
        "https://app.lightfast.localhost/api/github/setup?installation_id=1001&setup_action=install&state=install_state_123",
    });

    expect(result).toEqual({
      redirectUrl:
        "http://127.0.0.1:4567/login/oauth/authorize?client_id=github_client_test&redirect_uri=https%3A%2F%2Fapp.lightfast.localhost%2Fapi%2Fgithub%2Foauth%2Fcallback&state=oauth_state_123&code_challenge=challenge_123&code_challenge_method=S256",
    });
    expect(issueGitHubOAuthAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_1",
        codeVerifier: "verifier_123",
        providerInstallationId: "1001",
      })
    );
  });

  it("redirects a successful OAuth callback to the completion page", async () => {
    consumeGitHubOAuthAttemptMock.mockResolvedValue(oauthAttempt());

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
        providerAccountId: "2001",
        providerAccountLogin: "lightfast-emulated",
        providerInstallationId: "1001",
      })
    );
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

  it("maps admin/session mismatch on consumed install attempts to permission_required", async () => {
    consumeGitHubInstallAttemptMock.mockResolvedValue(installAttempt());
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
  });

  it("maps installation id mismatch to installation_not_verified", async () => {
    consumeGitHubInstallAttemptMock.mockResolvedValue(installAttempt());

    await expect(
      completeGitHubInstallationSetup({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://app.lightfast.localhost/api/github/setup?installation_id=9999&state=install_state_123",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind?github_error=installation_not_verified",
    });
  });

  it("maps OAuth denial with a consumable attempt to github_authorization_denied", async () => {
    consumeGitHubOAuthAttemptMock.mockResolvedValue(oauthAttempt());

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

  it("maps personal account verification failures to personal_account_not_supported", async () => {
    consumeGitHubOAuthAttemptMock.mockResolvedValue(oauthAttempt());
    verifyGitHubEmulatorInstallationMock.mockRejectedValue(
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
    consumeGitHubOAuthAttemptMock.mockResolvedValue(oauthAttempt());
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
    consumeGitHubOAuthAttemptMock.mockResolvedValue(oauthAttempt());
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

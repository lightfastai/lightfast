import { describe, expect, it } from "vitest";
import {
  GITHUB_BIND_ERROR_CODES,
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_SETUP_PATH,
  GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH,
  githubBindStartOutputSchema,
  githubInstallationMetadataSchema,
  githubNormalizedInstallationSchema,
  githubUserAccountBindErrorCodeSchema,
} from "../github-app";

describe("@repo/github-app-contract", () => {
  it("exports stable product callback route constants", () => {
    expect(GITHUB_SETUP_PATH).toBe("/api/github/setup");
    expect(GITHUB_OAUTH_CALLBACK_PATH).toBe("/api/github/oauth/callback");
  });

  it("exports the GitHub user account OAuth callback path", () => {
    expect(GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH).toBe(
      "/api/github/user/oauth/callback"
    );
  });

  it("accepts user account bind error codes and rejects org-only errors", () => {
    expect(
      githubUserAccountBindErrorCodeSchema.parse("missing_refresh_token")
    ).toBe("missing_refresh_token");
    expect(
      githubUserAccountBindErrorCodeSchema.parse("github_account_already_bound")
    ).toBe("github_account_already_bound");
    expect(() =>
      githubUserAccountBindErrorCodeSchema.parse("installation_not_verified")
    ).toThrow();
  });

  it("validates client-safe start output for a GitHub App install URL", () => {
    expect(
      githubBindStartOutputSchema.parse({
        installationUrl:
          "https://github.com/apps/lightfast-local/installations/new?state=abc",
      })
    ).toEqual({
      installationUrl:
        "https://github.com/apps/lightfast-local/installations/new?state=abc",
    });
  });

  it("keeps bind error codes compact", () => {
    expect(GITHUB_BIND_ERROR_CODES).toContain("expired_state");
    expect(GITHUB_BIND_ERROR_CODES).toContain("installation_not_verified");
    expect(GITHUB_BIND_ERROR_CODES).toContain("org_already_bound");
  });

  it("normalizes organization installations only when account metadata is present", () => {
    expect(
      githubNormalizedInstallationSchema.parse({
        appId: "424242",
        appSlug: "lightfast-local",
        events: ["issues"],
        id: "1001",
        permissions: { contents: "read" },
        repositorySelection: "all",
        targetType: "Organization",
        account: {
          id: "123",
          login: "lightfast-emulated",
          type: "Organization",
        },
      })
    ).toMatchObject({
      account: { login: "lightfast-emulated" },
      id: "1001",
      targetType: "Organization",
    });
  });

  it("stores GitHub installation metadata without environment provenance", () => {
    const metadata = githubInstallationMetadataSchema.parse({
      events: ["push"],
      githubAppId: "424242",
      githubAppSlug: "lightfast-local",
      githubSetupAction: "install",
      permissions: { contents: "read" },
      repositorySelection: "all",
    });

    expect(metadata).toEqual({
      events: ["push"],
      githubAppId: "424242",
      githubAppSlug: "lightfast-local",
      githubSetupAction: "install",
      permissions: { contents: "read" },
      repositorySelection: "all",
    });
    expect(
      githubInstallationMetadataSchema.safeParse({
        ...metadata,
        verifiedBy: "github_emulator",
      }).success
    ).toBe(false);
  });

  it("does not reject unknown non-provenance installation metadata keys", () => {
    expect(
      githubInstallationMetadataSchema.safeParse({
        events: ["push"],
        githubAppId: "424242",
        githubAppSlug: "lightfast-local",
        permissions: { contents: "read" },
        repositorySelection: "all",
        source: "future_metadata",
      }).success
    ).toBe(true);
  });
});

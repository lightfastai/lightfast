import { describe, expect, it } from "vitest";
import {
  buildGitHubInstallationUrl,
  buildGitHubNewRepositoryUrl,
  buildGitHubOAuthAuthorizeUrl,
} from "../urls";

describe("GitHub URL builders", () => {
  it("builds a default GitHub App installation URL", () => {
    expect(
      buildGitHubInstallationUrl({
        appSlug: "lightfast-local",
        state: "state_123",
      })
    ).toBe(
      "https://github.com/apps/lightfast-local/installations/new?state=state_123"
    );
  });

  it("builds a custom-origin GitHub App installation URL", () => {
    expect(
      buildGitHubInstallationUrl({
        appSlug: "lightfast-local",
        state: "state_123",
        webBaseUrl: "https://github.lightfast.localhost",
      })
    ).toBe(
      "https://github.lightfast.localhost/apps/lightfast-local/installations/new?state=state_123"
    );
  });

  it("builds a custom-origin new repository URL", () => {
    expect(
      buildGitHubNewRepositoryUrl({
        accountLogin: "lightfast-emulated",
        name: ".lightfast",
        webBaseUrl: "https://github.lightfast.localhost",
      })
    ).toBe(
      "https://github.lightfast.localhost/organizations/lightfast-emulated/repositories/new?name=.lightfast"
    );
  });

  it("builds a default OAuth authorize URL", () => {
    const url = new URL(
      buildGitHubOAuthAuthorizeUrl({
        clientId: "Iv1.lightfastlocal",
        codeChallenge: "challenge",
        redirectUri: "https://app.lightfast.ai/api/github/oauth/callback",
        state: "state_456",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize"
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.lightfastlocal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("builds a custom OAuth authorize URL", () => {
    const url = new URL(
      buildGitHubOAuthAuthorizeUrl({
        clientId: "Iv1.lightfastlocal",
        codeChallenge: "challenge",
        oauthAuthorizeUrl:
          "https://github.lightfast.localhost/login/oauth/authorize",
        redirectUri:
          "https://app.lightfast.localhost/api/github/oauth/callback",
        state: "state_456",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "https://github.lightfast.localhost/login/oauth/authorize"
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.lightfast.localhost/api/github/oauth/callback"
    );
  });
});

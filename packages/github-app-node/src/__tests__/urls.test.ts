import { describe, expect, it } from "vitest";
import {
  buildGitHubInstallationUrl,
  buildGitHubOAuthAuthorizeUrl,
} from "../urls";

describe("GitHub URL builders", () => {
  it("appends state to the dev install override", () => {
    expect(
      buildGitHubInstallationUrl({
        appSlug: "lightfast-local",
        installUrlOverride:
          "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001",
        state: "state_123",
      })
    ).toBe(
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001&state=state_123"
    );
  });

  it("builds a GitHub App installation URL when no override is provided", () => {
    expect(
      buildGitHubInstallationUrl({
        appSlug: "lightfast-local",
        state: "state_123",
      })
    ).toBe(
      "https://github.com/apps/lightfast-local/installations/new?state=state_123"
    );
  });

  it("builds an OAuth authorize URL against an emulator origin", () => {
    const url = new URL(
      buildGitHubOAuthAuthorizeUrl({
        authorizationBaseUrl: "http://127.0.0.1:4567/login/oauth/authorize",
        clientId: "Iv1.lightfastlocal",
        codeChallenge: "challenge",
        redirectUri: "https://app.lightfast.localhost/api/github/oauth/callback",
        state: "state_456",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "http://127.0.0.1:4567/login/oauth/authorize"
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.lightfastlocal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

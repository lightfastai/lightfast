import { describe, expect, it } from "vitest";
import {
  GITHUB_BIND_ERROR_CODES,
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_SETUP_PATH,
  githubBindStartOutputSchema,
  githubNormalizedInstallationSchema,
} from "../github-app";

describe("@repo/github-app-contract", () => {
  it("exports stable callback route constants", () => {
    expect(GITHUB_SETUP_PATH).toBe("/api/github/setup");
    expect(GITHUB_OAUTH_CALLBACK_PATH).toBe("/api/github/oauth/callback");
  });

  it("validates client-safe start output", () => {
    expect(
      githubBindStartOutputSchema.parse({
        installationUrl:
          "https://app.lightfast.localhost/api/dev/github/install?state=abc",
      })
    ).toEqual({
      installationUrl:
        "https://app.lightfast.localhost/api/dev/github/install?state=abc",
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
});

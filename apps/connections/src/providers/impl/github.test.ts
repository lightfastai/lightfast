import { describe, it, expect, vi } from "vitest";

vi.mock("../../env", () => ({
  env: {
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    GITHUB_APP_SLUG: "test-app",
    GITHUB_APP_ID: "12345",
    GITHUB_PRIVATE_KEY: "test-key",
    ENCRYPTION_KEY: "a".repeat(64),
  },
}));

vi.mock("../../lib/urls", () => ({
  connectionsBaseUrl: "https://connections.test",
  notifyBackfillService: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@db/console/client", () => ({
  db: {},
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: {},
  gwTokens: {},
}));

vi.mock("../../lib/github-jwt", () => ({
  getInstallationToken: vi.fn().mockResolvedValue("test-token"),
}));

import { GitHubProvider } from "./github";

const provider = new GitHubProvider();

describe("GitHubProvider", () => {
  it("has correct provider name and webhook flag", () => {
    expect(provider.name).toBe("github");
    expect(provider.requiresWebhookRegistration).toBe(false);
  });

  describe("getAuthorizationUrl", () => {
    it("builds correct GitHub OAuth URL with state", () => {
      const url = provider.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://github.com");
      expect(parsed.pathname).toBe("/login/oauth/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
      expect(parsed.searchParams.get("state")).toBe("test-state");
    });

    it("includes redirect_uri when redirectPath option is set", () => {
      const url = provider.getAuthorizationUrl("state", {
        redirectPath: "/callback",
      });
      const parsed = new URL(url);
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://connections.test/connections/github/callback",
      );
    });
  });

  describe("getInstallationUrl", () => {
    it("builds correct GitHub App installation URL", () => {
      const url = provider.getInstallationUrl("test-state");
      const parsed = new URL(url);
      expect(parsed.pathname).toBe("/apps/test-app/installations/new");
      expect(parsed.searchParams.get("state")).toBe("test-state");
    });

    it("includes target_id when provided", () => {
      const url = provider.getInstallationUrl("state", "target-123");
      const parsed = new URL(url);
      expect(parsed.searchParams.get("target_id")).toBe("target-123");
    });
  });

  describe("refreshToken", () => {
    it("rejects — GitHub user tokens do not support refresh", async () => {
      await expect(provider.refreshToken("any")).rejects.toThrow(
        "GitHub user tokens do not support refresh",
      );
    });
  });

  describe("buildAccountInfo", () => {
    it("builds GitHub account info with installation data", () => {
      const info = provider.buildAccountInfo({
        installationId: "inst-42",
        accountLogin: "my-org",
      });
      expect(info).toMatchObject({
        version: 1,
        sourceType: "github",
        installations: [
          expect.objectContaining({
            id: "inst-42",
            accountLogin: "my-org",
          }),
        ],
      });
    });

    it("defaults to 'unknown' accountLogin when not provided", () => {
      const info = provider.buildAccountInfo({ installationId: "inst-1" });
      expect(info).toMatchObject({
        installations: [expect.objectContaining({ accountLogin: "unknown" })],
      });
    });

    it("uses accountType from stateData", () => {
      const info = provider.buildAccountInfo({
        installationId: "inst-42",
        accountLogin: "my-user",
        accountType: "User",
      });
      expect(info).toMatchObject({
        installations: [expect.objectContaining({ accountType: "User" })],
      });
    });

    it("defaults accountType to 'unknown' when not provided", () => {
      const info = provider.buildAccountInfo({ installationId: "inst-1" });
      expect(info).toMatchObject({
        installations: [expect.objectContaining({ accountType: "unknown" })],
      });
    });
  });
});

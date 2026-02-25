import { describe, it, expect, vi } from "vitest";

vi.mock("../../env", () => ({
  env: {
    VERCEL_CLIENT_SECRET_ID: "test-vc-client-id",
    VERCEL_CLIENT_INTEGRATION_SECRET: "test-vc-secret",
    VERCEL_INTEGRATION_SLUG: "test-integration",
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

import { VercelProvider } from "./vercel";

const provider = new VercelProvider();

describe("VercelProvider", () => {
  it("has correct provider name and webhook flag", () => {
    expect(provider.name).toBe("vercel");
    expect(provider.requiresWebhookRegistration).toBe(false);
  });

  describe("getAuthorizationUrl", () => {
    it("builds correct Vercel integration URL with state", () => {
      const url = provider.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://vercel.com");
      expect(parsed.pathname).toBe("/integrations/test-integration/new");
      expect(parsed.searchParams.get("state")).toBe("test-state");
    });
  });

  describe("refreshToken", () => {
    it("rejects — Vercel tokens do not support refresh", async () => {
      await expect(provider.refreshToken("any")).rejects.toThrow(
        "Vercel tokens do not support refresh",
      );
    });
  });

  describe("buildAccountInfo", () => {
    it("builds Vercel account info from OAuth response", () => {
      const info = provider.buildAccountInfo(
        { connectedBy: "user-1" },
        {
          accessToken: "tok",
          raw: { team_id: "team_abc", team_slug: "my-team" },
        },
      );
      expect(info).toMatchObject({
        version: 1,
        sourceType: "vercel",
        userId: "user-1",
        teamId: "team_abc",
        teamSlug: "my-team",
      });
    });

    it("handles missing OAuth data gracefully", () => {
      const info = provider.buildAccountInfo({ connectedBy: "user-1" });
      expect(info).toMatchObject({
        version: 1,
        sourceType: "vercel",
        userId: "user-1",
      });
    });
  });
});

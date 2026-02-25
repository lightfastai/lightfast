import { describe, it, expect, vi } from "vitest";

vi.mock("../../env", () => ({
  env: {
    LINEAR_CLIENT_ID: "test-lin-client-id",
    LINEAR_CLIENT_SECRET: "test-lin-secret",
    ENCRYPTION_KEY: "a".repeat(64),
  },
}));

vi.mock("../../lib/urls", () => ({
  connectionsBaseUrl: "https://connections.test",
  gatewayBaseUrl: "https://gateway.test",
  notifyBackfillService: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@db/console/client", () => ({
  db: {},
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: {},
  gwTokens: {},
}));

vi.mock("../../lib/crypto", () => ({
  decrypt: vi.fn().mockResolvedValue("decrypted-token"),
}));

vi.mock("../../lib/token-store", () => ({
  writeTokenRecord: vi.fn().mockResolvedValue(undefined),
}));

import { LinearProvider } from "./linear";

const provider = new LinearProvider();

describe("LinearProvider", () => {
  it("has correct provider name and webhook flag", () => {
    expect(provider.name).toBe("linear");
    expect(provider.requiresWebhookRegistration).toBe(true);
  });

  describe("getAuthorizationUrl", () => {
    it("builds correct Linear OAuth URL with default scopes", () => {
      const url = provider.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://linear.app");
      expect(parsed.pathname).toBe("/oauth/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("test-lin-client-id");
      expect(parsed.searchParams.get("state")).toBe("test-state");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("scope")).toBe("read,write");
    });

    it("uses custom scopes when provided", () => {
      const url = provider.getAuthorizationUrl("state", {
        scopes: ["read"],
      });
      const parsed = new URL(url);
      expect(parsed.searchParams.get("scope")).toBe("read");
    });
  });

  describe("refreshToken", () => {
    it("rejects — Linear tokens do not support refresh", async () => {
      await expect(provider.refreshToken("any")).rejects.toThrow(
        "Linear tokens do not support refresh",
      );
    });
  });

  describe("buildAccountInfo", () => {
    it("builds minimal Linear account info", () => {
      const info = provider.buildAccountInfo({});
      expect(info).toEqual({ version: 1, sourceType: "linear" });
    });
  });
});

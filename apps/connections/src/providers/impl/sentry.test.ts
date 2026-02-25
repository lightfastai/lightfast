import { describe, it, expect, vi } from "vitest";

vi.mock("../../env", () => ({
  env: {
    SENTRY_CLIENT_ID: "test-sn-client-id",
    SENTRY_CLIENT_SECRET: "test-sn-secret",
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
  updateTokenRecord: vi.fn().mockResolvedValue(undefined),
}));

import { SentryProvider } from "./sentry";

const provider = new SentryProvider();

describe("SentryProvider", () => {
  it("has correct provider name and webhook flag", () => {
    expect(provider.name).toBe("sentry");
    expect(provider.requiresWebhookRegistration).toBe(true);
  });

  describe("getAuthorizationUrl", () => {
    it("builds correct Sentry external install URL with state", () => {
      const url = provider.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://sentry.io");
      expect(parsed.pathname).toBe(
        "/sentry-apps/test-sn-client-id/external-install/",
      );
      expect(parsed.searchParams.get("state")).toBe("test-state");
    });
  });

  describe("registerWebhook", () => {
    it("returns static ID (configured in Sentry dev settings)", async () => {
      const id = await provider.registerWebhook("conn-1", "url", "secret");
      expect(id).toBe("sentry-webhook-registered");
    });
  });

  describe("deregisterWebhook", () => {
    it("is a no-op (handled by token revocation)", async () => {
      await expect(
        provider.deregisterWebhook("conn-1", "wh-1"),
      ).resolves.toBeUndefined();
    });
  });

  describe("buildAccountInfo", () => {
    it("builds minimal Sentry account info", () => {
      const info = provider.buildAccountInfo({});
      expect(info).toEqual({ version: 1, sourceType: "sentry" });
    });
  });
});

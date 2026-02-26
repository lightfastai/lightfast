import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../env", () => ({
  env: {
    LINEAR_CLIENT_ID: "test-lin-client-id",
    LINEAR_CLIENT_SECRET: "test-lin-secret",
    ENCRYPTION_KEY: "a".repeat(64),
  },
}));

vi.mock("../../lib/urls", () => ({
  connectionsBaseUrl: "https://connections.test/api",
  gatewayBaseUrl: "https://gateway.test/api",
  notifyBackfillService: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@db/console/client", () => ({
  db: {},
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: {},
  gwTokens: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("../../lib/crypto", () => ({
  decrypt: vi.fn().mockResolvedValue("decrypted-token"),
}));

vi.mock("../../lib/token-store", () => ({
  writeTokenRecord: vi.fn().mockResolvedValue(undefined),
}));

import { LinearProvider } from "./linear.js";
import { db } from "@db/console/client";
import { decrypt } from "../../lib/crypto.js";

const provider = new LinearProvider();

describe("LinearProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  describe("exchangeCode", () => {
    it("returns parsed tokens on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "lin-tok-123",
          token_type: "Bearer",
          scope: "read,write",
          expires_in: 315360000,
        }),
      } as unknown as Response);

      const result = await provider.exchangeCode(
        "auth-code",
        "https://redirect.test",
      );

      expect(result.accessToken).toBe("lin-tok-123");
      expect(result.tokenType).toBe("Bearer");
      expect(result.scope).toBe("read,write");
      expect(result.expiresIn).toBe(315360000);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.linear.app/oauth/token",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(
        provider.exchangeCode("bad-code", "https://redirect.test"),
      ).rejects.toThrow("Linear token exchange failed: 401");
    });
  });

  describe("revokeToken", () => {
    it("succeeds on ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await expect(provider.revokeToken("tok-123")).resolves.toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.linear.app/oauth/revoke",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer tok-123",
          }),
        }),
      );
    });

    it("succeeds on 204 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 204,
      } as Response);

      await expect(provider.revokeToken("tok-123")).resolves.toBeUndefined();
    });

    it("throws on error response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(provider.revokeToken("tok-123")).rejects.toThrow(
        "Linear token revocation failed: 500",
      );
    });
  });

  describe("resolveToken", () => {
    function mockDbSelect(rows: unknown[]) {
      const mockLimit = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db as Record<string, unknown>).select = vi
        .fn()
        .mockReturnValue({ from: mockFrom });
    }

    it("returns decrypted token for valid row without expiry", async () => {
      mockDbSelect([{ accessToken: "encrypted-tok", expiresAt: null }]);

      const result = await provider.resolveToken({ id: "inst-1" } as any);

      expect(result).toEqual({
        accessToken: "decrypted-token",
        provider: "linear",
        expiresIn: null,
      });
      expect(decrypt).toHaveBeenCalledWith("encrypted-tok", "a".repeat(64));
    });

    it("throws when no token row exists", async () => {
      mockDbSelect([]);

      await expect(
        provider.resolveToken({ id: "inst-1" } as any),
      ).rejects.toThrow("no_token_found");
    });

    it("throws when token is expired", async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      mockDbSelect([{ accessToken: "encrypted-tok", expiresAt: pastDate }]);

      await expect(
        provider.resolveToken({ id: "inst-1" } as any),
      ).rejects.toThrow("token_expired");
    });

    it("returns expiresIn for token with future expiry", async () => {
      const futureDate = new Date(Date.now() + 3600_000).toISOString();
      mockDbSelect([{ accessToken: "encrypted-tok", expiresAt: futureDate }]);

      const result = await provider.resolveToken({ id: "inst-1" } as any);

      expect(result.accessToken).toBe("decrypted-token");
      expect(result.provider).toBe("linear");
      expect(result.expiresIn).toBeGreaterThan(3500);
      expect(result.expiresIn).toBeLessThanOrEqual(3600);
    });
  });
});

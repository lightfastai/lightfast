import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";

vi.mock("../../env", () => ({
  env: {
    LINEAR_CLIENT_ID: "test-lin-client-id",
    LINEAR_CLIENT_SECRET: "test-lin-secret",
    ENCRYPTION_KEY: "a".repeat(64),
  },
}));

vi.mock("../../lib/urls", () => ({
  connectionsBaseUrl: "https://connections.test/services",
  gatewayBaseUrl: "https://gateway.test/api",
  notifyBackfillService: vi.fn().mockResolvedValue(undefined),
}));

// Hoisted so vi.mock factories can reference them
const dbMocks = vi.hoisted(() => {
  // INSERT chain
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });

  // SELECT chain (pre-check + resolveToken)
  const selectLimit = vi.fn();
  const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  // UPDATE chain (webhook registration)
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    insert, values, onConflictDoUpdate, returning,
    select, selectLimit,
    update, updateSet, updateWhere,
  };
});

vi.mock("@db/console/client", () => ({
  db: {
    insert: dbMocks.insert,
    select: dbMocks.select,
    update: dbMocks.update,
  },
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: {},
  gwTokens: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("../../lib/token-store", () => ({
  writeTokenRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/lib", () => ({
  nanoid: vi.fn().mockReturnValue("mock-secret-32chars-padding-here"),
  decrypt: vi.fn().mockReturnValue("decrypted-token"),
  encrypt: vi.fn().mockReturnValue("encrypted-value"),
}));

import { LinearProvider } from "./linear.js";
import { db } from "@db/console/client";
import { decrypt } from "@repo/lib";
import { notifyBackfillService } from "../../lib/urls.js";

const provider = new LinearProvider();

describe("LinearProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Drizzle INSERT chain
    dbMocks.insert.mockReturnValue({ values: dbMocks.values });
    dbMocks.values.mockReturnValue({ onConflictDoUpdate: dbMocks.onConflictDoUpdate });
    dbMocks.onConflictDoUpdate.mockReturnValue({ returning: dbMocks.returning });
    // Reset Drizzle SELECT chain
    const selectWhere = vi.fn().mockReturnValue({ limit: dbMocks.selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    dbMocks.select.mockReturnValue({ from: selectFrom });
    // Reset Drizzle UPDATE chain
    dbMocks.update.mockReturnValue({ set: dbMocks.updateSet });
    dbMocks.updateSet.mockReturnValue({ where: dbMocks.updateWhere });
    dbMocks.updateWhere.mockResolvedValue(undefined);
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
    it("builds Linear account info with scope from OAuth response", () => {
      const info = provider.buildAccountInfo(
        {},
        { accessToken: "tok", scope: "read,write", raw: {} },
      );
      expect(info).toEqual({ version: 1, sourceType: "linear", scope: "read,write" });
    });

    it("defaults scope to empty string when not in OAuth response", () => {
      const info = provider.buildAccountInfo({});
      expect(info).toEqual({ version: 1, sourceType: "linear", scope: "" });
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
        ok: true,
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

  describe("handleCallback", () => {
    function mockContext(query: Record<string, string | undefined>): Context {
      return {
        req: { query: (key: string) => query[key] },
      } as unknown as Context;
    }

    it("creates installation and triggers webhook + backfill for new connections", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "lin-tok",
            token_type: "Bearer",
            scope: "read,write",
            expires_in: 315360000,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { viewer: { id: "v1", organization: { id: "org-ext-1" } } },
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { webhookCreate: { success: true, webhook: { id: "wh-1" } } },
          }),
        } as unknown as Response);

      dbMocks.selectLimit.mockResolvedValue([]); // No existing row
      dbMocks.returning.mockResolvedValue([{ id: "inst-lin-new" }]);

      const c = mockContext({ code: "auth-code" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(result).toMatchObject({
        status: "connected",
        installationId: "inst-lin-new",
        provider: "linear",
      });
      expect(result).not.toHaveProperty("reactivated");
      expect(notifyBackfillService).toHaveBeenCalledWith({
        installationId: "inst-lin-new",
        provider: "linear",
        orgId: "org-1",
      });
    });

    it("skips webhook + backfill for reactivated connections", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "lin-tok",
            token_type: "Bearer",
            scope: "read,write",
            expires_in: 315360000,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { viewer: { id: "v1", organization: { id: "org-ext-1" } } },
          }),
        } as unknown as Response);

      dbMocks.selectLimit.mockResolvedValue([{ id: "inst-existing" }]); // Row exists
      dbMocks.returning.mockResolvedValue([{ id: "inst-existing" }]);

      const c = mockContext({ code: "auth-code" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(result).toMatchObject({
        status: "connected",
        installationId: "inst-existing",
        provider: "linear",
        reactivated: true,
      });
      expect(notifyBackfillService).not.toHaveBeenCalled();
      // Webhook registration should NOT have been called (only 2 fetch calls, not 3)
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("throws when code is missing", async () => {
      const c = mockContext({});
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("missing code");
    });
  });

  describe("resolveToken", () => {
    function mockDbSelect(rows: unknown[]) {
      const mockLimit = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db as unknown as Record<string, unknown>).select = vi
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

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
  gatewayBaseUrl: "https://gateway.test/services",
}));

// Hoisted so vi.mock factories can reference them
const dbMocks = vi.hoisted(() => {
  // INSERT chain
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });

  // SELECT chain (resolveToken)
  const selectLimit = vi.fn();
  const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  return {
    insert, values, onConflictDoUpdate, returning,
    select, selectLimit,
  };
});

vi.mock("@db/console/client", () => ({
  db: {
    insert: dbMocks.insert,
    select: dbMocks.select,
  },
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: {},
  gwTokens: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("../../lib/token-store", () => ({
  writeTokenRecord: vi.fn().mockResolvedValue(undefined),
  updateTokenRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/lib", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-token"),
  encrypt: vi.fn().mockReturnValue("encrypted-value"),
}));

import { LinearProvider } from "./linear.js";
import { db } from "@db/console/client";
import { decrypt } from "@repo/lib";
import { updateTokenRecord } from "../../lib/token-store.js";

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
  });

  it("has correct provider name and webhook flag", () => {
    expect(provider.name).toBe("linear");
    expect(provider.requiresWebhookRegistration).toBe(false);
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
      expect(result.refreshToken).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.linear.app/oauth/token",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns refresh token when present", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "lin-tok-123",
          token_type: "Bearer",
          scope: "read,write",
          expires_in: 3600,
          refresh_token: "lin-rt-456",
        }),
      } as unknown as Response);

      const result = await provider.exchangeCode(
        "auth-code",
        "https://redirect.test",
      );

      expect(result.refreshToken).toBe("lin-rt-456");
      expect(result.expiresIn).toBe(3600);
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

  describe("refreshToken", () => {
    it("exchanges refresh token for new tokens", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "lin-tok-new",
          token_type: "Bearer",
          scope: "read,write",
          expires_in: 3600,
          refresh_token: "lin-rt-new",
        }),
      } as unknown as Response);

      const result = await provider.refreshToken("lin-rt-old");

      expect(result.accessToken).toBe("lin-tok-new");
      expect(result.refreshToken).toBe("lin-rt-new");
      expect(result.expiresIn).toBe(3600);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.linear.app/oauth/token",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      await expect(provider.refreshToken("bad-rt")).rejects.toThrow(
        "Linear token refresh failed: 400",
      );
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

    it("creates installation on new connection", async () => {
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
            data: { viewer: { id: "v1", organization: { id: "org-ext-1", name: "My Org", urlKey: "my-org" } } },
          }),
        } as unknown as Response);

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
      // Only 2 fetch calls: token exchange + viewer query (no webhook registration)
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(dbMocks.values).toHaveBeenCalledWith(
        expect.objectContaining({
          providerAccountInfo: expect.objectContaining({
            version: 1,
            sourceType: "linear",
            events: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"],
            raw: expect.objectContaining({
              token_type: "Bearer",
              scope: "read,write",
            }),
            organization: {
              id: "org-ext-1",
              name: "My Org",
              urlKey: "my-org",
            },
          }),
        }),
      );
    });

    it("upserts on reactivated connection", async () => {
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
      });
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

    it("throws when token is expired and no refresh token", async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      mockDbSelect([{ accessToken: "encrypted-tok", expiresAt: pastDate, refreshToken: null }]);

      await expect(
        provider.resolveToken({ id: "inst-1" } as any),
      ).rejects.toThrow("token_expired:no_refresh_token");
    });

    it("refreshes expired token when refresh token exists", async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      mockDbSelect([{
        id: "tok-1",
        accessToken: "encrypted-tok",
        expiresAt: pastDate,
        refreshToken: "encrypted-refresh",
      }]);

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "lin-tok-refreshed",
          token_type: "Bearer",
          scope: "read,write",
          expires_in: 3600,
          refresh_token: "lin-rt-new",
        }),
      } as unknown as Response);

      const result = await provider.resolveToken({ id: "inst-1" } as any);

      expect(result.accessToken).toBe("lin-tok-refreshed");
      expect(result.provider).toBe("linear");
      expect(result.expiresIn).toBe(3600);
      expect(decrypt).toHaveBeenCalledWith("encrypted-refresh", "a".repeat(64));
      expect(updateTokenRecord).toHaveBeenCalledWith(
        "tok-1",
        expect.objectContaining({ accessToken: "lin-tok-refreshed" }),
        "encrypted-refresh",
        pastDate,
      );
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";

vi.mock("../../env", () => ({
  env: {
    SENTRY_APP_SLUG: "test-sn-app-slug",
    SENTRY_CLIENT_ID: "test-sn-client-id",
    SENTRY_CLIENT_SECRET: "test-sn-secret",
    ENCRYPTION_KEY: "a".repeat(64),
  },
}));

vi.mock("../../lib/urls", () => ({
  connectionsBaseUrl: "https://connections.test/services",
}));

// Hoisted so vi.mock factories can reference them
const dbMocks = vi.hoisted(() => {
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });

  return { insert, values, onConflictDoUpdate, returning };
});

vi.mock("@db/console/client", () => ({
  db: { insert: dbMocks.insert },
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: {},
  gwTokens: {},
}));

vi.mock("@repo/lib", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-token"),
  encrypt: vi.fn().mockReturnValue("encrypted-value"),
}));

vi.mock("../../lib/token-store", () => ({
  writeTokenRecord: vi.fn().mockResolvedValue(undefined),
  updateTokenRecord: vi.fn().mockResolvedValue(undefined),
}));

import { SentryProvider } from "./sentry.js";
import { db } from "@db/console/client";
import { decrypt } from "@repo/lib";
import { updateTokenRecord } from "../../lib/token-store.js";

const provider = new SentryProvider();

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockContext(query: Record<string, string | undefined>): Context {
  return {
    req: { query: (key: string) => query[key] },
  } as unknown as Context;
}

describe("SentryProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Drizzle INSERT chain
    dbMocks.insert.mockReturnValue({ values: dbMocks.values });
    dbMocks.values.mockReturnValue({ onConflictDoUpdate: dbMocks.onConflictDoUpdate });
    dbMocks.onConflictDoUpdate.mockReturnValue({ returning: dbMocks.returning });
  });

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
        "/sentry-apps/test-sn-app-slug/external-install/",
      );
      expect(parsed.searchParams.get("state")).toBe("test-state");
    });
  });

  describe("exchangeCode", () => {
    it("exchanges code for tokens via Sentry API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "access-tok",
            refreshToken: "refresh-tok",
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          }),
      });

      const result = await provider.exchangeCode(
        "inst-123:auth-code-456",
        "https://redirect.test",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://sentry.io/api/0/sentry-app-installations/inst-123/authorizations/",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            grant_type: "authorization_code",
            code: "auth-code-456",
            client_id: "test-sn-client-id",
            client_secret: "test-sn-secret",
          }),
        }),
      );
      expect(result.accessToken).toBe("access-tok");
      expect(result.refreshToken).toBe("refresh-tok");
      expect(typeof result.expiresIn).toBe("number");
      expect(result.expiresIn).toBeGreaterThan(0);
    });

    it("returns undefined expiresIn when expiresAt is absent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: "tok" }),
      });

      const result = await provider.exchangeCode("inst-1:code", "uri");
      expect(result.expiresIn).toBeUndefined();
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("Unauthorized") });

      await expect(
        provider.exchangeCode("inst-1:code", "uri"),
      ).rejects.toThrow("Sentry token exchange failed: 401");
    });
  });

  describe("refreshToken", () => {
    it("refreshes token and re-encodes installationId into new refresh token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "new-access",
            refreshToken: "new-refresh",
            expiresAt: new Date(Date.now() + 7200_000).toISOString(),
          }),
      });

      const result = await provider.refreshToken("inst-99:old-refresh");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://sentry.io/api/0/sentry-app-installations/inst-99/authorizations/",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: "old-refresh",
            client_id: "test-sn-client-id",
            client_secret: "test-sn-secret",
          }),
        }),
      );
      expect(result.accessToken).toBe("new-access");
      // installationId should be re-encoded into the refresh token
      expect(result.refreshToken).toBe("inst-99:new-refresh");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      await expect(
        provider.refreshToken("inst-1:old-tok"),
      ).rejects.toThrow("Sentry token refresh failed: 403");
    });
  });

  describe("revokeToken", () => {
    it("deletes the Sentry installation via API", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      await provider.revokeToken("inst-55:some-token");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://sentry.io/api/0/sentry-app-installations/inst-55/",
        expect.objectContaining({
          method: "DELETE",
          headers: { Authorization: "Bearer test-sn-secret" },
        }),
      );
    });

    it("is a no-op when token has no encoded installationId", async () => {
      await provider.revokeToken("plain-token");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws on failed revocation (non-204, non-ok)", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        provider.revokeToken("inst-1:tok"),
      ).rejects.toThrow("Sentry token revocation failed: 500");
    });
  });

  describe("resolveToken", () => {
    const mockSelect = vi.fn();
    const mockFrom = vi.fn();
    const mockWhere = vi.fn();
    const mockLimit = vi.fn();

    beforeEach(() => {
      // Build a chainable mock: db.select().from().where().limit()
      mockLimit.mockResolvedValue([]);
      mockWhere.mockReturnValue({ limit: mockLimit });
      mockFrom.mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });
      (db as any).select = mockSelect;
    });

    it("returns decrypted access token for a non-expired token", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "tok-1",
          installationId: "inst-1",
          accessToken: "encrypted-access",
          refreshToken: "encrypted-refresh",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        },
      ]);

      const result = await provider.resolveToken({
        id: "inst-1",
      } as any);

      expect(decrypt).toHaveBeenCalledWith(
        "encrypted-access",
        "a".repeat(64),
      );
      expect(result.accessToken).toBe("decrypted-token");
      expect(result.provider).toBe("sentry");
    });

    it("returns token with null expiresIn when expiresAt is absent", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "tok-1",
          installationId: "inst-1",
          accessToken: "encrypted-access",
          refreshToken: null,
          expiresAt: null,
        },
      ]);

      const result = await provider.resolveToken({
        id: "inst-1",
      } as any);

      expect(result.expiresIn).toBeNull();
    });

    it("refreshes an expired token when refresh token exists", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "tok-1",
          installationId: "inst-1",
          accessToken: "encrypted-access",
          refreshToken: "encrypted-refresh",
          expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
        },
      ]);

      // decrypt returns the composite token for refresh
      vi.mocked(decrypt).mockReturnValueOnce("inst-1:old-refresh-tok");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "refreshed-access",
            refreshToken: "refreshed-refresh",
          }),
      });

      const result = await provider.resolveToken({
        id: "inst-1",
      } as any);

      expect(decrypt).toHaveBeenCalledWith(
        "encrypted-refresh",
        "a".repeat(64),
      );
      expect(updateTokenRecord).toHaveBeenCalledWith(
        "tok-1",
        expect.objectContaining({ accessToken: "refreshed-access" }),
        "encrypted-refresh",
        expect.any(String), // existingExpiresAt
      );
      expect(result.accessToken).toBe("refreshed-access");
    });

    it("throws when token is expired and no refresh token exists", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "tok-1",
          installationId: "inst-1",
          accessToken: "encrypted",
          refreshToken: null,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      ]);

      await expect(
        provider.resolveToken({ id: "inst-1" } as any),
      ).rejects.toThrow("token_expired:no_refresh_token");
    });

    it("throws when no token row is found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(
        provider.resolveToken({ id: "inst-1" } as any),
      ).rejects.toThrow("no_token_found");
    });
  });

  describe("handleCallback", () => {
    const exchangeCodeResponse = {
      token: "access-tok",
      refreshToken: "refresh-tok",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };

    it("connects and fires backfill for new installation using sentryInstallationId as externalId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(exchangeCodeResponse),
      });
      dbMocks.returning.mockResolvedValue([{ id: "inst-sn-new" }]);

      const c = mockContext({ code: "auth-code", installationId: "inst-123" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(dbMocks.insert).toHaveBeenCalled();
      expect(dbMocks.values).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "sentry",
          externalId: "inst-123",
          status: "active",
          providerAccountInfo: expect.objectContaining({
            version: 1,
            sourceType: "sentry",
            installationId: "inst-123",
            raw: expect.objectContaining({}),
          }),
        }),
      );
      expect(dbMocks.onConflictDoUpdate).toHaveBeenCalled();
      expect(result).toMatchObject({
        status: "connected",
        installationId: "inst-sn-new",
        provider: "sentry",
      });
    });

    it("reconnects successfully when row already exists (upsert)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(exchangeCodeResponse),
      });
      // Upsert returns existing row — no crash
      dbMocks.returning.mockResolvedValue([{ id: "inst-sn-existing" }]);

      const c = mockContext({ code: "auth-code", installationId: "inst-123" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(result).toMatchObject({
        status: "connected",
        installationId: "inst-sn-existing",
        provider: "sentry",
      });
    });

    it("throws when code is missing", async () => {
      const c = mockContext({});
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("missing code");
    });

    it("throws when installationId query param is missing", async () => {
      const c = mockContext({ code: "some-code" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("missing installationId query param");
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
});

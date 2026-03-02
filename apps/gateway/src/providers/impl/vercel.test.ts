import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";

vi.mock("../../env", () => ({
  env: {
    VERCEL_CLIENT_SECRET_ID: "test-vc-client-id",
    VERCEL_CLIENT_INTEGRATION_SECRET: "test-vc-secret",
    VERCEL_INTEGRATION_SLUG: "test-integration",
    ENCRYPTION_KEY: "a".repeat(64),
  },
}));

vi.mock("../../lib/urls", () => ({
  gatewayBaseUrl: "https://gateway.test/services",
}));

// Hoisted so vi.mock factories can reference them
const dbMocks = vi.hoisted(() => {
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });

  // Pre-check SELECT chain: db.select().from().where().limit()
  const selectLimit = vi.fn();
  const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  return { insert, values, onConflictDoUpdate, returning, select, selectLimit };
});

vi.mock("@db/console/client", () => ({
  db: { insert: dbMocks.insert, select: dbMocks.select },
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

import { VercelProvider } from "./vercel.js";

const provider = new VercelProvider();

function mockContext(query: Record<string, string | undefined>): Context {
  return {
    req: { query: (key: string) => query[key] },
  } as unknown as Context;
}

const exchangeCodeResponse = {
  access_token: "vc-tok",
  token_type: "Bearer",
  installation_id: "icfg_abc",
  user_id: "vercel-user-123",
  team_id: "team_abc",
};

describe("VercelProvider", () => {
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

  describe("handleCallback", () => {
    it("connects new installation with account info", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => exchangeCodeResponse,
      } as unknown as Response);
      dbMocks.selectLimit.mockResolvedValue([]); // No existing installation
      dbMocks.returning.mockResolvedValue([{ id: "inst-vc-new" }]);

      const c = mockContext({ code: "auth-code", configurationId: "icfg_abc" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(dbMocks.insert).toHaveBeenCalled();
      expect(dbMocks.values).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "vercel",
          status: "active",
          providerAccountInfo: expect.objectContaining({
            version: 1,
            sourceType: "vercel",
            raw: {
              token_type: "Bearer",
              installation_id: "icfg_abc",
              user_id: "vercel-user-123",
              team_id: "team_abc",
            },
          }),
        }),
      );
      expect(dbMocks.onConflictDoUpdate).toHaveBeenCalled();
      expect(result).toMatchObject({
        status: "connected",
        installationId: "inst-vc-new",
        provider: "vercel",
      });
      // New installation — no reactivated flag
      expect(result.reactivated).toBeUndefined();
    });

    it("marks reactivated when row already exists", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => exchangeCodeResponse,
      } as unknown as Response);
      dbMocks.selectLimit.mockResolvedValue([{ id: "inst-vc-existing" }]); // Existing installation
      dbMocks.returning.mockResolvedValue([{ id: "inst-vc-existing" }]);

      const c = mockContext({ code: "auth-code", configurationId: "icfg_abc" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(result).toMatchObject({
        status: "connected",
        installationId: "inst-vc-existing",
        provider: "vercel",
        reactivated: true,
      });
    });

    it("returns nextUrl when Vercel sends next param", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => exchangeCodeResponse,
      } as unknown as Response);
      dbMocks.selectLimit.mockResolvedValue([]);
      dbMocks.returning.mockResolvedValue([{ id: "inst-vc-new" }]);

      const c = mockContext({
        code: "auth-code",
        configurationId: "icfg_abc",
        next: "https://vercel.com/integrations/test/complete",
      });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(result.nextUrl).toBe("https://vercel.com/integrations/test/complete");
    });

    it("omits nextUrl when next param is absent", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => exchangeCodeResponse,
      } as unknown as Response);
      dbMocks.selectLimit.mockResolvedValue([]);
      dbMocks.returning.mockResolvedValue([{ id: "inst-vc-new" }]);

      const c = mockContext({ code: "auth-code", configurationId: "icfg_abc" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(result.nextUrl).toBeUndefined();
    });

    it("throws when code is missing", async () => {
      const c = mockContext({ configurationId: "icfg_abc" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("missing code");
    });

    it("throws when configurationId is missing", async () => {
      const c = mockContext({ code: "auth-code" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("missing configurationId");
    });

    it("throws on configurationId mismatch with token exchange", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => exchangeCodeResponse, // installation_id: "icfg_abc"
      } as unknown as Response);

      const c = mockContext({ code: "auth-code", configurationId: "icfg_DIFFERENT" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("configurationId mismatch");
    });

    it("throws when upsert returns no rows", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => exchangeCodeResponse,
      } as unknown as Response);
      dbMocks.selectLimit.mockResolvedValue([]);
      dbMocks.returning.mockResolvedValue([]);

      const c = mockContext({ code: "auth-code", configurationId: "icfg_abc" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("upsert_failed");
    });

    it("uses user_id as externalId for personal accounts (no team_id)", async () => {
      const personalResponse = { ...exchangeCodeResponse, team_id: null };
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => personalResponse,
      } as unknown as Response);
      dbMocks.selectLimit.mockResolvedValue([]);
      dbMocks.returning.mockResolvedValue([{ id: "inst-personal" }]);

      const c = mockContext({ code: "auth-code", configurationId: "icfg_abc" });
      await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(dbMocks.values).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: "vercel-user-123", // Falls back to user_id
        }),
      );
    });
  });
});

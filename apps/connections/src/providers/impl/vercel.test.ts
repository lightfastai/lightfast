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

describe("VercelProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Drizzle INSERT chain
    dbMocks.insert.mockReturnValue({ values: dbMocks.values });
    dbMocks.values.mockReturnValue({ onConflictDoUpdate: dbMocks.onConflictDoUpdate });
    dbMocks.onConflictDoUpdate.mockReturnValue({ returning: dbMocks.returning });
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
    const exchangeCodeResponse = {
      access_token: "vc-tok",
      token_type: "Bearer",
      installation_id: "icfg_abc",
      user_id: "vercel-user-123",
      team_id: "team_abc",
    };

    it("connects and fires backfill for new installation", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      // Token exchange
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => exchangeCodeResponse,
      } as unknown as Response);
      dbMocks.returning.mockResolvedValue([{ id: "inst-vc-new" }]);

      const c = mockContext({ code: "auth-code" });
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
    });

    it("reconnects successfully when row already exists (upsert)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      // Token exchange
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => exchangeCodeResponse,
      } as unknown as Response);
      // Upsert returns existing row — no crash
      dbMocks.returning.mockResolvedValue([{ id: "inst-vc-existing" }]);

      const c = mockContext({ code: "auth-code" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(result).toMatchObject({
        status: "connected",
        installationId: "inst-vc-existing",
        provider: "vercel",
      });
    });

    it("throws when code is missing", async () => {
      const c = mockContext({});
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("missing code");
    });
  });
});

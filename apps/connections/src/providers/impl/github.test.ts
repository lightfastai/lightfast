import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";

vi.mock("../../env", () => ({
  env: {
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    GITHUB_APP_SLUG: "test-app",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: "test-key",
    ENCRYPTION_KEY: "a".repeat(64),
  },
}));

vi.mock("../../lib/urls", () => ({
  connectionsBaseUrl: "https://connections.test/services",
  notifyBackfillService: vi.fn().mockResolvedValue(undefined),
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

vi.mock("../../lib/github-jwt", () => ({
  getInstallationToken: vi.fn().mockResolvedValue("test-token"),
  getInstallationDetails: vi.fn().mockResolvedValue({
    account: {
      login: "test-org",
      id: 12345,
      type: "Organization",
      avatar_url: "https://avatars.githubusercontent.com/u/12345",
    },
    permissions: { contents: "read", metadata: "read" },
    events: ["push", "pull_request"],
    created_at: "2026-01-01T00:00:00Z",
  }),
}));

import { GitHubProvider } from "./github.js";
import { getInstallationToken, getInstallationDetails } from "../../lib/github-jwt.js";
import { notifyBackfillService } from "../../lib/urls.js";

const provider = new GitHubProvider();

function mockContext(query: Record<string, string | undefined>): Context {
  return {
    req: { query: (key: string) => query[key] },
  } as unknown as Context;
}

describe("GitHubProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    // Reset Drizzle INSERT chain
    dbMocks.insert.mockReturnValue({ values: dbMocks.values });
    dbMocks.values.mockReturnValue({
      onConflictDoUpdate: dbMocks.onConflictDoUpdate,
    });
    dbMocks.onConflictDoUpdate.mockReturnValue({
      returning: dbMocks.returning,
    });
    // Reset Drizzle SELECT chain
    const selectWhere = vi.fn().mockReturnValue({ limit: dbMocks.selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    dbMocks.select.mockReturnValue({ from: selectFrom });
  });

  it("has correct provider name and webhook flag", () => {
    expect(provider.name).toBe("github");
    expect(provider.requiresWebhookRegistration).toBe(false);
  });

  describe("getAuthorizationUrl", () => {
    it("delegates to App installation URL", () => {
      const url = provider.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://github.com");
      expect(parsed.pathname).toBe("/apps/test-app/installations/new");
      expect(parsed.searchParams.get("state")).toBe("test-state");
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

  describe("exchangeCode", () => {
    it("returns tokens on successful exchange", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            access_token: "ghu_abc123",
            scope: "repo,user",
            token_type: "bearer",
          }),
        }),
      );

      const result = await provider.exchangeCode(
        "auth-code",
        "https://redirect.test",
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://github.com/login/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            client_id: "test-client-id",
            client_secret: "test-client-secret",
            code: "auth-code",
            redirect_uri: "https://redirect.test",
          }),
        }),
      );
      expect(result).toEqual({
        accessToken: "ghu_abc123",
        scope: "repo,user",
        tokenType: "bearer",
        raw: {
          access_token: "ghu_abc123",
          scope: "repo,user",
          token_type: "bearer",
        },
      });
    });

    it("throws on non-ok HTTP response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );

      await expect(
        provider.exchangeCode("bad-code", "https://redirect.test"),
      ).rejects.toThrow("GitHub token exchange failed: 500");
    });

    it("throws on OAuth error in response body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            error: "bad_verification_code",
            error_description: "The code passed is incorrect or expired.",
            error_uri: "https://docs.github.com",
          }),
        }),
      );

      await expect(
        provider.exchangeCode("expired-code", "https://redirect.test"),
      ).rejects.toThrow(
        "GitHub OAuth error: The code passed is incorrect or expired.",
      );
    });
  });

  describe("refreshToken", () => {
    it("rejects — GitHub user tokens do not support refresh", async () => {
      await expect(provider.refreshToken("any")).rejects.toThrow(
        "GitHub user tokens do not support refresh",
      );
    });
  });

  describe("handleCallback", () => {
    it("upserts installation with API data and returns connected result", async () => {
      dbMocks.selectLimit.mockResolvedValue([]); // New installation
      dbMocks.returning.mockResolvedValue([{ id: "inst-abc" }]);

      const c = mockContext({
        installation_id: "ext-42",
        setup_action: "install",
      });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(getInstallationDetails).toHaveBeenCalledWith("ext-42");
      expect(dbMocks.insert).toHaveBeenCalled();
      expect(dbMocks.values).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "github",
          externalId: "ext-42",
          connectedBy: "user-1",
          orgId: "org-1",
          status: "active",
          providerAccountInfo: expect.objectContaining({
            version: 1,
            sourceType: "github",
            events: ["push", "pull_request"],
            raw: {
              account: {
                login: "test-org",
                id: 12345,
                type: "Organization",
                avatar_url: "https://avatars.githubusercontent.com/u/12345",
              },
              permissions: { contents: "read", metadata: "read" },
              events: ["push", "pull_request"],
              created_at: "2026-01-01T00:00:00Z",
            },
          }),
        }),
      );
      expect(result).toMatchObject({
        status: "connected",
        installationId: "inst-abc",
        provider: "github",
        setupAction: "install",
      });
    });

    it("notifies backfill service for new installations", async () => {
      dbMocks.selectLimit.mockResolvedValue([]); // No existing row
      dbMocks.returning.mockResolvedValue([{ id: "inst-new" }]);

      const c = mockContext({ installation_id: "ext-1" });
      await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(notifyBackfillService).toHaveBeenCalledWith({
        installationId: "inst-new",
        provider: "github",
        orgId: "org-1",
      });
    });

    it("skips backfill notification for reactivated installations", async () => {
      dbMocks.selectLimit.mockResolvedValue([{ id: "inst-existing" }]); // Row exists
      dbMocks.returning.mockResolvedValue([{ id: "inst-existing" }]);

      const c = mockContext({ installation_id: "ext-1" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(notifyBackfillService).not.toHaveBeenCalled();
      expect(result).toMatchObject({ reactivated: true });
    });

    it("throws unimplemented for setup_action=request", async () => {
      const c = mockContext({ setup_action: "request" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("setup_action=request is not yet implemented");
    });

    it("throws unimplemented for setup_action=update", async () => {
      const c = mockContext({ installation_id: "ext-42", setup_action: "update" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("setup_action=update is not yet implemented");
    });

    it("throws when getInstallationDetails fails (hard-fail, no garbage data)", async () => {
      vi.mocked(getInstallationDetails).mockRejectedValueOnce(
        new Error("GitHub installation details fetch failed: 401"),
      );

      const c = mockContext({ installation_id: "ext-42" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("GitHub installation details fetch failed: 401");

      // Verify no DB upsert was attempted
      expect(dbMocks.insert).not.toHaveBeenCalled();
    });

    it("throws when installation_id is missing", async () => {
      const c = mockContext({});
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("missing installation_id");
    });

    it("throws when upsert returns no rows", async () => {
      dbMocks.selectLimit.mockResolvedValue([]); // No existing row
      dbMocks.returning.mockResolvedValue([]);

      const c = mockContext({ installation_id: "ext-1" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("upsert_failed");
    });
  });

  describe("resolveToken", () => {
    it("returns installation token via getInstallationToken", async () => {
      const installation = {
        id: "inst-1",
        externalId: "ext-42",
        provider: "github",
        orgId: "org-1",
        connectedBy: "user-1",
        status: "active",
        webhookSecret: null,
        metadata: null,
        accountLogin: null,
        providerAccountInfo: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };

      const result = await provider.resolveToken(installation as any);

      expect(getInstallationToken).toHaveBeenCalledWith("ext-42");
      expect(result).toEqual({
        accessToken: "test-token",
        provider: "github",
        expiresIn: 3600,
      });
    });
  });
});

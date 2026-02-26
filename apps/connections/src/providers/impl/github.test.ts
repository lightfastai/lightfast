import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  connectionsBaseUrl: "https://connections.test/api",
  notifyBackfillService: vi.fn().mockResolvedValue(undefined),
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

vi.mock("../../lib/github-jwt", () => ({
  getInstallationToken: vi.fn().mockResolvedValue("test-token"),
}));

import { GitHubProvider } from "./github.js";
import { getInstallationToken } from "../../lib/github-jwt.js";
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
    // Reset Drizzle chain
    dbMocks.insert.mockReturnValue({ values: dbMocks.values });
    dbMocks.values.mockReturnValue({
      onConflictDoUpdate: dbMocks.onConflictDoUpdate,
    });
    dbMocks.onConflictDoUpdate.mockReturnValue({
      returning: dbMocks.returning,
    });
  });

  it("has correct provider name and webhook flag", () => {
    expect(provider.name).toBe("github");
    expect(provider.requiresWebhookRegistration).toBe(false);
  });

  describe("getAuthorizationUrl", () => {
    it("builds correct GitHub OAuth URL with state", () => {
      const url = provider.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://github.com");
      expect(parsed.pathname).toBe("/login/oauth/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
      expect(parsed.searchParams.get("state")).toBe("test-state");
    });

    it("includes redirect_uri when redirectPath option is set", () => {
      const url = provider.getAuthorizationUrl("state", {
        redirectPath: "/callback",
      });
      const parsed = new URL(url);
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://connections.test/api/connections/github/callback",
      );
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
    const FIXED_NOW = "2026-01-15T12:00:00.000Z";

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(FIXED_NOW));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("upserts installation and returns connected result", async () => {
      dbMocks.returning.mockResolvedValue([
        { id: "inst-abc", createdAt: FIXED_NOW },
      ]);

      const c = mockContext({
        installation_id: "ext-42",
        setup_action: "install",
      });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
        accountLogin: "my-org",
      });

      expect(dbMocks.insert).toHaveBeenCalled();
      expect(dbMocks.values).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "github",
          externalId: "ext-42",
          connectedBy: "user-1",
          orgId: "org-1",
          status: "active",
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
      dbMocks.returning.mockResolvedValue([
        { id: "inst-new", createdAt: FIXED_NOW },
      ]);

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
      dbMocks.returning.mockResolvedValue([
        { id: "inst-existing", createdAt: "2025-01-01T00:00:00.000Z" },
      ]);

      const c = mockContext({ installation_id: "ext-1" });
      const result = await provider.handleCallback(c, {
        orgId: "org-1",
        connectedBy: "user-1",
      });

      expect(notifyBackfillService).not.toHaveBeenCalled();
      expect(result).toMatchObject({ reactivated: true });
    });

    it("throws when installation_id is missing", async () => {
      const c = mockContext({});
      await expect(
        provider.handleCallback(c, { orgId: "org-1", connectedBy: "user-1" }),
      ).rejects.toThrow("missing installation_id");
    });

    it("throws when orgId is missing from state", async () => {
      const c = mockContext({ installation_id: "ext-1" });
      await expect(
        provider.handleCallback(c, { connectedBy: "user-1" }),
      ).rejects.toThrow("missing orgId in state data");
    });

    it("throws when connectedBy is missing from state", async () => {
      const c = mockContext({ installation_id: "ext-1" });
      await expect(
        provider.handleCallback(c, { orgId: "org-1" }),
      ).rejects.toThrow("missing connectedBy in state data");
    });

    it("throws when upsert returns no rows", async () => {
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

  describe("buildAccountInfo", () => {
    it("builds GitHub account info with installation data", () => {
      const info = provider.buildAccountInfo({
        installationId: "inst-42",
        accountLogin: "my-org",
      });
      expect(info).toMatchObject({
        version: 1,
        sourceType: "github",
        installations: [
          expect.objectContaining({
            id: "inst-42",
            accountLogin: "my-org",
          }),
        ],
      });
    });

    it("defaults to 'unknown' accountLogin when not provided", () => {
      const info = provider.buildAccountInfo({ installationId: "inst-1" });
      expect(info).toMatchObject({
        installations: [expect.objectContaining({ accountLogin: "unknown" })],
      });
    });

    it("uses accountType from stateData", () => {
      const info = provider.buildAccountInfo({
        installationId: "inst-42",
        accountLogin: "my-user",
        accountType: "User",
      });
      expect(info).toMatchObject({
        installations: [expect.objectContaining({ accountType: "User" })],
      });
    });

    it("defaults accountType to 'unknown' when not provided", () => {
      const info = provider.buildAccountInfo({ installationId: "inst-1" });
      expect(info).toMatchObject({
        installations: [expect.objectContaining({ accountType: "unknown" })],
      });
    });
  });
});

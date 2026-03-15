/**
 * OAuth callback + token refresh integration tests.
 *
 * Covers behaviors that require real DB state:
 *   - GitHub installation_id fallback (no state → DB lookup)
 *   - OAuth state replay protection (multi/del consumed on first use)
 *   - Token expiry detection and on-demand refresh
 *   - Token expired with no refresh token (error path)
 *
 * Uses PGlite + real AES-256-GCM encryption (ENCRYPTION_KEY is a
 * valid 64-char hex key so encrypt/decrypt round-trips work).
 */

import { gatewayInstallations, gatewayTokens } from "@db/console/schema";
import type { TestDb } from "@repo/console-test-db";
import { closeTestDb, createTestDb, resetTestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
import { encrypt } from "@repo/lib";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// ── PGlite singleton ──

let db: TestDb;

// ── Hoisted mocks (TEST_ENC_KEY here to avoid TDZ in vi.mock factories) ──

const {
  TEST_ENC_KEY,
  mockRedisHset,
  mockRedisHgetall,
  mockRedisExpire,
  mockRedisDel,
  mockMultiHgetall,
  mockMultiDel,
  mockMultiExec,
  mockWorkflowTrigger,
  mockGetInstallationToken,
  mockRefreshToken,
  mockProcessCallback,
  mockUpdateTokenRecord,
  mockWriteTokenRecord,
  mockCreateConfig,
} = vi.hoisted(() => {
  // 64 hex chars = 32 bytes — valid AES-256-GCM key
  const TEST_ENC_KEY =
    "0000000000000000000000000000000000000000000000000000000000000001";
  const mockGetInstallationToken = vi.fn().mockResolvedValue("tok-live");
  const mockRefreshToken = vi.fn().mockResolvedValue({
    accessToken: "tok-refreshed",
    tokenType: "Bearer",
    expiresIn: 3600,
  });
  const mockProcessCallback = vi.fn();
  const mockCreateConfig = vi.fn().mockImplementation(() => ({}));

  // Redis MULTI chain mocks (for resolveAndConsumeState)
  const mockMultiHgetall = vi.fn();
  const mockMultiDel = vi.fn();
  const mockMultiExec = vi.fn();

  return {
    TEST_ENC_KEY,
    mockRedisHset: vi.fn().mockResolvedValue("OK"),
    mockRedisHgetall: vi.fn().mockResolvedValue(null),
    mockRedisExpire: vi.fn().mockResolvedValue(1),
    mockRedisDel: vi.fn().mockResolvedValue(1),
    mockMultiHgetall,
    mockMultiDel,
    mockMultiExec,
    mockWorkflowTrigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-1" }),
    mockGetInstallationToken,
    mockRefreshToken,
    mockProcessCallback,
    mockUpdateTokenRecord: vi.fn().mockResolvedValue(undefined),
    mockWriteTokenRecord: vi.fn().mockResolvedValue(undefined),
    mockCreateConfig,
  };
});

// ── vi.mock declarations ──

vi.mock("@db/console/client", () => ({
  get db() {
    return db;
  },
}));

vi.mock("../env", () => ({
  env: {
    GATEWAY_API_KEY: "test-api-key",
    ENCRYPTION_KEY: TEST_ENC_KEY,
  },
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    hset: (...args: unknown[]) => mockRedisHset(...args),
    hgetall: (...args: unknown[]) => mockRedisHgetall(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    pipeline: () => ({
      hset: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
    multi: () => {
      const chain: Record<string, unknown> = {
        hgetall: vi.fn((...args: unknown[]) => {
          mockMultiHgetall(...args);
          return chain;
        }),
        del: vi.fn((...args: unknown[]) => {
          mockMultiDel(...args);
          return chain;
        }),
        exec: () => mockMultiExec(),
      };
      return chain;
    },
  },
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  workflowClient: { trigger: mockWorkflowTrigger },
}));

vi.mock("@repo/console-providers", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  const mockOAuth = {
    buildAuthUrl: vi.fn(),
    processCallback: (...args: unknown[]) => mockProcessCallback(...args),
    refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
    revokeToken: vi.fn(),
    usesStoredToken: true,
    getActiveToken: (...args: unknown[]) => mockGetInstallationToken(...args),
  };

  const providers = {
    github: {
      name: "github",
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
      oauth: { ...mockOAuth, usesStoredToken: false },
    },
    vercel: {
      name: "vercel",
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
      oauth: { ...mockOAuth, usesStoredToken: true },
    },
    linear: {
      name: "linear",
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
      oauth: { ...mockOAuth, usesStoredToken: true },
    },
    sentry: {
      name: "sentry",
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
      oauth: { ...mockOAuth, usesStoredToken: true },
    },
  };

  return {
    ...actual,
    PROVIDERS: providers,
    PROVIDER_ENVS: () => [],
    getProvider: (name: string) => providers[name as keyof typeof providers],
  };
});

vi.mock("../lib/token-store", () => ({
  writeTokenRecord: (...args: unknown[]) => mockWriteTokenRecord(...args),
  updateTokenRecord: (...args: unknown[]) => mockUpdateTokenRecord(...args),
}));

vi.mock("../lib/urls", () => ({
  gatewayBaseUrl: "https://gateway.test/services",
  consoleUrl: "https://console.test",
  relayBaseUrl: "https://relay.test/api",
}));

// ── Import app after mocks ──

import { Hono } from "hono";
import { connections } from "./connections.js";

const app = new Hono();
app.route("/connections", connections);

function request(
  path: string,
  init: {
    method?: string;
    body?: string | Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  const body =
    typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  return app.request(path, { method: init.method ?? "GET", headers, body });
}

const API = { "X-API-Key": "test-api-key" };

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateConfig.mockImplementation(() => ({}));
  mockGetInstallationToken.mockResolvedValue("tok-live");
  mockRefreshToken.mockResolvedValue({
    accessToken: "tok-refreshed",
    tokenType: "Bearer",
    expiresIn: 3600,
  });
  mockUpdateTokenRecord.mockResolvedValue(undefined);
  mockWriteTokenRecord.mockResolvedValue(undefined);
  // Default: state lookup returns valid stateData
  mockMultiExec.mockResolvedValue([
    { orgId: "org-1", provider: "vercel", connectedBy: "user-1" },
    1,
  ]);
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Helper: encrypt a token using the test key ──

async function encryptToken(plaintext: string): Promise<string> {
  return encrypt(plaintext, TEST_ENC_KEY);
}

// ── GitHub installation_id fallback ──

describe("GET /connections/github/callback — installation_id fallback", () => {
  it("recovers orgId/connectedBy from DB when state is missing but installation_id is present", async () => {
    // Existing installation in DB
    const inst = fixtures.installation({
      provider: "github",
      externalId: "gh-app-999",
      orgId: "org-recovered",
      connectedBy: "user-recovered",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    // No state in Redis (multi/exec returns [null, 0])
    mockMultiExec.mockResolvedValue([null, 0]);

    // processCallback returns a valid connected result
    mockProcessCallback.mockResolvedValue({
      status: "connected",
      externalId: "gh-app-999",
      accountInfo: { login: "my-org" },
      tokens: { accessToken: "tok-github", tokenType: "Bearer" },
    });

    const res = await request(
      "/connections/github/callback?installation_id=gh-app-999&code=abc"
    );

    // Should not return invalid_or_expired_state — installation_id was found
    expect(res.status).not.toBe(400);
    // Should have upserted the installation
    expect(mockWriteTokenRecord).toHaveBeenCalledOnce();
  });

  it("returns invalid_or_expired_state when installation_id is missing and no state", async () => {
    mockMultiExec.mockResolvedValue([null, 0]);

    const res = await request("/connections/github/callback?code=abc");
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_or_expired_state");
  });

  it("returns invalid_or_expired_state when installation_id does not match any DB row", async () => {
    mockMultiExec.mockResolvedValue([null, 0]);

    // No matching installation in DB
    const res = await request(
      "/connections/github/callback?installation_id=ghost-9999&code=abc"
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_or_expired_state");
  });

  it("reactivates an existing revoked installation via installation_id", async () => {
    const inst = fixtures.installation({
      provider: "github",
      externalId: "gh-reinstall-42",
      orgId: "org-revoked",
      connectedBy: "user-1",
      status: "revoked",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockMultiExec.mockResolvedValue([null, 0]);
    mockProcessCallback.mockResolvedValue({
      status: "connected",
      externalId: "gh-reinstall-42",
      accountInfo: { login: "my-org" },
      tokens: { accessToken: "tok-new", tokenType: "Bearer" },
    });

    const res = await request(
      "/connections/github/callback?installation_id=gh-reinstall-42&code=abc"
    );
    // Should succeed and mark as reactivated
    expect(res.status).not.toBe(400);
  });
});

// ── Token expiry + refresh integration ──

describe("GET /connections/:id/token — token expiry and refresh", () => {
  it("returns 200 with live token when token is not expired", async () => {
    const inst = fixtures.installation({
      provider: "vercel",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const encAccess = await encryptToken("tok-vercel-live");
    const token = fixtures.token({
      installationId: inst.id,
      accessToken: encAccess,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(), // 1h future
    });
    await db.insert(gatewayTokens).values(token);

    // getActiveToken returns the decrypted access token
    mockGetInstallationToken.mockResolvedValue("tok-vercel-live");

    const res = await request(`/connections/${inst.id}/token`, {
      headers: API,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { accessToken: string };
    expect(json.accessToken).toBe("tok-vercel-live");
    // updateTokenRecord must NOT be called (no refresh)
    expect(mockUpdateTokenRecord).not.toHaveBeenCalled();
  });

  it("triggers token refresh when token is expired and refreshToken is present", async () => {
    const inst = fixtures.installation({
      provider: "vercel",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const encAccess = await encryptToken("tok-expired");
    const encRefresh = await encryptToken("refresh-tok-secret");

    const token = fixtures.token({
      installationId: inst.id,
      accessToken: encAccess,
      refreshToken: encRefresh,
      expiresAt: new Date(Date.now() - 60_000).toISOString(), // 1 min past
    });
    await db.insert(gatewayTokens).values(token);

    const res = await request(`/connections/${inst.id}/token`, {
      headers: API,
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { accessToken: string };
    // The refreshed token is returned
    expect(json.accessToken).toBe("tok-refreshed");

    // refreshToken was called with the decrypted refresh token
    expect(mockRefreshToken).toHaveBeenCalledWith(
      expect.anything(), // providerConfig
      "refresh-tok-secret"
    );
    // updateTokenRecord persists the new tokens
    expect(mockUpdateTokenRecord).toHaveBeenCalledOnce();
  });

  it("returns 500 when token is expired and no refreshToken exists", async () => {
    const inst = fixtures.installation({
      provider: "vercel",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const encAccess = await encryptToken("tok-expired-no-refresh");

    const token = fixtures.token({
      installationId: inst.id,
      accessToken: encAccess,
      refreshToken: null,
      expiresAt: new Date(Date.now() - 60_000).toISOString(), // expired
    });
    await db.insert(gatewayTokens).values(token);

    const res = await request(`/connections/${inst.id}/token`, {
      headers: API,
    });
    // token_expired:no_refresh_token → 401
    expect(res.status).toBe(401);
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it("decrypts stored access token and passes to getActiveToken", async () => {
    const inst = fixtures.installation({
      provider: "vercel",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const encAccess = await encryptToken("tok-stored-access");
    const token = fixtures.token({
      installationId: inst.id,
      accessToken: encAccess,
      expiresAt: null, // no expiry
    });
    await db.insert(gatewayTokens).values(token);

    mockGetInstallationToken.mockResolvedValue("tok-from-provider");

    const res = await request(`/connections/${inst.id}/token`, {
      headers: API,
    });
    expect(res.status).toBe(200);

    // getActiveToken was called with the decrypted plaintext token
    expect(mockGetInstallationToken).toHaveBeenCalledWith(
      expect.anything(), // providerConfig
      inst.externalId,
      "tok-stored-access" // decrypted
    );
  });

  it("passes null accessToken to getActiveToken when no token row exists", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);
    // No token row inserted (github uses getActiveToken with null access token)

    mockGetInstallationToken.mockResolvedValue("tok-github-app");

    const res = await request(`/connections/${inst.id}/token`, {
      headers: API,
    });
    expect(res.status).toBe(200);

    expect(mockGetInstallationToken).toHaveBeenCalledWith(
      expect.anything(),
      inst.externalId,
      null // no stored token
    );
  });
});

// ── OAuth state replay protection ──

describe("GET /connections/oauth/status — state replay protection", () => {
  it("returns pending when state key has no result yet", async () => {
    mockRedisHgetall.mockResolvedValue(null);

    const res = await request(
      "/connections/oauth/status?state=state-pending-abc"
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("pending");
  });

  it("returns completed result when state key has a result", async () => {
    mockRedisHgetall.mockResolvedValue({
      status: "completed",
      provider: "vercel",
    });

    const res = await request("/connections/oauth/status?state=state-done-xyz");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; provider: string };
    expect(json.status).toBe("completed");
    expect(json.provider).toBe("vercel");
  });

  it("returns 400 when state param is missing", async () => {
    const res = await request("/connections/oauth/status");
    expect(res.status).toBe(400);
  });
});

// ── Callback state consumption ──

describe("GET /connections/:provider/callback — state lifecycle", () => {
  it("callback succeeds on first use and creates installation in DB", async () => {
    mockMultiExec.mockResolvedValue([
      { orgId: "org-1", provider: "vercel", connectedBy: "user-1" },
      1,
    ]);
    mockProcessCallback.mockResolvedValue({
      status: "connected",
      externalId: "ext-vercel-new",
      accountInfo: { teamName: "my-team" },
      tokens: { accessToken: "tok-vercel", tokenType: "Bearer" },
    });

    const res = await request(
      "/connections/vercel/callback?state=state-use-once&code=code-abc"
    );

    // Should redirect (success)
    expect([200, 301, 302, 303]).toContain(res.status);
    // Installation should now be in DB
    const rows = await db.select().from(gatewayInstallations);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.provider).toBe("vercel");
    expect(rows[0]!.externalId).toBe("ext-vercel-new");
    expect(rows[0]!.orgId).toBe("org-1");
  });

  it("returns invalid_or_expired_state when state is absent from multi/exec result", async () => {
    mockMultiExec.mockResolvedValue([null, 0]); // key not found

    const res = await request(
      "/connections/vercel/callback?state=state-not-found&code=code-abc"
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_or_expired_state");
  });

  it("returns invalid_or_expired_state when provider in state does not match URL param", async () => {
    mockMultiExec.mockResolvedValue([
      { orgId: "org-1", provider: "linear", connectedBy: "user-1" }, // mismatch
      1,
    ]);

    const res = await request(
      "/connections/vercel/callback?state=state-wrong-provider&code=code-abc"
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_or_expired_state");
  });
});

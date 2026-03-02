import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock externals (vi.hoisted runs before vi.mock hoisting) ──

const {
  mockRedisHset,
  mockRedisHgetall,
  mockRedisExpire,
  mockRedisDel,
  mockWorkflowTrigger,
  mockFindFirst,
  mockSelectLimit,
  mockInsertReturning,
  mockUpdateWhere,
  mockGetProvider,
  mockProvider,
} = vi.hoisted(() => {
  const mockProvider = {
    name: "github" as const,
    requiresWebhookRegistration: false,
    getAuthorizationUrl: vi
      .fn()
      .mockReturnValue("https://github.com/login/oauth/authorize?mock=1"),
    handleCallback: vi.fn().mockResolvedValue({
      status: "connected",
      installationId: "inst-1",
      provider: "github",
    }),
    resolveToken: vi.fn().mockResolvedValue({
      accessToken: "tok-123",
      provider: "github",
      expiresIn: 3600,
    }),
  };

  return {
    mockRedisHset: vi.fn().mockResolvedValue("OK"),
    mockRedisHgetall: vi
      .fn()
      .mockResolvedValue(null),
    mockRedisExpire: vi.fn().mockResolvedValue(1),
    mockRedisDel: vi.fn().mockResolvedValue(1),
    mockWorkflowTrigger: vi
      .fn()
      .mockResolvedValue({ workflowRunId: "wf-1" }),
    mockFindFirst: vi.fn().mockResolvedValue(null),
    mockSelectLimit: vi.fn().mockResolvedValue([]),
    mockInsertReturning: vi
      .fn()
      .mockResolvedValue([]),
    mockUpdateWhere: vi.fn().mockResolvedValue(undefined),
    mockGetProvider: vi.fn().mockReturnValue(mockProvider),
    mockProvider,
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn().mockReturnValue("CURRENT_TIMESTAMP"),
}));

vi.mock("../env", () => ({
  env: {
    GATEWAY_API_KEY: "test-api-key",
  },
  getEnv: () => ({ GATEWAY_API_KEY: "test-api-key" }),
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    hset: (...args: unknown[]) => mockRedisHset(...args),
    hgetall: (...args: unknown[]) => mockRedisHgetall(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    pipeline: () => {
      const chain = {
        hset: (...args: unknown[]) => { mockRedisHset(...args); return chain; },
        expire: (...args: unknown[]) => { mockRedisExpire(...args); return chain; },
        exec: () => Promise.resolve([]),
      };
      return chain;
    },
    multi: () => {
      let hgetallResult: unknown = null;
      const chain = {
        hgetall: (...args: unknown[]) => { hgetallResult = mockRedisHgetall(...args); return chain; },
        del: (...args: unknown[]) => { mockRedisDel(...args); return chain; },
        exec: async () => {
          const resolved = await hgetallResult;
          return [resolved, 1];
        },
      };
      return chain;
    },
  },
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  getWorkflowClient: () => ({ trigger: mockWorkflowTrigger }),
}));

// Chain-mock: ignores table/column/condition context so results are purely
// order-dependent (mockResolvedValueOnce). If query shapes change, assertions
// may silently pass with wrong data. Full query correctness is covered by
// PGlite-backed integration tests. If stronger unit-test guarantees are needed,
// replace with table/condition-aware stubs.
vi.mock("@db/console/client", () => ({
  db: {
    query: {
      gwInstallations: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockSelectLimit(),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: () => mockInsertReturning(),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => mockUpdateWhere(),
      }),
    }),
  },
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: { id: "id", provider: "provider", status: "status" },
  gwResources: {
    id: "id",
    installationId: "installationId",
    providerResourceId: "providerResourceId",
    status: "status",
  },
}));

vi.mock("../providers", () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
}));

vi.mock("../providers/types", () => ({}));

vi.mock("@repo/lib", () => ({
  nanoid: vi.fn().mockReturnValue("mock-nanoid"),
}));

vi.mock("../lib/urls", () => ({
  gatewayBaseUrl: "https://gateway.test/services",
  consoleUrl: "https://console.test",
  relayBaseUrl: "https://relay.test/api",
  backfillUrl: "https://backfill.test/api",
  cancelBackfillService: vi.fn().mockResolvedValue(undefined),
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
  } = {},
) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  const body =
    typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  return app.request(path, { method: init.method ?? "GET", headers, body });
}

// ── Tests ──

describe("GET /connections/:provider/authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
  });

  it("returns 401 without X-API-Key", async () => {
    const res = await request("/connections/github/authorize", {
      headers: { "X-Org-Id": "org-1", "X-User-Id": "user-1" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });

  it("returns 401 with wrong X-API-Key", async () => {
    const res = await request("/connections/github/authorize", {
      headers: { "X-Org-Id": "org-1", "X-User-Id": "user-1", "X-API-Key": "wrong-key" },
    });
    expect(res.status).toBe(401);
  });

  it("returns authorization URL for github", async () => {
    const res = await request("/connections/github/authorize", {
      headers: { "X-Org-Id": "org-1", "X-User-Id": "user-1", "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { url: string; state: string };
    expect(json.url).toContain("github.com");
    expect(json.state).toBe("mock-nanoid");
    expect(mockRedisHset).toHaveBeenCalled();
    expect(mockRedisExpire).toHaveBeenCalled();
  });

  it("returns 400 for unknown provider", async () => {
    mockGetProvider.mockImplementation(() => {
      throw new Error("unknown");
    });
    const res = await request("/connections/unknown/authorize", {
      headers: { "X-Org-Id": "org-1", "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "unknown_provider" });
  });

  it("returns 400 when org_id is missing", async () => {
    const res = await request("/connections/github/authorize", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_org_id" });
  });

  it("returns 400 for invalid redirect_to (external domain)", async () => {
    const res = await request(
      "/connections/github/authorize?redirect_to=https%3A%2F%2Fevil.com",
      {
        headers: { "X-Org-Id": "org-1", "X-API-Key": "test-api-key" },
      },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_redirect_to" });
  });

  it("returns 400 for invalid redirect_to (non-URL string)", async () => {
    const res = await request(
      "/connections/github/authorize?redirect_to=not-a-url",
      {
        headers: { "X-Org-Id": "org-1", "X-API-Key": "test-api-key" },
      },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_redirect_to" });
  });

  it("stores redirect_to=inline in Redis state", async () => {
    const res = await request(
      "/connections/github/authorize?redirect_to=inline",
      {
        headers: { "X-Org-Id": "org-1", "X-User-Id": "user-1", "X-API-Key": "test-api-key" },
      },
    );
    expect(res.status).toBe(200);
    // Check that hset was called with redirectTo
    expect(mockRedisHset).toHaveBeenCalledWith(
      expect.stringContaining("gw:oauth:state:"),
      expect.objectContaining({ redirectTo: "inline" }),
    );
  });

  it("stores localhost redirect_to in Redis state", async () => {
    const res = await request(
      "/connections/github/authorize?redirect_to=http%3A%2F%2Flocalhost%3A4200%2Fcallback",
      {
        headers: { "X-Org-Id": "org-1", "X-User-Id": "user-1", "X-API-Key": "test-api-key" },
      },
    );
    expect(res.status).toBe(200);
    expect(mockRedisHset).toHaveBeenCalledWith(
      expect.stringContaining("gw:oauth:state:"),
      expect.objectContaining({ redirectTo: "http://localhost:4200/callback" }),
    );
  });
});

describe("GET /connections/oauth/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when state is missing", async () => {
    const res = await request("/connections/oauth/status");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_state" });
  });

  it("returns pending when no result exists", async () => {
    mockRedisHgetall.mockResolvedValue(null);
    const res = await request("/connections/oauth/status?state=pending-state");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "pending" });
  });

  it("returns completed result when OAuth succeeded", async () => {
    mockRedisHgetall.mockResolvedValue({
      status: "completed",
      provider: "github",
    });
    const res = await request("/connections/oauth/status?state=done-state");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; provider: string };
    expect(json.status).toBe("completed");
    expect(json.provider).toBe("github");
  });

  it("returns failed result when OAuth errored", async () => {
    mockRedisHgetall.mockResolvedValue({
      status: "failed",
      error: "missing installation_id",
    });
    const res = await request("/connections/oauth/status?state=failed-state");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; error: string };
    expect(json.status).toBe("failed");
    expect(json.error).toBe("missing installation_id");
  });
});

describe("GET /connections/:provider/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
  });

  it("returns 400 for unknown provider", async () => {
    mockGetProvider.mockImplementation(() => {
      throw new Error("unknown");
    });
    const res = await request("/connections/unknown/callback?state=abc");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "unknown_provider" });
  });

  it("returns 400 when state is missing", async () => {
    const res = await request("/connections/github/callback");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "invalid_or_expired_state",
    });
  });

  it("returns 400 when state is expired/invalid", async () => {
    mockRedisHgetall.mockResolvedValue(null);
    const res = await request("/connections/github/callback?state=expired");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "invalid_or_expired_state",
    });
  });

  it("returns 400 when provider mismatch in state", async () => {
    mockGetProvider.mockReturnValue({ ...mockProvider, name: "vercel" });
    mockRedisHgetall.mockResolvedValue({
      provider: "linear",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    const res = await request(
      "/connections/vercel/callback?state=mismatched",
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "invalid_or_expired_state",
    });
  });

  it("redirects to console on successful callback (default, no redirectTo)", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    const res = await request(
      "/connections/github/callback?state=valid&installation_id=123",
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://console.test/provider/github/connected",
    );
    expect(mockProvider.handleCallback).toHaveBeenCalled();
  });

  it("includes reactivated param in redirect when applicable", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    mockProvider.handleCallback.mockResolvedValueOnce({
      status: "connected",
      installationId: "inst-1",
      provider: "github",
      reactivated: true,
    });
    const res = await request(
      "/connections/github/callback?state=valid&installation_id=123",
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("reactivated=true");
  });

  it("redirects to nextUrl when provider returns it (Vercel lifecycle)", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    mockProvider.handleCallback.mockResolvedValueOnce({
      status: "connected",
      installationId: "inst-1",
      provider: "github",
      nextUrl: "https://vercel.com/integrations/test/complete",
    });
    const res = await request(
      "/connections/github/callback?state=valid&installation_id=123",
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://vercel.com/integrations/test/complete",
    );
  });

  it("nextUrl takes priority over redirectTo", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
      redirectTo: "http://localhost:4200/callback",
    });
    mockProvider.handleCallback.mockResolvedValueOnce({
      status: "connected",
      installationId: "inst-1",
      provider: "github",
      nextUrl: "https://vercel.com/integrations/test/complete",
    });
    const res = await request(
      "/connections/github/callback?state=valid&installation_id=123",
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://vercel.com/integrations/test/complete",
    );
  });

  it("falls through to default redirect when nextUrl is absent", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    mockProvider.handleCallback.mockResolvedValueOnce({
      status: "connected",
      installationId: "inst-1",
      provider: "github",
    });
    const res = await request(
      "/connections/github/callback?state=valid&installation_id=123",
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://console.test/provider/github/connected",
    );
  });

  it("includes setup_action param in redirect when applicable", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    mockProvider.handleCallback.mockResolvedValueOnce({
      status: "connected",
      installationId: "inst-1",
      provider: "github",
      setupAction: "request",
    });
    const res = await request(
      "/connections/github/callback?state=valid&installation_id=123",
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("setup_action=request");
  });

  it("returns inline HTML when redirectTo=inline (CLI mode)", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
      redirectTo: "inline",
    });
    const res = await request(
      "/connections/github/callback?state=valid&installation_id=123",
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Connected to github!");
    expect(body).toContain("close this tab");
  });

  it("redirects to custom redirectTo URL when provided", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
      redirectTo: "http://localhost:4200/callback",
    });
    const res = await request(
      "/connections/github/callback?state=valid&installation_id=123",
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("localhost:4200/callback");
  });

  it("stores completed result in Redis for polling", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    await request(
      "/connections/github/callback?state=poll-state&installation_id=123",
    );
    // Pipeline hset should be called with the result key
    expect(mockRedisHset).toHaveBeenCalledWith(
      expect.stringContaining("gw:oauth:result:"),
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("redirects with error when handleCallback throws", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    mockProvider.handleCallback.mockRejectedValueOnce(
      new Error("missing installation_id"),
    );
    const res = await request("/connections/github/callback?state=valid");
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("https://console.test/provider/github/connected");
    expect(location).toContain("error=missing%20installation_id");
  });

  it("returns inline error HTML when redirectTo=inline and handleCallback throws", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
      redirectTo: "inline",
    });
    mockProvider.handleCallback.mockRejectedValueOnce(
      new Error("auth_failed"),
    );
    const res = await request("/connections/github/callback?state=valid");
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Connection Failed");
    expect(body).toContain("auth_failed");
  });

  it("stores failed result in Redis for polling when handleCallback throws", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    mockProvider.handleCallback.mockRejectedValueOnce(
      new Error("network_error"),
    );
    await request("/connections/github/callback?state=poll-state");
    expect(mockRedisHset).toHaveBeenCalledWith(
      expect.stringContaining("gw:oauth:result:"),
      expect.objectContaining({ status: "failed", error: "network_error" }),
    );
  });

  it("redirects with error for insert_failed", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    mockProvider.handleCallback.mockRejectedValueOnce(
      new Error("insert_failed"),
    );
    const res = await request("/connections/github/callback?state=valid");
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("error=insert_failed");
  });

  it("redirects with error for unexpected errors", async () => {
    mockRedisHgetall.mockResolvedValue({
      provider: "github",
      orgId: "org-1",
      connectedBy: "user-1",
    });
    mockProvider.handleCallback.mockRejectedValueOnce(
      new Error("network_error"),
    );
    const res = await request("/connections/github/callback?state=valid");
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("error=network_error");
  });
});

describe("GET /connections/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without API key", async () => {
    const res = await request("/connections/conn-1");
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong API key", async () => {
    const res = await request("/connections/conn-1", {
      headers: { "X-API-Key": "wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when connection not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await request("/connections/conn-1", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(404);
  });

  it("returns hasToken=true for github (on-demand token generation)", async () => {
    mockFindFirst.mockResolvedValue({
      id: "conn-1",
      provider: "github",
      externalId: "12345",
      accountLogin: "my-org",
      orgId: "org-1",
      status: "active",
      tokens: [],
      resources: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    const res = await request("/connections/conn-1", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      id: string;
      provider: string;
      hasToken: boolean;
    };
    expect(json.id).toBe("conn-1");
    expect(json.provider).toBe("github");
    expect(json.hasToken).toBe(true);
  });
});

describe("GET /connections/:id/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
  });

  it("returns 401 without API key", async () => {
    const res = await request("/connections/conn-1/token");
    expect(res.status).toBe(401);
  });

  it("returns 404 when installation not found", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    const res = await request("/connections/conn-1/token", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when installation is not active", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", status: "revoked" },
    ]);
    const res = await request("/connections/conn-1/token", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "installation_not_active",
    });
  });

  it("returns token when installation is active", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", status: "active" },
    ]);
    const res = await request("/connections/conn-1/token", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { accessToken: string };
    expect(json.accessToken).toBe("tok-123");
  });

  it("returns 404 when provider throws no_token_found", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", status: "active" },
    ]);
    mockProvider.resolveToken.mockRejectedValueOnce(
      new Error("no_token_found"),
    );
    const res = await request("/connections/conn-1/token", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when provider throws token_expired", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", status: "active" },
    ]);
    mockProvider.resolveToken.mockRejectedValueOnce(
      new Error("token_expired"),
    );
    const res = await request("/connections/conn-1/token", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "token_expired" });
  });
});

describe("DELETE /connections/:provider/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without API key", async () => {
    const res = await request("/connections/github/conn-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when installation not found", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    const res = await request("/connections/github/conn-1", {
      method: "DELETE",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(404);
  });

  it("triggers teardown workflow and returns 200", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", orgId: "org-1" },
    ]);
    const res = await request("/connections/github/conn-1", {
      method: "DELETE",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("teardown_initiated");
    expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
  });
});

describe("POST /connections/:id/resources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without API key", async () => {
    const res = await request("/connections/conn-1/resources", {
      method: "POST",
      body: { providerResourceId: "repo-1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when installation not found", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    const res = await request("/connections/conn-1/resources", {
      method: "POST",
      body: { providerResourceId: "repo-1" },
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when installation is not active", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", status: "revoked" },
    ]);
    const res = await request("/connections/conn-1/resources", {
      method: "POST",
      body: { providerResourceId: "repo-1" },
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "installation_not_active",
    });
  });

  it("returns 400 when missing providerResourceId", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", status: "active", orgId: "org-1" },
    ]);
    const res = await request("/connections/conn-1/resources", {
      method: "POST",
      body: {},
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "missing_provider_resource_id",
    });
  });

  it("returns 409 when resource already linked", async () => {
    // First select: installation found
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", status: "active", orgId: "org-1" },
    ]);
    // Second select: existing resource found
    mockSelectLimit.mockResolvedValueOnce([{ id: "res-existing" }]);

    const res = await request("/connections/conn-1/resources", {
      method: "POST",
      body: { providerResourceId: "repo-1" },
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "resource_already_linked",
    });
  });

  it("links resource successfully", async () => {
    // First select: installation found
    mockSelectLimit.mockResolvedValueOnce([
      { id: "conn-1", provider: "github", status: "active", orgId: "org-1" },
    ]);
    // Second select: no existing resource
    mockSelectLimit.mockResolvedValueOnce([]);
    // Insert returns new resource
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: "res-new",
        providerResourceId: "repo-1",
        resourceName: "my-repo",
      },
    ]);

    const res = await request("/connections/conn-1/resources", {
      method: "POST",
      body: { providerResourceId: "repo-1", resourceName: "my-repo" },
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      status: string;
      resource: { id: string };
    };
    expect(json.status).toBe("linked");
    expect(json.resource.id).toBe("res-new");
    expect(mockRedisHset).toHaveBeenCalled();
  });
});

describe("DELETE /connections/:id/resources/:resourceId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without API key", async () => {
    const res = await request("/connections/conn-1/resources/res-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when resource not found", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    const res = await request("/connections/conn-1/resources/res-1", {
      method: "DELETE",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when resource already removed", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: "res-1",
        installationId: "conn-1",
        providerResourceId: "repo-1",
        status: "removed",
      },
    ]);
    const res = await request("/connections/conn-1/resources/res-1", {
      method: "DELETE",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "already_removed" });
  });

  it("removes resource and cleans up Redis cache", async () => {
    // First select: resource found
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: "res-1",
        installationId: "conn-1",
        providerResourceId: "repo-1",
        status: "active",
      },
    ]);
    // Second select: installation for cache cleanup
    mockSelectLimit.mockResolvedValueOnce([{ provider: "github" }]);

    const res = await request("/connections/conn-1/resources/res-1", {
      method: "DELETE",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; resourceId: string };
    expect(json.status).toBe("removed");
    expect(json.resourceId).toBe("res-1");
    expect(mockRedisDel).toHaveBeenCalled();
  });
});

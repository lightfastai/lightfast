/**
 * Integration tests for proxy endpoints using PGlite.
 *
 * GET  /connections/:id/proxy/endpoints
 * POST /connections/:id/proxy/execute  (token injection, path/query params, 401 retry)
 *
 * Real DB (PGlite), real Drizzle relational queries.
 * Outbound HTTP mocked via vi.stubGlobal("fetch", mockFetch).
 */

import { gatewayInstallations } from "@db/console/schema";
import type { TestDb } from "@repo/console-test-db";
import { closeTestDb, createTestDb, resetTestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
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

// ── Hoisted mocks ──

const {
  mockGetInstallationToken,
  mockBuildAuth,
  mockCreateConfig,
  mockFetch,
  mockApiEndpoints,
} = vi.hoisted(() => ({
  mockGetInstallationToken: vi.fn().mockResolvedValue("tok-abc"),
  mockBuildAuth: vi.fn().mockResolvedValue("app-jwt-xyz"),
  mockCreateConfig: vi
    .fn()
    .mockImplementation((_env: unknown, _runtime: unknown) => ({})),
  mockFetch: vi.fn(),
  mockApiEndpoints: {
    "list-repos": {
      method: "GET",
      path: "/user/repos",
      description: "List repositories",
    },
    "get-repo": {
      method: "GET",
      path: "/repos/{owner}/{repo}",
      description: "Get a repository",
      timeout: 5000,
    },
    "create-issue": {
      method: "POST",
      path: "/repos/{owner}/{repo}/issues",
      description: "Create an issue",
    },
    "get-app-installation": {
      method: "GET",
      path: "/app/installations/{installation_id}",
      description: "Get an installation (uses endpoint-level buildAuth)",
      buildAuth: (...args: unknown[]) => mockBuildAuth(...args),
    },
  },
}));

vi.mock("@db/console/client", () => ({
  get db() {
    return db;
  },
}));

vi.mock("../env", () => ({
  env: {
    GATEWAY_API_KEY: "test-api-key",
    ENCRYPTION_KEY: "test-encryption-key-32-chars-long!",
  },
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    hset: vi.fn().mockResolvedValue("OK"),
    hgetall: vi.fn().mockResolvedValue(null),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  workflowClient: {
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-1" }),
  },
}));

vi.mock("@repo/console-providers", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const providers = {
    github: {
      name: "github",
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
      oauth: {
        buildAuthUrl: vi.fn(),
        processCallback: vi.fn(),
        revokeToken: vi.fn(),
        usesStoredToken: false,
        getActiveToken: (...args: unknown[]) =>
          mockGetInstallationToken(...args),
        refreshToken: vi.fn(),
      },
      api: {
        baseUrl: "https://api.github.com",
        endpoints: mockApiEndpoints,
        buildAuthHeader: undefined as undefined,
        defaultHeaders: {},
      },
    },
    vercel: {
      name: "vercel",
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
      oauth: {
        buildAuthUrl: vi.fn(),
        processCallback: vi.fn(),
        revokeToken: vi.fn(),
        usesStoredToken: true,
        getActiveToken: vi.fn().mockResolvedValue("vercel-tok"),
        refreshToken: vi.fn(),
      },
      api: {
        baseUrl: "https://api.vercel.com",
        endpoints: {
          "list-deployments": {
            method: "GET",
            path: "/v6/deployments",
            description: "List deployments",
          },
        },
        buildAuthHeader: (tok: string) => `Bearer ${tok}`,
        defaultHeaders: { "X-Vercel-Version": "1" },
      },
    },
    linear: {
      name: "linear",
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
      oauth: {
        buildAuthUrl: vi.fn(),
        processCallback: vi.fn(),
        revokeToken: vi.fn(),
        usesStoredToken: true,
        getActiveToken: vi.fn().mockResolvedValue("linear-tok"),
        refreshToken: vi.fn(),
      },
      api: {
        baseUrl: "https://api.linear.app",
        endpoints: {},
        buildAuthHeader: undefined as undefined,
        defaultHeaders: {},
      },
    },
    sentry: {
      name: "sentry",
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
      oauth: {
        buildAuthUrl: vi.fn(),
        processCallback: vi.fn(),
        revokeToken: vi.fn(),
        usesStoredToken: true,
        getActiveToken: vi.fn().mockResolvedValue("sentry-tok"),
        refreshToken: vi.fn(),
      },
      api: {
        baseUrl: "https://sentry.io",
        endpoints: {},
        buildAuthHeader: undefined as undefined,
        defaultHeaders: {},
      },
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
  writeTokenRecord: vi.fn().mockResolvedValue(undefined),
  updateTokenRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/urls", () => ({
  gatewayBaseUrl: "https://gateway.test/services",
  consoleUrl: "https://console.test",
  relayBaseUrl: "https://relay.test/api",
}));

// ── Import app ──

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

function makeJsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  mockGetInstallationToken.mockResolvedValue("tok-abc");
  mockCreateConfig.mockImplementation(
    (_env: unknown, _runtime: unknown) => ({})
  );
  // Default fetch: 200 JSON response
  mockFetch.mockResolvedValue(makeJsonResponse({ items: [] }));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /connections/:id/proxy/endpoints
// ══════════════════════════════════════════════════════════════════════════════

describe("GET /connections/:id/proxy/endpoints (integration)", () => {
  it("returns 401 without API key", async () => {
    const res = await request("/connections/any-id/proxy/endpoints");
    expect(res.status).toBe(401);
  });

  it("returns 404 when installation does not exist", async () => {
    const res = await request("/connections/nonexistent/proxy/endpoints", {
      headers: API,
    });
    expect(res.status).toBe(404);
  });

  it("returns endpoint catalog with method, path, description for each endpoint", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/proxy/endpoints`, {
      headers: API,
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      provider: string;
      baseUrl: string;
      endpoints: Record<
        string,
        { method: string; path: string; description: string }
      >;
    };
    expect(json.provider).toBe("github");
    expect(json.baseUrl).toBe("https://api.github.com");
    expect(json.endpoints).toHaveProperty("list-repos");
    expect(json.endpoints["list-repos"]).toMatchObject({
      method: "GET",
      path: "/user/repos",
      description: "List repositories",
    });
  });

  it("includes timeout field when endpoint defines it", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/proxy/endpoints`, {
      headers: API,
    });
    const json = (await res.json()) as {
      endpoints: Record<string, { timeout?: number }>;
    };
    expect(json.endpoints["get-repo"]?.timeout).toBe(5000);
    expect(json.endpoints["list-repos"]).not.toHaveProperty("timeout");
  });

  it("returns all registered endpoints", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/proxy/endpoints`, {
      headers: API,
    });
    const json = (await res.json()) as { endpoints: Record<string, unknown> };
    expect(Object.keys(json.endpoints)).toEqual(
      expect.arrayContaining(["list-repos", "get-repo", "create-issue"])
    );
  });

  it("returns 400 for unknown provider", async () => {
    // Insert an installation with a provider not in registry
    // (simulated via a provider that getProvider returns undefined for)
    // In our mock, all 4 providers are registered. We'll test what happens
    // if the DB has a provider not in the mock by directly inserting.
    const inst = fixtures.installation({
      provider: "unknown-provider" as "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/proxy/endpoints`, {
      headers: API,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "unknown_provider" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /connections/:id/proxy/execute
// ══════════════════════════════════════════════════════════════════════════════

describe("POST /connections/:id/proxy/execute (integration)", () => {
  // ── Auth & validation ──

  it("returns 401 without API key", async () => {
    const res = await request("/connections/any-id/proxy/execute", {
      method: "POST",
      body: { endpointId: "list-repos" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when installation does not exist", async () => {
    const res = await request("/connections/nonexistent/proxy/execute", {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when installation is not active", async () => {
    const inst = fixtures.installation({ status: "revoked" });
    await db.insert(gatewayInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "installation_not_active",
    });
  });

  it("returns 400 when endpointId is missing", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: {},
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_endpoint_id" });
  });

  describe("proxy execute — contract fuzzing", () => {
    it.each([
      ["endpointId is null", { endpointId: null }],
      ["endpointId is empty string", { endpointId: "" }],
      ["endpointId is number", { endpointId: 123 }],
    ])("returns 400 for: %s", async (_label, body) => {
      const inst = fixtures.installation({
        provider: "github",
        status: "active",
      });
      await db.insert(gatewayInstallations).values(inst);

      const res = await request(`/connections/${inst.id}/proxy/execute`, {
        method: "POST",
        headers: API,
        body: body as Record<string, unknown>,
      });
      expect(res.status).toBe(400);
      // fetch must NOT have been called (no upstream API call)
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it("returns 400 with available endpoints when endpointId not in catalog", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "nonexistent-endpoint" },
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; available: string[] };
    expect(json.error).toBe("unknown_endpoint");
    expect(json.available).toEqual(
      expect.arrayContaining(["list-repos", "get-repo", "create-issue"])
    );
  });

  it("returns 400 on malformed JSON body", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: "not-json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_json" });
  });

  // ── Token injection ──

  it("injects Authorization: Bearer <token> header into outbound request", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockGetInstallationToken.mockResolvedValue("my-secret-tok");

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });

    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer my-secret-tok");
  });

  it("uses buildAuthHeader when provider defines it", async () => {
    // vercel uses buildAuthHeader: (tok) => `Bearer ${tok}` — same here but proves the code path
    const inst = fixtures.installation({
      provider: "vercel",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-deployments" },
    });

    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer /);
  });

  it("returns 502 when token retrieval throws", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockGetInstallationToken.mockRejectedValueOnce(
      new Error("GitHub API down")
    );

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "token_error" });
  });

  it("uses endpoint.buildAuth instead of getActiveToken when defined", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockBuildAuth.mockResolvedValueOnce("app-jwt-tok");

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: {
        endpointId: "get-app-installation",
        pathParams: { installation_id: "12345" },
      },
    });

    expect(mockBuildAuth).toHaveBeenCalled();
    expect(mockGetInstallationToken).not.toHaveBeenCalled();
    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer app-jwt-tok");
  });

  it("returns 502 when endpoint.buildAuth throws", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockBuildAuth.mockRejectedValueOnce(new Error("JWT signing failed"));

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: {
        endpointId: "get-app-installation",
        pathParams: { installation_id: "12345" },
      },
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "token_error" });
  });

  // ── Path params ──

  it("substitutes {owner} and {repo} pathParams in endpoint path", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: {
        endpointId: "get-repo",
        pathParams: { owner: "acme", repo: "my-app" },
      },
    });

    const [fetchUrl] = mockFetch.mock.calls[0] as [string];
    expect(fetchUrl).toContain("/repos/acme/my-app");
  });

  it("URL-encodes pathParam values", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: {
        endpointId: "get-repo",
        pathParams: { owner: "my org", repo: "my app" },
      },
    });

    const [fetchUrl] = mockFetch.mock.calls[0] as [string];
    expect(fetchUrl).toContain("my%20org");
    expect(fetchUrl).toContain("my%20app");
  });

  it("leaves unmatched {param} placeholders unchanged", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: {
        endpointId: "get-repo",
        pathParams: { owner: "acme" }, // repo is missing
      },
    });

    const [fetchUrl] = mockFetch.mock.calls[0] as [string];
    expect(fetchUrl).toContain("{repo}");
  });

  // ── Query params ──

  it("appends queryParams as URL search string", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: {
        endpointId: "list-repos",
        queryParams: { per_page: "10", sort: "updated" },
      },
    });

    const [fetchUrl] = mockFetch.mock.calls[0] as [string];
    expect(fetchUrl).toContain("per_page=10");
    expect(fetchUrl).toContain("sort=updated");
  });

  it("no '?' in URL when queryParams is absent", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });

    const [fetchUrl] = mockFetch.mock.calls[0] as [string];
    expect(fetchUrl).not.toContain("?");
  });

  // ── Request body ──

  it("sends body as JSON when body field is present", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: {
        endpointId: "create-issue",
        pathParams: { owner: "acme", repo: "myrepo" },
        body: { title: "Bug report", labels: ["bug"] },
      },
    });

    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchInit.method).toBe("POST");
    expect(fetchInit.body).toBe(
      JSON.stringify({ title: "Bug report", labels: ["bug"] })
    );
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends no body when body field is absent", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });

    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchInit.body).toBeUndefined();
  });

  // ── Raw response pass-through ──

  it("returns { status, data, headers } for 200 response", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockFetch.mockResolvedValueOnce(
      makeJsonResponse([{ id: 1, name: "my-repo" }])
    );

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      status: number;
      data: unknown;
      headers: Record<string, string>;
    };
    expect(json.status).toBe(200);
    expect(json.data).toEqual([{ id: 1, name: "my-repo" }]);
    expect(json).toHaveProperty("headers");
  });

  it("passes upstream 404 through without error-wrapping", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ message: "Not Found" }, 404)
    );

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });
    expect(res.status).toBe(200); // gateway always returns 200
    const json = (await res.json()) as { status: number; data: unknown };
    expect(json.status).toBe(404);
    expect(json.data).toMatchObject({ message: "Not Found" });
  });

  it("returns data: null for non-JSON upstream response", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockFetch.mockResolvedValueOnce(
      new Response("plain text response", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });
    const json = (await res.json()) as { data: unknown };
    expect(json.data).toBeNull();
  });

  // ── 401 retry with token refresh ──

  it("on 401: retries with fresh token when forceRefreshToken returns a different token", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    // First call → initial token; second call (forceRefreshToken) → fresh token
    mockGetInstallationToken
      .mockResolvedValueOnce("old-tok")
      .mockResolvedValueOnce("new-tok");

    // First fetch returns 401; second returns 200
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(makeJsonResponse({ items: ["repo"] }));

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [, secondInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    const headers = secondInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer new-tok");

    const json = (await res.json()) as { status: number };
    expect(json.status).toBe(200);
  });

  it("on 401: does NOT retry if fresh token equals original token", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    // Both calls return the same token → no retry
    mockGetInstallationToken.mockResolvedValue("same-tok");

    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ message: "Unauthorized" }, 401)
    );

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });

    // Only 1 fetch (no retry)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const json = (await res.json()) as { status: number };
    expect(json.status).toBe(401);
  });

  it("on 401: does NOT retry if forceRefreshToken returns null", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    mockGetInstallationToken
      .mockResolvedValueOnce("tok-a")
      .mockRejectedValueOnce(new Error("getActiveToken failed")); // forceRefreshToken falls through

    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ message: "Unauthorized" }, 401)
    );

    const res = await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });

    // Only 1 fetch (refresh returned null)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const json = (await res.json()) as { status: number };
    expect(json.status).toBe(401);
  });

  // ── Timeout ──

  it("sets AbortSignal.timeout when endpoint.timeout is defined", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    // Spy on AbortSignal.timeout
    const origTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    timeoutSpy.mockImplementation(origTimeout);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "get-repo", pathParams: { owner: "a", repo: "b" } },
    });

    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    timeoutSpy.mockRestore();
  });

  it("defaults AbortSignal.timeout to 30_000 when endpoint has no timeout", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gatewayInstallations).values(inst);

    const origTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    timeoutSpy.mockImplementation(origTimeout);

    await request(`/connections/${inst.id}/proxy/execute`, {
      method: "POST",
      headers: API,
      body: { endpointId: "list-repos" },
    });

    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    timeoutSpy.mockRestore();
  });
});

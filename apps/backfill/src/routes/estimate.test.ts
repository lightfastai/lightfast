import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock externals ──

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("../env", () => ({
  env: { GATEWAY_API_KEY: "test-key" },
  getEnv: () => ({ GATEWAY_API_KEY: "test-key" }),
}));

const mockFetchPage = vi.fn();

vi.mock("@repo/console-backfill", () => ({
  getConnector: (provider: string) => {
    if (provider === "github") {
      return {
        provider: "github",
        defaultEntityTypes: ["pull_request", "issue", "release"],
        fetchPage: mockFetchPage,
      };
    }
    return undefined;
  },
}));

vi.mock("../lib/related-projects", () => ({
  gatewayUrl: "https://gateway.test/services",
}));

vi.stubGlobal("fetch", mockFetch);

// ── Import after mocks ──

import { Hono } from "hono";
import { estimate } from "./estimate.js";

const app = new Hono();
app.route("/api/estimate", estimate);

function request(
  body: Record<string, unknown> | string,
  headers: Record<string, string> = {},
) {
  const h = new Headers(headers);
  if (!h.has("content-type")) h.set("content-type", "application/json");
  return app.request("/api/estimate", {
    method: "POST",
    headers: h,
    body: typeof body === "object" ? JSON.stringify(body) : body,
  });
}

const validBody = {
  installationId: "inst-1",
  provider: "github",
  orgId: "org-1",
  depth: 30,
};

function mockGatewayResponses() {
  // Connection response
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        id: "inst-1",
        provider: "github",
        status: "active",
        resources: [
          { providerResourceId: "repo-1", resourceName: "org/repo-1" },
          { providerResourceId: "repo-2", resourceName: "org/repo-2" },
        ],
      }),
      { status: 200 },
    ),
  );
  // Token response
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ accessToken: "ghs_token123", provider: "github", expiresIn: 3600 }),
      { status: 200 },
    ),
  );
}

// ── Tests ──

describe("POST /api/estimate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ──

  it("returns 401 without API key", async () => {
    const res = await request(validBody);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });

  it("returns 401 with wrong API key", async () => {
    const res = await request(validBody, { "X-API-Key": "wrong" });
    expect(res.status).toBe(401);
  });

  // ── Validation ──

  it("returns 400 for invalid JSON", async () => {
    const res = await request("not-json{", { "X-API-Key": "test-key" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_json" });
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(
      { installationId: "inst-1" },
      { "X-API-Key": "test-key" },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_body" });
  });

  // ── Connection not found ──

  it("returns 404 when connection not found", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 404 }));

    const res = await request(validBody, { "X-API-Key": "test-key" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "connection_not_found" });
  });

  // ── No connector ──

  it("returns 400 when no connector for provider", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "inst-1",
          provider: "unknown",
          status: "active",
          resources: [],
        }),
        { status: 200 },
      ),
    );

    const res = await request(
      { ...validBody, provider: "unknown" },
      { "X-API-Key": "test-key" },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "no_connector" });
  });

  // ── Token fetch failed ──

  it("returns 502 when token fetch fails", async () => {
    // Connection OK
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "inst-1",
          provider: "github",
          status: "active",
          resources: [{ providerResourceId: "repo-1", resourceName: "org/repo-1" }],
        }),
        { status: 200 },
      ),
    );
    // Token fails
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));

    const res = await request(validBody, { "X-API-Key": "test-key" });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "token_fetch_failed" });
  });

  // ── Success ──

  it("returns estimate for valid request with default entity types", async () => {
    mockGatewayResponses();

    // fetchPage called for each resource × entityType (2 resources × 3 entity types = 6 calls)
    mockFetchPage.mockResolvedValue({
      events: [],
      nextCursor: null,
      rawCount: 25,
    });

    const res = await request(validBody, { "X-API-Key": "test-key" });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.installationId).toBe("inst-1");
    expect(json.provider).toBe("github");
    expect(json.depth).toBe(30);
    expect(json.entityTypes).toEqual(["pull_request", "issue", "release"]);
    expect(json.since).toBeDefined();

    // Check estimate structure
    expect(json.estimate.pull_request).toBeDefined();
    expect(json.estimate.pull_request.resources).toBe(2);
    expect(json.estimate.pull_request.samples).toHaveLength(2);
    expect(json.estimate.pull_request.estimatedItems).toBe(50); // 25 per resource × 2

    // Check totals
    expect(json.totals.estimatedItems).toBe(150); // 50 per entity type × 3
    expect(json.totals.estimatedPages).toBe(6); // 2 resources × 3 entity types, no hasMore
    expect(json.totals.estimatedApiCalls).toBe(14); // 6*2 + 2
    expect(json.totals.rateLimitUsage).toBeDefined();

    // fetchPage called 6 times (2 resources × 3 entity types)
    expect(mockFetchPage).toHaveBeenCalledTimes(6);
  });

  it("returns estimate with custom entity types", async () => {
    mockGatewayResponses();
    mockFetchPage.mockResolvedValue({
      events: [],
      nextCursor: null,
      rawCount: 10,
    });

    const res = await request(
      { ...validBody, entityTypes: ["pull_request"] },
      { "X-API-Key": "test-key" },
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.entityTypes).toEqual(["pull_request"]);
    expect(json.estimate.pull_request).toBeDefined();
    expect(json.estimate.issue).toBeUndefined();

    // Only 2 calls (2 resources × 1 entity type)
    expect(mockFetchPage).toHaveBeenCalledTimes(2);
  });

  it("accounts for hasMore in page estimates", async () => {
    mockGatewayResponses();

    // First resource has more pages, second doesn't
    mockFetchPage
      .mockResolvedValueOnce({ events: [], nextCursor: "cursor-1", rawCount: 100 })
      .mockResolvedValueOnce({ events: [], nextCursor: null, rawCount: 30 });

    const res = await request(
      { ...validBody, entityTypes: ["pull_request"] },
      { "X-API-Key": "test-key" },
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    const pr = json.estimate.pull_request;
    expect(pr.samples[0].hasMore).toBe(true);
    expect(pr.samples[1].hasMore).toBe(false);
    // 2 samples + 1 resource with hasMore × 2 extra pages = 4
    expect(pr.estimatedPages).toBe(4);
  });

  it("handles fetchPage errors gracefully with -1 returnedCount", async () => {
    mockGatewayResponses();

    mockFetchPage
      .mockResolvedValueOnce({ events: [], nextCursor: null, rawCount: 50 })
      .mockRejectedValueOnce(new Error("API error")); // Second resource fails

    const res = await request(
      { ...validBody, entityTypes: ["pull_request"] },
      { "X-API-Key": "test-key" },
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    const pr = json.estimate.pull_request;
    expect(pr.samples[0].returnedCount).toBe(50);
    expect(pr.samples[1].returnedCount).toBe(-1); // Error indicator
    expect(pr.estimatedItems).toBe(50); // Only counts successful
  });
});

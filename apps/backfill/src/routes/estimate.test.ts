import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock externals ──

vi.mock("../env", () => ({
  env: { GATEWAY_API_KEY: "test-key" },
}));

const mockBuildRequest = vi.fn();
const mockProcessResponse = vi.fn();

const mockGetProvider = vi.fn();
vi.mock("@repo/console-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/console-providers")>();
  return {
    ...actual,
    getProvider: (...args: unknown[]) => mockGetProvider(...args),
  };
});

const mockGatewayClient = {
  getConnection: vi.fn(),
  executeApi: vi.fn(),
};
vi.mock("@repo/gateway-service-clients", () => ({
  createGatewayClient: () => mockGatewayClient,
}));

// ── Import after mocks ──

import { Hono } from "hono";
import { estimate } from "./estimate.js";

const app = new Hono();
app.route("/estimate", estimate);

function request(
  body: Record<string, unknown> | string,
  headers: Record<string, string> = {}
) {
  const h = new Headers(headers);
  if (!h.has("content-type")) {
    h.set("content-type", "application/json");
  }
  return app.request("/estimate", {
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

const defaultConnection = {
  id: "inst-1",
  provider: "github",
  externalId: "12345",
  orgId: "org-1",
  status: "active",
  resources: [
    { id: "r1", providerResourceId: "repo-1", resourceName: "org/repo-1" },
    { id: "r2", providerResourceId: "repo-2", resourceName: "org/repo-2" },
  ],
};

const mockProvider = {
  api: { parseRateLimit: vi.fn().mockReturnValue(null) },
  backfill: {
    supportedEntityTypes: ["pull_request", "issue", "release"],
    defaultEntityTypes: ["pull_request", "issue", "release"],
    entityTypes: {
      pull_request: {
        endpointId: "list-pull-requests",
        buildRequest: mockBuildRequest,
        processResponse: mockProcessResponse,
      },
      issue: {
        endpointId: "list-issues",
        buildRequest: mockBuildRequest,
        processResponse: mockProcessResponse,
      },
      release: {
        endpointId: "list-releases",
        buildRequest: mockBuildRequest,
        processResponse: mockProcessResponse,
      },
    },
  },
};

function mockGatewayResponses() {
  mockGatewayClient.getConnection.mockResolvedValueOnce(defaultConnection);
}

// ── Tests ──

describe("POST /api/estimate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
    mockBuildRequest.mockReturnValue({});
    mockProcessResponse.mockReturnValue({
      events: [],
      nextCursor: null,
      rawCount: 0,
    });
    mockGatewayClient.executeApi.mockResolvedValue({
      status: 200,
      data: [],
      headers: {},
    });
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
      { "X-API-Key": "test-key" }
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_body" });
  });

  // ── Connection not found ──

  it("returns 404 when connection not found", async () => {
    mockGatewayClient.getConnection.mockRejectedValueOnce(
      new Error("Gateway getConnection failed: 404 for inst-1")
    );

    const res = await request(validBody, { "X-API-Key": "test-key" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "connection_not_found" });
  });

  // ── Org mismatch ──

  it("returns 403 when orgId does not match connection", async () => {
    mockGatewayClient.getConnection.mockResolvedValueOnce({
      ...defaultConnection,
      orgId: "org-different",
    });

    const res = await request(
      { ...validBody, orgId: "org-1" },
      { "X-API-Key": "test-key" }
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect((json as { error: string }).error).toBe("org_mismatch");
  });

  // ── Invalid provider (rejected by schema validation) ──

  it("returns 400 when provider is not a valid source type", async () => {
    const res = await request(
      { ...validBody, provider: "unknown" },
      { "X-API-Key": "test-key" }
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_body" });
  });

  // ── Success ──

  it("returns estimate for valid request with default entity types", async () => {
    mockGatewayResponses();

    // executeApi + processResponse called for each resource × entityType (2 × 3 = 6)
    mockGatewayClient.executeApi.mockResolvedValue({
      status: 200,
      data: [],
      headers: {},
    });
    mockProcessResponse.mockReturnValue({
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

    // executeApi called 6 times (2 resources × 3 entity types)
    expect(mockGatewayClient.executeApi).toHaveBeenCalledTimes(6);
  });

  it("returns estimate with custom entity types", async () => {
    mockGatewayResponses();
    mockProcessResponse.mockReturnValue({
      events: [],
      nextCursor: null,
      rawCount: 10,
    });

    const res = await request(
      { ...validBody, entityTypes: ["pull_request"] },
      { "X-API-Key": "test-key" }
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.entityTypes).toEqual(["pull_request"]);
    expect(json.estimate.pull_request).toBeDefined();
    expect(json.estimate.issue).toBeUndefined();

    // Only 2 calls (2 resources × 1 entity type)
    expect(mockGatewayClient.executeApi).toHaveBeenCalledTimes(2);
  });

  it("accounts for hasMore in page estimates", async () => {
    mockGatewayResponses();

    // First resource has more pages, second doesn't
    mockProcessResponse
      .mockReturnValueOnce({
        events: [],
        nextCursor: "cursor-1",
        rawCount: 100,
      })
      .mockReturnValueOnce({ events: [], nextCursor: null, rawCount: 30 });

    const res = await request(
      { ...validBody, entityTypes: ["pull_request"] },
      { "X-API-Key": "test-key" }
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    const pr = json.estimate.pull_request;
    expect(pr.samples[0].hasMore).toBe(true);
    expect(pr.samples[1].hasMore).toBe(false);
    // 2 samples + 1 resource with hasMore × 2 extra pages = 4
    expect(pr.estimatedPages).toBe(4);
  });

  it("handles URL-unsafe characters in providerResourceId", async () => {
    mockGatewayClient.getConnection.mockResolvedValueOnce({
      ...defaultConnection,
      resources: [
        { id: "r1", providerResourceId: "foo/bar baz", resourceName: "test" },
      ],
    });
    mockProcessResponse.mockReturnValue({
      events: [],
      nextCursor: null,
      rawCount: 0,
    });

    const res = await request(
      { ...validBody, entityTypes: ["pull_request"] },
      { "X-API-Key": "test-key" }
    );
    expect(res.status).toBe(200);
  });

  it("handles executeApi errors gracefully with -1 returnedCount", async () => {
    mockGatewayResponses();

    mockProcessResponse.mockReturnValueOnce({
      events: [],
      nextCursor: null,
      rawCount: 50,
    });
    mockGatewayClient.executeApi
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} })
      .mockRejectedValueOnce(new Error("API error")); // Second resource fails

    const res = await request(
      { ...validBody, entityTypes: ["pull_request"] },
      { "X-API-Key": "test-key" }
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    const pr = json.estimate.pull_request;
    expect(pr.samples[0].returnedCount).toBe(50);
    expect(pr.samples[1].returnedCount).toBe(-1); // Error indicator
    expect(pr.estimatedItems).toBe(50); // Only counts successful
  });
});

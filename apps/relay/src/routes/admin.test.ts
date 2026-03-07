import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock externals (vi.hoisted runs before vi.mock hoisting) ──

const { mockEnv, mockReplayDeliveries, mockDbSelect } = vi.hoisted(() => {
  const env = {
    GATEWAY_API_KEY: "test-api-key",
  };

  // Each call to db.select() returns a fresh chain.
  // We control what each chain resolves to via selectResults.
  let selectCallIndex = 0;
  const selectResults: unknown[][] = [];

  function createChain(results: unknown[]) {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation((n: number) => {
        (chain as Record<string, unknown>)._limitValue = n;
        return Promise.resolve(results);
      }),
      // For chains that end at .where() (like remaining-count query),
      // make it thenable so `const [x] = await db.select().from().where()` works
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        return Promise.resolve(results).then(resolve, reject);
      },
      _limitValue: undefined as number | undefined,
    };
    return chain;
  }

  const mockSelect = vi.fn().mockImplementation(() => {
    const idx = selectCallIndex++;
    const results = selectResults[idx] ?? [];
    return createChain(results);
  });

  return {
    mockEnv: env,
    mockDbSelect: {
      fn: mockSelect,
      setResults: (results: unknown[][]) => {
        selectCallIndex = 0;
        selectResults.length = 0;
        selectResults.push(...results);
      },
      reset: () => {
        selectCallIndex = 0;
        selectResults.length = 0;
      },
    },
    mockReplayDeliveries: vi.fn().mockResolvedValue({
      replayed: [],
      skipped: [],
      failed: [],
    }),
  };
});

vi.mock("../env", () => ({
  env: mockEnv,
}));

vi.mock("@vendor/upstash", () => ({
  redis: { ping: vi.fn(), pipeline: vi.fn(), del: vi.fn() },
}));

vi.mock("@vendor/db", () => ({
  and: (...args: unknown[]) => ({ _and: args }),
  eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
  gte: (a: unknown, b: unknown) => ({ _gte: [a, b] }),
  lte: (a: unknown, b: unknown) => ({ _lte: [a, b] }),
  notInArray: (a: unknown, b: unknown) => ({ _notInArray: [a, b] }),
  or: (...args: unknown[]) => ({ _or: args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    _sql: strings.join("?"),
    values,
  }),
}));

vi.mock("@db/console/client", () => ({
  db: {
    select: mockDbSelect.fn,
    execute: vi.fn(),
  },
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: { id: "id", provider: "provider", orgId: "orgId" },
  gwResources: {
    id: "id",
    installationId: "installationId",
    providerResourceId: "providerResourceId",
    status: "status",
  },
  gwWebhookDeliveries: {
    id: "id",
    provider: "provider",
    deliveryId: "deliveryId",
    installationId: "installationId",
    status: "status",
    receivedAt: "receivedAt",
    eventType: "eventType",
    payload: "payload",
  },
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({ publishJSON: vi.fn() }),
  Receiver: class {
    verify() {
      return Promise.resolve(true);
    }
  },
}));

vi.mock("../lib/replay", () => ({
  replayDeliveries: mockReplayDeliveries,
}));

vi.mock("../lib/cache", () => ({
  resourceKey: (provider: string, resourceId: string) =>
    `gw:resource:${provider}:${resourceId}`,
  RESOURCE_CACHE_TTL: 86400,
}));

// ── Import after mocks ──

import { Hono } from "hono";
import { admin } from "./admin.js";

const app = new Hono();
app.route("/api/admin", admin);

function request(
  path: string,
  init: {
    method?: string;
    body?: string | Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
) {
  const method = init.method ?? "POST";
  const headers = new Headers(init.headers);
  if (method === "POST" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const body =
    typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  return app.request(path, { method, headers, body });
}

// ── Tests ──

describe("POST /api/admin/replay/catchup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.reset();
  });

  // ── Auth ──

  it("returns 401 without X-API-Key", async () => {
    const res = await request("/api/admin/replay/catchup", {
      body: {},
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });

  // ── Empty results ──

  it("returns empty when no undelivered webhooks", async () => {
    // First select: deliveries query returns empty
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/replay/catchup", {
      headers: { "X-API-Key": "test-api-key" },
      body: {},
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "empty",
      message: "No un-delivered webhooks found",
    });
    expect(mockReplayDeliveries).not.toHaveBeenCalled();
  });

  // ── Filtering ──

  it("replays webhooks filtered by installationId", async () => {
    const deliveries = [
      {
        id: "d1",
        provider: "github",
        deliveryId: "del-1",
        installationId: "inst-1",
        status: "received",
        receivedAt: "2026-01-01T00:00:00Z",
        payload: "{}",
      },
    ];

    // First select: deliveries; Second select: remaining count
    mockDbSelect.setResults([deliveries, [{ count: 5 }]]);

    mockReplayDeliveries.mockResolvedValueOnce({
      replayed: ["del-1"],
      skipped: [],
      failed: [],
    });

    const res = await request("/api/admin/replay/catchup", {
      headers: { "X-API-Key": "test-api-key" },
      body: { installationId: "inst-1" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      status: "replayed",
      replayed: ["del-1"],
      remaining: 5,
    });
    expect(mockReplayDeliveries).toHaveBeenCalledWith(deliveries);
  });

  it("replays webhooks filtered by provider", async () => {
    const deliveries = [
      {
        id: "d2",
        provider: "linear",
        deliveryId: "del-2",
        installationId: "inst-2",
        status: "received",
        receivedAt: "2026-01-01T00:00:00Z",
        payload: "{}",
      },
    ];

    mockDbSelect.setResults([deliveries, [{ count: 0 }]]);

    mockReplayDeliveries.mockResolvedValueOnce({
      replayed: ["del-2"],
      skipped: [],
      failed: [],
    });

    const res = await request("/api/admin/replay/catchup", {
      headers: { "X-API-Key": "test-api-key" },
      body: { provider: "linear" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      status: "replayed",
      replayed: ["del-2"],
      remaining: 0,
    });
    expect(mockReplayDeliveries).toHaveBeenCalledWith(deliveries);
  });

  // ── Batch size clamping ──

  it("clamps batchSize to minimum of 1", async () => {
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/replay/catchup", {
      headers: { "X-API-Key": "test-api-key" },
      body: { batchSize: -5 },
    });

    expect(res.status).toBe(200);
    // Verify via the chain's limit call — the chain is created per select
    const chain = mockDbSelect.fn.mock.results[0]?.value;
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("clamps batchSize to maximum of 200", async () => {
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/replay/catchup", {
      headers: { "X-API-Key": "test-api-key" },
      body: { batchSize: 500 },
    });

    expect(res.status).toBe(200);
    const chain = mockDbSelect.fn.mock.results[0]?.value;
    expect(chain.limit).toHaveBeenCalledWith(200);
  });

  // ── Remaining count ──

  it("returns remaining count excluding replayed IDs", async () => {
    const deliveries = [
      {
        id: "d3",
        provider: "github",
        deliveryId: "del-3",
        installationId: "inst-1",
        status: "received",
        receivedAt: "2026-01-01T00:00:00Z",
        payload: "{}",
      },
      {
        id: "d4",
        provider: "github",
        deliveryId: "del-4",
        installationId: "inst-1",
        status: "received",
        receivedAt: "2026-01-01T00:01:00Z",
        payload: "{}",
      },
    ];

    // First select: deliveries; Second select: remaining count
    mockDbSelect.setResults([deliveries, [{ count: 10 }]]);

    mockReplayDeliveries.mockResolvedValueOnce({
      replayed: ["del-3", "del-4"],
      skipped: [],
      failed: [],
    });

    const res = await request("/api/admin/replay/catchup", {
      headers: { "X-API-Key": "test-api-key" },
      body: {},
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      status: "replayed",
      replayed: ["del-3", "del-4"],
      remaining: 10,
    });
  });
});

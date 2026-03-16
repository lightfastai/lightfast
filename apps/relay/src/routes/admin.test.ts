import { beforeEach, describe, expect, it, vi } from "vitest";

// Root-level beforeEach: runs before every test in this file (all describes).
// Keeps mock state clean without requiring per-describe setup blocks.
function resetAllMocks() {
  vi.clearAllMocks();
  mockDbSelect.reset();
  mockRedisPing.mockResolvedValue("PONG");
  mockDbExecute.mockResolvedValue(undefined);
  mockQStashVerify.mockResolvedValue(true);
  mockReplayDeliveries.mockResolvedValue({
    replayed: [],
    skipped: [],
    failed: [],
  });
  mockDbUpdate.mockImplementation(() => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }));
}

// ── Mock externals (vi.hoisted runs before vi.mock hoisting) ──

const {
  mockEnv,
  mockReplayDeliveries,
  mockDbSelect,
  mockDbUpdate,
  mockQStashVerify,
  mockRedisPipeline,
  mockRedisPing,
  mockDbExecute,
} = vi.hoisted(() => {
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
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation((n: number) => {
        (chain as Record<string, unknown>)._limitValue = n;
        return chain;
      }),
      // For chains ending at .where()/.offset()/.orderBy()/.limit(),
      // make it thenable so `await db.select().from()...` works
      // biome-ignore lint/suspicious/noThenProperty: mock db query chain needs .then
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
    mockDbUpdate: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
    mockQStashVerify: vi.fn().mockResolvedValue(true),
    mockRedisPipeline: {
      hset: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    },
    mockRedisPing: vi.fn().mockResolvedValue("PONG"),
    mockDbExecute: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../env", () => ({
  env: mockEnv,
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    ping: mockRedisPing,
    pipeline: () => mockRedisPipeline,
    del: vi.fn(),
  },
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
    execute: mockDbExecute,
    update: mockDbUpdate,
  },
}));

vi.mock("@db/console/schema", () => ({
  gatewayInstallations: { id: "id", provider: "provider", orgId: "orgId" },
  gatewayResources: {
    id: "id",
    installationId: "installationId",
    providerResourceId: "providerResourceId",
    status: "status",
  },
  gatewayWebhookDeliveries: {
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
    verify(...args: unknown[]) {
      return mockQStashVerify(...args);
    }
  },
}));

vi.mock("../lib/replay", () => ({
  replayDeliveries: mockReplayDeliveries,
}));

vi.mock("../lib/cache", () => ({
  resourceKey: (provider: string, resourceId: string) =>
    `gw:resource:${provider}:${resourceId}`,
  RESOURCE_CACHE_TTL: 86_400,
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
  } = {}
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

// Root-level cleanup — applies to every test in this file
beforeEach(resetAllMocks);

// ── Tests ──

describe("POST /api/admin/replay/catchup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.reset();
    mockRedisPing.mockResolvedValue("PONG");
    mockDbExecute.mockResolvedValue(undefined);
    mockQStashVerify.mockResolvedValue(true);
    mockReplayDeliveries.mockResolvedValue({
      replayed: [],
      skipped: [],
      failed: [],
    });
    mockDbUpdate.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }));
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
      body: { installationId: "inst-1" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "empty",
      message: "No un-delivered webhooks found",
    });
    expect(mockReplayDeliveries).not.toHaveBeenCalled();
  });

  it("returns 400 when installationId is missing", async () => {
    const res = await request("/api/admin/replay/catchup", {
      headers: { "X-API-Key": "test-api-key" },
      body: {},
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("validation_error");
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
      body: { installationId: "inst-2", provider: "linear" },
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
      body: { installationId: "inst-1", batchSize: -5 },
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
      body: { installationId: "inst-1", batchSize: 500 },
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
      body: { installationId: "inst-1" },
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

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/health
// ══════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/health", () => {
  it("returns 200 with status=ok when Redis and DB are healthy", async () => {
    const res = await request("/api/admin/health", { method: "GET" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({
      status: "ok",
      redis: "connected",
      database: "connected",
    });
    expect(typeof json.uptime_ms).toBe("number");
  });

  it("returns 503 with status=degraded when Redis ping fails", async () => {
    mockRedisPing.mockRejectedValueOnce(new Error("Redis unavailable"));
    const res = await request("/api/admin/health", { method: "GET" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      status: "degraded",
      redis: "error",
      database: "connected",
    });
  });

  it("returns 503 with status=degraded when DB execute fails", async () => {
    mockDbExecute.mockRejectedValueOnce(new Error("DB unavailable"));
    const res = await request("/api/admin/health", { method: "GET" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      status: "degraded",
      redis: "connected",
      database: "error",
    });
  });

  it("returns 503 when both Redis and DB fail", async () => {
    mockRedisPing.mockRejectedValueOnce(new Error("Redis down"));
    mockDbExecute.mockRejectedValueOnce(new Error("DB down"));
    const res = await request("/api/admin/health", { method: "GET" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      status: "degraded",
      redis: "error",
      database: "error",
    });
  });

  it("response always includes redis, database, and uptime_ms fields", async () => {
    const res = await request("/api/admin/health", { method: "GET" });
    const json = await res.json();
    expect(json).toHaveProperty("redis");
    expect(json).toHaveProperty("database");
    expect(json).toHaveProperty("uptime_ms");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/cache/rebuild
// ══════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/cache/rebuild", () => {
  it("returns 401 without X-API-Key", async () => {
    const res = await request("/api/admin/cache/rebuild");
    expect(res.status).toBe(401);
  });

  it("returns { status: 'rebuilt', count: 0 } when no active resources", async () => {
    mockDbSelect.setResults([[]]);
    const res = await request("/api/admin/cache/rebuild", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "rebuilt", count: 0 });
    expect(mockRedisPipeline.exec).not.toHaveBeenCalled();
  });

  it("processes one batch and returns correct count", async () => {
    const resources = [
      {
        provider: "github",
        providerResourceId: "owner/repo-1",
        installationId: "inst-1",
        orgId: "org-1",
      },
      {
        provider: "github",
        providerResourceId: "owner/repo-2",
        installationId: "inst-1",
        orgId: "org-1",
      },
    ];
    mockDbSelect.setResults([resources]);
    const res = await request("/api/admin/cache/rebuild", {
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "rebuilt", count: 2 });
  });

  it("calls pipeline.hset with correct key format per resource", async () => {
    const resources = [
      {
        provider: "github",
        providerResourceId: "owner/repo",
        installationId: "inst-1",
        orgId: "org-1",
      },
    ];
    mockDbSelect.setResults([resources]);

    await request("/api/admin/cache/rebuild", {
      headers: { "X-API-Key": "test-api-key" },
    });

    expect(mockRedisPipeline.hset).toHaveBeenCalledWith(
      "gw:resource:github:owner/repo",
      { connectionId: "inst-1", orgId: "org-1" }
    );
  });

  it("calls pipeline.expire per resource and pipeline.exec once per batch", async () => {
    const resources = [
      {
        provider: "github",
        providerResourceId: "r1",
        installationId: "inst-1",
        orgId: "org-1",
      },
      {
        provider: "github",
        providerResourceId: "r2",
        installationId: "inst-1",
        orgId: "org-1",
      },
    ];
    mockDbSelect.setResults([resources]);

    await request("/api/admin/cache/rebuild", {
      headers: { "X-API-Key": "test-api-key" },
    });

    expect(mockRedisPipeline.expire).toHaveBeenCalledTimes(2);
    expect(mockRedisPipeline.exec).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/dlq
// ══════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/dlq", () => {
  it("returns 401 without X-API-Key", async () => {
    const res = await request("/api/admin/dlq", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns DLQ items with default limit=50, offset=0", async () => {
    const items = [{ id: "d1", provider: "github", status: "dlq" }];
    mockDbSelect.setResults([items]);

    const res = await request("/api/admin/dlq", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ items, limit: 50, offset: 0 });
  });

  it("respects ?limit= and ?offset= query params", async () => {
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/dlq?limit=10&offset=20", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ limit: 10, offset: 20 });
    const chain = mockDbSelect.fn.mock.results[0]?.value as {
      limit: ReturnType<typeof vi.fn>;
    };
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it("clamps limit to max 100", async () => {
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/dlq?limit=999", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { limit: number };
    expect(json.limit).toBe(100);
  });

  it("clamps limit to min 1", async () => {
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/dlq?limit=0", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { limit: number };
    expect(json.limit).toBe(1);
  });

  it("handles NaN limit gracefully (falls back to 50)", async () => {
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/dlq?limit=abc", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { limit: number };
    expect(json.limit).toBe(50);
  });

  it("returns { items, limit, offset } shape", async () => {
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/dlq", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key" },
    });
    const json = await res.json();
    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("limit");
    expect(json).toHaveProperty("offset");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/dlq/replay
// ══════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/dlq/replay", () => {
  it("returns 401 without X-API-Key", async () => {
    const res = await request("/api/admin/dlq/replay");
    expect(res.status).toBe(401);
  });

  it("returns 400 with invalid_json on malformed body", async () => {
    const res = await request("/api/admin/dlq/replay", {
      headers: { "X-API-Key": "test-api-key" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_json" });
  });

  it("returns 400 when deliveryIds is empty array", async () => {
    const res = await request("/api/admin/dlq/replay", {
      headers: { "X-API-Key": "test-api-key" },
      body: { deliveryIds: [] },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_delivery_ids" });
  });

  it("returns 400 when deliveryIds is absent", async () => {
    const res = await request("/api/admin/dlq/replay", {
      headers: { "X-API-Key": "test-api-key" },
      body: {},
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_delivery_ids" });
  });

  it("returns 404 when no matching DLQ entries found", async () => {
    mockDbSelect.setResults([[]]);

    const res = await request("/api/admin/dlq/replay", {
      headers: { "X-API-Key": "test-api-key" },
      body: { deliveryIds: [{ provider: "github", deliveryId: "del-1" }] },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: "no_matching_dlq_entries",
    });
  });

  it("calls replayDeliveries with the matched DLQ entries", async () => {
    const entry = {
      id: "d1",
      provider: "github",
      deliveryId: "del-1",
      installationId: "inst-1",
      status: "dlq",
      payload: "{}",
    };
    mockDbSelect.setResults([[entry]]);
    mockReplayDeliveries.mockResolvedValueOnce({
      replayed: ["del-1"],
      skipped: [],
      failed: [],
    });

    const res = await request("/api/admin/dlq/replay", {
      headers: { "X-API-Key": "test-api-key" },
      body: { deliveryIds: [{ provider: "github", deliveryId: "del-1" }] },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "replayed",
      replayed: ["del-1"],
    });
    expect(mockReplayDeliveries).toHaveBeenCalledWith([entry]);
  });

  it("handles compound provider+deliveryId filter (distinct across providers)", async () => {
    const githubEntry = {
      id: "d1",
      provider: "github",
      deliveryId: "del-1",
      status: "dlq",
      payload: "{}",
    };
    mockDbSelect.setResults([[githubEntry]]);
    mockReplayDeliveries.mockResolvedValueOnce({
      replayed: ["del-1"],
      skipped: [],
      failed: [],
    });

    const res = await request("/api/admin/dlq/replay", {
      headers: { "X-API-Key": "test-api-key" },
      body: {
        deliveryIds: [
          { provider: "github", deliveryId: "del-1" },
          { provider: "linear", deliveryId: "del-1" },
        ],
      },
    });
    expect(res.status).toBe(200);
    // replayDeliveries only called with the matched github entry
    expect(mockReplayDeliveries).toHaveBeenCalledWith([githubEntry]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/delivery-status
// ══════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/delivery-status", () => {
  it("returns 401 without Upstash-Signature header", async () => {
    const res = await request("/api/admin/delivery-status", {
      body: { messageId: "msg-1", state: "delivered" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "missing_signature" });
  });

  it("returns 401 when QStash signature is invalid", async () => {
    mockQStashVerify.mockRejectedValueOnce(new Error("invalid signature"));

    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "bad-sig" },
      body: { messageId: "msg-1", state: "delivered" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_signature" });
  });

  it("returns 400 when messageId is missing", async () => {
    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: { state: "delivered" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "missing_required_fields",
    });
  });

  it("returns 400 when state is missing", async () => {
    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: { messageId: "msg-1" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "missing_required_fields",
    });
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_json" });
  });

  it("updates delivery to 'delivered' when state='delivered' and deliveryId present", async () => {
    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: { messageId: "msg-1", state: "delivered", deliveryId: "del-1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "received" });
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    const setChain = mockDbUpdate.mock.results[0]?.value as {
      set: ReturnType<typeof vi.fn>;
    };
    expect(setChain.set).toHaveBeenCalledWith({ status: "delivered" });
  });

  it("updates delivery to 'dlq' when state='error' and deliveryId present", async () => {
    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: { messageId: "msg-1", state: "error", deliveryId: "del-1" },
    });
    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    const setChain = mockDbUpdate.mock.results[0]?.value as {
      set: ReturnType<typeof vi.fn>;
    };
    expect(setChain.set).toHaveBeenCalledWith({ status: "dlq" });
  });

  it("does NOT update when state is unrecognized", async () => {
    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: { messageId: "msg-1", state: "pending", deliveryId: "del-1" },
    });
    expect(res.status).toBe(200);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("does NOT update when deliveryId is absent", async () => {
    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: { messageId: "msg-1", state: "delivered" },
    });
    expect(res.status).toBe(200);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("applies provider query param as additional WHERE condition", async () => {
    const res = await request("/api/admin/delivery-status?provider=github", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: { messageId: "msg-1", state: "delivered", deliveryId: "del-1" },
    });
    expect(res.status).toBe(200);
    // Update still called — provider filtering is passed through to WHERE clause
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });

  it("always returns { status: 'received' }", async () => {
    const res = await request("/api/admin/delivery-status", {
      headers: { "Upstash-Signature": "valid-sig" },
      body: { messageId: "msg-1", state: "delivered", deliveryId: "del-1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "received" });
  });
});

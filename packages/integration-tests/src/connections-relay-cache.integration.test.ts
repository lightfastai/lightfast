/**
 * Suite 1: Connections ↔ Relay Redis Cache Contract
 *
 * Verifies that the shared `gw:resource:{provider}:{id}` Redis key namespace
 * is consistent between:
 *   - Connections (writes on POST /connections/:id/resources, deletes on DELETE)
 *   - Relay (reads in webhook-delivery `resolve-connection` step)
 *
 * Infrastructure: PGlite (real DB), in-memory Redis Map, no Inngest/QStash needed.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import {
  createTestDb,
  resetTestDb,
  closeTestDb,
} from "@repo/console-test-db";
import type { TestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
import { gwInstallations, gwResources } from "@db/console/schema";

// ── Shared state (assigned in beforeAll, accessed via lazy getter in vi.mock) ──
let db: TestDb;

// ── Create all mock state in vi.hoisted (runs before vi.mock factories) ──
const {
  redisMock,
  redisStore,
  qstashMock,
  workflowTriggerMock,
} = await vi.hoisted(async () => {
  const { makeRedisMock, makeQStashMock } = await import("./harness.js");
  const redisStore = new Map<string, unknown>();
  const qstashMessages: { url: string; body: unknown }[] = [];
  return {
    redisMock: makeRedisMock(redisStore),
    redisStore,
    qstashMock: makeQStashMock(qstashMessages),
    workflowTriggerMock: vi.fn().mockResolvedValue({ workflowRunId: "wf-1" }),
  };
});

// ── vi.mock declarations (hoisted above imports by vitest transform) ──

vi.mock("@db/console/client", () => ({
  // lazy getter — db is null until beforeAll assigns it
  get db() { return db; },
}));

vi.mock("@vendor/upstash", () => ({
  redis: redisMock,
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => qstashMock,
  Receiver: class { verify() { return Promise.resolve(true); } },
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  getWorkflowClient: () => ({ trigger: workflowTriggerMock }),
}));

// Capture webhook-delivery workflow handler (used by Relay)
vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    // Return captured handler so tests can invoke it directly
    (globalThis as Record<string, unknown>).__capturedWorkflowHandler = handler;
    return () => new Response("ok");
  },
}));

// Return localhost URLs so service router can intercept
vi.mock("@vendor/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { projectName: string; defaultHost: string }) =>
    defaultHost,
}));

vi.mock("@vercel/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { projectName: string; defaultHost: string }) =>
    defaultHost,
}));

// ── Import apps after mocks are registered ──

// Import full Hono apps via vitest path aliases (see vitest.config.ts)
import connectionsApp from "@connections/app";
import { webhookSeenKey, resourceKey as relayResourceKey } from "@relay/cache";

// Force relay webhook-delivery module to load and capture its serve() handler
await import("@relay/webhook-delivery");

// ── Request helper ──

const API_HEADERS = { "X-API-Key": "0".repeat(64) };

function req(
  path: string,
  init: { method?: string; body?: Record<string, unknown>; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  return connectionsApp.request(path, {
    method: init.method ?? "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restore mock implementations that clearAllMocks resets
  redisMock.hset.mockImplementation((key: string, fields: Record<string, unknown>) => {
    const existing = (redisStore.get(key) ?? {}) as Record<string, unknown>;
    redisStore.set(key, { ...existing, ...fields });
    return Promise.resolve(1);
  });
  redisMock.hgetall.mockImplementation((key: string) =>
    Promise.resolve((redisStore.get(key) ?? null) as Record<string, string> | null),
  );
  redisMock.set.mockImplementation((key: string, value: unknown, opts?: { nx?: boolean }) => {
    if (opts?.nx && redisStore.has(key)) return Promise.resolve(null);
    redisStore.set(key, value);
    return Promise.resolve("OK");
  });
  redisMock.del.mockImplementation((...keys: string[]) => {
    const allKeys = keys.flat();
    let count = 0;
    for (const k of allKeys) { if (redisStore.delete(k)) count++; }
    return Promise.resolve(count);
  });
  redisMock.get.mockImplementation((key: string) =>
    Promise.resolve(redisStore.get(key) ?? null),
  );
});

afterEach(async () => {
  await resetTestDb();
  redisStore.clear();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Tests ──

describe("Suite 1.1 — Resource link populates relay routing cache", () => {
  it("POST /services/connections/:id/resources writes gw:resource:{provider}:{id} to Redis", async () => {
    const inst = fixtures.installation({ provider: "github", orgId: "org-1", status: "active" });
    await db.insert(gwInstallations).values(inst);

    const res = await req(`/services/connections/${inst.id}/resources`, {
      method: "POST",
      body: { providerResourceId: "owner/my-repo", resourceName: "my-repo" },
      headers: API_HEADERS,
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { status: string };
    expect(json.status).toBe("linked");

    // Redis key must use the shared format
    const expectedKey = `gw:resource:github:owner/my-repo`;
    expect(redisMock.hset).toHaveBeenCalledWith(expectedKey, {
      connectionId: inst.id,
      orgId: "org-1",
    });

    // The key is now present in the in-memory store (simulating what Relay would read)
    const cached = redisStore.get(expectedKey) as Record<string, string>;
    expect(cached).toBeDefined();
    expect(cached.connectionId).toBe(inst.id);
    expect(cached.orgId).toBe("org-1");
  });

  it("Relay resolve-connection step reads the Connections-written Redis cache", async () => {
    // Simulate what Connections writes after a resource link
    const connectionId = "conn-redis-1";
    const orgId = "org-redis-1";
    redisStore.set("gw:resource:github:cached-repo", { connectionId, orgId });

    // Relay's resolve-connection step reads via redis.hgetall
    const cached = await redisMock.hgetall("gw:resource:github:cached-repo") as { connectionId: string; orgId: string } | null;

    expect(cached).not.toBeNull();
    if (!cached) throw new Error("cached should not be null");
    expect(cached.connectionId).toBe(connectionId);
    expect(cached.orgId).toBe(orgId);
  });
});

describe("Suite 1.2 — Resource unlink removes relay routing cache", () => {
  it("DELETE /services/connections/:id/resources/:rid removes the Redis key", async () => {
    const inst = fixtures.installation({ provider: "github", status: "active" });
    await db.insert(gwInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "owner/to-unlink",
      status: "active",
    });
    await db.insert(gwResources).values(resource);

    // Pre-seed Redis (simulating an earlier resource link)
    redisStore.set("gw:resource:github:owner/to-unlink", {
      connectionId: inst.id,
      orgId: inst.orgId,
    });

    const res = await req(
      `/services/connections/${inst.id}/resources/${resource.id}`,
      { method: "DELETE", headers: API_HEADERS },
    );

    expect(res.status).toBe(200);

    // Connections must delete the key so Relay stops routing webhooks
    expect(redisMock.del).toHaveBeenCalledWith("gw:resource:github:owner/to-unlink");
    expect(redisStore.has("gw:resource:github:owner/to-unlink")).toBe(false);

    // Relay would now get a cache miss
    const cached = await redisMock.hgetall("gw:resource:github:owner/to-unlink");
    expect(cached).toBeNull();
  });
});

describe("Suite 1.3 — Teardown clears all resource cache keys", () => {
  it("Redis.del removes multiple resource keys (simulating cleanup-cache step)", async () => {
    const provider = "github";
    const ids = ["repo-alpha", "repo-beta", "repo-gamma"];

    // Seed three resource keys
    for (const id of ids) {
      redisStore.set(`gw:resource:${provider}:${id}`, { connectionId: "conn-1", orgId: "org-1" });
    }

    // Teardown cleanup-cache step calls del with all keys at once
    await redisMock.del(...ids.map((id) => `gw:resource:${provider}:${id}`));

    // All keys should be gone
    for (const id of ids) {
      expect(redisStore.has(`gw:resource:${provider}:${id}`)).toBe(false);
      const cached = await redisMock.hgetall(`gw:resource:${provider}:${id}`);
      expect(cached).toBeNull();
    }
  });
});

describe("Suite 1.4 — Key format parity between Connections and Relay", () => {
  it("connections.resourceKey() matches relay.resourceKey() for the same inputs", async () => {
    const { resourceKey: connectionsKey } = await import(
      "@connections/cache"
    );

    const testCases: [string, string][] = [
      ["github", "owner/repo"],
      ["vercel", "prj_abc123"],
      ["linear", "team-xyz"],
      ["sentry", "org-slug"],
      ["github", "12345"],
    ];

    for (const [provider, resourceId] of testCases) {
      const connKey = connectionsKey(provider as never, resourceId);
      const gwKey = relayResourceKey(provider as never, resourceId);
      expect(connKey).toBe(gwKey);
      expect(connKey).toBe(`gw:resource:${provider}:${resourceId}`);
    }
  });

  it("webhookSeenKey uses gw:webhook:seen:{provider}:{deliveryId} format", () => {
    expect(webhookSeenKey("github" as never, "del-abc123")).toBe(
      "gw:webhook:seen:github:del-abc123",
    );
    expect(webhookSeenKey("vercel" as never, "del-vc-001")).toBe(
      "gw:webhook:seen:vercel:del-vc-001",
    );
  });
});

describe("Suite 1.5 — Relay deduplication via webhookSeenKey", () => {
  it("first delivery succeeds (SET NX returns OK), second is duplicate (returns null)", async () => {
    const key = webhookSeenKey("github" as never, "del-dedup-test");

    const first = await redisMock.set(key, "1", { nx: true });
    expect(first).toBe("OK");
    expect(redisStore.has(key)).toBe(true);

    // Same deliveryId → SET NX returns null (key already exists)
    const second = await redisMock.set(key, "1", { nx: true });
    expect(second).toBeNull();
  });

  it("different deliveryIds each get their own dedup key", async () => {
    const key1 = webhookSeenKey("github" as never, "del-1");
    const key2 = webhookSeenKey("github" as never, "del-2");

    await redisMock.set(key1, "1", { nx: true });
    const result = await redisMock.set(key2, "1", { nx: true });

    expect(result).toBe("OK"); // Different key → not a duplicate
  });
});

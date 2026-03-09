/**
 * Integration tests for connection routes using PGlite.
 *
 * Real DB queries (drizzle-orm, @db/console/schema) — no hollow chain mocks.
 * External services (Redis, providers, workflow, env) are still mocked.
 */

import { gwInstallations, gwResources, gwTokens } from "@db/console/schema";
import type { TestDb } from "@repo/console-test-db";
import { closeTestDb, createTestDb, resetTestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
import { eq } from "@vendor/db";
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

// ── Hoisted mocks (available inside vi.mock factories) ──

const {
  mockRedisHset,
  mockRedisHgetall,
  mockRedisExpire,
  mockRedisDel,
  mockWorkflowTrigger,
  mockGetInstallationToken,
  mockWriteTokenRecord,
  mockCreateConfig,
} = vi.hoisted(() => {
  const mockGetInstallationToken = vi.fn().mockResolvedValue("tok-123");
  const mockCreateConfig = vi
    .fn()
    .mockImplementation((_env: unknown, _runtime: unknown) => ({}));

  return {
    mockRedisHset: vi.fn().mockResolvedValue("OK"),
    mockRedisHgetall: vi.fn().mockResolvedValue(null),
    mockRedisExpire: vi.fn().mockResolvedValue(1),
    mockRedisDel: vi.fn().mockResolvedValue(1),
    mockWorkflowTrigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-1" }),
    mockGetInstallationToken,
    mockWriteTokenRecord: vi.fn().mockResolvedValue(undefined),
    mockCreateConfig,
  };
});

// ── vi.mock declarations ──
// DB client uses a getter so the PGlite instance is resolved lazily after beforeAll.

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
    hset: (...args: unknown[]) => mockRedisHset(...args),
    hgetall: (...args: unknown[]) => mockRedisHgetall(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
  },
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  workflowClient: { trigger: mockWorkflowTrigger },
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
        getActiveToken: vi.fn(),
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
        getActiveToken: vi.fn(),
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
        getActiveToken: vi.fn(),
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
  writeTokenRecord: (...args: unknown[]) => mockWriteTokenRecord(...args),
  updateTokenRecord: vi.fn().mockResolvedValue(undefined),
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
  mockCreateConfig.mockImplementation(
    (_env: unknown, _runtime: unknown) => ({})
  );
  mockGetInstallationToken.mockResolvedValue("tok-123");
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ── GET /connections/:id ──

describe("GET /connections/:id (integration)", () => {
  it("returns 404 when installation does not exist in DB", async () => {
    const res = await request("/connections/nonexistent-id", { headers: API });
    expect(res.status).toBe(404);
  });

  it("returns installation with active resources only", async () => {
    const inst = fixtures.installation({ provider: "github", orgId: "org-1" });
    await db.insert(gwInstallations).values(inst);

    const activeRes = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "my-org/active-repo",
      resourceName: "active-repo",
      status: "active",
    });
    const removedRes = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "my-org/removed-repo",
      resourceName: "removed-repo",
      status: "removed",
    });
    await db.insert(gwResources).values([activeRes, removedRes]);

    const res = await request(`/connections/${inst.id}`, { headers: API });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      id: string;
      provider: string;
      hasToken: boolean;
      resources: { providerResourceId: string }[];
    };
    expect(json.id).toBe(inst.id);
    expect(json.provider).toBe("github");
    expect(json.hasToken).toBe(true); // github always true
    expect(json.resources).toHaveLength(1);
    expect(json.resources[0]!.providerResourceId).toBe("my-org/active-repo");
  });

  it("returns hasToken=false for non-github provider with no tokens", async () => {
    const inst = fixtures.installation({ provider: "vercel", orgId: "org-1" });
    await db.insert(gwInstallations).values(inst);

    const res = await request(`/connections/${inst.id}`, { headers: API });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { hasToken: boolean };
    expect(json.hasToken).toBe(false);
  });

  it("returns hasToken=true for non-github provider with a token", async () => {
    const inst = fixtures.installation({ provider: "vercel", orgId: "org-1" });
    await db.insert(gwInstallations).values(inst);

    const token = fixtures.token({ installationId: inst.id });
    await db.insert(gwTokens).values(token);

    const res = await request(`/connections/${inst.id}`, { headers: API });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { hasToken: boolean };
    expect(json.hasToken).toBe(true);
  });
});

// ── GET /connections/:id/token ──

describe("GET /connections/:id/token (integration)", () => {
  it("returns 404 when installation does not exist", async () => {
    const res = await request("/connections/missing-id/token", {
      headers: API,
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when installation is not active", async () => {
    const inst = fixtures.installation({ status: "revoked" });
    await db.insert(gwInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/token`, {
      headers: API,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "installation_not_active",
    });
  });

  it("calls oauth.getActiveToken for an active github installation", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/token`, {
      headers: API,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ accessToken: "tok-123" });
    expect(mockGetInstallationToken).toHaveBeenCalledOnce();
  });
});

// ── DELETE /connections/:provider/:id ──

describe("DELETE /connections/:provider/:id (integration)", () => {
  it("returns 404 when installation does not exist", async () => {
    const res = await request("/connections/github/missing-id", {
      method: "DELETE",
      headers: API,
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when provider does not match", async () => {
    const inst = fixtures.installation({ provider: "github" });
    await db.insert(gwInstallations).values(inst);

    // Request with wrong provider
    const res = await request(`/connections/vercel/${inst.id}`, {
      method: "DELETE",
      headers: API,
    });
    expect(res.status).toBe(404);
  });

  it("triggers teardown when provider matches", async () => {
    const inst = fixtures.installation({ provider: "github", orgId: "org-1" });
    await db.insert(gwInstallations).values(inst);

    const res = await request(`/connections/github/${inst.id}`, {
      method: "DELETE",
      headers: API,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "teardown_initiated" });
    expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
  });
});

// ── POST /connections/:id/resources ──

describe("POST /connections/:id/resources (integration)", () => {
  it("returns 404 when installation does not exist", async () => {
    const res = await request("/connections/missing-id/resources", {
      method: "POST",
      body: { providerResourceId: "repo-1" },
      headers: API,
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when installation is not active", async () => {
    const inst = fixtures.installation({ status: "revoked" });
    await db.insert(gwInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/resources`, {
      method: "POST",
      body: { providerResourceId: "repo-1" },
      headers: API,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "installation_not_active",
    });
  });

  it("returns 400 when providerResourceId is missing", async () => {
    const inst = fixtures.installation({ status: "active" });
    await db.insert(gwInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/resources`, {
      method: "POST",
      body: {},
      headers: API,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "missing_provider_resource_id",
    });
  });

  it("links a new resource and returns it", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
      orgId: "org-1",
    });
    await db.insert(gwInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/resources`, {
      method: "POST",
      body: { providerResourceId: "my-org/my-repo", resourceName: "my-repo" },
      headers: API,
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      status: string;
      resource: {
        id: string;
        providerResourceId: string;
        resourceName: string;
      };
    };
    expect(json.status).toBe("linked");
    expect(json.resource.providerResourceId).toBe("my-org/my-repo");
    expect(json.resource.resourceName).toBe("my-repo");

    // Verify Redis cache was populated with correct key
    expect(mockRedisHset).toHaveBeenCalledWith(
      "gw:resource:github:my-org/my-repo",
      { connectionId: inst.id, orgId: "org-1" }
    );
  });

  it("returns 409 when an active resource already exists for the same providerResourceId", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    // Pre-insert an active resource
    const existing = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "my-org/my-repo",
      status: "active",
    });
    await db.insert(gwResources).values(existing);

    const res = await request(`/connections/${inst.id}/resources`, {
      method: "POST",
      body: { providerResourceId: "my-org/my-repo" },
      headers: API,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "resource_already_linked",
    });
  });

  it("allows re-linking a removed resource (status=removed is not a conflict)", async () => {
    const inst = fixtures.installation({
      provider: "github",
      status: "active",
      orgId: "org-1",
    });
    await db.insert(gwInstallations).values(inst);

    // Pre-insert a removed resource for the same providerResourceId
    const removed = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "my-org/my-repo",
      status: "removed",
    });
    await db.insert(gwResources).values(removed);

    // Should succeed — the duplicate check only looks at status="active"
    const res = await request(`/connections/${inst.id}/resources`, {
      method: "POST",
      body: { providerResourceId: "my-org/my-repo", resourceName: "my-repo" },
      headers: API,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "linked" });
  });
});

// ── DELETE /connections/:id/resources/:resourceId ──

describe("DELETE /connections/:id/resources/:resourceId (integration)", () => {
  it("returns 404 when resource does not exist", async () => {
    const inst = fixtures.installation();
    await db.insert(gwInstallations).values(inst);

    const res = await request(`/connections/${inst.id}/resources/nonexistent`, {
      method: "DELETE",
      headers: API,
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when resource belongs to a different installation", async () => {
    const inst1 = fixtures.installation();
    const inst2 = fixtures.installation();
    await db.insert(gwInstallations).values([inst1, inst2]);

    const resource = fixtures.resource({ installationId: inst2.id });
    await db.insert(gwResources).values(resource);

    // Try to delete via inst1 — should 404 because installationId doesn't match
    const res = await request(
      `/connections/${inst1.id}/resources/${resource.id}`,
      {
        method: "DELETE",
        headers: API,
      }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when resource is already removed", async () => {
    const inst = fixtures.installation();
    await db.insert(gwInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id,
      status: "removed",
    });
    await db.insert(gwResources).values(resource);

    const res = await request(
      `/connections/${inst.id}/resources/${resource.id}`,
      {
        method: "DELETE",
        headers: API,
      }
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "already_removed" });
  });

  it("soft-deletes resource and cleans up Redis cache", async () => {
    const inst = fixtures.installation({ provider: "github" });
    await db.insert(gwInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "my-org/my-repo",
      status: "active",
    });
    await db.insert(gwResources).values(resource);

    const res = await request(
      `/connections/${inst.id}/resources/${resource.id}`,
      {
        method: "DELETE",
        headers: API,
      }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "removed",
      resourceId: resource.id,
    });

    // Verify the resource was actually updated in the DB
    const rows = await db
      .select()
      .from(gwResources)
      .where(eq(gwResources.id, resource.id));
    expect(rows[0]!.status).toBe("removed");

    // Verify Redis cache cleanup with correct key
    expect(mockRedisDel).toHaveBeenCalledWith(
      "gw:resource:github:my-org/my-repo"
    );
  });
});

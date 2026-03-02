/**
 * Suite 7: Connections CLI OAuth Flow Routes
 *
 * Tests the connections service CLI OAuth route behaviors:
 *   - GET /connections/:provider/authorize (apiKeyAuth, tenantMiddleware, validation)
 *   - GET /connections/oauth/status (polling endpoint, no auth required)
 *   - GET /connections/:provider/callback with redirect_to=inline
 *   - Full CLI poll round-trip: authorize → callback → poll
 *
 * Uses connectionsApp.request() directly — no tRPC, no service mesh router.
 * Infrastructure: PGlite (real DB), in-memory Redis Map.
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

// ── Shared state (assigned in beforeAll, lazy getter in vi.mock) ──
let db: TestDb;

// ── Create all mock state in vi.hoisted (runs before vi.mock factories) ──
const { redisMock, redisStore, mockGetProvider, mockProvider } =
  await vi.hoisted(async () => {
    const { makeRedisMock } = await import("./harness.js");
    const redisStore = new Map<string, unknown>();
    const mockProvider = {
      name: "github" as const,
      getAuthorizationUrl: vi
        .fn()
        .mockReturnValue(
          "https://github.com/login/oauth/authorize?mock=1",
        ),
      handleCallback: vi.fn().mockResolvedValue({
        installationId: "inst-1",
        provider: "github",
        status: "connected",
      }),
      resolveToken: vi.fn(),
    };
    return {
      redisMock: makeRedisMock(redisStore),
      redisStore,
      mockGetProvider: vi.fn().mockReturnValue(mockProvider),
      mockProvider,
    };
  });

// ── vi.mock declarations ──

vi.mock("@db/console/client", () => ({
  get db() {
    return db;
  },
}));

vi.mock("@vendor/upstash", () => ({ redis: redisMock }));

vi.mock("@connections/providers", () => ({
  getProvider: (...args: unknown[]): unknown => mockGetProvider(...args),
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  getWorkflowClient: () => ({
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-1" }),
  }),
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: vi.fn().mockResolvedValue({ messageId: "msg-1" }),
  }),
  Receiver: class {
    verify() {
      return Promise.resolve(true);
    }
  },
}));

vi.mock("@vendor/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { defaultHost: string }) => defaultHost,
}));

// ── Import app after mocks are registered ──
import connectionsApp from "@connections/app";
import { oauthStateKey, oauthResultKey } from "@connections/cache";

// ── Request helpers ──

const API_KEY = "0".repeat(64); // matches setup.ts GATEWAY_API_KEY
const ORG_ID = "org_test123";

function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "X-API-Key": API_KEY,
    "X-Org-Id": ORG_ID,
    "X-User-Id": "user_1",
    ...extra,
  };
}

function req(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return connectionsApp.request(`/services/connections${path}`, {
    method: init.method ?? "GET",
    headers: init.headers ? new Headers(init.headers) : undefined,
  });
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();

  // Re-wire Redis mock implementations (clearAllMocks resets them)
  redisMock.hset.mockImplementation(
    (key: string, fields: Record<string, unknown>) => {
      const existing =
        (redisStore.get(key) ?? {}) as Record<string, unknown>;
      redisStore.set(key, { ...existing, ...fields });
      return Promise.resolve(1);
    },
  );
  redisMock.hgetall.mockImplementation(<T>(key: string) =>
    Promise.resolve((redisStore.get(key) ?? null) as T),
  );
  redisMock.set.mockImplementation(
    (key: string, value: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && redisStore.has(key)) return Promise.resolve(null);
      redisStore.set(key, value);
      return Promise.resolve("OK");
    },
  );
  redisMock.del.mockImplementation((...keys: string[]) => {
    const allKeys = keys.flat();
    let count = 0;
    for (const k of allKeys) {
      if (redisStore.delete(k)) count++;
    }
    return Promise.resolve(count);
  });
  redisMock.get.mockImplementation(<T>(key: string) =>
    Promise.resolve((redisStore.get(key) ?? null) as T),
  );
  redisMock.pipeline.mockImplementation(() => {
    const ops: (() => void)[] = [];
    const pipe = {
      hset: vi.fn((key: string, fields: Record<string, unknown>) => {
        ops.push(() => {
          const existing =
            (redisStore.get(key) ?? {}) as Record<string, unknown>;
          redisStore.set(key, { ...existing, ...fields });
        });
        return pipe;
      }),
      expire: vi.fn(() => pipe),
      exec: vi.fn(() => {
        ops.forEach((op) => op());
        return [];
      }),
    };
    return pipe;
  });
  redisMock.multi.mockImplementation(() => {
    const ops: (() => unknown)[] = [];
    const chain = {
      hgetall: vi.fn((key: string) => {
        ops.push(() => redisStore.get(key) ?? null);
        return chain;
      }),
      del: vi.fn((...keys: string[]) => {
        ops.push(() => {
          const allKeys = keys.flat();
          let count = 0;
          for (const k of allKeys) {
            if (redisStore.delete(k)) count++;
          }
          return count;
        });
        return chain;
      }),
      hset: vi.fn((key: string, fields: Record<string, unknown>) => {
        ops.push(() => {
          const existing =
            (redisStore.get(key) ?? {}) as Record<string, unknown>;
          redisStore.set(key, { ...existing, ...fields });
          return 1;
        });
        return chain;
      }),
      expire: vi.fn(() => {
        ops.push(() => 1);
        return chain;
      }),
      exec: vi.fn(() => Promise.resolve(ops.map((op) => op()))),
    };
    return chain;
  });

  // Re-wire provider mock
  mockGetProvider.mockReturnValue(mockProvider);
  mockProvider.getAuthorizationUrl.mockReturnValue(
    "https://github.com/login/oauth/authorize?mock=1",
  );
  mockProvider.handleCallback.mockResolvedValue({
    installationId: "inst-1",
    provider: "github",
    status: "connected",
  });
});

afterEach(async () => {
  await resetTestDb();
  redisStore.clear();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Tests ──

describe("Suite 7 — CLI OAuth Flow Routes", () => {
  describe("7.1 — Authorize endpoint auth & validation", () => {
    it("GET /:provider/authorize without X-API-Key → 401", async () => {
      const res = await req("/github/authorize");
      expect(res.status).toBe(401);
    });

    it("GET /:provider/authorize with wrong X-API-Key → 401", async () => {
      const res = await req("/github/authorize", {
        headers: { "X-API-Key": "wrong-key-that-is-wrong" },
      });
      expect(res.status).toBe(401);
    });

    it("GET /:provider/authorize with valid key but missing X-Org-Id → 400", async () => {
      const res = await req("/github/authorize", {
        headers: { "X-API-Key": API_KEY },
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("missing_org_id");
    });

    it("GET /:provider/authorize with ?redirect_to=https://evil.com → 400", async () => {
      const res = await req(
        "/github/authorize?redirect_to=https%3A%2F%2Fevil.com",
        { headers: authHeaders() },
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("invalid_redirect_to");
    });

    it("GET /:provider/authorize with ?redirect_to=http://localhost:9000 → 200", async () => {
      const res = await req(
        "/github/authorize?redirect_to=http%3A%2F%2Flocalhost%3A9000",
        { headers: authHeaders() },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { url: string; state: string };
      expect(json.url).toContain("github.com");
      expect(json.state).toBeDefined();
    });

    it("GET /:provider/authorize with ?redirect_to=inline → 200 { url, state } and writes Redis state", async () => {
      const res = await req("/github/authorize?redirect_to=inline", {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { url: string; state: string };
      expect(json.url).toBe(
        "https://github.com/login/oauth/authorize?mock=1",
      );
      expect(typeof json.state).toBe("string");
      expect(json.state.length).toBeGreaterThan(0);

      // Assert Redis oauthStateKey written with { redirectTo: "inline", provider, orgId }
      const stateData = redisStore.get(
        oauthStateKey(json.state),
      ) as Record<string, string>;
      expect(stateData).toBeDefined();
      expect(stateData.redirectTo).toBe("inline");
      expect(stateData.provider).toBe("github");
      expect(stateData.orgId).toBe(ORG_ID);
    });
  });

  describe("7.2 — GET /oauth/status polling endpoint", () => {
    it("Missing ?state → 400 { error: 'missing_state' }", async () => {
      const res = await req("/oauth/status");
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("missing_state");
    });

    it("Valid state, no Redis result → { status: 'pending' }", async () => {
      const res = await req("/oauth/status?state=nonexistent-state-xyz");
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string };
      expect(json.status).toBe("pending");
    });

    it("Valid state, completed result in Redis → { status: 'completed', provider: 'github' }", async () => {
      const state = "completed-state-abc";
      redisStore.set(oauthResultKey(state), {
        status: "completed",
        provider: "github",
      });

      const res = await req(`/oauth/status?state=${state}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        status: string;
        provider: string;
      };
      expect(json.status).toBe("completed");
      expect(json.provider).toBe("github");
    });

    it("Valid state, failed result in Redis → { status: 'failed', error: 'exchange_failed' }", async () => {
      const state = "failed-state-xyz";
      redisStore.set(oauthResultKey(state), {
        status: "failed",
        error: "exchange_failed",
      });

      const res = await req(`/oauth/status?state=${state}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string; error: string };
      expect(json.status).toBe("failed");
      expect(json.error).toBe("exchange_failed");
    });
  });

  describe("7.3 — redirect_to=inline callback flow", () => {
    it("Success: inline HTML contains 'window.close()' and provider name", async () => {
      const state = "inline-success-state-123";
      // Seed OAuth state in Redis (as authorize route would)
      redisStore.set(oauthStateKey(state), {
        provider: "github",
        orgId: ORG_ID,
        connectedBy: "user_1",
        redirectTo: "inline",
        createdAt: Date.now().toString(),
      });

      const res = await req(`/github/callback?code=abc&state=${state}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("window.close()");
      expect(html).toContain("github");

      // Assert oauthResultKey written with { status: "completed" }
      const result = redisStore.get(oauthResultKey(state)) as Record<
        string,
        string
      >;
      expect(result).toBeDefined();
      expect(result.status).toBe("completed");
      expect(result.provider).toBe("github");
    });

    it("Error: inline HTML contains error message, oauthResultKey has { status: 'failed' }", async () => {
      const state = "inline-error-state-456";
      mockProvider.handleCallback.mockRejectedValueOnce(
        new Error("exchange_failed"),
      );
      // Seed OAuth state in Redis
      redisStore.set(oauthStateKey(state), {
        provider: "github",
        orgId: ORG_ID,
        connectedBy: "user_1",
        redirectTo: "inline",
        createdAt: Date.now().toString(),
      });

      const res = await req(`/github/callback?code=bad&state=${state}`);
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain("exchange_failed");
      // Error page does NOT auto-close
      expect(html).not.toContain("window.close()");

      // Assert oauthResultKey written with { status: "failed" }
      const result = redisStore.get(oauthResultKey(state)) as Record<
        string,
        string
      >;
      expect(result).toBeDefined();
      expect(result.status).toBe("failed");
      expect(result.error).toBe("exchange_failed");
    });
  });

  describe("7.4 — CLI poll round-trip", () => {
    it("authorize → seed result → poll completed", async () => {
      // 1. GET authorize (returns { url, state })
      const authRes = await req("/github/authorize?redirect_to=inline", {
        headers: authHeaders(),
      });
      expect(authRes.status).toBe(200);
      const { state } = (await authRes.json()) as {
        url: string;
        state: string;
      };
      expect(typeof state).toBe("string");

      // 2. Manually write { status: "completed" } to oauthResultKey(state)
      redisStore.set(oauthResultKey(state), {
        status: "completed",
        provider: "github",
      });

      // 3. GET /oauth/status?state=<state> → { status: "completed" }
      const pollRes = await req(`/oauth/status?state=${state}`);
      expect(pollRes.status).toBe(200);
      const pollJson = (await pollRes.json()) as {
        status: string;
        provider: string;
      };
      expect(pollJson.status).toBe("completed");
      expect(pollJson.provider).toBe("github");
    });

    it("authorize → callback → poll (full chain)", async () => {
      // 1. GET authorize with redirect_to=inline (returns { url, state })
      const authRes = await req("/github/authorize?redirect_to=inline", {
        headers: authHeaders(),
      });
      expect(authRes.status).toBe(200);
      const { state } = (await authRes.json()) as {
        url: string;
        state: string;
      };

      // 2. GET callback?code=abc&state=<state> (mockProvider.handleCallback succeeds)
      const callbackRes = await req(
        `/github/callback?code=abc&state=${state}`,
      );
      expect(callbackRes.status).toBe(200); // inline HTML, not JSON

      // 3. GET /oauth/status?state=<state> → { status: "completed" }
      const pollRes = await req(`/oauth/status?state=${state}`);
      expect(pollRes.status).toBe(200);
      const pollJson = (await pollRes.json()) as {
        status: string;
        provider: string;
      };
      expect(pollJson.status).toBe("completed");
      expect(pollJson.provider).toBe("github");
    });
  });
});

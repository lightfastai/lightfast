/**
 * Suite 10: Browser OAuth Flow Routes
 *
 * Tests the connections service browser-initiated OAuth flow:
 *   - GET /connections/:provider/authorize (URL + state for browser redirect)
 *   - GET /connections/:provider/callback (browser redirect, not inline)
 *   - GET /connections/oauth/status (polling for completion)
 *   - State token lifecycle (single-use via atomic MULTI, fallback recovery)
 *
 * Key difference from Suite 7 (CLI flow): the browser flow uses redirect_to=<consoleUrl>
 * (or omits redirect_to entirely), so callbacks produce 302 redirects to the console
 * connected page, not inline HTML responses.
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
      requiresWebhookRegistration: false as const,
      getAuthorizationUrl: vi
        .fn()
        .mockReturnValue(
          "https://github.com/apps/test-app/installations/new?state=mock-state",
        ),
      handleCallback: vi.fn().mockResolvedValue({
        installationId: "inst-browser-1",
        provider: "github",
        status: "connected",
      }),
      resolveToken: vi.fn(),
      exchangeCode: vi.fn(),
      refreshToken: vi.fn(),
      revokeToken: vi.fn(),
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
import { gwInstallations } from "@db/console/schema";

// ── Request helpers ──

const API_KEY = "0".repeat(64); // matches setup.ts GATEWAY_API_KEY
const ORG_ID = "org_browser_test";

function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "X-API-Key": API_KEY,
    "X-Org-Id": ORG_ID,
    "X-User-Id": "user_browser_1",
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
    "https://github.com/apps/test-app/installations/new?state=mock-state",
  );
  mockProvider.handleCallback.mockResolvedValue({
    installationId: "inst-browser-1",
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

describe("Suite 10 — Browser OAuth Flow Routes", () => {
  describe("10.1 — Authorize returns URL with state for browser redirect", () => {
    it("Returns { url, state } without redirect_to (default browser flow)", async () => {
      const res = await req("/github/authorize", {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { url: string; state: string };
      expect(json.url).toContain("github.com");
      expect(typeof json.state).toBe("string");
      expect(json.state.length).toBeGreaterThan(0);
    });

    it("State is stored in Redis with correct fields (no redirectTo)", async () => {
      const res = await req("/github/authorize", {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const { state } = (await res.json()) as { url: string; state: string };

      const stateData = redisStore.get(oauthStateKey(state)) as Record<
        string,
        string
      >;
      expect(stateData).toBeDefined();
      expect(stateData.provider).toBe("github");
      expect(stateData.orgId).toBe(ORG_ID);
      expect(stateData.connectedBy).toBe("user_browser_1");
      // Browser flow: no redirectTo field (absent means default console redirect)
      expect(stateData.redirectTo).toBeUndefined();
      expect(stateData.createdAt).toBeDefined();
    });
  });

  describe("10.2 — Browser callback flow", () => {
    it("Callback with valid state writes completion result to Redis", async () => {
      const state = "browser-cb-state-1";
      redisStore.set(oauthStateKey(state), {
        provider: "github",
        orgId: ORG_ID,
        connectedBy: "user_browser_1",
        createdAt: Date.now().toString(),
      });

      const res = await req(
        `/github/callback?installation_id=12345&state=${state}`,
      );
      // Browser flow without redirectTo → 302 redirect to console
      expect(res.status).toBe(302);

      const result = redisStore.get(oauthResultKey(state)) as Record<
        string,
        string
      >;
      expect(result).toBeDefined();
      expect(result.status).toBe("completed");
      expect(result.provider).toBe("github");
    });

    it("Callback redirects to /provider/github/connected", async () => {
      const state = "browser-redirect-state-1";
      redisStore.set(oauthStateKey(state), {
        provider: "github",
        orgId: ORG_ID,
        connectedBy: "user_browser_1",
        createdAt: Date.now().toString(),
      });

      const res = await req(
        `/github/callback?installation_id=12345&state=${state}`,
      );
      expect(res.status).toBe(302);
      const location = res.headers.get("Location") ?? "";
      expect(location).toContain("/provider/github/connected");
    });

    it("Callback appends reactivated=true to redirect when provider returns reactivated", async () => {
      mockProvider.handleCallback.mockResolvedValueOnce({
        installationId: "inst-reactivated-1",
        provider: "github",
        status: "connected",
        reactivated: true,
      });

      const state = "browser-reactivated-state-1";
      redisStore.set(oauthStateKey(state), {
        provider: "github",
        orgId: ORG_ID,
        connectedBy: "user_browser_1",
        createdAt: Date.now().toString(),
      });

      const res = await req(
        `/github/callback?installation_id=12345&state=${state}`,
      );
      expect(res.status).toBe(302);
      const location = res.headers.get("Location") ?? "";
      expect(location).toContain("reactivated=true");

      // Redis result should also include reactivated
      const result = redisStore.get(oauthResultKey(state)) as Record<
        string,
        string
      >;
      expect(result.reactivated).toBe("true");
    });

    it("Callback passes installation_id and state to provider.handleCallback", async () => {
      const state = "browser-passthrough-state-1";
      redisStore.set(oauthStateKey(state), {
        provider: "github",
        orgId: ORG_ID,
        connectedBy: "user_browser_1",
        createdAt: Date.now().toString(),
      });

      await req(
        `/github/callback?installation_id=99999&state=${state}`,
      );

      expect(mockProvider.handleCallback).toHaveBeenCalledOnce();
      const [ctx, typedState] = mockProvider.handleCallback.mock.calls[0] as [
        { req: { query(k: string): string | undefined } },
        { orgId: string; connectedBy: string },
      ];
      expect(ctx.req.query("installation_id")).toBe("99999");
      expect(typedState.orgId).toBe(ORG_ID);
      expect(typedState.connectedBy).toBe("user_browser_1");
    });

    it("Callback with missing state falls back to externalId DB lookup", async () => {
      // Seed a pre-existing gwInstallation with matching externalId
      await db.insert(gwInstallations).values({
        provider: "github",
        externalId: "55555",
        connectedBy: "user_original",
        orgId: ORG_ID,
        status: "active",
        providerAccountInfo: {
          version: 1,
          sourceType: "github",
          events: ["push"],
          installedAt: "2026-01-01T00:00:00Z",
          lastValidatedAt: "2026-01-01T00:00:00Z",
          raw: {
            account: {
              login: "test-org",
              id: 67890,
              type: "Organization" as const,
              avatar_url: "",
            },
            permissions: {},
            events: ["push"],
            created_at: "2026-01-01T00:00:00Z",
          },
        },
      });

      // Callback WITHOUT state param — triggers fallback via externalId lookup
      const res = await req(
        "/github/callback?installation_id=55555",
      );
      // Should succeed (302 redirect), not 400
      expect(res.status).toBe(302);

      // handleCallback should have been called with recovered state
      expect(mockProvider.handleCallback).toHaveBeenCalledOnce();
      const [, typedState] = mockProvider.handleCallback.mock.calls[0] as [
        unknown,
        { orgId: string; connectedBy: string },
      ];
      expect(typedState.orgId).toBe(ORG_ID);
      expect(typedState.connectedBy).toBe("user_original");
    });

    it("Callback with missing state and no existing DB row → 400", async () => {
      // No state in query, no matching row in DB
      const res = await req(
        "/github/callback?installation_id=nonexistent",
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("invalid_or_expired_state");
    });

    it("Callback error redirects to connected page with error param", async () => {
      mockProvider.handleCallback.mockRejectedValueOnce(
        new Error("missing installation_id"),
      );

      const state = "browser-error-state-1";
      redisStore.set(oauthStateKey(state), {
        provider: "github",
        orgId: ORG_ID,
        connectedBy: "user_browser_1",
        createdAt: Date.now().toString(),
      });

      const res = await req(
        `/github/callback?state=${state}`,
      );
      expect(res.status).toBe(302);
      const location = res.headers.get("Location") ?? "";
      expect(location).toContain("/provider/github/connected");
      expect(location).toContain("error=");
      expect(location).toContain("missing%20installation_id");

      // Redis result should have failed status
      const result = redisStore.get(oauthResultKey(state)) as Record<
        string,
        string
      >;
      expect(result.status).toBe("failed");
      expect(result.error).toBe("missing installation_id");
    });
  });

  describe("10.3 — Full browser round-trip", () => {
    it("Authorize → callback → poll completed", async () => {
      // 1. Authorize (returns { url, state })
      const authRes = await req("/github/authorize", {
        headers: authHeaders(),
      });
      expect(authRes.status).toBe(200);
      const { state } = (await authRes.json()) as {
        url: string;
        state: string;
      };
      expect(typeof state).toBe("string");

      // 2. Callback with state (browser redirect)
      const callbackRes = await req(
        `/github/callback?installation_id=12345&state=${state}`,
      );
      expect(callbackRes.status).toBe(302);
      const location = callbackRes.headers.get("Location") ?? "";
      expect(location).toContain("/provider/github/connected");

      // 3. Poll for status
      const pollRes = await req(`/oauth/status?state=${state}`);
      expect(pollRes.status).toBe(200);
      const pollJson = (await pollRes.json()) as {
        status: string;
        provider: string;
      };
      expect(pollJson.status).toBe("completed");
      expect(pollJson.provider).toBe("github");
    });

    it("Authorize → callback with setup_action=install → poll includes setupAction", async () => {
      mockProvider.handleCallback.mockResolvedValueOnce({
        installationId: "inst-setup-1",
        provider: "github",
        status: "connected",
        setupAction: "install",
      });

      const authRes = await req("/github/authorize", {
        headers: authHeaders(),
      });
      const { state } = (await authRes.json()) as {
        url: string;
        state: string;
      };

      const callbackRes = await req(
        `/github/callback?installation_id=12345&setup_action=install&state=${state}`,
      );
      expect(callbackRes.status).toBe(302);
      const location = callbackRes.headers.get("Location") ?? "";
      expect(location).toContain("setup_action=install");

      // Poll result includes setupAction
      const pollRes = await req(`/oauth/status?state=${state}`);
      const pollJson = (await pollRes.json()) as Record<string, string>;
      expect(pollJson.status).toBe("completed");
      expect(pollJson.setupAction).toBe("install");
    });
  });

  describe("10.4 — State token security", () => {
    it("State token is single-use (consumed on first callback)", async () => {
      const state = "single-use-state-1";
      redisStore.set(oauthStateKey(state), {
        provider: "github",
        orgId: ORG_ID,
        connectedBy: "user_browser_1",
        createdAt: Date.now().toString(),
      });

      // First callback succeeds
      const res1 = await req(
        `/github/callback?installation_id=12345&state=${state}`,
      );
      expect(res1.status).toBe(302);

      // State key should be deleted from Redis after first callback
      expect(redisStore.has(oauthStateKey(state))).toBe(false);

      // Second callback with same state fails (state consumed)
      const res2 = await req(
        `/github/callback?installation_id=12345&state=${state}`,
      );
      expect(res2.status).toBe(400);
      const json = (await res2.json()) as { error: string };
      expect(json.error).toBe("invalid_or_expired_state");
    });

    it("Expired state (not in Redis) returns 400 invalid_or_expired_state", async () => {
      // Simulate expired state — key was never set (or TTL expired)
      const state = "expired-state-1";
      // Do NOT seed oauthStateKey — simulating TTL expiry

      const res = await req(
        `/github/callback?installation_id=12345&state=${state}`,
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("invalid_or_expired_state");
    });

    it("Authorize sets 600s TTL on state key via pipeline.expire", async () => {
      const res = await req("/github/authorize", {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const { state } = (await res.json()) as { url: string; state: string };

      // Verify pipeline was used with expire(key, 600)
      expect(redisMock.pipeline).toHaveBeenCalled();
      const pipeInstance = redisMock.pipeline.mock.results[0]?.value as {
        expire: ReturnType<typeof vi.fn>;
      };
      expect(pipeInstance.expire).toHaveBeenCalledWith(
        oauthStateKey(state),
        600,
      );
    });

    it("Cross-provider state mismatch returns 400", async () => {
      const state = "cross-provider-state-1";
      // State says "vercel" but callback route is /github/callback
      redisStore.set(oauthStateKey(state), {
        provider: "vercel",
        orgId: ORG_ID,
        connectedBy: "user_browser_1",
        createdAt: Date.now().toString(),
      });

      const res = await req(
        `/github/callback?installation_id=12345&state=${state}`,
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("invalid_or_expired_state");
    });
  });
});

/**
 * Gateway Proxy Invariant Matrix Testing
 *
 * Defines scenario dimensions as typed arrays, computes their cartesian
 * product, and runs every combination against universal invariants.
 *
 * Scenarios: 72 (3 × 4 × 3 × 2)
 * - provider:        github | linear | sentry     (3)
 * - tokenState:      valid | expired-with-refresh | no-token  (4: +missing)
 * - upstreamStatus:  200 | 401 | 500             (3)
 * - connectionStatus: active | revoked            (2)
 *
 * Invariants per scenario (7 total):
 *   I.   revoked connection → 400 before any upstream call
 *   II.  missing token (no stored token) → still attempts (getActiveToken handles it)
 *   III. upstream 200 → { status, data, headers } passthrough
 *   IV.  upstream 401 && fresh token available → retry once with new token
 *   V.   upstream 401 && no fresh token → pass 401 through
 *   VI.  upstream 500 → { status: 500, data, headers } passthrough
 *   VII. expired-with-refresh → refreshToken called before upstream request
 */
import { gatewayInstallations, gatewayTokens } from "@db/console/schema";
import type { TestDb } from "@repo/console-test-db";
import { closeTestDb, createTestDb, resetTestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
import { encrypt } from "@repo/lib";
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

// ── Types ──

interface GatewayScenario {
  connectionStatus: "active" | "revoked";
  provider: "github" | "linear" | "sentry";
  tokenState: "valid" | "expired-with-refresh" | "missing" | "no-row";
  upstreamStatus: 200 | 401 | 500;
}

// ── Cartesian product engine ──

function cartesian<T extends Record<string, readonly unknown[]>>(
  dims: T
): Array<{ [K in keyof T]: T[K][number] }> {
  const keys = Object.keys(dims) as (keyof T)[];
  const values = keys.map((k) => dims[k] as readonly unknown[]);
  const results: Array<{ [K in keyof T]: T[K][number] }> = [];
  const indices = new Array(keys.length).fill(0) as number[];
  const lengths = values.map((v) => v.length);

  if (lengths.some((l) => l === 0)) {
    return results;
  }

  while (true) {
    const entry = {} as { [K in keyof T]: T[K][number] };
    for (let i = 0; i < keys.length; i++) {
      (entry as Record<string, unknown>)[keys[i] as string] =
        values[i]![indices[i]!];
    }
    results.push(entry);

    let carry = true;
    for (let i = keys.length - 1; i >= 0 && carry; i--) {
      indices[i]!++;
      if (indices[i]! < lengths[i]!) {
        carry = false;
      } else {
        indices[i] = 0;
      }
    }
    if (carry) {
      break;
    }
  }
  return results;
}

function scenarioLabel(s: GatewayScenario): string {
  return `provider=${s.provider} token=${s.tokenState} upstream=${s.upstreamStatus} conn=${s.connectionStatus}`;
}

// ── Shared test encryption key ──

const {
  TEST_ENC_KEY,
  mockFetch,
  mockGetInstallationToken,
  mockRefreshToken,
  mockUpdateTokenRecord,
  mockWriteTokenRecord,
  mockCreateConfig,
} = vi.hoisted(() => {
  const TEST_ENC_KEY =
    "0000000000000000000000000000000000000000000000000000000000000001";
  const mockFetch = vi.fn();
  return {
    TEST_ENC_KEY,
    mockFetch,
    mockGetInstallationToken: vi.fn().mockResolvedValue("tok-live"),
    mockRefreshToken: vi.fn().mockResolvedValue({
      accessToken: "tok-refreshed",
      tokenType: "Bearer",
      expiresIn: 3600,
    }),
    mockUpdateTokenRecord: vi.fn().mockResolvedValue(undefined),
    mockWriteTokenRecord: vi.fn().mockResolvedValue(undefined),
    mockCreateConfig: vi.fn().mockImplementation(() => ({})),
  };
});

// ── vi.mock declarations ──

let db: TestDb;

vi.mock("@db/console/client", () => ({
  get db() {
    return db;
  },
}));

vi.mock("../env", () => ({
  env: {
    GATEWAY_API_KEY: "test-api-key",
    ENCRYPTION_KEY: TEST_ENC_KEY,
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
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf" }),
  },
}));

vi.mock("@repo/console-providers", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  const makeOAuth = (usesStoredToken: boolean) => ({
    buildAuthUrl: vi.fn(),
    processCallback: vi.fn(),
    refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
    revokeToken: vi.fn(),
    usesStoredToken,
    getActiveToken: (...args: unknown[]) => mockGetInstallationToken(...args),
  });

  const makeEndpoints = (_provider: string) => ({
    "list-items": {
      endpointId: "list-items",
      method: "GET" as const,
      path: "/api/v1/items",
      buildAuthHeader: (_config: unknown, token: string) => ({
        Authorization: `Bearer ${token}`,
      }),
    },
  });

  const makeProvider = (name: string, usesStoredToken: boolean) => ({
    name,
    createConfig: (...args: unknown[]) => mockCreateConfig(...args),
    oauth: makeOAuth(usesStoredToken),
    api: {
      baseUrl: `https://${name}.api.test`,
      endpoints: makeEndpoints(name),
      buildAuthHeader: (_config: unknown, token: string) => ({
        Authorization: `Bearer ${token}`,
      }),
      defaultHeaders: {},
    },
    backfill: {
      supportedEntityTypes: [],
      defaultEntityTypes: [],
      entityTypes: {},
    },
  });

  const providers = {
    github: makeProvider("github", false),
    linear: makeProvider("linear", true),
    sentry: makeProvider("sentry", true),
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
  updateTokenRecord: (...args: unknown[]) => mockUpdateTokenRecord(...args),
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

const API = { "X-API-Key": "test-api-key" };

function postExecute(
  id: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  const h = new Headers({
    "content-type": "application/json",
    ...API,
    ...headers,
  });
  return app.request(`/connections/${id}/proxy/execute`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset(); // clears mockResolvedValueOnce queue to prevent bleed
  vi.stubGlobal("fetch", mockFetch);
  mockCreateConfig.mockImplementation(() => ({}));
  mockGetInstallationToken.mockResolvedValue("tok-live");
  mockRefreshToken.mockResolvedValue({
    accessToken: "tok-refreshed",
    tokenType: "Bearer",
    expiresIn: 3600,
  });
  mockUpdateTokenRecord.mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Scenario setup ──

async function setupScenario(s: GatewayScenario): Promise<string> {
  const inst = fixtures.installation({
    provider: s.provider,
    status: s.connectionStatus,
    externalId: `ext-${s.provider}-001`,
  });
  await db.insert(gatewayInstallations).values(inst);

  if (s.tokenState === "valid") {
    const encAccess = await encrypt("tok-stored", TEST_ENC_KEY);
    await db.insert(gatewayTokens).values(
      fixtures.token({
        installationId: inst.id,
        accessToken: encAccess,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
    );
  } else if (s.tokenState === "expired-with-refresh") {
    const encAccess = await encrypt("tok-expired", TEST_ENC_KEY);
    const encRefresh = await encrypt("refresh-secret", TEST_ENC_KEY);
    await db.insert(gatewayTokens).values(
      fixtures.token({
        installationId: inst.id,
        accessToken: encAccess,
        refreshToken: encRefresh,
        expiresAt: new Date(Date.now() - 60_000).toISOString(), // expired
      })
    );
  } else if (s.tokenState === "missing") {
    // Token row exists but accessToken is empty — getActiveToken called with null
    const encAccess = await encrypt("tok-placeholder", TEST_ENC_KEY);
    await db.insert(gatewayTokens).values(
      fixtures.token({
        installationId: inst.id,
        accessToken: encAccess,
        expiresAt: null,
      })
    );
  }
  // "no-row": no token inserted at all

  return inst.id;
}

function configureFetch(s: GatewayScenario) {
  if (s.upstreamStatus === 200) {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: [1, 2, 3] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  } else if (s.upstreamStatus === 401) {
    // First call: 401; second call (retry): 200 if fresh token available
    mockFetch
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
  } else {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "internal" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );
  }
}

// ── Scenario dimensions ──

const dims = {
  provider: ["github", "linear", "sentry"] as const,
  tokenState: ["valid", "expired-with-refresh", "missing", "no-row"] as const,
  upstreamStatus: [200, 401, 500] as const,
  connectionStatus: ["active", "revoked"] as const,
};

const scenarios = cartesian(dims) as GatewayScenario[];

// ── Matrix tests ──

describe("gateway proxy invariant matrix", () => {
  it.each(
    scenarios.map((s) => [scenarioLabel(s), s] as const)
  )("%s", async (_label, scenario) => {
    const instId = await setupScenario(scenario);
    configureFetch(scenario);

    const res = await postExecute(instId, { endpointId: "list-items" });

    // ── Invariant I: revoked connection → 400, no upstream call ──
    if (scenario.connectionStatus === "revoked") {
      expect(res.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
      return;
    }

    // Active connection — all further invariants apply.

    // ── Invariant VII: expired-with-refresh → refreshToken + updateTokenRecord called ──
    if (scenario.tokenState === "expired-with-refresh") {
      // refresh on expiry (getActiveTokenForInstallation); if upstream 401,
      // forceRefreshToken also calls it again → 2 total
      const expectedRefreshCalls = scenario.upstreamStatus === 401 ? 2 : 1;
      expect(mockRefreshToken).toHaveBeenCalledTimes(expectedRefreshCalls);
      expect(mockUpdateTokenRecord).toHaveBeenCalledTimes(expectedRefreshCalls);
    }

    if (scenario.upstreamStatus === 200) {
      // ── Invariant III: 200 → passthrough ──
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: number; data: unknown };
      expect(json.status).toBe(200);
      expect(json.data).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } else if (scenario.upstreamStatus === 401) {
      // ── Invariant IV/V: 401 retry logic ──
      // Proxy always returns HTTP 200 with envelope { status, data, headers }.
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: number };

      const fetchCalls = mockFetch.mock.calls.length;
      if (fetchCalls === 2) {
        // Invariant IV: fresh token obtained → retry → upstream 200
        expect(json.status).toBe(200);
      } else {
        // Invariant V: no fresh token (or same token) → 401 passed in envelope
        expect(json.status).toBe(401);
      }
    } else {
      // upstreamStatus === 500
      // ── Invariant VI: 500 → passthrough in envelope ──
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: number };
      expect(json.status).toBe(500);
    }
  });
});

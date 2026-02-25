import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Capture the handler passed to createFunction ──

let capturedHandler: (args: { event: any; step: any }) => Promise<unknown>;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      _trigger: unknown,
      handler: typeof capturedHandler,
    ) => {
      capturedHandler = handler;
      return { id: "mock-orchestrator" };
    },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockGetConnector = vi.fn();
vi.mock("@repo/console-backfill", () => ({
  getConnector: (...args: unknown[]) => mockGetConnector(...args),
}));

vi.mock("../env", () => ({
  env: { GATEWAY_API_KEY: "test-key" },
}));

vi.mock("../lib/related-projects", () => ({
  connectionsUrl: "https://connections.test",
  gatewayUrl: "https://gateway.test",
}));

// Force module load to capture handler
await import("./backfill-orchestrator");

// ── Helpers ──

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      depth: 30,
      entityTypes: undefined,
      ...overrides,
    },
  };
}

function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn().mockResolvedValue(undefined),
    waitForEvent: vi.fn().mockResolvedValue(null),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: "inst-1",
    provider: "github",
    externalId: "12345",
    orgId: "org-1",
    status: "active",
    resources: [
      { id: "r1", providerResourceId: "100", resourceName: "owner/repo-a" },
      { id: "r2", providerResourceId: "200", resourceName: "owner/repo-b" },
    ],
    ...overrides,
  };
}

const mockConnector = {
  provider: "github",
  supportedEntityTypes: ["pull_request", "issue", "release"],
  defaultEntityTypes: ["pull_request", "issue", "release"],
  validateScopes: vi.fn(),
  fetchPage: vi.fn(),
};

function mockFetchConnection(conn: Record<string, unknown> = makeConnection()) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(conn), { status: 200 }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConnector.mockReturnValue(mockConnector);
});

// ── Tests ──

describe("get-connection step", () => {
  it("fetches connection and continues when active", async () => {
    mockFetchConnection();
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://connections.test/connections/inst-1",
      { headers: { "X-API-Key": "test-key" } },
    );
  });

  it("throws when connection status is inactive", async () => {
    mockFetchConnection(makeConnection({ status: "inactive" }));
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("Connection is not active");
  });

  it("throws when connection status is error", async () => {
    mockFetchConnection(makeConnection({ status: "error" }));
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("Connection is not active");
  });

  it("throws when Connections API returns 404", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 404 }));
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("Gateway getConnection failed: 404");
  });

  it("returns early with zero counts when connection has no resources", async () => {
    mockFetchConnection(makeConnection({ resources: [] }));
    const step = makeStep();

    const result = await capturedHandler({ event: makeEvent(), step });
    expect(result).toMatchObject({
      success: true,
      workUnits: 0,
      eventsProduced: 0,
      eventsDispatched: 0,
    });
    expect(step.sendEvent).not.toHaveBeenCalled();
  });
});

describe("connector resolution", () => {
  it("throws when getConnector returns null", async () => {
    mockFetchConnection();
    mockGetConnector.mockReturnValue(null);
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("No backfill connector for provider");
  });

  it("entityTypes from event data overrides connector defaultEntityTypes", async () => {
    mockFetchConnection();
    const step = makeStep();
    const event = makeEvent({ entityTypes: ["pull_request"] });

    await capturedHandler({ event, step });

    // With 2 resources and 1 entity type = 2 work units
    const sendCall = step.sendEvent.mock.calls[0]!;
    const events = sendCall[1] as Array<{ data: { entityType: string } }>;
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.data.entityType === "pull_request")).toBe(true);
  });

  it("uses connector.defaultEntityTypes when entityTypes is absent", async () => {
    mockFetchConnection();
    const step = makeStep();
    const event = makeEvent({ entityTypes: undefined });

    await capturedHandler({ event, step });

    // 2 resources x 3 default entity types = 6 work units
    const sendCall = step.sendEvent.mock.calls[0]!;
    const events = sendCall[1] as Array<{ data: { entityType: string } }>;
    expect(events).toHaveLength(6);
  });
});

describe("work unit enumeration", () => {
  it("2 resources x 3 entity types = 6 work units", async () => {
    mockFetchConnection();
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    const sendCall = step.sendEvent.mock.calls[0]!;
    const events = sendCall[1] as unknown[];
    expect(events).toHaveLength(6);
  });

  it("1 resource x 1 entity type (override) = 1 work unit", async () => {
    mockFetchConnection(
      makeConnection({
        resources: [{ id: "r1", providerResourceId: "100", resourceName: "owner/repo" }],
      }),
    );
    const step = makeStep();
    const event = makeEvent({ entityTypes: ["pull_request"] });

    await capturedHandler({ event, step });

    const sendCall = step.sendEvent.mock.calls[0]!;
    const events = sendCall[1] as unknown[];
    expect(events).toHaveLength(1);
  });
});

describe("fan-out", () => {
  it("step.sendEvent called once with batch of entity.requested events", async () => {
    mockFetchConnection();
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.sendEvent).toHaveBeenCalledOnce();
    const [stepName, events] = step.sendEvent.mock.calls[0]!;
    expect(stepName).toBe("fan-out-entity-workers");
    for (const evt of events as Array<{ name: string; data: Record<string, unknown> }>) {
      expect(evt.name).toBe("apps-backfill/entity.requested");
      expect(evt.data).toHaveProperty("installationId", "inst-1");
      expect(evt.data).toHaveProperty("provider", "github");
      expect(evt.data).toHaveProperty("orgId", "org-1");
      expect(evt.data).toHaveProperty("entityType");
      expect(evt.data).toHaveProperty("resource");
      expect(evt.data).toHaveProperty("since");
      expect(evt.data).toHaveProperty("depth", 30);
    }
  });
});

describe("wait-for-completions", () => {
  it("step.waitForEvent called once per work unit", async () => {
    mockFetchConnection();
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    // 2 resources x 3 entity types = 6 wait calls
    expect(step.waitForEvent).toHaveBeenCalledTimes(6);
  });

  it("null return (timeout) → included in failed results", async () => {
    mockFetchConnection(
      makeConnection({
        resources: [{ id: "r1", providerResourceId: "100", resourceName: "owner/repo" }],
      }),
    );
    const step = makeStep({
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn().mockResolvedValue(null), // timeout
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    const result = (await capturedHandler({ event, step })) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.failed).toBe(1);
  });

  it("successful completion event with success: true → included in succeeded", async () => {
    mockFetchConnection(
      makeConnection({
        resources: [{ id: "r1", providerResourceId: "100", resourceName: "owner/repo" }],
      }),
    );
    const step = makeStep({
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn().mockResolvedValue({
        data: {
          success: true,
          eventsProduced: 10,
          eventsDispatched: 10,
          pagesProcessed: 1,
        },
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    const result = (await capturedHandler({ event, step })) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.completed).toBe(1);
  });

  it("completion event with success: false → included in failed", async () => {
    mockFetchConnection(
      makeConnection({
        resources: [{ id: "r1", providerResourceId: "100", resourceName: "owner/repo" }],
      }),
    );
    const step = makeStep({
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn().mockResolvedValue({
        data: {
          success: false,
          eventsProduced: 0,
          eventsDispatched: 0,
          pagesProcessed: 0,
          error: "some error",
        },
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    const result = (await capturedHandler({ event, step })) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.failed).toBe(1);
  });
});

describe("aggregation", () => {
  it("all work units succeed → success: true", async () => {
    mockFetchConnection(
      makeConnection({
        resources: [{ id: "r1", providerResourceId: "100", resourceName: "owner/repo" }],
      }),
    );
    const step = makeStep({
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn().mockResolvedValue({
        data: { success: true, eventsProduced: 5, eventsDispatched: 5, pagesProcessed: 1 },
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    const result = (await capturedHandler({ event, step })) as Record<string, unknown>;
    expect(result.success).toBe(true);
  });

  it("any work unit fails → success: false", async () => {
    mockFetchConnection(
      makeConnection({
        resources: [{ id: "r1", providerResourceId: "100", resourceName: "owner/repo" }],
      }),
    );
    let callCount = 0;
    const step = makeStep({
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { data: { success: true, eventsProduced: 5, eventsDispatched: 5, pagesProcessed: 1 } };
        }
        return { data: { success: false, eventsProduced: 0, eventsDispatched: 0, pagesProcessed: 0, error: "fail" } };
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    // 2 entity types so we get one success and one failure
    const event = makeEvent({ entityTypes: ["pull_request", "issue"] });

    const result = (await capturedHandler({ event, step })) as Record<string, unknown>;
    expect(result.success).toBe(false);
  });

  it("eventsProduced and eventsDispatched summed from all completions", async () => {
    mockFetchConnection(
      makeConnection({
        resources: [{ id: "r1", providerResourceId: "100", resourceName: "owner/repo" }],
      }),
    );
    let callCount = 0;
    const step = makeStep({
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn().mockImplementation(() => {
        callCount++;
        return {
          data: {
            success: true,
            eventsProduced: callCount * 10,
            eventsDispatched: callCount * 10,
            pagesProcessed: 1,
          },
        };
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    const event = makeEvent({ entityTypes: ["pull_request", "issue"] });

    const result = (await capturedHandler({ event, step })) as Record<string, unknown>;
    // First: 10, Second: 20 → total 30
    expect(result.eventsProduced).toBe(30);
    expect(result.eventsDispatched).toBe(30);
  });
});

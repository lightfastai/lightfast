import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Capture the handler passed to createFunction ──

let capturedHandler: (args: { event: any; step: any }) => Promise<unknown>;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      config: { id: string },
      _trigger: unknown,
      handler: typeof capturedHandler
    ) => {
      // Only capture the orchestrator handler (entity worker is mocked out)
      if (config.id === "apps-backfill/run.orchestrator") {
        capturedHandler = handler;
      }
      return { id: config.id };
    },
  },
}));

// Mock entity-worker so the orchestrator import doesn't trigger a second createFunction call
vi.mock("./entity-worker", () => ({
  backfillEntityWorker: { id: "mock-entity-worker" },
}));

const mockGatewayClient = {
  getConnection: vi.fn(),
  getBackfillRuns: vi.fn().mockResolvedValue([]),
  upsertBackfillRun: vi.fn().mockResolvedValue(undefined),
};

const mockRelayClient = {
  replayCatchup: vi.fn().mockResolvedValue({ remaining: 0 }),
};
vi.mock("@repo/gateway-service-clients", () => ({
  createGatewayClient: () => mockGatewayClient,
  createRelayClient: () => mockRelayClient,
}));

const mockProvider = {
  api: { parseRateLimit: vi.fn().mockReturnValue(null) },
  backfill: {
    supportedEntityTypes: ["pull_request", "issue", "release"],
    defaultEntityTypes: ["pull_request", "issue", "release"],
    entityTypes: {
      pull_request: {
        endpointId: "list-pull-requests",
        buildRequest: vi.fn(),
        processResponse: vi.fn(),
      },
      issue: {
        endpointId: "list-issues",
        buildRequest: vi.fn(),
        processResponse: vi.fn(),
      },
      release: {
        endpointId: "list-releases",
        buildRequest: vi.fn(),
        processResponse: vi.fn(),
      },
    },
  },
};

const mockGetProvider = vi.fn();
vi.mock("@repo/console-providers", () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
}));

vi.mock("../env", () => ({
  env: { GATEWAY_API_KEY: "test-key" },
}));

// Force module load to capture handler
await import("./backfill-orchestrator.js");

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
    invoke: vi.fn().mockResolvedValue({
      eventsProduced: 10,
      eventsDispatched: 10,
      pagesProcessed: 1,
    }),
    sendEvent: vi.fn().mockResolvedValue(undefined),
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

beforeEach(() => {
  vi.resetAllMocks();
  mockGetProvider.mockReturnValue(mockProvider);
  mockGatewayClient.getConnection.mockResolvedValue(makeConnection());
  mockGatewayClient.getBackfillRuns.mockResolvedValue([]);
  mockGatewayClient.upsertBackfillRun.mockResolvedValue(undefined);
  mockRelayClient.replayCatchup.mockResolvedValue({ remaining: 0 });
});

// ── Tests ──

describe("get-connection step", () => {
  it("fetches connection and continues when active", async () => {
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(mockGatewayClient.getConnection).toHaveBeenCalledWith("inst-1");
  });

  it("throws when connection status is inactive", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({ status: "inactive" })
    );
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Connection is not active"
    );
  });

  it("throws when connection status is error", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({ status: "error" })
    );
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Connection is not active"
    );
  });

  it("throws when Connections API returns an error", async () => {
    mockGatewayClient.getConnection.mockRejectedValue(
      new Error("Gateway getConnection failed: 404 for inst-1")
    );
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Gateway getConnection failed: 404"
    );
  });

  it("throws when event.data.orgId does not match connection.orgId", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({ orgId: "org-different" })
    );
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent({ orgId: "org-1" }), step })
    ).rejects.toThrow("orgId mismatch");
  });

  it("proceeds when event.data.orgId matches connection.orgId", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({ orgId: "org-1" })
    );
    const step = makeStep();

    const result = await capturedHandler({
      event: makeEvent({ orgId: "org-1" }),
      step,
    });
    expect(result).toMatchObject({ success: true });
  });

  it("returns early with zero counts when connection has no resources", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({ resources: [] })
    );
    const step = makeStep();

    const result = await capturedHandler({ event: makeEvent(), step });
    expect(result).toMatchObject({
      success: true,
      workUnits: 0,
      eventsProduced: 0,
      eventsDispatched: 0,
    });
    expect(step.invoke).not.toHaveBeenCalled();
  });
});

describe("provider resolution", () => {
  it("throws when getProvider returns undefined", async () => {
    mockGetProvider.mockReturnValue(undefined);
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "No backfill provider for provider"
    );
  });

  it("entityTypes from event data overrides provider defaultEntityTypes", async () => {
    const step = makeStep();
    const event = makeEvent({ entityTypes: ["pull_request"] });

    await capturedHandler({ event, step });

    // With 2 resources and 1 entity type = 2 work units → 2 invoke calls
    expect(step.invoke).toHaveBeenCalledTimes(2);
    const invokeCalls = step.invoke.mock.calls as [
      string,
      { data: { entityType: string } },
    ][];
    expect(
      invokeCalls.every((call) => call[1].data.entityType === "pull_request")
    ).toBe(true);
  });

  it("uses provider.backfill.defaultEntityTypes when entityTypes is absent", async () => {
    const step = makeStep();
    const event = makeEvent({ entityTypes: undefined });

    await capturedHandler({ event, step });

    // 2 resources x 3 default entity types = 6 work units
    expect(step.invoke).toHaveBeenCalledTimes(6);
  });
});

describe("work unit enumeration", () => {
  it("2 resources x 3 entity types = 6 work units", async () => {
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.invoke).toHaveBeenCalledTimes(6);
  });

  it("1 resource x 1 entity type (override) = 1 work unit", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    const step = makeStep();
    const event = makeEvent({ entityTypes: ["pull_request"] });

    await capturedHandler({ event, step });

    expect(step.invoke).toHaveBeenCalledTimes(1);
  });
});

describe("invoke entity workers", () => {
  it("step.invoke called once per filtered work unit with correct data", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    const step = makeStep();

    await capturedHandler({
      event: makeEvent({ entityTypes: ["pull_request"] }),
      step,
    });

    expect(step.invoke).toHaveBeenCalledOnce();
    const [stepName, invokeOpts] = step.invoke.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(stepName).toBe("invoke-100-pull_request");
    expect(invokeOpts.data).toMatchObject({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      entityType: "pull_request",
      resource: { providerResourceId: "100", resourceName: "owner/repo" },
      depth: 30,
    });
    expect(invokeOpts.timeout).toBe("4h");
  });

  it("invoke rejection → { success: false } in results", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    const step = makeStep({
      invoke: vi.fn().mockRejectedValue(new Error("worker crashed")),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    const result = (await capturedHandler({ event, step })) as Record<
      string,
      unknown
    >;
    expect(result.success).toBe(false);
    expect(result.failed).toBe(1);
  });

  it("invoke success → { success: true } with correct stats", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    const step = makeStep({
      invoke: vi.fn().mockResolvedValue({
        eventsProduced: 42,
        eventsDispatched: 42,
        pagesProcessed: 3,
      }),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    const result = (await capturedHandler({ event, step })) as Record<
      string,
      unknown
    >;
    expect(result.success).toBe(true);
    expect(result.completed).toBe(1);
    expect(result.eventsProduced).toBe(42);
    expect(result.eventsDispatched).toBe(42);
  });
});

describe("aggregation", () => {
  it("all work units succeed → success: true", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    const step = makeStep({
      invoke: vi.fn().mockResolvedValue({
        eventsProduced: 5,
        eventsDispatched: 5,
        pagesProcessed: 1,
      }),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    const result = (await capturedHandler({ event, step })) as Record<
      string,
      unknown
    >;
    expect(result.success).toBe(true);
  });

  it("any work unit fails → success: false", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    let callCount = 0;
    const step = makeStep({
      invoke: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            eventsProduced: 5,
            eventsDispatched: 5,
            pagesProcessed: 1,
          });
        }
        return Promise.reject(new Error("fail"));
      }),
    });
    const event = makeEvent({ entityTypes: ["pull_request", "issue"] });

    const result = (await capturedHandler({ event, step })) as Record<
      string,
      unknown
    >;
    expect(result.success).toBe(false);
  });

  it("eventsProduced and eventsDispatched summed from all completions", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    let callCount = 0;
    const step = makeStep({
      invoke: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          eventsProduced: callCount * 10,
          eventsDispatched: callCount * 10,
          pagesProcessed: 1,
        });
      }),
    });
    const event = makeEvent({ entityTypes: ["pull_request", "issue"] });

    const result = (await capturedHandler({ event, step })) as Record<
      string,
      unknown
    >;
    // First: 10, Second: 20 → total 30
    expect(result.eventsProduced).toBe(30);
    expect(result.eventsDispatched).toBe(30);
  });
});

describe("persist-run-records", () => {
  it("upsertBackfillRun called once per unique entityType with summed stats", async () => {
    // 2 resources, 1 entity type = 2 workers for same entityType
    const step = makeStep({
      invoke: vi
        .fn()
        .mockResolvedValueOnce({
          eventsProduced: 10,
          eventsDispatched: 10,
          pagesProcessed: 1,
        })
        .mockResolvedValueOnce({
          eventsProduced: 20,
          eventsDispatched: 20,
          pagesProcessed: 2,
        }),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    await capturedHandler({ event, step });

    expect(mockGatewayClient.upsertBackfillRun).toHaveBeenCalledOnce();
    const [_, record] = mockGatewayClient.upsertBackfillRun.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(record.entityType).toBe("pull_request");
    expect(record.status).toBe("completed");
    expect(record.eventsProduced).toBe(30);
    expect(record.eventsDispatched).toBe(30);
    expect(record.pagesProcessed).toBe(3);
  });

  it("partial failure writes status: failed with error", async () => {
    // 2 resources for pull_request: 1 succeeds, 1 fails
    const step = makeStep({
      invoke: vi
        .fn()
        .mockResolvedValueOnce({
          eventsProduced: 5,
          eventsDispatched: 5,
          pagesProcessed: 1,
        })
        .mockRejectedValueOnce(new Error("rate limited")),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    await capturedHandler({ event, step });

    expect(mockGatewayClient.upsertBackfillRun).toHaveBeenCalledOnce();
    const [_, record] = mockGatewayClient.upsertBackfillRun.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(record.status).toBe("failed");
    expect(record.error).toBe("rate limited");
  });

  it("all-success writes status: completed", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    const step = makeStep({
      invoke: vi.fn().mockResolvedValue({
        eventsProduced: 5,
        eventsDispatched: 5,
        pagesProcessed: 1,
      }),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    await capturedHandler({ event, step });

    const [_, record] = mockGatewayClient.upsertBackfillRun.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(record.status).toBe("completed");
  });

  it("persist is skipped when all work units are gap-filtered", async () => {
    // All entity types covered by prior runs
    const history = [
      {
        entityType: "pull_request",
        since: "2020-01-01T00:00:00Z",
        depth: 30,
        status: "completed",
      },
      {
        entityType: "issue",
        since: "2020-01-01T00:00:00Z",
        depth: 30,
        status: "completed",
      },
      {
        entityType: "release",
        since: "2020-01-01T00:00:00Z",
        depth: 30,
        status: "completed",
      },
    ];
    mockGatewayClient.getBackfillRuns.mockResolvedValue(history);
    const step = makeStep();

    await capturedHandler({ event: makeEvent({ depth: 30 }), step });

    expect(step.invoke).not.toHaveBeenCalled();
    expect(mockGatewayClient.upsertBackfillRun).not.toHaveBeenCalled();
  });
});

describe("gap-aware filtering", () => {
  it("skips entity types fully covered by prior runs", async () => {
    const history = [
      {
        entityType: "issue",
        since: "2020-01-01T00:00:00Z",
        depth: 30,
        status: "completed",
        completedAt: "2026-01-02T00:00:00Z",
      },
    ];
    mockGatewayClient.getBackfillRuns.mockResolvedValue(history);
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent({ depth: 30 }),
      step,
    })) as Record<string, unknown>;

    // "issue" should be skipped for both resources, "pull_request" and "release" should run
    // 2 resources x 3 entity types = 6 total, 2 resources x 1 skipped entity = 2 skipped
    expect(result.skipped).toBe(2);
    expect(result.dispatched).toBe(4);
  });

  it("includes entity types when depth escalates beyond prior run", async () => {
    const recentSince = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const history = [
      {
        entityType: "issue",
        since: recentSince,
        depth: 7,
        status: "completed",
        completedAt: "2026-02-22T00:00:00Z",
      },
    ];
    mockGatewayClient.getBackfillRuns.mockResolvedValue(history);
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent({ depth: 30 }),
      step,
    })) as Record<string, unknown>;

    expect(result.skipped).toBe(0);
    expect(result.dispatched).toBe(6);
  });

  it("continues with empty history when fetch fails", async () => {
    mockGatewayClient.getBackfillRuns.mockResolvedValue([]);
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;

    expect(result.skipped).toBe(0);
  });

  it("returns early when all work units are skipped", async () => {
    const history = [
      {
        entityType: "pull_request",
        since: "2020-01-01T00:00:00Z",
        depth: 30,
        status: "completed",
      },
      {
        entityType: "issue",
        since: "2020-01-01T00:00:00Z",
        depth: 30,
        status: "completed",
      },
      {
        entityType: "release",
        since: "2020-01-01T00:00:00Z",
        depth: 30,
        status: "completed",
      },
    ];
    mockGatewayClient.getBackfillRuns.mockResolvedValue(history);
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent({ depth: 30 }),
      step,
    })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.workUnits).toBe(6);
    expect(result.skipped).toBe(6);
    expect(result.dispatched).toBe(0);
    expect(step.invoke).not.toHaveBeenCalled();
  });
});

describe("correlationId forwarding", () => {
  it("forwards correlationId from event to entity worker invocations", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    const step = makeStep();
    const event = makeEvent({
      entityTypes: ["pull_request"],
      correlationId: "trace-abc-123",
    });

    await capturedHandler({ event, step });

    const [_, invokeOpts] = step.invoke.mock.calls[0] as [
      string,
      { data: Record<string, unknown> },
    ];
    expect(invokeOpts.data.correlationId).toBe("trace-abc-123");
  });
});

describe("holdForReplay", () => {
  it("passes holdForReplay through invoke data", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    const step = makeStep();
    const event = makeEvent({
      entityTypes: ["pull_request"],
      holdForReplay: true,
    });

    await capturedHandler({ event, step });

    const [_, invokeOpts] = step.invoke.mock.calls[0] as [
      string,
      { data: Record<string, unknown> },
    ];
    expect(invokeOpts.data.holdForReplay).toBe(true);
  });

  it("calls replay-held-webhooks step after successful completion when holdForReplay is true", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );
    mockRelayClient.replayCatchup.mockResolvedValue({ remaining: 0 });

    const runCalls: string[] = [];
    const step = makeStep({
      run: vi.fn((name: string, fn: () => unknown) => {
        runCalls.push(name);
        return fn();
      }),
      invoke: vi.fn().mockResolvedValue({
        eventsProduced: 5,
        eventsDispatched: 5,
        pagesProcessed: 1,
      }),
    });
    const event = makeEvent({
      entityTypes: ["pull_request"],
      holdForReplay: true,
    });

    await capturedHandler({ event, step });

    expect(runCalls).toContain("replay-held-webhooks");
    expect(mockRelayClient.replayCatchup).toHaveBeenCalledWith("inst-1", 200);
  });

  it("skips replay-held-webhooks when holdForReplay is not set", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );

    const runCalls: string[] = [];
    const step = makeStep({
      run: vi.fn((name: string, fn: () => unknown) => {
        runCalls.push(name);
        return fn();
      }),
      invoke: vi.fn().mockResolvedValue({
        eventsProduced: 5,
        eventsDispatched: 5,
        pagesProcessed: 1,
      }),
    });
    const event = makeEvent({ entityTypes: ["pull_request"] });

    await capturedHandler({ event, step });

    expect(runCalls).not.toContain("replay-held-webhooks");
  });

  it("skips replay when all workers failed", async () => {
    mockGatewayClient.getConnection.mockResolvedValue(
      makeConnection({
        resources: [
          { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
        ],
      })
    );

    const runCalls: string[] = [];
    const step = makeStep({
      run: vi.fn((name: string, fn: () => unknown) => {
        runCalls.push(name);
        return fn();
      }),
      invoke: vi.fn().mockRejectedValue(new Error("fail")),
    });
    const event = makeEvent({
      entityTypes: ["pull_request"],
      holdForReplay: true,
    });

    await capturedHandler({ event, step });

    expect(runCalls).not.toContain("replay-held-webhooks");
  });
});

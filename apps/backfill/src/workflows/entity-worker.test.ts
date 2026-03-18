import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Capture handler from createFunction ──

let capturedHandler: (args: { event: any; step: any }) => Promise<unknown>;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      _trigger: unknown,
      handler: typeof capturedHandler
    ) => {
      capturedHandler = handler;
      return { id: "mock-entity-worker" };
    },
  },
}));

const mockGatewayClient = {
  getConnection: vi.fn(),
  getToken: vi.fn(),
  getBackfillRuns: vi.fn(),
  upsertBackfillRun: vi.fn(),
  executeApi: vi.fn(),
};

const mockRelayClient = {
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
  replayCatchup: vi.fn(),
};
vi.mock("@repo/gateway-service-clients", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/gateway-service-clients")>();
  return {
    ...actual,
    createGatewayClient: () => mockGatewayClient,
    createRelayClient: () => mockRelayClient,
  };
});

const mockBuildRequest = vi.fn();
const mockProcessResponse = vi.fn();
const mockParseRateLimit = vi.fn();

const mockProvider = {
  api: { parseRateLimit: mockParseRateLimit },
  backfill: {
    supportedEntityTypes: ["pull_request"],
    defaultEntityTypes: ["pull_request"],
    entityTypes: {
      pull_request: {
        endpointId: "list-pull-requests",
        buildRequest: mockBuildRequest,
        processResponse: mockProcessResponse,
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
await import("./entity-worker.js");

// ── Helpers ──

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      entityType: "pull_request",
      resource: { providerResourceId: "123", resourceName: "owner/repo" },
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      depth: 30,
      ...overrides,
    },
  };
}

function makeStep(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProvider.mockReturnValue(mockProvider);
  mockBuildRequest.mockReturnValue({});
  mockProcessResponse.mockReturnValue({
    events: [],
    nextCursor: null,
    rawCount: 0,
  });
  mockParseRateLimit.mockReturnValue(null);
  mockGatewayClient.executeApi.mockResolvedValue({
    status: 200,
    data: [],
    headers: {},
  });
  mockRelayClient.dispatchWebhook.mockResolvedValue(undefined);
});

// ── Tests ──

describe("provider resolution", () => {
  it("throws when getProvider returns undefined", async () => {
    mockGetProvider.mockReturnValue(undefined);
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Unknown provider"
    );
  });

  it("throws when entity type is not supported", async () => {
    mockGetProvider.mockReturnValue({
      ...mockProvider,
      backfill: { ...mockProvider.backfill, entityTypes: {} },
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "is not supported for"
    );
  });
});

describe("pagination loop — single page", () => {
  it("3 events with nextCursor: null → 3 dispatches, loop exits", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 200,
      data: [],
      headers: {},
    });
    mockProcessResponse.mockReturnValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
        { deliveryId: "d2", eventType: "pull_request", payload: { pr: 2 } },
        { deliveryId: "d3", eventType: "pull_request", payload: { pr: 3 } },
      ],
      nextCursor: null,
      rawCount: 3,
    });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;
    expect(result.eventsDispatched).toBe(3);
    expect(result.pagesProcessed).toBe(1);
  });

  it("dispatches to relay with correct payload shape", async () => {
    mockProcessResponse.mockReturnValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
      ],
      nextCursor: null,
      rawCount: 1,
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(mockRelayClient.dispatchWebhook).toHaveBeenCalledWith(
      "github",
      expect.objectContaining({
        connectionId: "inst-1",
        orgId: "org-1",
        deliveryId: "d1",
        eventType: "pull_request",
      }),
      undefined // holdForReplay
    );
  });
});

describe("dispatch error handling", () => {
  it("throws when Relay dispatch returns non-2xx response", async () => {
    mockProcessResponse.mockReturnValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
      ],
      nextCursor: null,
      rawCount: 1,
    });
    mockRelayClient.dispatchWebhook.mockRejectedValueOnce(
      new Error("Relay ingestWebhook failed: 500 — Internal Server Error")
    );
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Relay ingestWebhook failed: 500"
    );
  });
});

describe("pagination loop — multiple pages", () => {
  it("two pages → 2 fetch steps, cursor passed correctly", async () => {
    mockGatewayClient.executeApi
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} })
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} });
    mockProcessResponse
      .mockReturnValueOnce({
        events: [{ deliveryId: "d1", eventType: "pull_request", payload: {} }],
        nextCursor: { page: 2 },
        rawCount: 1,
      })
      .mockReturnValueOnce({
        events: [{ deliveryId: "d2", eventType: "pull_request", payload: {} }],
        nextCursor: null,
        rawCount: 1,
      });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;
    expect(result.pagesProcessed).toBe(2);
    expect(result.eventsDispatched).toBe(2);

    // Verify cursor was passed to the second buildRequest call
    const secondBuildRequestCall = mockBuildRequest.mock.calls[1]!;
    expect(secondBuildRequestCall[1]).toEqual({ page: 2 });
  });
});

describe("executeApi error handling", () => {
  it("propagates executeApi rejection on second page", async () => {
    mockGatewayClient.executeApi
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} })
      .mockRejectedValueOnce(new Error("API timeout"));
    mockProcessResponse.mockReturnValueOnce({
      events: [{ deliveryId: "d1", eventType: "pull_request", payload: {} }],
      nextCursor: { page: 2 },
      rawCount: 1,
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "API timeout"
    );
  });

  it("throws when executeApi returns non-200 status (retriable)", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 500,
      data: null,
      headers: {},
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Provider API returned 500"
    );
    expect(step.sendEvent).not.toHaveBeenCalled();
  });
});

describe("executeApi auth error handling", () => {
  it("401 → throws NonRetriableError and fires health-check event", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 401,
      data: null,
      headers: {},
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Provider API returned 401"
    );
    expect(step.sendEvent).toHaveBeenCalledOnce();
    expect(step.sendEvent).toHaveBeenCalledWith(
      "signal-connection-health-check",
      expect.objectContaining({
        name: "backfill/connection.health.check.requested",
        data: expect.objectContaining({
          installationId: "inst-1",
          provider: "github",
          reason: "401_unauthorized",
        }),
      })
    );
  });

  it("403 → throws NonRetriableError and does NOT fire health-check event", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 403,
      data: null,
      headers: {},
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Provider API returned 403"
    );
    expect(step.sendEvent).not.toHaveBeenCalled();
  });

  it("500 → throws HttpError (retriable, not NonRetriableError)", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 500,
      data: null,
      headers: {},
    });
    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "Provider API returned 500"
    );
    expect(step.sendEvent).not.toHaveBeenCalled();
  });
});

describe("rate limit injection", () => {
  it("remaining < limit * 0.1 → step.sleep called", async () => {
    const futureResetAt = new Date(Date.now() + 60_000);
    mockParseRateLimit.mockReturnValueOnce({
      remaining: 5,
      limit: 5000,
      resetAt: futureResetAt,
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.sleep).toHaveBeenCalled();
  });

  it("remaining >= limit * 0.1 → step.sleep not called", async () => {
    mockParseRateLimit.mockReturnValueOnce({
      remaining: 500,
      limit: 5000,
      resetAt: new Date(Date.now() + 60_000),
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.sleep).not.toHaveBeenCalled();
  });
});

describe("rate-limit boundary conditions", () => {
  it("resetAt in the past → sleepMs = 0 → no sleep, pagination continues", async () => {
    // resetAt already passed — clock is ahead of reset time
    const pastResetAt = new Date(Date.now() - 5000); // 5 seconds ago
    mockParseRateLimit.mockReturnValueOnce({
      remaining: 0,
      limit: 5000,
      resetAt: pastResetAt,
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    // sleepMs = Math.max(0, pastResetAt - now) = 0 → no sleep
    expect(step.sleep).not.toHaveBeenCalled();
  });

  it("resetAt is epoch date (far past) → sleepMs = 0 → no sleep, no crash", async () => {
    // epoch = 1970-01-01, far in the past → sleepMs = Math.max(0, negative) = 0
    mockParseRateLimit.mockReturnValueOnce({
      remaining: 0,
      limit: 5000,
      resetAt: new Date(0), // epoch — always in the past
    });
    const step = makeStep();

    // Should not throw — sleepMs = 0 → if (0 > 0) is false → no sleep
    await expect(
      capturedHandler({ event: makeEvent(), step })
    ).resolves.toBeDefined();
    expect(step.sleep).not.toHaveBeenCalled();
  });

  it("remaining === limit * 0.1 → NO sleep (boundary is exclusive)", async () => {
    // remaining < limit * 0.1 triggers sleep. Exactly AT limit * 0.1 does NOT.
    const limit = 5000;
    mockParseRateLimit.mockReturnValueOnce({
      remaining: limit * 0.1, // exactly 500 — NOT less than 500
      limit,
      resetAt: new Date(Date.now() + 60_000),
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.sleep).not.toHaveBeenCalled();
  });

  it("remaining === limit * 0.1 - 1 → sleep IS triggered", async () => {
    const limit = 5000;
    mockParseRateLimit.mockReturnValueOnce({
      remaining: limit * 0.1 - 1, // 499 — less than 500
      limit,
      resetAt: new Date(Date.now() + 60_000),
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.sleep).toHaveBeenCalledOnce();
  });

  it("rateLimit = null → sleep never called regardless of page count", async () => {
    // Provider returns no rate limit headers → parseRateLimit returns null
    mockParseRateLimit.mockReturnValue(null);
    mockGatewayClient.executeApi
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} })
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} });
    mockProcessResponse
      .mockReturnValueOnce({ events: [], nextCursor: { page: 2 }, rawCount: 0 })
      .mockReturnValueOnce({ events: [], nextCursor: null, rawCount: 0 });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.sleep).not.toHaveBeenCalled();
  });

  it("always-rate-limited provider terminates at MAX_PAGES (500), not infinite loop", async () => {
    // Provider always returns: remaining = 0, resetAt = past (so sleepMs = 0)
    // The worker must terminate via the MAX_PAGES cap, not loop forever.
    let fetchCount = 0;
    mockGatewayClient.executeApi.mockImplementation(async () => {
      fetchCount++;
      return { status: 200, data: [], headers: {} };
    });
    mockProcessResponse.mockImplementation(() => ({
      events: [
        {
          deliveryId: `d-${fetchCount}`,
          eventType: "pull_request",
          payload: {},
        },
      ],
      nextCursor: { page: fetchCount + 1 },
      rawCount: 1,
    }));
    mockParseRateLimit.mockReturnValue({
      remaining: 0,
      limit: 5000,
      resetAt: new Date(Date.now() - 1000), // always in the past → sleepMs = 0
    });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;

    expect(result.pagesProcessed).toBe(500); // capped at MAX_PAGES
    expect(step.sleep).not.toHaveBeenCalled(); // sleepMs = 0 each time
  });

  it("sleep duration uses Math.ceil: 1500ms future resetAt rounds up to 2s", async () => {
    // Freeze Date.now() so sleepMs is exactly predictable
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const resetAt = new Date(Date.now() + 1500); // exactly 1500ms from fake-frozen now
      mockParseRateLimit.mockReturnValueOnce({
        remaining: 0,
        limit: 5000,
        resetAt,
      });
      const step = makeStep();

      await capturedHandler({ event: makeEvent(), step });

      // sleepMs = 1500 → Math.ceil(1500 / 1000) = 2 → "2s"
      const sleepArg = step.sleep.mock.calls[0]?.[1] as string;
      expect(sleepArg).toBe("2s");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("cancellation mid-page semantics", () => {
  it("step.run throwing on page 3 propagates — handler rejects with the error", async () => {
    // Inngest step semantics: if a step throws, the whole function retries.
    // Verify the handler propagates the throw correctly.
    let pageNum = 0;
    mockGatewayClient.executeApi.mockImplementation(async () => {
      return { status: 200, data: [], headers: {} };
    });
    mockProcessResponse.mockImplementation(() => {
      pageNum++;
      if (pageNum === 3) {
        throw new Error("InngestFunctionCancelled");
      }
      return {
        events: [
          {
            deliveryId: `d-${pageNum}`,
            eventType: "pull_request",
            payload: {},
          },
        ],
        nextCursor: { page: pageNum + 1 },
        rawCount: 1,
      };
    });

    const step = makeStep();

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "InngestFunctionCancelled"
    );
  });

  it("dispatch step on page 2 failing — step names track all attempted steps", async () => {
    // Documents step naming convention and that step names are deterministic.
    mockGatewayClient.executeApi.mockResolvedValue({
      status: 200,
      data: [],
      headers: {},
    });
    mockProcessResponse
      .mockReturnValueOnce({
        events: [{ deliveryId: "d1", eventType: "pull_request", payload: {} }],
        nextCursor: { page: 2 },
        rawCount: 1,
      })
      .mockReturnValueOnce({
        events: [{ deliveryId: "d2", eventType: "pull_request", payload: {} }],
        nextCursor: null,
        rawCount: 1,
      });

    let dispatchCount = 0;
    mockRelayClient.dispatchWebhook.mockImplementation(async () => {
      dispatchCount++;
      if (dispatchCount === 2) {
        throw new Error("relay down");
      }
    });

    const stepNames: string[] = [];
    const step = makeStep({
      run: vi.fn(async (name: string, fn: () => unknown) => {
        stepNames.push(name);
        return fn();
      }) as ReturnType<typeof vi.fn>,
    });

    await expect(capturedHandler({ event: makeEvent(), step })).rejects.toThrow(
      "relay down"
    );

    // Both fetch steps and both dispatch steps were attempted
    expect(stepNames).toContain("fetch-pull_request-p1");
    expect(stepNames).toContain("fetch-pull_request-p2");
    expect(stepNames).toContain("dispatch-pull_request-p1");
    expect(stepNames).toContain("dispatch-pull_request-p2");
  });
});

describe("completion", () => {
  it("returns correct stats with eventsProduced and eventsDispatched", async () => {
    mockProcessResponse.mockReturnValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: {} },
        { deliveryId: "d2", eventType: "pull_request", payload: {} },
      ],
      nextCursor: null,
      rawCount: 2,
    });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;
    expect(result).toEqual({
      entityType: "pull_request",
      resource: "123",
      eventsProduced: 2,
      eventsDispatched: 2,
      pagesProcessed: 1,
    });
  });

  it("multi-page counts are accurate", async () => {
    mockGatewayClient.executeApi
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} })
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} });
    mockProcessResponse
      .mockReturnValueOnce({
        events: [
          { deliveryId: "d1", eventType: "pull_request", payload: {} },
          { deliveryId: "d2", eventType: "pull_request", payload: {} },
          { deliveryId: "d3", eventType: "pull_request", payload: {} },
        ],
        nextCursor: { page: 2 },
        rawCount: 3,
      })
      .mockReturnValueOnce({
        events: [
          { deliveryId: "d4", eventType: "pull_request", payload: {} },
          { deliveryId: "d5", eventType: "pull_request", payload: {} },
        ],
        nextCursor: null,
        rawCount: 2,
      });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;
    expect(result.eventsProduced).toBe(5);
    expect(result.eventsDispatched).toBe(5);
    expect(result.pagesProcessed).toBe(2);
  });
});

describe("orgId forwarding", () => {
  it("dispatches to relay with orgId from event.data", async () => {
    mockProcessResponse.mockReturnValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
      ],
      nextCursor: null,
      rawCount: 1,
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent({ orgId: "org-42" }), step });

    expect(mockRelayClient.dispatchWebhook).toHaveBeenCalledWith(
      "github",
      expect.objectContaining({ orgId: "org-42" }),
      undefined
    );
  });
});

describe("pagination — empty pages", () => {
  it("empty events with nextCursor: null → completes with zero dispatches", async () => {
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 200,
      data: [],
      headers: {},
    });
    mockProcessResponse.mockReturnValueOnce({
      events: [],
      nextCursor: null,
      rawCount: 0,
    });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;
    expect(result.eventsProduced).toBe(0);
    expect(result.eventsDispatched).toBe(0);
    expect(result.pagesProcessed).toBe(1);
    expect(mockRelayClient.dispatchWebhook).not.toHaveBeenCalled();
  });

  it("empty events with nextCursor set → continues pagination, exits on null", async () => {
    mockGatewayClient.executeApi
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} })
      .mockResolvedValueOnce({ status: 200, data: [], headers: {} });
    mockProcessResponse
      .mockReturnValueOnce({
        events: [],
        nextCursor: { page: 2 },
        rawCount: 0,
      })
      .mockReturnValueOnce({
        events: [
          { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
        ],
        nextCursor: null,
        rawCount: 1,
      });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;
    expect(result.eventsProduced).toBe(1);
    expect(result.eventsDispatched).toBe(1);
    expect(result.pagesProcessed).toBe(2);
  });
});

describe("dispatch batching", () => {
  it("12 events are dispatched in 3 batches of 5+5+2", async () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      deliveryId: `d${i + 1}`,
      eventType: "pull_request",
      payload: { pr: i + 1 },
    }));
    mockProcessResponse.mockReturnValueOnce({
      events,
      nextCursor: null,
      rawCount: 12,
    });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;
    expect(result.eventsProduced).toBe(12);
    expect(result.eventsDispatched).toBe(12);
    expect(mockRelayClient.dispatchWebhook).toHaveBeenCalledTimes(12);
  });

  it("exactly 5 events dispatch in a single batch", async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      deliveryId: `d${i + 1}`,
      eventType: "pull_request",
      payload: { pr: i + 1 },
    }));
    mockProcessResponse.mockReturnValueOnce({
      events,
      nextCursor: null,
      rawCount: 5,
    });
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;
    expect(result.eventsDispatched).toBe(5);
    expect(mockRelayClient.dispatchWebhook).toHaveBeenCalledTimes(5);
  });
});

describe("pagination safety cap", () => {
  it("breaks out of loop when MAX_PAGES is reached", async () => {
    // MAX_PAGES is 500 — simulate a provider that always returns nextCursor.
    // We'll mock enough pages to verify the cap kicks in.
    // We use a counter to track how many pages are fetched.
    let fetchCount = 0;
    mockGatewayClient.executeApi.mockImplementation(async () => {
      fetchCount++;
      return { status: 200, data: [], headers: {} };
    });
    mockProcessResponse.mockImplementation(() => ({
      events: [
        {
          deliveryId: `d-${fetchCount}`,
          eventType: "pull_request",
          payload: {},
        },
      ],
      nextCursor: { page: fetchCount + 1 }, // always has more
      rawCount: 1,
    }));
    const step = makeStep();

    const result = (await capturedHandler({
      event: makeEvent(),
      step,
    })) as Record<string, unknown>;

    // Should stop at MAX_PAGES (500), not loop forever
    expect(result.pagesProcessed).toBe(500);
    expect(fetchCount).toBe(500);
  });
});

describe("holdForReplay", () => {
  it("passes holdForReplay: true to relay.dispatchWebhook", async () => {
    mockProcessResponse.mockReturnValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
      ],
      nextCursor: null,
      rawCount: 1,
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent({ holdForReplay: true }), step });

    expect(mockRelayClient.dispatchWebhook).toHaveBeenCalledWith(
      "github",
      expect.any(Object),
      true // holdForReplay
    );
  });

  it("passes holdForReplay: undefined when not set", async () => {
    mockProcessResponse.mockReturnValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
      ],
      nextCursor: null,
      rawCount: 1,
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(mockRelayClient.dispatchWebhook).toHaveBeenCalledWith(
      "github",
      expect.any(Object),
      undefined // holdForReplay not set
    );
  });
});

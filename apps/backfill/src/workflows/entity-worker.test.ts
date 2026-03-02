import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Capture handler from createFunction ──

let capturedHandler: (args: { event: any; step: any }) => Promise<unknown>;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      _trigger: unknown,
      handler: typeof capturedHandler,
    ) => {
      capturedHandler = handler;
      return { id: "mock-entity-worker" };
    },
  },
}));

const mockGatewayClient = {
  getConnection: vi.fn(),
  getToken: vi.fn().mockResolvedValue({ accessToken: "tok-1", provider: "github", expiresIn: 3600 }),
  getBackfillRuns: vi.fn(),
  upsertBackfillRun: vi.fn(),
};
vi.mock("../lib/gateway-client", () => ({
  createGatewayClient: () => mockGatewayClient,
}));

const mockRelayClient = {
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
  replayCatchup: vi.fn(),
};
vi.mock("../lib/relay-client", () => ({
  createRelayClient: () => mockRelayClient,
}));

const mockGetConnector = vi.fn();
vi.mock("@repo/console-backfill", () => ({
  getConnector: (...args: unknown[]) => mockGetConnector(...args),
}));

vi.mock("../env", () => ({
  env: { GATEWAY_API_KEY: "test-key" },
}));

vi.mock("../lib/related-projects", () => ({
  gatewayUrl: "https://gateway.test/services",
  relayUrl: "https://relay.test/api",
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

const mockConnector = {
  provider: "github" as const,
  supportedEntityTypes: ["pull_request"],
  defaultEntityTypes: ["pull_request"],
  validateScopes: vi.fn(),
  fetchPage: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConnector.mockReturnValue(mockConnector);
  mockConnector.fetchPage.mockReset();
  mockGatewayClient.getToken.mockResolvedValue({ accessToken: "tok-1", provider: "github", expiresIn: 3600 });
  mockRelayClient.dispatchWebhook.mockResolvedValue(undefined);
});

// ── Tests ──

describe("get-token step", () => {
  it("fetches token from gateway client and proceeds", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [],
      nextCursor: null,
      rawCount: 0,
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(mockGatewayClient.getToken).toHaveBeenCalledWith("inst-1");
  });

  it("throws when gateway getToken fails", async () => {
    mockGatewayClient.getToken.mockRejectedValueOnce(
      new Error("Gateway getToken failed: 401 for inst-1"),
    );
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("Gateway getToken failed: 401");
  });
});

describe("connector resolution", () => {
  it("throws when getConnector returns null", async () => {
    mockGetConnector.mockReturnValue(null);
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("No backfill connector for provider");
  });
});

describe("pagination loop — single page", () => {
  it("3 events with nextCursor: null → 3 dispatches, loop exits", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
        { deliveryId: "d2", eventType: "pull_request", payload: { pr: 2 } },
        { deliveryId: "d3", eventType: "pull_request", payload: { pr: 3 } },
      ],
      nextCursor: null,
      rawCount: 3,
    });
    const step = makeStep();

    const result = (await capturedHandler({ event: makeEvent(), step })) as Record<string, unknown>;
    expect(result.eventsDispatched).toBe(3);
    expect(result.pagesProcessed).toBe(1);
  });

  it("dispatches to relay with correct payload shape", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
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
      undefined, // holdForReplay
    );
  });
});

describe("dispatch error handling", () => {
  it("throws when Relay dispatch returns non-2xx response", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
      ],
      nextCursor: null,
      rawCount: 1,
    });
    mockRelayClient.dispatchWebhook.mockRejectedValueOnce(
      new Error("Relay ingestWebhook failed: 500 — Internal Server Error"),
    );
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("Relay ingestWebhook failed: 500");
  });
});

describe("pagination loop — multiple pages", () => {
  it("two pages → 2 fetch steps, cursor passed correctly", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [{ deliveryId: "d1", eventType: "pull_request", payload: {} }],
      nextCursor: { page: 2 },
      rawCount: 1,
    });
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [{ deliveryId: "d2", eventType: "pull_request", payload: {} }],
      nextCursor: null,
      rawCount: 1,
    });
    const step = makeStep();

    const result = (await capturedHandler({ event: makeEvent(), step })) as Record<string, unknown>;
    expect(result.pagesProcessed).toBe(2);
    expect(result.eventsDispatched).toBe(2);

    const secondFetchCall = mockConnector.fetchPage.mock.calls[1]!;
    expect(secondFetchCall[2]).toEqual({ page: 2 });
  });
});

describe("fetchPage error mid-pagination", () => {
  it("propagates fetchPage rejection on second page", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [{ deliveryId: "d1", eventType: "pull_request", payload: {} }],
      nextCursor: { page: 2 },
      rawCount: 1,
    });
    mockConnector.fetchPage.mockRejectedValueOnce(new Error("API timeout"));
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("API timeout");
  });
});

describe("rate limit injection", () => {
  it("remaining < limit * 0.1 → step.sleep called", async () => {
    const futureResetAt = new Date(Date.now() + 60_000);
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [],
      nextCursor: null,
      rawCount: 0,
      rateLimit: {
        remaining: 5,
        limit: 5000,
        resetAt: futureResetAt,
      },
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.sleep).toHaveBeenCalled();
  });

  it("remaining >= limit * 0.1 → step.sleep not called", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [],
      nextCursor: null,
      rawCount: 0,
      rateLimit: {
        remaining: 500,
        limit: 5000,
        resetAt: new Date(Date.now() + 60_000),
      },
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(step.sleep).not.toHaveBeenCalled();
  });
});

describe("completion", () => {
  it("returns correct stats with eventsProduced and eventsDispatched", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: {} },
        { deliveryId: "d2", eventType: "pull_request", payload: {} },
      ],
      nextCursor: null,
      rawCount: 2,
    });
    const step = makeStep();

    const result = (await capturedHandler({ event: makeEvent(), step })) as Record<string, unknown>;
    expect(result).toEqual({
      entityType: "pull_request",
      resource: "123",
      eventsProduced: 2,
      eventsDispatched: 2,
      pagesProcessed: 1,
    });
  });

  it("multi-page counts are accurate", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: {} },
        { deliveryId: "d2", eventType: "pull_request", payload: {} },
        { deliveryId: "d3", eventType: "pull_request", payload: {} },
      ],
      nextCursor: { page: 2 },
      rawCount: 3,
    });
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d4", eventType: "pull_request", payload: {} },
        { deliveryId: "d5", eventType: "pull_request", payload: {} },
      ],
      nextCursor: null,
      rawCount: 2,
    });
    const step = makeStep();

    const result = (await capturedHandler({ event: makeEvent(), step })) as Record<string, unknown>;
    expect(result.eventsProduced).toBe(5);
    expect(result.eventsDispatched).toBe(5);
    expect(result.pagesProcessed).toBe(2);
  });
});

describe("holdForReplay", () => {
  it("passes holdForReplay: true to relay.dispatchWebhook", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
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
      true, // holdForReplay
    );
  });

  it("passes holdForReplay: undefined when not set", async () => {
    mockConnector.fetchPage.mockResolvedValueOnce({
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
      undefined, // holdForReplay not set
    );
  });
});

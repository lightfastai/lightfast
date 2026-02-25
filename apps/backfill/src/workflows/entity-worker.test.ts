import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Capture handler and onFailure from createFunction ──

let capturedHandler: (args: { event: any; step: any }) => Promise<unknown>;
let capturedOnFailure: ((args: { error: any; event: any; step: any }) => Promise<unknown>) | undefined;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      config: any,
      _trigger: unknown,
      handler: typeof capturedHandler,
    ) => {
      capturedHandler = handler;
      if (config.onFailure) {
        capturedOnFailure = config.onFailure;
      }
      return { id: "mock-entity-worker" };
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
await import("./entity-worker");

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
    waitForEvent: vi.fn().mockResolvedValue(null),
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

function mockTokenResponse(token = "tok-1") {
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ accessToken: token, provider: "github", expiresIn: 3600 }),
      { status: 200 },
    ),
  );
}

function mockDispatchResponse() {
  mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConnector.mockReturnValue(mockConnector);
  mockConnector.fetchPage.mockReset();
});

// ── Tests ──

describe("get-token step", () => {
  it("fetches token from Connections API and proceeds", async () => {
    mockTokenResponse();
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [],
      nextCursor: null,
      rawCount: 0,
    });
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://connections.test/connections/inst-1/token",
      { headers: { "X-API-Key": "test-key" } },
    );
  });

  it("throws when Connections API returns 401", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("Gateway getToken failed: 401");
  });
});

describe("connector resolution", () => {
  it("throws when getConnector returns null", async () => {
    mockTokenResponse();
    mockGetConnector.mockReturnValue(null);
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("No backfill connector for provider");
  });
});

describe("pagination loop — single page", () => {
  it("3 events with nextCursor: null → 3 dispatches, loop exits", async () => {
    mockTokenResponse();
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
        { deliveryId: "d2", eventType: "pull_request", payload: { pr: 2 } },
        { deliveryId: "d3", eventType: "pull_request", payload: { pr: 3 } },
      ],
      nextCursor: null,
      rawCount: 3,
    });
    // Mock 3 dispatch fetch calls (one per event)
    mockDispatchResponse();
    mockDispatchResponse();
    mockDispatchResponse();
    const step = makeStep();

    const result = (await capturedHandler({ event: makeEvent(), step })) as Record<string, unknown>;
    expect(result.eventsDispatched).toBe(3);
    expect(result.pagesProcessed).toBe(1);
  });

  it("dispatches to correct Gateway URL with correct body shape", async () => {
    mockTokenResponse();
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
      ],
      nextCursor: null,
      rawCount: 1,
    });
    mockDispatchResponse();
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    // Find the dispatch fetch call (second call — first is token)
    const dispatchCall = mockFetch.mock.calls.find(
      (call) => (call[0] as string).includes("/webhooks/"),
    );
    expect(dispatchCall).toBeDefined();
    expect(dispatchCall![0]).toBe("https://gateway.test/webhooks/github");
    const init = dispatchCall![1] as RequestInit;
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("test-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body).toHaveProperty("connectionId", "inst-1");
    expect(body).toHaveProperty("orgId", "org-1");
    expect(body).toHaveProperty("deliveryId", "d1");
    expect(body).toHaveProperty("eventType", "pull_request");
    expect(body).toHaveProperty("payload");
    expect(typeof body.receivedAt).toBe("number");
  });
});

describe("pagination loop — multiple pages", () => {
  it("two pages → 2 fetch steps, cursor passed correctly", async () => {
    mockTokenResponse();
    // Page 1
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [{ deliveryId: "d1", eventType: "pull_request", payload: {} }],
      nextCursor: { page: 2 },
      rawCount: 1,
    });
    mockDispatchResponse();
    // Page 2
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [{ deliveryId: "d2", eventType: "pull_request", payload: {} }],
      nextCursor: null,
      rawCount: 1,
    });
    mockDispatchResponse();
    const step = makeStep();

    const result = (await capturedHandler({ event: makeEvent(), step })) as Record<string, unknown>;
    expect(result.pagesProcessed).toBe(2);
    expect(result.eventsDispatched).toBe(2);

    // Verify cursor passed to second fetchPage call
    const secondFetchCall = mockConnector.fetchPage.mock.calls[1]!;
    expect(secondFetchCall[2]).toEqual({ page: 2 });
  });
});

describe("fetchPage error mid-pagination", () => {
  it("propagates fetchPage rejection on second page", async () => {
    mockTokenResponse();
    // Page 1 succeeds
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [{ deliveryId: "d1", eventType: "pull_request", payload: {} }],
      nextCursor: { page: 2 },
      rawCount: 1,
    });
    mockDispatchResponse();
    // Page 2 throws
    mockConnector.fetchPage.mockRejectedValueOnce(new Error("API timeout"));
    const step = makeStep();

    await expect(
      capturedHandler({ event: makeEvent(), step }),
    ).rejects.toThrow("API timeout");
  });
});

describe("rate limit injection", () => {
  it("remaining < limit * 0.1 → step.sleep called", async () => {
    mockTokenResponse();
    const futureResetAt = new Date(Date.now() + 60_000); // 60s from now
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
    mockTokenResponse();
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

describe("onFailure handler", () => {
  it("sends entity.completed event with success: false", async () => {
    expect(capturedOnFailure).toBeDefined();
    const step = makeStep();
    const failureEvent = {
      data: {
        event: {
          data: {
            installationId: "inst-1",
            provider: "github",
            entityType: "pull_request",
            resource: { providerResourceId: "123" },
          },
        },
      },
    };
    const error = new Error("something broke");

    await capturedOnFailure!({ error, event: failureEvent, step });

    expect(step.sendEvent).toHaveBeenCalledOnce();
    const [stepName, eventPayload] = step.sendEvent.mock.calls[0]!;
    expect(stepName).toBe("notify-failure");
    expect(eventPayload).toMatchObject({
      name: "apps-backfill/entity.completed",
      data: {
        installationId: "inst-1",
        provider: "github",
        entityType: "pull_request",
        resourceId: "123",
        success: false,
        eventsProduced: 0,
        eventsDispatched: 0,
        pagesProcessed: 0,
        error: "something broke",
      },
    });
  });
});

describe("completion", () => {
  it("sends entity.completed event with success: true and correct counts", async () => {
    mockTokenResponse();
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: {} },
        { deliveryId: "d2", eventType: "pull_request", payload: {} },
      ],
      nextCursor: null,
      rawCount: 2,
    });
    mockDispatchResponse();
    mockDispatchResponse();
    const step = makeStep();

    await capturedHandler({ event: makeEvent(), step });

    // Find the sendEvent call for notify-completion
    const sendCalls = step.sendEvent.mock.calls;
    const completionCall = sendCalls.find(
      (call: unknown[]) => call[0] === "notify-completion",
    );
    expect(completionCall).toBeDefined();
    expect(completionCall![1]).toMatchObject({
      name: "apps-backfill/entity.completed",
      data: {
        installationId: "inst-1",
        provider: "github",
        entityType: "pull_request",
        resourceId: "123",
        success: true,
        eventsProduced: 2,
        eventsDispatched: 2,
        pagesProcessed: 1,
      },
    });
  });

  it("multi-page counts are accurate", async () => {
    mockTokenResponse();
    // Page 1: 3 events
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: {} },
        { deliveryId: "d2", eventType: "pull_request", payload: {} },
        { deliveryId: "d3", eventType: "pull_request", payload: {} },
      ],
      nextCursor: { page: 2 },
      rawCount: 3,
    });
    mockDispatchResponse();
    mockDispatchResponse();
    mockDispatchResponse();
    // Page 2: 2 events
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d4", eventType: "pull_request", payload: {} },
        { deliveryId: "d5", eventType: "pull_request", payload: {} },
      ],
      nextCursor: null,
      rawCount: 2,
    });
    mockDispatchResponse();
    mockDispatchResponse();
    const step = makeStep();

    const result = (await capturedHandler({ event: makeEvent(), step })) as Record<string, unknown>;
    expect(result.eventsProduced).toBe(5);
    expect(result.eventsDispatched).toBe(5);
    expect(result.pagesProcessed).toBe(2);
  });
});

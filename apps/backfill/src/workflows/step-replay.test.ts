import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Journal types ──

type JournalEntry = {
  name: string;
  type: "run" | "sendEvent" | "waitForEvent" | "sleep";
  returnValue: unknown;
};

/**
 * Creates a step that executes callbacks normally AND records a journal
 * of (stepName, type, returnValue) entries. Used for the "first pass".
 */
function createRecordingStep(
  waitForEventResults: Record<string, unknown> = {},
) {
  const journal: JournalEntry[] = [];

  const step = {
    run: vi.fn(async (name: string, fn: () => unknown) => {
      const returnValue = await fn();
      journal.push({ name, type: "run", returnValue });
      return returnValue;
    }),
    sendEvent: vi.fn(async (name: string, _data: unknown) => {
      journal.push({ name, type: "sendEvent", returnValue: undefined });
    }),
    waitForEvent: vi.fn(async (name: string, _opts: unknown) => {
      const returnValue = waitForEventResults[name] ?? null;
      journal.push({ name, type: "waitForEvent", returnValue });
      return returnValue;
    }),
    sleep: vi.fn(async (name: string) => {
      journal.push({ name, type: "sleep", returnValue: undefined });
    }),
  };

  return { step, journal };
}

/**
 * Creates a step that returns memoized values from the journal WITHOUT
 * executing callbacks. Throws on step name mismatch (detects ordering bugs).
 * Used for the "second pass".
 */
function createReplayStep(journal: JournalEntry[]) {
  let index = 0;

  function consume(expectedName: string, expectedType: JournalEntry["type"]) {
    const entry = journal[index++];
    if (!entry || entry.name !== expectedName || entry.type !== expectedType) {
      throw new Error(
        `Step replay mismatch at index ${index - 1}: ` +
          `expected ${entry?.type}("${entry?.name}"), ` +
          `got ${expectedType}("${expectedName}")`,
      );
    }
    return entry.returnValue;
  }

  return {
    run: vi.fn(async (name: string, _fn: () => unknown) =>
      consume(name, "run"),
    ),
    sendEvent: vi.fn(async (name: string, _data: unknown) => {
      consume(name, "sendEvent");
    }),
    waitForEvent: vi.fn(async (name: string, _opts: unknown) =>
      consume(name, "waitForEvent"),
    ),
    sleep: vi.fn(async (name: string, _duration: unknown) => {
      consume(name, "sleep");
    }),
  };
}

// ── Module mocks ──

const handlers: Record<
  string,
  (args: { event: any; step: any }) => Promise<unknown>
> = {};

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      config: { id: string; onFailure?: Function },
      _trigger: unknown,
      handler: (args: { event: any; step: any }) => Promise<unknown>,
    ) => {
      handlers[config.id] = handler;
      return { id: config.id };
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

// Force module load to capture handlers
await import("./entity-worker");
await import("./backfill-orchestrator");

// ── Shared fixtures ──

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
});

// ── Entity Worker: Step Memoization Replay ──

describe("entity-worker step memoization replay", () => {
  function makeEntityEvent() {
    return {
      data: {
        installationId: "inst-1",
        provider: "github",
        orgId: "org-1",
        entityType: "pull_request",
        resource: { providerResourceId: "100", resourceName: "owner/repo" },
        since: "2026-01-01T00:00:00.000Z",
      },
    };
  }

  function setupRecordingMocks() {
    // Token fetch
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: "tok-1",
          provider: "github",
          expiresIn: 3600,
        }),
        { status: 200 },
      ),
    );
    // fetchPage: 3 events, single page
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
        { deliveryId: "d2", eventType: "pull_request", payload: { pr: 2 } },
        { deliveryId: "d3", eventType: "pull_request", payload: { pr: 3 } },
      ],
      nextCursor: null,
      rawCount: 3,
    });
    // 3 dispatch responses
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
  }

  it("replay produces identical result to recording (single page)", async () => {
    const handler = handlers["apps-backfill/entity.worker"]!;

    // ── Recording pass ──
    setupRecordingMocks();
    const { step: recordingStep, journal } = createRecordingStep();
    const recordResult = await handler({
      event: makeEntityEvent(),
      step: recordingStep,
    });

    // ── Replay pass (only getConnector needed — it runs outside step callbacks) ──
    vi.clearAllMocks();
    mockGetConnector.mockReturnValue(mockConnector);
    const replayStep = createReplayStep(journal);
    const replayResult = await handler({
      event: makeEntityEvent(),
      step: replayStep,
    });

    // ── Assert identical results ──
    expect(replayResult).toEqual(recordResult);
    // Sanity: the counts are non-zero
    expect((recordResult as any).eventsDispatched).toBe(3);
    expect((recordResult as any).eventsProduced).toBe(3);
  });

  it("replay produces identical result to recording (multi-page)", async () => {
    const handler = handlers["apps-backfill/entity.worker"]!;

    // ── Recording pass ──
    // Token fetch
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: "tok-1",
          provider: "github",
          expiresIn: 3600,
        }),
        { status: 200 },
      ),
    );
    // Page 1: 2 events
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
        { deliveryId: "d2", eventType: "pull_request", payload: { pr: 2 } },
      ],
      nextCursor: { page: 2 },
      rawCount: 2,
    });
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    // Page 2: 1 event
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [
        { deliveryId: "d3", eventType: "pull_request", payload: { pr: 3 } },
      ],
      nextCursor: null,
      rawCount: 1,
    });
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const { step: recordingStep, journal } = createRecordingStep();
    const recordResult = await handler({
      event: makeEntityEvent(),
      step: recordingStep,
    });

    // ── Replay pass ──
    vi.clearAllMocks();
    mockGetConnector.mockReturnValue(mockConnector);
    const replayStep = createReplayStep(journal);
    const replayResult = await handler({
      event: makeEntityEvent(),
      step: replayStep,
    });

    // ── Assert identical results ──
    expect(replayResult).toEqual(recordResult);
    expect((recordResult as any).eventsDispatched).toBe(3);
    expect((recordResult as any).pagesProcessed).toBe(2);
  });
});

// ── Orchestrator: Step Memoization Replay ──

describe("orchestrator step memoization replay", () => {
  function makeOrchestratorEvent() {
    return {
      data: {
        installationId: "inst-1",
        provider: "github",
        orgId: "org-1",
        depth: 30,
        entityTypes: ["pull_request"],
      },
    };
  }

  it("replay produces identical result to recording", async () => {
    const handler = handlers["apps-backfill/run.orchestrator"]!;

    // ── Recording pass ──
    // Mock: connection fetch
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "inst-1",
          provider: "github",
          externalId: "12345",
          orgId: "org-1",
          status: "active",
          resources: [
            {
              id: "r1",
              providerResourceId: "100",
              resourceName: "owner/repo",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    // Configure waitForEvent to return a successful completion
    const waitResults = {
      "wait-100-pull_request": {
        data: {
          installationId: "inst-1",
          provider: "github",
          entityType: "pull_request",
          resourceId: "100",
          success: true,
          eventsProduced: 10,
          eventsDispatched: 10,
          pagesProcessed: 1,
        },
      },
    };

    const { step: recordingStep, journal } =
      createRecordingStep(waitResults);
    const recordResult = await handler({
      event: makeOrchestratorEvent(),
      step: recordingStep,
    });

    // ── Replay pass (getConnector runs outside step callbacks) ──
    vi.clearAllMocks();
    mockGetConnector.mockReturnValue(mockConnector);
    const replayStep = createReplayStep(journal);
    const replayResult = await handler({
      event: makeOrchestratorEvent(),
      step: replayStep,
    });

    // ── Assert identical results ──
    expect(replayResult).toEqual(recordResult);
    // Sanity: the result reflects the completion data
    expect((recordResult as any).success).toBe(true);
    expect((recordResult as any).eventsProduced).toBe(10);
    expect((recordResult as any).eventsDispatched).toBe(10);
  });

  it("replay produces identical result with mixed success/failure", async () => {
    const handler = handlers["apps-backfill/run.orchestrator"]!;

    // ── Recording pass ──
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "inst-1",
          provider: "github",
          externalId: "12345",
          orgId: "org-1",
          status: "active",
          resources: [
            {
              id: "r1",
              providerResourceId: "100",
              resourceName: "owner/repo-a",
            },
            {
              id: "r2",
              providerResourceId: "200",
              resourceName: "owner/repo-b",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const waitResults = {
      "wait-100-pull_request": {
        data: {
          installationId: "inst-1",
          provider: "github",
          entityType: "pull_request",
          resourceId: "100",
          success: true,
          eventsProduced: 5,
          eventsDispatched: 5,
          pagesProcessed: 1,
        },
      },
      "wait-200-pull_request": {
        data: {
          installationId: "inst-1",
          provider: "github",
          entityType: "pull_request",
          resourceId: "200",
          success: false,
          eventsProduced: 0,
          eventsDispatched: 0,
          pagesProcessed: 0,
          error: "rate limited",
        },
      },
    };

    const { step: recordingStep, journal } =
      createRecordingStep(waitResults);
    const recordResult = await handler({
      event: makeOrchestratorEvent(),
      step: recordingStep,
    });

    // ── Replay pass ──
    vi.clearAllMocks();
    mockGetConnector.mockReturnValue(mockConnector);
    const replayStep = createReplayStep(journal);
    const replayResult = await handler({
      event: makeOrchestratorEvent(),
      step: replayStep,
    });

    // ── Assert identical results ──
    expect(replayResult).toEqual(recordResult);
    expect((recordResult as any).success).toBe(false);
    expect((recordResult as any).failed).toBe(1);
    expect((recordResult as any).completed).toBe(1);
  });
});

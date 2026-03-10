import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Journal types ──

interface JournalEntry {
  name: string;
  returnValue: unknown;
  type: "run" | "sendEvent" | "invoke" | "sleep";
}

/**
 * Creates a step that executes callbacks normally AND records a journal
 * of (stepName, type, returnValue) entries. Used for the "first pass".
 */
function createRecordingStep(invokeResults: Record<string, unknown> = {}) {
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
    invoke: vi.fn(async (name: string, _opts: unknown) => {
      const returnValue = invokeResults[name] ?? null;
      journal.push({ name, type: "invoke", returnValue });
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
          `expected ${expectedType}("${expectedName}"), ` +
          `got ${entry?.type}("${entry?.name}")`
      );
    }
    return entry.returnValue;
  }

  return {
    run: vi.fn(async (name: string, _fn: () => unknown) =>
      consume(name, "run")
    ),
    sendEvent: vi.fn(async (name: string, _data: unknown) => {
      consume(name, "sendEvent");
    }),
    invoke: vi.fn(async (name: string, _opts: unknown) =>
      consume(name, "invoke")
    ),
    sleep: vi.fn(async (name: string, _duration: unknown) => {
      consume(name, "sleep");
    }),
  };
}

// ── Result interfaces (for typed assertions without as any) ──

interface WorkerResult {
  eventsDispatched: number;
  eventsProduced: number;
  pagesProcessed: number;
}

interface OrchestratorResult {
  completed: number;
  eventsDispatched: number;
  eventsProduced: number;
  failed: number;
  success: boolean;
}

// ── Module mocks ──

// SAFETY: Test infrastructure — captures Inngest createFunction handlers with
// loose typing. The handler signature matches at runtime; full Inngest types
// would require importing internal generics not exposed in the public API.
const handlers: Record<
  string,
  (args: { event: any; step: any }) => Promise<unknown>
> = {};

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      config: { id: string },
      _trigger: unknown,
      // SAFETY: Test infrastructure — captures Inngest createFunction handlers with
      // loose typing. The handler signature matches at runtime; full Inngest types
      // would require importing internal generics not exposed in the public API.
      handler: (args: { event: any; step: any }) => Promise<unknown>
    ) => {
      handlers[config.id] = handler;
      return { id: config.id };
    },
  },
}));

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

const mockGatewayClient = {
  getConnection: vi.fn(),
  getToken: vi.fn(),
  getBackfillRuns: vi.fn().mockResolvedValue([]),
  upsertBackfillRun: vi.fn().mockResolvedValue(undefined),
  executeApi: vi.fn(),
};

const mockRelayClient = {
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
  replayCatchup: vi.fn().mockResolvedValue({ remaining: 0 }),
};
vi.mock("@repo/gateway-service-clients", () => ({
  createGatewayClient: () => mockGatewayClient,
  createRelayClient: () => mockRelayClient,
}));

vi.mock("../env", () => ({
  env: { GATEWAY_API_KEY: "test-key" },
}));

// Force module load to capture handlers
// Entity worker must be loaded first so orchestrator's import finds it in cache
await import("./entity-worker.js");
await import("./backfill-orchestrator.js");

// ── Shared fixtures ──

beforeEach(() => {
  vi.resetAllMocks();
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
  mockGatewayClient.getConnection.mockResolvedValue({
    id: "inst-1",
    provider: "github",
    externalId: "12345",
    orgId: "org-1",
    status: "active",
    resources: [
      { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
    ],
  });
  mockGatewayClient.getBackfillRuns.mockResolvedValue([]);
  mockGatewayClient.upsertBackfillRun.mockResolvedValue(undefined);
  mockRelayClient.dispatchWebhook.mockResolvedValue(undefined);
  mockRelayClient.replayCatchup.mockResolvedValue({ remaining: 0 });
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
    // executeApi: return raw response data
    mockGatewayClient.executeApi.mockResolvedValueOnce({
      status: 200,
      data: ["d1", "d2", "d3"],
      headers: {},
    });
    // processResponse: 3 events, single page
    mockProcessResponse.mockReturnValueOnce({
      events: [
        { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
        { deliveryId: "d2", eventType: "pull_request", payload: { pr: 2 } },
        { deliveryId: "d3", eventType: "pull_request", payload: { pr: 3 } },
      ],
      nextCursor: null,
      rawCount: 3,
    });
    // 3 dispatch responses (via relay client)
    mockRelayClient.dispatchWebhook
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
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

    // ── Replay pass (only getProvider needed — it runs outside step callbacks) ──
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
    const replayStep = createReplayStep(journal);
    const replayResult = await handler({
      event: makeEntityEvent(),
      step: replayStep,
    });

    // ── Assert identical results ──
    expect(replayResult).toEqual(recordResult);
    // Sanity: the counts are non-zero
    const workerResult = recordResult as WorkerResult;
    expect(workerResult.eventsDispatched).toBe(3);
    expect(workerResult.eventsProduced).toBe(3);
  });

  it("replay produces identical result to recording (multi-page)", async () => {
    const handler = handlers["apps-backfill/entity.worker"]!;

    // ── Recording pass ──
    // Page 1: 2 events
    mockGatewayClient.executeApi
      .mockResolvedValueOnce({ status: 200, data: ["d1", "d2"], headers: {} })
      .mockResolvedValueOnce({ status: 200, data: ["d3"], headers: {} });
    mockProcessResponse
      .mockReturnValueOnce({
        events: [
          { deliveryId: "d1", eventType: "pull_request", payload: { pr: 1 } },
          { deliveryId: "d2", eventType: "pull_request", payload: { pr: 2 } },
        ],
        nextCursor: { page: 2 },
        rawCount: 2,
      })
      .mockReturnValueOnce({
        events: [
          { deliveryId: "d3", eventType: "pull_request", payload: { pr: 3 } },
        ],
        nextCursor: null,
        rawCount: 1,
      });
    mockRelayClient.dispatchWebhook
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const { step: recordingStep, journal } = createRecordingStep();
    const recordResult = await handler({
      event: makeEntityEvent(),
      step: recordingStep,
    });

    // ── Replay pass ──
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
    const replayStep = createReplayStep(journal);
    const replayResult = await handler({
      event: makeEntityEvent(),
      step: replayStep,
    });

    // ── Assert identical results ──
    expect(replayResult).toEqual(recordResult);
    const workerResult = recordResult as WorkerResult;
    expect(workerResult.eventsDispatched).toBe(3);
    expect(workerResult.pagesProcessed).toBe(2);
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

    // Configure invoke to return a successful completion
    const invokeResults = {
      "invoke-100-pull_request": {
        entityType: "pull_request",
        resource: "100",
        eventsProduced: 10,
        eventsDispatched: 10,
        pagesProcessed: 1,
      },
    };

    const { step: recordingStep, journal } = createRecordingStep(invokeResults);
    const recordResult = await handler({
      event: makeOrchestratorEvent(),
      step: recordingStep,
    });

    // ── Replay pass (getProvider runs outside step callbacks) ──
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
    const replayStep = createReplayStep(journal);
    const replayResult = await handler({
      event: makeOrchestratorEvent(),
      step: replayStep,
    });

    // ── Assert identical results ──
    expect(replayResult).toEqual(recordResult);
    // Sanity: the result reflects the completion data
    const orchResult = recordResult as OrchestratorResult;
    expect(orchResult.success).toBe(true);
    expect(orchResult.eventsProduced).toBe(10);
    expect(orchResult.eventsDispatched).toBe(10);
  });

  it("replay produces identical result with mixed success/failure", async () => {
    const handler = handlers["apps-backfill/run.orchestrator"]!;

    // 2 resources — need 2 invoke results
    mockGatewayClient.getConnection.mockResolvedValue({
      id: "inst-1",
      provider: "github",
      externalId: "12345",
      orgId: "org-1",
      status: "active",
      resources: [
        { id: "r1", providerResourceId: "100", resourceName: "owner/repo-a" },
        { id: "r2", providerResourceId: "200", resourceName: "owner/repo-b" },
      ],
    });

    // First invoke succeeds, second throws (to simulate failure path)
    // In recording, invoke-200-pull_request will throw → returns null from our mock
    const invokeResults = {
      "invoke-100-pull_request": {
        entityType: "pull_request",
        resource: "100",
        eventsProduced: 5,
        eventsDispatched: 5,
        pagesProcessed: 1,
      },
      // invoke-200-pull_request not in results → returns null → caught as failure
    };

    const { step: recordingStep, journal } = createRecordingStep(invokeResults);
    const recordResult = await handler({
      event: makeOrchestratorEvent(),
      step: recordingStep,
    });

    // ── Replay pass ──
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
    // Reset connection mock for replay
    mockGatewayClient.getConnection.mockResolvedValue({
      id: "inst-1",
      provider: "github",
      externalId: "12345",
      orgId: "org-1",
      status: "active",
      resources: [
        { id: "r1", providerResourceId: "100", resourceName: "owner/repo-a" },
        { id: "r2", providerResourceId: "200", resourceName: "owner/repo-b" },
      ],
    });
    const replayStep = createReplayStep(journal);
    const replayResult = await handler({
      event: makeOrchestratorEvent(),
      step: replayStep,
    });

    // ── Assert identical results ──
    expect(replayResult).toEqual(recordResult);
    const orchResult = recordResult as OrchestratorResult;
    expect(orchResult.success).toBe(false);
    expect(orchResult.failed).toBe(1);
    expect(orchResult.completed).toBe(1);
  });
});

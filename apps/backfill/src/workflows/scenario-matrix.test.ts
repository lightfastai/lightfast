/**
 * Invariant Matrix Testing
 *
 * Instead of handcrafting individual test cases, defines scenario dimensions
 * as typed arrays, computes their cartesian product, and runs every combination
 * against universal invariants. This catches edge cases humans would never
 * think to write.
 *
 * Entity worker: 48 scenarios (3 × 4 × 2 × 2)
 * Orchestrator:  108 scenarios (3 × 2 × 3 × 3 × 2)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Types ──

interface EntityWorkerScenario {
  eventsPerPage: number;
  fetchFailsOnPage: number | null;
  pageCount: number;
  rateLimitNearThreshold: boolean;
}

interface OrchestratorScenario {
  entityTypes: readonly string[];
  gapCoverage: "none" | "partial" | "full";
  holdForReplay: boolean;
  resourceCount: number;
  workerOutcomes: "all-success" | "all-fail" | "mixed";
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

    // Increment indices (odometer pattern)
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

// ── Scenario label generator ──

function ewLabel(s: EntityWorkerScenario): string {
  return `p=${s.pageCount} e=${s.eventsPerPage} rl=${s.rateLimitNearThreshold} fail=${s.fetchFailsOnPage}`;
}

function orchLabel(s: OrchestratorScenario): string {
  const et = s.entityTypes.length === 1 ? "1et" : "3et";
  return `r=${s.resourceCount} ${et} gap=${s.gapCoverage} out=${s.workerOutcomes} hold=${s.holdForReplay}`;
}

// ── Mock declarations ──

// SAFETY: Test infrastructure — captures Inngest createFunction handlers with
// loose typing. The handler signature matches at runtime.
const handlers: Record<
  string,
  (args: { event: any; step: any }) => Promise<unknown>
> = {};

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      config: { id: string },
      _trigger: unknown,
      handler: (args: { event: any; step: any }) => Promise<unknown>
    ) => {
      handlers[config.id] = handler;
      return { id: config.id };
    },
  },
}));

const mockGatewayClient = {
  getConnection: vi.fn(),
  getBackfillRuns: vi.fn().mockResolvedValue([]),
  upsertBackfillRun: vi.fn().mockResolvedValue(undefined),
  executeApi: vi.fn(),
};

const mockRelayClient = {
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
  replayCatchup: vi.fn().mockResolvedValue({ remaining: 0 }),
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

const mockBuildRequest = vi.fn().mockReturnValue({});
const mockProcessResponse = vi.fn();
const mockParseRateLimit = vi.fn().mockReturnValue(null);

const mockProvider = {
  api: { parseRateLimit: mockParseRateLimit },
  backfill: {
    supportedEntityTypes: ["pull_request", "issue", "release"],
    defaultEntityTypes: ["pull_request", "issue", "release"],
    entityTypes: {
      pull_request: {
        endpointId: "list-pull-requests",
        buildRequest: mockBuildRequest,
        processResponse: mockProcessResponse,
      },
      issue: {
        endpointId: "list-issues",
        buildRequest: mockBuildRequest,
        processResponse: mockProcessResponse,
      },
      release: {
        endpointId: "list-releases",
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

// Force module load to capture handlers (entity-worker first for orchestrator import)
await import("./entity-worker.js");
await import("./backfill-orchestrator.js");

// ── Shared setup ──

beforeEach(() => {
  vi.resetAllMocks();
  mockGetProvider.mockReturnValue(mockProvider);
  mockBuildRequest.mockReturnValue({});
  mockParseRateLimit.mockReturnValue(null);
  mockGatewayClient.upsertBackfillRun.mockResolvedValue(undefined);
  mockRelayClient.dispatchWebhook.mockResolvedValue(undefined);
  mockRelayClient.replayCatchup.mockResolvedValue({ remaining: 0 });
});

// ══════════════════════════════════════════════════════════════════════════════
// Entity Worker Matrix — 48 scenarios, 5 invariants each
// ══════════════════════════════════════════════════════════════════════════════

const entityWorkerDims = {
  pageCount: [1, 3, 5] as const,
  eventsPerPage: [0, 1, 5, 12] as const,
  rateLimitNearThreshold: [true, false] as const,
  fetchFailsOnPage: [null, 2] as const,
};

const entityWorkerScenarios = cartesian(
  entityWorkerDims
) as EntityWorkerScenario[];

function configureEntityWorkerMocks(s: EntityWorkerScenario) {
  let pageTracker = 0;

  mockGatewayClient.executeApi.mockImplementation(async () => {
    pageTracker++;
    if (s.fetchFailsOnPage === pageTracker) {
      throw new Error("Provider API returned 500");
    }
    return { status: 200, data: [], headers: {} };
  });

  mockProcessResponse.mockImplementation(() => {
    const isLastPage = pageTracker >= s.pageCount;
    const events = Array.from({ length: s.eventsPerPage }, (_, i) => ({
      deliveryId: `d-p${pageTracker}-${i}`,
      eventType: "pull_request",
      payload: { n: i },
    }));
    return {
      events,
      nextCursor: isLastPage ? null : { page: pageTracker + 1 },
      rawCount: s.eventsPerPage,
    };
  });

  mockParseRateLimit.mockImplementation(() => {
    if (!s.rateLimitNearThreshold) {
      return null;
    }
    return {
      remaining: 5,
      limit: 5000,
      resetAt: new Date(Date.now() + 60_000),
    };
  });
}

function makeEntityWorkerEvent() {
  return {
    data: {
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      entityType: "pull_request",
      resource: { providerResourceId: "100", resourceName: "owner/repo" },
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      depth: 30,
    },
  };
}

function makeEntityWorkerStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
  };
}

describe("entity-worker invariant matrix", () => {
  it.each(
    entityWorkerScenarios.map((s) => [ewLabel(s), s] as const)
  )("%s", async (_label, scenario) => {
    configureEntityWorkerMocks(scenario);
    const step = makeEntityWorkerStep();
    const handler = handlers["apps-backfill/entity.worker"]!;

    const shouldFail =
      scenario.fetchFailsOnPage !== null &&
      scenario.fetchFailsOnPage <= scenario.pageCount;
    const successfulPages = shouldFail
      ? scenario.fetchFailsOnPage! - 1
      : scenario.pageCount;

    let result: Record<string, unknown> | null = null;
    let error: Error | null = null;

    try {
      result = (await handler({
        event: makeEntityWorkerEvent(),
        step,
      })) as Record<string, unknown>;
    } catch (err) {
      error = err as Error;
    }

    if (shouldFail) {
      // Invariant 4: handler rejects on fetch failure
      expect(error).not.toBeNull();
      // Partial progress: dispatches happened for pages before failure
      expect(mockRelayClient.dispatchWebhook).toHaveBeenCalledTimes(
        successfulPages * scenario.eventsPerPage
      );
    } else {
      // Invariant 1: eventsDispatched === sum(events)
      expect(result!.eventsDispatched).toBe(
        successfulPages * scenario.eventsPerPage
      );
      // Invariant 2: pagesProcessed === successful page count
      expect(result!.pagesProcessed).toBe(successfulPages);
      // Invariant 3: eventsProduced === sum(rawCount)
      expect(result!.eventsProduced).toBe(
        successfulPages * scenario.eventsPerPage
      );
    }

    // Invariant 5: rate limit sleep called iff near threshold and pages succeeded
    if (scenario.rateLimitNearThreshold && successfulPages > 0) {
      expect(step.sleep).toHaveBeenCalledTimes(successfulPages);
    } else {
      expect(step.sleep).not.toHaveBeenCalled();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Orchestrator Matrix — 108 scenarios, 7 invariants each
// ══════════════════════════════════════════════════════════════════════════════

const orchestratorDims = {
  resourceCount: [0, 1, 3] as const,
  entityTypes: [
    ["pull_request"],
    ["pull_request", "issue", "release"],
  ] as const,
  gapCoverage: ["none", "partial", "full"] as const,
  workerOutcomes: ["all-success", "all-fail", "mixed"] as const,
  holdForReplay: [true, false] as const,
};

const orchestratorScenarios = cartesian(
  orchestratorDims
) as unknown as OrchestratorScenario[];

function configureOrchestratorMocks(s: OrchestratorScenario) {
  // Connection with N resources
  mockGatewayClient.getConnection.mockResolvedValue({
    id: "inst-1",
    provider: "github",
    externalId: "12345",
    orgId: "org-1",
    status: "active",
    resources: Array.from({ length: s.resourceCount }, (_, i) => ({
      id: `r${i + 1}`,
      providerResourceId: `${(i + 1) * 100}`,
      resourceName: `owner/repo-${i + 1}`,
    })),
  });

  // Gap history
  const coveredEntityTypes =
    s.gapCoverage === "none"
      ? []
      : s.gapCoverage === "partial"
        ? [s.entityTypes[0]]
        : s.entityTypes;
  mockGatewayClient.getBackfillRuns.mockResolvedValue(
    coveredEntityTypes.map((et) => ({
      entityType: et,
      since: "2020-01-01T00:00:00Z",
      depth: 90,
      status: "completed",
    }))
  );
}

function makeOrchestratorEvent(s: OrchestratorScenario) {
  return {
    data: {
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      depth: 30,
      entityTypes: s.entityTypes,
      holdForReplay: s.holdForReplay || undefined,
    },
  };
}

function makeOrchestratorStep(s: OrchestratorScenario) {
  const runCalls: string[] = [];
  let invokeCount = 0;

  const step = {
    run: vi.fn((name: string, fn: () => unknown) => {
      runCalls.push(name);
      return fn();
    }),
    invoke: vi.fn(() => {
      invokeCount++;
      if (s.workerOutcomes === "all-fail") {
        return Promise.reject(new Error("worker crashed"));
      }
      if (s.workerOutcomes === "mixed" && invokeCount > 1) {
        return Promise.reject(new Error("worker crashed"));
      }
      return Promise.resolve({
        eventsProduced: 10,
        eventsDispatched: 10,
        pagesProcessed: 1,
      });
    }),
    sleep: vi.fn().mockResolvedValue(undefined),
  };

  return { step, runCalls };
}

describe("orchestrator invariant matrix", () => {
  it.each(
    orchestratorScenarios.map((s) => [orchLabel(s), s] as const)
  )("%s", async (_label, scenario) => {
    configureOrchestratorMocks(scenario);
    const { step, runCalls } = makeOrchestratorStep(scenario);
    const handler = handlers["apps-backfill/run.orchestrator"]!;

    const result = (await handler({
      event: makeOrchestratorEvent(scenario),
      step,
    })) as Record<string, unknown>;

    // ── Compute expected values ──
    const workUnits = scenario.resourceCount * scenario.entityTypes.length;
    const skippedEntityTypes =
      scenario.gapCoverage === "none"
        ? 0
        : scenario.gapCoverage === "partial"
          ? 1
          : scenario.entityTypes.length;
    const skipped = scenario.resourceCount * skippedEntityTypes;
    const dispatched = workUnits - skipped;

    let expectedCompleted: number, expectedFailed: number;
    if (dispatched === 0) {
      expectedCompleted = 0;
      expectedFailed = 0;
    } else if (scenario.workerOutcomes === "all-success") {
      expectedCompleted = dispatched;
      expectedFailed = 0;
    } else if (scenario.workerOutcomes === "all-fail") {
      expectedCompleted = 0;
      expectedFailed = dispatched;
    } else {
      // mixed: first invoke succeeds, rest fail
      expectedCompleted = 1;
      expectedFailed = dispatched - 1;
    }

    // ── Invariant 1: workUnits ──
    expect(result.workUnits).toBe(workUnits);

    // ── Invariant 2: dispatched + skipped === workUnits ──
    expect(result.dispatched).toBe(dispatched);
    expect(result.skipped).toBe(skipped);

    // ── Invariant 3: completed + failed === dispatched ──
    if (dispatched > 0) {
      expect((result.completed as number) + (result.failed as number)).toBe(
        dispatched
      );
      expect(result.completed).toBe(expectedCompleted);
      expect(result.failed).toBe(expectedFailed);
    }

    // ── Invariant 4: success === (failed === 0) ──
    expect(result.success).toBe(expectedFailed === 0);

    // ── Invariant 5: eventsProduced === sum(worker results) ──
    expect(result.eventsProduced).toBe(expectedCompleted * 10);

    // ── Invariant 6: replay iff holdForReplay && succeeded > 0 ──
    const shouldReplay = scenario.holdForReplay && expectedCompleted > 0;
    if (shouldReplay) {
      expect(runCalls).toContain("replay-held-webhooks");
    } else {
      expect(runCalls).not.toContain("replay-held-webhooks");
    }

    // ── Invariant 7: persist iff dispatched > 0 ──
    if (dispatched > 0) {
      expect(runCalls).toContain("persist-run-records");
    } else {
      expect(runCalls).not.toContain("persist-run-records");
    }
  });
});

/**
 * Cross-workflow event contract tests
 *
 * Verifies that the orchestrator's waitForEvent filter expressions
 * match the actual event shapes produced by the entity worker.
 *
 * These catch the class of bug where a field is renamed on one side
 * but not the other — unit tests pass, production silently times out.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Capture handlers from both workflows ──

let orchestratorHandler: (args: { event: any; step: any }) => Promise<unknown>;
let entityWorkerHandler: (args: { event: any; step: any }) => Promise<unknown>;
let entityWorkerOnFailure: (args: { error: any; event: any; step: any }) => Promise<unknown>;

// Track createFunction calls in order: orchestrator loads first, then entity worker
const capturedFunctions: Array<{ config: any; handler: any }> = [];

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (config: any, _trigger: unknown, handler: any) => {
      capturedFunctions.push({ config, handler });
      if (config.onFailure) {
        entityWorkerOnFailure = config.onFailure;
      }
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

// Load both modules to capture handlers
await import("./backfill-orchestrator");
await import("./entity-worker");

// Assign by function ID
for (const fn of capturedFunctions) {
  if (fn.config.id === "apps-backfill/run.orchestrator") {
    orchestratorHandler = fn.handler;
  } else if (fn.config.id === "apps-backfill/entity.worker") {
    entityWorkerHandler = fn.handler;
  }
}

// ── Helpers ──

const mockConnector = {
  provider: "github",
  supportedEntityTypes: ["pull_request", "issue", "release"],
  defaultEntityTypes: ["pull_request", "issue", "release"],
  validateScopes: vi.fn(),
  fetchPage: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConnector.mockReturnValue(mockConnector);
  mockConnector.fetchPage.mockReset();
});

/**
 * Extract `async.data.*` field references from an Inngest CEL filter string.
 * e.g. "async.data.installationId == 'x' && async.data.resourceId == 'y'"
 *   → ["installationId", "resourceId"]
 */
function extractFilterFields(filterExpr: string): string[] {
  const matches = filterExpr.matchAll(/async\.data\.(\w+)/g);
  return [...matches].map((m) => m[1]!);
}

describe("orchestrator ↔ entity worker event contract", () => {
  it("waitForEvent filter fields exist on entity worker completion event", async () => {
    // ── Run orchestrator to capture the waitForEvent filter ──
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "inst-1",
          provider: "github",
          externalId: "12345",
          orgId: "org-1",
          status: "active",
          resources: [
            { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
          ],
        }),
        { status: 200 },
      ),
    );

    const waitForEventCalls: Array<{ stepName: string; opts: any }> = [];
    const orchestratorStep = {
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn((stepName: string, opts: any) => {
        waitForEventCalls.push({ stepName, opts });
        return Promise.resolve({
          data: { success: true, eventsProduced: 0, eventsDispatched: 0, pagesProcessed: 0 },
        });
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    };

    await orchestratorHandler({
      event: {
        data: {
          installationId: "inst-1",
          provider: "github",
          orgId: "org-1",
          depth: 30,
          entityTypes: ["pull_request"],
        },
      },
      step: orchestratorStep,
    });

    expect(waitForEventCalls.length).toBeGreaterThan(0);

    // ── Run entity worker to capture the completion event ──
    // Token fetch
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: "tok-1", provider: "github", expiresIn: 3600 }),
        { status: 200 },
      ),
    );
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [{ deliveryId: "d1", eventType: "pull_request", payload: {} }],
      nextCursor: null,
      rawCount: 1,
    });
    // Dispatch response
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const workerSendEventCalls: Array<[string, any]> = [];
    const workerStep = {
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn((name: string, payload: any) => {
        workerSendEventCalls.push([name, payload]);
        return Promise.resolve(undefined);
      }),
      waitForEvent: vi.fn().mockResolvedValue(null),
      sleep: vi.fn().mockResolvedValue(undefined),
    };

    await entityWorkerHandler({
      event: {
        data: {
          installationId: "inst-1",
          provider: "github",
          orgId: "org-1",
          entityType: "pull_request",
          resource: { providerResourceId: "100", resourceName: "owner/repo" },
          since: new Date().toISOString(),
          depth: 30,
        },
      },
      step: workerStep,
    });

    // Find the completion event
    const completionCall = workerSendEventCalls.find(
      ([name]) => name === "notify-completion",
    );
    expect(completionCall).toBeDefined();
    const completionData = completionCall![1].data;

    // ── The actual contract assertion ──
    // Every field referenced in the orchestrator's waitForEvent filter
    // MUST exist on the entity worker's completion event data
    for (const { opts } of waitForEventCalls) {
      const filterFields = extractFilterFields(opts.if);
      for (const field of filterFields) {
        expect(
          completionData,
          `orchestrator waitForEvent references "async.data.${field}" but entity worker completion event is missing it`,
        ).toHaveProperty(field);
      }
    }
  });

  it("waitForEvent filter fields exist on onFailure completion event", async () => {
    // ── Run orchestrator to capture waitForEvent filter (same as above) ──
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "inst-1",
          provider: "github",
          externalId: "12345",
          orgId: "org-1",
          status: "active",
          resources: [
            { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
          ],
        }),
        { status: 200 },
      ),
    );

    const waitForEventCalls: Array<{ stepName: string; opts: any }> = [];
    const orchestratorStep = {
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn((stepName: string, opts: any) => {
        waitForEventCalls.push({ stepName, opts });
        return Promise.resolve({
          data: { success: false, eventsProduced: 0, eventsDispatched: 0, pagesProcessed: 0, error: "fail" },
        });
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    };

    await orchestratorHandler({
      event: {
        data: {
          installationId: "inst-1",
          provider: "github",
          orgId: "org-1",
          depth: 30,
          entityTypes: ["pull_request"],
        },
      },
      step: orchestratorStep,
    });

    // ── Run onFailure to capture the failure completion event ──
    const failureSendCalls: Array<[string, any]> = [];
    const failureStep = {
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn((name: string, payload: any) => {
        failureSendCalls.push([name, payload]);
        return Promise.resolve(undefined);
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    };

    await entityWorkerOnFailure({
      error: new Error("something broke"),
      event: {
        data: {
          event: {
            data: {
              installationId: "inst-1",
              provider: "github",
              entityType: "pull_request",
              resource: { providerResourceId: "100" },
            },
          },
        },
      },
      step: failureStep,
    });

    const failureCompletion = failureSendCalls.find(
      ([name]) => name === "notify-failure",
    );
    expect(failureCompletion).toBeDefined();
    const failureData = failureCompletion![1].data;

    // ── Contract assertion: filter fields must exist on failure event too ──
    for (const { opts } of waitForEventCalls) {
      const filterFields = extractFilterFields(opts.if);
      for (const field of filterFields) {
        expect(
          failureData,
          `orchestrator waitForEvent references "async.data.${field}" but onFailure completion event is missing it`,
        ).toHaveProperty(field);
      }
    }
  });

  it("waitForEvent event name matches entity worker completion event name", async () => {
    // ── Orchestrator side ──
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "inst-1",
          provider: "github",
          externalId: "12345",
          orgId: "org-1",
          status: "active",
          resources: [
            { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
          ],
        }),
        { status: 200 },
      ),
    );

    let capturedEventName: string | undefined;
    const orchestratorStep = {
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn().mockResolvedValue(undefined),
      waitForEvent: vi.fn((_stepName: string, opts: any) => {
        capturedEventName = opts.event;
        return Promise.resolve({
          data: { success: true, eventsProduced: 0, eventsDispatched: 0, pagesProcessed: 0 },
        });
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    };

    await orchestratorHandler({
      event: {
        data: {
          installationId: "inst-1",
          provider: "github",
          orgId: "org-1",
          depth: 30,
          entityTypes: ["pull_request"],
        },
      },
      step: orchestratorStep,
    });

    // ── Entity worker side ──
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: "tok-1", provider: "github", expiresIn: 3600 }),
        { status: 200 },
      ),
    );
    mockConnector.fetchPage.mockResolvedValueOnce({
      events: [],
      nextCursor: null,
      rawCount: 0,
    });

    let workerCompletionEventName: string | undefined;
    const workerStep = {
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn((_name: string, payload: any) => {
        if (payload.name) workerCompletionEventName = payload.name;
        return Promise.resolve(undefined);
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    };

    await entityWorkerHandler({
      event: {
        data: {
          installationId: "inst-1",
          provider: "github",
          orgId: "org-1",
          entityType: "pull_request",
          resource: { providerResourceId: "100", resourceName: "owner/repo" },
          since: new Date().toISOString(),
          depth: 30,
        },
      },
      step: workerStep,
    });

    // The orchestrator waits for event X, the worker sends event X
    expect(capturedEventName).toBe(workerCompletionEventName);
  });

  it("fan-out event shape matches entity worker trigger schema", async () => {
    // ── Orchestrator fan-out ──
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "inst-1",
          provider: "github",
          externalId: "12345",
          orgId: "org-1",
          status: "active",
          resources: [
            { id: "r1", providerResourceId: "100", resourceName: "owner/repo" },
          ],
        }),
        { status: 200 },
      ),
    );

    let fanOutEvents: any[] = [];
    const orchestratorStep = {
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn((_name: string, events: any) => {
        fanOutEvents = events;
        return Promise.resolve(undefined);
      }),
      waitForEvent: vi.fn().mockResolvedValue({
        data: { success: true, eventsProduced: 0, eventsDispatched: 0, pagesProcessed: 0 },
      }),
      sleep: vi.fn().mockResolvedValue(undefined),
    };

    await orchestratorHandler({
      event: {
        data: {
          installationId: "inst-1",
          provider: "github",
          orgId: "org-1",
          depth: 30,
          entityTypes: ["pull_request"],
        },
      },
      step: orchestratorStep,
    });

    expect(fanOutEvents.length).toBeGreaterThan(0);

    // Every fan-out event must have the fields the entity worker destructures
    const requiredFields = [
      "installationId",
      "provider",
      "orgId",
      "entityType",
      "resource",
      "since",
      "depth",
    ];
    for (const evt of fanOutEvents) {
      expect(evt.name).toBe("apps-backfill/entity.requested");
      for (const field of requiredFields) {
        expect(
          evt.data,
          `fan-out event missing field "${field}" that entity worker expects`,
        ).toHaveProperty(field);
      }
      // resource must have the shape the worker uses
      expect(evt.data.resource).toHaveProperty("providerResourceId");
      expect(evt.data.resource).toHaveProperty("resourceName");
    }
  });
});

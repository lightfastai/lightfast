import type { Database, SignalEntityEnrichmentTargetsResult } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSignalEntityProfilesMock = vi.fn();
const githubUserPayloadToObservationMock = vi.fn();
const listSignalEntityEnrichmentTargetsMock = vi.fn();
const signalProfileObservationIdsMock = vi.fn();
const xUserPayloadToObservationMock = vi.fn();
const db = { kind: "mock-db" } as unknown as Database;

type Step = ReturnType<typeof createStep>;
type WorkflowCallback = (input: {
  event: {
    data: {
      clerkOrgId: string;
      reason: "signal_indexed" | "manual_retry" | "backfill";
      signalId: string;
    };
  };
  step: Step;
}) => Promise<unknown>;

let workflowCallback: WorkflowCallback | undefined;
const createFunctionMock = vi.fn(
  (config: { id: string }, handler: WorkflowCallback): { id: string } => {
    workflowCallback = handler;
    return { id: config.id };
  }
);

vi.mock("@db/app", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@db/app")>();
  return {
    ...actual,
    listSignalEntityEnrichmentTargets: listSignalEntityEnrichmentTargetsMock,
  };
});
vi.mock("@db/app/client", () => ({ db }));
vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));
vi.mock("../services/entity-enrichment", () => ({
  fetchSignalEntityProfiles: fetchSignalEntityProfilesMock,
  githubUserPayloadToObservation: githubUserPayloadToObservationMock,
  signalProfileObservationIds: signalProfileObservationIdsMock,
  xUserPayloadToObservation: xUserPayloadToObservationMock,
}));

const { enrichSignalEntities } = await import(
  "../inngest/workflow/enrich-signal-entities"
);

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const xObservation = {
  observedAt: "2026-06-07T00:00:00.000Z",
  profile: {
    id: "x_1",
    name: "Ava Chen",
    username: "ava_ai",
  },
  provider: "x" as const,
};
const githubObservation = {
  observedAt: "2026-06-07T00:00:00.000Z",
  profile: {
    id: "12345",
    login: "avachen",
    name: "Ava Chen",
    twitterUsername: "ava_ai",
  },
  provider: "github" as const,
};

function targets(
  overrides: Partial<SignalEntityEnrichmentTargetsResult> = {}
): SignalEntityEnrichmentTargetsResult {
  return {
    github: [
      {
        linkIds: [3],
        normalizedValue: "avachen",
        provider: "github",
        value: "avachen",
      },
    ],
    skipped: [],
    x: [
      {
        linkIds: [1, 2],
        normalizedValue: "ava_ai",
        provider: "x",
        value: "ava_ai",
      },
    ],
    ...overrides,
  };
}

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    sendEvent: vi.fn(
      (
        _name: string,
        event: { id?: string; name: string; data: Record<string, unknown> }
      ) => Promise.resolve(event)
    ),
  };
}

function runWorkflow(step: Step) {
  if (!workflowCallback) {
    throw new Error("workflow callback was not registered");
  }

  return workflowCallback({
    event: {
      data: {
        clerkOrgId: "org_test",
        reason: "signal_indexed",
        signalId,
      },
    },
    step,
  });
}

beforeEach(() => {
  fetchSignalEntityProfilesMock.mockReset();
  fetchSignalEntityProfilesMock.mockResolvedValue({
    diagnostics: {},
    githubPayloads: [{ id: "12345", login: "avachen" }],
    xPayloads: [{ id: "x_1", username: "ava_ai" }],
  });
  githubUserPayloadToObservationMock.mockReset();
  githubUserPayloadToObservationMock.mockReturnValue(githubObservation);
  listSignalEntityEnrichmentTargetsMock.mockReset();
  listSignalEntityEnrichmentTargetsMock.mockResolvedValue(targets());
  signalProfileObservationIdsMock.mockReset();
  signalProfileObservationIdsMock.mockReturnValue({
    eventId: "signal-entity-enrichment-org_test-signal_hash",
    ingestionId: "signal:signal_123:hash",
  });
  xUserPayloadToObservationMock.mockReset();
  xUserPayloadToObservationMock.mockReturnValue(xObservation);
});

describe("enrichSignalEntities", () => {
  it("registers the signal entity enrichment workflow", () => {
    expect(enrichSignalEntities).toEqual({ id: "enrich-signal-entities" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "enrich-signal-entities",
        idempotency:
          'event.data.clerkOrgId + "-" + event.data.signalId + "-" + event.data.reason',
        retries: 3,
        timeouts: { finish: "10m", start: "10m" },
        triggers: expect.objectContaining({
          event: "app/signal.entity-enrichment.requested",
        }),
      },
      expect.any(Function)
    );
  });

  it("skips before provider fetching when no eligible targets exist", async () => {
    const step = createStep();
    const emptyTargets = targets({ github: [], x: [] });
    listSignalEntityEnrichmentTargetsMock.mockResolvedValueOnce(emptyTargets);

    await expect(runWorkflow(step)).resolves.toEqual({
      reason: "no_targets",
      status: "skipped",
      targets: emptyTargets,
    });

    expect(fetchSignalEntityProfilesMock).not.toHaveBeenCalled();
    expect(step.sendEvent).not.toHaveBeenCalled();
  });

  it("returns diagnostics and does not emit observations when providers are unavailable", async () => {
    const step = createStep();
    fetchSignalEntityProfilesMock.mockResolvedValueOnce({
      diagnostics: {
        github_missing_binding: 1,
        x_missing_connection: 1,
      },
      githubPayloads: [],
      xPayloads: [],
    });

    await expect(runWorkflow(step)).resolves.toEqual({
      diagnostics: {
        github_missing_binding: 1,
        x_missing_connection: 1,
      },
      observations: 0,
      status: "skipped",
      targets: targets(),
    });

    expect(step.sendEvent).not.toHaveBeenCalled();
  });

  it("emits profile observations for mixed X and GitHub success", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      diagnostics: {},
      observations: 2,
      status: "queued",
    });

    expect(listSignalEntityEnrichmentTargetsMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      reason: "signal_indexed",
      signalId,
    });
    expect(fetchSignalEntityProfilesMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      targets: targets(),
    });
    expect(signalProfileObservationIdsMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      observations: [xObservation, githubObservation],
      signalId,
    });
    expect(step.sendEvent).toHaveBeenCalledWith("emit profile observations", {
      id: "signal-entity-enrichment-org_test-signal_hash",
      name: "app/connector.profile.observed",
      data: {
        clerkOrgId: "org_test",
        ingestionId: "signal:signal_123:hash",
        observations: [xObservation, githubObservation],
        resolverVersion: "signal-entity-enrichment-v1",
        source: {
          kind: "signal_entity_enrichment",
          reason: "signal_indexed",
          signalId,
        },
      },
    });
  });
});

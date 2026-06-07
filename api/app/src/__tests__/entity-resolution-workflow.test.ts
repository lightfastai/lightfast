import type { Database, IngestEntityObservationsResult } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ingestEntityObservationsMock = vi.fn();
const db = { kind: "mock-db" } as unknown as Database;

type Step = ReturnType<typeof createStep>;
type WorkflowCallback = (input: {
  event: {
    data: {
      clerkOrgId: string;
      ingestionId: string;
      observations: [
        {
          provider: "github";
          profile: {
            id: string;
            login: string;
            name: string;
          };
        },
      ];
      resolverVersion?: string;
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

vi.mock("@db/app", () => ({
  ingestEntityObservations: ingestEntityObservationsMock,
}));
vi.mock("@db/app/client", () => ({ db }));
vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const { runEntityResolution } = await import(
  "../inngest/workflow/run-entity-resolution"
);

const observation = {
  provider: "github" as const,
  profile: {
    id: "gh_ava",
    login: "avachen",
    name: "Ava Chen",
  },
};

const summary: IngestEntityObservationsResult = {
  canonicalAccounts: 1,
  canonicalAffiliations: 1,
  canonicalPeople: 1,
  candidateGroups: 3,
  candidateVersionsAppended: 3,
  candidateVersionsUnchanged: 0,
  observations: 1,
  skippedCanonicalCandidates: 0,
  sourceIdentities: 2,
};

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    sendEvent: vi.fn(
      (_name: string, event: { name: string; data: Record<string, unknown> }) =>
        Promise.resolve(event)
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
        ingestionId: "ingestion_1",
        observations: [observation],
        resolverVersion: "connector-test-v1",
      },
    },
    step,
  });
}

beforeEach(() => {
  ingestEntityObservationsMock.mockReset();
  ingestEntityObservationsMock.mockResolvedValue(summary);
});

describe("runEntityResolution", () => {
  it("registers the entity resolution workflow", () => {
    expect(runEntityResolution).toEqual({ id: "run-entity-resolution" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "run-entity-resolution",
        idempotency: 'event.data.clerkOrgId + "-" + event.data.ingestionId',
        retries: 3,
        timeouts: { finish: "10m", start: "10m" },
        triggers: expect.objectContaining({
          event: "app/connector.profile.observed",
        }),
      },
      expect.any(Function)
    );
  });

  it("persists observed profiles and emits the persisted event", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      ...summary,
      status: "persisted",
    });

    expect(ingestEntityObservationsMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      observations: [observation],
      resolverVersion: "connector-test-v1",
    });
    expect(step.sendEvent).toHaveBeenCalledWith("emit entity graph persisted", {
      name: "app/entity.graph.persisted",
      data: {
        ...summary,
        clerkOrgId: "org_test",
        ingestionId: "ingestion_1",
        resolverVersion: "connector-test-v1",
      },
    });
  });
});

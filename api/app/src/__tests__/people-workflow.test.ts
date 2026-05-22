import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignalByPublicIdMock = vi.fn();
const upsertPeopleFromCandidatesMock = vi.fn();
const buildPeopleClassificationRequestMock = vi.fn();
const classifyPeopleFromSignalMock = vi.fn();
const getPeopleClassificationFailureMock = vi.fn();
const logWarnMock = vi.fn();
const db = { kind: "mock-db" } as unknown as Database;

type WorkflowCallback = (input: {
  event: {
    data: {
      clerkOrgId: string;
      signalId: string;
    };
  };
  step: ReturnType<typeof createStep>;
}) => Promise<unknown>;

type WorkflowFailureCallback = (input: {
  error: Error;
  event: {
    data: {
      event: {
        data: {
          clerkOrgId: string;
          signalId: string;
        };
      };
    };
  };
}) => Promise<unknown>;

let workflowCallback: WorkflowCallback | undefined;
let workflowFailureCallback: WorkflowFailureCallback | undefined;
const createFunctionMock = vi.fn(
  (
    config: { onFailure?: WorkflowFailureCallback },
    _trigger: unknown,
    handler: WorkflowCallback
  ): { id: string } => {
    workflowCallback = handler;
    workflowFailureCallback = config.onFailure;
    return { id: "classify-people" };
  }
);

vi.mock("@db/app", () => ({
  getSignalByPublicId: getSignalByPublicIdMock,
  upsertPeopleFromCandidates: upsertPeopleFromCandidatesMock,
}));

vi.mock("@db/app/client", () => ({ db }));

vi.mock("@repo/ai/people-classifier", () => ({
  buildPeopleClassificationRequest: buildPeopleClassificationRequestMock,
  classifyPeopleFromSignal: classifyPeopleFromSignalMock,
  getPeopleClassificationFailure: getPeopleClassificationFailureMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    warn: logWarnMock,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../env", () => ({
  env: {
    VERCEL_ENV: "development",
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const signalId = "sig_123e4567-e89b-12d3-a456-426614174000";
const signalClassification = {
  schemaVersion: "signal.classification.v1",
  disposition: "actionable",
  title: "Engage profile",
  summary: "The signal includes an X profile.",
  kind: "engage",
  nextAction: "Review the X profile.",
  priority: "normal",
  rationale: "The signal has a social identity.",
  confidence: 0.9,
  routing: {
    classifyPeople: {
      shouldRun: true,
      rationale: "The input includes https://x.com/jeevanp.",
    },
  },
};
const signal = {
  id: 1,
  publicId: signalId,
  clerkOrgId: "org_test",
  input: "Interesting post by https://x.com/jeevanp",
  status: "classified",
  classification: signalClassification,
};
const peopleClassification = {
  schemaVersion: "people.classification.v1",
  candidates: [
    {
      displayName: "Jeevan Pillay",
      identityProvider: "x",
      identityType: "handle",
      identityValue: "@jeevanp",
      rationale: "The signal includes a durable X handle.",
      confidence: 0.91,
    },
  ],
};

const { classifyPeople } = await import("../inngest/workflow/classify-people");

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    ai: {
      wrap: vi.fn(
        <T>(
          _name: string,
          fn: (request: Record<string, unknown>) => T | Promise<T>,
          request: Record<string, unknown>
        ) => fn(request)
      ),
    },
  };
}

function runWorkflow(step: ReturnType<typeof createStep>) {
  if (!workflowCallback) {
    throw new Error("workflow callback was not registered");
  }

  return workflowCallback({
    event: {
      data: {
        clerkOrgId: "org_test",
        signalId,
      },
    },
    step,
  });
}

beforeEach(() => {
  getSignalByPublicIdMock.mockReset();
  upsertPeopleFromCandidatesMock.mockReset();
  buildPeopleClassificationRequestMock.mockReset();
  classifyPeopleFromSignalMock.mockReset();
  getPeopleClassificationFailureMock.mockReset();
  logWarnMock.mockReset();

  getSignalByPublicIdMock.mockResolvedValue(signal);
  upsertPeopleFromCandidatesMock.mockResolvedValue([{ publicId: "person_1" }]);
  buildPeopleClassificationRequestMock.mockReturnValue({
    clerkOrgId: "org_test",
    deploymentEnvironment: "development",
    inputLength: signal.input.length,
    model: "openai/gpt-5.4-nano",
    prompt: "Extract durable people candidates",
    signalId,
    system: "You are the Lightfast people classifier.",
  });
  classifyPeopleFromSignalMock.mockResolvedValue(peopleClassification);
  getPeopleClassificationFailureMock.mockImplementation((error: unknown) => ({
    errorCode: "PEOPLE_CLASSIFICATION_FAILED",
    errorMessage: error instanceof Error ? error.message : String(error),
  }));
});

describe("classifyPeople", () => {
  it("registers the people classifier function", () => {
    expect(classifyPeople).toEqual({ id: "classify-people" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "classify-people",
        idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
        onFailure: expect.any(Function),
        retries: 3,
      },
      { event: "app/people.classification.requested" },
      expect.any(Function)
    );
  });

  it("classifies people from a classified signal and upserts candidates", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      people: 1,
      status: "classified",
    });

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(buildPeopleClassificationRequestMock).toHaveBeenCalledWith({
      classification: signalClassification,
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      input: signal.input,
      signalId,
    });
    expect(classifyPeopleFromSignalMock).toHaveBeenCalledWith(
      expect.objectContaining({ clerkOrgId: "org_test", signalId }),
      expect.objectContaining({ logger: expect.any(Object) })
    );
    expect(upsertPeopleFromCandidatesMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      candidates: [
        {
          displayName: "Jeevan Pillay",
          identityProvider: "x",
          identityType: "handle",
          identityValue: "@jeevanp",
          metadata: {
            confidence: 0.91,
            rationale: "The signal includes a durable X handle.",
            source: "people.classification.v1",
          },
        },
      ],
      sourceSignalId: signalId,
    });
  });

  it("returns missing when the source signal is gone", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(runWorkflow(step)).resolves.toEqual({ status: "missing" });

    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(upsertPeopleFromCandidatesMock).not.toHaveBeenCalled();
  });

  it("skips signals that are not classified", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      status: "processing",
      classification: null,
    });

    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(upsertPeopleFromCandidatesMock).not.toHaveBeenCalled();
  });

  it("lets AI failures bubble for Inngest retries", async () => {
    const step = createStep();
    classifyPeopleFromSignalMock.mockRejectedValueOnce(
      new Error("model unavailable")
    );

    await expect(runWorkflow(step)).rejects.toThrow("model unavailable");

    expect(upsertPeopleFromCandidatesMock).not.toHaveBeenCalled();
  });

  it("logs exhausted failures without marking the signal failed", async () => {
    if (!workflowFailureCallback) {
      throw new Error("workflow failure callback was not registered");
    }

    await expect(
      workflowFailureCallback({
        error: new Error("model unavailable"),
        event: {
          data: {
            event: {
              data: {
                clerkOrgId: "org_test",
                signalId,
              },
            },
          },
        },
      })
    ).resolves.toEqual({ status: "failed" });

    expect(logWarnMock).toHaveBeenCalledWith(
      "[people] classification exhausted retries",
      expect.objectContaining({
        clerkOrgId: "org_test",
        errorCode: "PEOPLE_CLASSIFICATION_FAILED",
        signalId,
      })
    );
  });
});

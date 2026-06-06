import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignalByPublicIdMock = vi.fn();
const replaceSignalEntityLinksMock = vi.fn();
const buildSignalEntityLinkingRequestMock = vi.fn();
const classifySignalEntityLinksMock = vi.fn();
const extractDeterministicSignalEntityLinksMock = vi.fn();
const getSignalEntityLinkingFailureMock = vi.fn();
const mergeSignalEntityLinkCandidatesMock = vi.fn();
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
    handler: WorkflowCallback
  ): { id: string } => {
    workflowCallback = handler;
    workflowFailureCallback = config.onFailure;
    return { id: "index-signal-entities" };
  }
);

vi.mock("@db/app", () => ({
  getSignalByPublicId: getSignalByPublicIdMock,
  replaceSignalEntityLinks: replaceSignalEntityLinksMock,
}));

vi.mock("@db/app/client", () => ({ db }));

vi.mock("@repo/ai/signal-entity-linker", () => ({
  buildSignalEntityLinkingRequest: buildSignalEntityLinkingRequestMock,
  classifySignalEntityLinks: classifySignalEntityLinksMock,
  extractDeterministicSignalEntityLinks:
    extractDeterministicSignalEntityLinksMock,
  getSignalEntityLinkingFailure: getSignalEntityLinkingFailureMock,
  mergeSignalEntityLinkCandidates: mergeSignalEntityLinkCandidatesMock,
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

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const classification = {
  schemaVersion: "signal.classification.v2",
  disposition: "needs_context",
  title: "Discuss dev flow",
  summary: "Talk with Jordi and Archer about workflow.",
  kind: "follow_up",
  nextAction: "Ask Jordi and Archer about dev flow.",
  priority: "normal",
  rationale: "The signal mentions people.",
  confidence: 0.55,
  routing: {
    visibility: {
      scope: "user",
      rationale: "Creator-visible context.",
    },
    review: {
      required: false,
      reason: null,
      rationale: null,
    },
    routes: {
      people: {
        shouldRun: false,
        confidence: 0.1,
        rationale: "No durable identity is present.",
      },
    },
  },
};
const signal = {
  id: 1,
  publicId: signalId,
  clerkOrgId: "org_test",
  input: "Talk to Jordi & Archer about their dev flow. See @archer.",
  status: "classified",
  classification,
  visibilityScope: "user",
};
const deterministicCandidate = {
  targetType: "person",
  localEntityKey: "person_1",
  label: "@archer",
  mentionKind: "handle",
  anchorText: "@archer",
  anchorOccurrence: 1,
  extractionMethod: "deterministic",
  rationale: "Handle matched deterministic extractor.",
  confidence: 1,
};
const aiCandidate = {
  targetType: "person",
  localEntityKey: "person_2",
  label: "Jordi",
  mentionKind: "name",
  anchorText: "Jordi",
  anchorOccurrence: 1,
  extractionMethod: "ai",
  rationale: "Jordi appears as a person.",
  confidence: 0.74,
};

const { appEvents } = await import("../inngest/schemas/app");
const { indexSignalEntities } = await import(
  "../inngest/workflow/index-signal-entities"
);

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

function runWorkflowFailure(error: Error) {
  if (!workflowFailureCallback) {
    throw new Error("workflow failure callback was not registered");
  }

  return workflowFailureCallback({
    error,
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
  });
}

beforeEach(() => {
  getSignalByPublicIdMock.mockReset();
  replaceSignalEntityLinksMock.mockReset();
  extractDeterministicSignalEntityLinksMock.mockReset();
  buildSignalEntityLinkingRequestMock.mockReset();
  classifySignalEntityLinksMock.mockReset();
  mergeSignalEntityLinkCandidatesMock.mockReset();
  getSignalEntityLinkingFailureMock.mockReset();
  logWarnMock.mockReset();

  getSignalByPublicIdMock.mockResolvedValue(signal);
  replaceSignalEntityLinksMock.mockResolvedValue({ links: 2, resolved: 1 });
  extractDeterministicSignalEntityLinksMock.mockReturnValue([
    deterministicCandidate,
  ]);
  buildSignalEntityLinkingRequestMock.mockReturnValue({
    clerkOrgId: "org_test",
    deploymentEnvironment: "development",
    deterministicCandidates: [deterministicCandidate],
    inputLength: signal.input.length,
    model: "openai/gpt-5.4-nano",
    prompt: "Extract explicit person references.",
    signalId,
    system: "You are the Lightfast signal entity linker.",
  });
  classifySignalEntityLinksMock.mockResolvedValue({
    schemaVersion: "signal.entity-links.v1",
    candidates: [aiCandidate],
  });
  mergeSignalEntityLinkCandidatesMock.mockReturnValue([
    deterministicCandidate,
    aiCandidate,
  ]);
  getSignalEntityLinkingFailureMock.mockImplementation((error: unknown) => ({
    errorCode: "SIGNAL_ENTITY_LINKING_FAILED",
    errorMessage: error instanceof Error ? error.message : String(error),
  }));
});

describe("indexSignalEntities", () => {
  it("registers the workflow and event schema", () => {
    expect(indexSignalEntities).toEqual({ id: "index-signal-entities" });
    expect(appEvents["app/signal.entity-index.requested"]).toEqual(
      expect.objectContaining({
        event: "app/signal.entity-index.requested",
      })
    );
    expect(() =>
      appEvents["app/signal.entity-index.requested"].schema.parse({
        clerkOrgId: "org_test",
        signalId,
      })
    ).not.toThrow();
    expect(() =>
      appEvents["app/signal.entity-index.requested"].schema.parse({
        clerkOrgId: "",
        signalId,
      })
    ).toThrow();
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "index-signal-entities",
        idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
        onFailure: expect.any(Function),
        retries: 3,
        timeouts: { finish: "10m", start: "10m" },
        triggers: expect.objectContaining({
          event: "app/signal.entity-index.requested",
        }),
      },
      expect.any(Function)
    );
  });

  it("extracts deterministic and AI candidates, merges, and persists links", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      aiCandidates: 1,
      candidates: 2,
      deterministicCandidates: 1,
      persistedLinks: 2,
      resolvedLinks: 1,
      status: "indexed",
    });

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(extractDeterministicSignalEntityLinksMock).toHaveBeenCalledWith({
      input: signal.input,
    });
    expect(buildSignalEntityLinkingRequestMock).toHaveBeenCalledWith({
      classification,
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      deterministicCandidates: [deterministicCandidate],
      input: signal.input,
      signalId,
    });
    expect(step.ai.wrap).toHaveBeenCalledWith(
      "link signal entities",
      expect.any(Function),
      expect.objectContaining({ signalId })
    );
    expect(classifySignalEntityLinksMock).toHaveBeenCalledWith(
      expect.objectContaining({ signalId }),
      expect.objectContaining({ logger: expect.any(Object) })
    );
    expect(mergeSignalEntityLinkCandidatesMock).toHaveBeenCalledWith({
      aiCandidates: [aiCandidate],
      deterministicCandidates: [deterministicCandidate],
      input: signal.input,
    });
    expect(replaceSignalEntityLinksMock).toHaveBeenCalledWith(db, {
      candidates: [deterministicCandidate, aiCandidate],
      clerkOrgId: "org_test",
      signalId,
    });
  });

  it("returns missing when the source signal is gone", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(runWorkflow(step)).resolves.toEqual({ status: "missing" });

    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(mergeSignalEntityLinkCandidatesMock).not.toHaveBeenCalled();
    expect(replaceSignalEntityLinksMock).not.toHaveBeenCalled();
  });

  it("skips signals that are not classified", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      status: "processing",
      classification: null,
    });

    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    expect(extractDeterministicSignalEntityLinksMock).not.toHaveBeenCalled();
    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(mergeSignalEntityLinkCandidatesMock).not.toHaveBeenCalled();
    expect(replaceSignalEntityLinksMock).not.toHaveBeenCalled();
  });

  it("skips signals whose classification visibility needs review", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      classification: {
        ...classification,
        routing: {
          ...classification.routing,
          visibility: {
            scope: "needs_review",
            rationale: "Needs review.",
          },
          review: {
            required: true,
            reason: "sensitive_person",
            rationale: "Sensitive person context.",
          },
        },
      },
      visibilityScope: "needs_review",
    });

    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    expect(extractDeterministicSignalEntityLinksMock).not.toHaveBeenCalled();
    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(mergeSignalEntityLinkCandidatesMock).not.toHaveBeenCalled();
    expect(replaceSignalEntityLinksMock).not.toHaveBeenCalled();
  });

  it("skips signals whose persisted visibility needs review", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      visibilityScope: "needs_review",
    });

    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    expect(extractDeterministicSignalEntityLinksMock).not.toHaveBeenCalled();
    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(mergeSignalEntityLinkCandidatesMock).not.toHaveBeenCalled();
    expect(replaceSignalEntityLinksMock).not.toHaveBeenCalled();
  });

  it("lets AI failures bubble for Inngest retries", async () => {
    const step = createStep();
    classifySignalEntityLinksMock.mockRejectedValueOnce(
      new Error("model unavailable")
    );

    await expect(runWorkflow(step)).rejects.toThrow("model unavailable");

    expect(mergeSignalEntityLinkCandidatesMock).not.toHaveBeenCalled();
    expect(replaceSignalEntityLinksMock).not.toHaveBeenCalled();
  });

  it("logs exhausted failures without mutating the signal", async () => {
    await expect(
      runWorkflowFailure(new Error("model unavailable"))
    ).resolves.toEqual({ status: "failed" });

    expect(logWarnMock).toHaveBeenCalledWith(
      "[entity-links] indexing exhausted retries",
      expect.objectContaining({
        clerkOrgId: "org_test",
        errorCode: "SIGNAL_ENTITY_LINKING_FAILED",
        errorMessage: "model unavailable",
        signalId,
      })
    );
  });
});

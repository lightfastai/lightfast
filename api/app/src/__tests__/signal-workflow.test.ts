import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignalByPublicIdMock = vi.fn();
const claimSignalForClassificationMock = vi.fn();
const markSignalClassifiedMock = vi.fn();
const markSignalFailedMock = vi.fn();
const buildSignalClassificationRequestMock = vi.fn();
const classifySignalInputMock = vi.fn();
const getSignalClassificationFailureMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();
const sendMock = vi.fn();
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
  step: ReturnType<typeof createStep>;
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
    return { id: "classify-signal" };
  }
);

vi.mock("@db/app", () => ({
  claimSignalForClassification: claimSignalForClassificationMock,
  getSignalByPublicId: getSignalByPublicIdMock,
  markSignalClassified: markSignalClassifiedMock,
  markSignalFailed: markSignalFailedMock,
}));

vi.mock("@repo/ai/signal-classifier", () => ({
  SIGNAL_CLASSIFIER_MODEL: "openai/gpt-5.4-nano",
  SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE: "CLASSIFICATION_FAILED",
  SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE: "CLASSIFICATION_PROVIDER_ERROR",
  SIGNAL_CLASSIFIER_SYSTEM_PROMPT: "You are the Lightfast signal classifier.",
  buildSignalClassificationRequest: buildSignalClassificationRequestMock,
  classifySignalInput: classifySignalInputMock,
  getSignalClassificationFailure: getSignalClassificationFailureMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    info: logInfoMock,
    warn: logWarnMock,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@db/app/client", () => ({
  db,
}));

vi.mock("../env", () => ({
  env: {
    VERCEL_ENV: "development",
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
    send: sendMock,
  },
}));

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const signal = {
  id: 1,
  publicId: signalId,
  clerkOrgId: "org_test",
  input: "Run the PR test plan",
  status: "queued",
};
const classification = {
  schemaVersion: "signal.classification.v1",
  disposition: "actionable",
  title: "Run the test plan",
  summary: "The user needs to finish a validation task.",
  kind: "review",
  nextAction: "Run the PR test plan.",
  priority: "high",
  rationale: "The input describes unfinished validation work.",
  confidence: 0.95,
  routing: {
    classifyPeople: {
      shouldRun: true,
      rationale: "The signal contains a durable social identity.",
    },
  },
};
const { classifySignal } = await import("../inngest/workflow/classify-signal");

function createStep() {
  const step = {
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
  return step;
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

function runWorkflowFailure(step: ReturnType<typeof createStep>, error: Error) {
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
    step,
  });
}

beforeEach(() => {
  getSignalByPublicIdMock.mockReset();
  claimSignalForClassificationMock.mockReset();
  markSignalClassifiedMock.mockReset();
  markSignalFailedMock.mockReset();
  buildSignalClassificationRequestMock.mockReset();
  classifySignalInputMock.mockReset();
  getSignalClassificationFailureMock.mockReset();
  logInfoMock.mockReset();
  logWarnMock.mockReset();
  sendMock.mockReset();

  getSignalByPublicIdMock.mockResolvedValue(signal);
  claimSignalForClassificationMock.mockResolvedValue(true);
  markSignalClassifiedMock.mockResolvedValue(true);
  markSignalFailedMock.mockResolvedValue(true);
  sendMock.mockResolvedValue(undefined);
  buildSignalClassificationRequestMock.mockReturnValue({
    clerkOrgId: "org_test",
    deploymentEnvironment: "development",
    inputLength: "Run the PR test plan".length,
    model: "openai/gpt-5.4-nano",
    prompt: "Classify this signal input:\n\nRun the PR test plan",
    signalId,
    system: "You are the Lightfast signal classifier.",
  });
  classifySignalInputMock.mockResolvedValue(classification);
  getSignalClassificationFailureMock.mockImplementation((error: unknown) => ({
    errorCode:
      error instanceof Error && error.name === "AI_APICallError"
        ? "CLASSIFICATION_PROVIDER_ERROR"
        : "CLASSIFICATION_FAILED",
    errorMessage: error instanceof Error ? error.message : String(error),
  }));
});

describe("classifySignal", () => {
  it("registers the signal classifier function", () => {
    expect(classifySignal).toEqual({ id: "classify-signal" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "classify-signal",
        idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
        onFailure: expect.any(Function),
        retries: 3,
        timeouts: { finish: "10m", start: "10m" },
        triggers: expect.objectContaining({ event: "app/signal.created" }),
      },
      expect.any(Function)
    );
  });

  it("transitions a queued signal through an Inngest AI wrapper to classified", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      routedPeople: true,
    });

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(claimSignalForClassificationMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(buildSignalClassificationRequestMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      input: "Run the PR test plan",
      signalId,
    });
    expect(step.ai.wrap).toHaveBeenCalledWith(
      "classify signal",
      expect.any(Function),
      expect.objectContaining({
        clerkOrgId: "org_test",
        deploymentEnvironment: "development",
        inputLength: "Run the PR test plan".length,
        signalId,
      })
    );
    expect(classifySignalInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        signalId,
      }),
      expect.objectContaining({
        logger: expect.any(Object),
      })
    );
    expect(markSignalClassifiedMock).toHaveBeenCalledWith(db, {
      classification,
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/people.classification.requested",
      data: {
        clerkOrgId: "org_test",
        signalId,
      },
    });
    expect(markSignalFailedMock).not.toHaveBeenCalled();
  });

  it("does not queue people classification when routing is absent", async () => {
    const step = createStep();
    classifySignalInputMock.mockResolvedValueOnce({
      ...classification,
      routing: undefined,
    });

    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      routedPeople: false,
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("queues people classification when a retry sees an already classified signal", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      status: "classified",
      classification,
    });

    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      routedPeople: true,
    });

    expect(claimSignalForClassificationMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/people.classification.requested",
      data: {
        clerkOrgId: "org_test",
        signalId,
      },
    });
  });

  it("returns missing when the event references a signal that no longer exists", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(runWorkflow(step)).resolves.toEqual({ status: "missing" });

    expect(claimSignalForClassificationMock).not.toHaveBeenCalled();
    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(markSignalClassifiedMock).not.toHaveBeenCalled();
    expect(markSignalFailedMock).not.toHaveBeenCalled();
  });

  it("lets wrapped AI classification failures bubble for Inngest retries", async () => {
    const step = createStep();
    classifySignalInputMock.mockRejectedValueOnce(
      new Error("model unavailable")
    );

    await expect(runWorkflow(step)).rejects.toThrow("model unavailable");

    expect(markSignalFailedMock).not.toHaveBeenCalled();
  });

  it("marks the signal failed from onFailure after retries are exhausted", async () => {
    const step = createStep();

    await expect(
      runWorkflowFailure(step, new Error("model unavailable"))
    ).resolves.toEqual({ status: "failed" });

    expect(markSignalFailedMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      errorCode: "CLASSIFICATION_FAILED",
      errorMessage: "model unavailable",
      publicId: signalId,
    });
  });

  it("persists provider failure codes from onFailure", async () => {
    const step = createStep();
    const error = Object.assign(new Error("rate limited"), {
      isRetryable: true,
      name: "AI_APICallError",
    });

    await expect(runWorkflowFailure(step, error)).resolves.toEqual({
      status: "failed",
    });

    expect(markSignalFailedMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      errorCode: "CLASSIFICATION_PROVIDER_ERROR",
      errorMessage: "rate limited",
      publicId: signalId,
    });
  });

  it("does not report classified when the processing row is no longer updatable", async () => {
    const step = createStep();
    markSignalClassifiedMock.mockResolvedValueOnce(false);

    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    expect(markSignalFailedMock).not.toHaveBeenCalled();
  });

  it("does not reprocess a signal that is no longer queued", async () => {
    const step = createStep();
    claimSignalForClassificationMock.mockResolvedValueOnce(false);

    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(classifySignalInputMock).not.toHaveBeenCalled();
    expect(markSignalClassifiedMock).not.toHaveBeenCalled();
    expect(markSignalFailedMock).not.toHaveBeenCalled();
  });
});

import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignalByPublicIdMock = vi.fn();
const claimSignalForClassificationMock = vi.fn();
const markSignalClassifiedMock = vi.fn();
const markSignalFailedMock = vi.fn();
const generateTextMock = vi.fn();
const outputObjectMock = vi.fn();
const logInfoMock = vi.fn();
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
  step: ReturnType<typeof createStep>;
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
    return { id: "classify-signal" };
  }
);

vi.mock("@db/app", () => ({
  claimSignalForClassification: claimSignalForClassificationMock,
  getSignalByPublicId: getSignalByPublicIdMock,
  markSignalClassified: markSignalClassifiedMock,
  markSignalFailed: markSignalFailedMock,
}));

vi.mock("ai", () => ({
  APICallError: {
    isInstance: (error: unknown) =>
      error instanceof Error && error.name.includes("APICallError"),
  },
  generateText: generateTextMock,
  NoObjectGeneratedError: {
    isInstance: (error: unknown) =>
      error instanceof Error && error.name.includes("NoObjectGeneratedError"),
  },
  Output: {
    object: outputObjectMock,
  },
  RetryError: {
    isInstance: (error: unknown) =>
      error instanceof Error && error.name.includes("RetryError"),
  },
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

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const signalId = "sig_123e4567-e89b-12d3-a456-426614174000";
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
};
const {
  SIGNAL_CLASSIFIER_MODEL,
  SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE,
  SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE,
  SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
  classifySignal,
  classifySignalInput,
} = await import("../inngest/workflow/classify-signal");

function createStep() {
  const step = {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    ai: {
      wrap: vi.fn(
        <T>(
          _name: string,
          fn: (request: Parameters<typeof classifySignalInput>[0]) =>
            T | Promise<T>,
          request: Parameters<typeof classifySignalInput>[0]
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
  generateTextMock.mockReset();
  outputObjectMock.mockReset();
  logInfoMock.mockReset();
  logWarnMock.mockReset();

  getSignalByPublicIdMock.mockResolvedValue(signal);
  claimSignalForClassificationMock.mockResolvedValue(true);
  markSignalClassifiedMock.mockResolvedValue(true);
  markSignalFailedMock.mockResolvedValue(true);
  outputObjectMock.mockReturnValue({ type: "object-output" });
  generateTextMock.mockResolvedValue({
    finishReason: "stop",
    output: classification,
    usage: {
      inputTokens: 18,
      outputTokens: 42,
      totalTokens: 60,
    },
    warnings: [],
  });
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
      },
      { event: "app/signal.created" },
      expect.any(Function)
    );
  });

  it("transitions a queued signal through an Inngest AI wrapper to classified", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({ status: "classified" });

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(claimSignalForClassificationMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(step.ai.wrap).toHaveBeenCalledWith(
      "classify signal",
      classifySignalInput,
      {
        clerkOrgId: "org_test",
        inputLength: "Run the PR test plan".length,
        model: SIGNAL_CLASSIFIER_MODEL,
        prompt: expect.stringContaining("Run the PR test plan"),
        signalId,
        system: SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
      }
    );
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: SIGNAL_CLASSIFIER_MODEL,
        maxOutputTokens: 512,
        maxRetries: 0,
        output: { type: "object-output" },
        prompt: expect.stringContaining("Run the PR test plan"),
        system: SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
        timeout: { totalMs: 30_000 },
        experimental_telemetry: {
          functionId: "app.inngest.classify-signal",
          isEnabled: true,
          metadata: {
            clerkOrgId: "org_test",
            inputLength: "Run the PR test plan".length,
            schemaVersion: "signal.classification.v1",
            signalId,
          },
          recordInputs: false,
          recordOutputs: false,
        },
      })
    );
    expect(markSignalClassifiedMock).toHaveBeenCalledWith(db, {
      classification,
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(markSignalFailedMock).not.toHaveBeenCalled();
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
    generateTextMock.mockRejectedValueOnce(new Error("model unavailable"));

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
      errorCode: SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE,
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
      errorCode: SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE,
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
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(markSignalClassifiedMock).not.toHaveBeenCalled();
    expect(markSignalFailedMock).not.toHaveBeenCalled();
  });
});

import type { SignalClassification } from "@repo/api-contract";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSignalClassificationRequest,
  classifySignalInput,
  getSignalClassificationFailure,
  SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE,
  SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
  SIGNAL_CLASSIFIER_FEATURE,
  SIGNAL_CLASSIFIER_MODEL,
  SIGNAL_CLASSIFIER_PROMPT_ID,
  SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
  SIGNAL_CLASSIFIER_WORKFLOW,
  type SignalClassificationFailureCode,
  signalClassificationModelSchema,
} from "../../signal-classifier";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

const signalId = "sig_123e4567-e89b-12d3-a456-426614174000";

const modelOwnedClassification = {
  disposition: "actionable",
  title: "Review X profile",
  summary: "The user found an X profile worth engaging.",
  kind: "engage",
  nextAction: "Review the profile and decide whether to reply.",
  priority: "normal",
  rationale: "The input contains a durable social identity.",
  confidence: 0.95,
  routing: {
    classifyPeople: {
      shouldRun: true,
      rationale: "The input includes https://x.com/jeevanp.",
    },
  },
} satisfies Omit<SignalClassification, "schemaVersion">;

const classification = {
  schemaVersion: "signal.classification.v1",
  ...modelOwnedClassification,
} satisfies SignalClassification;

const usage = {
  inputTokens: {
    total: 18,
    noCache: 18,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 42,
    text: 42,
    reasoning: undefined,
  },
};

function createClassifierModel(text: string) {
  return new MockLanguageModelV3({
    provider: "openai",
    modelId: "gpt-5.4-nano",
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
  });
}

beforeEach(() => {
  logger.info.mockReset();
  logger.warn.mockReset();
});

describe("classifySignalInput", () => {
  it("builds an OpenAI GPT-5.4 nano classification request with metadata", () => {
    const request = buildSignalClassificationRequest({
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      input: "Run the test plan",
      signalId,
    });

    expect(SIGNAL_CLASSIFIER_MODEL).toBe("openai/gpt-5.4-nano");
    expect(SIGNAL_CLASSIFIER_FEATURE).toBe("signals");
    expect(SIGNAL_CLASSIFIER_WORKFLOW).toBe("classify-signal");
    expect(SIGNAL_CLASSIFIER_PROMPT_ID).toBe("signal-classifier");
    expect(request).toEqual({
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      inputLength: "Run the test plan".length,
      model: SIGNAL_CLASSIFIER_MODEL,
      prompt: expect.stringContaining("Run the test plan"),
      signalId,
      system: SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
    });
  });

  it("uses AI SDK structured output with metadata-only telemetry", async () => {
    const model = createClassifierModel(
      JSON.stringify(modelOwnedClassification)
    );
    const request = {
      ...buildSignalClassificationRequest({
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        input: "Run the test plan",
        signalId,
      }),
      model,
    };

    await expect(classifySignalInput(request, { logger })).resolves.toEqual(
      classification
    );

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0]).toEqual(
      expect.objectContaining({
        maxOutputTokens: 512,
        responseFormat: expect.objectContaining({ type: "json" }),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "[signals] classification completed",
      expect.objectContaining({
        agentGraphId: "signal-intake",
        agentRunId: signalId,
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        feature: "signals",
        finishReason: "stop",
        inputLength: "Run the test plan".length,
        model: "openai/gpt-5.4-nano",
        nodeId: "signal-classifier",
        nodeKind: "llm",
        nodeRole: "router",
        promptId: "signal-classifier",
        routerId: "signals",
        signalId,
        workflow: "classify-signal",
        usage: expect.objectContaining({
          inputTokens: 18,
          outputTokens: 42,
          totalTokens: 60,
        }),
        warnings: 0,
      })
    );
    expect(logger.info.mock.calls[0]?.[1]).not.toHaveProperty("prompt");
    expect(logger.info.mock.calls[0]?.[1]).not.toHaveProperty("output");
  });

  it("maps invalid structured output to a durable failure code", async () => {
    const model = createClassifierModel(
      JSON.stringify({ title: "Missing required fields" })
    );
    const request = {
      ...buildSignalClassificationRequest({
        clerkOrgId: "org_test",
        deploymentEnvironment: "preview",
        input: "Run the test plan",
        signalId,
      }),
      model,
    };

    await expect(classifySignalInput(request, { logger })).rejects.toThrow();

    const failure = await classifySignalInput(request, { logger }).catch(
      (error) => getSignalClassificationFailure(error)
    );
    const typedErrorCode: SignalClassificationFailureCode = failure.errorCode;

    expect(failure).toEqual(
      expect.objectContaining({
        errorCode: SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
      })
    );
    expect(typedErrorCode).toBe(
      SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "[signals] classification failed",
      expect.objectContaining({
        agentGraphId: "signal-intake",
        agentRunId: signalId,
        clerkOrgId: "org_test",
        deploymentEnvironment: "preview",
        errorCode: SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
        feature: "signals",
        model: "openai/gpt-5.4-nano",
        nodeId: "signal-classifier",
        nodeKind: "llm",
        nodeRole: "router",
        promptId: "signal-classifier",
        routerId: "signals",
        signalId,
        workflow: "classify-signal",
      })
    );
  });

  it("falls back to the generic failure code for unknown errors", () => {
    expect(getSignalClassificationFailure(new Error("unknown"))).toEqual({
      errorCode: SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE,
      errorMessage: "unknown",
    });
  });

  it("instructs the model not to browse or invent facts", () => {
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not browse");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not invent");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("Preserve uncertainty");
  });

  it("instructs the model to route people classification without extracting people", () => {
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "Always include routing.classifyPeople"
    );
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("routing.classifyPeople");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("shouldRun");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not extract people");
  });

  it("requires model-owned routing for strict structured output", () => {
    expect(
      signalClassificationModelSchema.parse(modelOwnedClassification)
    ).toEqual(modelOwnedClassification);
    expect(() =>
      signalClassificationModelSchema.parse({
        ...modelOwnedClassification,
        routing: undefined,
      })
    ).toThrow();
  });

  it.skipIf(process.env.RUN_SIGNAL_CLASSIFIER_AI_E2E !== "1")(
    "classifies through the live Vercel AI Gateway/OpenAI path",
    async () => {
      const request = buildSignalClassificationRequest({
        clerkOrgId: "org_live_e2e",
        deploymentEnvironment: "development",
        input: "Follow up with Sam tomorrow about the launch checklist.",
        signalId,
      });

      await expect(classifySignalInput(request, { logger })).resolves.toEqual(
        expect.objectContaining({
          schemaVersion: "signal.classification.v1",
          disposition: expect.any(String),
          title: expect.any(String),
          confidence: expect.any(Number),
        })
      );
    }
  );
});

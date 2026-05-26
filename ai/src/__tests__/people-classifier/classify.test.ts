import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPeopleClassificationRequest,
  classifyPeopleFromSignal,
  getPeopleClassificationFailure,
  PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
  PEOPLE_CLASSIFIER_MODEL,
  PEOPLE_CLASSIFIER_PROMPT_ID,
  PEOPLE_CLASSIFIER_SYSTEM_PROMPT,
  PEOPLE_CLASSIFIER_WORKFLOW,
  peopleClassificationModelSchema,
  peopleClassificationSchema,
} from "../../people-classifier";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

const signalId = "sig_123e4567-e89b-12d3-a456-426614174000";

const modelOwnedClassification = {
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

const usage = {
  inputTokens: {
    total: 24,
    noCache: 24,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 52, text: 52, reasoning: undefined },
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

describe("classifyPeopleFromSignal", () => {
  it("builds a people classification request with signal context", () => {
    const request = buildPeopleClassificationRequest({
      classification: {
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
      },
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      input: "Interesting post by https://x.com/jeevanp",
      signalId,
    });

    expect(PEOPLE_CLASSIFIER_MODEL).toBe("openai/gpt-5.4-nano");
    expect(PEOPLE_CLASSIFIER_WORKFLOW).toBe("classify-people");
    expect(PEOPLE_CLASSIFIER_PROMPT_ID).toBe("people-classifier");
    expect(request).toEqual(
      expect.objectContaining({
        clerkOrgId: "org_test",
        deploymentEnvironment: "development",
        inputLength: "Interesting post by https://x.com/jeevanp".length,
        model: PEOPLE_CLASSIFIER_MODEL,
        signalId,
        system: PEOPLE_CLASSIFIER_SYSTEM_PROMPT,
      })
    );
    expect(request.prompt).toContain(
      "Interesting post by https://x.com/jeevanp"
    );
    expect(request.prompt).toContain("Engage profile");
  });

  it("uses structured output and stamps people schema version", async () => {
    const model = createClassifierModel(
      JSON.stringify(modelOwnedClassification)
    );
    const request = {
      ...buildPeopleClassificationRequest({
        classification: {
          schemaVersion: "signal.classification.v1",
          disposition: "actionable",
          title: "Engage profile",
          summary: "The signal includes an X profile.",
          kind: "engage",
          nextAction: "Review the X profile.",
          priority: "normal",
          rationale: "The signal has a social identity.",
          confidence: 0.9,
        },
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        input: "Interesting post by @jeevanp",
        signalId,
      }),
      model,
    };

    await expect(
      classifyPeopleFromSignal(request, { logger })
    ).resolves.toEqual({
      schemaVersion: "people.classification.v1",
      ...modelOwnedClassification,
    });

    expect(logger.info).toHaveBeenCalledWith(
      "[people] classification completed",
      expect.objectContaining({
        agentGraphId: "signal-intake",
        agentRunId: signalId,
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        feature: "people",
        nodeId: "people-classifier",
        nodeKind: "llm",
        nodeRole: "extractor",
        promptId: "people-classifier",
        routerId: "signals",
        signalId,
        upstreamNodeId: "signal-classifier",
        workflow: "classify-people",
      })
    );
  });

  it("normalizes null model display names to the persisted optional shape", async () => {
    const model = createClassifierModel(
      JSON.stringify({
        candidates: [
          {
            displayName: null,
            identityProvider: "x",
            identityType: "handle",
            identityValue: "@jeevanp",
            rationale: "The signal includes a durable X handle.",
            confidence: 0.91,
          },
        ],
      })
    );
    const request = {
      ...buildPeopleClassificationRequest({
        classification: {
          schemaVersion: "signal.classification.v1",
          disposition: "actionable",
          title: "Engage profile",
          summary: "The signal includes an X profile.",
          kind: "engage",
          nextAction: "Review the X profile.",
          priority: "normal",
          rationale: "The signal has a social identity.",
          confidence: 0.9,
        },
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        input: "Interesting post by @jeevanp",
        signalId,
      }),
      model,
    };

    await expect(classifyPeopleFromSignal(request, { logger })).resolves.toEqual(
      {
        schemaVersion: "people.classification.v1",
        candidates: [
          {
            identityProvider: "x",
            identityType: "handle",
            identityValue: "@jeevanp",
            rationale: "The signal includes a durable X handle.",
            confidence: 0.91,
          },
        ],
      }
    );
  });

  it("uses explicit null display names for strict structured output", () => {
    expect(
      peopleClassificationModelSchema.parse({
        candidates: [
          {
            displayName: null,
            identityProvider: "x",
            identityType: "handle",
            identityValue: "@jeevanp",
            rationale: "The signal includes a durable X handle.",
            confidence: 0.91,
          },
        ],
      })
    ).toEqual({
      candidates: [
        {
          displayName: null,
          identityProvider: "x",
          identityType: "handle",
          identityValue: "@jeevanp",
          rationale: "The signal includes a durable X handle.",
          confidence: 0.91,
        },
      ],
    });
  });

  it("rejects unsupported unknown providers", () => {
    expect(() =>
      peopleClassificationSchema.parse({
        schemaVersion: "people.classification.v1",
        candidates: [
          {
            identityProvider: "unknown",
            identityType: "handle",
            identityValue: "@someone",
            rationale: "Unsupported provider",
            confidence: 0.4,
          },
        ],
      })
    ).toThrow();
  });

  it("maps invalid output to a durable people failure code", async () => {
    const model = createClassifierModel(
      JSON.stringify({ candidates: [{ identityProvider: "unknown" }] })
    );
    const request = {
      ...buildPeopleClassificationRequest({
        classification: {
          schemaVersion: "signal.classification.v1",
          disposition: "actionable",
          title: "Engage profile",
          summary: "The signal includes an X profile.",
          kind: "engage",
          nextAction: "Review the X profile.",
          priority: "normal",
          rationale: "The signal has a social identity.",
          confidence: 0.9,
        },
        clerkOrgId: "org_test",
        deploymentEnvironment: "preview",
        input: "Interesting post by @jeevanp",
        signalId,
      }),
      model,
    };

    const failure = await classifyPeopleFromSignal(request, { logger }).catch(
      (error) => getPeopleClassificationFailure(error)
    );

    expect(failure.errorCode).toBe(
      PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE
    );
  });

  it("instructs the model to avoid name-only candidates", () => {
    expect(PEOPLE_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "Do not create name-only candidates"
    );
    expect(PEOPLE_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not browse");
    expect(PEOPLE_CLASSIFIER_SYSTEM_PROMPT).toContain("durable identity");
    expect(PEOPLE_CLASSIFIER_SYSTEM_PROMPT).toContain("otherwise use null");
  });
});

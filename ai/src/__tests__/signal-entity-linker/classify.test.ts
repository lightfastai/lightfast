import type { SignalClassification } from "@repo/api-contract";
import { MockLanguageModelV3 } from "@vendor/ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSignalEntityLinkingRequest,
  classifySignalEntityLinks,
  getSignalEntityLinkingFailure,
  SIGNAL_ENTITY_LINKER_MODEL,
  SIGNAL_ENTITY_LINKER_PROMPT_ID,
  SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT,
  SIGNAL_ENTITY_LINKER_WORKFLOW,
  SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE,
  type SignalEntityLinkCandidate,
  type SignalEntityLinkingModelOutput,
} from "../../signal-entity-linker";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

const signalId = "sig_123e4567-e89b-12d3-a456-426614174000";

const signalClassification = {
  schemaVersion: "signal.classification.v2",
  disposition: "actionable",
  title: "Follow up with Jordi",
  summary: "The signal asks the team to follow up with Jordi Torras.",
  kind: "engage",
  nextAction: "Review Jordi's context and prepare a response.",
  priority: "normal",
  rationale: "The input names a person who may need follow-up.",
  confidence: 0.9,
  routing: {
    visibility: {
      scope: "team",
      rationale: "The request is shared team context.",
    },
    review: { required: false, reason: null, rationale: null },
    routes: {
      people: {
        shouldRun: true,
        confidence: 0.86,
        rationale: "The input includes a person reference.",
      },
    },
  },
} satisfies SignalClassification;

const deterministicCandidates = [
  {
    targetType: "person",
    localEntityKey: "person_1",
    label: "jordi@example.com",
    mentionKind: "email",
    anchorText: "jordi@example.com",
    anchorOccurrence: 1,
    extractionMethod: "deterministic",
    rationale: "Email address matched deterministic extractor.",
    confidence: 1,
  },
] satisfies SignalEntityLinkCandidate[];

const modelOwnedEntityLinks = {
  candidates: [
    {
      targetType: "person",
      localEntityKey: "person_2",
      label: "Jordi Torras",
      mentionKind: "name",
      anchorText: "Jordi Torras",
      anchorOccurrence: 1,
      rationale: "The signal explicitly names Jordi Torras as a person.",
      confidence: 0.82,
    },
  ],
} satisfies SignalEntityLinkingModelOutput;

const usage = {
  inputTokens: {
    total: 31,
    noCache: 31,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 63, text: 63, reasoning: undefined },
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

describe("classifySignalEntityLinks", () => {
  it("builds a signal entity linking request with signal context", () => {
    const input =
      "Jordi Torras asked us to email jordi@example.com after the launch.";
    const request = buildSignalEntityLinkingRequest({
      classification: signalClassification,
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      deterministicCandidates,
      input,
      signalId,
    });

    expect(SIGNAL_ENTITY_LINKER_MODEL).toBe("openai/gpt-5.4-nano");
    expect(SIGNAL_ENTITY_LINKER_WORKFLOW).toBe("index-signal-entities");
    expect(SIGNAL_ENTITY_LINKER_PROMPT_ID).toBe("signal-entity-linker");
    expect(request).toEqual(
      expect.objectContaining({
        classification: signalClassification,
        clerkOrgId: "org_test",
        deploymentEnvironment: "development",
        deterministicCandidates,
        inputLength: input.length,
        model: SIGNAL_ENTITY_LINKER_MODEL,
        signalId,
        system: SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT,
      })
    );
    expect(request.prompt).toContain(input);
    expect(request.prompt).toContain(JSON.stringify(signalClassification));
    expect(request.prompt).toContain(JSON.stringify(deterministicCandidates));
  });

  it("uses structured output and stamps schema version and extraction method", async () => {
    const model = createClassifierModel(JSON.stringify(modelOwnedEntityLinks));
    const request = {
      ...buildSignalEntityLinkingRequest({
        classification: signalClassification,
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        deterministicCandidates,
        input: "Jordi Torras asked us to email jordi@example.com.",
        signalId,
      }),
      model,
    };

    await expect(
      classifySignalEntityLinks(request, { logger })
    ).resolves.toEqual({
      schemaVersion: "signal.entity-links.v1",
      candidates: [
        {
          ...modelOwnedEntityLinks.candidates[0],
          extractionMethod: "ai",
        },
      ],
    });

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0]).toEqual(
      expect.objectContaining({
        maxOutputTokens: 768,
        responseFormat: expect.objectContaining({ type: "json" }),
      })
    );
  });

  it("logs signal entity linker graph metadata on success", async () => {
    const model = createClassifierModel(JSON.stringify(modelOwnedEntityLinks));
    const input = "Jordi Torras asked us to email jordi@example.com.";
    const request = {
      ...buildSignalEntityLinkingRequest({
        classification: signalClassification,
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        deterministicCandidates,
        input,
        signalId,
      }),
      model,
    };

    await classifySignalEntityLinks(request, { logger });

    expect(logger.info).toHaveBeenCalledWith(
      "[entity-links] classification completed",
      expect.objectContaining({
        agentGraphId: "signal-intake",
        agentRunId: signalId,
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        feature: "entity-links",
        inputLength: input.length,
        nodeId: "signal-entity-linker",
        nodeKind: "llm",
        nodeRole: "extractor",
        promptId: "signal-entity-linker",
        routerId: "signals",
        signalId,
        upstreamNodeId: "signal-classifier",
        workflow: "index-signal-entities",
      })
    );
  });

  it("maps invalid model output to a durable signal entity linking failure code", async () => {
    const model = createClassifierModel(
      JSON.stringify({ candidates: [{ targetType: "project" }] })
    );
    const request = {
      ...buildSignalEntityLinkingRequest({
        classification: signalClassification,
        clerkOrgId: "org_test",
        deploymentEnvironment: "preview",
        deterministicCandidates,
        input: "Jordi Torras asked us to email jordi@example.com.",
        signalId,
      }),
      model,
    };

    const failure = await classifySignalEntityLinks(request, { logger }).catch(
      (error) => getSignalEntityLinkingFailure(error)
    );

    expect(failure.errorCode).toBe(
      SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE
    );
  });

  it("instructs the model to link only explicit raw-input person references", () => {
    expect(SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT).toContain(
      "Name-only person references are allowed"
    );
    expect(SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT).toContain(
      "Do not extract role-only"
    );
    expect(SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT).toContain(
      "anchorText must be an exact substring"
    );
    expect(SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT).toContain("Do not browse");
  });
});

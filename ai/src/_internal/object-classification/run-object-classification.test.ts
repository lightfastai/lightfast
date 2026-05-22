import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { runObjectClassification } from "./run-object-classification";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

const usage = {
  inputTokens: {
    total: 4,
    noCache: 4,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 8, text: 8, reasoning: undefined },
};

function modelReturning(text: string) {
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

describe("runObjectClassification", () => {
  it("runs structured output with metadata-only telemetry", async () => {
    const model = modelReturning(JSON.stringify({ title: "Engage profile" }));

    await expect(
      runObjectClassification({
        failureMessage: "[test] failed",
        getFailure: (error) => ({
          errorCode: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
        logger,
        maxOutputTokens: 128,
        metadata: {
          clerkOrgId: "org_test",
          promptId: "test-classifier",
          signalId: "sig_123",
        },
        model,
        prompt: "Classify the input",
        schema: z.object({ title: z.string() }),
        successMessage: "[test] completed",
        system: "You are a classifier.",
        timeoutMs: 10_000,
        telemetryFunctionId: "test.classifier",
      })
    ).resolves.toEqual({ title: "Engage profile" });

    expect(model.doGenerateCalls[0]).toEqual(
      expect.objectContaining({
        maxOutputTokens: 128,
        responseFormat: expect.objectContaining({ type: "json" }),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "[test] completed",
      expect.objectContaining({
        clerkOrgId: "org_test",
        model: "openai/gpt-5.4-nano",
        promptId: "test-classifier",
        signalId: "sig_123",
        usage: expect.objectContaining({
          inputTokens: 4,
          outputTokens: 8,
          totalTokens: 12,
        }),
      })
    );
    expect(logger.info.mock.calls[0]?.[1]).not.toHaveProperty("prompt");
    expect(logger.info.mock.calls[0]?.[1]).not.toHaveProperty("output");
  });

  it("logs durable failure metadata and rethrows", async () => {
    const model = modelReturning(JSON.stringify({ missing: true }));

    await expect(
      runObjectClassification({
        failureMessage: "[test] failed",
        getFailure: () => ({
          errorCode: "INVALID_OUTPUT",
          errorMessage: "invalid output",
        }),
        logger,
        maxOutputTokens: 128,
        metadata: {
          clerkOrgId: "org_test",
          promptId: "test-classifier",
          signalId: "sig_123",
        },
        model,
        prompt: "Classify the input",
        schema: z.object({ title: z.string() }),
        successMessage: "[test] completed",
        system: "You are a classifier.",
        timeoutMs: 10_000,
        telemetryFunctionId: "test.classifier",
      })
    ).rejects.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      "[test] failed",
      expect.objectContaining({
        errorCode: "INVALID_OUTPUT",
        errorMessage: "invalid output",
        promptId: "test-classifier",
      })
    );
  });
});

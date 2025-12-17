/**
 * Neural Workflow AI Helpers
 *
 * Provides wrapped AI SDK functions with Braintrust middleware
 * for use with Inngest step.ai.wrap()
 */

import { generateObject, generateText, wrapLanguageModel } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { BraintrustMiddleware } from "braintrust";
import type { LanguageModel } from "ai";

/**
 * Creates a model wrapped with Braintrust middleware for tracing
 */
export function createTracedModel(modelId: string): LanguageModel {
  return wrapLanguageModel({
    model: gateway(modelId),
    middleware: BraintrustMiddleware({ debug: false }),
  });
}

/**
 * Default telemetry metadata for neural workflows
 */
export function buildNeuralTelemetry(
  functionId: string,
  metadata: Record<string, string | number | boolean>
) {
  return {
    isEnabled: true,
    functionId,
    metadata: {
      context: "neural-workflow",
      ...metadata,
    },
  };
}

// Re-export AI SDK functions for step.ai.wrap()
export { generateObject, generateText };

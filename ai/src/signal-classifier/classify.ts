import "server-only";

import type { SignalClassification } from "@repo/api-contract";
import {
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  Output,
} from "ai";

import {
  SIGNAL_CLASSIFICATION_SCHEMA_VERSION,
  SIGNAL_CLASSIFIER_MAX_OUTPUT_TOKENS,
  SIGNAL_CLASSIFIER_MODEL,
  SIGNAL_CLASSIFIER_TELEMETRY_FUNCTION_ID,
  SIGNAL_CLASSIFIER_TIMEOUT_MS,
} from "./constants";
import { getSignalClassificationFailure } from "./errors";
import { SIGNAL_CLASSIFIER_SYSTEM_PROMPT } from "./prompt";
import { signalClassificationModelSchema } from "./schema";

type LogMetadata = Record<string, unknown>;

export interface SignalClassifierLogger {
  info(message: string, metadata: LogMetadata): void;
  warn(message: string, metadata: LogMetadata): void;
}

const noopLogger: SignalClassifierLogger = {
  info: () => undefined,
  warn: () => undefined,
};

export interface SignalClassificationRequest {
  clerkOrgId: string;
  inputLength: number;
  model: LanguageModel;
  signalId: string;
  system: string;
  prompt: string;
}

export interface BuildSignalClassificationRequestInput {
  clerkOrgId: string;
  input: string;
  signalId: string;
}

export interface ClassifySignalInputOptions {
  logger?: SignalClassifierLogger;
}

export function buildSignalClassificationRequest({
  clerkOrgId,
  input,
  signalId,
}: BuildSignalClassificationRequestInput): SignalClassificationRequest {
  return {
    clerkOrgId,
    inputLength: input.length,
    model: SIGNAL_CLASSIFIER_MODEL,
    signalId,
    system: SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
    prompt: `Classify this signal input:\n\n${input}`,
  };
}

export async function classifySignalInput(
  {
    clerkOrgId,
    inputLength,
    model,
    prompt,
    signalId,
    system,
  }: SignalClassificationRequest,
  { logger = noopLogger }: ClassifySignalInputOptions = {}
): Promise<SignalClassification> {
  const modelName = getModelName(model);

  try {
    const { finishReason, output, usage, warnings } = await generateText({
      model,
      output: Output.object({ schema: signalClassificationModelSchema }),
      system,
      prompt,
      maxOutputTokens: SIGNAL_CLASSIFIER_MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      timeout: { totalMs: SIGNAL_CLASSIFIER_TIMEOUT_MS },
      experimental_telemetry: {
        functionId: SIGNAL_CLASSIFIER_TELEMETRY_FUNCTION_ID,
        isEnabled: true,
        metadata: {
          clerkOrgId,
          inputLength,
          schemaVersion: SIGNAL_CLASSIFICATION_SCHEMA_VERSION,
          signalId,
        },
        recordInputs: false,
        recordOutputs: false,
      },
    });

    logger.info("[signals] classification completed", {
      clerkOrgId,
      finishReason: formatFinishReason(finishReason),
      inputLength,
      model: modelName,
      signalId,
      usage: formatUsage(usage),
      warnings: warnings?.length ?? 0,
    });

    return { ...output, schemaVersion: SIGNAL_CLASSIFICATION_SCHEMA_VERSION };
  } catch (error) {
    const failure = getSignalClassificationFailure(error);

    logger.warn("[signals] classification failed", {
      clerkOrgId,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      inputLength,
      model: modelName,
      signalId,
    });

    throw error;
  }
}

function getModelName(model: LanguageModel): string {
  if (typeof model === "string") {
    return model;
  }

  return `${model.provider}/${model.modelId}`;
}

function formatFinishReason(finishReason: unknown): string {
  if (typeof finishReason === "string") {
    return finishReason;
  }

  if (
    finishReason &&
    typeof finishReason === "object" &&
    "unified" in finishReason &&
    typeof finishReason.unified === "string"
  ) {
    return finishReason.unified;
  }

  return String(finishReason);
}

function formatUsage(usage: LanguageModelUsage): Record<string, number> {
  const inputTokens = readTokenTotal(usage.inputTokens);
  const outputTokens = readTokenTotal(usage.outputTokens);

  return Object.fromEntries(
    Object.entries({
      inputTokens,
      outputTokens,
      totalTokens:
        typeof inputTokens === "number" && typeof outputTokens === "number"
          ? inputTokens + outputTokens
          : usage.totalTokens,
    }).filter(([, value]) => typeof value === "number")
  ) as Record<string, number>;
}

function readTokenTotal(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "total" in value &&
    typeof value.total === "number"
  ) {
    return value.total;
  }

  return undefined;
}

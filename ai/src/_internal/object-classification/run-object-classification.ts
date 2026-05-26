import { generateText, type LanguageModel, Output } from "@vendor/ai";
import type { ZodType } from "zod";

import { formatFinishReason, formatUsage, getModelName } from "./telemetry";

type LogMetadata = Record<string, unknown>;

export interface ObjectClassificationLogger {
  info(message: string, metadata: LogMetadata): void;
  warn(message: string, metadata: LogMetadata): void;
}

export interface ClassificationFailure {
  errorCode: string;
  errorMessage: string;
}

export interface RunObjectClassificationInput<T> {
  failureMessage: string;
  getFailure(error: unknown): ClassificationFailure;
  logger: ObjectClassificationLogger;
  maxOutputTokens: number;
  metadata: LogMetadata;
  model: LanguageModel;
  prompt: string;
  schema: ZodType<T>;
  successMessage: string;
  system: string;
  telemetryFunctionId: string;
  timeoutMs: number;
}

export async function runObjectClassification<T>({
  failureMessage,
  getFailure,
  logger,
  maxOutputTokens,
  metadata,
  model,
  prompt,
  schema,
  successMessage,
  system,
  telemetryFunctionId,
  timeoutMs,
}: RunObjectClassificationInput<T>): Promise<T> {
  const fullMetadata = {
    ...metadata,
    model: getModelName(model),
  };

  try {
    const { finishReason, output, usage, warnings } = await generateText({
      model,
      output: Output.object({ schema }),
      system,
      prompt,
      maxOutputTokens,
      maxRetries: 0,
      timeout: { totalMs: timeoutMs },
      experimental_telemetry: {
        functionId: telemetryFunctionId,
        isEnabled: true,
        metadata: fullMetadata,
        recordInputs: false,
        recordOutputs: false,
      },
    });

    logger.info(successMessage, {
      ...fullMetadata,
      finishReason: formatFinishReason(finishReason),
      usage: formatUsage(usage),
      warnings: warnings?.length ?? 0,
    });

    return output;
  } catch (error) {
    const failure = getFailure(error);

    logger.warn(failureMessage, {
      ...fullMetadata,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
    });

    throw error;
  }
}

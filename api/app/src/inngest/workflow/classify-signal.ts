import {
  claimSignalForClassification,
  getSignalByPublicId,
  markSignalClassified,
  markSignalFailed,
} from "@db/app";
import { db } from "@db/app/client";
import {
  type SignalClassification,
  signalClassificationSchema,
} from "@repo/api-contract";
import { log } from "@vendor/observability/log/next";
import {
  APICallError,
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  NoObjectGeneratedError,
  Output,
  RetryError,
} from "ai";

import { inngest } from "../client";

const SIGNAL_CLASSIFICATION_SCHEMA_VERSION = "signal.classification.v1";
const SIGNAL_CLASSIFIER_MAX_OUTPUT_TOKENS = 512;
const SIGNAL_CLASSIFIER_TIMEOUT_MS = 30_000;
const SIGNAL_CLASSIFIER_TELEMETRY_FUNCTION_ID =
  "app.inngest.classify-signal";

export const SIGNAL_CLASSIFIER_MODEL = "openai/gpt-5.4-nano";
export const SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE =
  "CLASSIFICATION_FAILED";
export const SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE =
  "CLASSIFICATION_PROVIDER_ERROR";
export const SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE =
  "CLASSIFICATION_INVALID_OUTPUT";
export const SIGNAL_CLASSIFICATION_TIMEOUT_ERROR_CODE =
  "CLASSIFICATION_TIMEOUT";

export const SIGNAL_CLASSIFIER_SYSTEM_PROMPT = `You are the Lightfast signal classifier.

You receive one raw text input submitted by an external automation or user.
Your job is to decide whether the input describes a useful signal for the user to act on.

A signal is a possible action worth considering. It may be a task, reminder, follow-up, review item, reply opening, investigation lead, or anything else that could be useful work.

Do not execute the action.
Do not browse the web.
Do not invent facts not present in the input.
Do not assume private context that was not provided.
Preserve uncertainty.

Field rules:
- title: short, human-readable, max 80 characters.
- summary: one sentence describing the signal.
- kind: the kind of signal — one of "engage", "follow_up", "review", "fix", "investigate", "remember", or "other".
- nextAction: one concrete action the user could take next.
- rationale: brief explanation of why this classification was chosen.
- confidence: number from 0 to 1.
- Use disposition "needs_context" when the input might be useful but lacks enough detail.
- Use disposition "not_actionable" when the input is noise, spam, purely descriptive, or has no plausible user action.
- Use priority "urgent" only when the input implies immediate time sensitivity or blocking impact.`;

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

// `schemaVersion` is a fixed, code-owned literal — the model must not be asked
// to generate it. Classify against the model-owned fields only, then stamp the
// version server-side.
const signalClassificationModelSchema = signalClassificationSchema.omit({
  schemaVersion: true,
});

export async function classifySignalInput({
  clerkOrgId,
  inputLength,
  model,
  prompt,
  signalId,
  system,
}: SignalClassificationRequest): Promise<SignalClassification> {
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

    log.info("[signals] classification completed", {
      clerkOrgId,
      finishReason,
      inputLength,
      model: modelName,
      signalId,
      usage: formatUsage(usage),
      warnings: warnings?.length ?? 0,
    });

    return { ...output, schemaVersion: SIGNAL_CLASSIFICATION_SCHEMA_VERSION };
  } catch (error) {
    const failure = getSignalClassificationFailure(error);

    log.warn("[signals] classification failed", {
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getSignalClassificationFailure(error: unknown): {
  errorCode: string;
  errorMessage: string;
} {
  const errorMessage = getErrorMessage(error);

  if (isInvalidOutputError(error)) {
    return {
      errorCode: SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
      errorMessage,
    };
  }

  if (isTimeoutError(error)) {
    return {
      errorCode: SIGNAL_CLASSIFICATION_TIMEOUT_ERROR_CODE,
      errorMessage,
    };
  }

  if (isProviderError(error)) {
    return {
      errorCode: SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE,
      errorMessage,
    };
  }

  return {
    errorCode: SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE,
    errorMessage,
  };
}

function getModelName(model: LanguageModel): string {
  if (typeof model === "string") {
    return model;
  }

  return `${model.provider}/${model.modelId}`;
}

function formatUsage(usage: LanguageModelUsage): Record<string, number> {
  return Object.fromEntries(
    Object.entries({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    }).filter(([, value]) => typeof value === "number")
  ) as Record<string, number>;
}

function isInvalidOutputError(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    hasErrorName(error, "AI_NoObjectGeneratedError") ||
    hasCauseMatching(error, isInvalidOutputError)
  );
}

function isTimeoutError(error: unknown): boolean {
  return (
    hasErrorName(error, "AbortError") ||
    hasErrorName(error, "TimeoutError") ||
    (RetryError.isInstance(error) && error.reason === "abort") ||
    hasCauseMatching(error, isTimeoutError)
  );
}

function isProviderError(error: unknown): boolean {
  return (
    APICallError.isInstance(error) ||
    hasErrorName(error, "AI_APICallError") ||
    hasErrorName(error, "GatewayError") ||
    hasCauseMatching(error, isProviderError)
  );
}

function hasErrorName(error: unknown, name: string): boolean {
  return (
    error instanceof Error &&
    (error.name === name || error.name.includes(name))
  );
}

function hasCauseMatching(
  error: unknown,
  predicate: (error: unknown) => boolean
): boolean {
  if (!(error instanceof Error) || !("cause" in error)) {
    return false;
  }

  return predicate(error.cause);
}

export const classifySignal = inngest.createFunction(
  {
    id: "classify-signal",
    idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
    retries: 3,
    onFailure: async ({ event, error, step }) => {
      const { clerkOrgId, signalId } = event.data.event.data;
      const failure = getSignalClassificationFailure(error);

      await step.run("mark signal failed after retries", () =>
        markSignalFailed(db, {
          clerkOrgId,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          publicId: signalId,
        })
      );

      return { status: "failed" };
    },
  },
  { event: "app/signal.created" },
  async ({ event, step }) => {
    const { clerkOrgId, signalId } = event.data;

    const signal = await step.run("load signal", () =>
      getSignalByPublicId(db, {
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!signal) {
      return { status: "missing" };
    }

    const claimed = await step.run("claim signal", () =>
      claimSignalForClassification(db, {
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!claimed) {
      return { status: "skipped" };
    }

    const classificationRequest = buildSignalClassificationRequest({
      clerkOrgId,
      input: signal.input,
      signalId,
    });
    const classification = await step.ai.wrap(
      "classify signal",
      classifySignalInput,
      classificationRequest
    );

    const persisted = await step.run("persist signal classification", () =>
      markSignalClassified(db, {
        classification,
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!persisted) {
      return { status: "skipped" };
    }

    return { status: "classified" };
  }
);

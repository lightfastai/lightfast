import "server-only";

import type { SignalClassification } from "@repo/api-contract";
import type { LanguageModel } from "ai";

import {
  runObjectClassification,
  type ObjectClassificationLogger,
} from "../_internal/object-classification/run-object-classification";
import {
  SIGNAL_CLASSIFICATION_SCHEMA_VERSION,
  SIGNAL_CLASSIFIER_FEATURE,
  SIGNAL_CLASSIFIER_MAX_OUTPUT_TOKENS,
  SIGNAL_CLASSIFIER_MODEL,
  SIGNAL_CLASSIFIER_PROMPT_ID,
  SIGNAL_CLASSIFIER_TELEMETRY_FUNCTION_ID,
  SIGNAL_CLASSIFIER_TIMEOUT_MS,
  SIGNAL_CLASSIFIER_WORKFLOW,
} from "./constants";
import { getSignalClassificationFailure } from "./errors";
import { SIGNAL_CLASSIFIER_SYSTEM_PROMPT } from "./prompt";
import { signalClassificationModelSchema } from "./schema";

export type SignalClassifierLogger = ObjectClassificationLogger;

const noopLogger: SignalClassifierLogger = {
  info: () => undefined,
  warn: () => undefined,
};

export type DeploymentEnvironment = "development" | "preview" | "production";

export interface SignalClassificationRequest {
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  inputLength: number;
  model: LanguageModel;
  signalId: string;
  system: string;
  prompt: string;
}

export interface BuildSignalClassificationRequestInput {
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  input: string;
  signalId: string;
}

export interface ClassifySignalInputOptions {
  logger?: SignalClassifierLogger;
}

export function buildSignalClassificationRequest({
  clerkOrgId,
  deploymentEnvironment,
  input,
  signalId,
}: BuildSignalClassificationRequestInput): SignalClassificationRequest {
  return {
    clerkOrgId,
    deploymentEnvironment,
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
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    signalId,
    system,
  }: SignalClassificationRequest,
  { logger = noopLogger }: ClassifySignalInputOptions = {}
): Promise<SignalClassification> {
  const output = await runObjectClassification({
    failureMessage: "[signals] classification failed",
    getFailure: getSignalClassificationFailure,
    logger,
    maxOutputTokens: SIGNAL_CLASSIFIER_MAX_OUTPUT_TOKENS,
    metadata: {
      clerkOrgId,
      deploymentEnvironment,
      feature: SIGNAL_CLASSIFIER_FEATURE,
      inputLength,
      promptId: SIGNAL_CLASSIFIER_PROMPT_ID,
      schemaVersion: SIGNAL_CLASSIFICATION_SCHEMA_VERSION,
      signalId,
      workflow: SIGNAL_CLASSIFIER_WORKFLOW,
    },
    model,
    prompt,
    schema: signalClassificationModelSchema,
    successMessage: "[signals] classification completed",
    system,
    telemetryFunctionId: SIGNAL_CLASSIFIER_TELEMETRY_FUNCTION_ID,
    timeoutMs: SIGNAL_CLASSIFIER_TIMEOUT_MS,
  });

  return { ...output, schemaVersion: SIGNAL_CLASSIFICATION_SCHEMA_VERSION };
}

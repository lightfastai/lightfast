import "server-only";

import { createAgentNodeMetadata } from "@repo/ai/telemetry";
import type { SignalClassification } from "@repo/api-contract";
import type { LanguageModel } from "@vendor/ai";

import { signalIntakeAgentGraph } from "../_internal/agent-graphs/signal-intake";
import {
  type ObjectClassificationLogger,
  runObjectClassification,
} from "../_internal/object-classification/run-object-classification";
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

export type SignalClassifierLogger = ObjectClassificationLogger;

const noopLogger: SignalClassifierLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const signalClassifierNode = signalIntakeAgentGraph.nodes.signalClassifier;

export type DeploymentEnvironment = "development" | "preview" | "production";

export interface SignalClassificationRequest {
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  inputLength: number;
  model: LanguageModel;
  prompt: string;
  signalId: string;
  system: string;
}

export interface BuildSignalClassificationRequestInput {
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  input: string;
  organizationIdentitySystemSection?: string | null;
  signalId: string;
}

export interface ClassifySignalInputOptions {
  logger?: SignalClassifierLogger;
}

export function buildSignalClassificationRequest({
  clerkOrgId,
  deploymentEnvironment,
  input,
  organizationIdentitySystemSection,
  signalId,
}: BuildSignalClassificationRequestInput): SignalClassificationRequest {
  const system = organizationIdentitySystemSection
    ? `${SIGNAL_CLASSIFIER_SYSTEM_PROMPT}\n\n${organizationIdentitySystemSection}`
    : SIGNAL_CLASSIFIER_SYSTEM_PROMPT;

  return {
    clerkOrgId,
    deploymentEnvironment,
    inputLength: input.length,
    model: SIGNAL_CLASSIFIER_MODEL,
    signalId,
    system,
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
      ...createAgentNodeMetadata(signalIntakeAgentGraph, signalClassifierNode, {
        agentRunId: signalId,
        clerkOrgId,
        deploymentEnvironment,
        inputLength,
      }),
      signalId,
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

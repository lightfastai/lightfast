import "server-only";

import { createAgentNodeMetadata } from "@repo/ai/telemetry";
import type { LanguageModel } from "@vendor/ai";

import { triageAgentGraph } from "../_internal/agent-graphs/triage";
import {
  type ObjectClassificationLogger,
  runObjectClassification,
} from "../_internal/object-classification/run-object-classification";
import {
  TRIAGE_MODEL,
  TRIAGE_SOURCE_CLASSIFICATION_SCHEMA_VERSION,
  TRIAGE_SOURCE_CLASSIFIER_MAX_OUTPUT_TOKENS,
  TRIAGE_SOURCE_CLASSIFIER_TELEMETRY_FUNCTION_ID,
  TRIAGE_TIMEOUT_MS,
} from "./constants";
import { getTriageFailure } from "./errors";
import { TRIAGE_SOURCE_CLASSIFIER_SYSTEM_PROMPT } from "./prompt";
import {
  type TriageSourceItem,
  type TriageSourceItemClassification,
  triageSourceItemClassificationModelSchema,
} from "./schema";

const noopLogger: ObjectClassificationLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const sourceClassifierNode = triageAgentGraph.nodes.triageSourceClassifier;

export type DeploymentEnvironment = "development" | "preview" | "production";

export interface TriageSourceItemClassificationRequest {
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  inputLength: number;
  model: LanguageModel;
  prompt: string;
  sourceItem: TriageSourceItem;
  system: string;
  triageRunId: string;
}

export interface BuildTriageSourceItemClassificationRequestInput {
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  sourceItem: TriageSourceItem;
  triageRunId: string;
}

export interface ClassifyTriageSourceItemOptions {
  logger?: ObjectClassificationLogger;
}

function formatSourceLabel(sourceItem: TriageSourceItem): string {
  const provider =
    sourceItem.provider === "github"
      ? "GitHub"
      : sourceItem.provider === "linear"
        ? "Linear"
        : "Lightfast";
  return `${provider} ${sourceItem.sourceType.replace(/_/g, " ")}`;
}

function sourceItemPrompt(sourceItem: TriageSourceItem): string {
  return [
    `Source item (${formatSourceLabel(sourceItem)}):`,
    JSON.stringify(sourceItem, null, 2),
  ].join("\n");
}

export function buildTriageSourceItemClassificationRequest({
  clerkOrgId,
  deploymentEnvironment,
  sourceItem,
  triageRunId,
}: BuildTriageSourceItemClassificationRequestInput): TriageSourceItemClassificationRequest {
  const prompt = [
    "Classify this source item for the Lightfast Triage Inbox.",
    "",
    sourceItemPrompt(sourceItem),
  ].join("\n");

  return {
    clerkOrgId,
    deploymentEnvironment,
    inputLength: prompt.length,
    model: TRIAGE_MODEL,
    prompt,
    sourceItem,
    system: TRIAGE_SOURCE_CLASSIFIER_SYSTEM_PROMPT,
    triageRunId,
  };
}

export async function classifyTriageSourceItem(
  {
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    triageRunId,
    system,
  }: TriageSourceItemClassificationRequest,
  { logger = noopLogger }: ClassifyTriageSourceItemOptions = {}
): Promise<TriageSourceItemClassification> {
  const output = await runObjectClassification({
    failureMessage: "[triage] source item classification failed",
    getFailure: getTriageFailure,
    logger,
    maxOutputTokens: TRIAGE_SOURCE_CLASSIFIER_MAX_OUTPUT_TOKENS,
    metadata: {
      ...createAgentNodeMetadata(triageAgentGraph, sourceClassifierNode, {
        agentRunId: triageRunId,
        clerkOrgId,
        deploymentEnvironment,
        inputLength,
      }),
      triageRunId,
    },
    model,
    prompt,
    schema: triageSourceItemClassificationModelSchema,
    successMessage: "[triage] source item classification completed",
    system,
    telemetryFunctionId: TRIAGE_SOURCE_CLASSIFIER_TELEMETRY_FUNCTION_ID,
    timeoutMs: TRIAGE_TIMEOUT_MS,
  });

  const { suggestedOwner, ...classification } = output;
  return {
    ...classification,
    ...(suggestedOwner ? { suggestedOwner } : {}),
    schemaVersion: TRIAGE_SOURCE_CLASSIFICATION_SCHEMA_VERSION,
  };
}

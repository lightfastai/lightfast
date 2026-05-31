import "server-only";

import { createAgentNodeMetadata } from "@repo/ai/telemetry";
import type { LanguageModel } from "@vendor/ai";

import { triageAgentGraph } from "../_internal/agent-graphs/triage";
import {
  type ObjectClassificationLogger,
  runObjectClassification,
} from "../_internal/object-classification/run-object-classification";
import type { DeploymentEnvironment } from "./classify-source-item";
import {
  TRIAGE_MODEL,
  TRIAGE_SIMILARITY_MAX_OUTPUT_TOKENS,
  TRIAGE_SIMILARITY_SCHEMA_VERSION,
  TRIAGE_SIMILARITY_TELEMETRY_FUNCTION_ID,
  TRIAGE_TIMEOUT_MS,
} from "./constants";
import { getTriageFailure } from "./errors";
import { TRIAGE_SIMILARITY_SYSTEM_PROMPT } from "./prompt";
import {
  type TriageSimilarityCandidate,
  type TriageSimilarityRank,
  type TriageSourceItem,
  triageSimilarityRankModelSchema,
} from "./schema";

const noopLogger: ObjectClassificationLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const similarityRankerNode = triageAgentGraph.nodes.triageSimilarityRanker;

export interface TriageSimilarityRequest {
  candidates: TriageSimilarityCandidate[];
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  inputLength: number;
  model: LanguageModel;
  prompt: string;
  sourceItem: TriageSourceItem;
  system: string;
  triageRunId: string;
}

export interface BuildTriageSimilarityRequestInput {
  candidates: TriageSimilarityCandidate[];
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  sourceItem: TriageSourceItem;
  triageRunId: string;
}

export interface RankTriageSimilarItemsOptions {
  logger?: ObjectClassificationLogger;
}

export function buildTriageSimilarityRequest({
  candidates,
  clerkOrgId,
  deploymentEnvironment,
  sourceItem,
  triageRunId,
}: BuildTriageSimilarityRequestInput): TriageSimilarityRequest {
  const prompt = [
    "Rank candidate relationships for this source item.",
    "",
    "Source item:",
    JSON.stringify(sourceItem, null, 2),
    "",
    "Candidates:",
    JSON.stringify(candidates.slice(0, 10), null, 2),
  ].join("\n");

  return {
    candidates: candidates.slice(0, 10),
    clerkOrgId,
    deploymentEnvironment,
    inputLength: prompt.length,
    model: TRIAGE_MODEL,
    prompt,
    sourceItem,
    system: TRIAGE_SIMILARITY_SYSTEM_PROMPT,
    triageRunId,
  };
}

export async function rankTriageSimilarItems(
  {
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    triageRunId,
    system,
  }: TriageSimilarityRequest,
  { logger = noopLogger }: RankTriageSimilarItemsOptions = {}
): Promise<TriageSimilarityRank> {
  const output = await runObjectClassification({
    failureMessage: "[triage] similarity ranking failed",
    getFailure: getTriageFailure,
    logger,
    maxOutputTokens: TRIAGE_SIMILARITY_MAX_OUTPUT_TOKENS,
    metadata: {
      ...createAgentNodeMetadata(triageAgentGraph, similarityRankerNode, {
        agentRunId: triageRunId,
        clerkOrgId,
        deploymentEnvironment,
        inputLength,
      }),
      triageRunId,
    },
    model,
    prompt,
    schema: triageSimilarityRankModelSchema,
    successMessage: "[triage] similarity ranking completed",
    system,
    telemetryFunctionId: TRIAGE_SIMILARITY_TELEMETRY_FUNCTION_ID,
    timeoutMs: TRIAGE_TIMEOUT_MS,
  });

  return {
    ...output,
    schemaVersion: TRIAGE_SIMILARITY_SCHEMA_VERSION,
  };
}

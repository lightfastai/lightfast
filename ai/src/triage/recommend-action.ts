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
  TRIAGE_ACTION_RECOMMENDATION_MAX_OUTPUT_TOKENS,
  TRIAGE_ACTION_RECOMMENDATION_SCHEMA_VERSION,
  TRIAGE_ACTION_RECOMMENDATION_TELEMETRY_FUNCTION_ID,
  TRIAGE_MODEL,
  TRIAGE_TIMEOUT_MS,
} from "./constants";
import { getTriageFailure } from "./errors";
import { TRIAGE_ACTION_RECOMMENDER_SYSTEM_PROMPT } from "./prompt";
import {
  type TriageActionPayload,
  type TriageActionRecommendation,
  triageActionRecommendationModelSchema,
  type TriageSourceItem,
  type TriageSourceItemClassification,
  type TriageSimilarityRank,
} from "./schema";

const noopLogger: ObjectClassificationLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const actionRecommenderNode = triageAgentGraph.nodes.triageActionRecommender;

type ModelActionPayload = {
  candidateId: string | null;
  destination: string | null;
  externalId: string | null;
  externalUrl: string | null;
  commentBody: string | null;
};

function compactActionPayload(
  payload: ModelActionPayload | null
): TriageActionPayload | undefined {
  if (!payload) {
    return undefined;
  }

  const compact = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null)
  ) as TriageActionPayload;

  return Object.keys(compact).length > 0 ? compact : undefined;
}

export interface TriageActionRecommendationRequest {
  availableDestinations: string[];
  classification: TriageSourceItemClassification;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  inputLength: number;
  model: LanguageModel;
  prompt: string;
  similarity: TriageSimilarityRank;
  sourceItem: TriageSourceItem;
  system: string;
  triageRunId: string;
}

export interface BuildTriageActionRecommendationRequestInput {
  availableDestinations: string[];
  classification: TriageSourceItemClassification;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  similarity: TriageSimilarityRank;
  sourceItem: TriageSourceItem;
  triageRunId: string;
}

export interface RecommendTriageActionOptions {
  logger?: ObjectClassificationLogger;
}

export function buildTriageActionRecommendationRequest({
  availableDestinations,
  classification,
  clerkOrgId,
  deploymentEnvironment,
  similarity,
  sourceItem,
  triageRunId,
}: BuildTriageActionRecommendationRequestInput): TriageActionRecommendationRequest {
  const prompt = [
    "Recommend the next human-facing triage action.",
    "",
    "Input:",
    JSON.stringify(
      {
        sourceItem,
        classification,
        similarity,
        availableDestinations,
      },
      null,
      2
    ),
  ].join("\n");

  return {
    availableDestinations,
    classification,
    clerkOrgId,
    deploymentEnvironment,
    inputLength: prompt.length,
    model: TRIAGE_MODEL,
    prompt,
    similarity,
    sourceItem,
    system: TRIAGE_ACTION_RECOMMENDER_SYSTEM_PROMPT,
    triageRunId,
  };
}

export async function recommendTriageAction(
  {
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    triageRunId,
    system,
  }: TriageActionRecommendationRequest,
  { logger = noopLogger }: RecommendTriageActionOptions = {}
): Promise<TriageActionRecommendation> {
  const output = await runObjectClassification({
    failureMessage: "[triage] action recommendation failed",
    getFailure: getTriageFailure,
    logger,
    maxOutputTokens: TRIAGE_ACTION_RECOMMENDATION_MAX_OUTPUT_TOKENS,
    metadata: {
      ...createAgentNodeMetadata(triageAgentGraph, actionRecommenderNode, {
        agentRunId: triageRunId,
        clerkOrgId,
        deploymentEnvironment,
        inputLength,
      }),
      triageRunId,
    },
    model,
    prompt,
    schema: triageActionRecommendationModelSchema,
    successMessage: "[triage] action recommendation completed",
    system,
    telemetryFunctionId: TRIAGE_ACTION_RECOMMENDATION_TELEMETRY_FUNCTION_ID,
    timeoutMs: TRIAGE_TIMEOUT_MS,
  });

  return {
    ...output,
    actions: output.actions.map(({ payload, ...action }) => {
      const compactPayload = compactActionPayload(payload);

      return {
        ...action,
        ...(compactPayload ? { payload: compactPayload } : {}),
      };
    }),
    schemaVersion: TRIAGE_ACTION_RECOMMENDATION_SCHEMA_VERSION,
  };
}

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
  SIGNAL_ENTITY_LINKER_MAX_OUTPUT_TOKENS,
  SIGNAL_ENTITY_LINKER_MODEL,
  SIGNAL_ENTITY_LINKER_TELEMETRY_FUNCTION_ID,
  SIGNAL_ENTITY_LINKER_TIMEOUT_MS,
  SIGNAL_ENTITY_LINKS_SCHEMA_VERSION,
} from "./constants";
import { getSignalEntityLinkingFailure } from "./errors";
import { SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT } from "./prompt";
import {
  type SignalEntityLinkCandidate,
  type SignalEntityLinking,
  signalEntityLinkingModelSchema,
} from "./schema";

const noopLogger: ObjectClassificationLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const signalEntityLinkerNode =
  signalIntakeAgentGraph.nodes.signalEntityLinker;

export type DeploymentEnvironment = "development" | "preview" | "production";

export interface SignalEntityLinkingRequest {
  classification: SignalClassification | null;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  deterministicCandidates: SignalEntityLinkCandidate[];
  inputLength: number;
  model: LanguageModel;
  prompt: string;
  signalId: string;
  system: string;
}

export interface BuildSignalEntityLinkingRequestInput {
  classification: SignalClassification | null;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  deterministicCandidates: SignalEntityLinkCandidate[];
  input: string;
  signalId: string;
}

export interface ClassifySignalEntityLinksOptions {
  logger?: ObjectClassificationLogger;
}

export function buildSignalEntityLinkingRequest({
  classification,
  clerkOrgId,
  deploymentEnvironment,
  deterministicCandidates,
  input,
  signalId,
}: BuildSignalEntityLinkingRequestInput): SignalEntityLinkingRequest {
  return {
    classification,
    clerkOrgId,
    deploymentEnvironment,
    deterministicCandidates,
    inputLength: input.length,
    model: SIGNAL_ENTITY_LINKER_MODEL,
    prompt: [
      "Extract explicit person entity links from this signal.",
      "",
      "Signal input:",
      input,
      "",
      "Signal classification:",
      JSON.stringify(classification),
      "",
      "Deterministic candidates:",
      JSON.stringify(deterministicCandidates),
    ].join("\n"),
    signalId,
    system: SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT,
  };
}

export async function classifySignalEntityLinks(
  {
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    signalId,
    system,
  }: SignalEntityLinkingRequest,
  { logger = noopLogger }: ClassifySignalEntityLinksOptions = {}
): Promise<SignalEntityLinking> {
  const output = await runObjectClassification({
    failureMessage: "[entity-links] classification failed",
    getFailure: getSignalEntityLinkingFailure,
    logger,
    maxOutputTokens: SIGNAL_ENTITY_LINKER_MAX_OUTPUT_TOKENS,
    metadata: {
      ...createAgentNodeMetadata(
        signalIntakeAgentGraph,
        signalEntityLinkerNode,
        {
          agentRunId: signalId,
          clerkOrgId,
          deploymentEnvironment,
          inputLength,
        }
      ),
      signalId,
    },
    model,
    prompt,
    schema: signalEntityLinkingModelSchema,
    successMessage: "[entity-links] classification completed",
    system,
    telemetryFunctionId: SIGNAL_ENTITY_LINKER_TELEMETRY_FUNCTION_ID,
    timeoutMs: SIGNAL_ENTITY_LINKER_TIMEOUT_MS,
  });

  return {
    schemaVersion: SIGNAL_ENTITY_LINKS_SCHEMA_VERSION,
    candidates: output.candidates.map((candidate) => ({
      ...candidate,
      extractionMethod: "ai" as const,
    })),
  };
}

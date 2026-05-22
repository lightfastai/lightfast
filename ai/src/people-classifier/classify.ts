import "server-only";

import type { SignalClassification } from "@repo/api-contract";
import type { LanguageModel } from "ai";

import {
  type ObjectClassificationLogger,
  runObjectClassification,
} from "../_internal/object-classification/run-object-classification";
import {
  PEOPLE_CLASSIFICATION_SCHEMA_VERSION,
  PEOPLE_CLASSIFIER_FEATURE,
  PEOPLE_CLASSIFIER_MAX_OUTPUT_TOKENS,
  PEOPLE_CLASSIFIER_MODEL,
  PEOPLE_CLASSIFIER_PROMPT_ID,
  PEOPLE_CLASSIFIER_TELEMETRY_FUNCTION_ID,
  PEOPLE_CLASSIFIER_TIMEOUT_MS,
  PEOPLE_CLASSIFIER_WORKFLOW,
} from "./constants";
import { getPeopleClassificationFailure } from "./errors";
import { PEOPLE_CLASSIFIER_SYSTEM_PROMPT } from "./prompt";
import {
  type PeopleClassification,
  peopleClassificationModelSchema,
} from "./schema";

const noopLogger: ObjectClassificationLogger = {
  info: () => undefined,
  warn: () => undefined,
};

export type DeploymentEnvironment = "development" | "preview" | "production";

export interface PeopleClassificationRequest {
  classification: SignalClassification;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  inputLength: number;
  model: LanguageModel;
  prompt: string;
  signalId: string;
  system: string;
}

export interface BuildPeopleClassificationRequestInput {
  classification: SignalClassification;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  input: string;
  signalId: string;
}

export interface ClassifyPeopleFromSignalOptions {
  logger?: ObjectClassificationLogger;
}

export function buildPeopleClassificationRequest({
  classification,
  clerkOrgId,
  deploymentEnvironment,
  input,
  signalId,
}: BuildPeopleClassificationRequestInput): PeopleClassificationRequest {
  return {
    classification,
    clerkOrgId,
    deploymentEnvironment,
    inputLength: input.length,
    model: PEOPLE_CLASSIFIER_MODEL,
    prompt: [
      "Extract durable people candidates from this signal.",
      "",
      "Signal input:",
      input,
      "",
      "Signal classification:",
      JSON.stringify(classification),
    ].join("\n"),
    signalId,
    system: PEOPLE_CLASSIFIER_SYSTEM_PROMPT,
  };
}

export async function classifyPeopleFromSignal(
  {
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    signalId,
    system,
  }: PeopleClassificationRequest,
  { logger = noopLogger }: ClassifyPeopleFromSignalOptions = {}
): Promise<PeopleClassification> {
  const output = await runObjectClassification({
    failureMessage: "[people] classification failed",
    getFailure: getPeopleClassificationFailure,
    logger,
    maxOutputTokens: PEOPLE_CLASSIFIER_MAX_OUTPUT_TOKENS,
    metadata: {
      clerkOrgId,
      deploymentEnvironment,
      feature: PEOPLE_CLASSIFIER_FEATURE,
      inputLength,
      promptId: PEOPLE_CLASSIFIER_PROMPT_ID,
      schemaVersion: PEOPLE_CLASSIFICATION_SCHEMA_VERSION,
      signalId,
      workflow: PEOPLE_CLASSIFIER_WORKFLOW,
    },
    model,
    prompt,
    schema: peopleClassificationModelSchema,
    successMessage: "[people] classification completed",
    system,
    telemetryFunctionId: PEOPLE_CLASSIFIER_TELEMETRY_FUNCTION_ID,
    timeoutMs: PEOPLE_CLASSIFIER_TIMEOUT_MS,
  });

  return {
    candidates: output.candidates.map(({ displayName, ...candidate }) => ({
      ...candidate,
      ...(displayName ? { displayName } : {}),
    })),
    schemaVersion: PEOPLE_CLASSIFICATION_SCHEMA_VERSION,
  };
}

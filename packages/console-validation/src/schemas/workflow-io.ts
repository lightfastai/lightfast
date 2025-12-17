import { z } from "zod";
import { githubSourceMetadataSchema } from "./source-metadata";
import { sourceTypeSchema } from "./sources";

// =============================================================================
// SOURCE CONNECTED - INPUT
// =============================================================================

const sourceConnectedGitHubInputSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  sourceMetadata: githubSourceMetadataSchema,
});

// Future: sourceConnectedLinearInputSchema, etc.

// =============================================================================
// SOURCE SYNC - INPUT
// =============================================================================

const sourceSyncGitHubInputSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  sourceMetadata: githubSourceMetadataSchema,
  syncMode: z.enum(["full", "incremental"]),
  trigger: z.string(),
  syncParams: z.record(z.unknown()),
});

// Future: sourceSyncLinearInputSchema, etc.

// =============================================================================
// SYNC ORCHESTRATOR - INPUT
// =============================================================================

const syncOrchestratorInputSchema = z.object({
  inngestFunctionId: z.literal("sync.orchestrator"),
  sourceId: z.string(),
  sourceType: sourceTypeSchema, // Uses canonical schema from sources.ts
  syncMode: z.enum(["full", "incremental"]),
  syncParams: z.record(z.unknown()).optional(),
});

// =============================================================================
// NEURAL OBSERVATION CAPTURE - INPUT
// =============================================================================

const neuralObservationCaptureInputSchema = z.object({
  inngestFunctionId: z.literal("neural.observation.capture"),
  sourceId: z.string(),
  source: z.string(), // github, vercel
  sourceType: z.string(), // push, pull_request, deployment.succeeded
  title: z.string(),
});

// =============================================================================
// NEURAL PROFILE UPDATE - INPUT
// =============================================================================

const neuralProfileUpdateInputSchema = z.object({
  inngestFunctionId: z.literal("neural.profile.update"),
  actorId: z.string(),
  observationId: z.string(),
});

// =============================================================================
// NEURAL CLUSTER SUMMARY - INPUT
// =============================================================================

const neuralClusterSummaryInputSchema = z.object({
  inngestFunctionId: z.literal("neural.cluster.summary"),
  clusterId: z.string(),
  observationCount: z.number().int().nonnegative(),
});

// =============================================================================
// NEURAL LLM ENTITY EXTRACTION - INPUT
// =============================================================================

const neuralLLMEntityExtractionInputSchema = z.object({
  inngestFunctionId: z.literal("neural.llm-entity-extraction"),
  observationId: z.string(),
  contentLength: z.number().int().nonnegative(),
});

// =============================================================================
// DISCRIMINATED UNION - ALL INPUTS
// =============================================================================

export const workflowInputSchema = z.discriminatedUnion("inngestFunctionId", [
  sourceConnectedGitHubInputSchema,
  sourceSyncGitHubInputSchema,
  syncOrchestratorInputSchema,
  // Neural workflows
  neuralObservationCaptureInputSchema,
  neuralProfileUpdateInputSchema,
  neuralClusterSummaryInputSchema,
  neuralLLMEntityExtractionInputSchema,
]);

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type SourceConnectedGitHubInput = z.infer<typeof sourceConnectedGitHubInputSchema>;
export type SourceSyncGitHubInput = z.infer<typeof sourceSyncGitHubInputSchema>;
export type SyncOrchestratorInput = z.infer<typeof syncOrchestratorInputSchema>;
export type NeuralObservationCaptureInput = z.infer<typeof neuralObservationCaptureInputSchema>;
export type NeuralProfileUpdateInput = z.infer<typeof neuralProfileUpdateInputSchema>;
export type NeuralClusterSummaryInput = z.infer<typeof neuralClusterSummaryInputSchema>;
export type NeuralLLMEntityExtractionInput = z.infer<typeof neuralLLMEntityExtractionInputSchema>;

// =============================================================================
// SOURCE CONNECTED - OUTPUT (SUCCESS)
// =============================================================================

const sourceConnectedGitHubOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  repoFullName: z.string(),
  syncTriggered: z.boolean(),
  filesProcessed: z.number().int().nonnegative(),
  filesFailed: z.number().int().nonnegative(),
  storeSlug: z.string(),
});

// Future: sourceConnectedLinearOutputSuccessSchema, etc.

// =============================================================================
// SOURCE CONNECTED - OUTPUT (FAILURE)
// =============================================================================

const sourceConnectedGitHubOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  repoFullName: z.string(),
  syncTriggered: z.boolean(),
  filesProcessed: z.number().int().nonnegative(),
  filesFailed: z.number().int().nonnegative(),
  storeSlug: z.string(),
  error: z.string(),
});

// Future: sourceConnectedLinearOutputFailureSchema, etc.

// =============================================================================
// SOURCE SYNC - OUTPUT (SUCCESS)
// =============================================================================

const sourceSyncGitHubOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  repoFullName: z.string(),
  syncMode: z.enum(["full", "incremental"]),
  filesProcessed: z.number().int().nonnegative(),
  filesFailed: z.number().int().nonnegative(),
  timedOut: z.boolean(),
});

// Future: sourceSyncLinearOutputSuccessSchema, etc.

// =============================================================================
// SOURCE SYNC - OUTPUT (FAILURE)
// =============================================================================

const sourceSyncGitHubOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  repoFullName: z.string(),
  syncMode: z.enum(["full", "incremental"]),
  filesProcessed: z.number().int().nonnegative(),
  filesFailed: z.number().int().nonnegative(),
  timedOut: z.boolean(),
  error: z.string(),
});

// Future: sourceSyncLinearOutputFailureSchema, etc.

// =============================================================================
// SYNC ORCHESTRATOR - OUTPUT (SUCCESS)
// =============================================================================

const syncOrchestratorOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("sync.orchestrator"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: sourceTypeSchema, // Uses canonical schema from sources.ts
  itemsProcessed: z.number().int().nonnegative(),
  itemsFailed: z.number().int().nonnegative(),
  embeddingsCreated: z.number().int().nonnegative(),
  syncMode: z.enum(["full", "incremental"]),
});

// =============================================================================
// SYNC ORCHESTRATOR - OUTPUT (FAILURE)
// =============================================================================

const syncOrchestratorOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("sync.orchestrator"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: sourceTypeSchema, // Uses canonical schema from sources.ts
  itemsProcessed: z.number().int().nonnegative(),
  itemsFailed: z.number().int().nonnegative(),
  embeddingsCreated: z.number().int().nonnegative(),
  syncMode: z.enum(["full", "incremental"]),
  error: z.string(),
});

// =============================================================================
// NEURAL OBSERVATION CAPTURE - OUTPUT (SUCCESS)
// =============================================================================

const neuralObservationCaptureOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("neural.observation.capture"),
  status: z.literal("success"),
  observationId: z.string(), // externalId (nanoid)
  observationType: z.string(),
  significanceScore: z.number(),
  entitiesExtracted: z.number().int().nonnegative(),
  clusterId: z.string(),
  clusterIsNew: z.boolean(),
});

// =============================================================================
// NEURAL OBSERVATION CAPTURE - OUTPUT (FILTERED/SKIPPED)
// =============================================================================

const neuralObservationCaptureOutputFilteredSchema = z.object({
  inngestFunctionId: z.literal("neural.observation.capture"),
  status: z.literal("filtered"),
  reason: z.enum(["duplicate", "event_not_allowed", "below_threshold"]),
  sourceId: z.string(),
  significanceScore: z.number().optional(),
});

// =============================================================================
// NEURAL OBSERVATION CAPTURE - OUTPUT (FAILURE)
// =============================================================================

const neuralObservationCaptureOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("neural.observation.capture"),
  status: z.literal("failure"),
  sourceId: z.string(),
  error: z.string(),
  step: z.string().optional(), // Which step failed
});

// =============================================================================
// NEURAL PROFILE UPDATE - OUTPUT (SUCCESS)
// =============================================================================

const neuralProfileUpdateOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("neural.profile.update"),
  status: z.literal("success"),
  actorId: z.string(),
  observationCount: z.number().int().nonnegative(),
  isNewProfile: z.boolean(),
});

// =============================================================================
// NEURAL PROFILE UPDATE - OUTPUT (FAILURE)
// =============================================================================

const neuralProfileUpdateOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("neural.profile.update"),
  status: z.literal("failure"),
  actorId: z.string(),
  error: z.string(),
});

// =============================================================================
// NEURAL CLUSTER SUMMARY - OUTPUT (SUCCESS)
// =============================================================================

const neuralClusterSummaryOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("neural.cluster.summary"),
  status: z.literal("success"),
  clusterId: z.string(),
  summaryGenerated: z.boolean(),
  keyTopics: z.array(z.string()).optional(),
});

// =============================================================================
// NEURAL CLUSTER SUMMARY - OUTPUT (SKIPPED)
// =============================================================================

const neuralClusterSummaryOutputSkippedSchema = z.object({
  inngestFunctionId: z.literal("neural.cluster.summary"),
  status: z.literal("skipped"),
  clusterId: z.string(),
  reason: z.enum(["below_threshold", "summary_recent", "cluster_not_found", "no_observations"]),
});

// =============================================================================
// NEURAL CLUSTER SUMMARY - OUTPUT (FAILURE)
// =============================================================================

const neuralClusterSummaryOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("neural.cluster.summary"),
  status: z.literal("failure"),
  clusterId: z.string(),
  error: z.string(),
});

// =============================================================================
// NEURAL LLM ENTITY EXTRACTION - OUTPUT (SUCCESS)
// =============================================================================

const neuralLLMEntityExtractionOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("neural.llm-entity-extraction"),
  status: z.literal("success"),
  observationId: z.string(),
  entitiesExtracted: z.number().int().nonnegative(),
  entitiesStored: z.number().int().nonnegative(),
});

// =============================================================================
// NEURAL LLM ENTITY EXTRACTION - OUTPUT (SKIPPED)
// =============================================================================

const neuralLLMEntityExtractionOutputSkippedSchema = z.object({
  inngestFunctionId: z.literal("neural.llm-entity-extraction"),
  status: z.literal("skipped"),
  observationId: z.string().optional(),
  reason: z.enum(["observation_not_found", "content_too_short"]),
});

// =============================================================================
// NEURAL LLM ENTITY EXTRACTION - OUTPUT (FAILURE)
// =============================================================================

const neuralLLMEntityExtractionOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("neural.llm-entity-extraction"),
  status: z.literal("failure"),
  observationId: z.string(),
  error: z.string(),
});

// =============================================================================
// DISCRIMINATED UNION - ALL OUTPUTS
// =============================================================================

// We can't use a single discriminatedUnion because both inngestFunctionId and status
// have duplicate values across schemas. Instead, use a regular union.
// TypeScript will still narrow properly when you check both fields.
export const workflowOutputSchema = z.union([
  sourceConnectedGitHubOutputSuccessSchema,
  sourceConnectedGitHubOutputFailureSchema,
  sourceSyncGitHubOutputSuccessSchema,
  sourceSyncGitHubOutputFailureSchema,
  syncOrchestratorOutputSuccessSchema,
  syncOrchestratorOutputFailureSchema,
  // Neural workflows
  neuralObservationCaptureOutputSuccessSchema,
  neuralObservationCaptureOutputFilteredSchema,
  neuralObservationCaptureOutputFailureSchema,
  neuralProfileUpdateOutputSuccessSchema,
  neuralProfileUpdateOutputFailureSchema,
  neuralClusterSummaryOutputSuccessSchema,
  neuralClusterSummaryOutputSkippedSchema,
  neuralClusterSummaryOutputFailureSchema,
  neuralLLMEntityExtractionOutputSuccessSchema,
  neuralLLMEntityExtractionOutputSkippedSchema,
  neuralLLMEntityExtractionOutputFailureSchema,
]);

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;
export type SourceConnectedGitHubOutputSuccess = z.infer<typeof sourceConnectedGitHubOutputSuccessSchema>;
export type SourceConnectedGitHubOutputFailure = z.infer<typeof sourceConnectedGitHubOutputFailureSchema>;
export type SourceSyncGitHubOutputSuccess = z.infer<typeof sourceSyncGitHubOutputSuccessSchema>;
export type SourceSyncGitHubOutputFailure = z.infer<typeof sourceSyncGitHubOutputFailureSchema>;
export type SyncOrchestratorOutputSuccess = z.infer<typeof syncOrchestratorOutputSuccessSchema>;
export type SyncOrchestratorOutputFailure = z.infer<typeof syncOrchestratorOutputFailureSchema>;

// Neural workflow output type exports
export type NeuralObservationCaptureOutputSuccess = z.infer<typeof neuralObservationCaptureOutputSuccessSchema>;
export type NeuralObservationCaptureOutputFiltered = z.infer<typeof neuralObservationCaptureOutputFilteredSchema>;
export type NeuralObservationCaptureOutputFailure = z.infer<typeof neuralObservationCaptureOutputFailureSchema>;
export type NeuralProfileUpdateOutputSuccess = z.infer<typeof neuralProfileUpdateOutputSuccessSchema>;
export type NeuralProfileUpdateOutputFailure = z.infer<typeof neuralProfileUpdateOutputFailureSchema>;
export type NeuralClusterSummaryOutputSuccess = z.infer<typeof neuralClusterSummaryOutputSuccessSchema>;
export type NeuralClusterSummaryOutputSkipped = z.infer<typeof neuralClusterSummaryOutputSkippedSchema>;
export type NeuralClusterSummaryOutputFailure = z.infer<typeof neuralClusterSummaryOutputFailureSchema>;
export type NeuralLLMEntityExtractionOutputSuccess = z.infer<typeof neuralLLMEntityExtractionOutputSuccessSchema>;
export type NeuralLLMEntityExtractionOutputSkipped = z.infer<typeof neuralLLMEntityExtractionOutputSkippedSchema>;
export type NeuralLLMEntityExtractionOutputFailure = z.infer<typeof neuralLLMEntityExtractionOutputFailureSchema>;

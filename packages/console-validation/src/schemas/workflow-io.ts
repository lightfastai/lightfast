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
// DISCRIMINATED UNION - ALL INPUTS
// =============================================================================

export const workflowInputSchema = z.discriminatedUnion("inngestFunctionId", [
  sourceConnectedGitHubInputSchema,
  sourceSyncGitHubInputSchema,
  syncOrchestratorInputSchema,
  // Future:
  // sourceConnectedLinearInputSchema,
  // sourceSyncLinearInputSchema,
]);

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type SourceConnectedGitHubInput = z.infer<typeof sourceConnectedGitHubInputSchema>;
export type SourceSyncGitHubInput = z.infer<typeof sourceSyncGitHubInputSchema>;
export type SyncOrchestratorInput = z.infer<typeof syncOrchestratorInputSchema>;

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
  // Future:
  // sourceConnectedLinearOutputSuccessSchema,
  // sourceConnectedLinearOutputFailureSchema,
  // sourceSyncLinearOutputSuccessSchema,
  // sourceSyncLinearOutputFailureSchema,
]);

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;
export type SourceConnectedGitHubOutputSuccess = z.infer<typeof sourceConnectedGitHubOutputSuccessSchema>;
export type SourceConnectedGitHubOutputFailure = z.infer<typeof sourceConnectedGitHubOutputFailureSchema>;
export type SourceSyncGitHubOutputSuccess = z.infer<typeof sourceSyncGitHubOutputSuccessSchema>;
export type SourceSyncGitHubOutputFailure = z.infer<typeof sourceSyncGitHubOutputFailureSchema>;
export type SyncOrchestratorOutputSuccess = z.infer<typeof syncOrchestratorOutputSuccessSchema>;
export type SyncOrchestratorOutputFailure = z.infer<typeof syncOrchestratorOutputFailureSchema>;

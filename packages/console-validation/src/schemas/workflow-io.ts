import { z } from "zod";
import { githubSourceMetadataSchema, linearSourceMetadataSchema } from "./source-metadata";

// =============================================================================
// SOURCE CONNECTED - INPUT
// =============================================================================

const sourceConnectedGitHubInputSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  sourceMetadata: githubSourceMetadataSchema,
});

const sourceConnectedLinearInputSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  sourceMetadata: linearSourceMetadataSchema,
});

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

const sourceSyncLinearInputSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  sourceMetadata: linearSourceMetadataSchema,
  syncMode: z.enum(["full", "incremental"]),
  trigger: z.string(),
  syncParams: z.record(z.unknown()),
});

// =============================================================================
// DISCRIMINATED UNION - ALL INPUTS
// =============================================================================

export const workflowInputSchema = z.discriminatedUnion("inngestFunctionId", [
  sourceConnectedGitHubInputSchema,
  sourceSyncGitHubInputSchema,
  // Future:
  // sourceConnectedLinearInputSchema,
  // sourceSyncLinearInputSchema,
]);

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type SourceConnectedGitHubInput = z.infer<typeof sourceConnectedGitHubInputSchema>;
export type SourceSyncGitHubInput = z.infer<typeof sourceSyncGitHubInputSchema>;

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

const sourceConnectedLinearOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  syncTriggered: z.boolean(),
  issuesProcessed: z.number().int().nonnegative(),
  issuesFailed: z.number().int().nonnegative(),
});

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

const sourceConnectedLinearOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  syncTriggered: z.boolean(),
  issuesProcessed: z.number().int().nonnegative(),
  issuesFailed: z.number().int().nonnegative(),
  error: z.string(),
});

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

const sourceSyncLinearOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  syncMode: z.enum(["full", "incremental"]),
  issuesProcessed: z.number().int().nonnegative(),
  issuesFailed: z.number().int().nonnegative(),
  timedOut: z.boolean(),
});

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

const sourceSyncLinearOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  syncMode: z.enum(["full", "incremental"]),
  issuesProcessed: z.number().int().nonnegative(),
  issuesFailed: z.number().int().nonnegative(),
  timedOut: z.boolean(),
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

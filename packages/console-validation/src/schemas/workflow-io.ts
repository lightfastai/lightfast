import { sourceTypeSchema } from "@repo/console-providers";
import { z } from "zod";

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
// BACKFILL ORCHESTRATOR - INPUT
// =============================================================================

const backfillOrchestratorInputSchema = z.object({
  inngestFunctionId: z.literal("backfill.orchestrator"),
  integrationId: z.string(),
  provider: sourceTypeSchema,
  depth: z.number(),
  entityTypes: z.array(z.string()),
});

// =============================================================================
// DISCRIMINATED UNION - ALL INPUTS
// =============================================================================

export const workflowInputSchema = z.discriminatedUnion("inngestFunctionId", [
  // Neural workflows
  neuralObservationCaptureInputSchema,
  neuralProfileUpdateInputSchema,
  // Backfill workflows
  backfillOrchestratorInputSchema,
]);

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type NeuralObservationCaptureInput = z.infer<
  typeof neuralObservationCaptureInputSchema
>;
export type NeuralProfileUpdateInput = z.infer<
  typeof neuralProfileUpdateInputSchema
>;

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
// BACKFILL ORCHESTRATOR - OUTPUT (SUCCESS)
// =============================================================================

const backfillOrchestratorOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("backfill.orchestrator"),
  status: z.literal("success"),
  eventsProduced: z.number().int().nonnegative(),
  eventsDispatched: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

// =============================================================================
// BACKFILL ORCHESTRATOR - OUTPUT (FAILURE)
// =============================================================================

const backfillOrchestratorOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("backfill.orchestrator"),
  status: z.literal("failure"),
  error: z.string(),
  eventsProduced: z.number().int().nonnegative(),
  eventsDispatched: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

// =============================================================================
// DISCRIMINATED UNION - ALL OUTPUTS
// =============================================================================

// We can't use a single discriminatedUnion because both inngestFunctionId and status
// have duplicate values across schemas. Instead, use a regular union.
// TypeScript will still narrow properly when you check both fields.
export const workflowOutputSchema = z.union([
  // Neural workflows
  neuralObservationCaptureOutputSuccessSchema,
  neuralObservationCaptureOutputFilteredSchema,
  neuralObservationCaptureOutputFailureSchema,
  neuralProfileUpdateOutputSuccessSchema,
  neuralProfileUpdateOutputFailureSchema,
  // Backfill workflows
  backfillOrchestratorOutputSuccessSchema,
  backfillOrchestratorOutputFailureSchema,
]);

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;

// Neural workflow output type exports
export type NeuralObservationCaptureOutputSuccess = z.infer<
  typeof neuralObservationCaptureOutputSuccessSchema
>;
export type NeuralObservationCaptureOutputFiltered = z.infer<
  typeof neuralObservationCaptureOutputFilteredSchema
>;
export type NeuralObservationCaptureOutputFailure = z.infer<
  typeof neuralObservationCaptureOutputFailureSchema
>;
export type NeuralProfileUpdateOutputSuccess = z.infer<
  typeof neuralProfileUpdateOutputSuccessSchema
>;
export type NeuralProfileUpdateOutputFailure = z.infer<
  typeof neuralProfileUpdateOutputFailureSchema
>;

// Backfill workflow type exports
export type BackfillOrchestratorInput = z.infer<
  typeof backfillOrchestratorInputSchema
>;
export type BackfillOrchestratorOutputSuccess = z.infer<
  typeof backfillOrchestratorOutputSuccessSchema
>;
export type BackfillOrchestratorOutputFailure = z.infer<
  typeof backfillOrchestratorOutputFailureSchema
>;

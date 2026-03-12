import { sourceTypeSchema } from "@repo/console-providers";
import { z } from "zod";

// =============================================================================
// EVENT CAPTURE - INPUT
// =============================================================================

const eventCaptureInputSchema = z.object({
  inngestFunctionId: z.literal("event.capture"),
  sourceId: z.string(),
  source: z.string(), // github, vercel
  sourceType: z.string(), // push, pull_request, deployment.succeeded
  title: z.string(),
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
  // Event pipeline
  eventCaptureInputSchema,
  // Backfill workflows
  backfillOrchestratorInputSchema,
]);

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type EventCaptureInput = z.infer<typeof eventCaptureInputSchema>;

// =============================================================================
// EVENT CAPTURE - OUTPUT (SUCCESS)
// =============================================================================

const eventCaptureOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("event.capture"),
  status: z.literal("success"),
  observationId: z.string(), // externalId (nanoid)
  observationType: z.string(),
  significanceScore: z.number(),
  entitiesExtracted: z.number().int().nonnegative(),
});

// =============================================================================
// EVENT CAPTURE - OUTPUT (FILTERED/SKIPPED)
// =============================================================================

const eventCaptureOutputFilteredSchema = z.object({
  inngestFunctionId: z.literal("event.capture"),
  status: z.literal("filtered"),
  reason: z.enum(["duplicate", "event_not_allowed", "below_threshold"]),
  sourceId: z.string(),
  significanceScore: z.number().optional(),
});

// =============================================================================
// EVENT CAPTURE - OUTPUT (FAILURE)
// =============================================================================

const eventCaptureOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("event.capture"),
  status: z.literal("failure"),
  sourceId: z.string(),
  error: z.string(),
  step: z.string().optional(), // Which step failed
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
  // Event pipeline
  eventCaptureOutputSuccessSchema,
  eventCaptureOutputFilteredSchema,
  eventCaptureOutputFailureSchema,
  // Backfill workflows
  backfillOrchestratorOutputSuccessSchema,
  backfillOrchestratorOutputFailureSchema,
]);

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;

// Event pipeline output type exports
export type EventCaptureOutputSuccess = z.infer<
  typeof eventCaptureOutputSuccessSchema
>;
export type EventCaptureOutputFiltered = z.infer<
  typeof eventCaptureOutputFilteredSchema
>;
export type EventCaptureOutputFailure = z.infer<
  typeof eventCaptureOutputFailureSchema
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

/**
 * Operations Metrics Validation Schemas
 *
 * Type definitions for internal operations metrics tracking.
 * Used in operations_metrics table for system health monitoring.
 *
 * NOTE: This file only contains schemas for INTERNAL operations metrics.
 * For external API metrics (query_latency, queries_count, api_calls),
 * we will create a separate validation schema when implementing the
 * lightfast_api_metrics table.
 */

import { z } from "zod";
import { jobTriggerSchema } from "./job";

/**
 * Operation Metric Type Enum
 *
 * Defines supported metric types for internal operations tracking.
 *
 * Core metrics:
 * - job_duration: Background job execution time (milliseconds)
 * - documents_indexed: Count of documents successfully indexed
 * - errors: Error occurrences by type
 *
 * Neural workflow metrics:
 * - observation_captured: Successful observation captures
 * - observation_filtered: Observations filtered by source config
 * - observation_duplicate: Duplicate observations skipped
 * - observation_below_threshold: Observations below significance threshold
 * - entities_extracted: Entity extraction counts
 * - cluster_assigned: Cluster assignments
 * - cluster_summary_generated: Cluster summary generations
 * - profile_updated: Actor profile updates
 */
export const operationMetricTypeSchema = z.enum([
  "job_duration",
  "documents_indexed",
  "errors",
  // Neural workflow metrics
  "observation_captured",
  "observation_filtered",
  "observation_duplicate",
  "observation_below_threshold",
  "entities_extracted",
  "cluster_assigned",
  "cluster_summary_generated",
  "profile_updated",
]);

export type OperationMetricType = z.infer<typeof operationMetricTypeSchema>;

/**
 * Operation Metric Unit Enum
 */
export const operationMetricUnitSchema = z.enum(["ms", "count"]);

export type OperationMetricUnit = z.infer<typeof operationMetricUnitSchema>;

/**
 * Tag Schemas for Operation Metrics
 *
 * Separate schemas for type-specific tags to ensure proper validation
 * and enable reuse across the application.
 */

// Job duration metric tags
export const jobDurationTagsSchema = z.object({
  jobType: z.string(),
  trigger: jobTriggerSchema,
  syncMode: z.enum(["full", "incremental"]).optional(),
  sourceType: z.string().optional(),
});

// Documents indexed metric tags
export const documentsIndexedTagsSchema = z.object({
  jobType: z.string(),
  sourceType: z.string(),
  syncMode: z.enum(["full", "incremental"]).optional(),
  filesProcessed: z.number().int().nonnegative().optional(),
});

// Error metric tags
export const errorTagsSchema = z.object({
  jobType: z.string(),
  errorType: z.string(),
  trigger: jobTriggerSchema.optional(),
  sourceType: z.string().optional(),
});

// Type exports for tags
export type JobDurationTags = z.infer<typeof jobDurationTagsSchema>;
export type DocumentsIndexedTags = z.infer<typeof documentsIndexedTagsSchema>;
export type ErrorTags = z.infer<typeof errorTagsSchema>;

// ============================================================================
// Neural Workflow Metric Tags
// ============================================================================

/**
 * Neural observation metric tags
 * Common tags for all observation-related metrics
 */
export const neuralObservationTagsSchema = z.object({
  source: z.string(), // github, vercel, etc.
  sourceType: z.string(), // push, pull_request, etc.
  observationType: z.string().optional(),
  significanceScore: z.number().optional(),
  durationMs: z.number().optional(),
});

/**
 * Entity extraction metric tags
 */
export const entityExtractionTagsSchema = z.object({
  observationId: z.string(),
  entityCount: z.number(),
  source: z.string().optional(),
});

/**
 * Cluster metric tags
 */
export const clusterTagsSchema = z.object({
  clusterId: z.string(),
  isNew: z.boolean().optional(),
  observationCount: z.number().optional(),
});

/**
 * Profile update metric tags
 */
export const profileUpdateTagsSchema = z.object({
  actorId: z.string(),
  observationId: z.string().optional(),
});

// Neural metric type exports
export type NeuralObservationTags = z.infer<typeof neuralObservationTagsSchema>;
export type EntityExtractionTags = z.infer<typeof entityExtractionTagsSchema>;
export type ClusterTags = z.infer<typeof clusterTagsSchema>;
export type ProfileUpdateTags = z.infer<typeof profileUpdateTagsSchema>;

/**
 * Discriminated Union: Operation Metric with Type-Specific Tags
 *
 * This ensures that each metric type has appropriate, type-safe tags.
 * The discriminator is the `type` field.
 */

// Job Duration Metric
export const jobDurationMetricSchema = z.object({
  type: z.literal("job_duration"),
  value: z.number().int().positive(), // milliseconds
  unit: z.literal("ms"),
  tags: jobDurationTagsSchema,
});

// Documents Indexed Metric
export const documentsIndexedMetricSchema = z.object({
  type: z.literal("documents_indexed"),
  value: z.number().int().nonnegative(), // count
  unit: z.literal("count"),
  tags: documentsIndexedTagsSchema,
});

// Error Metric
export const errorMetricSchema = z.object({
  type: z.literal("errors"),
  value: z.literal(1), // Always 1 per error occurrence
  unit: z.literal("count"),
  tags: errorTagsSchema,
});

// ============================================================================
// Neural Workflow Metric Schemas
// ============================================================================

// Observation Captured Metric
export const observationCapturedMetricSchema = z.object({
  type: z.literal("observation_captured"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: neuralObservationTagsSchema,
});

// Observation Filtered Metric
export const observationFilteredMetricSchema = z.object({
  type: z.literal("observation_filtered"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: neuralObservationTagsSchema,
});

// Observation Duplicate Metric
export const observationDuplicateMetricSchema = z.object({
  type: z.literal("observation_duplicate"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: neuralObservationTagsSchema,
});

// Observation Below Threshold Metric
export const observationBelowThresholdMetricSchema = z.object({
  type: z.literal("observation_below_threshold"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: neuralObservationTagsSchema,
});

// Entities Extracted Metric
export const entitiesExtractedMetricSchema = z.object({
  type: z.literal("entities_extracted"),
  value: z.number().int().nonnegative(), // count of entities
  unit: z.literal("count"),
  tags: entityExtractionTagsSchema,
});

// Cluster Assigned Metric
export const clusterAssignedMetricSchema = z.object({
  type: z.literal("cluster_assigned"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: clusterTagsSchema,
});

// Cluster Summary Generated Metric
export const clusterSummaryGeneratedMetricSchema = z.object({
  type: z.literal("cluster_summary_generated"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: clusterTagsSchema,
});

// Profile Updated Metric
export const profileUpdatedMetricSchema = z.object({
  type: z.literal("profile_updated"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: profileUpdateTagsSchema,
});

/**
 * Union of all operation metric types
 *
 * This discriminated union ensures type safety:
 * - job_duration must have jobType and trigger tags
 * - documents_indexed must have sourceType
 * - errors must have errorType
 * - Neural metrics have their respective tags
 */
export const operationMetricSchema = z.discriminatedUnion("type", [
  jobDurationMetricSchema,
  documentsIndexedMetricSchema,
  errorMetricSchema,
  // Neural workflow metrics
  observationCapturedMetricSchema,
  observationFilteredMetricSchema,
  observationDuplicateMetricSchema,
  observationBelowThresholdMetricSchema,
  entitiesExtractedMetricSchema,
  clusterAssignedMetricSchema,
  clusterSummaryGeneratedMetricSchema,
  profileUpdatedMetricSchema,
]);

export type OperationMetric =
  | z.infer<typeof jobDurationMetricSchema>
  | z.infer<typeof documentsIndexedMetricSchema>
  | z.infer<typeof errorMetricSchema>
  | z.infer<typeof observationCapturedMetricSchema>
  | z.infer<typeof observationFilteredMetricSchema>
  | z.infer<typeof observationDuplicateMetricSchema>
  | z.infer<typeof observationBelowThresholdMetricSchema>
  | z.infer<typeof entitiesExtractedMetricSchema>
  | z.infer<typeof clusterAssignedMetricSchema>
  | z.infer<typeof clusterSummaryGeneratedMetricSchema>
  | z.infer<typeof profileUpdatedMetricSchema>;

// Legacy exports (deprecated - use operation-specific schemas above)
/**
 * @deprecated Use operationMetricTypeSchema instead
 */
export const metricTypeSchema = operationMetricTypeSchema;

/**
 * @deprecated Use OperationMetricType instead
 */
export type MetricType = OperationMetricType;

/**
 * @deprecated Use operationMetricUnitSchema instead
 */
export const metricUnitSchema = operationMetricUnitSchema;

/**
 * @deprecated Use OperationMetricUnit instead
 */
export type MetricUnit = OperationMetricUnit;

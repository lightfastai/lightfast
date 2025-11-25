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
 * - job_duration: Background job execution time (milliseconds)
 * - documents_indexed: Count of documents successfully indexed
 * - errors: Error occurrences by type
 */
export const operationMetricTypeSchema = z.enum([
  "job_duration",
  "documents_indexed",
  "errors",
]);

export type OperationMetricType = z.infer<typeof operationMetricTypeSchema>;

/**
 * Operation Metric Unit Enum
 */
export const operationMetricUnitSchema = z.enum(["ms", "count"]);

export type OperationMetricUnit = z.infer<typeof operationMetricUnitSchema>;

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
  tags: z
    .object({
      jobType: z.string(), // Inngest function ID (e.g., "apps-console/github-sync")
      trigger: jobTriggerSchema,
      syncMode: z.enum(["full", "incremental"]).optional(),
      sourceType: z.string().optional(), // "github", "linear", "notion"
    })
    .optional(),
});

// Documents Indexed Metric
export const documentsIndexedMetricSchema = z.object({
  type: z.literal("documents_indexed"),
  value: z.number().int().nonnegative(), // count
  unit: z.literal("count"),
  tags: z
    .object({
      jobType: z.string(), // Workflow that indexed the documents
      sourceType: z.string(), // "github", "linear", "notion"
      syncMode: z.enum(["full", "incremental"]).optional(),
      filesProcessed: z.number().int().optional(), // Total files in the job
    })
    .optional(),
});

// Error Metric
export const errorMetricSchema = z.object({
  type: z.literal("errors"),
  value: z.literal(1), // Always 1 per error occurrence
  unit: z.literal("count"),
  tags: z
    .object({
      jobType: z.string(), // Job that failed
      errorType: z.string(), // Error classification (e.g., "job_failure", "api_timeout")
      trigger: jobTriggerSchema.optional(),
      sourceType: z.string().optional(),
    })
    .optional(),
});

/**
 * Union of all operation metric types
 *
 * This discriminated union ensures type safety:
 * - job_duration must have jobType and trigger tags
 * - documents_indexed must have sourceType
 * - errors must have errorType
 */
export const operationMetricSchema = z.discriminatedUnion("type", [
  jobDurationMetricSchema,
  documentsIndexedMetricSchema,
  errorMetricSchema,
]);

export type OperationMetric =
  | z.infer<typeof jobDurationMetricSchema>
  | z.infer<typeof documentsIndexedMetricSchema>
  | z.infer<typeof errorMetricSchema>;

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

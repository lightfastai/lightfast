/**
 * Metrics Validation Schemas
 *
 * Type definitions for performance and usage metrics tracking.
 * Used in metrics table for time-series analytics and dashboards.
 */

import { z } from "zod";

/**
 * Metric Type Enum
 *
 * Defines all supported metric types for time-series tracking.
 * Used in metrics table to categorize performance and usage data.
 *
 * - query_latency: Search query response time (milliseconds)
 * - queries_count: Number of search/contents queries executed
 * - documents_indexed: Count of documents successfully indexed
 * - api_calls: Total API calls made (internal or external)
 * - errors: Error occurrences by type
 * - job_duration: Background job execution time (milliseconds)
 *
 * @example
 * ```typescript
 * metricTypeSchema.parse("query_latency"); // ✅ Valid
 * metricTypeSchema.parse("documents_indexed"); // ✅ Valid
 * metricTypeSchema.parse("invalid_metric"); // ❌ Not in enum
 * ```
 */
export const metricTypeSchema = z.enum([
  "query_latency",
  "queries_count",
  "documents_indexed",
  "api_calls",
  "errors",
  "job_duration",
]);

export type MetricType = z.infer<typeof metricTypeSchema>;

/**
 * Metric Unit Enum
 *
 * Defines standard units for metric values.
 * Used in metrics table to provide context for numeric values.
 *
 * - ms: Milliseconds (for latency, duration)
 * - count: Integer count (for queries, documents, errors)
 * - percent: Percentage value (0-100)
 * - bytes: Data size in bytes
 *
 * @example
 * ```typescript
 * metricUnitSchema.parse("ms"); // ✅ Valid
 * metricUnitSchema.parse("count"); // ✅ Valid
 * metricUnitSchema.parse("seconds"); // ❌ Not in enum
 * ```
 */
export const metricUnitSchema = z.enum([
  "ms",
  "count",
  "percent",
  "bytes",
]);

export type MetricUnit = z.infer<typeof metricUnitSchema>;

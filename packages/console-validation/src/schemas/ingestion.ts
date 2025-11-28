/**
 * Ingestion Validation Schemas
 *
 * Type definitions for document ingestion events and processing status.
 * Used in ingestion_events table and ingestion workflows.
 */

import { z } from "zod";

/**
 * Ingestion Source Enum
 *
 * Defines how a document was ingested into the system.
 * Used in ingestion_events table to track ingestion origin.
 *
 * - webhook: Triggered by external webhook (GitHub push, Linear update, etc.)
 * - backfill: Historical data import/sync
 * - manual: User-initiated ingestion via UI
 * - api: Direct API call for ingestion
 *
 * @example
 * ```typescript
 * ingestionSourceSchema.parse("webhook"); // ✅ Valid
 * ingestionSourceSchema.parse("backfill"); // ✅ Valid
 * ingestionSourceSchema.parse("invalid"); // ❌ Not in enum
 * ```
 */
export const ingestionSourceSchema = z.enum([
  "webhook",
  "backfill",
  "manual",
  "api",
]);

export type IngestionSource = z.infer<typeof ingestionSourceSchema>;

/**
 * Ingestion Status Enum
 *
 * Defines the processing status of an ingestion event.
 * Used in ingestion_events table to track event processing outcome.
 *
 * - processed: Event was successfully processed and documents indexed
 * - skipped: Event was skipped (duplicate, no changes, filtered out)
 * - failed: Event processing failed with an error
 *
 * @example
 * ```typescript
 * ingestionStatusSchema.parse("processed"); // ✅ Valid
 * ingestionStatusSchema.parse("skipped"); // ✅ Valid
 * ingestionStatusSchema.parse("pending"); // ❌ Not in enum
 * ```
 */
export const ingestionStatusSchema = z.enum([
  "processed",
  "skipped",
  "failed",
]);

export type IngestionStatus = z.infer<typeof ingestionStatusSchema>;

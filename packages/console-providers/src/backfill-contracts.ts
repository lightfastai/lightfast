/**
 * Backfill Orchestration Contracts
 *
 * Cross-service schemas for the Console → Relay → Backfill orchestration pipeline.
 * These define the wire formats between the console API, relay, and backfill services.
 */

import { z } from "zod";
import { backfillDepthSchema } from "./define";
import { sourceTypeSchema } from "./registry";

// ── Installation-level Backfill Config (gatewayInstallations.backfillConfig) ──

export const gwInstallationBackfillConfigSchema = z.object({
  depth: backfillDepthSchema,
  entityTypes: z.array(z.string()).min(1),
});
export type GwInstallationBackfillConfig = z.infer<
  typeof gwInstallationBackfillConfigSchema
>;

// ── Backfill Run Statuses (internal) ──

const backfillRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

/** Terminal statuses that set `completedAt` */
export const backfillTerminalStatusSchema = z.enum([
  "completed",
  "failed",
  "cancelled",
]);
export const BACKFILL_TERMINAL_STATUSES = backfillTerminalStatusSchema.options;

// ── Trigger payload (Console → Relay → Backfill) ──

export const backfillTriggerPayload = z.object({
  installationId: z.string().min(1),
  provider: sourceTypeSchema,
  orgId: z.string().min(1),
  depth: backfillDepthSchema.default(1),
  entityTypes: z.array(z.string()).optional(),
  holdForReplay: z.boolean().optional(),
  /** Cross-service correlation ID for distributed tracing */
  correlationId: z.string().optional(),
});
export type BackfillTriggerPayload = z.infer<typeof backfillTriggerPayload>;

// ── Estimate payload (Console → Backfill, omits holdForReplay) ──

export const backfillEstimatePayload = backfillTriggerPayload.omit({
  holdForReplay: true,
});
export type BackfillEstimatePayload = z.infer<typeof backfillEstimatePayload>;

// ── Run record (Entity Worker → Gateway) ──

/** Schema for upserting a backfill run (POST body — client sends this). */
export const backfillRunRecord = z.object({
  entityType: z.string().min(1),
  providerResourceId: z.string().default(""),
  since: z.string().min(1),
  depth: backfillDepthSchema,
  status: backfillRunStatusSchema,
  pagesProcessed: z.number().int().nonnegative().default(0),
  eventsProduced: z.number().int().nonnegative().default(0),
  eventsDispatched: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
});
export type BackfillRunRecord = z.infer<typeof backfillRunRecord>;

/** Schema for reading a backfill run (GET response — server returns this).
 *  Extends the write record with server-computed timestamps. */
export const backfillRunReadRecord = backfillRunRecord.extend({
  completedAt: z.string().nullable(),
  startedAt: z.string().nullable().optional(),
});
export type BackfillRunReadRecord = z.infer<typeof backfillRunReadRecord>;

/**
 * Gateway API Response Schemas + Backfill Run Schemas
 *
 * Response shapes for connection API and backfill run tracking.
 * Consumed by @api/platform, @db/app, and console UI.
 */

import { z } from "zod";
import { backfillDepthSchema } from "../client/options";

/**
 * Gateway connection response shape.
 * Returned by GET /gateway/:id
 */
export const gatewayConnectionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  externalId: z.string(),
  orgId: z.string(),
  status: z.string(),
  resources: z.array(
    z.object({
      id: z.string(),
      providerResourceId: z.string(),
      resourceName: z.string().nullable(),
    })
  ),
});
export type GatewayConnection = z.infer<typeof gatewayConnectionSchema>;

/**
 * Lightweight installation summary for list endpoints.
 * Returned by GET /gateway?status=active
 */
export const gatewayInstallationSummarySchema = z.object({
  id: z.string(),
  provider: z.string(),
  externalId: z.string(),
  orgId: z.string(),
  status: z.string(),
});
export type GatewayInstallationSummary = z.infer<
  typeof gatewayInstallationSummarySchema
>;

/**
 * Gateway token response shape.
 * Returned by GET /gateway/:id/token
 */
export const gatewayTokenResultSchema = z.object({
  accessToken: z.string(),
  provider: z.string(),
  expiresIn: z.number().nullable(),
});
export type GatewayTokenResult = z.infer<typeof gatewayTokenResultSchema>;

// ── Installation-level Backfill Config (gatewayInstallations.backfillConfig) ──

export const gwInstallationBackfillConfigSchema = z.object({
  depth: backfillDepthSchema,
  entityTypes: z.array(z.string()).min(1),
});
export type GwInstallationBackfillConfig = z.infer<
  typeof gwInstallationBackfillConfigSchema
>;

// ── Backfill Run Statuses ──

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

/**
 * Gateway Schemas
 *
 * Zod schemas and const arrays for gateway services (relay, gateway, backfill).
 * Previously in @repo/gateway-types — consolidated here as the single source of truth.
 */

import { z } from "zod";
import { sourceTypeSchema } from "@repo/console-providers";

// ── Installation Statuses ──

export const installationStatusSchema = z.enum(["pending", "active", "error", "revoked"]);
export type InstallationStatus = z.infer<typeof installationStatusSchema>;

// ── Resource Statuses ──

export const resourceStatusSchema = z.enum(["active", "removed"]);
export type ResourceStatus = z.infer<typeof resourceStatusSchema>;

// ── Delivery Statuses ──

export const deliveryStatusSchema = z.enum(["delivered", "dlq", "duplicate"]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

// ── Backfill Depth (internal) ──

export const backfillDepthSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);

// ── Backfill Run Statuses (internal) ──

const backfillRunStatusSchema = z.enum(["pending", "running", "completed", "failed", "cancelled"]);

/** Terminal statuses that set `completedAt` */
export const backfillTerminalStatusSchema = z.enum(["completed", "failed", "cancelled"]);
export const BACKFILL_TERMINAL_STATUSES = backfillTerminalStatusSchema.options;

// ── Trigger payload (Console → Relay → Backfill) ──

export const backfillTriggerPayload = z.object({
  installationId: z.string().min(1),
  provider: sourceTypeSchema,
  orgId: z.string().min(1),
  depth: backfillDepthSchema.default(30),
  entityTypes: z.array(z.string()).optional(),
  holdForReplay: z.boolean().optional(),
});
export type BackfillTriggerPayload = z.infer<typeof backfillTriggerPayload>;

// ── Estimate payload (Console → Backfill, omits holdForReplay) ──

export const backfillEstimatePayload = backfillTriggerPayload.omit({ holdForReplay: true });
export type BackfillEstimatePayload = z.infer<typeof backfillEstimatePayload>;

// ── Run record (Entity Worker → Gateway) ──

export const backfillRunRecord = z.object({
  entityType: z.string().min(1),
  since: z.string().min(1),
  depth: backfillDepthSchema,
  status: backfillRunStatusSchema,
  pagesProcessed: z.number().int().nonnegative().default(0),
  eventsProduced: z.number().int().nonnegative().default(0),
  eventsDispatched: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
});
export type BackfillRunRecord = z.infer<typeof backfillRunRecord>;

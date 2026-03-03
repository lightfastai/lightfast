import { z } from "zod";

// ── Shared primitives ──

export const backfillDepthSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);
export type BackfillDepth = z.infer<typeof backfillDepthSchema>;

export const BACKFILL_RUN_STATUSES = ["pending", "running", "completed", "failed", "cancelled"] as const;
export const backfillRunStatusSchema = z.enum(BACKFILL_RUN_STATUSES);
export type BackfillRunStatus = z.infer<typeof backfillRunStatusSchema>;

/** Terminal statuses that set `completedAt` */
export const BACKFILL_TERMINAL_STATUSES: readonly BackfillRunStatus[] = ["completed", "failed", "cancelled"];

// ── Trigger payload (Console → Relay → Backfill) ──

export const backfillTriggerPayload = z.object({
  installationId: z.string().min(1),
  provider: z.string().min(1),
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

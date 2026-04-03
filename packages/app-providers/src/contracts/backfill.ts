/**
 * Backfill Orchestration Contracts
 *
 * Cross-service schemas for the Console → Platform backfill orchestration pipeline.
 * These define the wire formats between the console API and the platform service.
 */

import { z } from "zod";
import { providerSlugSchema } from "../client/display";
import { backfillDepthSchema } from "../client/options";

// ── Trigger payload (Console → Platform backfill) ──

export const backfillTriggerPayload = z.object({
  installationId: z.string().min(1),
  provider: providerSlugSchema,
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

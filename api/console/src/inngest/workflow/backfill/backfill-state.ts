/**
 * Backfill state update helpers
 *
 * Provides functions to update the backfill state stored in
 * workspaceIntegrations.sourceConfig.backfill via jsonb_set operations.
 */
import { db } from "@db/console/client";
import { workspaceIntegrations } from "@db/console/schema";
import { eq, sql } from "drizzle-orm";
import type { BackfillCheckpoint } from "@repo/console-backfill";

interface BackfillState {
  status: "idle" | "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt?: string;
  completedAt?: string;
  depth?: number;
  entityTypes?: string[];
  requestedBy?: string;
  error?: string;
  eventsProduced?: number;
  eventsDispatched?: number;
  errorCount?: number;
  durationMs?: number;
  nextAllowedAt?: string;
  checkpoint?: BackfillCheckpoint;
}

/**
 * Full replacement of sourceConfig.backfill via jsonb_set.
 * Creates the backfill key if it doesn't exist.
 */
export async function updateBackfillState(
  integrationId: string,
  state: BackfillState,
): Promise<void> {
  await db
    .update(workspaceIntegrations)
    .set({
      sourceConfig: sql`jsonb_set(
        COALESCE(${workspaceIntegrations.sourceConfig}::jsonb, '{}'::jsonb),
        '{backfill}',
        ${JSON.stringify(state)}::jsonb
      )`,
    })
    .where(eq(workspaceIntegrations.id, integrationId));
}

/**
 * Update only the checkpoint within sourceConfig.backfill via nested jsonb_set.
 * Preserves all other backfill state fields.
 */
export async function updateBackfillCheckpoint(
  integrationId: string,
  checkpoint: BackfillCheckpoint,
): Promise<void> {
  await db
    .update(workspaceIntegrations)
    .set({
      sourceConfig: sql`jsonb_set(
        COALESCE(${workspaceIntegrations.sourceConfig}::jsonb, '{}'::jsonb),
        '{backfill,checkpoint}',
        ${JSON.stringify(checkpoint)}::jsonb
      )`,
    })
    .where(eq(workspaceIntegrations.id, integrationId));
}

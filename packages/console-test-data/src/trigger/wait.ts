/**
 * Wait for Workflow Completion
 *
 * Polls the database to check if observations have been captured.
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface WaitOptions {
  workspaceId: string;
  sourceIds: string[];
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface WaitResult {
  completed: number;
  pending: number;
  timedOut: boolean;
  duration: number;
}

/**
 * Wait for observations to be captured by polling the database
 *
 * Note: In production, this would use Inngest's event subscription.
 * For testing, polling is simpler and sufficient.
 */
export const waitForCapture = async (options: WaitOptions): Promise<WaitResult> => {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs ?? 60000; // 1 minute default
  const pollIntervalMs = options.pollIntervalMs ?? 1000;

  let completed = 0;

  while (Date.now() - startTime < timeoutMs) {
    // Query for observations with matching sourceIds
    const captured = await db.query.workspaceNeuralObservations.findMany({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, options.workspaceId),
        inArray(workspaceNeuralObservations.sourceId, options.sourceIds)
      ),
      columns: { sourceId: true },
    });

    completed = captured.length;

    // Check if all events are captured or filtered (they won't appear if below threshold)
    // For now, consider done when we have >50% of events (some may be filtered)
    if (completed >= options.sourceIds.length * 0.5) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    completed,
    pending: options.sourceIds.length - completed,
    timedOut: Date.now() - startTime >= timeoutMs,
    duration: Date.now() - startTime,
  };
};

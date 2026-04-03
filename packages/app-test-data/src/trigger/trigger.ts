/**
 * Inngest Event Trigger
 *
 * Triggers observation capture events via the Inngest workflow.
 */

import { randomUUID } from "node:crypto";
import { inngest } from "@api/platform/inngest/client";
import type { PostTransformEvent } from "@repo/app-providers/contracts";

export interface TriggerOptions {
  batchSize?: number; // Number of events to send in parallel per batch
  clerkOrgId: string;
  delayMs?: number; // Delay between batches to avoid overwhelming
  onProgress?: (current: number, total: number) => void;
}

export interface TriggerResult {
  duration: number;
  sourceIds: string[];
  triggered: number;
}

/**
 * Split array into chunks of specified size
 */
const chunk = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

/**
 * Trigger event capture for a batch of PostTransformEvents
 * Uses Promise.all with batching for better performance
 */
export const triggerEventCapture = async (
  events: PostTransformEvent[],
  options: TriggerOptions
): Promise<TriggerResult> => {
  const startTime = Date.now();
  const sourceIds: string[] = [];
  const batchSize = options.batchSize ?? 10;
  const delayMs = options.delayMs ?? 100;

  // Generate unique run ID for this injection batch
  // This allows re-injecting to same org without hitting idempotency
  const runId = randomUUID();

  const batches = chunk(events, batchSize);
  let processed = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    if (!batch) {
      continue;
    }

    const results = await Promise.all(
      batch.map(async (event) => {
        // Use runId prefix so each injection run gets fresh event IDs
        const eventId = `${runId}:${event.sourceId}`;

        await inngest.send({
          name: "memory/event.capture",
          id: eventId,
          data: {
            clerkOrgId: options.clerkOrgId,
            sourceEvent: event,
          },
        });
        return event.sourceId;
      })
    );

    sourceIds.push(...results);
    processed += batch.length;
    options.onProgress?.(processed, events.length);

    // Delay between batches to avoid rate limiting
    if (delayMs > 0 && batchIndex < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    triggered: events.length,
    sourceIds,
    duration: Date.now() - startTime,
  };
};

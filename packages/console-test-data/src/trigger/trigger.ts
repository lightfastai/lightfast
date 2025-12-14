/**
 * Inngest Event Trigger
 *
 * Triggers observation capture events via the Inngest workflow.
 */

import type { SourceEvent } from "@repo/console-types";
import { inngest } from "@api/console/inngest/client";

export interface TriggerOptions {
  workspaceId: string;
  onProgress?: (current: number, total: number) => void;
  batchSize?: number; // Number of events to send in parallel per batch
  delayMs?: number; // Delay between batches to avoid overwhelming
}

export interface TriggerResult {
  triggered: number;
  sourceIds: string[];
  duration: number;
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
 * Trigger observation capture events for a batch of SourceEvents
 * Uses Promise.all with batching for better performance
 */
export const triggerObservationCapture = async (
  events: SourceEvent[],
  options: TriggerOptions
): Promise<TriggerResult> => {
  const startTime = Date.now();
  const sourceIds: string[] = [];
  const batchSize = options.batchSize ?? 10;
  const delayMs = options.delayMs ?? 100;

  const batches = chunk(events, batchSize);
  let processed = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    if (!batch) continue;

    const results = await Promise.all(
      batch.map(async (event) => {
        await inngest.send({
          name: "apps-console/neural/observation.capture",
          data: {
            workspaceId: options.workspaceId,
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
